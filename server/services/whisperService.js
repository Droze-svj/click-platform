// OpenAI Whisper API for real video transcript generation

const OpenAI = require('openai');
const fs = require('fs');
const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');
const { retryWithBackoff } = require('../utils/retryWithBackoff');

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 300000, // 5 minutes for long videos
}) : null;

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
  if (!openai) {
    logger.warn('OpenAI API key not configured, transcript generation unavailable');
    return null;
  }

  const {
    language = 'en',
    responseFormat = 'text',
    temperature = 0,
    prompt = null, // Optional prompt to guide the model
    useAudioExtraction = false, // Extract audio first for better results
  } = options;

  try {
    // Check if file exists
    if (!fs.existsSync(videoPath)) {
      throw new Error('Video file not found');
    }

    let fileToTranscribe = videoPath;
    let shouldCleanupAudio = false;

    // Extract audio if requested (better for large videos)
    if (useAudioExtraction) {
      try {
        fileToTranscribe = await extractAudioFromVideo(videoPath);
        shouldCleanupAudio = true;
        logger.info('Audio extracted from video', { videoPath, audioPath: fileToTranscribe });
      } catch (extractError) {
        logger.warn('Audio extraction failed, using video directly', { error: extractError.message });
      }
    }

    // Create a readable stream from the file
    const fileStream = fs.createReadStream(fileToTranscribe);
    const fileSize = fs.statSync(fileToTranscribe).size;

    logger.info('Starting transcript generation', {
      videoPath,
      fileSize: `${(fileSize / 1024 / 1024).toFixed(2)}MB`,
      language,
    });

    // Retry logic for API calls
    const transcription = await retryWithBackoff(
      async () => {
        const transcriptionOptions = {
          file: fileStream,
          model: 'whisper-1',
          response_format: responseFormat,
          language: language !== 'auto' ? language : undefined,
          temperature,
        };

        if (prompt) {
          transcriptionOptions.prompt = prompt;
        }

        return await openai.audio.transcriptions.create(transcriptionOptions);
      },
      {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        onRetry: (attempt, error) => {
          logger.warn('Transcript generation retry', {
            attempt,
            error: error.message,
            videoPath,
          });
        },
      }
    );

    // Cleanup extracted audio file if created
    if (shouldCleanupAudio && fs.existsSync(fileToTranscribe) && fileToTranscribe !== videoPath) {
      try {
        fs.unlinkSync(fileToTranscribe);
      } catch (cleanupError) {
        logger.warn('Failed to cleanup audio file', { error: cleanupError.message });
      }
    }

    const transcript = typeof transcription === 'string' ? transcription : transcription.text;
    logger.info('Transcript generated successfully', {
      videoPath,
      length: transcript.length,
      wordCount: transcript.split(/\s+/).length,
    });

    return transcript;
  } catch (error) {
    logger.error('Whisper transcription error', {
      error: error.message,
      videoPath,
      stack: error.stack,
    });

    captureException(error, {
      tags: { service: 'whisper', operation: 'transcription' },
      extra: { videoPath, options },
    });

    // Return null on error, caller can handle fallback
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




