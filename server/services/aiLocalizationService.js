const logger = require('../utils/logger');

let elevenlabsClient = null;

/**
 * Lazily construct the ElevenLabs client. The SDK is an optional dependency —
 * requiring it at module top-level crashed anything that imported this service
 * when the package wasn't installed. We load it on demand and degrade
 * gracefully (return null → callers fall back to the honest not-implemented
 * path) when either the key or the package is missing.
 */
function getClient() {
  if (elevenlabsClient) return elevenlabsClient;
  if (!process.env.ELEVENLABS_API_KEY) return null;
  try {
    const { ElevenLabsClient } = require('@elevenlabs/elevenlabs-js');
    elevenlabsClient = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
  } catch (err) {
    logger.warn('[Localization] ElevenLabs SDK not installed; voice dub unavailable.', { error: err.message });
    return null;
  }
  return elevenlabsClient;
}

/**
 * Hyper-Native Localization Service
 * Handles voice cloning, dubbing, and visual lip-sync.
 */

/**
 * Simulates Stem Separation (Spleeter/Demucs)
 * In production, this would call a Python worker running spleeter.
 * This preserves original background music and sound effects while dubbing.
 */
async function separateStems(audioPath) {
  logger.info(`[Localization] Separating stems for ${audioPath}...`);
  return {
    vocalPath: audioPath.replace('.mp3', '_vocals.mp3'),
    bgmPath: audioPath.replace('.mp3', '_bgm.mp3'),
    sfxPath: audioPath.replace('.mp3', '_sfx.mp3')
  };
}

/**
 * Generates localized speech via ElevenLabs and saves it to /uploads/audio.
 * Real SDK call — returns a real, servable audio URL. Returns null (caller
 * degrades to not-implemented) when the key/SDK is unavailable.
 */
async function generateLocalizedAudio(text, sourceVoiceId, targetLanguage) {
  const client = getClient();
  if (!client) {
    logger.warn('[Localization] ElevenLabs API not configured.');
    return null;
  }

  const fs = require('fs');
  const path = require('path');
  const voiceId = sourceVoiceId || process.env.ELEVENLABS_DEFAULT_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb';

  logger.info(`[Localization] Generating ${targetLanguage} dub for text: "${text.substring(0, 30)}..."`);

  // eleven_multilingual_v2 renders the supplied (already-translated) text in
  // the cloned/selected voice. The SDK returns a byte stream we collect to a
  // buffer and persist.
  const audioStream = await client.textToSpeech.convert(voiceId, {
    text,
    modelId: 'eleven_multilingual_v2',
    outputFormat: 'mp3_44100_128',
  });

  const chunks = [];
  for await (const chunk of audioStream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const buffer = Buffer.concat(chunks);

  const outDir = path.join(__dirname, '..', '..', 'uploads', 'audio');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const filename = `dub_${Date.now()}_${String(targetLanguage || 'xx').toLowerCase()}.mp3`;
  fs.writeFileSync(path.join(outDir, filename), buffer);

  return `/uploads/audio/${filename}`;
}

/**
 * Orchestrates Visual Lip-Sync (SyncLabs/HeyGen API).
 */
async function synchronizeLipSync() {
  logger.info('[Localization] Requesting Visual Lip-Sync synchronization...');
  return {
    status: 'processing',
    jobId: `lip-sync-${Date.now()}`,
    estimatedTime: '120s'
  };
}

/**
 * Full Workflow: Localize Video.
 *
 * Real voice localization needs (1) an ElevenLabs key for voice cloning + TTS
 * and (2) a lip-sync provider (HeyGen/SyncLabs). Without an ElevenLabs key we
 * cannot produce real localized audio, so we return an honest not-implemented
 * response instead of a fake-success URL pointing at a file that never exists.
 */
async function localizeVideo(videoId, targetLanguage) {
  if (!process.env.ELEVENLABS_API_KEY) {
    return {
      success: false,
      notImplemented: true,
      language: targetLanguage,
      message: `Voice localization needs an ElevenLabs API key (voice cloning + ${targetLanguage} dub). Visual lip-sync is on the roadmap (HeyGen/SyncLabs).`,
    };
  }

  try {
    // 1. Pull the source transcript from the Content record.
    let sourceText = '';
    try {
      const Content = require('../models/Content');
      const content = await Content.findById(videoId).select('transcript title description').lean();
      sourceText =
        (typeof content?.transcript === 'string' ? content.transcript : content?.transcript?.text) ||
        content?.description ||
        content?.title ||
        '';
    } catch (e) {
      logger.warn('[Localization] transcript lookup failed', { videoId, error: e.message });
    }
    if (!sourceText) {
      return { success: false, error: 'No transcript available to localize. Transcribe the video first.' };
    }

    // 2. Translate to the target language (real — Gemini is configured).
    let translated = sourceText;
    try {
      const { generateContent, isConfigured } = require('../utils/googleAI');
      if (isConfigured) {
        translated = await generateContent(
          `Translate the following into ${targetLanguage}. Return ONLY the translated text, no preamble:\n\n${sourceText}`,
          { temperature: 0.2 }
        );
      }
    } catch (e) {
      logger.warn('[Localization] translation failed; dubbing source text as-is', { error: e.message });
    }

    // 3. Generate the localized voice dub (real ElevenLabs TTS).
    const audioUrl = await generateLocalizedAudio(String(translated).trim(), null, targetLanguage);
    if (!audioUrl) {
      return { success: false, error: 'ElevenLabs dub generation returned no audio' };
    }
    return {
      success: true,
      language: targetLanguage,
      vocalDub: audioUrl,
      status: 'audio_dub_ready',
      lipSync: 'roadmap', // visual lip-sync still requires a HeyGen/SyncLabs key
    };
  } catch (err) {
    logger.error('[Localization] Localization failed:', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  separateStems,
  generateLocalizedAudio,
  synchronizeLipSync,
  localizeVideo
};
