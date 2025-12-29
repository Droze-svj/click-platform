// Video Optimization Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  optimizeForPlatform,
  getOptimalQuality,
  compressVideo,
  convertVideoFormat,
} = require('../../services/videoOptimizationService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

router.post('/platform', auth, asyncHandler(async (req, res) => {
  const { videoId, platform, options } = req.body;
  if (!videoId || !platform) {
    return sendError(res, 'Video ID and platform are required', 400);
  }
  try {
    const result = await optimizeForPlatform(videoId, platform, options || {});
    sendSuccess(res, 'Video optimization plan created', 200, result);
  } catch (error) {
    logger.error('Optimize for platform error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

router.post('/quality', auth, asyncHandler(async (req, res) => {
  const { videoId, targetFileSize, duration } = req.body;
  if (!videoId || !targetFileSize || !duration) {
    return sendError(res, 'Video ID, target file size, and duration are required', 400);
  }
  try {
    const result = await getOptimalQuality(videoId, targetFileSize, duration);
    sendSuccess(res, 'Optimal quality calculated', 200, result);
  } catch (error) {
    logger.error('Get optimal quality error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

router.post('/compress', auth, asyncHandler(async (req, res) => {
  const { videoId, options } = req.body;
  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }
  try {
    const result = await compressVideo(videoId, options || {});
    sendSuccess(res, 'Video compression plan created', 200, result);
  } catch (error) {
    logger.error('Compress video error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

router.post('/convert', auth, asyncHandler(async (req, res) => {
  const { videoId, targetFormat, options } = req.body;
  if (!videoId || !targetFormat) {
    return sendError(res, 'Video ID and target format are required', 400);
  }
  try {
    const result = await convertVideoFormat(videoId, targetFormat, options || {});
    sendSuccess(res, 'Video format conversion plan created', 200, result);
  } catch (error) {
    logger.error('Convert video format error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;






