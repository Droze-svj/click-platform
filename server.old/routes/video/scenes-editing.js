// Scene Editing Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  mergeScenes,
  splitScene,
  updateSceneBoundaries,
  deleteScene,
  addSceneNotes,
  addSceneTags
} = require('../../services/sceneEditingService');
const {
  searchScenes,
  getSceneStatistics,
  getScenesByTags,
  getScenesInTimeRange
} = require('../../services/sceneSearchService');
const {
  applyTemplate,
  getAvailableTemplates
} = require('../../services/sceneTemplateService');
const {
  batchDetectScenes,
  batchApplyTemplate
} = require('../../services/sceneBatchService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @route POST /api/video/scenes/:contentId/merge
 * @desc Merge multiple scenes into one
 * @access Private
 */
router.post('/:contentId/merge', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { sceneIds } = req.body;

  if (!sceneIds || !Array.isArray(sceneIds) || sceneIds.length < 2) {
    return sendError(res, 'At least 2 scene IDs required', 400);
  }

  try {
    const mergedScene = await mergeScenes(contentId, sceneIds, req.user._id);
    sendSuccess(res, 'Scenes merged successfully', 200, mergedScene);
  } catch (error) {
    logger.error('Error merging scenes', { error: error.message, contentId });
    sendError(res, error.message || 'Failed to merge scenes', 500);
  }
}));

/**
 * @route POST /api/video/scenes/:sceneId/split
 * @desc Split a scene into multiple scenes
 * @access Private
 */
router.post('/:sceneId/split', auth, asyncHandler(async (req, res) => {
  const { sceneId } = req.params;
  const { splitPoints } = req.body;

  if (!splitPoints || !Array.isArray(splitPoints) || splitPoints.length === 0) {
    return sendError(res, 'Split points array required', 400);
  }

  try {
    const newScenes = await splitScene(sceneId, splitPoints, req.user._id);
    sendSuccess(res, 'Scene split successfully', 200, { scenes: newScenes });
  } catch (error) {
    logger.error('Error splitting scene', { error: error.message, sceneId });
    sendError(res, error.message || 'Failed to split scene', 500);
  }
}));

/**
 * @route PUT /api/video/scenes/:sceneId/boundaries
 * @desc Update scene boundaries
 * @access Private
 */
router.put('/:sceneId/boundaries', auth, asyncHandler(async (req, res) => {
  const { sceneId } = req.params;
  const { start, end } = req.body;

  if (start === undefined || end === undefined) {
    return sendError(res, 'Start and end times required', 400);
  }

  try {
    const updatedScene = await updateSceneBoundaries(sceneId, start, end, req.user._id);
    sendSuccess(res, 'Scene boundaries updated successfully', 200, updatedScene);
  } catch (error) {
    logger.error('Error updating scene boundaries', { error: error.message, sceneId });
    sendError(res, error.message || 'Failed to update scene boundaries', 500);
  }
}));

/**
 * @route DELETE /api/video/scenes/:sceneId
 * @desc Delete a scene
 * @access Private
 */
router.delete('/:sceneId', auth, asyncHandler(async (req, res) => {
  const { sceneId } = req.params;

  try {
    const result = await deleteScene(sceneId, req.user._id);
    sendSuccess(res, 'Scene deleted successfully', 200, result);
  } catch (error) {
    logger.error('Error deleting scene', { error: error.message, sceneId });
    sendError(res, error.message || 'Failed to delete scene', 500);
  }
}));

/**
 * @route POST /api/video/scenes/:sceneId/notes
 * @desc Add notes to a scene
 * @access Private
 */
router.post('/:sceneId/notes', auth, asyncHandler(async (req, res) => {
  const { sceneId } = req.params;
  const { notes } = req.body;

  try {
    const scene = await addSceneNotes(sceneId, notes, req.user._id);
    sendSuccess(res, 'Notes added successfully', 200, scene);
  } catch (error) {
    logger.error('Error adding scene notes', { error: error.message, sceneId });
    sendError(res, error.message || 'Failed to add notes', 500);
  }
}));

/**
 * @route POST /api/video/scenes/:sceneId/tags
 * @desc Add custom tags to a scene
 * @access Private
 */
