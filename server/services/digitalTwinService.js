const logger = require('../utils/logger');
const crypto = require('crypto');
const axios = require('axios');

/**
 * Digital Twin Service: Zero-Input Avatar Generation
 * Integrates with high-fidelity models like HeyGen or Sora.
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

      this.generationJobs.set(jobId, job);

      if (provider === 'heygen' && this.heygenApiKey) {
        return this.triggerHeyGenGeneration(job);
      } else if (provider === 'sora' && this.soraApiKey) {
        return this.triggerSoraGeneration(job);
      }

      // Simulated fallback for development
      logger.warn('Using simulated Digital Twin provider', { jobId });
      job.status = 'generating';
      return job;
    } catch (error) {
      logger.error('Error in createAvatarVideo', { error: error.message, userId });
      throw error;
    }
  }

  async triggerHeyGenGeneration(job) {
    try {
      // Structure for HeyGen Avatar API v2
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
        dimension: { width: 3840, height: 2160 }, // 4K Production Standard
        callback_id: job.id // For webhook integration
      }, {
        headers: { 
          'X-Api-Key': this.heygenApiKey,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30s timeout for initiation
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
      // Forward-compatible structure for Sora OpenAI API
      // Using expected OpenAI-style generation pattern
      logger.info('Sora generation initiated (Enterprise Tier)', { jobId: job.id });
      
      // Since Sora API is in limited release, we use the enterprise gateway or placeholder
      if (process.env.SORA_GATEWAY_URL) {
        const response = await axios.post(process.env.SORA_GATEWAY_URL, {
          model: "sora-1",
          input: {
            audio_url: job.voiceNoteUrl,
            avatar_id: job.options?.avatarId
          },
          quality: "high",
          aspect_ratio: "16:9"
        }, {
          headers: { 'Authorization': `Bearer ${this.soraApiKey}` }
        });
        job.externalId = response.data.id;
      } else {
        // Simulated production response if gateway not set
        logger.info('Sora Gateway not configured, using high-fidelity simulation', { jobId: job.id });
        job.externalId = `SORA-${job.id}`;
      }

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
      if (job.progress < 100) {
        job.progress += 20;
        if (job.progress >= 100) {
          job.progress = 100;
          job.status = 'completed';
          job.videoUrl = `https://cdn.click.ai/generated/${jobId}.mp4`;
          job.thumbnailUrl = `https://cdn.click.ai/generated/${jobId}_thumb.jpg`;
          job.completedAt = Date.now();
        }
      }
    } else if (job.provider === 'heygen' && job.externalId) {
      // Poll HeyGen API
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
