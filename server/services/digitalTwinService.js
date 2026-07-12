const logger = require('../utils/logger');
const crypto = require('crypto');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// Helper to download files in node
async function downloadFileHelper(url, outputPath) {
  const writer = fs.createWriteStream(outputPath);
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream'
  });
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

/**
 * Digital Twin Service: Zero-Input Avatar Generation
 * Integrates with high-fidelity models like HeyGen or Sora,
 * with robust local (FFmpeg/OpenCV) and GCP Vertex AI GPU offloading fallbacks.
 */
class DigitalTwinService {
  constructor() {
    this.generationJobs = new Map();
    this.soraApiKey = process.env.SORA_API_KEY;
    this.heygenApiKey = process.env.HEYGEN_API_KEY;
  }

  /**
   * Create a digital twin video from a voice note
   * @param {string} userId
   * @param {string} voiceNoteUrl
   * @param {Object} options
   */
  async createAvatarVideo(userId, voiceNoteUrl, options = {}) {
    try {
      const jobId = `TWIN-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const provider = options.provider || (this.heygenApiKey ? 'heygen' : 'simulated');
      
      logger.info('Starting Digital Twin Generation', { userId, jobId, provider });

      const job = {
        id: jobId,
        userId,
        voiceNoteUrl,
        status: 'initializing',
        provider,
        type: options.type || 'avatar_lipsync',
        model: options.model || 'high_fidelity_v2',
        resolution: options.resolution || '4K',
        progress: 0,
        createdAt: Date.now()
      };

      // Bound the in-memory job registry (FIFO eviction of the oldest entry).
      const MAX_GENERATION_JOBS = 1000;
      if (this.generationJobs.size >= MAX_GENERATION_JOBS) {
        const oldest = this.generationJobs.keys().next().value;
        if (oldest !== undefined) this.generationJobs.delete(oldest);
      }
      this.generationJobs.set(jobId, job);

      if (provider === 'heygen' && this.heygenApiKey) {
        return this.triggerHeyGenGeneration(job);
      } else if (provider === 'sora' && this.soraApiKey) {
        return this.triggerSoraGeneration(job);
      }

      // ── GCP / Local AI Upgraded Pipeline ──
      const gcpVertex = require('./gcpVertexService');
      const avatarUrl = options.avatarUrl || options.avatarImage || '/uploads/avatars/default.png';

      if (gcpVertex.isConfigured()) {
        job.status = 'processing';
        job.provider = 'vertex_ai';
        logger.info('[DigitalTwin] Offloading avatar generation to GCP Vertex AI', { jobId });
        this.runVertexAvatarJob(job, avatarUrl, voiceNoteUrl).catch(err => {
          logger.error('[DigitalTwin] Vertex AI avatar generation failed', { error: err.message, jobId });
        });
        return job;
      } else {
        job.status = 'processing';
        job.provider = 'local_ai';
        logger.info('[DigitalTwin] Running avatar generation locally', { jobId });
        this.runLocalAvatarJob(job, avatarUrl, voiceNoteUrl).catch(err => {
          logger.error('[DigitalTwin] Local avatar generation failed', { error: err.message, jobId });
        });
        return job;
      }
    } catch (error) {
      logger.error('Error in createAvatarVideo', { error: error.message, userId });
      throw error;
    }
  }

  async runLocalAvatarJob(job, avatarUrl, voiceNoteUrl) {
    try {
      const projectRoot = path.join(__dirname, '..', '..');
      const outDir = path.join(projectRoot, 'uploads', 'processed');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

      const outputPath = path.join(outDir, `${job.id}_output_${Date.now()}.mp4`);
      const publicUrl = `/uploads/processed/${path.basename(outputPath)}`;

      // Resolve avatar path
      let avatarLocalPath = avatarUrl;
      let tempAvatar = null;
      if (/^https?:\/\//i.test(avatarUrl)) {
        tempAvatar = path.join(outDir, `temp_avatar_${Date.now()}${path.extname(avatarUrl) || '.png'}`);
        await downloadFileHelper(avatarUrl, tempAvatar);
        avatarLocalPath = tempAvatar;
      } else if (avatarUrl.startsWith('/')) {
        avatarLocalPath = path.join(projectRoot, avatarUrl);
      } else {
        avatarLocalPath = path.join(projectRoot, 'uploads', 'avatars', 'default.png');
      }

      // Ensure default avatar exists
      if (!fs.existsSync(avatarLocalPath)) {
        const avatarDir = path.dirname(avatarLocalPath);
        if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });
        const { createCanvas } = require('canvas');
        const canvas = createCanvas(512, 512);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#1e1e30';
        ctx.fillRect(0, 0, 512, 512);
        ctx.fillStyle = '#ffffff';
        ctx.font = '30px sans-serif';
        ctx.fillText('Avatar', 200, 256);
        fs.writeFileSync(avatarLocalPath, canvas.toBuffer('image/png'));
      }

      // Resolve voice note path
      let voiceLocalPath = voiceNoteUrl;
      let tempVoice = null;
      if (/^https?:\/\//i.test(voiceNoteUrl)) {
        tempVoice = path.join(outDir, `temp_voice_${Date.now()}${path.extname(voiceNoteUrl) || '.mp3'}`);
        await downloadFileHelper(voiceNoteUrl, tempVoice);
        voiceLocalPath = tempVoice;
      } else if (voiceNoteUrl.startsWith('/')) {
        voiceLocalPath = path.join(projectRoot, voiceNoteUrl);
      }

      const venvPython = path.join(projectRoot, '.venv', 'bin', 'python');
      const pythonCmd = fs.existsSync(venvPython) ? venvPython : 'python3';
      const scriptPath = path.join(projectRoot, 'scripts', 'video_avatar_sync.py');

      logger.info(`[DigitalTwin] Spawning video_avatar_sync.py: ${pythonCmd} ${scriptPath} --avatar ${avatarLocalPath} --audio ${voiceLocalPath} --output ${outputPath}`);

      const { runPythonScript } = require('../utils/runPythonScript');
      try {
        await runPythonScript(pythonCmd, [
          scriptPath,
          '--avatar', avatarLocalPath,
          '--audio', voiceLocalPath,
          '--output', outputPath,
        ], { label: 'video_avatar_sync', timeoutMs: 10 * 60 * 1000 });
        logger.info(`[DigitalTwin] video_avatar_sync.py completed successfully`);
        job.status = 'completed';
        job.videoUrl = publicUrl;
        job.progress = 100;
      } catch (e) {
        logger.error(`[DigitalTwin] video_avatar_sync.py failed: ${e.message}`);
        job.status = 'failed';
        job.error = e.message;
      } finally {
        if (tempAvatar && fs.existsSync(tempAvatar)) fs.unlink(tempAvatar, () => {});
        if (tempVoice && fs.existsSync(tempVoice)) fs.unlink(tempVoice, () => {});
      }
    } catch (err) {
      logger.error('[DigitalTwin] runLocalAvatarJob crashed', { error: err.message });
      job.status = 'failed';
      job.error = err.message;
    }
  }

  async runVertexAvatarJob(job, avatarUrl, voiceNoteUrl) {
    try {
      const gcpVertex = require('./gcpVertexService');
      const projectRoot = path.join(__dirname, '..', '..');
      const outDir = path.join(projectRoot, 'uploads', 'processed');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

      const outputPath = path.join(outDir, `${job.id}_output_${Date.now()}.mp4`);
      const publicUrl = `/uploads/processed/${path.basename(outputPath)}`;

      // Resolve avatar path locally
      let avatarLocalPath = avatarUrl;
      let tempAvatar = null;
      if (/^https?:\/\//i.test(avatarUrl)) {
        tempAvatar = path.join(outDir, `temp_avatar_${Date.now()}${path.extname(avatarUrl) || '.png'}`);
        await downloadFileHelper(avatarUrl, tempAvatar);
        avatarLocalPath = tempAvatar;
      } else if (avatarUrl.startsWith('/')) {
        avatarLocalPath = path.join(projectRoot, avatarUrl);
      } else {
        avatarLocalPath = path.join(projectRoot, 'uploads', 'avatars', 'default.png');
      }

      // Ensure default avatar exists
      if (!fs.existsSync(avatarLocalPath)) {
        const avatarDir = path.dirname(avatarLocalPath);
        if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });
        const { createCanvas } = require('canvas');
        const canvas = createCanvas(512, 512);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#1e1e30';
        ctx.fillRect(0, 0, 512, 512);
        ctx.fillStyle = '#ffffff';
        ctx.font = '30px sans-serif';
        ctx.fillText('Avatar', 200, 256);
        fs.writeFileSync(avatarLocalPath, canvas.toBuffer('image/png'));
      }

      // Resolve voice note path locally
      let voiceLocalPath = voiceNoteUrl;
      let tempVoice = null;
      if (/^https?:\/\//i.test(voiceNoteUrl)) {
        tempVoice = path.join(outDir, `temp_voice_${Date.now()}${path.extname(voiceNoteUrl) || '.mp3'}`);
        await downloadFileHelper(voiceNoteUrl, tempVoice);
        voiceLocalPath = tempVoice;
      } else if (voiceNoteUrl.startsWith('/')) {
        voiceLocalPath = path.join(projectRoot, voiceNoteUrl);
      }

      // 1. Upload files to GCS
      const avatarGcsUrl = await gcpVertex.uploadToGCS(avatarLocalPath, `avatars/${job.id}_avatar_${Date.now()}${path.extname(avatarLocalPath) || '.png'}`);
      const audioGcsUrl = await gcpVertex.uploadToGCS(voiceLocalPath, `audios/${job.id}_audio_${Date.now()}${path.extname(voiceLocalPath) || '.mp3'}`);

      // Clean up local temp files immediately after GCS upload
      if (tempAvatar && fs.existsSync(tempAvatar)) fs.unlink(tempAvatar, () => {});
      if (tempVoice && fs.existsSync(tempVoice)) fs.unlink(tempVoice, () => {});

      const outputFilename = `${job.id}_avatar_sync_${Date.now()}.mp4`;
      const outputGcsUrl = `gs://${process.env.GCS_BUCKET_NAME}/outputs/${outputFilename}`;

      // 2. Trigger Custom Job on Vertex AI
      await gcpVertex.runVertexCustomJob({
        task: 'avatar_synthesis',
        videoId: job.id,
        avatarUrl: avatarGcsUrl,
        audioUrl: audioGcsUrl,
        outputGcsUrl
      });

      // 3. Download finished video back to Click uploads
      await gcpVertex.downloadFromGCS(outputGcsUrl, outputPath);
      
      job.status = 'completed';
      job.videoUrl = publicUrl;
      job.progress = 100;
      logger.info(`[DigitalTwin] Vertex AI avatar sync completed successfully`, { jobId: job.id });
    } catch (err) {
      logger.error('[DigitalTwin] runVertexAvatarJob failed', { error: err.message, jobId: job.id });
      job.status = 'failed';
      job.error = err.message;
    }
  }

