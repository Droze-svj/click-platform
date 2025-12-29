// AI Music Generation Service
// Integrates with AI music generation APIs (Mubert, Soundraw)

const axios = require('axios');
const logger = require('../utils/logger');
const MusicLicense = require('../models/MusicLicense');
const { uploadFile } = require('./storageService');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Base AI Music Provider class
 */
class AIMusicProvider {
  constructor(provider, config) {
    this.provider = provider;
    this.config = config;
    this.apiKey = config.apiKey;
    this.apiBaseUrl = config.apiBaseUrl;
  }

  /**
   * Generate music track
   */
  async generateTrack(params) {
    throw new Error('generateTrack must be implemented by provider');
  }

  /**
   * Get generation status
   */
  async getGenerationStatus(jobId) {
    throw new Error('getGenerationStatus must be implemented by provider');
  }

  /**
   * Download generated track
   */
  async downloadTrack(trackId) {
    throw new Error('downloadTrack must be implemented by provider');
  }

  /**
   * Validate license for generated music
   */
  async validateLicense() {
    throw new Error('validateLicense must be implemented by provider');
  }
}

/**
 * Mubert Provider
 * API Documentation: https://mubert.com/developers/api-reference/
 */
class MubertProvider extends AIMusicProvider {
  constructor(config) {
    super('mubert', config);
    this.apiBaseUrl = config.apiBaseUrl || 'https://api.mubert.com/v2';
  }

  /**
   * Generate music track
   * @param {Object} params - Generation parameters
   * @param {String} params.mood - Mood (energetic, calm, happy, etc.)
   * @param {String} params.genre - Genre (electronic, pop, etc.)
   * @param {Number} params.duration - Duration in seconds
   * @param {Number} params.bpm - BPM (optional)
   * @param {String} params.intensity - Intensity level (low, medium, high)
   */
  async generateTrack(params) {
    const {
      mood = 'energetic',
      genre = 'electronic',
      duration = 60,
      bpm = null,
      intensity = 'medium'
    } = params;

    try {
      // Mubert API endpoint for track generation
      const response = await axios.post(
        `${this.apiBaseUrl}/GenerateTrack`,
        {
          api_key: this.apiKey,
          mood,
          genre,
          duration,
          bpm,
          intensity,
          format: 'mp3',
          quality: 'high'
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.status === 'success' && response.data.job_id) {
        return {
          jobId: response.data.job_id,
          estimatedTime: response.data.estimated_time || 30,
          status: 'processing'
        };
      } else {
        throw new Error(response.data.error || 'Failed to start generation');
      }
    } catch (error) {
      logger.error('Mubert generation error', { error: error.message, params });
      throw new Error(`Mubert API error: ${error.message}`);
    }
  }

  /**
   * Get generation status
   */
  async getGenerationStatus(jobId) {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/GetStatus`, {
        params: {
          api_key: this.apiKey,
          job_id: jobId
        }
      });

      return {
        status: response.data.status, // 'processing', 'completed', 'failed'
        progress: response.data.progress || 0,
        trackId: response.data.track_id,
        downloadUrl: response.data.download_url,
        error: response.data.error
      };
    } catch (error) {
      logger.error('Mubert status check error', { error: error.message, jobId });
      throw new Error(`Failed to check status: ${error.message}`);
    }
  }

  /**
   * Download generated track
   */
  async downloadTrack(trackId) {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/GetTrack`, {
        params: {
          api_key: this.apiKey,
          track_id: trackId
        },
        responseType: 'stream'
      });

      return response.data;
    } catch (error) {
      logger.error('Mubert download error', { error: error.message, trackId });
      throw new Error(`Failed to download track: ${error.message}`);
    }
  }

  /**
   * Validate license for Mubert
   */
  async validateLicense() {
    // Mubert API-generated tracks come with automatic licensing
    // Check account/license type from config
    const licenseType = this.config.licenseType || 'commercial';

    return {
      allowsCommercialUse: true,
      allowsSocialPlatforms: true,
      platforms: ['youtube', 'tiktok', 'instagram', 'facebook', 'twitter', 'linkedin'],
      allowsMonetization: licenseType === 'commercial' || licenseType === 'enterprise',
      allowsSaaSIntegration: this.config.enterpriseLicense || false,
      requiresAttribution: false, // AI-generated doesn't require attribution
      licenseType: licenseType
    };
  }

  /**
   * Get available moods and genres
   */
  async getAvailableStyles() {
    return {
      moods: ['energetic', 'calm', 'happy', 'sad', 'dramatic', 'inspiring', 'romantic', 'mysterious'],
      genres: ['electronic', 'pop', 'rock', 'hip-hop', 'ambient', 'cinematic', 'jazz', 'classical'],
      intensities: ['low', 'medium', 'high']
    };
  }
}

