// Proxy Editing Service
// Generate and manage proxy files for better performance

const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

/**
 * Generate proxy file
 */
async function generateProxy(videoPath, outputPath, quality = 'medium') {
  const qualitySettings = {
    low: { resolution: '640x360', bitrate: '500k' },
    medium: { resolution: '1280x720', bitrate: '2000k' },
    high: { resolution: '1920x1080', bitrate: '5000k' }
  };

  const settings = qualitySettings[quality] || qualitySettings.medium;

  return new Promise((resolve, reject) => {
    if (!fs.existsSync(videoPath)) {
      reject(new Error('Video file not found'));
      return;
    }

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    ffmpeg(videoPath)
      .size(settings.resolution)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        `-b:v ${settings.bitrate}`,
        '-preset fast',
        '-crf 28'
      ])
      .output(outputPath)
      .on('start', (cmd) => {
        logger.info('Proxy generation started', { quality, resolution: settings.resolution });
      })
      .on('progress', (progress) => {
        logger.debug('Proxy generation progress', { percent: progress.percent });
      })
      .on('end', () => {
        logger.info('Proxy generated', { outputPath, quality });
        resolve(outputPath);
      })
      .on('error', reject)
      .run();
  });
}

/**
 * Check if proxy exists
 */
async function proxyExists(videoPath, quality = 'medium') {
  const proxyPath = getProxyPath(videoPath, quality);
  return fs.existsSync(proxyPath);
}

/**
 * Get proxy path
 */
function getProxyPath(videoPath, quality = 'medium') {
  const ext = path.extname(videoPath);
  const baseName = path.basename(videoPath, ext);
  const dir = path.dirname(videoPath);
  return path.join(dir, 'proxies', `${baseName}-proxy-${quality}${ext}`);
}

/**
 * Generate proxies for all qualities
 */
async function generateAllProxies(videoPath) {
  const qualities = ['low', 'medium', 'high'];
  const results = {};

  for (const quality of qualities) {
    try {
      const proxyPath = getProxyPath(videoPath, quality);
      const outputPath = await generateProxy(videoPath, proxyPath, quality);
      results[quality] = { success: true, path: outputPath };
    } catch (error) {
      logger.warn('Proxy generation failed', { quality, error: error.message });
      results[quality] = { success: false, error: error.message };
    }
  }

  return results;
}

/**
 * Clean up old proxies
 */
async function cleanupProxies(videoPath, keepQuality = 'medium') {
  const qualities = ['low', 'medium', 'high'];
  
  for (const quality of qualities) {
    if (quality !== keepQuality) {
      const proxyPath = getProxyPath(videoPath, quality);
      if (fs.existsSync(proxyPath)) {
        try {
          fs.unlinkSync(proxyPath);
          logger.info('Proxy cleaned up', { quality, proxyPath });
        } catch (error) {
          logger.warn('Failed to cleanup proxy', { quality, error: error.message });
        }
      }
    }
  }
}

module.exports = {
  generateProxy,
  proxyExists,
  getProxyPath,
  generateAllProxies,
  cleanupProxies,
};
