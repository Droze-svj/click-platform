// Advanced Search Routes

const express = require('express');
const auth = require('../middleware/auth');
const {
  semanticSearch,
  textSearch,
  facetedSearch,
  getSearchFacets,
  getSearchSuggestions,
  getDiscoveryRecommendations,
  saveSearch,
  getSavedSearches,
  getSearchAnalytics,
  clusterSearchResults,
  trackSearchClick,
  getSearchResultPreview
} = require('../services/advancedSearchService');
const {
  parseNaturalLanguageQuery,
  enhanceQueryWithAI
} = require('../services/naturalLanguageSearchService');
const {
  createSearchAlert,
  getUserAlerts,
  toggleAlert,
  deleteAlert
} = require('../services/searchAlertService');
const SearchHistory = require('../models/SearchHistory');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const router = express.Router();

/**
 * POST /api/search/semantic
 * Semantic AI-powered search
 */
router.post('/semantic', auth, asyncHandler(async (req, res) => {
  const { query, ...options } = req.body;

  if (!query || query.trim().length === 0) {
    return sendError(res, 'Search query is required', 400);
  }

  const results = await semanticSearch(req.user._id, query, options);

  // Save to history
  try {
    await SearchHistory.create({
      userId: req.user._id,
      query,
      filters: options,
      resultCount: results.length,
      searchType: 'semantic'
    });
  } catch (error) {
    logger.warn('Error saving search history', { error: error.message });
  }

  sendSuccess(res, 'Search completed', 200, { results, query });
}));

/**
 * POST /api/search/faceted
 * Faceted search with filters
 */
router.post('/faceted', auth, asyncHandler(async (req, res) => {
  const { query = '', filters = {} } = req.body;

  const result = await facetedSearch(req.user._id, query, filters);

  // Save to history
  try {
    await SearchHistory.create({
      userId: req.user._id,
      query,
      filters,
      resultCount: result.results.length,
      searchType: 'faceted'
    });
  } catch (error) {
    logger.warn('Error saving search history', { error: error.message });
  }

  sendSuccess(res, 'Faceted search completed', 200, result);
}));

/**
 * GET /api/search/suggestions
 * Get search suggestions/autocomplete
 */
router.get('/suggestions', auth, asyncHandler(async (req, res) => {
  const { q, limit = 10 } = req.query;

  if (!q || q.length < 2) {
    return sendSuccess(res, 'Suggestions retrieved', 200, { suggestions: [] });
  }

  const suggestions = await getSearchSuggestions(req.user._id, q, parseInt(limit));
  sendSuccess(res, 'Suggestions retrieved', 200, { suggestions });
}));

/**
 * GET /api/search/facets
 * Get available search facets
 */
router.get('/facets', auth, asyncHandler(async (req, res) => {
  try {
    const facets = await getSearchFacets(req.user._id);
    sendSuccess(res, 'Facets retrieved', 200, facets || {
      platforms: [],
      contentTypes: [],
      tags: [],
      statuses: []
    });
  } catch (error) {
    logger.error('Error fetching search facets', { error: error.message, userId: req.user._id });
    sendSuccess(res, 'Facets retrieved', 200, {
      platforms: [],
      contentTypes: [],
      tags: [],
      statuses: []
    });
  }
}));

/**
 * GET /api/search/discovery
 * Get content discovery recommendations
 */
router.get('/discovery', auth, asyncHandler(async (req, res) => {
  const {
    limit = 10,
    basedOn = 'performance',
    excludeIds = []
  } = req.query;

  const excludeArray = excludeIds ? (Array.isArray(excludeIds) ? excludeIds : excludeIds.split(',')) : [];

  const recommendations = await getDiscoveryRecommendations(req.user._id, {
    limit: parseInt(limit),
    basedOn,
    excludeIds: excludeArray
  });

  sendSuccess(res, 'Recommendations retrieved', 200, { recommendations });
}));

/**
 * POST /api/search/save
 * Save a search query
 */
router.post('/save', auth, asyncHandler(async (req, res) => {
  const { query, filters, name } = req.body;

  if (!query && !filters) {
    return sendError(res, 'Query or filters required', 400);
  }

  const savedSearch = await saveSearch(req.user._id, {
    query: query || '',
    filters: filters || {},
    name: name || query || 'Saved Search'
  });

  sendSuccess(res, 'Search saved', 201, savedSearch);
}));

/**
 * GET /api/search/saved
 * Get saved searches
 */
router.get('/saved', auth, asyncHandler(async (req, res) => {
  try {
    const searches = await getSavedSearches(req.user._id);
    sendSuccess(res, 'Saved searches retrieved', 200, { searches: searches || [] });
  } catch (error) {
    logger.error('Error fetching saved searches', { error: error.message, userId: req.user._id });
    sendSuccess(res, 'Saved searches retrieved', 200, { searches: [] });
  }
}));

/**
 * GET /api/search/history
 * Get search history
 */
