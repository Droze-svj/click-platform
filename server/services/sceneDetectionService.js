// sceneDetectionService — the scene-detection entry point used by the workflow
// and automation layers.
//
// This is a thin, stable facade over multiModalSceneDetection, which holds the
// real ffmpeg implementation (visual shot-boundary detection via
// `select='gt(scene,N)'`, audio change points, text segmentation, and
// visual/audio fusion). This module exists so callers have one small surface —
// "give me the scenes for this asset" — that doesn't change when the detector's
// internals do.
//
// History: committed BLANK (0 bytes), then as an honest empty stub that always
// returned `{ scenes: [] }`. The real detector was in the tree the whole time;
// it simply was never wired to this facade.

const logger = require('../utils/logger');
const { toAbsolutePath } = require('../utils/pathUtils');

/**
 * Normalize a detector scene into the shape consumers index by.
 * createClipsFromScenes reads sceneIndex/start/end, so guarantee those.
 */
function normalizeScene(scene, index) {
  const start = Number(scene?.start) || 0;
  const end = Number(scene?.end) || 0;
  return {
    sceneIndex: index,
    start,
    end,
    duration: Math.max(0, end - start),
    confidence: Number.isFinite(scene?.confidence) ? scene.confidence : 0.5,
    sources: Array.isArray(scene?.sources) ? scene.sources : [],
  };
}

/**
 * Detect scenes in a video.
 *
 * @param {string} videoPath absolute path, or a "/uploads/..." reference
 * @param {object} options forwarded to detectScenesMultiModal (fps, sensitivity,
 *                 minSceneLength, workflowType, ...)
 * @returns {Promise<{scenes: Array, error?: string}>}
 */
async function detectScenes(videoPath, options = {}) {
  if (!videoPath) {
    logger.warn('[sceneDetectionService] detectScenes called without a video path');
    return { scenes: [] };
  }

  // Accept either a real filesystem path or an uploads-relative URL.
  const resolved = toAbsolutePath(videoPath) || videoPath;

  try {
    const { detectScenesMultiModal } = require('./multiModalSceneDetection');
    const detected = await detectScenesMultiModal(resolved, options);
    const scenes = (Array.isArray(detected) ? detected : []).map(normalizeScene);
    logger.info('[sceneDetectionService] scenes detected', { videoPath: resolved, count: scenes.length });
    return { scenes };
  } catch (error) {
    // Detection needs a real ffmpeg and a readable file; when either is missing
    // this must degrade rather than take down the workflow that called it.
    logger.warn('[sceneDetectionService] detection failed — returning no scenes', {
      videoPath: resolved,
      error: error.message,
    });
    return { scenes: [], error: error.message };
  }
}

/**
 * The on-disk path of a Content's source video, or null when it can't be
 * resolved. Callers (e.g. sceneWorkflowService) fall back to downloading the
 * remote URL themselves on null.
 *
 * @param {string} contentId
 * @returns {Promise<string|null>}
 */
async function getVideoFilePath(contentId) {
  if (!contentId) return null;
  try {
    const Content = require('../models/Content');
    const content = await Content.findById(contentId).select('originalFile').lean();
    const url = content?.originalFile?.url;
    if (!url) return null;

    // toAbsolutePath contains the result to <root>/uploads and strips any signed
    // ?exp/&sig suffix; it returns null for a remote (http) URL, which correctly
    // sends the caller down its own download path.
    return toAbsolutePath(url);
  } catch (error) {
    logger.warn('[sceneDetectionService] could not resolve video path', { contentId, error: error.message });
    return null;
  }
}

/**
 * Scenes for a stored asset.
 *
 * @param {string} contentId
 * @param {object} options forwarded to detectScenes
 * @returns {Promise<{scenes: Array, error?: string}>}
 */
async function getScenesForAsset(contentId, options = {}) {
  const videoPath = await getVideoFilePath(contentId);
  if (!videoPath) {
    logger.warn('[sceneDetectionService] no local video file for asset', { contentId });
    return { scenes: [] };
  }
  return detectScenes(videoPath, options);
}

module.exports = { detectScenes, getScenesForAsset, getVideoFilePath };
