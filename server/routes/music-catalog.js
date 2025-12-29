// Music Catalog Routes
// Unified catalog search and discovery API

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const {
  searchCatalog,
  getTrackDetails,
  getAvailableFilters
} = require('../services/musicCatalogService');
const { ensureCatalogAccess } = require('../services/musicCatalogAuthService');
const { streamPreview, downloadTrackForEditing } = require('../services/musicCatalogPreviewService');
const MusicFavorite = require('../models/MusicFavorite');
const { getSearchSuggestions, getPopularSearchTerms } = require('../services/musicCatalogSearchAdvanced');
const { getRecommendedTracks, recommendTracksForContent } = require('../services/musicCatalogRecommendations');
const { trackUsage, getPopularTracks, getTrendingTracks, getCatalogStatistics } = require('../services/musicCatalogAnalytics');
const router = express.Router();

/**
 * @route GET /api/music-catalog/search
 * @desc Search unified music catalog
 * @access Private
 */
router.get('/search', auth, asyncHandler(async (req, res) => {
  const {
    q: query,
    genre,
    mood,
    bpm,
    duration,
    vocals,
    source,
    page = 1,
    limit = 50
  } = req.query;

  try {
    // Ensure catalog access is authenticated
    await ensureCatalogAccess(req.user._id);
    const filters = {};
    if (genre && genre !== 'all') filters.genre = genre;
    if (mood && mood !== 'all') filters.mood = mood;
    if (bpm) filters.bpm = parseInt(bpm);
    if (duration) filters.duration = parseInt(duration);
    if (vocals) filters.vocals = vocals === 'true';

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const options = {
      includeLicensed: !source || source === 'licensed' || source === 'all',
      includeAIGenerated: !source || source === 'ai_generated' || source === 'all',
      includeUserUploads: !source || source === 'user_upload' || source === 'all',
      limit: parseInt(limit),
      offset
    };

    const results = await searchCatalog(query, filters, req.user._id, options);

    // Get favorites for user
    const favoriteLicenseIds = await MusicFavorite.find({ userId: req.user._id })
      .select('licenseId')
      .lean()
      .then(favs => favs.map(f => f.licenseId?.toString()));

    // Mark favorites
    results.tracks = results.tracks.map(track => ({
      ...track,
      isFavorite: favoriteLicenseIds.includes(track.id)
    }));

    sendSuccess(res, 'Catalog search completed', 200, {
      tracks: results.tracks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: results.total,
        totalPages: Math.ceil(results.total / parseInt(limit))
      },
      sources: results.sources
    });
  } catch (error) {
    logger.error('Error searching catalog', {
      error: error.message,
      query,
      userId: req.user._id
    });
    sendError(res, error.message || 'Failed to search catalog', 500);
  }
}));

/**
 * @route GET /api/music-catalog/filters
 * @desc Get available filters (genres, moods, etc.)
 * @access Private
 */
router.get('/filters', auth, asyncHandler(async (req, res) => {
  try {
    const filters = await getAvailableFilters();

    sendSuccess(res, 'Filters retrieved', 200, { filters });
  } catch (error) {
    logger.error('Error getting filters', { error: error.message });
    sendError(res, error.message || 'Failed to get filters', 500);
  }
}));

/**
 * @route GET /api/music-catalog/track/:trackId
 * @desc Get track details with license information
 * @access Private
 */
router.get('/track/:trackId', auth, asyncHandler(async (req, res) => {
  const { trackId } = req.params;
  const { source } = req.query;

  if (!source) {
    return sendError(res, 'source query parameter is required (licensed, ai_generated, user_upload)', 400);
  }

  try {
    const track = await getTrackDetails(trackId, source, req.user._id);

    // Check if favorited
    const favorite = await MusicFavorite.findOne({
      userId: req.user._id,
      licenseId: trackId
    }).lean();

    track.isFavorite = !!favorite;

    sendSuccess(res, 'Track details retrieved', 200, { track });
  } catch (error) {
    logger.error('Error getting track details', {
      error: error.message,
      trackId,
      source,
      userId: req.user._id
    });
    sendError(res, error.message || 'Failed to get track details', 500);
  }
}));

