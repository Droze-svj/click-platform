const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');
const { uploadFile } = require('./storageService');

// Click is configured for Gemini-only AI. The Gemini API does not currently
// expose a text-to-speech endpoint comparable to OpenAI's tts-1, so AI
// voiceover generation is intentionally disabled. Callers receive a clear
// error instead of a silent failure or fake audio file. To re-enable voice
// generation, wire up Google Cloud Text-to-Speech (a separate service from
// the Gemini API) and replace the body of generateVoiceover().

function getOpenAIClient() {
  return null;
}

/**
 * Generate AI Voiceover from text
 */
async function generateVoiceover(userId, text, options = {}) {
  try {
    const {
      voice = 'alloy', // alloy, echo, fable, onyx, nova, shimmer
      speed = 1.0,
      projectId
    } = options;

    const client = getOpenAIClient();
    if (!client) {
      throw new Error('AI voiceover is unavailable: Click is configured for Gemini-only AI and Gemini does not expose a text-to-speech API. Wire up Google Cloud Text-to-Speech to enable this feature.');
    }

    const outputFilename = `tts-${userId}-${Date.now()}.mp3`;
    const outputPath = path.join(__dirname, '../../uploads/audio', outputFilename);

    if (!fs.existsSync(path.dirname(outputPath))) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    }

    const ttsResponse = await client.audio.speech.create({
      model: 'tts-1',
      voice: voice,
      input: text,
      speed: speed
    });

    const buffer = Buffer.from(await ttsResponse.arrayBuffer());
    await fs.promises.writeFile(outputPath, buffer);

    const uploadResult = await uploadFile(outputPath, `audio/${outputFilename}`, 'audio/mpeg', {
      userId,
      projectId,
      type: 'voiceover'
    });

    logger.info('AI Voiceover generated', { userId, voice, duration: text.length });

    return {
      success: true,
      url: uploadResult.url,
      voice: voice,
      text: text
    };
  } catch (error) {
    logger.error('Voiceover generation error', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  generateVoiceover
};
