// Enhanced thumbnail generation

const ffmpeg = require('fluent-ffmpeg');
// sharp is lazy-loaded to prevent startup crashes on some Linux environments
let sharp;
try {
  sharp = require('sharp');
} catch (err) {
  // sharp will be undefined, handled in methods
}

const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

/**
 * Generate thumbnail from video
 * @param {string} videoPath - Video file path
 * @param {string} outputPath - Thumbnail output path
 * @param {Object} options - Thumbnail options
 * @returns {Promise<string>} - Thumbnail path
 */
async function generateThumbnail(videoPath, outputPath, options = {}) {
  const {
    time = '00:00:01', // Time to capture (default 1 second)
    width = 1280,
    height = 720,
    quality = 90
  } = options;

  return new Promise((resolve, reject) => {
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    ffmpeg(videoPath)
      .screenshots({
        timestamps: [time],
        filename: path.basename(outputPath),
        folder: path.dirname(outputPath),
        size: `${width}x${height}`
      })
      .on('end', async () => {
        try {
          // Optimize thumbnail with Sharp
          await sharp(outputPath)
            .resize(width, height, {
              fit: 'cover',
              position: 'center'
            })
            .jpeg({ quality })
            .toFile(outputPath);

          logger.info('Thumbnail generated', { outputPath });
          resolve(outputPath);
        } catch (error) {
          logger.error('Thumbnail optimization error', { error: error.message });
          // Return even if optimization fails
          resolve(outputPath);
        }
      })
      .on('error', (err) => {
        logger.error('Thumbnail generation error', { error: err.message });
        reject(err);
      });
  });
}

/**
 * Generate multiple thumbnails (for video preview)
 * @param {string} videoPath - Video file path
 * @param {string} outputDir - Output directory
 * @param {number} count - Number of thumbnails
 * @returns {Promise<string[]>} - Array of thumbnail paths
 */
async function generateMultipleThumbnails(videoPath, outputDir, count = 4) {
  return new Promise((resolve, reject) => {
    // Get video duration first
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      const duration = metadata.format.duration;
      const interval = duration / (count + 1);
      const timestamps = [];

      for (let i = 1; i <= count; i++) {
        const time = interval * i;
        timestamps.push(time);
      }

      const thumbnails = [];

      ffmpeg(videoPath)
        .screenshots({
          timestamps,
          filename: 'thumb-%s.png',
          folder: outputDir,
          size: '640x360'
        })
        .on('end', () => {
          timestamps.forEach((time, index) => {
            thumbnails.push(path.join(outputDir, `thumb-${time.toFixed(2)}.png`));
          });
          logger.info('Multiple thumbnails generated', { count: thumbnails.length });
          resolve(thumbnails);
        })
        .on('error', (err) => {
          logger.error('Multiple thumbnails error', { error: err.message });
          reject(err);
        });
    });
  });
}

/**
 * Generate thumbnail with text overlay
 * @param {string} videoPath - Video file path
 * @param {string} outputPath - Thumbnail output path
 * @param {string} text - Text to overlay
 * @returns {Promise<string>} - Thumbnail path
 */
async function generateThumbnailWithText(videoPath, outputPath, text) {
  // First generate base thumbnail
  const tempPath = outputPath.replace('.jpg', '-temp.jpg');
  await generateThumbnail(videoPath, tempPath);

  // Add text overlay using Sharp
  try {
    await sharp(tempPath)
      .composite([
        {
          input: {
            text: {
              text: text,
              font: 'Arial',
              fontSize: 48,
              fontColor: 'white'
            }
          },
          gravity: 'south',
          top: 20
        }
      ])
      .toFile(outputPath);

    // Clean up temp file
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }

    logger.info('Thumbnail with text generated', { outputPath });
    return outputPath;
  } catch (error) {
    logger.error('Thumbnail with text error', { error: error.message });
    // Return base thumbnail if text fails
    if (fs.existsSync(tempPath)) {
      fs.renameSync(tempPath, outputPath);
    }
    return outputPath;
  }
}

/**
 * Generate neural-optimized thumbnail.
 *
 * Frame-time selection (in priority order):
 *   1. Caller-provided `keyMoments.bestThumbnail.time`
 *   2. Real engagement signal from videoHeatmapService.pickBestThumbnailTime
 *      (peak heatmap intensity, peak retention, or peer-video transfer)
 *   3. ffprobe duration midpoint — better than second 0, which is almost
 *      always a black frame on platform-encoded videos
 */
async function generateNeuralThumbnail(videoPath, outputPath, keyMoments = {}, renderOpts = {}) {
  let bestMoment = keyMoments.bestThumbnail?.time;
  let source = 'caller';

  if (bestMoment === undefined && keyMoments.postId) {
    try {
      const { pickBestThumbnailTime } = require('./videoHeatmapService');
      const pick = await pickBestThumbnailTime(keyMoments.postId, {
        videoDuration: keyMoments.videoDuration,
      });
      if (pick) {
        bestMoment = pick.second;
        source = pick.source;
      }
    } catch (err) {
      logger.warn('Neural Thumbnail: heatmap lookup failed', { error: err.message });
    }
  }

  if (bestMoment === undefined) {
    bestMoment = await safeMidpoint(videoPath);
    source = 'midpoint-fallback';
  }

  logger.info('Neural Thumbnail: targeting frame', { time: bestMoment, source });
  return await generateThumbnail(videoPath, outputPath, {
    time: bestMoment,
    width: renderOpts.width || 1280,
    height: renderOpts.height || 720,
    quality: renderOpts.quality || 95,
  });
}

function safeMidpoint(videoPath) {
  return new Promise((resolve) => {
    try {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err || !metadata?.format?.duration) return resolve(1);
        resolve(Math.max(1, Math.floor(metadata.format.duration / 2)));
      });
    } catch (_) { resolve(1); }
  });
}

module.exports = {
  generateThumbnail,
  generateMultipleThumbnails,
  generateThumbnailWithText,
  generateNeuralThumbnail
};








