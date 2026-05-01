const { OpenAI } = require('openai');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');

let openai = null;

function getOpenAIClient() {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

/**
 * Check if transcription (Whisper) is available.
 * Requires OPENAI_API_KEY to be set.
 */
function isTranscriptionConfigured() {
  const key = process.env.OPENAI_API_KEY;
  return !!(typeof key === 'string' && key.trim().length > 0);
}

/**
 * Generate Transcription for a video file.
 *
 * @param {string} userId
 * @param {string} videoId
 * @param {string} videoPath
 * @param {object} [opts]
 * @param {string} [opts.language='auto']  — ISO 639-1 code or 'auto'
 *   to let Whisper detect. 'auto' is the historical behavior; passing
 *   'es' / 'fr' etc. constrains transcription to that language so a
 *   Spanish video doesn't come back partially in English when the
 *   audio is unclear or has English loanwords.
 * @param {string} [opts.prompt]  — Whisper vocab-priming hint; useful
 *   for niche jargon ("Bitcoin, halving, mempool") so Whisper biases
 *   uncertain words toward the creator's domain.
 */
async function transcribeVideo(userId, videoId, videoPath, opts = {}) {
  try {
    const client = getOpenAIClient();
    if (!client) {
      throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY in your environment to enable transcription.');
    }

    const fullPath = videoPath.startsWith('/')
      ? videoPath
      : path.join(__dirname, '../..', videoPath);

    if (!fs.existsSync(fullPath)) throw new Error('Video file not found for transcription: ' + fullPath);

    const language = opts.language || 'auto';
    logger.info('Starting transcription', { videoId, userId, language, hasPrompt: !!opts.prompt });

    const params = {
      file: fs.createReadStream(fullPath),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word'],
    };
    // Whisper auto-detects when `language` is omitted; only attach an
    // explicit code when the caller picked one.
    if (language && language !== 'auto') params.language = language;
    if (opts.prompt) params.prompt = opts.prompt;

    const transcription = await client.audio.transcriptions.create(params);

    // Task 3.3 Semantic analysis mock
    // In a true environment, we'd pass `transcription.text` to an LLM or use audio loudness metrics
    // Here we simulate attaching "loudness" and "sentiment" to each word for the UI to interpret
    const enrichedWords = (transcription.words || []).map(wordObj => {
      const lowerWord = wordObj.word.toLowerCase();
      let sentiment = 'neutral';
      let volume = 50; // out of 100

      // Simple heuristic for Emotion-Synced Semantic Captions (Task 3.3)
      if (['amazing', 'wow', 'incredible', 'best'].includes(lowerWord)) {
        sentiment = 'positive';
        volume = 90;
      } else if (['terrible', 'worst', 'angry', 'stop'].includes(lowerWord)) {
        sentiment = 'negative';
        volume = 85;
      } else if (wordObj.word === wordObj.word.toUpperCase() && wordObj.word.length > 1) {
        // ALL CAPS inferred as shouting/emphasis
        volume = 95;
      }

      return {
        ...wordObj,
        sentiment,
        volume
      };
    });

    return {
      success: true,
      text: transcription.text,
      words: enrichedWords,
      // Whisper returns `language` in verbose_json — surface it so the
      // caller can persist `content.language` even when the user didn't
      // pre-select one (e.g. uploads where opts.language was 'auto').
      language: transcription.language || language || 'en',
    };
  } catch (error) {
    logger.error('Transcription error', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  transcribeVideo,
  isTranscriptionConfigured
};
