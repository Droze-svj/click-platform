// AI Video Editing Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  analyzeVideoForEditing,
  autoEditVideo,
  detectScenes,
  detectSmartCuts,
  getEditPreset,
  listEditPresets,
  applyPresetToOptions,
  generateEditPreview,
  createComparisonVideo,
  saveEditVersion,
  restoreEditVersion,
  batchAutoEdit,
  getEditPerformanceAnalytics,
  exportMultipleFormats,
} = require('../../services/aiVideoEditingService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/video/ai-editing/analyze:
 *   post:
 *     summary: Analyze video for editing
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/analyze', auth, asyncHandler(async (req, res) => {
  const { videoMetadata } = req.body;

  if (!videoMetadata) {
    return sendError(res, 'Video metadata is required', 400);
  }

  try {
    const analysis = await analyzeVideoForEditing(videoMetadata);
    sendSuccess(res, 'Video analyzed for editing', 200, analysis);
  } catch (error) {
    logger.error('Analyze video for editing error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/ai-editing/auto-edit:
 *   post:
 *     summary: Auto-edit video
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/auto-edit', auth, asyncHandler(async (req, res) => {
  const { videoId, editingOptions } = req.body;
  const userId = req.user?.id || req.user?._id;

  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }

  try {
    logger.info('Starting auto-edit video processing', { videoId, userId });
    
    // This function AUTOMATICALLY applies all edits and saves the edited video
    // Pass userId for real-time progress updates via WebSocket
    const result = await autoEditVideo(videoId, editingOptions || {}, userId);
    
    if (result.success) {
      logger.info('Auto-edit completed successfully', { 
        videoId, 
        editedUrl: result.editedVideoUrl,
        editsCount: result.editsApplied?.length || 0
      });
      sendSuccess(res, 'Video automatically edited and saved successfully', 200, {
        ...result,
        message: `Video has been automatically edited with ${result.editsApplied?.length || 0} improvements applied. The edited video has replaced the original.`,
      });
    } else {
      sendError(res, 'Auto-edit completed but may have issues', 200, result);
    }
  } catch (error) {
    logger.error('Auto-edit video error', { error: error.message, videoId, stack: error.stack });
    sendError(res, `Video editing failed: ${error.message}`, 500);
  }
}));

/**
 * @swagger
 * /api/video/ai-editing/scenes:
 *   post:
 *     summary: Detect scenes
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/scenes', auth, asyncHandler(async (req, res) => {
  const { videoId, videoMetadata } = req.body;

  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }

  try {
    const result = await detectScenes(videoId, videoMetadata || {});
    sendSuccess(res, 'Scenes detected', 200, result);
  } catch (error) {
    logger.error('Detect scenes error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/ai-editing/smart-cuts:
 *   post:
 *     summary: Detect smart cuts
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/smart-cuts', auth, asyncHandler(async (req, res) => {
  const { videoId, videoMetadata } = req.body;

  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }

  try {
    const result = await detectSmartCuts(videoId, videoMetadata || {});
    sendSuccess(res, 'Smart cuts detected', 200, result);
  } catch (error) {
    logger.error('Detect smart cuts error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/ai-editing/presets:
 *   get:
 *     summary: List all edit presets
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.get('/presets', auth, asyncHandler(async (req, res) => {
  try {
    const presets = listEditPresets();
    sendSuccess(res, 'Edit presets retrieved', 200, { presets });
  } catch (error) {
    logger.error('List presets error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/ai-editing/presets/:presetName:
 *   get:
 *     summary: Get preset details
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.get('/presets/:presetName', auth, asyncHandler(async (req, res) => {
  const { presetName } = req.params;
  try {
    const preset = getEditPreset(presetName);
    if (!preset) {
      return sendError(res, `Preset "${presetName}" not found`, 404);
    }
    sendSuccess(res, 'Preset retrieved', 200, { preset });
  } catch (error) {
    logger.error('Get preset error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/ai-editing/preview:
 *   post:
 *     summary: Generate edit preview before applying
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/preview', auth, asyncHandler(async (req, res) => {
  const { videoId, editingOptions } = req.body;

  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }

  try {
    const preview = await generateEditPreview(videoId, editingOptions || {});
    sendSuccess(res, 'Edit preview generated', 200, preview);
  } catch (error) {
    logger.error('Generate preview error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/ai-editing/compare:
 *   post:
 *     summary: Create before/after comparison video
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/compare', auth, asyncHandler(async (req, res) => {
  const { videoId } = req.body;

  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }

  try {
    const comparison = await createComparisonVideo(videoId);
    sendSuccess(res, 'Comparison video created', 200, comparison);
  } catch (error) {
    logger.error('Create comparison error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/ai-editing/versions:
 *   post:
 *     summary: Save current edit version
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/versions', auth, asyncHandler(async (req, res) => {
  const { videoId, versionName } = req.body;

  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }

  try {
    const version = await saveEditVersion(videoId, versionName);
    sendSuccess(res, 'Edit version saved', 200, { version });
  } catch (error) {
    logger.error('Save version error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/ai-editing/versions/:versionId/restore:
 *   post:
 *     summary: Restore a previous edit version
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/versions/:versionId/restore', auth, asyncHandler(async (req, res) => {
  const { videoId } = req.body;
  const { versionId } = req.params;

  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }

  try {
    const result = await restoreEditVersion(videoId, versionId);
    sendSuccess(res, 'Version restored', 200, result);
  } catch (error) {
    logger.error('Restore version error', { error: error.message, videoId, versionId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/ai-editing/batch:
 *   post:
 *     summary: Batch auto-edit multiple videos
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/batch', auth, asyncHandler(async (req, res) => {
  const { videoIds, editingOptions } = req.body;

  if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
    return sendError(res, 'Video IDs array is required', 400);
  }

  if (videoIds.length > 50) {
    return sendError(res, 'Maximum 50 videos per batch', 400);
  }

  try {
    logger.info('Starting batch auto-edit', { count: videoIds.length, userId: req.user?.id || req.user?._id });
    const results = await batchAutoEdit(videoIds, editingOptions || {});
    sendSuccess(res, 'Batch auto-edit completed', 200, results);
  } catch (error) {
    logger.error('Batch auto-edit error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/ai-editing/analytics/:videoId:
 *   get:
 *     summary: Get edit performance analytics
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.get('/analytics/:videoId', auth, asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  try {
    const analytics = await getEditPerformanceAnalytics(videoId);
    sendSuccess(res, 'Edit analytics retrieved', 200, analytics);
  } catch (error) {
    logger.error('Get analytics error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/ai-editing/export:
 *   post:
 *     summary: Export video to multiple formats
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/export', auth, asyncHandler(async (req, res) => {
  const { videoId, formats = ['mp4', 'webm'] } = req.body;

  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }

  if (!Array.isArray(formats) || formats.length === 0) {
    return sendError(res, 'Formats array is required', 400);
  }

  try {
    const exports = await exportMultipleFormats(videoId, formats);
    sendSuccess(res, 'Multi-format export completed', 200, exports);
  } catch (error) {
    logger.error('Multi-format export error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;






