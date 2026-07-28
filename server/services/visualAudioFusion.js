// visualAudioFusion — honest stub.
//
// Committed BLANK (0 bytes) → callers hit "fuseVisualAudioBoundaries is not a
// function". Consumers are the UNMOUNTED scenes-visual-audio-fusion route,
// visualAudioFusionAdvanced, and multiModalSceneDetection — none request-reachable,
// and visualAudioFusionAdvanced already guards. Export the function surface with
// safe return shapes (empty decisions → downstream maps produce nothing) so nothing
// crashes. Real visual+audio boundary fusion is a future feature.

const logger = require('../utils/logger');

let warned = false;
function warnOnce(fn) {
  if (warned) return;
  warned = true;
  logger.warn(`[visualAudioFusion] not implemented — ${fn} returns empty. Fusion features are inert until this is built.`);
}

/**
 * @returns {{ decisions: [], sceneBoundaries: [], shotCuts: [], statistics: {} }}
 * decisions:[] means any downstream forEach/map yields nothing (safe no-op).
 */
function fuseVisualAudioBoundaries(_visualBoundaries, _audioFeatures, _options = {}) {
  warnOnce('fuseVisualAudioBoundaries');
  return { decisions: [], sceneBoundaries: [], shotCuts: [], statistics: {} };
}

/** Pass the visual boundaries through unchanged when audio refinement is unavailable. */
function refineSceneBoundariesWithAudio(visualBoundaries, _audioFeatures, _options = {}) {
  warnOnce('refineSceneBoundariesWithAudio');
  return Array.isArray(visualBoundaries) ? visualBoundaries : [];
}

/** @returns {{ distance: number, classChange: boolean, classChangeMagnitude: number }} */
function compareShotAudioFeatures(_prevEnd, _currStart, _audioFeatures, _window) {
  warnOnce('compareShotAudioFeatures');
  return { distance: 0, classChange: false, classChangeMagnitude: 0 };
}

module.exports = {
  fuseVisualAudioBoundaries,
  refineSceneBoundariesWithAudio,
  compareShotAudioFeatures,
};
