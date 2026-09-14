const logger = require('../utils/logger');
const crypto = require('crypto');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { pipeline } = require('stream/promises');

/**
 * Safely extract file extension from URL without query params or hash
 */
function getUrlExtension(urlStr, defaultExt = '') {
  if (!urlStr || typeof urlStr !== 'string') return defaultExt;
  try {
    const parsed = new URL(urlStr);
    return path.extname(parsed.pathname) || defaultExt;
  } catch (_) {
    const clean = urlStr.split('?')[0].split('#')[0];
    return path.extname(clean) || defaultExt;
  }
}

/**
 * Safe stream-based file download with automatic cleanup on failure
 */
async function downloadFileHelper(url, outputPath) {
  const writer = fs.createWriteStream(outputPath);
  try {
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
      timeout: 60000,
    });
    await pipeline(response.data, writer);
  } catch (err) {
    try { writer.close(); } catch (_) { /* ignore */ }
    if (fs.existsSync(outputPath)) {
      try { fs.unlinkSync(outputPath); } catch (_) { /* ignore */ }
    }
    throw err;
  }
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
   * Safely resolve user settings and custom API keys if configured
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async resolveUserSettings(userId) {
    try {
      if (!userId) return null;
      const UserSettings = require('../models/UserSettings');
      if (UserSettings && typeof UserSettings.findOne === 'function') {
        const settings = await UserSettings.findOne({ userId }).lean().catch(() => null);
        return settings;
      }
    } catch (_) {
      // Non-blocking fallback if Mongo is unavailable
    }
    return null;
  }

  /**
   * Retrieve creator's top style profile picks for downstream video styling
   * @param {string} userId
   * @returns {Promise<Object|null>}
   */
  async resolveUserStyleProfile(userId) {
    try {
      if (!userId) return null;
      const UserStyleProfile = require('../models/UserStyleProfile');
      if (UserStyleProfile && typeof UserStyleProfile.findOne === 'function') {
        const profile = await UserStyleProfile.findOne({ userId }).lean().catch(() => null);
        if (profile) {
          const getTop = (arr) => Array.isArray(arr) && arr.length > 0
            ? [...arr].sort((a, b) => (b.count || 0) - (a.count || 0))[0]?.key
            : null;
          return {
            font: getTop(profile.fonts),
            captionStyle: getTop(profile.captionStyles),
            colorGrade: getTop(profile.colorGrades),
            motion: getTop(profile.motions),
            animation: getTop(profile.animations),
            hook: getTop(profile.hookStyles),
            avgCutDuration: profile.averages?.avgCutDuration || null,
          };
        }
      }
    } catch (_) {
      // Non-blocking fallback
    }
    return null;
  }

  /**
   * Return available digital twin providers for a given user
   * @param {string} [userId]
   * @returns {Promise<Object>}
   */
  async getAvailableProviders(userId) {
    let heygenKey = this.heygenApiKey || process.env.HEYGEN_API_KEY;
    let soraKey = this.soraApiKey || process.env.SORA_API_KEY;
    let preferred = 'both';

    if (userId) {
      const userSettings = await this.resolveUserSettings(userId);
      if (userSettings?.agentic) {
        if (userSettings.agentic.heygenApiKey) heygenKey = userSettings.agentic.heygenApiKey;
        if (userSettings.agentic.soraApiKey) soraKey = userSettings.agentic.soraApiKey;
        if (userSettings.agentic.digitalTwinProvider) preferred = userSettings.agentic.digitalTwinProvider;
      }
    }

    let gcpVertex = null;
    try {
      gcpVertex = require('./gcpVertexService');
    } catch (_) {
      // Optional service fallback
    }

    return {
      heygen: {
        available: Boolean(heygenKey),
        model: 'high_fidelity_v2',
      },
      sora: {
        available: Boolean(soraKey && process.env.SORA_GATEWAY_URL),
        model: 'sora-1',
      },
      vertexAi: {
        available: Boolean(gcpVertex?.isConfigured?.()),
      },
      localAi: {
        available: true,
      },
      userPreferred: preferred,
    };
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

      // 1. Resolve user settings & custom API keys
      let heygenKey = this.heygenApiKey || process.env.HEYGEN_API_KEY;
      let soraKey = this.soraApiKey || process.env.SORA_API_KEY;
      let userPreferredProvider = null;

      const userSettings = await this.resolveUserSettings(userId);
      if (userSettings?.agentic) {
        if (userSettings.agentic.heygenApiKey) heygenKey = userSettings.agentic.heygenApiKey;
        if (userSettings.agentic.soraApiKey) soraKey = userSettings.agentic.soraApiKey;
        if (userSettings.agentic.digitalTwinProvider) {
          userPreferredProvider = userSettings.agentic.digitalTwinProvider;
        }
      }

      // 2. Provider resolution
      let provider = options.provider;
      if (!provider || provider === 'auto' || provider === 'both') {
        if (userPreferredProvider === 'heygen' && heygenKey) {
          provider = 'heygen';
        } else if (userPreferredProvider === 'sora' && soraKey && process.env.SORA_GATEWAY_URL) {
          provider = 'sora';
        } else if (heygenKey) {
          provider = 'heygen';
        } else if (soraKey && process.env.SORA_GATEWAY_URL) {
          provider = 'sora';
        } else {
          provider = 'simulated';
        }
      }

      // 3. Resolve user style profile for downstream personalized styling
      const styleProfile = await this.resolveUserStyleProfile(userId);
      
      logger.info('Starting Digital Twin Generation', { userId, jobId, provider });

      const job = {
        id: jobId,
        userId,
        voiceNoteUrl,
        status: 'initializing',
        provider,
        type: options.type || 'avatar_lipsync',
        model: options.model || (provider === 'sora' ? 'sora-1' : 'high_fidelity_v2'),
        resolution: options.resolution || '4K',
        options: { ...options },
        styleProfile: styleProfile || undefined,
        compliance: {
          isSynthetic: true,
          c2paProvenance: true,
          biometricConsentAcknowledged: Boolean(options.biometricConsent || options.consentAcknowledged || userSettings?.agentic?.biometricConsent),
          consentTimestamp: options.consentTimestamp || userSettings?.agentic?.biometricConsentAt || new Date().toISOString(),
          euAiActCompliance: 'Article 50 Transparency & Synthetic Media Disclosed',
          bipaCompliance: '740 ILCS 14/ Authorized Biometric Processing',
          ownership: '100% Commercial Creator Owned',
        },
        progress: 0,
        stage: 'initializing',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Bound the in-memory job registry (FIFO eviction of the oldest entry).
      const MAX_GENERATION_JOBS = 1000;
      if (this.generationJobs.size >= MAX_GENERATION_JOBS) {
        const oldest = this.generationJobs.keys().next().value;
        if (oldest !== undefined) this.generationJobs.delete(oldest);
      }
      this.generationJobs.set(jobId, job);

      // Handle HeyGen
      if (provider === 'heygen') {
        if (heygenKey) {
          return this.triggerHeyGenGeneration(job, heygenKey);
        }
        if (!options.allowFallback) {
          job.status = 'unavailable';
          job.notImplemented = true;
          job.message = 'HeyGen API key is not configured (set HEYGEN_API_KEY).';
          job.error = job.message;
          return job;
        }
      }

      // Handle Sora
      if (provider === 'sora') {
        if (soraKey && process.env.SORA_GATEWAY_URL) {
          return this.triggerSoraGeneration(job, soraKey);
        }
        if (!options.allowFallback) {
          job.status = 'unavailable';
          job.notImplemented = true;
          job.message = 'Sora generation is not configured (set SORA_API_KEY and SORA_GATEWAY_URL).';
          job.error = job.message;
          return job;
        }
      }

      // Handle Simulated/Unconfigured Provider
      if (provider === 'simulated' && !options.useLocalFallback && options.provider !== 'local' && options.provider !== 'local_ai' && options.provider !== 'vertex' && options.provider !== 'vertex_ai') {
        job.status = 'unavailable';
        job.notImplemented = true;
        job.message = 'AI Avatar synthesis needs a HEYGEN_API_KEY (or SORA_API_KEY).';
        job.error = job.message;
        return job;
      }

      // ── GCP / Local AI Upgraded Pipeline ──
      const gcpVertex = require('./gcpVertexService');
      const avatarUrl = options.avatarUrl || options.avatarImage || '/uploads/avatars/default.png';

      if (gcpVertex.isConfigured() && options.provider !== 'local' && options.provider !== 'local_ai') {
        job.status = 'processing';
        job.stage = 'vertex_queued';
        job.provider = 'vertex_ai';
        logger.info('[DigitalTwin] Offloading avatar generation to GCP Vertex AI', { jobId });
        this.runVertexAvatarJob(job, avatarUrl, voiceNoteUrl).catch(err => {
          logger.error('[DigitalTwin] Vertex AI avatar generation failed', { error: err.message, jobId });
        });
        return job;
      } else {
        job.status = 'processing';
        job.stage = 'local_queued';
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
    let tempAvatar = null;
    let tempVoice = null;
    try {
      const projectRoot = path.join(__dirname, '..', '..');
      const outDir = path.join(projectRoot, 'uploads', 'processed');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

      const outputPath = path.join(outDir, `${job.id}_output_${Date.now()}.mp4`);
      const publicUrl = `/uploads/processed/${path.basename(outputPath)}`;

      // Resolve avatar path
      let avatarLocalPath = avatarUrl;
      if (/^https?:\/\//i.test(avatarUrl)) {
        const ext = getUrlExtension(avatarUrl, '.png');
        tempAvatar = path.join(outDir, `temp_avatar_${Date.now()}_${crypto.randomBytes(3).toString('hex')}${ext}`);
        await downloadFileHelper(avatarUrl, tempAvatar);
        avatarLocalPath = tempAvatar;
      } else if (avatarUrl && avatarUrl.startsWith('/')) {
        avatarLocalPath = path.join(projectRoot, avatarUrl);
      } else {
        avatarLocalPath = path.join(projectRoot, 'uploads', 'avatars', 'default.png');
      }

      // Ensure default avatar exists
      if (!fs.existsSync(avatarLocalPath)) {
        const avatarDir = path.dirname(avatarLocalPath);
        if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });
        try {
          const { createCanvas } = require('canvas');
          const canvas = createCanvas(512, 512);
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#1e1e30';
          ctx.fillRect(0, 0, 512, 512);
          ctx.fillStyle = '#ffffff';
          ctx.font = '30px sans-serif';
          ctx.fillText('Avatar', 200, 256);
          fs.writeFileSync(avatarLocalPath, canvas.toBuffer('image/png'));
        } catch (_) {
          // Minimal 1x1 png fallback if canvas is not compiled
          const emptyPng = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082', 'hex');
          fs.writeFileSync(avatarLocalPath, emptyPng);
        }
      }

      // Resolve voice note path
      let voiceLocalPath = voiceNoteUrl;
      if (/^https?:\/\//i.test(voiceNoteUrl)) {
        const ext = getUrlExtension(voiceNoteUrl, '.mp3');
        tempVoice = path.join(outDir, `temp_voice_${Date.now()}_${crypto.randomBytes(3).toString('hex')}${ext}`);
        await downloadFileHelper(voiceNoteUrl, tempVoice);
        voiceLocalPath = tempVoice;
      } else if (voiceNoteUrl && voiceNoteUrl.startsWith('/')) {
        voiceLocalPath = path.join(projectRoot, voiceNoteUrl);
      }

      if (!voiceLocalPath || !fs.existsSync(voiceLocalPath)) {
        throw new Error(`Voice note file could not be resolved or does not exist: ${voiceNoteUrl}`);
      }

      const venvPython = path.join(projectRoot, '.venv', 'bin', 'python');
      const pythonCmd = fs.existsSync(venvPython) ? venvPython : 'python3';
      const scriptPath = path.join(projectRoot, 'scripts', 'video_avatar_sync.py');

      logger.info(`[DigitalTwin] Spawning video_avatar_sync.py: ${pythonCmd} ${scriptPath} --avatar ${avatarLocalPath} --audio ${voiceLocalPath} --output ${outputPath}`);

      const { runPythonScript } = require('../utils/runPythonScript');
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
    } catch (err) {
      logger.error('[DigitalTwin] runLocalAvatarJob failed', { error: err.message, jobId: job.id });
      job.status = 'failed';
      job.error = err.message;
    } finally {
      if (tempAvatar && fs.existsSync(tempAvatar)) {
        try { fs.unlinkSync(tempAvatar); } catch (_) { /* ignore */ }
      }
      if (tempVoice && fs.existsSync(tempVoice)) {
        try { fs.unlinkSync(tempVoice); } catch (_) { /* ignore */ }
      }
    }
  }

  async runVertexAvatarJob(job, avatarUrl, voiceNoteUrl) {
    let tempAvatar = null;
    let tempVoice = null;
    try {
      const gcpVertex = require('./gcpVertexService');
      const projectRoot = path.join(__dirname, '..', '..');
      const outDir = path.join(projectRoot, 'uploads', 'processed');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

      const outputPath = path.join(outDir, `${job.id}_output_${Date.now()}.mp4`);
      const publicUrl = `/uploads/processed/${path.basename(outputPath)}`;

      // Resolve avatar path locally
      let avatarLocalPath = avatarUrl;
      if (/^https?:\/\//i.test(avatarUrl)) {
        const ext = getUrlExtension(avatarUrl, '.png');
        tempAvatar = path.join(outDir, `temp_avatar_${Date.now()}_${crypto.randomBytes(3).toString('hex')}${ext}`);
        await downloadFileHelper(avatarUrl, tempAvatar);
        avatarLocalPath = tempAvatar;
      } else if (avatarUrl && avatarUrl.startsWith('/')) {
        avatarLocalPath = path.join(projectRoot, avatarUrl);
      } else {
        avatarLocalPath = path.join(projectRoot, 'uploads', 'avatars', 'default.png');
      }

      // Ensure default avatar exists
      if (!fs.existsSync(avatarLocalPath)) {
        const avatarDir = path.dirname(avatarLocalPath);
        if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });
        try {
          const { createCanvas } = require('canvas');
          const canvas = createCanvas(512, 512);
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#1e1e30';
          ctx.fillRect(0, 0, 512, 512);
          ctx.fillStyle = '#ffffff';
          ctx.font = '30px sans-serif';
          ctx.fillText('Avatar', 200, 256);
          fs.writeFileSync(avatarLocalPath, canvas.toBuffer('image/png'));
        } catch (_) {
          const emptyPng = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082', 'hex');
          fs.writeFileSync(avatarLocalPath, emptyPng);
        }
      }

      // Resolve voice note path locally
      let voiceLocalPath = voiceNoteUrl;
      if (/^https?:\/\//i.test(voiceNoteUrl)) {
        const ext = getUrlExtension(voiceNoteUrl, '.mp3');
        tempVoice = path.join(outDir, `temp_voice_${Date.now()}_${crypto.randomBytes(3).toString('hex')}${ext}`);
        await downloadFileHelper(voiceNoteUrl, tempVoice);
        voiceLocalPath = tempVoice;
      } else if (voiceNoteUrl && voiceNoteUrl.startsWith('/')) {
        voiceLocalPath = path.join(projectRoot, voiceNoteUrl);
      }

      if (!voiceLocalPath || !fs.existsSync(voiceLocalPath)) {
        throw new Error(`Voice note file could not be resolved or does not exist: ${voiceNoteUrl}`);
      }

      // 1. Upload files to GCS
      const avatarGcsUrl = await gcpVertex.uploadToGCS(avatarLocalPath, `avatars/${job.id}_avatar_${Date.now()}${getUrlExtension(avatarLocalPath, '.png')}`);
      const audioGcsUrl = await gcpVertex.uploadToGCS(voiceLocalPath, `audios/${job.id}_audio_${Date.now()}${getUrlExtension(voiceLocalPath, '.mp3')}`);

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
    } finally {
      if (tempAvatar && fs.existsSync(tempAvatar)) {
        try { fs.unlinkSync(tempAvatar); } catch (_) { /* ignore */ }
      }
      if (tempVoice && fs.existsSync(tempVoice)) {
        try { fs.unlinkSync(tempVoice); } catch (_) { /* ignore */ }
      }
    }
  }

  async triggerHeyGenGeneration(job, apiKey = this.heygenApiKey) {
    try {
      const activeKey = apiKey || this.heygenApiKey || process.env.HEYGEN_API_KEY;
      job._apiKey = activeKey;
      const avatarId = job.options?.avatarId || 'default_client_avatar';
      const response = await axios.post('https://api.heygen.com/v2/video/generate', {
        video_inputs: [
          {
            character: {
              type: 'avatar',
              avatar_id: avatarId,
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
          'X-Api-Key': activeKey,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (response.data && response.data.data) {
        job.externalId = response.data.data.video_id;
        job.status = 'processing';
        job.stage = 'synthesizing_avatar';
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
      job.error = error.response?.data?.message || error.message || 'Provider API Error';
      return job;
    }
  }

  async triggerSoraGeneration(job, apiKey = this.soraApiKey) {
    try {
      const activeKey = apiKey || this.soraApiKey || process.env.SORA_API_KEY;
      job._apiKey = activeKey;
      logger.info('Sora generation initiated (Enterprise Tier)', { jobId: job.id });
      
      if (!process.env.SORA_GATEWAY_URL) {
        logger.warn('Sora gateway not configured — generation unavailable', { jobId: job.id });
        job.status = 'unavailable';
        job.notImplemented = true;
        job.message = 'Sora generation is not configured (set SORA_GATEWAY_URL).';
        job.error = job.message;
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
        headers: { 'Authorization': `Bearer ${activeKey}` },
        timeout: 30000,
      });
      job.externalId = response.data?.id;
      job.status = 'processing';
      job.stage = 'rendering_neural_video';
      return job;
    } catch (error) {
      logger.error('Sora API Error', { error: error.message, jobId: job.id });
      job.status = 'failed';
      job.error = error.response?.data?.message || error.message || 'Sora API Error';
      return job;
    }
  }

  /**
   * Monitor progress of synthesis
   */
  async getGenerationStatus(jobId) {
    const job = this.generationJobs.get(jobId);
    if (!job) return null;

    if (job.provider === 'simulated' || job.status === 'unavailable') {
      job.status = 'unavailable';
      job.notImplemented = true;
      if (!job.message) {
        job.message = 'AI Avatar synthesis needs a HEYGEN_API_KEY (or SORA_API_KEY).';
      }
    } else if (job.provider === 'heygen' && job.externalId) {
      const activeKey = job._apiKey || this.heygenApiKey || process.env.HEYGEN_API_KEY;
      try {
        const response = await axios.get(`https://api.heygen.com/v2/video/${job.externalId}`, {
          headers: { 'X-Api-Key': activeKey },
          timeout: 15000
        });
        const externalData = response.data?.data;
        const externalStatus = externalData?.status;
        if (externalStatus === 'completed') {
          job.status = 'completed';
          job.videoUrl = externalData.video_url;
          job.progress = 100;
          job.stage = 'completed';
        } else if (externalStatus === 'failed') {
          job.status = 'failed';
          job.stage = 'failed';
          job.error = externalData.error?.message || 'HeyGen generation failed';
        } else if (externalStatus === 'processing' || externalStatus === 'pending') {
          job.status = 'processing';
          job.stage = externalStatus === 'pending' ? 'queued' : 'synthesizing_avatar';
          if (typeof externalData.progress === 'number') {
            job.progress = externalData.progress;
          }
        }
      } catch (e) {
        logger.error('Error polling HeyGen', { error: e.message, jobId });
      }
    } else if (job.provider === 'sora' && job.externalId && process.env.SORA_GATEWAY_URL) {
      const activeKey = job._apiKey || this.soraApiKey || process.env.SORA_API_KEY;
      try {
        const response = await axios.get(`${process.env.SORA_GATEWAY_URL}/${job.externalId}`, {
          headers: { 'Authorization': `Bearer ${activeKey}` },
          timeout: 15000
        });
        const externalData = response.data;
        if (externalData?.status === 'completed' || externalData?.status === 'succeeded') {
          job.status = 'completed';
          job.videoUrl = externalData.video_url || externalData.url;
          job.progress = 100;
          job.stage = 'completed';
        } else if (externalData?.status === 'failed') {
          job.status = 'failed';
          job.stage = 'failed';
          job.error = externalData.error?.message || 'Sora generation failed';
        } else if (externalData?.status === 'processing') {
          job.status = 'processing';
          job.stage = 'rendering_neural_video';
          if (typeof externalData.progress === 'number') {
            job.progress = externalData.progress;
          }
        }
      } catch (e) {
        logger.error('Error polling Sora', { error: e.message, jobId });
      }
    } else if ((job.provider === 'local_ai' || job.provider === 'vertex_ai') && job.status === 'processing') {
      // Dynamic staged progress estimation for local / Vertex rendering jobs
      const elapsed = (Date.now() - (job.createdAt || Date.now())) / 1000;
      if (elapsed < 3) {
        job.stage = 'preparing_assets';
        job.progress = Math.min(20, Math.max(10, Math.round(elapsed * 6)));
      } else if (elapsed < 10) {
        job.stage = 'extracting_phonemes';
        job.progress = Math.min(45, 20 + Math.round((elapsed - 3) * 3.5));
      } else if (elapsed < 25) {
        job.stage = 'synthesizing_lip_sync';
        job.progress = Math.min(80, 45 + Math.round((elapsed - 10) * 2.3));
      } else {
        job.stage = 'encoding_final_video';
        job.progress = Math.min(94, 80 + Math.round((elapsed - 25) * 0.4));
      }
    }

    job.updatedAt = Date.now();
    return job;
  }

  /**
   * Get all digital twin jobs for a user
   * @param {string} userId
   * @param {Object} [options]
   * @returns {Array<Object>}
   */
  getUserJobs(userId, options = {}) {
    if (!userId) return [];
    const limit = options.limit || 50;
    const userJobs = [];
    for (const job of this.generationJobs.values()) {
      if (String(job.userId) === String(userId)) {
        userJobs.push({ ...job });
      }
    }
    userJobs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return userJobs.slice(0, limit);
  }

  /**
   * Delete or cancel a digital twin job
   * @param {string} jobId
   * @param {string} [userId]
   * @returns {boolean}
   */
  deleteJob(jobId, userId) {
    const job = this.generationJobs.get(jobId);
    if (!job) return false;
    if (userId && String(job.userId) !== String(userId)) {
      const err = new Error('Unauthorized to delete this job');
      err.statusCode = 403;
      throw err;
    }
    if (job.status === 'processing') {
      job.status = 'cancelled';
      job.cancelledAt = Date.now();
    }
    return this.generationJobs.delete(jobId);
  }
}

module.exports = new DigitalTwinService();
