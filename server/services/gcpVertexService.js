// gcpVertexService.js - Manage GCS storage and Vertex AI Custom Jobs for GPU offloading
const { Storage } = require('@google-cloud/storage');
const { JobServiceClient } = require('@google-cloud/aiplatform').v1;
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

// Lazy initialize to avoid crashing if credentials are not configured
let storageClient = null;
let jobClient = null;

function getStorage() {
  if (storageClient) return storageClient;
  if (!isConfigured()) return null;
  try {
    storageClient = new Storage();
  } catch (err) {
    logger.warn('[GCPVertex] Failed to initialize GCS storage client', { error: err.message });
    return null;
  }
  return storageClient;
}

function getJobClient() {
  if (jobClient) return jobClient;
  if (!isConfigured()) return null;
  try {
    const region = process.env.GCP_REGION || 'us-central1';
    jobClient = new JobServiceClient({
      apiEndpoint: `${region}-aiplatform.googleapis.com`
    });
  } catch (err) {
    logger.warn('[GCPVertex] Failed to initialize Vertex AI client', { error: err.message });
    return null;
  }
  return jobClient;
}

function isConfigured() {
  return !!(
    process.env.GCP_PROJECT_ID &&
    process.env.GCP_REGION &&
    process.env.GCS_BUCKET_NAME
  );
}

/**
 * Uploads a local file to GCS
 * @param {string} localPath
 * @param {string} gcsBlobName
 * @returns {Promise<string>} GCS gs:// URL
 */
async function uploadToGCS(localPath, gcsBlobName) {
  const storage = getStorage();
  if (!storage) throw new Error('GCS Storage is not configured.');

  const bucketName = process.env.GCS_BUCKET_NAME;
  logger.info(`[GCPVertex] Uploading local file to GCS: ${localPath} -> gs://${bucketName}/${gcsBlobName}`);

  await storage.bucket(bucketName).upload(localPath, {
    destination: gcsBlobName
  });

  return `gs://${bucketName}/${gcsBlobName}`;
}

/**
 * Downloads a file from GCS to local path
 * @param {string} gcsUrl
 * @param {string} localPath
 */
async function downloadFromGCS(gcsUrl, localPath) {
  const storage = getStorage();
  if (!storage) throw new Error('GCS Storage is not configured.');

  const bucketName = process.env.GCS_BUCKET_NAME;
  const blobName = gcsUrl.replace(`gs://${bucketName}/`, '');

  logger.info(`[GCPVertex] Downloading from GCS: ${gcsUrl} -> ${localPath}`);
  
  const dir = path.dirname(localPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  await storage.bucket(bucketName).file(blobName).download({
    destination: localPath
  });
  return localPath;
}

/**
 * Triggers a Vertex AI Custom Job and polls for completion
 * @param {object} params
 * @param {string} params.task - "inpainting" | "background_swap" | "background_removal"
 * @param {string} params.videoId
 * @param {string} params.inputGcsUrl
 * @param {string} [params.maskGcsUrl]
 * @param {string} [params.bgGcsUrl]
 * @param {string} params.outputGcsUrl
 * @returns {Promise<string>} output GCS gs:// URL
 */
async function runVertexCustomJob({ task, videoId, inputGcsUrl, maskGcsUrl, bgGcsUrl, avatarUrl, audioUrl, outputGcsUrl }) {
  const client = getJobClient();
  if (!client) throw new Error('Vertex AI client is not configured.');

  const projectId = process.env.GCP_PROJECT_ID;
  const region = process.env.GCP_REGION || 'us-central1';
  const parent = `projects/${projectId}/locations/${region}`;

  const imageUri = process.env.GCP_WORKER_IMAGE_URI || `gcr.io/${projectId}/click-gpu-worker:latest`;

  const jobArgs = [
    '--task', task,
    '--output-url', outputGcsUrl
  ];

  if (inputGcsUrl) jobArgs.push('--video-url', inputGcsUrl);
  if (maskGcsUrl) jobArgs.push('--mask-url', maskGcsUrl);
  if (bgGcsUrl) jobArgs.push('--background-url', bgGcsUrl);
  if (avatarUrl) jobArgs.push('--avatar-url', avatarUrl);
  if (audioUrl) jobArgs.push('--audio-url', audioUrl);

  const customJob = {
    displayName: `click-${task}-${videoId}-${Date.now()}`,
    jobSpec: {
      workerPoolSpecs: [
        {
          machineSpec: {
            machineType: 'g2-standard-4', // 4 vCPUs, 16GB Memory, 1x NVIDIA L4 GPU
            acceleratorType: 'NVIDIA_L4',
            acceleratorCount: 1
          },
          replicaCount: '1',
          containerSpec: {
            imageUri,
            args: jobArgs
          }
        }
      ]
    }
  };

  logger.info(`[GCPVertex] Creating Vertex AI Custom Job...`, { task, videoId, imageUri });

  const [job] = await client.createCustomJob({ parent, customJob });
  const jobId = job.name.split('/').pop();
  logger.info(`[GCPVertex] Custom Job created successfully: ${jobId}`);

  // Poll for completion, bounded by a hard deadline. Without one, a job stuck
  // in a non-terminal state (RUNNING/PENDING) would poll forever — leaking the
  // interval timer and never settling the caller's await. The `settled` guard
  // also makes resolve/reject strictly single-shot.
  const POLL_MS = 15000; // 15s — sane for Vertex AI startup time
  const DEADLINE_MS = Number(process.env.GCP_VERTEX_JOB_TIMEOUT_MS) || 45 * 60 * 1000;
  return new Promise((resolve, reject) => {
    let settled = false;
    let pollInterval = null;
    let deadlineTimer = null;
    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      if (pollInterval) clearInterval(pollInterval);
      if (deadlineTimer) clearTimeout(deadlineTimer);
      fn(arg);
    };

    deadlineTimer = setTimeout(() => {
      logger.error(`[GCPVertex] Job ${jobId} exceeded ${DEADLINE_MS}ms deadline — abandoning poll`);
      finish(reject, new Error(`Vertex AI Job timed out after ${DEADLINE_MS}ms`));
    }, DEADLINE_MS);

    pollInterval = setInterval(async () => {
      try {
        const [jobStatus] = await client.getCustomJob({ name: job.name });
        const state = jobStatus.state;

        logger.info(`[GCPVertex] Job status polling... Job: ${jobId}, State: ${state}`);

        if (state === 'JOB_STATE_SUCCEEDED') {
          logger.info(`[GCPVertex] Job completed successfully!`);
          finish(resolve, outputGcsUrl);
        } else if (
          state === 'JOB_STATE_FAILED' ||
          state === 'JOB_STATE_CANCELLED' ||
          state === 'JOB_STATE_EXPIRED'
        ) {
          const errorMsg = jobStatus.error?.message || 'Unknown execution error';
          logger.error(`[GCPVertex] Job failed with state ${state}: ${errorMsg}`);
          finish(reject, new Error(`Vertex AI Job failed: ${errorMsg}`));
        }
      } catch (err) {
        logger.error(`[GCPVertex] Error during status polling`, { error: err.message });
        finish(reject, err);
      }
    }, POLL_MS);
  });
}

module.exports = {
  isConfigured,
  uploadToGCS,
  downloadFromGCS,
  runVertexCustomJob
};
