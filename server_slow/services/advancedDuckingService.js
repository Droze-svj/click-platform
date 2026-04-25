// Advanced Audio Ducking Service
// Automatically lowers background music volume when speech is detected

const ffmpeg = require('fluent-ffmpeg');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');

/**
 * Apply ducking to an audio track
 * @param {string} speechPath - Path to the speech/voiceover file
 * @param {string} musicPath - Path to the music file
 * @param {string} outputPath - Path to save the resulting mixed file
 * @param {Object} options - Ducking options
 * @returns {Promise<string>} - Path to the output file
 */
async function applyDucking(speechPath, musicPath, outputPath, options = {}) {
  const {
    duckVolume = 0.1, // Volume of music during speech (0.0 to 1.0)
    fadeDuration = 0.5, // Fade in/out duration in seconds
    attackTime = 0.1, // How quickly the ducking starts
    releaseTime = 0.5, // How quickly the ducking ends
    threshold = -20, // Threshold in dB to trigger ducking
  } = options;

  return new Promise((resolve, reject) => {
    logger.info('🚀 Starting Advanced Audio Ducking...', { speechPath, musicPath });

    // Use sidechain compression logic for ducking
    // We use the speech track as a sidechain to compress the music track
    ffmpeg()
      .input(musicPath)
      .input(speechPath)
      .complexFilter([
        // [0:a] is music, [1:a] is speech
        // sidechaincompress: music is compressed by speech
        {
          filter: 'sidechaincompress',
          options: {
            threshold: 10 ** (threshold / 20),
            ratio: 20,
            attack: attackTime * 1000,
            release: releaseTime * 1000,
            makeup: 1,
          },
          inputs: '0:a',
          outputs: 'ducked_music'
        },
        // Mix the ducked music with the original speech
        {
          filter: 'amix',
          options: {
            inputs: 2,
            duration: 'first',
            dropout_transition: 2
          },
          inputs: ['ducked_music', '1:a'],
          outputs: 'audio_out'
        }
      ])
      .map('audio_out')
      .on('start', (commandLine) => {
        logger.debug('FFmpeg command: ' + commandLine);
      })
      .on('progress', (progress) => {
        logger.debug('Processing: ' + progress.percent + '% done');
      })
      .on('error', (err) => {
        logger.error('Ducking Error: ' + err.message);
        reject(err);
      })
      .on('end', () => {
        logger.info('✅ Ducking complete: ' + outputPath);
        resolve(outputPath);
      })
      .save(outputPath);
  });
}

/**
 * Analyze speech levels to determine optimal ducking points
 * Useful for more complex manual ducking control
 */
async function analyzeSpeechTimeline(speechPath) {
  return new Promise((resolve, reject) => {
    // Use volumedetect to find speech levels
    ffmpeg(speechPath)
      .audioFilters('volumedetect')
      .format('null')
      .on('error', reject)
      .on('end', (stdout, stderr) => {
        // Parse stderr for volume info
        const meanVolume = stderr.match(/mean_volume: ([\d.-]+) dB/);
        const maxVolume = stderr.match(/max_volume: ([\d.-]+) dB/);
        
        resolve({
          meanVolume: meanVolume ? parseFloat(meanVolume[1]) : 0,
          maxVolume: maxVolume ? parseFloat(maxVolume[1]) : 0
        });
      })
      .save('null');
  });
}

module.exports = {
  applyDucking,
  analyzeSpeechTimeline
};
