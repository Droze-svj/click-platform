// Video Chapters Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  autoGenerateChapters,
  createCustomChapters,
  getChapterNavigation,
  generateChapterThumbnails,
} = require('../../services/videoChaptersService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/video/chapters/auto-generate:
 *   post:
 *     summary: Auto-generate video chapters
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/auto-generate', auth, asyncHandler(async (req, res) => {
  const { videoId, transcript, scenes, duration } = req.body;

  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }

  try {
    const chapters = await autoGenerateChapters(videoId, {
      transcript,
      scenes,
      duration,
    });
    sendSuccess(res, 'Chapters auto-generated', 200, chapters);
  } catch (error) {
    logger.error('Auto-generate chapters error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/chapters/custom:
 *   post:
 *     summary: Create custom chapters
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/custom', auth, asyncHandler(async (req, res) => {
  const { videoId, chapters } = req.body;

  if (!videoId || !chapters || !Array.isArray(chapters)) {
    return sendError(res, 'Video ID and chapters array are required', 400);
  }

  try {
    const result = await createCustomChapters(videoId, chapters);
    sendSuccess(res, 'Custom chapters created', 200, result);
  } catch (error) {
    logger.error('Create custom chapters error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/chapters/navigation:
 *   post:
 *     summary: Get chapter navigation
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/navigation', auth, asyncHandler(async (req, res) => {
  const { chapters } = req.body;

  if (!chapters || !Array.isArray(chapters)) {
    return sendError(res, 'Chapters array is required', 400);
  }

  try {
    const navigation = getChapterNavigation(chapters);
    sendSuccess(res, 'Chapter navigation fetched', 200, navigation);
  } catch (error) {
    logger.error('Get chapter navigation error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/chapters/thumbnails:
 *   post:
 *     summary: Generate chapter thumbnails
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/thumbnails', auth, asyncHandler(async (req, res) => {
  const { videoId, chapters } = req.body;

  if (!videoId || !chapters || !Array.isArray(chapters)) {
    return sendError(res, 'Video ID and chapters array are required', 400);
  }

  try {
    const thumbnails = await generateChapterThumbnails(videoId, chapters);
    sendSuccess(res, 'Chapter thumbnails generated', 200, thumbnails);
  } catch (error) {
    logger.error('Generate chapter thumbnails error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;






