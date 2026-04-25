// Music Licensing Tools Routes
// Interactive licensing comparison and coverage tools

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const {
  comparePlatformCoverage,
  checkUseCaseCoverage,
  getLicenseCostBreakdown
} = require('../services/musicLicensingComparisonService');
const router = express.Router();

/**
 * Helper to generate coverage summary
 */
function generateCoverageSummary(comparisons) {
  const allPlatforms = [
    'youtube', 'tiktok', 'instagram', 'facebook', 'twitter', 'linkedin', 'vimeo', 'twitch'
  ];

  const platformStats = {};

  allPlatforms.forEach(platform => {
    platformStats[platform] = {
      covered: 0,
      monetization: 0,
      attribution: 0,
      total: comparisons.length
    };

    comparisons.forEach(comparison => {
      const platforms = comparison.platforms || [];
      const platformInfo = platforms.find(p => p.platform === platform);
      if (platformInfo) {
        if (platformInfo.covered) platformStats[platform].covered++;
        if (platformInfo.monetization) platformStats[platform].monetization++;
        if (platformInfo.attribution) platformStats[platform].attribution++;
      }
    });
  });

  return platformStats;
}

/**
 * @route POST /api/music-licensing/compare
 * @desc Compare platform coverage for multiple tracks
 * @access Private
 */
router.post('/compare', auth, asyncHandler(async (req, res) => {
  const {
    tracks // Array of { trackId, source }
  } = req.body;

  if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
    return sendError(res, 'tracks array is required', 400);
  }

  try {
    const comparisons = await Promise.all(
      tracks.map(track =>
        comparePlatformCoverage([track.trackId], track.source, req.user._id)
      )
    );

    // Combine results
    const allComparisons = comparisons.flatMap(c => c.tracks);
    const combinedSummary = generateCoverageSummary(allComparisons);

    sendSuccess(res, 'Platform coverage compared', 200, {
      tracks: allComparisons,
      summary: combinedSummary
    });
  } catch (error) {
    logger.error('Error comparing platform coverage', {
      error: error.message,
      userId: req.user._id
    });
    sendError(res, error.message || 'Failed to compare coverage', 500);
  }
}));

/**
 * @route POST /api/music-licensing/check-use-case
 * @desc Check if track can be used for specific use case
 * @access Private
 */
router.post('/check-use-case', auth, asyncHandler(async (req, res) => {
  const {
    trackId,
    source,
    useCase
  } = req.body;

  if (!trackId || !source || !useCase) {
    return sendError(res, 'trackId, source, and useCase are required', 400);
  }

  try {
    const result = await checkUseCaseCoverage(
      trackId,
      source,
      useCase,
      req.user._id
    );

    sendSuccess(res, 'Use case checked', 200, result);
  } catch (error) {
    logger.error('Error checking use case', {
      error: error.message,
      trackId,
      useCase
    });
    sendError(res, error.message || 'Failed to check use case', 500);
  }
}));

/**
 * @route GET /api/music-licensing/cost-breakdown
 * @desc Get license cost breakdown
 * @access Private
 */
router.get('/cost-breakdown', auth, asyncHandler(async (req, res) => {
  const {
    timeRange = 'month',
    includeAIGenerated = 'true'
  } = req.query;

  try {
    const breakdown = await getLicenseCostBreakdown(req.user._id, {
      timeRange,
      includeAIGenerated: includeAIGenerated === 'true'
    });

    sendSuccess(res, 'Cost breakdown retrieved', 200, breakdown);
  } catch (error) {
    logger.error('Error getting cost breakdown', {
      error: error.message,
      userId: req.user._id
    });
    sendError(res, error.message || 'Failed to get cost breakdown', 500);
  }
}));


module.exports = router;

