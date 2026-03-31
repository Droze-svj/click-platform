const express = require('express');
const performanceMonitor = require('../../utils/performanceMonitor');
const auth = require('../../middleware/auth');
const { requireRole } = require('../../middleware/roleBasedAccess');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess } = require('../../utils/response');
const router = express.Router();

// Initialize Supabase client lazily
const getSupabaseClient = () => {
  const { createClient } = require('@supabase/supabase-js');
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
};

/**
 * @swagger
 * /api/analytics/performance/global:
 *   get:
 *     summary: Get global aggregated metrics for the current creator (Sovereign Matrix)
 *     tags: [Analytics]
 */
router.get('/global', auth, asyncHandler(async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const userId = req.user.id;

    const { data: analytics, error } = await supabase
      .from('post_analytics')
      .select('views, likes, shares, comments, engagement_rate')
      .in('post_id', 
        supabase.from('posts').select('id').eq('author_id', userId)
      );

    if (error) throw error;

    // Phantom Fallback for New Accounts
    if (!analytics || analytics.length === 0) {
      return res.json({
        success: true,
        total_views: 4520000,
        total_engagement: 284000,
        overall_engagement_rate: 6.2,
        sync_nodes: 84,
        isFallback: true,
        status: 'SPECTRE_SIMULATION'
      });
    }

    const totalViews = analytics.reduce((s, a) => s + (a.views || 0), 0);
    const totalLikes = analytics.reduce((s, a) => s + (a.likes || 0), 0);
    const totalShares = analytics.reduce((s, a) => s + (a.shares || 0), 0);
    const totalComments = analytics.reduce((s, a) => s + (a.comments || 0), 0);
    const totalEngagement = totalLikes + totalShares + totalComments;
    const avgRate = (analytics.reduce((s, a) => s + (a.engagement_rate || 0), 0) / analytics.length).toFixed(2);

    res.json({
      success: true,
      total_views: totalViews,
      total_engagement: totalEngagement,
      overall_engagement_rate: avgRate,
      sync_nodes: analytics.length,
      isFallback: false,
      status: 'SYNCHRONIZED_ACTIVE_STREAM'
    });
  } catch (error) {
    console.error('Global performance error:', error);
    res.status(500).json({ success: false, error: 'GLOBAL_SYNC_FAILURE' });
  }
}));

/**
 * @swagger
 * /api/analytics/performance:
 *   get:
 *     summary: Get system performance metrics (Admin Only)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', auth, requireRole('admin'), asyncHandler(async (req, res) => {
  const metrics = performanceMonitor.getMetrics();
  sendSuccess(res, 'Performance metrics fetched', 200, metrics);
}));

/**
 * @swagger
 * /api/analytics/performance/summary:
 *   get:
 *     summary: Get system performance summary (Admin Only)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 */
router.get('/summary', auth, requireRole('admin'), asyncHandler(async (req, res) => {
  const summary = performanceMonitor.getSummary();
  sendSuccess(res, 'Performance summary fetched', 200, summary);
}));

/**
 * @swagger
 * /api/analytics/performance/reset:
 *   post:
 *     summary: Reset performance metrics (Admin Only)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 */
router.post('/reset', auth, requireRole('admin'), asyncHandler(async (req, res) => {
  performanceMonitor.reset();
  sendSuccess(res, 'Performance metrics reset', 200);
}));

module.exports = router;







