const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');
const { transcribeAudio: geminiTranscribe, isConfigured: geminiConfigured } = require('../utils/googleAI');

// Click is configured for Gemini-only AI. This service used to call OpenAI
// Whisper for transcription with word-level timestamps. Gemini's audio
// understanding returns plain text without word-level timestamps, so we now
// approximate per-word timestamps by even time-distribution across the
// estimated duration. Callers that need true word-level timing should ingest
// the audio in their own pipeline; the enrichment below is best-effort.

function isTranscriptionConfigured() {
  return !!geminiConfigured;
}

function getAudioDurationSec(filePath) {
  try {
    const ffmpeg = require('fluent-ffmpeg');
    return new Promise((resolve) => {
      ffmpeg.ffprobe(filePath, (err, data) => {
        if (err || !data?.format?.duration) return resolve(null);
        resolve(Number(data.format.duration));
      });
    });
  } catch (_) {
    return Promise.resolve(null);
  }
}

async function transcribeVideo(userId, videoId, videoPath) {
  try {
    if (!geminiConfigured) {
      throw new Error('Gemini API key not configured. Set GOOGLE_AI_API_KEY in your environment to enable transcription.');
    }

    const fullPath = videoPath.startsWith('/')
      ? videoPath
      : path.join(__dirname, '../..', videoPath);

    if (!fs.existsSync(fullPath)) throw new Error('Video file not found for transcription: ' + fullPath);

    logger.info('Starting Gemini transcription', { videoId, userId });

    const text = await geminiTranscribe(fullPath, { language: 'en' });
    if (!text) {
      return { success: false, text: '', words: [], error: 'Empty transcript from Gemini' };
    }

    const words = text.split(/\s+/).filter(Boolean);
    const duration = await getAudioDurationSec(fullPath);
    const perWordSec = duration && words.length > 0 ? duration / words.length : 0.4;

    const enrichedWords = words.map((w, i) => {
      const lower = w.toLowerCase().replace(/[^a-z0-9']/g, '');
      let sentiment = 'neutral';
      let volume = 50;

      if (['amazing', 'wow', 'incredible', 'best'].includes(lower)) {
        sentiment = 'positive'; volume = 90;
      } else if (['terrible', 'worst', 'angry', 'stop'].includes(lower)) {
        sentiment = 'negative'; volume = 85;
      } else if (w === w.toUpperCase() && w.length > 1 && /[A-Z]/.test(w)) {
        volume = 95;
      }

      return {
        word: w,
        start: i * perWordSec,
        end: (i + 1) * perWordSec,
        sentiment,
        volume,
      };
    });

    return {
      success: true,
      text,
      words: enrichedWords,
      wordTimingsApproximate: true,
    };
  } catch (error) {
    logger.error('Transcription error', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  transcribeVideo,
  isTranscriptionConfigured,
};