router.get('/history', auth, asyncHandler(async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const history = await SearchHistory.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    sendSuccess(res, 'Search history retrieved', 200, { history: history || [] });
  } catch (error) {
    logger.error('Error fetching search history', { error: error.message, userId: req.user._id });
    sendSuccess(res, 'Search history retrieved', 200, { history: [] });
  }
}));

/**
 * GET /api/search/analytics
 * Get search analytics
 */
router.get('/analytics', auth, asyncHandler(async (req, res) => {
  const { period = 30 } = req.query;
  const analytics = await getSearchAnalytics(req.user._id, parseInt(period));
  sendSuccess(res, 'Search analytics retrieved', 200, analytics);
}));

/**
 * DELETE /api/search/history/:id
 * Delete search history item
 */
router.delete('/history/:id', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;

  await SearchHistory.findOneAndDelete({
    _id: id,
    userId: req.user._id
  });

  sendSuccess(res, 'History item deleted', 200);
}));

/**
 * DELETE /api/search/history
 * Clear all search history
 */
router.delete('/history', auth, asyncHandler(async (req, res) => {
  await SearchHistory.deleteMany({ userId: req.user._id });
  sendSuccess(res, 'Search history cleared', 200);
}));

/**
 * POST /api/search/natural
 * Natural language search
 */
router.post('/natural', auth, asyncHandler(async (req, res) => {
  const { query } = req.body;

  if (!query || query.trim().length === 0) {
    return sendError(res, 'Search query is required', 400);
  }

  // Parse natural language query
  const parsed = await parseNaturalLanguageQuery(query);
  
  // Enhance with AI if needed
  const enhanced = await enhanceQueryWithAI(query);

  // Perform search with parsed filters
  const results = await facetedSearch(req.user._id, parsed.searchTerms.join(' '), {
    ...parsed.filters,
    ...(enhanced ? { contentType: enhanced.contentType, platform: enhanced.platform } : {})
  });

  // Save to history
  try {
    await SearchHistory.create({
      userId: req.user._id,
      query,
      filters: parsed.filters,
      resultCount: results.results.length,
      searchType: 'natural'
    });
  } catch (error) {
    logger.warn('Error saving search history', { error: error.message });
  }

  sendSuccess(res, 'Natural language search completed', 200, {
    results: results.results,
    facets: results.facets,
    parsed,
    enhanced
  });
}));

/**
 * POST /api/search/cluster
 * Cluster search results
 */
router.post('/cluster', auth, asyncHandler(async (req, res) => {
  const { results, maxClusters = 5 } = req.body;

  if (!results || !Array.isArray(results)) {
    return sendError(res, 'Results array is required', 400);
  }

  const clusters = await clusterSearchResults(results, maxClusters);
  sendSuccess(res, 'Results clustered', 200, clusters);
}));

/**
 * POST /api/search/click
 * Track search result click
 */
router.post('/click', auth, asyncHandler(async (req, res) => {
  const { searchId, contentId, position, query } = req.body;

  if (!contentId || position === undefined) {
    return sendError(res, 'Content ID and position are required', 400);
  }

  await trackSearchClick(req.user._id, searchId, contentId, position, query);
  sendSuccess(res, 'Click tracked', 200);
}));

/**
 * GET /api/search/preview/:contentId
 * Get search result preview
 */
router.get('/preview/:contentId', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;

  const preview = await getSearchResultPreview(contentId, req.user._id);
  if (!preview) {
    return sendError(res, 'Content not found', 404);
  }

  sendSuccess(res, 'Preview retrieved', 200, preview);
}));

/**
 * POST /api/search/alerts
 * Create search alert
 */
router.post('/alerts', auth, asyncHandler(async (req, res) => {
  const { name, query, filters, frequency } = req.body;

  if (!name) {
    return sendError(res, 'Alert name is required', 400);
  }

  const alert = await createSearchAlert(req.user._id, {
    name,
    query: query || '',
    filters: filters || {},
    frequency: frequency || 'daily'
  });

  sendSuccess(res, 'Search alert created', 201, alert);
}));

/**
 * GET /api/search/alerts
 * Get user's search alerts
 */
router.get('/alerts', auth, asyncHandler(async (req, res) => {
  const alerts = await getUserAlerts(req.user._id);
  sendSuccess(res, 'Alerts retrieved', 200, { alerts });
}));

/**
 * POST /api/search/alerts/:alertId/toggle
 * Toggle alert active status
 */
router.post('/alerts/:alertId/toggle', auth, asyncHandler(async (req, res) => {
  const { alertId } = req.params;
  const { isActive } = req.body;

  const alert = await toggleAlert(alertId, req.user._id, isActive);
  sendSuccess(res, `Alert ${isActive ? 'activated' : 'deactivated'}`, 200, alert);
}));

/**
 * DELETE /api/search/alerts/:alertId
 * Delete search alert
 */
router.delete('/alerts/:alertId', auth, asyncHandler(async (req, res) => {
  const { alertId } = req.params;

  await deleteAlert(alertId, req.user._id);
  sendSuccess(res, 'Alert deleted', 200);
}));

module.exports = router;
