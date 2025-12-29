// Scene Detection Job Service
// Handles async scene detection jobs with status tracking

const SceneDetectionJob = require('../models/SceneDetectionJob');
const { detectScenes } = require('./sceneDetectionService');
const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');

/**
 * Create and start async scene detection job
 */
async function createSceneDetectionJob(contentId, userId, workspaceId, options = {}) {
  try {
    // Create job record
    const job = new SceneDetectionJob({
      contentId,
      userId,
      workspaceId,
      status: 'pending',
      progress: 0,
      parameters: {
        sensitivity: options.sensitivity || 0.3,
        minSceneLength: options.minSceneLength || 1.0,
        maxSceneLength: options.maxSceneLength || null,
        fps: options.fps || 3,
        useMultiModal: options.useMultiModal !== false,
        workflowType: options.workflowType || 'general',
        extractMetadata: options.extractMetadata !== false
      }
    });

    await job.save();

    // Start processing in background (don't await)
    processSceneDetectionJob(job._id).catch(error => {
      logger.error('Background scene detection job failed', { 
        jobId: job._id, 
        error: error.message 
      });
    });

    return job;
  } catch (error) {
    logger.error('Error creating scene detection job', { error: error.message, contentId });
    captureException(error, { tags: { service: 'scene_detection_job' } });
    throw error;
  }
}

/**
 * Process scene detection job in background
 */
async function processSceneDetectionJob(jobId) {
  const job = await SceneDetectionJob.findById(jobId);
  if (!job) {
    logger.error('Scene detection job not found', { jobId });
    return;
  }

  try {
    // Update status to processing
    job.status = 'processing';
    job.startedAt = new Date();
    job.progress = 0;
    job.currentStep = 'Initializing scene detection...';
    await job.save();

    // Emit progress update
    emitJobProgress(job, 0, 'Starting scene detection...');

    // Prepare options with progress callback
    const options = {
      ...job.parameters,
      userId: job.userId.toString(),
      useCache: false, // Don't use cache for jobs
      emitProgress: true,
      onProgress: (progress, message) => {
        updateJobProgress(job._id, progress, message).catch(err => {
          logger.warn('Error updating job progress', { jobId: job._id, error: err.message });
        });
      }
    };

    // Run detection
    const result = await detectScenes(job.contentId.toString(), options);

    // Update job with results
    job.status = 'completed';
    job.progress = 100;
    job.currentStep = `Completed: ${result.totalScenes} scenes detected`;
    job.sceneCount = result.totalScenes;
    job.completedAt = new Date();
    await job.save();

    // Emit completion event
    emitJobComplete(job, result);

    // Log analytics
    logSceneDetectionAnalytics(job, result).catch(err => {
      logger.warn('Error logging analytics', { error: err.message });
    });

    logger.info('Scene detection job completed', { jobId: job._id, sceneCount: result.totalScenes });
  } catch (error) {
    logger.error('Scene detection job failed', { jobId: job._id, error: error.message });
    
    // Update job with error
    job.status = 'failed';
    job.error = {
      message: error.message,
      stack: error.stack
    };
    job.completedAt = new Date();
    await job.save();

    // Emit failure event
    emitJobFailed(job, error);

    captureException(error, { 
      tags: { service: 'scene_detection_job', jobId: job._id.toString() },
      extra: { contentId: job.contentId, userId: job.userId }
    });
  }
}

/**
 * Update job progress
 */
async function updateJobProgress(jobId, progress, message) {
  try {
    await SceneDetectionJob.findByIdAndUpdate(jobId, {
      $set: {
        progress: Math.min(100, Math.max(0, progress)),
        currentStep: message,
        updatedAt: new Date()
      }
    });

    // Emit progress update
    const job = await SceneDetectionJob.findById(jobId);
    if (job) {
      emitJobProgress(job, progress, message);
    }
  } catch (error) {
    logger.warn('Error updating job progress', { jobId, error: error.message });
  }
}

/**
 * Get job status
 */
async function getJobStatus(jobId, userId) {
  try {
    const job = await SceneDetectionJob.findOne({ _id: jobId, userId });
    if (!job) {
      throw new Error('Job not found');
    }
    return job;
  } catch (error) {
    logger.error('Error getting job status', { jobId, error: error.message });
    throw error;
  }
}

/**
 * Get job status by content ID
 */
async function getJobStatusByContent(contentId, userId) {
  try {
    const job = await SceneDetectionJob.findOne({ contentId, userId })
      .sort({ createdAt: -1 })
      .limit(1);
    return job;
  } catch (error) {
    logger.error('Error getting job status by content', { contentId, error: error.message });
    throw error;
  }
}

/**
 * Cancel job
 */
async function cancelJob(jobId, userId) {
  try {
    const job = await SceneDetectionJob.findOne({ _id: jobId, userId });
    if (!job) {
      throw new Error('Job not found');
    }

    if (job.status === 'completed' || job.status === 'failed') {
      throw new Error('Cannot cancel completed or failed job');
    }

    job.status = 'cancelled';
    job.completedAt = new Date();
    await job.save();

    emitJobCancelled(job);
    return job;
  } catch (error) {
    logger.error('Error cancelling job', { jobId, error: error.message });
    throw error;
  }
}

