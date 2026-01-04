// AI Recommendations Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  getPersonalizedRecommendations,
  learnFromBehavior,
  getTrendBasedSuggestions,
} = require('../../services/aiRecommendationsEngine');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const {
  ValidationError,
} = require('../../utils/errorHandler');
const logger = require('../../utils/logger');
const router = express.Router();

router.get('/personalized', auth, asyncHandler(async (req, res) => {
  const { limit, type, platform } = req.query;
  try {
    const result = await getPersonalizedRecommendations(req.user._id, {
      limit: limit ? parseInt(limit) : 10,
      type: type || null,
      platform: platform || null,
    });
    sendSuccess(res, 'Personalized recommendations fetched', 200, result || {
      recommendations: [],
      insights: {},
      topPlatforms: []
    });
  } catch (error) {
    logger.error('Get personalized recommendations error', { error: error.message, userId: req.user._id });
    sendSuccess(res, 'Personalized recommendations fetched', 200, {
      recommendations: [],
      insights: {},
      topPlatforms: []
    });
  }
}));

router.post('/learn', auth, asyncHandler(async (req, res) => {
  const { contentId, action, duration, platform } = req.body;
  if (!contentId || !action) {
    throw new ValidationError('Content ID and action are required', [
      { field: 'contentId', message: 'Content ID is required' },
      { field: 'action', message: 'Action is required' },
    ]);
  }
  
  const result = await learnFromBehavior(req.user._id, {
    contentId,
    action,
    duration,
    platform,
  });
  sendSuccess(res, 'Behavior learned', 200, result);
}));

router.get('/trend-based', auth, asyncHandler(async (req, res) => {
  const { platform } = req.query;
  try {
    const result = await getTrendBasedSuggestions(req.user._id, platform || 'instagram');
    sendSuccess(res, 'Trend-based suggestions fetched', 200, result || []);
  } catch (error) {
    logger.error('Get trend-based suggestions error', { error: error.message, userId: req.user._id });
    sendSuccess(res, 'Trend-based suggestions fetched', 200, []);
  }
}));

module.exports = router;

