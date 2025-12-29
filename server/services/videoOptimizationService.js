// Video Optimization Service

const logger = require('../utils/logger');

/**
 * Optimize video for platform
 */
async function optimizeForPlatform(videoId, platform, options = {}) {
  try {
    const platformSpecs = {
      youtube: {
        resolution: '1920x1080',
        bitrate: '8000k',
        codec: 'h264',
        format: 'mp4',
        maxFileSize: 128 * 1024 * 1024, // 128MB
        maxDuration: 60 * 60, // 1 hour
      },
      instagram: {
        resolution: '1080x1080',
        bitrate: '3500k',
        codec: 'h264',
        format: 'mp4',
        maxFileSize: 100 * 1024 * 1024, // 100MB
        maxDuration: 60, // 1 minute
      },
      tiktok: {
        resolution: '1080x1920',
        bitrate: '4000k',
        codec: 'h264',
        format: 'mp4',
        maxFileSize: 72 * 1024 * 1024, // 72MB
        maxDuration: 180, // 3 minutes
      },
      twitter: {
        resolution: '1280x720',
        bitrate: '5000k',
        codec: 'h264',
        format: 'mp4',
        maxFileSize: 512 * 1024 * 1024, // 512MB
        maxDuration: 140, // 2:20
      },
      linkedin: {
        resolution: '1920x1080',
        bitrate: '6000k',
        codec: 'h264',
        format: 'mp4',
        maxFileSize: 200 * 1024 * 1024, // 200MB
        maxDuration: 600, // 10 minutes
      },
    };

    const specs = platformSpecs[platform] || platformSpecs.youtube;

    const optimization = {
      videoId,
      platform,
      specs,
      operations: [],
      estimatedTime: 0,
    };

    // Determine required operations
    const {
      resize = true,
      reencode = true,
      compress = true,
      adjustBitrate = true,
    } = options;

    if (resize) {
      optimization.operations.push({
        type: 'resize',
        targetResolution: specs.resolution,
        estimatedTime: 60,
      });
    }

    if (reencode) {
      optimization.operations.push({
        type: 'reencode',
        codec: specs.codec,
        estimatedTime: 120,
      });
    }

    if (compress) {
      optimization.operations.push({
        type: 'compress',
        targetSize: specs.maxFileSize,
        estimatedTime: 90,
      });
    }

    if (adjustBitrate) {
      optimization.operations.push({
        type: 'adjust_bitrate',
        targetBitrate: specs.bitrate,
        estimatedTime: 45,
      });
    }

    optimization.estimatedTime = optimization.operations.reduce((sum, op) => sum + op.estimatedTime, 0);

    logger.info('Video optimization plan created', { videoId, platform, operations: optimization.operations.length });
    return optimization;
  } catch (error) {
    logger.error('Optimize for platform error', { error: error.message, videoId });
    throw error;
  }
}

/**
 * Get optimal video quality
 */
async function getOptimalQuality(videoId, targetFileSize, duration) {
  try {
    // Calculate optimal bitrate based on target size and duration
    const targetBitrate = (targetFileSize * 8) / duration; // bits per second
    const bitrateKbps = Math.floor(targetBitrate / 1000);

    // Determine resolution based on bitrate
    let resolution;
    if (bitrateKbps >= 8000) {
      resolution = '1920x1080'; // Full HD
    } else if (bitrateKbps >= 4000) {
      resolution = '1280x720'; // HD
    } else if (bitrateKbps >= 2000) {
      resolution = '854x480'; // SD
    } else {
      resolution = '640x360'; // Low quality
    }

    return {
      videoId,
      optimalBitrate: `${bitrateKbps}k`,
      optimalResolution: resolution,
      estimatedFileSize: targetFileSize,
      quality: bitrateKbps >= 8000 ? 'high' : bitrateKbps >= 4000 ? 'medium' : 'low',
    };
  } catch (error) {
    logger.error('Get optimal quality error', { error: error.message, videoId });
    throw error;
  }
}

/**
 * Compress video
 */
async function compressVideo(videoId, options = {}) {
  try {
    const {
      targetSize = null,
      quality = 'high',
      removeAudio = false,
      reduceFPS = false,
    } = options;

    const compression = {
      videoId,
      quality,
      operations: [],
      estimatedReduction: 0,
      estimatedTime: 0,
    };

    if (targetSize) {
      compression.operations.push({
        type: 'target_size',
        targetSize,
        estimatedTime: 120,
      });
      compression.estimatedReduction = 0.4; // 40% reduction
    } else {
      // Quality-based compression
      const qualitySettings = {
        high: { crf: 23, estimatedReduction: 0.2 },
        medium: { crf: 28, estimatedReduction: 0.4 },
        low: { crf: 32, estimatedReduction: 0.6 },
      };

      const settings = qualitySettings[quality] || qualitySettings.medium;
      compression.operations.push({
        type: 'quality',
        crf: settings.crf,
        estimatedTime: 90,
      });
      compression.estimatedReduction = settings.estimatedReduction;
    }

    if (removeAudio) {
      compression.operations.push({
        type: 'remove_audio',
        estimatedTime: 10,
      });
      compression.estimatedReduction += 0.1;
    }

    if (reduceFPS) {
      compression.operations.push({
        type: 'reduce_fps',
        targetFPS: 24,
        estimatedTime: 30,
      });
      compression.estimatedReduction += 0.1;
    }

    compression.estimatedTime = compression.operations.reduce((sum, op) => sum + op.estimatedTime, 0);
    compression.estimatedReduction = Math.min(compression.estimatedReduction, 0.8); // Max 80% reduction

    logger.info('Video compression plan created', { videoId, reduction: compression.estimatedReduction });
    return compression;
  } catch (error) {
    logger.error('Compress video error', { error: error.message, videoId });
    throw error;
  }
}

/**
 * Convert video format
 */
async function convertVideoFormat(videoId, targetFormat, options = {}) {
  try {
    const {
      quality = 'high',
      codec = 'h264',
    } = options;

    const conversion = {
      videoId,
      targetFormat,
      codec,
      quality,
      estimatedTime: 180, // 3 minutes
    };

    logger.info('Video format conversion plan created', { videoId, targetFormat });
    return conversion;
  } catch (error) {
    logger.error('Convert video format error', { error: error.message, videoId });
    throw error;
  }
}

module.exports = {
  optimizeForPlatform,
  getOptimalQuality,
  compressVideo,
  convertVideoFormat,
};