router.post('/:sceneId/tags', auth, asyncHandler(async (req, res) => {
  const { sceneId } = req.params;
  const { tags } = req.body;

  if (!tags) {
    return sendError(res, 'Tags required', 400);
  }

  try {
    const scene = await addSceneTags(sceneId, tags, req.user._id);
    sendSuccess(res, 'Tags added successfully', 200, scene);
  } catch (error) {
    logger.error('Error adding scene tags', { error: error.message, sceneId });
    sendError(res, error.message || 'Failed to add tags', 500);
  }
}));

/**
 * @route POST /api/video/scenes/search
 * @desc Search scenes with filters
 * @access Private
 */
router.post('/search', auth, asyncHandler(async (req, res) => {
  const { query, filters, sortBy, order, limit, offset } = req.body;

  try {
    const result = await searchScenes(query || '', {
      userId: req.user._id,
      filters: filters || {},
      sortBy: sortBy || 'sceneIndex',
      order: order || 'asc',
      limit: limit || 50,
      offset: offset || 0
    });

    sendSuccess(res, 'Scenes found', 200, result);
  } catch (error) {
    logger.error('Error searching scenes', { error: error.message });
    sendError(res, error.message || 'Failed to search scenes', 500);
  }
}));

/**
 * @route GET /api/video/scenes/:contentId/statistics
 * @desc Get scene statistics for content
 * @access Private
 */
router.get('/:contentId/statistics', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;

  try {
    const stats = await getSceneStatistics(contentId, req.user._id);
    sendSuccess(res, 'Statistics retrieved successfully', 200, stats);
  } catch (error) {
    logger.error('Error getting scene statistics', { error: error.message, contentId });
    sendError(res, error.message || 'Failed to get statistics', 500);
  }
}));

/**
 * @route POST /api/video/scenes/:contentId/template
 * @desc Apply a scene template
 * @access Private
 */
router.post('/:contentId/template', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { templateName } = req.body;

  if (!templateName) {
    return sendError(res, 'Template name required', 400);
  }

  try {
    const result = await applyTemplate(templateName, contentId, req.user._id);
    sendSuccess(res, 'Template applied successfully', 200, result);
  } catch (error) {
    logger.error('Error applying template', { error: error.message, contentId, templateName });
    sendError(res, error.message || 'Failed to apply template', 500);
  }
}));

/**
 * @route GET /api/video/scenes/templates
 * @desc Get available scene templates
 * @access Private
 */
router.get('/templates', auth, asyncHandler(async (req, res) => {
  try {
    const templates = getAvailableTemplates();
    sendSuccess(res, 'Templates retrieved successfully', 200, { templates });
  } catch (error) {
    logger.error('Error getting templates', { error: error.message });
    sendError(res, error.message || 'Failed to get templates', 500);
  }
}));

/**
 * @route POST /api/video/scenes/batch/detect
 * @desc Batch detect scenes for multiple videos
 * @access Private
 */
router.post('/batch/detect', auth, asyncHandler(async (req, res) => {
  const { contentIds, options } = req.body;

  if (!contentIds || !Array.isArray(contentIds) || contentIds.length === 0) {
    return sendError(res, 'Content IDs array required', 400);
  }

  try {
    const result = await batchDetectScenes(contentIds, req.user._id, options || {});
    sendSuccess(res, 'Batch detection started', 200, result);
  } catch (error) {
    logger.error('Error in batch detection', { error: error.message });
    sendError(res, error.message || 'Failed to start batch detection', 500);
  }
}));

/**
 * @route POST /api/video/scenes/batch/template
 * @desc Batch apply template to multiple videos
 * @access Private
 */
router.post('/batch/template', auth, asyncHandler(async (req, res) => {
  const { templateName, contentIds } = req.body;

  if (!templateName || !contentIds || !Array.isArray(contentIds)) {
    return sendError(res, 'Template name and content IDs array required', 400);
  }

  try {
    const result = await batchApplyTemplate(templateName, contentIds, req.user._id);
    sendSuccess(res, 'Batch template application started', 200, result);
  } catch (error) {
    logger.error('Error in batch template application', { error: error.message });
    sendError(res, error.message || 'Failed to apply template', 500);
  }
}));

module.exports = router;







