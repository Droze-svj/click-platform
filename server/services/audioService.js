// Audio processing service - mix music with video

const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

/**
 * Mix background music with video
 * @param {string} videoPath - Path to video file
 * @param {string} musicPath - Path to music file
 * @param {string} outputPath - Output path
 * @param {Object} options - Mixing options
 * @returns {Promise<string>} - Path to output file
 */
async function mixMusicWithVideo(videoPath, musicPath, outputPath, options = {}) {
  const {
    musicVolume = 0.3, // 30% volume for background music
    fadeIn = 2, // Fade in duration in seconds
    fadeOut = 2, // Fade out duration in seconds
    loop = true, // Loop music if shorter than video
    startTime = 0 // Start music at this time
  } = options;

  return new Promise((resolve, reject) => {
    // Get video duration first
    ffmpeg.ffprobe(videoPath, (err, videoMetadata) => {
      if (err) {
        reject(new Error(`Failed to probe video: ${err.message}`));
        return;
      }

      const videoDuration = videoMetadata.format.duration;

      // Get music duration
      ffmpeg.ffprobe(musicPath, (err, musicMetadata) => {
        if (err) {
          reject(new Error(`Failed to probe music: ${err.message}`));
          return;
        }

        const musicDuration = musicMetadata.format.duration;
        const needsLoop = loop && musicDuration < videoDuration;

        let command = ffmpeg(videoPath)
          .input(musicPath)
          .inputOptions([
            `-ss ${startTime}`, // Start music at specified time
            needsLoop ? '-stream_loop -1' : '' // Loop if needed
          ])
          .complexFilter([
            // Mix audio tracks
            {
              filter: 'amix',
              options: {
                inputs: 2,
                duration: 'longest',
                dropout_transition: 2000
              },
              inputs: ['0:a', '1:a'],
              outputs: 'mixed'
            },
            // Apply volume to music
            {
              filter: 'volume',
              options: `${musicVolume}`,
              inputs: '1:a',
              outputs: 'music_vol'
            },
            // Fade in/out
            {
              filter: 'afade',
              options: {
                type: 'in',
                start_time: 0,
                duration: fadeIn
              },
              inputs: 'music_vol',
              outputs: 'music_fadein'
            },
            {
              filter: 'afade',
              options: {
                type: 'out',
                start_time: videoDuration - fadeOut,
                duration: fadeOut
              },
              inputs: 'music_fadein',
              outputs: 'music_final'
            },
            // Mix final audio
            {
              filter: 'amix',
              options: {
                inputs: 2,
                duration: 'longest'
              },
              inputs: ['0:a', 'music_final'],
              outputs: 'final_audio'
            }
          ])
          .outputOptions([
            '-map 0:v', // Video stream
            '-map [final_audio]', // Mixed audio
            '-c:v copy', // Copy video codec
            '-c:a aac', // Audio codec
            '-shortest' // End when shortest stream ends
          ])
          .output(outputPath)
          .on('start', (commandLine) => {
            logger.info('Starting audio mixing', { command: commandLine });
          })
          .on('progress', (progress) => {
            logger.debug('Audio mixing progress', { percent: progress.percent });
          })
          .on('end', () => {
            logger.info('Audio mixing completed', { outputPath });
            resolve(outputPath);
          })
          .on('error', (err) => {
            logger.error('Audio mixing error', { error: err.message });
            reject(err);
          });

        command.run();
      });
    });
  });
}

/**
 * Normalize audio levels
 * @param {string} audioPath - Path to audio file
 * @param {string} outputPath - Output path
 * @returns {Promise<string>} - Path to output file
 */
async function normalizeAudio(audioPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(audioPath)
      .audioFilters('loudnorm=I=-16:TP=-1.5:LRA=11')
      .output(outputPath)
      .on('end', () => {
        logger.info('Audio normalized', { outputPath });
        resolve(outputPath);
      })
      .on('error', (err) => {
        logger.error('Audio normalization error', { error: err.message });
        reject(err);
      })
      .run();
  });
}

/**
 * Extract audio from video
 * @param {string} videoPath - Path to video file
 * @param {string} outputPath - Output path for audio
 * @returns {Promise<string>} - Path to output file
 */
async function extractAudio(videoPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec('libmp3lame')
      .output(outputPath)
      .on('end', () => {
        logger.info('Audio extracted', { outputPath });
        resolve(outputPath);
      })
      .on('error', (err) => {
        logger.error('Audio extraction error', { error: err.message });
        reject(err);
      })
      .run();
  });
}

module.exports = {
  mixMusicWithVideo,
  normalizeAudio,
  extractAudio
};







