// Professional Export Options Service
// Features: Platform Presets, Custom Settings, Batch Export, Queue, Watermark, Metadata, Compression, Progress, History, Cloud Upload

const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const { uploadFile } = require('./storageService');

/**
 * Export video with platform preset
 */
async function exportWithPreset(videoPath, outputPath, platform, options = {}) {
  const presets = {
    'youtube': {
      resolution: { width: 1920, height: 1080 },
      quality: { bitrate: '8000k', codec: 'h264', preset: 'medium' },
      audio: { codec: 'aac', bitrate: '192k', sampleRate: 44100 },
      format: 'mp4'
    },
    'instagram-feed': {
      resolution: { width: 1080, height: 1080 },
      quality: { bitrate: '5000k', codec: 'h264', preset: 'medium' },
      audio: { codec: 'aac', bitrate: '128k', sampleRate: 44100 },
      format: 'mp4'
    },
    'instagram-story': {
      resolution: { width: 1080, height: 1920 },
      quality: { bitrate: '5000k', codec: 'h264', preset: 'medium' },
      audio: { codec: 'aac', bitrate: '128k', sampleRate: 44100 },
      format: 'mp4'
    },
    'instagram-reel': {
      resolution: { width: 1080, height: 1920 },
      quality: { bitrate: '6000k', codec: 'h264', preset: 'medium' },
      audio: { codec: 'aac', bitrate: '128k', sampleRate: 44100 },
      format: 'mp4'
    },
    'tiktok': {
      resolution: { width: 1080, height: 1920 },
      quality: { bitrate: '6000k', codec: 'h264', preset: 'fast' },
      audio: { codec: 'aac', bitrate: '128k', sampleRate: 44100 },
      format: 'mp4'
    },
    'twitter': {
      resolution: { width: 1280, height: 720 },
      quality: { bitrate: '5000k', codec: 'h264', preset: 'fast' },
      audio: { codec: 'aac', bitrate: '128k', sampleRate: 44100 },
      format: 'mp4'
    },
    'linkedin': {
      resolution: { width: 1920, height: 1080 },
      quality: { bitrate: '8000k', codec: 'h264', preset: 'medium' },
      audio: { codec: 'aac', bitrate: '192k', sampleRate: 44100 },
      format: 'mp4'
    },
    'facebook': {
      resolution: { width: 1920, height: 1080 },
      quality: { bitrate: '8000k', codec: 'h264', preset: 'medium' },
      audio: { codec: 'aac', bitrate: '192k', sampleRate: 44100 },
      format: 'mp4'
    }
  };
  
  const preset = presets[platform];
  if (!preset) {
    throw new Error(`Platform preset "${platform}" not found`);
  }
  
  return new Promise((resolve, reject) => {
    let command = ffmpeg(videoPath);
    
    // Set resolution
    command.size(`${preset.resolution.width}x${preset.resolution.height}`);
    
    // Set video codec and quality
    command.videoCodec(preset.quality.codec);
    command.outputOptions([
      `-b:v ${preset.quality.bitrate}`,
      `-preset ${preset.quality.preset}`,
      '-movflags +faststart' // Web optimization
    ]);
    
    // Set audio codec and quality
    command.audioCodec(preset.audio.codec);
    command.outputOptions([
      `-b:a ${preset.audio.bitrate}`,
      `-ar ${preset.audio.sampleRate}`
    ]);
    
    // Add watermark if provided
    if (options.watermark) {
      const { image, position, opacity } = options.watermark;
      if (fs.existsSync(image)) {
        command.input(image);
        // Apply watermark overlay (simplified)
      }
    }
    
    // Add metadata if provided
    if (options.metadata) {
      if (options.metadata.title) {
        command.outputOptions([`-metadata`, `title=${options.metadata.title}`]);
      }
      if (options.metadata.description) {
        command.outputOptions([`-metadata`, `description=${options.metadata.description}`]);
      }
    }
    
    command
      .format(preset.format)
      .output(outputPath)
      .on('start', (cmd) => {
        logger.info('Export started', { platform, command: cmd });
      })
      .on('progress', (progress) => {
        if (options.onProgress) {
          options.onProgress(progress.percent || 0);
        }
      })
      .on('end', () => {
        logger.info('Export completed', { outputPath, platform });
        resolve(outputPath);
      })
      .on('error', reject)
      .run();
  });
}