/**
 * Soundraw Provider
 * API Documentation: https://soundraw.io/api-docs
 */
class SoundrawProvider extends AIMusicProvider {
  constructor(config) {
    super('soundraw', config);
    this.apiBaseUrl = config.apiBaseUrl || 'https://api.soundraw.io/v1';
  }

  /**
   * Generate music track
   */
  async generateTrack(params) {
    const {
      mood = 'energetic',
      genre = 'electronic',
      duration = 60,
      bpm = null,
      tempo = 'medium'
    } = params;

    try {
      const response = await axios.post(
        `${this.apiBaseUrl}/music/generate`,
        {
          mood,
          genre,
          duration,
          bpm,
          tempo,
          format: 'mp3'
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.status === 'success' || response.data.track_id) {
        return {
          jobId: response.data.job_id || response.data.track_id,
          trackId: response.data.track_id,
          downloadUrl: response.data.download_url,
          status: response.data.status || 'completed'
        };
      } else {
        throw new Error(response.data.error || 'Failed to generate track');
      }
    } catch (error) {
      logger.error('Soundraw generation error', { error: error.message, params });
      throw new Error(`Soundraw API error: ${error.message}`);
    }
  }

  /**
   * Get generation status
   */
  async getGenerationStatus(jobId) {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/music/status/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      return {
        status: response.data.status,
        progress: response.data.progress || 0,
        trackId: response.data.track_id,
        downloadUrl: response.data.download_url,
        error: response.data.error
      };
    } catch (error) {
      logger.error('Soundraw status check error', { error: error.message, jobId });
      throw new Error(`Failed to check status: ${error.message}`);
    }
  }

  /**
   * Download generated track
   */
  async downloadTrack(trackId) {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/music/download/${trackId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        responseType: 'stream'
      });

