// Batch auto-clip generation (the Opus Clip / Klap core). Turns one long-form
// video into a RANKED gallery of short clips: detectKeyMoments → buildClipPlan
// (virality ranking) → clip cards with score + hook + "why viral" reasoning.
// The heavy per-clip render reuses the existing render/export pipeline on demand
// (each clip card carries its start/end window); this service produces the plan.

const aiEditing = require('./aiVideoEditingService');
const Content = require('../models/Content');
const logger = require('../utils/logger');

/**
 * @param {string} videoId
 * @param {{ maxClips?:number, minLen?:number, maxLen?:number, userId?:string,
 *           platform?:string, niche?:string, duration?:number }} options
 * @returns {Promise<{clips:Array, total:number, hookScore:number|null, ...}>}
 */
async function generateAutoClips(videoId, options = {}) {
  const { maxClips = 10, minLen = 5, maxLen = 90, userId = null, platform = null, niche = null } = options;

  const content = await Content.findById(videoId);
  if (!content) {
    const e = new Error('Content not found');
    e.statusCode = 404;
    throw e;
  }
  // Ownership: a videoId must belong to the caller (defense in depth — the route
  // also guards, but never trust a bare findById).
  if (userId && content.userId && String(content.userId) !== String(userId)) {
    const e = new Error('Content not found');
    e.statusCode = 404;
    throw e;
  }

  const transcript = String(content.transcript || '').trim()
    || (Array.isArray(content.captions) ? content.captions.map((c) => c && c.text).filter(Boolean).join(' ') : '');
  const duration = Number(content.duration)
    || Number(content.metadata && content.metadata.duration)
    || Number(options.duration) || 0;

  if (!transcript) {
    return { clips: [], total: 0, hookScore: null, message: 'No transcript available — transcribe the video first.' };
  }

  let moments = {};
  try {
    moments = await aiEditing.detectKeyMoments(
      transcript, duration, [], null, null, null, platform, niche, userId,
    ) || {};
  } catch (err) {
    logger.warn('[auto-clip] detectKeyMoments failed; ranking on whatever moments returned', { error: err.message, videoId });
  }

  const clips = aiEditing.buildClipPlan(moments, { duration, maxClips, minLen, maxLen });

  return {
    clips,
    total: clips.length,
    hookScore: (moments.geminiInsights && Number(moments.geminiInsights.hookScore)) || null,
    narrativeStructure: moments.narrativeStructure || null,
    niche: moments.niche || niche || null,
    topPlatform: moments.topPlatform || null,
  };
}

module.exports = { generateAutoClips };
