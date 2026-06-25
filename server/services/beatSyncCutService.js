// Beat-synced cuts — turn detected audio beats into a cut/segment plan so edits
// land ON the beat (the music-video / montage feel). The planner is a PURE,
// unit-tested core; the orchestrator reuses the existing ebur128 beat detector.

const logger = require('../utils/logger');

/**
 * PURE: turn beat timestamps into a segment plan whose cuts land on beats.
 *   beats: sorted seconds[]   options: { duration, minClip, maxClip, everyNthBeat }
 * → { segments:[{start,end,durationSec}], cutPoints:[s], count, reason? }
 * Rules: cut on every Nth beat once a clip is at least minClip long, and force a
 * cut if a clip would exceed maxClip — so clips stay punchy but never too long.
 */
function buildBeatCutPlan(beats = [], options = {}) {
  const duration = Number(options.duration) || 0;
  const minClip = Math.max(0.2, Number(options.minClip) || 0.6);
  const maxClip = Math.max(minClip, Number(options.maxClip) || 4);
  const everyNth = Math.max(1, Math.floor(Number(options.everyNthBeat) || 2));

  const bts = (Array.isArray(beats) ? beats : [])
    .map(Number)
    .filter((t) => Number.isFinite(t) && t > 0)
    .sort((a, b) => a - b);
  if (!bts.length) return { segments: [], cutPoints: [], count: 0, reason: 'no_beats' };

  const cuts = [0];
  let lastCut = 0;
  let beatCounter = 0;
  for (const t of bts) {
    if (duration && t >= duration) break;
    beatCounter += 1;
    const sinceCut = t - lastCut;
    if (sinceCut >= maxClip || (beatCounter % everyNth === 0 && sinceCut >= minClip)) {
      cuts.push(Math.round(t * 1000) / 1000);
      lastCut = t;
      beatCounter = 0;
    }
  }

  const end = duration || (bts[bts.length - 1] + minClip);
  if (cuts[cuts.length - 1] < end - 0.05) cuts.push(Math.round(end * 1000) / 1000);

  const segments = [];
  for (let i = 1; i < cuts.length; i++) {
    const s = cuts[i - 1];
    const e = cuts[i];
    if (e > s) segments.push({ start: s, end: e, durationSec: Math.round((e - s) * 1000) / 1000 });
  }
  return { segments, cutPoints: cuts.slice(1, -1), count: segments.length };
}

/**
 * Orchestrator: detect beats in a local media file, then build the cut plan.
 * `detectImpl` is injectable for tests; defaults to the ebur128 beat detector.
 */
async function generateBeatCuts(inputPath, options = {}) {
  if (!inputPath) return { segments: [], cutPoints: [], count: 0, available: false, reason: 'no_input' };
  const detect = options.detectImpl || require('./aiVideoEditingService').detectBeats;
  let beats = [];
  try {
    beats = await detect(inputPath);
  } catch (err) {
    logger.warn('[beatSync] beat detection failed', { error: err.message });
    return { segments: [], cutPoints: [], count: 0, available: false, reason: 'detect_failed' };
  }
  const plan = buildBeatCutPlan(beats, options);
  let segments = plan.segments;
  // Optionally drop an animated transition on every cut (montage feel).
  if (options.transition) {
    const { applyTransitionToSegments } = require('./transitionPresetService');
    segments = applyTransitionToSegments(segments, options.transition, { duration: options.transitionDuration });
  }
  return { ...plan, segments, available: plan.count > 0, beatCount: Array.isArray(beats) ? beats.length : 0 };
}

module.exports = { buildBeatCutPlan, generateBeatCuts };