/**
 * @route GET /api/music-catalog/track/:trackId/preview
 * @desc Stream preview audio
 * @access Private
 */
router.get('/track/:trackId/preview', auth, asyncHandler(async (req, res) => {
  const { trackId } = req.params;
  const { source } = req.query;

  if (!source) {
    return sendError(res, 'source query parameter is required', 400);
  }

  try {
    await streamPreview(trackId, source, req.user._id, req, res);
  } catch (error) {
    logger.error('Error streaming preview', {
      error: error.message,
      trackId,
      source,
      userId: req.user._id
    });
    if (!res.headersSent) {
      sendError(res, error.message || 'Failed to stream preview', 500);
    }
  }
}));

/**
 * @route POST /api/music-catalog/track/:trackId/download
 * @desc Get download URL for editing (temporary if needed)
 * @access Private
 */
router.post('/track/:trackId/download', auth, asyncHandler(async (req, res) => {
  const { trackId } = req.params;
  const { source } = req.body;

  if (!source) {
    return sendError(res, 'source is required', 400);
  }

  try {
    const downloadInfo = await downloadTrackForEditing(trackId, source, req.user._id);

    sendSuccess(res, 'Download URL retrieved', 200, downloadInfo);
  } catch (error) {
    logger.error('Error getting download URL', {
      error: error.message,
      trackId,
      source,
      userId: req.user._id
    });
    sendError(res, error.message || 'Failed to get download URL', 500);
  }
}));

/**
 * @route POST /api/music-catalog/track/:trackId/favorite
 * @desc Add track to favorites
 * @access Private
 */
router.post('/track/:trackId/favorite', auth, asyncHandler(async (req, res) => {
  const { trackId } = req.params;
  const { source } = req.body;

  if (!source) {
    return sendError(res, 'source is required', 400);
  }

  try {
    // For licensed tracks, use licenseId
    // For others, we might need to handle differently
    let licenseId = trackId;

    if (source === 'ai_generated' || source === 'user_upload') {
      // For non-licensed tracks, we could create a reference or use musicId
      // For now, we'll only support favorites for licensed tracks
      return sendError(res, 'Favorites currently only supported for licensed tracks', 400);
    }

    // Check if already favorited
    const existing = await MusicFavorite.findOne({
      userId: req.user._id,
      licenseId: trackId
    });

    if (existing) {
      return sendError(res, 'Track already in favorites', 400);
    }

    const favorite = new MusicFavorite({
      userId: req.user._id,
      licenseId: trackId
    });

    await favorite.save();

    sendSuccess(res, 'Track added to favorites', 200, { favorite });
  } catch (error) {
    logger.error('Error adding favorite', {
      error: error.message,
      trackId,
      userId: req.user._id
    });
    sendError(res, error.message || 'Failed to add favorite', 500);
  }
}));

/**
 * @route GET /api/music-catalog/track/:trackId/license
 * @desc Get license information and usage permissions
 * @access Private
 */
router.get('/track/:trackId/license', auth, asyncHandler(async (req, res) => {
  const { trackId } = req.params;
  const { source } = req.query;

  if (!source) {
    return sendError(res, 'source query parameter is required', 400);
  }

  try {
    const track = await getTrackDetails(trackId, source, req.user._id);

    const licenseInfo = {
      trackId: track.id,
      title: track.title,
      artist: track.artist,
      license: track.license,
      usagePermissions: {
        commercialUse: track.license.allowsCommercialUse,
        socialPlatforms: track.license.allowsSocialPlatforms,
        monetization: track.license.allowsMonetization,
        platforms: track.license.platforms,
        requiresAttribution: track.license.requiresAttribution,
        attributionText: track.license.attributionText || null
      },
      tooltip: generateUsageTooltip(track.license),
      source: track.source,
      provider: track.provider
    };

    sendSuccess(res, 'License information retrieved', 200, licenseInfo);
  } catch (error) {
    logger.error('Error getting license information', {
      error: error.message,
      trackId,
      source,
      userId: req.user._id
    });
    sendError(res, error.message || 'Failed to get license information', 500);
  }
}));

