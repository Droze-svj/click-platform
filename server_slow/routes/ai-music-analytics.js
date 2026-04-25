// AI Music Analytics Routes

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const {
  getCostStatistics,
  getCostBreakdownByUser
} = require('../services/aiMusicCostTracking');
const { getQueueStatus } = require('../services/aiMusicGenerationQueue');
const MusicGeneration = require('../models/MusicGeneration');
const router = express.Router();

/**
 * @route GET /api/ai-music/analytics/cost
 * @desc Get cost statistics
 * @access Private
 */
router.get('/cost', auth, asyncHandler(async (req, res) => {
  const { startDate, endDate, provider } = req.query;

  try {
    const stats = await getCostStatistics({
      startDate,
      endDate,
      provider,
      userId: req.user._id
    });

    sendSuccess(res, 'Cost statistics retrieved', 200, stats);
  } catch (error) {
    logger.error('Error getting cost statistics', { error: error.message });
    sendError(res, error.message || 'Failed to get cost statistics', 500);
  }
}));

/**
 * @route GET /api/ai-music/analytics/usage
 * @desc Get usage statistics
 * @access Private
 */
router.get('/usage', auth, asyncHandler(async (req, res) => {
  const { startDate, endDate, provider, groupBy = 'day' } = req.query;

  try {
    const matchStage = { userId: req.user._id };
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }
    if (provider) matchStage.provider = provider;

    const groupFormat = {
      day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
      week: { $dateToString: { format: '%Y-W%V', date: '$createdAt' } },
      month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }
    };

    const usageStats = await MusicGeneration.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: groupFormat[groupBy],
          totalGenerations: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Provider breakdown
    const providerStats = await MusicGeneration.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$provider',
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } }
        }
      }
    ]);

    // Parameter usage
    const moodStats = await MusicGeneration.aggregate([
      { $match: matchStage },
      { $group: { _id: '$params.mood', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const genreStats = await MusicGeneration.aggregate([
      { $match: matchStage },
      { $group: { _id: '$params.genre', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    sendSuccess(res, 'Usage statistics retrieved', 200, {
      usageOverTime: usageStats,
      providerBreakdown: providerStats,
      popularMoods: moodStats,
      popularGenres: genreStats
    });
  } catch (error) {
    logger.error('Error getting usage statistics', { error: error.message });
    sendError(res, error.message || 'Failed to get usage statistics', 500);
  }
}));

/**
 * @route GET /api/ai-music/analytics/queue
 * @desc Get queue status
 * @access Private
 */
router.get('/queue', auth, asyncHandler(async (req, res) => {
  try {
    const status = getQueueStatus();

    sendSuccess(res, 'Queue status retrieved', 200, { queue: status });
  } catch (error) {
    logger.error('Error getting queue status', { error: error.message });
    sendError(res, error.message || 'Failed to get queue status', 500);
  }
}));

module.exports = router;







