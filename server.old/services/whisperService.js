// Video transcription service.
// Click is configured for Gemini-only AI: this service routes through
// utils/googleAI.transcribeAudio (Gemini 1.5 native audio understanding).
// The OpenAI/Whisper code path is fully removed — re-enable by reverting this
// file *and* unsetting AI_GEMINI_ONLY.

const fs = require('fs');
const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');
const { retryWithBackoff } = require('../utils/retryWithBackoff');
const { transcribeAudio: geminiTranscribe, isConfigured: geminiConfigured } = require('../utils/googleAI');

/**
 * Extract audio from video file (if needed)
 * @param {string} videoPath - Path to video file
 * @returns {Promise<string>} - Path to audio file
 */
async function extractAudioFromVideo(videoPath) {
  const ffmpeg = require('fluent-ffmpeg');
  const path = require('path');
  const tempAudioPath = videoPath.replace(path.extname(videoPath), '.mp3');

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .toFormat('mp3')
      .audioCodec('libmp3lame')
      .audioBitrate(128)
      .on('end', () => resolve(tempAudioPath))
      .on('error', (err) => reject(err))
      .save(tempAudioPath);
  });
}

/**
 * Generate transcript from video using OpenAI Whisper with retry logic
 * @param {string} videoPath - Path to video file
 * @param {object} options - Transcription options
 * @returns {Promise<string>} - Generated transcript
 */
async function generateTranscriptFromVideo(videoPath, options = {}) {
  if (!geminiConfigured) {
    logger.warn('Gemini API key not configured, transcript generation unavailable');
    return null;
  }

  const {
    language = 'en',
    prompt = null,
  } = options;

  try {
    if (!fs.existsSync(videoPath)) {
      throw new Error('Video file not found');
    }

    // Gemini accepts audio inline — we always extract audio from video first
    // because audio-only payloads are smaller and more reliably processed.
    let fileToTranscribe = videoPath;
    let shouldCleanupAudio = false;
    try {
      fileToTranscribe = await extractAudioFromVideo(videoPath);
      shouldCleanupAudio = true;
      logger.info('Audio extracted from video for Gemini transcription', { videoPath, audioPath: fileToTranscribe });
    } catch (extractError) {
      logger.warn('Audio extraction failed, sending original file to Gemini', { error: extractError.message });
    }

    const fileSize = fs.statSync(fileToTranscribe).size;
    logger.info('Starting Gemini transcript generation', {
      videoPath,
      fileSize: `${(fileSize / 1024 / 1024).toFixed(2)}MB`,
      language,
    });

    const transcript = await retryWithBackoff(
      async () => geminiTranscribe(fileToTranscribe, { language, prompt }),
      {
        maxRetries: 3,
        initialDelay: 1500,
        maxDelay: 10000,
        onRetry: (attempt, error) => {
          logger.warn('Gemini transcript retry', { attempt, error: error.message, videoPath });
        },
      }
    );

    if (shouldCleanupAudio && fs.existsSync(fileToTranscribe) && fileToTranscribe !== videoPath) {
      try { fs.unlinkSync(fileToTranscribe); } catch (e) { logger.warn('Failed to cleanup audio file', { error: e.message }); }
    }

    if (!transcript) return null;
    logger.info('Transcript generated successfully', {
      videoPath,
      length: transcript.length,
      wordCount: transcript.split(/\s+/).length,
    });
    return transcript;
  } catch (error) {
    logger.error('Gemini transcription error', { error: error.message, videoPath, stack: error.stack });
    captureException(error, {
      tags: { service: 'gemini-transcription', operation: 'transcription' },
      extra: { videoPath, options },
    });
    return null;
  }
}

/**
 * Generate transcript from audio file
 * @param {string} audioPath - Path to audio file
 * @returns {Promise<string>} - Generated transcript
 */
async function generateTranscriptFromAudio(audioPath) {
  return generateTranscriptFromVideo(audioPath); // Same implementation
}

module.exports = {
  generateTranscriptFromVideo,
  generateTranscriptFromAudio
};




