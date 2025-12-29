// Advanced video processing service

const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const sharp = require('sharp');
const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');

const unlink = promisify(fs.unlink);
const mkdir = promisify(fs.mkdir);

/**
 * Compress video
 */
async function compressVideo(inputPath, outputPath, options = {}) {
  try {
    const {
      quality = 'medium', // low, medium, high
      format = 'mp4',
      resolution = null, // e.g., '1280x720'
      bitrate = null,
    } = options;

    const qualitySettings = {
      low: { crf: 28, preset: 'fast' },
      medium: { crf: 23, preset: 'medium' },
      high: { crf: 18, preset: 'slow' },
    };

    const settings = qualitySettings[quality] || qualitySettings.medium;

    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          `-crf ${settings.crf}`,
          `-preset ${settings.preset}`,
          '-movflags +faststart', // Web optimization
        ]);

      if (resolution) {
        command = command.size(resolution);
      }

      if (bitrate) {
        command = command.videoBitrate(bitrate);
      }

      if (format === 'webm') {
        command = command.videoCodec('libvpx-vp9').audioCodec('libopus');
      }

      command
        .output(outputPath)
        .on('start', (cmdline) => {
          logger.info('Video compression started', { inputPath, outputPath });
        })
        .on('progress', (progress) => {
          logger.debug('Compression progress', { percent: progress.percent });
        })
        .on('end', () => {
          logger.info('Video compression completed', { outputPath });
          resolve(outputPath);
        })
        .on('error', (error) => {
          logger.error('Video compression error', { error: error.message });
          reject(error);
        })
        .run();
    });
  } catch (error) {
    logger.error('Compress video error', { error: error.message });
    captureException(error, { tags: { service: 'video', operation: 'compress' } });
    throw error;
  }
}

/**
 * Generate video thumbnail
 */
async function generateThumbnail(videoPath, outputPath, options = {}) {
  try {
    const {
      time = '00:00:01', // Time to capture
      width = 1280,
      height = 720,
      quality = 90,
    } = options;

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: [time],
          filename: path.basename(outputPath),
          folder: path.dirname(outputPath),
          size: `${width}x${height}`,
        })
        .on('end', async () => {
          // Optimize thumbnail with Sharp
          try {
            await sharp(outputPath)
              .resize(width, height, { fit: 'cover' })
              .jpeg({ quality })
              .toFile(outputPath);
            
            logger.info('Thumbnail generated', { outputPath });
            resolve(outputPath);
          } catch (sharpError) {
            logger.warn('Thumbnail optimization skipped', { error: sharpError.message });
            resolve(outputPath);
          }
        })
        .on('error', (error) => {
          logger.error('Thumbnail generation error', { error: error.message });
          reject(error);
        });
    });
  } catch (error) {
    logger.error('Generate thumbnail error', { error: error.message });
    captureException(error, { tags: { service: 'video', operation: 'thumbnail' } });
    throw error;
  }
}

/**
 * Extract video metadata
 */
async function getVideoMetadata(videoPath) {
  try {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

        const info = {
          duration: metadata.format.duration,
          size: metadata.format.size,
          bitrate: metadata.format.bit_rate,
          format: metadata.format.format_name,
          video: {
            codec: videoStream?.codec_name,
            width: videoStream?.width,
            height: videoStream?.height,
            fps: eval(videoStream?.r_frame_rate || '0/1'),
            bitrate: videoStream?.bit_rate,
          },
          audio: {
            codec: audioStream?.codec_name,
            sampleRate: audioStream?.sample_rate,
            channels: audioStream?.channels,
            bitrate: audioStream?.bit_rate,
          },
        };

        resolve(info);
      });
    });
  } catch (error) {
    logger.error('Get video metadata error', { error: error.message });
    throw error;
  }
}

/**
 * Convert video format
 */