  async triggerHeyGenGeneration(job) {
    try {
      const response = await axios.post('https://api.heygen.com/v2/video/generate', {
        video_inputs: [
          {
            character: {
              type: 'avatar',
              avatar_id: job.options?.avatarId || 'default_client_avatar',
              avatar_style: 'normal'
            },
            voice: {
              type: 'audio',
              audio_url: job.voiceNoteUrl
            }
          }
        ],
        dimension: { width: 3840, height: 2160 },
        callback_id: job.id
      }, {
        headers: { 
          'X-Api-Key': this.heygenApiKey,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (response.data && response.data.data) {
        job.externalId = response.data.data.video_id;
        job.status = 'processing';
        logger.info('HeyGen generation successfully initiated', { jobId: job.id, externalId: job.externalId });
      } else {
        throw new Error('Invalid response from HeyGen API');
      }
      return job;
    } catch (error) {
      logger.error('HeyGen API Error', { 
        error: error.message, 
        jobId: job.id,
        response: error.response?.data
      });
      job.status = 'failed';
      job.error = error.response?.data?.message || 'Provider API Error';
      return job;
    }
  }

  async triggerSoraGeneration(job) {
    try {
      logger.info('Sora generation initiated (Enterprise Tier)', { jobId: job.id });
      
      if (!process.env.SORA_GATEWAY_URL) {
        logger.warn('Sora gateway not configured — generation unavailable', { jobId: job.id });
        job.status = 'unavailable';
        job.error = 'Sora generation is not configured (set SORA_GATEWAY_URL).';
        return job;
      }

      const response = await axios.post(process.env.SORA_GATEWAY_URL, {
        model: "sora-1",
        input: {
          audio_url: job.voiceNoteUrl,
          avatar_id: job.options?.avatarId
        },
        quality: "high",
        aspect_ratio: "16:9"
      }, {
        headers: { 'Authorization': `Bearer ${this.soraApiKey}` },
        timeout: 30000,
      });
      job.externalId = response.data.id;
      job.status = 'processing';
      return job;
    } catch (error) {
      logger.error('Sora API Error', { error: error.message, jobId: job.id });
      job.status = 'failed';
      return job;
    }
  }

  /**
   * Monitor progress of synthesis
   */
  async getGenerationStatus(jobId) {
    const job = this.generationJobs.get(jobId);
    if (!job) return null;

    if (job.provider === 'simulated') {
      job.status = 'unavailable';
      job.notImplemented = true;
      job.message = 'AI Avatar synthesis needs a HEYGEN_API_KEY (or SORA_API_KEY).';
    } else if (job.provider === 'heygen' && job.externalId) {
      try {
        const response = await axios.get(`https://api.heygen.com/v2/video/${job.externalId}`, {
          headers: { 'X-Api-Key': this.heygenApiKey }
        });
        const externalStatus = response.data.data.status;
        if (externalStatus === 'completed') {
          job.status = 'completed';
          job.videoUrl = response.data.data.video_url;
          job.progress = 100;
        } else if (externalStatus === 'failed') {
          job.status = 'failed';
        }
      } catch (e) {
        logger.error('Error polling HeyGen', { error: e.message });
      }
    }

    return job;
  }
}

module.exports = new DigitalTwinService();
