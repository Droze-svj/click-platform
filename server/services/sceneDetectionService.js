// sceneDetectionService — honest stub.
//
// This module was committed BLANK (0 bytes), so every `require` of it returned
// {} and callers hit "detectScenes is not a function". Its only consumers are the
// UNMOUNTED `routes/video/scenes*` family and a few orphan services — none is
// request-reachable, and the reachable ones (automationService, sceneWorkflowService)
// already guard the call. Rather than leave a blank file (which reads as broken and
// re-breaks anything that forgets to guard), we export the real function surface
// returning honest EMPTY results + a one-time warning. Real FFmpeg-based scene
// detection is a future feature; until then this degrades instead of crashing.

const logger = require('../utils/logger');

let warned = false;
function warnOnce(fn) {
  if (warned) return;
  warned = true;
  logger.warn(`[sceneDetectionService] not implemented — ${fn} returns empty. Scene-based features are inert until this is built.`);
}

/** @returns {Promise<{ scenes: [] }>} */
async function detectScenes(_videoIdOrPath, _options = {}) {
  warnOnce('detectScenes');
  return { scenes: [] };
}

/** @returns {Promise<{ scenes: [] }>} */
async function getScenesForAsset(_contentId) {
  warnOnce('getScenesForAsset');
  return { scenes: [] };
}

/** @returns {Promise<string|null>} caller falls back to its own download path on null */
async function getVideoFilePath(_contentId) {
  warnOnce('getVideoFilePath');
  return null;
}

module.exports = { detectScenes, getScenesForAsset, getVideoFilePath };
