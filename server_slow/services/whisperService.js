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
  const { v4: uuidv4 } = require('uuid');
  
  // Use a unique ID to prevent collisions during parallel processing
  const tempAudioPath = path.join(path.dirname(videoPath), `audio-${uuidv4()}.mp3`);

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .toFormat('mp3')
      .audioCodec('libmp3lame')
      .audioBitrate(64) // 64k is enough for speech and significantly smaller for 25MB limit
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
    responseFormat = 'verbose_json', // Default to 2026 ultra-precise format
    temperature = 0.1, // Slight temp for better contextual reasoning
    prompt = null, // Optional prompt to guide the model
    useAudioExtraction = false, // Extract audio first for better results
  } = options;

  try {
    // Check if file exists
    if (!fs.existsSync(videoPath)) {
      throw new Error('Video file not found');
    }

    // Check file size and enforce 25MB OpenAI limit
    let fileToTranscribe = videoPath;
    let fileSize = fs.statSync(videoPath).size;
    let shouldCleanupAudio = false;

    // Use audio extraction if file is too large or requested
    if (useAudioExtraction || fileSize > 24 * 1024 * 1024) {
      try {
        fileToTranscribe = await extractAudioFromVideo(videoPath);
        fileSize = fs.statSync(fileToTranscribe).size;
        shouldCleanupAudio = true;
        logger.info('Using compressed audio for Whisper ingress', { 
          videoPath, 
          audioPath: fileToTranscribe,
          sizeMb: (fileSize / 1024 / 1024).toFixed(2)
        });
        
        if (fileSize > 25 * 1024 * 1024) {
          throw new Error(`Compressed audio file (${(fileSize / 1024 / 1024).toFixed(2)}MB) still exceeds OpenAI's 25MB limit.`);
        }
      } catch (extractError) {
        if (extractError.message.includes('limit')) throw extractError;
        logger.warn('Audio extraction failed, using video directly', { error: extractError.message });
      }
    }

    // Create a readable stream from the file
    const fileStream = fs.createReadStream(fileToTranscribe);

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

        // Request ultra-precise word-level tracking if using verbose_json
        if (responseFormat === 'verbose_json') {
          transcriptionOptions.timestamp_granularities = ['word', 'segment'];
        }

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

    // If we requested verbose_json, return the rich object directly instead of flattening to text.
    // This enables Word-Level Kinetic Typography downstream.
    const transcript = responseFormat === 'verbose_json' ? transcription : (typeof transcription === 'string' ? transcription : transcription.text);
    const textContent = typeof transcript === 'string' ? transcript : (transcript.text || '');
    
    logger.info('Transcript generated successfully', {
      videoPath,
      length: textContent.length,
      wordCount: textContent.split(/\s+/).length,
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




