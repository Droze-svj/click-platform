// User Analytics Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  getUserAnalytics,
  trackPageView,
  trackFeatureUsage,
} = require('../../services/analyticsService');
const { sendSuccess, sendError } = require('../../utils/response');
const asyncHandler = require('../../middleware/asyncHandler');
const router = express.Router();

/**
 * GET /api/analytics/user
 * Get user analytics (privacy-compliant)
 */
router.get('/', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  
  // Check both host header and x-forwarded-host (for proxy requests)
  const host = req.headers.host || req.headers['x-forwarded-host'] || '';
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') || 
                      (typeof req.headers['x-forwarded-for'] === 'string' && req.headers['x-forwarded-for'].includes('127.0.0.1'));
  const allowDevMode = process.env.NODE_ENV !== 'production' || isLocalhost;
  
  // In development mode OR when on localhost, return mock data for dev users
  if (allowDevMode && userId && (userId.toString().startsWith('dev-') || userId.toString() === 'dev-user-123')) {
    return sendSuccess(res, 'User analytics retrieved (dev mode)', 200, {
      timeRange: req.query.timeRange || '30d',
      content: { created: 0, scheduled: 0, published: 0 },
      usage: { videosProcessed: 0, contentGenerated: 0, quotesCreated: 0, postsScheduled: 0, scriptsGenerated: 0 },
      timestamp: new Date()
    });
  }
  
  const timeRange = req.query.timeRange || '30d';
  let analytics;
  try {
    analytics = await getUserAnalytics(userId, timeRange);
  } catch (error) {
    // Handle CastError gracefully for dev mode
    if (allowDevMode && (error.name === 'CastError' || error.message?.includes('Cast to ObjectId'))) {
      return sendSuccess(res, 'User analytics retrieved (dev mode)', 200, {
        timeRange,
        content: { created: 0, scheduled: 0, published: 0 },
        usage: { videosProcessed: 0, contentGenerated: 0, quotesCreated: 0, postsScheduled: 0, scriptsGenerated: 0 },
        timestamp: new Date()
      });
    }
    throw error;
  }
  
  if (analytics.error) {
    return sendError(res, analytics.error, 403);
  }
  
  sendSuccess(res, 'User analytics retrieved', 200, analytics);
}));

/**
 * POST /api/analytics/track
 * Track user event (privacy-compliant)
 */
router.post('/track', auth, asyncHandler(async (req, res) => {
  const { eventType, metadata = {} } = req.body;
  
  if (!eventType) {
    return sendError(res, 'Event type is required', 400);
  }

  const result = await trackFeatureUsage(req.user._id, eventType, metadata);
  sendSuccess(res, 'Event tracked', 200, result);
}));

/**
 * POST /api/analytics/track-page
 * Track page view (privacy-compliant)
 */
router.post('/track-page', auth, asyncHandler(async (req, res) => {
  const { page, metadata = {} } = req.body;
  
  if (!page) {
    return sendError(res, 'Page is required', 400);
  }

  const result = await trackPageView(req.user._id, page, metadata);
  sendSuccess(res, 'Page view tracked', 200, result);
}));

/**
 * GET /api/analytics/user/export
 * Export user analytics
 */
router.get('/export', auth, asyncHandler(async (req, res) => {
  const { format = 'csv', timeRange = '30d' } = req.query;
  const {
    exportUserAnalyticsToCSV,
    exportUserAnalyticsToJSON,
  } = require('../../services/analyticsExportService');

  let exported;
  let contentType;
  let filename;

  if (format === 'json') {
    exported = await exportUserAnalyticsToJSON(req.user._id, timeRange);
    contentType = 'application/json';
    filename = `analytics-${req.user._id}-${Date.now()}.json`;
  } else {
    exported = await exportUserAnalyticsToCSV(req.user._id, timeRange);
    contentType = 'text/csv';
    filename = `analytics-${req.user._id}-${Date.now()}.csv`;
  }

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(exported);
}));

module.exports = router;

