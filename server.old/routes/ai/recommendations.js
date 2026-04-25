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
  const userId = req.user._id || req.user.id;
  
  // Check both host header and x-forwarded-host (for proxy requests)
  const host = req.headers.host || req.headers['x-forwarded-host'] || '';
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') || 
                      (typeof req.headers['x-forwarded-for'] === 'string' && req.headers['x-forwarded-for'].includes('127.0.0.1'));
  const allowDevMode = process.env.NODE_ENV !== 'production' || isLocalhost;
  
  // In development mode OR when on localhost, return mock recommendations for dev users
  if (allowDevMode && userId && (userId.toString().startsWith('dev-') || userId.toString() === 'dev-user-123')) {
    return sendSuccess(res, 'Personalized recommendations fetched (dev mode)', 200, {
      recommendations: [
        { id: 'dev-rec-1', title: 'Dev: Personalized Idea', description: 'Mock personalized idea', type: 'idea', platform: 'instagram' },
        { id: 'dev-rec-2', title: 'Dev: Trending Video', description: 'Mock trending video idea', type: 'video', platform: 'youtube' }
      ],
      insights: { engagement: 'high', reach: 'medium' },
      topPlatforms: ['instagram', 'youtube']
    });
  }
  
  try {
    const result = await getPersonalizedRecommendations(userId, {
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
    // Handle CastError gracefully for dev mode
    if (allowDevMode && (error.name === 'CastError' || error.message?.includes('Cast to ObjectId'))) {
      logger.warn('CastError in personalized recommendations, returning mock data for dev mode', { error: error.message, userId });
      return sendSuccess(res, 'Personalized recommendations fetched (dev mode)', 200, {
        recommendations: [],
        insights: {},
        topPlatforms: []
      });
    }
    logger.error('Get personalized recommendations error', { error: error.message, stack: error.stack, userId });
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
  const userId = req.user._id || req.user.id;
  
  try {
    // In development mode, return mock suggestions for dev users
    if (process.env.NODE_ENV !== 'production' && userId && userId.toString().startsWith('dev-')) {
      return sendSuccess(res, 'Trend-based suggestions fetched (dev mode)', 200, [
        { id: 'dev-trend-1', title: 'Dev: AI Trends', description: 'Mock AI trend for dev', platform: platform || 'instagram' },
        { id: 'dev-trend-2', title: 'Dev: Short-form Video', description: 'Mock short-form video trend', platform: platform || 'tiktok' }
      ]);
    }
    
    const result = await getTrendBasedSuggestions(userId, platform || 'instagram');
    sendSuccess(res, 'Trend-based suggestions fetched', 200, result || []);
  } catch (error) {
    logger.error('Get trend-based suggestions error', { error: error.message, userId: req.user._id || req.user.id });
    sendSuccess(res, 'Trend-based suggestions fetched', 200, []);
  }
}));

module.exports = router;

