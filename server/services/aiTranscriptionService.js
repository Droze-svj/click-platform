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
 * Generate Transcription for a video file
 */
async function transcribeVideo(userId, videoId, videoPath) {
  try {
    const client = getOpenAIClient();
    if (!client) {
      throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY in your environment to enable transcription.');
    }

    const fullPath = videoPath.startsWith('/')
      ? videoPath
      : path.join(__dirname, '../..', videoPath);

    if (!fs.existsSync(fullPath)) throw new Error('Video file not found for transcription: ' + fullPath);

    logger.info('Starting transcription', { videoId, userId });

    const transcription = await client.audio.transcriptions.create({
      file: fs.createReadStream(fullPath),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word']
    });

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
      words: enrichedWords
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