async function convertVideoFormat(inputPath, outputPath, targetFormat) {
  try {
    const formatMap = {
      mp4: { videoCodec: 'libx264', audioCodec: 'aac', extension: 'mp4' },
      webm: { videoCodec: 'libvpx-vp9', audioCodec: 'libopus', extension: 'webm' },
      mov: { videoCodec: 'libx264', audioCodec: 'aac', extension: 'mov' },
      avi: { videoCodec: 'libx264', audioCodec: 'aac', extension: 'avi' },
    };

    const format = formatMap[targetFormat.toLowerCase()];
    if (!format) {
      throw new Error(`Unsupported format: ${targetFormat}`);
    }

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec(format.videoCodec)
        .audioCodec(format.audioCodec)
        .output(outputPath)
        .on('start', () => {
          logger.info('Video format conversion started', { inputPath, outputPath });
        })
        .on('end', () => {
          logger.info('Video format conversion completed', { outputPath });
          resolve(outputPath);
        })
        .on('error', (error) => {
          logger.error('Video format conversion error', { error: error.message });
          reject(error);
        })
        .run();
    });
  } catch (error) {
    logger.error('Convert video format error', { error: error.message });
    captureException(error, { tags: { service: 'video', operation: 'convert' } });
    throw error;
  }
}

/**
 * Trim video
 */
async function trimVideo(inputPath, outputPath, startTime, duration) {
  try {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(startTime)
        .setDuration(duration)
        .output(outputPath)
        .on('start', () => {
          logger.info('Video trim started', { inputPath, startTime, duration });
        })
        .on('end', () => {
          logger.info('Video trim completed', { outputPath });
          resolve(outputPath);
        })
        .on('error', (error) => {
          logger.error('Video trim error', { error: error.message });
          reject(error);
        })
        .run();
    });
  } catch (error) {
    logger.error('Trim video error', { error: error.message });
    captureException(error, { tags: { service: 'video', operation: 'trim' } });
    throw error;
  }
}

/**
 * Merge multiple videos
 */
async function mergeVideos(inputPaths, outputPath) {
  try {
    // Create concat file for FFmpeg
    const concatFile = path.join(path.dirname(outputPath), `concat-${Date.now()}.txt`);
    const concatContent = inputPaths.map(p => `file '${path.resolve(p)}'`).join('\n');
    fs.writeFileSync(concatFile, concatContent);

    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(concatFile)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions(['-c', 'copy'])
        .output(outputPath)
        .on('start', () => {
          logger.info('Video merge started', { inputPaths, outputPath });
        })
        .on('end', () => {
          // Clean up concat file
          if (fs.existsSync(concatFile)) {
            fs.unlinkSync(concatFile);
          }
          logger.info('Video merge completed', { outputPath });
          resolve(outputPath);
        })
        .on('error', (error) => {
          // Clean up concat file
          if (fs.existsSync(concatFile)) {
            fs.unlinkSync(concatFile);
          }
          logger.error('Video merge error', { error: error.message });
          reject(error);
        })
        .run();
    });
  } catch (error) {
    logger.error('Merge videos error', { error: error.message });
    captureException(error, { tags: { service: 'video', operation: 'merge' } });
    throw error;
  }
}

/**
 * Extract audio from video
 */
async function extractAudio(videoPath, outputPath, format = 'mp3') {
  try {
    const codecMap = {
      mp3: 'libmp3lame',
      wav: 'pcm_s16le',
      aac: 'aac',
    };

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .noVideo()
        .audioCodec(codecMap[format] || 'libmp3lame')
        .output(outputPath)
        .on('start', () => {
          logger.info('Audio extraction started', { videoPath, outputPath });
        })
        .on('end', () => {
          logger.info('Audio extraction completed', { outputPath });
          resolve(outputPath);
        })
        .on('error', (error) => {
          logger.error('Audio extraction error', { error: error.message });
          reject(error);
        })
        .run();
    });
  } catch (error) {
    logger.error('Extract audio error', { error: error.message });
    captureException(error, { tags: { service: 'video', operation: 'extract_audio' } });
    throw error;
  }
}

/**
 * Batch process videos
 */
async function batchProcessVideos(videos, processor, options = {}) {
  try {
    const { concurrency = 2 } = options;
    const results = [];
    const errors = [];

    // Process in batches
    for (let i = 0; i < videos.length; i += concurrency) {
      const batch = videos.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map(video => processor(video))
      );

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push({ video: batch[index], result: result.value });
        } else {
          errors.push({ video: batch[index], error: result.reason.message });
        }
      });
    }

    return {
      processed: results.length,
      failed: errors.length,
      results,
      errors,
    };
  } catch (error) {
    logger.error('Batch process videos error', { error: error.message });
    throw error;
  }
}

module.exports = {
  compressVideo,
  generateThumbnail,
  getVideoMetadata,
  convertVideoFormat,
  trimVideo,
  mergeVideos,
  extractAudio,
  batchProcessVideos,
};