/**
 * Generate usage tooltip text
 */
function generateUsageTooltip(license) {
  if (license.allowsCommercialUse && license.allowsSocialPlatforms && license.allowsMonetization) {
    return "Safe for monetized social videos under Click's license";
  } else if (license.allowsCommercialUse && license.allowsSocialPlatforms) {
    return "Safe for commercial use on social platforms";
  } else if (license.allowsCommercialUse) {
    return "Safe for commercial use";
  } else {
    return "Personal use only";
  }
}

/**
 * @route GET /api/music-catalog/search/suggestions
 * @desc Get search autocomplete suggestions
 * @access Private
 */
router.get('/search/suggestions', auth, asyncHandler(async (req, res) => {
  const { q: query, limit = 10, sources } = req.query;

  if (!query) {
    return sendError(res, 'query parameter is required', 400);
  }

  try {
    const sourceArray = sources ? sources.split(',') : ['licensed', 'ai_generated', 'user_upload'];
    const suggestions = await getSearchSuggestions(query, req.user._id, { limit, sources: sourceArray });

    sendSuccess(res, 'Suggestions retrieved', 200, { suggestions });
  } catch (error) {
    logger.error('Error getting search suggestions', { error: error.message, query });
    sendError(res, error.message || 'Failed to get suggestions', 500);
  }
}));

/**
 * @route GET /api/music-catalog/search/popular-terms
 * @desc Get popular search terms
 * @access Private
 */
router.get('/search/popular-terms', auth, asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;

  try {
    const popularTerms = await getPopularSearchTerms(parseInt(limit));

    sendSuccess(res, 'Popular terms retrieved', 200, { popularTerms });
  } catch (error) {
    logger.error('Error getting popular search terms', { error: error.message });
    sendError(res, error.message || 'Failed to get popular terms', 500);
  }
}));

/**
 * @route GET /api/music-catalog/recommendations
 * @desc Get recommended tracks
 * @access Private
 */
router.get('/recommendations', auth, asyncHandler(async (req, res) => {
  const {
    basedOn = 'usage', // 'usage', 'favorites', 'similar', 'trending'
    limit = 20,
    trackId, // For 'similar' recommendations
    excludeTrackIds
  } = req.query;

  try {
    const excludeIds = excludeTrackIds ? excludeTrackIds.split(',') : [];
    const recommendations = await getRecommendedTracks(req.user._id, {
      limit: parseInt(limit),
      basedOn,
      trackId,
      excludeTrackIds: excludeIds
    });

    sendSuccess(res, 'Recommendations retrieved', 200, { recommendations });
  } catch (error) {
    logger.error('Error getting recommendations', { error: error.message });
    sendError(res, error.message || 'Failed to get recommendations', 500);
  }
}));

/**
 * @route POST /api/music-catalog/recommendations/content
 * @desc Get track recommendations for video/content
 * @access Private
 */
router.post('/recommendations/content', auth, asyncHandler(async (req, res) => {
  const { contentMetadata, limit = 10 } = req.body;

  if (!contentMetadata) {
    return sendError(res, 'contentMetadata is required', 400);
  }

  try {
    const recommendations = await recommendTracksForContent(contentMetadata, {
      limit: parseInt(limit)
    });

    sendSuccess(res, 'Content recommendations retrieved', 200, recommendations);
  } catch (error) {
    logger.error('Error getting content recommendations', { error: error.message });
    sendError(res, error.message || 'Failed to get content recommendations', 500);
  }
}));

