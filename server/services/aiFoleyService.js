/**
 * aiFoleyService.js
 * Generative Auto-Sound Design using ElevenLabs Sound Effects API.
 * Detects visual keyframe velocity and dynamically generates text prompts to hit those cuts perfectly.
 */
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

let elevenlabsClient = null;

// Lazily construct the ElevenLabs client. The SDK is an OPTIONAL dependency —
// requiring it at module top-level crashed anything that imported this service
// when the package wasn't installed. Load on demand and degrade gracefully
// (return null → callers skip foley) when the key or package is missing.
function getClient() {
  if (elevenlabsClient) return elevenlabsClient;
  if (!process.env.ELEVENLABS_API_KEY) return null;
  try {
    const { ElevenLabsClient } = require('@elevenlabs/elevenlabs-js');
    elevenlabsClient = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
  } catch (err) {
    logger.warn('[Foley] ElevenLabs SDK not installed; foley generation unavailable.', { error: err.message });
    return null;
  }
  return elevenlabsClient;
}

/**
 * Determine the sound effect prompt based on video transition velocity
 */
function determineSFXPrompt(durationSeconds, transitionType = 'cut') {
  if (transitionType === 'zoom_in' || transitionType === 'scale_up') {
    if (durationSeconds < 0.5) return "Fast aggressive air whoosh, cinematic impact";
    return "Deep slow bass riser, building tension";
  }

  if (transitionType === 'slide') {
    return "Clean modern digital swipe, swift motion";
  }

  // Default cuts
  if (durationSeconds < 0.2) return "Sharp quick camera shutter click or subtle thud";
  return "Subtle air movement, low frequency rumble";
}

/**
 * Generates an SFX via ElevenLabs and returns the local file path
 */
async function generateFoley(durationSeconds, transitionType, videoId) {
  const client = getClient();
  if (!client) {
    logger.warn('[FoleyService] ElevenLabs API not configured, skipping generative SFX.');
    return null;
  }

  const prompt = determineSFXPrompt(durationSeconds, transitionType);
  logger.info(`[FoleyService] Requesting SFX: "${prompt}"`);

  try {
    const audioStream = await client.textToSoundEffects.convert({
      text: prompt,
      duration_seconds: Math.max(1, Math.ceil(durationSeconds)), // Minimum 1s
      prompt_influence: 0.8
    });

    // Write to local cache
    const targetDir = path.join(__dirname, '../../uploads/sfx');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Sanitize the client-supplied videoId before it becomes part of a filename:
    // an unsanitized value (e.g. "../../..") would let path.join escape uploads/sfx
    // and write the generated .mp3 outside the media dir. Restrict to a safe token.
    const safeVideoId = (String(videoId || 'anon').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)) || 'anon';
    const fileName = `foley_${safeVideoId}_${Date.now()}.mp3`;
    const filePath = path.join(targetDir, fileName);

    const fileStream = fs.createWriteStream(filePath);

    await new Promise((resolve, reject) => {
      audioStream.pipe(fileStream);
      audioStream.on('end', resolve);
      audioStream.on('error', reject);
    });

    return `/uploads/sfx/${fileName}`;

  } catch (err) {
    logger.error('[FoleyService] Error generating Foley:', err);
    return null; // Graceful degradation
  }
}

/**
 * Parses timeline JSON (mock or real) and aligns generated Foley to the cuts
 */
async function alignFoleyToTimeline(timelineClips, videoId) {
  if (!timelineClips || timelineClips.length === 0) return [];

  const foleyNodes = [];

  // We only generate SFX for transitions/cuts, not the actual clips themselves
  for (let i = 1; i < timelineClips.length; i++) {
    const nextClip = timelineClips[i];

    // Example: Only add Foley if the next clip is very short (fast paced) or has a specific transition
    if (nextClip.duration <= 3 || nextClip.type === 'b-roll' || nextClip.type === 'hook') {
      const duration = 1.0;
      const sfxUrl = await generateFoley(duration, 'cut', videoId);
      if (sfxUrl) {
        foleyNodes.push({
          type: 'sfx',
          url: sfxUrl,
          startTime: nextClip.startTime, // Start exactly at the cut
          volume: 0.8
        });
      }
    }
  }

  return foleyNodes;
}

/**
 * Analyze a timeline into discrete foley EVENTS — one per cut/transition where a
 * sound effect should land. Pure + deterministic (no provider calls) so
 * POST /api/dubbing/foley/analyze works even when no SFX provider is configured;
 * the returned events feed generateFoleyAudio().
 *
 * @param {Array} segments timeline clips: { startTime, duration, type }
 * @param {Array} effects  applied effects/transitions: string | { type, startTime }
 * @returns {Array} events: { index, startTime, durationSeconds, transitionType, prompt }
 */
function analyzeTimelineTransitions(segments = [], effects = []) {
  if (!Array.isArray(segments) || segments.length === 0) return [];

  // Normalize effects to { type, startTime } so we can match one to a cut.
  const norm = (Array.isArray(effects) ? effects : []).map((e) => {
    if (typeof e === 'string') return { type: e.toLowerCase(), startTime: null };
    return {
      type: String(e?.type || e?.name || 'cut').toLowerCase(),
      startTime: Number.isFinite(e?.startTime) ? e.startTime : null,
    };
  });

  const events = [];
  // A foley hit lands at each cut BETWEEN clips (start at i=1) — transitions, not
  // the clips themselves, matching alignFoleyToTimeline's rule.
  for (let i = 1; i < segments.length; i++) {
    const clip = segments[i] || {};
    const startTime = Number.isFinite(clip.startTime) ? clip.startTime : null;
    const durationSeconds = Math.min(6, Math.max(0.1, Number.isFinite(clip.duration) ? clip.duration : 1.0));

    // Transition type: an effect whose startTime is ~at this cut wins; else the
    // clip's own type hint (zoom/scale/slide); else a plain cut.
    let transitionType = 'cut';
    const nearby = startTime != null
      ? norm.find((e) => e.startTime != null && Math.abs(e.startTime - startTime) < 0.25)
      : null;
    if (nearby) transitionType = nearby.type;
    else if (clip.type && /zoom|scale|slide/i.test(clip.type)) transitionType = String(clip.type).toLowerCase();

    events.push({
      index: i,
      startTime,
      durationSeconds,
      transitionType,
      prompt: determineSFXPrompt(durationSeconds, transitionType),
    });
  }
  return events;
}

/**
 * Generate an SFX clip for each detected foley event via generateFoley(). Events
 * that can't be rendered (provider off / failure → null) are dropped, so an empty
 * result honestly means "no SFX produced" rather than a crash or a fake success.
 *
 * @param {Array} events   from analyzeTimelineTransitions()
 * @param {string} videoId owner-scoped id used only for the cached filename
 * @returns {Promise<Array>} audioSegments: { startTime, url, volume, transitionType }
 */
async function generateFoleyAudio(events = [], videoId = 'foley') {
  if (!Array.isArray(events) || events.length === 0) return [];
  const out = [];
  for (const ev of events) {
    const url = await generateFoley(
      Number.isFinite(ev?.durationSeconds) ? ev.durationSeconds : 1.0,
      ev?.transitionType || 'cut',
      videoId
    );
    if (url) {
      out.push({
        startTime: Number.isFinite(ev?.startTime) ? ev.startTime : 0,
        url,
        volume: 0.8,
        transitionType: ev?.transitionType || 'cut',
      });
    }
  }
  return out;
}

module.exports = {
  generateFoley,
  alignFoleyToTimeline,
  analyzeTimelineTransitions,
  generateFoleyAudio
};