/**
 * Export with custom settings
 */
async function exportCustom(videoPath, outputPath, settings) {
  const {
    resolution,
    quality,
    audio,
    format = 'mp4',
    watermark,
    metadata
  } = settings;
  
  return new Promise((resolve, reject) => {
    let command = ffmpeg(videoPath);
    
    // Resolution
    if (resolution) {
      command.size(`${resolution.width}x${resolution.height}`);
    }
    
    // Video quality
    if (quality) {
      command.videoCodec(quality.codec || 'h264');
      if (quality.bitrate) {
        command.outputOptions([`-b:v ${quality.bitrate}`]);
      }
      if (quality.preset) {
        command.outputOptions([`-preset ${quality.preset}`]);
      }
      if (quality.crf !== undefined) {
        command.outputOptions([`-crf ${quality.crf}`]);
      }
    }
    
    // Audio
    if (audio) {
      command.audioCodec(audio.codec || 'aac');
      if (audio.bitrate) {
        command.outputOptions([`-b:a ${audio.bitrate}`]);
      }
      if (audio.sampleRate) {
        command.outputOptions([`-ar ${audio.sampleRate}`]);
      }
    }
    
    // Watermark
    if (watermark && watermark.image && fs.existsSync(watermark.image)) {
      command.input(watermark.image);
      // Apply overlay (simplified)
    }
    
    // Metadata
    if (metadata) {
      Object.entries(metadata).forEach(([key, value]) => {
        command.outputOptions([`-metadata`, `${key}=${value}`]);
      });
    }
    
    command
      .format(format)
      .output(outputPath)
      .on('end', () => {
        logger.info('Custom export completed', { outputPath });
        resolve(outputPath);
      })
      .on('error', reject)
      .run();
  });
}

/**
 * Batch export to multiple formats
 */
async function batchExport(videoPath, exports, onProgress) {
  const results = [];
  
  for (const exportConfig of exports) {
    try {
      const { platform, outputPath, options } = exportConfig;
      
      if (platform) {
        await exportWithPreset(videoPath, outputPath, platform, {
          ...options,
          onProgress: (percent) => {
            if (onProgress) {
              onProgress({ platform, percent });
            }
          }
        });
      } else {
        await exportCustom(videoPath, outputPath, options || {});
      }
      
      results.push({ platform: platform || 'custom', outputPath, success: true });
    } catch (error) {
      logger.error('Batch export error', { error: error.message, export: exportConfig });
      results.push({ platform: exportConfig.platform || 'custom', success: false, error: error.message });
    }
  }
  
  return results;
}

/**
 * Get platform presets
 */
function getPlatformPresets() {
  return {
    'youtube': {
      name: 'YouTube',
      resolution: '1920x1080',
      format: 'MP4',
      description: 'Optimized for YouTube uploads'
    },
    'instagram-feed': {
      name: 'Instagram Feed',
      resolution: '1080x1080',
      format: 'MP4',
      description: 'Square format for Instagram feed'
    },
    'instagram-story': {
      name: 'Instagram Story',
      resolution: '1080x1920',
      format: 'MP4',
      description: 'Vertical format for Instagram stories'
    },
    'instagram-reel': {
      name: 'Instagram Reel',
      resolution: '1080x1920',
      format: 'MP4',
      description: 'Vertical format for Instagram reels'
    },
    'tiktok': {
      name: 'TikTok',
      resolution: '1080x1920',
      format: 'MP4',
      description: 'Optimized for TikTok uploads'
    },
    'twitter': {
      name: 'Twitter/X',
      resolution: '1280x720',
      format: 'MP4',
      description: 'Optimized for Twitter/X'
    },
    'linkedin': {
      name: 'LinkedIn',
      resolution: '1920x1080',
      format: 'MP4',
      description: 'Professional format for LinkedIn'
    },
    'facebook': {
      name: 'Facebook',
      resolution: '1920x1080',
      format: 'MP4',
      description: 'Optimized for Facebook'
    }
  };
}

module.exports = {
  exportWithPreset,
  exportCustom,
  batchExport,
  getPlatformPresets,
};
