/**
 * generationService — one façade over the platform's asset generators
 * (voiceover, sound-effects, image) for the editor's unified "Generate" panel.
 *
 * Every method returns the SAME honest shape and NEVER throws to the caller:
 *   { ok:true,  asset:{ type, url, title, duration?, prompt? } }
 *   { ok:false, unavailable:true, error }   // provider/key not configured
 *   { ok:false, error }                     // a real generation failure
 *
 * Reuse, not reinvent: voiceover → aiVoiceoverService, sfx → aiFoleyService,
 * image → imageGenerationService. Music keeps its existing async job flow at
 * /api/ai-music/* and is surfaced here only as an informational capability.
 */

'use strict';

const aiVoiceover = require('./aiVoiceoverService');
const aiFoley = require('./aiFoleyService');
const imageGen = require('./imageGenerationService');
const personalizationService = require('./personalizationService');
const logger = require('../utils/logger');

const voiceConfigured = () => !!process.env.OPENAI_API_KEY || !!process.env.ELEVENLABS_API_KEY;
const sfxConfigured = () => !!process.env.ELEVENLABS_API_KEY;

// Map the creator's saved voice tone → an OpenAI stock voice, used only as a
// DEFAULT when the request doesn't name an explicit voice/voiceId.
const TONE_VOICE_DEFAULTS = {
  hype: 'nova', calm: 'shimmer', professional: 'onyx', friendly: 'alloy',
  authoritative: 'echo', warm: 'fable', bold: 'onyx', energetic: 'nova',
};

// Friendly SFX style → the foley engine's transition type.
const SFX_STYLE_MAP = { whoosh: 'zoom_in', riser: 'scale_up', swipe: 'slide', impact: 'cut' };
const SFX_STYLES = Object.keys(SFX_STYLE_MAP);

/** What can be generated right now, given configured provider keys. */
function getCapabilities() {
  return {
    voiceover: voiceConfigured(),
    sfx: sfxConfigured(),
    image: imageGen.isConfigured(),
    // Music has its own async pipeline; report a pointer, not a live flag.
    music: { available: false, endpoint: '/api/ai-music/generate', note: 'Configure a music provider (Mubert/Soundraw) to enable.' },
    sfxStyles: SFX_STYLES,
  };
}

async function generateVoiceover({ userId, text, voice, voiceId, speed }) {
  if (!text || typeof text !== 'string' || !text.trim()) return { ok: false, error: 'Text is required' };
  if (!voiceConfigured()) {
    return { ok: false, unavailable: true, error: 'Voiceover needs OPENAI_API_KEY or ELEVENLABS_API_KEY configured' };
  }
  // Personalize the default voice from the creator's saved tone (only when the
  // request didn't specify a voice). Best-effort.
  let resolvedVoice = voice;
  if (!voice && !voiceId) {
    try {
      const persona = await personalizationService.getPersona(userId, {});
      const toneKey = String(persona?.voice?.tone || '').toLowerCase().split(/\s+/)[0];
      if (TONE_VOICE_DEFAULTS[toneKey]) resolvedVoice = TONE_VOICE_DEFAULTS[toneKey];
    } catch (_) { /* best-effort */ }
  }
  try {
    const r = await aiVoiceover.generateVoiceover(userId, text.slice(0, 3000), { voice: resolvedVoice, voiceId, speed });
    if (r && r.success && r.url) {
      return { ok: true, asset: { type: 'voiceover', url: r.url, title: `Voiceover (${r.provider || 'tts'})`, prompt: text.slice(0, 120) } };
    }
    return { ok: false, error: 'Voiceover produced no audio' };
  } catch (e) {
    logger.warn('[generation] voiceover failed', { error: e.message });
    return { ok: false, error: e.message || 'Voiceover failed' };
  }
}

async function generateSfx({ style, durationSeconds, videoId }) {
  if (!sfxConfigured()) {
    return { ok: false, unavailable: true, error: 'Sound effects need ELEVENLABS_API_KEY configured' };
  }
  const transitionType = SFX_STYLE_MAP[style] || 'cut';
  const dur = Number.isFinite(durationSeconds) ? Math.max(1, Math.min(30, durationSeconds)) : 2;
  try {
    const url = await aiFoley.generateFoley(dur, transitionType, videoId || 'generate');
    if (url) return { ok: true, asset: { type: 'sfx', url, title: `SFX (${style || 'impact'})`, duration: dur } };
    return { ok: false, error: 'Sound effect generation returned nothing' };
  } catch (e) {
    logger.warn('[generation] sfx failed', { error: e.message });
    return { ok: false, error: e.message || 'Sound effect generation failed' };
  }
}

async function generateImage({ userId, prompt, aspectRatio }) {
  // Personalize: weave the creator's brand palette + learned colour grade into
  // the prompt so generated images match their look. Best-effort, façade-level
  // (keeps imageGenerationService provider-agnostic).
  let finalPrompt = prompt;
  try {
    const persona = await personalizationService.getPersona(userId, {});
    const bits = [];
    if (persona?.brand?.colors?.primary) bits.push(`brand color ${persona.brand.colors.primary}`);
    if (persona?.brand?.colors?.accent) bits.push(`accent ${persona.brand.colors.accent}`);
    if (persona?.brand?.colorGrade) bits.push(`${persona.brand.colorGrade} color grade`);
    if (bits.length && prompt) finalPrompt = `${prompt}. Style: ${bits.join(', ')}.`;
  } catch (_) { /* best-effort personalization */ }

  const r = await imageGen.generateImage(finalPrompt, { aspectRatio });
  if (r.ok) {
    return { ok: true, asset: { type: 'image', url: r.url, title: `Image: ${String(prompt || '').slice(0, 40)}`, prompt: String(prompt || '').slice(0, 120) } };
  }
  return { ok: false, unavailable: !!r.unavailable, error: r.error };
}

/** Dispatch by kind. Returns the same {ok,asset,unavailable,error} shape. */
async function generate(kind, params = {}) {
  switch (kind) {
  case 'voiceover': return generateVoiceover(params);
  case 'sfx': return generateSfx(params);
  case 'image': return generateImage(params);
  default: return { ok: false, error: `Unknown generation kind "${kind}"` };
  }
}

module.exports = {
  getCapabilities,
  generate,
  generateVoiceover,
  generateSfx,
  generateImage,
  SFX_STYLES,
};