      return response.data;
    } catch (error) {
      logger.error('Soundraw download error', { error: error.message, trackId });
      throw new Error(`Failed to download track: ${error.message}`);
    }
  }

  /**
   * Validate license for Soundraw
   */
  async validateLicense() {
    const licenseType = this.config.licenseType || 'commercial';

    return {
      allowsCommercialUse: true,
      allowsSocialPlatforms: true,
      platforms: ['youtube', 'tiktok', 'instagram', 'facebook', 'twitter', 'linkedin', 'snapchat'],
      allowsMonetization: licenseType === 'commercial' || licenseType === 'enterprise',
      allowsSaaSIntegration: this.config.enterpriseLicense || false,
      requiresAttribution: false,
      licenseType: licenseType
    };
  }

  /**
   * Get available styles
   */
  async getAvailableStyles() {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/styles`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      return response.data;
    } catch (error) {
      // Return defaults if API fails
      return {
        moods: ['energetic', 'calm', 'happy', 'sad', 'dramatic'],
        genres: ['electronic', 'pop', 'rock', 'hip-hop', 'ambient'],
        tempos: ['slow', 'medium', 'fast']
      };
    }
  }
}

/**
 * Provider factory
 */
function createAIProvider(provider, config) {
  switch (provider) {
    case 'mubert':
      return new MubertProvider(config);
    case 'soundraw':
      return new SoundrawProvider(config);
    default:
      throw new Error(`Unsupported AI music provider: ${provider}`);
  }
}

/**
 * Generate music track
 */
async function generateMusicTrack(providerName, params, userId) {
  const MusicProviderConfig = require('../models/MusicProviderConfig');
  
  // Get AI provider config (different from licensing providers)
  const AIMusicProviderConfig = require('../models/AIMusicProviderConfig');
  const config = await AIMusicProviderConfig.findOne({ 
    provider: providerName, 
    enabled: true 
  }).lean();

  if (!config) {
    throw new Error(`AI music provider ${providerName} not configured or disabled`);
  }

  const provider = createAIProvider(providerName, config);

  // Validate license first
  const licenseInfo = await provider.validateLicense();

  if (!licenseInfo.allowsCommercialUse) {
    throw new Error('Provider license does not allow commercial use');
  }

  if (!licenseInfo.allowsSaaSIntegration) {
    throw new Error('Provider license does not allow SaaS integration');
  }

  // Generate track
  const generation = await provider.generateTrack(params);

  // Store generation record
  const MusicGeneration = require('../models/MusicGeneration');
  const { calculateGenerationCost, trackGenerationCost } = require('./aiMusicCostTracking');
  
  // Check if provider has unlimited plan
  const hasUnlimitedPlan = config.enterpriseLicense && config.licenseType === 'enterprise';
  const cost = calculateGenerationCost(providerName, hasUnlimitedPlan);

  const generationRecord = new MusicGeneration({
    userId,
    provider: providerName,
    jobId: generation.jobId,
    trackId: generation.trackId,
    params,
    status: generation.status || 'processing',
    licenseInfo,
    metadata: {
      cost,
      hasUnlimitedPlan
    }
  });

  await generationRecord.save();

  // Track cost
  if (cost > 0) {
    await trackGenerationCost(generationRecord._id, providerName, cost);
  }

  // Queue for status checking if processing
  if (generation.status === 'processing') {
    const { queueGeneration } = require('./aiMusicGenerationQueue');
    await queueGeneration(generationRecord._id, providerName, 0);
  }

  return {
    generationId: generationRecord._id,
    jobId: generation.jobId,
    trackId: generation.trackId,
    status: generation.status,
    estimatedTime: generation.estimatedTime,
    licenseInfo
  };
}

/**
 * Check generation status
 */
async function checkGenerationStatus(generationId) {
  const MusicGeneration = require('../models/MusicGeneration');
  const generation = await MusicGeneration.findById(generationId);

  if (!generation) {
    throw new Error('Generation not found');
  }

  const AIMusicProviderConfig = require('../models/AIMusicProviderConfig');
  const config = await AIMusicProviderConfig.findOne({ 
    provider: generation.provider 
  }).lean();

  if (!config) {
    throw new Error('Provider config not found');
  }

  const provider = createAIProvider(generation.provider, config);
  const status = await provider.getGenerationStatus(generation.jobId);

  // Update generation record
  generation.status = status.status;
  generation.progress = status.progress;
  generation.trackId = status.trackId || generation.trackId;
  generation.downloadUrl = status.downloadUrl;
  if (status.error) generation.error = status.error;

  await generation.save();

  return status;
}

/**
 * Download and store generated track
 */
async function downloadAndStoreTrack(generationId, userId) {
  const MusicGeneration = require('../models/MusicGeneration');
  const Music = require('../models/Music');

  const generation = await MusicGeneration.findById(generationId);

  if (!generation) {
    throw new Error('Generation not found');
  }

  if (generation.userId.toString() !== userId.toString()) {
    throw new Error('Unauthorized');
  }

  if (generation.status !== 'completed') {
    throw new Error('Generation not completed');
  }

  const AIMusicProviderConfig = require('../models/AIMusicProviderConfig');
  const config = await AIMusicProviderConfig.findOne({ 
    provider: generation.provider 
  }).lean();

  const provider = createAIProvider(generation.provider, config);
  
  // Download track
  const trackStream = await provider.downloadTrack(generation.trackId);

  // Save stream to temporary file first
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  
  const tempPath = path.join(os.tmpdir(), `ai-music-${generation._id}-${Date.now()}.mp3`);
  const writeStream = fs.createWriteStream(tempPath);
  
  await new Promise((resolve, reject) => {
    trackStream.pipe(writeStream);
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  // Upload to storage
  const storageKey = `music/ai-generated/${userId}/${generation._id}.mp3`;
  const uploadResult = await uploadFile(tempPath, storageKey, 'audio/mpeg', {
    userId: userId.toString(),
    provider: generation.provider,
    generationId: generation._id.toString()
  });

  // Clean up temp file
  try {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  } catch (cleanupError) {
    logger.warn('Failed to cleanup temp file', { error: cleanupError.message, tempPath });
  }

  // Create Music record
  const music = new Music({
    userId,
    title: `AI Generated - ${generation.params.mood} ${generation.params.genre}`,
    artist: `${generation.provider} AI`,
    genre: generation.params.genre || 'other',
    mood: generation.params.mood || 'energetic',
    file: {
      url: uploadResult.url,
      filename: `${generation._id}.mp3`,
      size: uploadResult.size || 0,
      duration: generation.params.duration || 60
    },
    license: 'external-provider',
    provider: generation.provider,
    providerTrackId: generation.trackId
  });

  await music.save();

  // Update generation record
  generation.musicId = music._id;
  generation.fileUrl = uploadResult.url;
  await generation.save();

  return music;
}

/**
 * Get available styles for provider
 */
async function getAvailableStyles(providerName) {
  const AIMusicProviderConfig = require('../models/AIMusicProviderConfig');
  const config = await AIMusicProviderConfig.findOne({ 
    provider: providerName,
    enabled: true 
  }).lean();

  if (!config) {
    throw new Error(`AI music provider ${providerName} not configured`);
  }

  const provider = createAIProvider(providerName, config);
  return await provider.getAvailableStyles();
}

module.exports = {
  AIMusicProvider,
  MubertProvider,
  SoundrawProvider,
  createAIProvider,
  generateMusicTrack,
  checkGenerationStatus,
  downloadAndStoreTrack,
  getAvailableStyles
};

