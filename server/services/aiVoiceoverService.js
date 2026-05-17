const { OpenAI } = require('openai');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');
const { uploadFile } = require('./storageService');

let openai = null;

function getOpenAIClient() {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

/**
 * Generate AI Voiceover from text
 */
// Lazy ElevenLabs init — only attempt when an API key is configured.
// We prefer ElevenLabs for voice CLONING (custom voices the user trained);
// OpenAI TTS-1 is the fallback for stock voices because it ships native
// in our existing OpenAI client and produces excellent quality without
// the extra round-trip / billing relationship.
let elevenLabs = null;
function getElevenLabsClient() {
  if (elevenLabs || !process.env.ELEVENLABS_API_KEY) return elevenLabs;
  try {
    // Optional dep — installed when teams enable cloned voices.
    const { ElevenLabsClient } = require('elevenlabs');
    elevenLabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
  } catch (err) {
    logger.warn('ElevenLabs SDK not available; using OpenAI TTS fallback', { error: err.message });
    elevenLabs = null;
  }
  return elevenLabs;
}

/**
 * Generate AI Voiceover from text.
 *
 * Provider selection:
 *   1. If options.voiceId is set AND ElevenLabs is configured → ElevenLabs
 *      (this is the cloning path — `voiceId` is the trained voice id)
 *   2. Otherwise OpenAI TTS-1 (default) or TTS-1-HD (when options.hd=true)
 *      with one of the six stock voices.
 *
 * Always returns the same shape: { success, url, voice, text, provider }.
 */
async function generateVoiceover(userId, text, options = {}) {
  try {
    const {
      voice = 'alloy',         // OpenAI stock voice
      voiceId = null,          // ElevenLabs cloned voice id
      speed = 1.0,
      hd = false,              // upgrade to tts-1-hd
      projectId,
    } = options;

    if (!text || !text.trim()) throw new Error('Text is required for voiceover');

    const outputFilename = `tts-${userId}-${Date.now()}.mp3`;
    const outputPath = path.join(__dirname, '../../uploads/audio', outputFilename);
    if (!fs.existsSync(path.dirname(outputPath))) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    }

    // ElevenLabs path — cloned voices only.
    const eleven = voiceId ? getElevenLabsClient() : null;
    if (eleven && voiceId) {
      try {
        const stream = await eleven.textToSpeech.convert(voiceId, {
          text,
          model_id: 'eleven_multilingual_v2',
        });
        const chunks = [];
        for await (const c of stream) chunks.push(c);
        await fs.promises.writeFile(outputPath, Buffer.concat(chunks));
        const uploadResult = await uploadFile(outputPath, `audio/${outputFilename}`, 'audio/mpeg', { userId, projectId, type: 'voiceover' });
        logger.info('ElevenLabs voiceover generated', { userId, voiceId, chars: text.length });
        return { success: true, url: uploadResult.url, voice: voiceId, text, provider: 'elevenlabs' };
      } catch (elErr) {
        logger.warn('ElevenLabs synthesis failed; falling back to OpenAI TTS', { userId, error: elErr.message });
        // fall through to OpenAI path
      }
    }

    // OpenAI TTS fallback / default.
    const client = getOpenAIClient();
    if (!client) throw new Error('No TTS provider configured. Set OPENAI_API_KEY or ELEVENLABS_API_KEY.');

    const ttsResponse = await client.audio.speech.create({
      model: hd ? 'tts-1-hd' : 'tts-1',
      voice,
      input: text,
      speed,
    });

    const buffer = Buffer.from(await ttsResponse.arrayBuffer());
    await fs.promises.writeFile(outputPath, buffer);

    const uploadResult = await uploadFile(outputPath, `audio/${outputFilename}`, 'audio/mpeg', { userId, projectId, type: 'voiceover' });

    logger.info('OpenAI voiceover generated', { userId, voice, model: hd ? 'tts-1-hd' : 'tts-1', chars: text.length });

    return { success: true, url: uploadResult.url, voice, text, provider: 'openai' };
  } catch (error) {
    logger.error('Voiceover generation error', { error: error.message, userId });
    throw error;
  }
}

/**
 * List available voices across all configured providers. Lets the UI
 * present a unified voice picker with stock + cloned voices together.
 */
async function listVoices() {
  const voices = [];
  // OpenAI's six stock voices are static — no API call needed.
  if (process.env.OPENAI_API_KEY) {
    ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].forEach((v) => {
      voices.push({ id: v, name: v.charAt(0).toUpperCase() + v.slice(1), provider: 'openai', cloned: false });
    });
  }
  // ElevenLabs catalog (only when configured).
  const eleven = getElevenLabsClient();
  if (eleven) {
    try {
      const list = await eleven.voices.getAll();
      for (const v of (list?.voices || [])) {
        voices.push({
          id: v.voice_id,
          name: v.name,
          provider: 'elevenlabs',
          cloned: v.category === 'cloned',
          previewUrl: v.preview_url || null,
        });
      }
    } catch (err) {
      logger.warn('ElevenLabs voices.getAll failed', { error: err.message });
    }
  }
  return voices;
}

module.exports = {
  generateVoiceover,
  listVoices,
};