/**
 * Re-run scene detection with new parameters
 */
async function rerunSceneDetection(contentId, userId, workspaceId, options = {}) {
  try {
    // Cancel any pending/processing jobs for this content
    await SceneDetectionJob.updateMany(
      { contentId, userId, status: { $in: ['pending', 'processing'] } },
      { $set: { status: 'cancelled', completedAt: new Date() } }
    );

    // Create new job with updated parameters
    return await createSceneDetectionJob(contentId, userId, workspaceId, options);
  } catch (error) {
    logger.error('Error re-running scene detection', { contentId, error: error.message });
    throw error;
  }
}

/**
 * Emit job progress via WebSocket
 */
function emitJobProgress(job, progress, message) {
  try {
    const { emitToUser } = require('./socketService');
    emitToUser(job.userId.toString(), 'scene-detection-job-progress', {
      jobId: job._id,
      contentId: job.contentId,
      status: job.status,
      progress,
      message,
      currentStep: message
    });
  } catch (error) {
    // Non-critical
    logger.debug('WebSocket emit failed (non-critical)', { error: error.message });
  }
}

/**
 * Emit job completion
 */
function emitJobComplete(job, result) {
  try {
    const { emitToUser } = require('./socketService');
    emitToUser(job.userId.toString(), 'scene-detection-job-complete', {
      jobId: job._id,
      contentId: job.contentId,
      status: 'completed',
      sceneCount: result.totalScenes,
      scenes: result.scenes
    });
  } catch (error) {
    logger.debug('WebSocket emit failed (non-critical)', { error: error.message });
  }
}

/**
 * Emit job failure
 */
function emitJobFailed(job, error) {
  try {
    const { emitToUser } = require('./socketService');
    emitToUser(job.userId.toString(), 'scene-detection-job-failed', {
      jobId: job._id,
      contentId: job.contentId,
      status: 'failed',
      error: error.message
    });
  } catch (error) {
    logger.debug('WebSocket emit failed (non-critical)', { error: error.message });
  }
}

/**
 * Emit job cancellation
 */
function emitJobCancelled(job) {
  try {
    const { emitToUser } = require('./socketService');
    emitToUser(job.userId.toString(), 'scene-detection-job-cancelled', {
      jobId: job._id,
      contentId: job.contentId,
      status: 'cancelled'
    });
  } catch (error) {
    logger.debug('WebSocket emit failed (non-critical)', { error: error.message });
  }
}

/**
 * Log analytics for scene detection
 */
async function logSceneDetectionAnalytics(job, result) {
  try {
    const SceneDetectionAnalytics = require('../models/SceneDetectionAnalytics');
    const Scene = require('../models/Scene');

    // Get scenes to calculate metrics
    const scenes = await Scene.find({ contentId: job.contentId }).lean();
    
    if (scenes.length === 0) {
      return;
    }

    const sceneLengths = scenes.map(s => s.duration || (s.end - s.start));
    const averageLength = sceneLengths.reduce((a, b) => a + b, 0) / sceneLengths.length;
    const minLength = Math.min(...sceneLengths);
    const maxLength = Math.max(...sceneLengths);

    // Count detection sources
    const detectionSources = {
      visual: scenes.filter(s => s.detectionSources?.includes('visual')).length,
      audio: scenes.filter(s => s.detectionSources?.includes('audio')).length,
      text: scenes.filter(s => s.detectionSources?.includes('text')).length
    };

    // Calculate average quality
    const qualities = scenes
      .map(s => s.quality?.overall || 0)
      .filter(q => q > 0);
    const averageQuality = qualities.length > 0
      ? qualities.reduce((a, b) => a + b, 0) / qualities.length
      : null;
    const highQualityScenes = qualities.filter(q => q >= 0.7).length;

    // Create analytics record
    await SceneDetectionAnalytics.create({
      contentId: job.contentId,
      userId: job.userId,
      workspaceId: job.workspaceId,
      sceneCount: scenes.length,
      averageSceneLength: averageLength,
      minSceneLength: minLength,
      maxSceneLength: maxLength,
      sensitivity: job.parameters.sensitivity,
      minSceneLengthParam: job.parameters.minSceneLength,
      maxSceneLengthParam: job.parameters.maxSceneLength,
      useMultiModal: job.parameters.useMultiModal,
      workflowType: job.parameters.workflowType,
      averageQuality,
      highQualityScenes,
      detectionSources
    });
  } catch (error) {
    logger.warn('Error logging scene detection analytics', { error: error.message });
  }
}

module.exports = {
  createSceneDetectionJob,
  processSceneDetectionJob,
  getJobStatus,
  getJobStatusByContent,
  cancelJob,
  rerunSceneDetection,
  updateJobProgress
};







