// Integrations: Google (YouTube Data API + Search Console).
//
// Read-only endpoints that surface real channel-level + site-level data
// flowing from the user's connected Google account. The same data feeds
// the prompt builder's `getTopPerformingPlaybook` so the "improves over
// time" loop benefits even when the user never opens these endpoints.
//
// All routes return `{ connected: false, reason: 'google_not_connected' }`
// rather than 500 when Google isn't linked, so the dashboard can render
// a graceful "Connect Google" CTA instead of an error toast.

const express = require('express');
const auth = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const youtubeAnalytics = require('../../services/youtubeAnalyticsService');
const searchConsole = require('../../services/searchConsoleService');

const router = express.Router();

function uid(req) {
  return req.userId || req.user?._id || req.user?.id;
}

/**
 * GET /api/integrations/youtube/analytics?days=28&accountId=...
 * Channel-level metrics (views, watch time, subs gained, top videos).
 */
router.get('/youtube/analytics', auth, asyncHandler(async (req, res) => {
  const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 28));
  const accountId = req.query.accountId || null;
  try {
    const [metrics, topVideos] = await Promise.all([
      youtubeAnalytics.getChannelMetrics(uid(req), { days, accountId }),
      youtubeAnalytics.getTopVideos(uid(req), { days, limit: 10, accountId }),
    ]);
    sendSuccess(res, 'YouTube analytics fetched', 200, { metrics, topVideos });
  } catch (err) {
    logger.error('YouTube analytics route error', { error: err.message });
    sendError(res, err.message || 'YouTube analytics fetch failed', 500);
  }
}));

/**
 * GET /api/integrations/youtube/retention/:videoId
 * Audience retention curve for one video.
 */
router.get('/youtube/retention/:videoId', auth, asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const accountId = req.query.accountId || null;
  try {
    const data = await youtubeAnalytics.getVideoRetention(uid(req), videoId, { accountId });
    sendSuccess(res, 'YouTube retention fetched', 200, data);
  } catch (err) {
    logger.error('YouTube retention route error', { error: err.message, videoId });
    sendError(res, err.message || 'YouTube retention fetch failed', 500);
  }
}));

/**
 * GET /api/integrations/search-console/sites
 */
router.get('/search-console/sites', auth, asyncHandler(async (req, res) => {
  const accountId = req.query.accountId || null;
  try {
    const data = await searchConsole.listSites(uid(req), { accountId });
    sendSuccess(res, 'Search Console sites fetched', 200, data);
  } catch (err) {
    logger.error('Search Console sites route error', { error: err.message });
    sendError(res, err.message || 'Search Console sites fetch failed', 500);
  }
}));

/**
 * GET /api/integrations/search-console/queries?siteUrl=...&days=28&limit=50
 */
router.get('/search-console/queries', auth, asyncHandler(async (req, res) => {
  const { siteUrl } = req.query;
  if (!siteUrl) return sendError(res, 'siteUrl query param is required', 400);
  const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 28));
  const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const accountId = req.query.accountId || null;
  try {
    const data = await searchConsole.getTopQueries(uid(req), siteUrl, { days, limit, accountId });
    sendSuccess(res, 'Search Console queries fetched', 200, data);
  } catch (err) {
    logger.error('Search Console queries route error', { error: err.message, siteUrl });
    sendError(res, err.message || 'Search Console queries fetch failed', 500);
  }
}));

/**
 * GET /api/integrations/search-console/query-trend?siteUrl=...&query=...
 */
router.get('/search-console/query-trend', auth, asyncHandler(async (req, res) => {
  const { siteUrl, query } = req.query;
  if (!siteUrl || !query) return sendError(res, 'siteUrl and query are required', 400);
  const accountId = req.query.accountId || null;
  try {
    const data = await searchConsole.getQueryTrend(uid(req), siteUrl, query, { accountId });
    sendSuccess(res, 'Query trend fetched', 200, data);
  } catch (err) {
    logger.error('Search Console query-trend route error', { error: err.message, siteUrl, query });
    sendError(res, err.message || 'Query trend fetch failed', 500);
  }
}));

module.exports = router;