/**
 * @route GET /api/music-catalog/popular
 * @desc Get popular tracks
 * @access Private
 */
router.get('/popular', auth, asyncHandler(async (req, res) => {
  const {
    limit = 20,
    timeRange = 'all',
    genre,
    mood
  } = req.query;

  try {
    const tracks = await getPopularTracks({
      limit: parseInt(limit),
      timeRange,
      genre: genre || null,
      mood: mood || null
    });

    sendSuccess(res, 'Popular tracks retrieved', 200, { tracks });
  } catch (error) {
    logger.error('Error getting popular tracks', { error: error.message });
    sendError(res, error.message || 'Failed to get popular tracks', 500);
  }
}));

/**
 * @route GET /api/music-catalog/trending
 * @desc Get trending tracks
 * @access Private
 */
router.get('/trending', auth, asyncHandler(async (req, res) => {
  const { limit = 20 } = req.query;

  try {
    const tracks = await getTrendingTracks(parseInt(limit));

    sendSuccess(res, 'Trending tracks retrieved', 200, { tracks });
  } catch (error) {
    logger.error('Error getting trending tracks', { error: error.message });
    sendError(res, error.message || 'Failed to get trending tracks', 500);
  }
}));

/**
 * @route GET /api/music-catalog/statistics
 * @desc Get catalog statistics
 * @access Private
 */
router.get('/statistics', auth, asyncHandler(async (req, res) => {
  try {
    const stats = await getCatalogStatistics();

    sendSuccess(res, 'Statistics retrieved', 200, { statistics: stats });
  } catch (error) {
    logger.error('Error getting catalog statistics', { error: error.message });
    sendError(res, error.message || 'Failed to get statistics', 500);
  }
}));

/**
 * @route POST /api/music-catalog/track/:trackId/usage
 * @desc Track usage of a catalog track
 * @access Private
 */
router.post('/track/:trackId/usage', auth, asyncHandler(async (req, res) => {
  const { trackId } = req.params;
  const { source } = req.body;
  const { contentId, projectId } = req.body; // Context

  if (!source) {
    return sendError(res, 'source is required', 400);
  }

  try {
    await trackUsage(trackId, source, req.user._id, { contentId, projectId });

    sendSuccess(res, 'Usage tracked', 200);
  } catch (error) {
    logger.error('Error tracking usage', { error: error.message, trackId });
    sendError(res, error.message || 'Failed to track usage', 500);
  }
}));

/**
 * @route POST /api/music-catalog/batch/favorites
 * @desc Add multiple tracks to favorites
 * @access Private
 */
router.post('/batch/favorites', auth, asyncHandler(async (req, res) => {
  const { tracks } = req.body; // Array of { trackId, source }

  if (!tracks || !Array.isArray(tracks)) {
    return sendError(res, 'tracks array is required', 400);
  }

  try {
    const results = {
      added: [],
      skipped: [],
      errors: []
    };

    for (const track of tracks) {
      try {
        if (track.source !== 'licensed') {
          results.skipped.push({ trackId: track.trackId, reason: 'Only licensed tracks can be favorited' });
          continue;
        }

        const existing = await MusicFavorite.findOne({
          userId: req.user._id,
          licenseId: track.trackId
        });

        if (existing) {
          results.skipped.push({ trackId: track.trackId, reason: 'Already favorited' });
          continue;
        }

        const favorite = new MusicFavorite({
          userId: req.user._id,
          licenseId: track.trackId
        });

        await favorite.save();
        results.added.push(track.trackId);
      } catch (error) {
        results.errors.push({ trackId: track.trackId, error: error.message });
      }
    }

    sendSuccess(res, 'Batch favorites processed', 200, results);
  } catch (error) {
    logger.error('Error in batch favorites', { error: error.message });
    sendError(res, error.message || 'Failed to process batch favorites', 500);
  }
}));

module.exports = router;

