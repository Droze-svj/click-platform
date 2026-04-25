// Enhanced thumbnail generation

const ffmpeg = require('fluent-ffmpeg');
const sharp = require('sharp');
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

module.exports = {
  generateThumbnail,
  generateMultipleThumbnails,
  generateThumbnailWithText
};







