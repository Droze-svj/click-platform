// Manual Edit Preview Service
// Generate preview frames and before/after comparisons

const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

/**
 * Generate preview frame from video
 */
async function generatePreviewFrame(videoPath, time, outputPath) {
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
      .seekInput(time)
      .frames(1)
      .output(outputPath)
      .on('end', () => {
        logger.info('Preview frame generated', { outputPath, time });
        resolve(outputPath);
      })
      .on('error', (err) => {
        logger.error('Preview frame error', { error: err.message, time });
        reject(err);
      })
      .run();
  });
}

/**
 * Generate preview with effects applied (simulated)
 */
async function generateEffectPreview(videoPath, time, effectSettings, outputPath) {
  return new Promise((resolve, reject) => {
    // Extract frame
    const tempFrame = path.join(path.dirname(outputPath), `temp-frame-${Date.now()}.jpg`);
    
    generatePreviewFrame(videoPath, time, tempFrame)
      .then(() => {
        // Apply effects to frame (simplified - in production would use image processing)
        // For now, just copy the frame
        fs.copyFileSync(tempFrame, outputPath);
        
        // Clean up temp file
        if (fs.existsSync(tempFrame)) {
          fs.unlinkSync(tempFrame);
        }
        
        logger.info('Effect preview generated', { outputPath, effect: effectSettings.type });
        resolve(outputPath);
      })
      .catch(reject);
  });
}

/**
 * Generate before/after comparison
 */
async function generateBeforeAfterComparison(originalPath, editedPath, outputPath, options = {}) {
  const { frameTime = 5, layout = 'side-by-side' } = options;

  return new Promise((resolve, reject) => {
    const originalFrame = path.join(path.dirname(outputPath), `original-${Date.now()}.jpg`);
    const editedFrame = path.join(path.dirname(outputPath), `edited-${Date.now()}.jpg`);

    Promise.all([
      generatePreviewFrame(originalPath, frameTime, originalFrame),
      generatePreviewFrame(editedPath, frameTime, editedFrame)
    ]).then(() => {
      // Create side-by-side comparison using FFmpeg
      // This is simplified - full implementation would use complex filter
      ffmpeg()
        .input(originalFrame)
        .input(editedFrame)
        .complexFilter([
          {
            filter: 'hstack',
            inputs: ['0:v', '1:v'],
            outputs: 'comparison'
          }
        ])
        .outputOptions(['-map [comparison]'])
        .output(outputPath)
        .on('end', () => {
          // Clean up temp files
          if (fs.existsSync(originalFrame)) fs.unlinkSync(originalFrame);
          if (fs.existsSync(editedFrame)) fs.unlinkSync(editedFrame);
          
          logger.info('Before/after comparison generated', { outputPath });
          resolve(outputPath);
        })
        .on('error', reject)
        .run();
    }).catch(reject);
  });
}

/**
 * Generate multiple preview frames (timeline thumbnails)
 */
async function generateTimelineThumbnails(videoPath, count = 10, outputDir) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      const duration = metadata.format.duration;
      const interval = duration / (count + 1);
      const thumbnails = [];

      Promise.all(
        Array.from({ length: count }, (_, i) => {
          const time = interval * (i + 1);
          const outputPath = path.join(outputDir, `thumb-${i + 1}.jpg`);
          thumbnails.push({ time, path: outputPath });
          return generatePreviewFrame(videoPath, time, outputPath);
        })
      ).then(() => {
        logger.info('Timeline thumbnails generated', { count, outputDir });
        resolve(thumbnails);
      }).catch(reject);
    });
  });
}

/**
 * Generate video preview (short clip with effects)
 */
async function generateVideoPreview(videoPath, startTime, duration, effectSettings, outputPath) {
  return new Promise((resolve, reject) => {
    let command = ffmpeg(videoPath)
      .seekInput(startTime)
      .duration(duration);

    // Apply effects based on settings
    if (effectSettings.colorGrading) {
      // Apply color grading (simplified)
      command.videoFilters('eq=brightness=0.1:saturation=1.2');
    }

    if (effectSettings.audio) {
      // Apply audio effects (simplified)
      command.audioFilters('volume=1.2');
    }

    command
      .output(outputPath)
      .on('end', () => {
        logger.info('Video preview generated', { outputPath, duration });
        resolve(outputPath);
      })
      .on('error', reject)
      .run();
  });
}

module.exports = {
  generatePreviewFrame,
  generateEffectPreview,
  generateBeforeAfterComparison,
  generateTimelineThumbnails,
  generateVideoPreview,
};
