const express = require('express');
const performanceMonitor = require('../../utils/performanceMonitor');
const auth = require('../../middleware/auth');
const { requireRole } = require('../../middleware/roleBasedAccess');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess } = require('../../utils/response');
const router = express.Router();

// Initialize Supabase client lazily. Returns null when env vars are missing
// so handlers degrade to empty/mock data instead of throwing 500. Same
// pattern as analytics/core.js — keeps the dashboard usable on Mongo-only
// deployments.
const isSupabaseConfigured = () =>
  Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const getSupabaseClient = () => {
  if (!isSupabaseConfigured()) return null;
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

    // Supabase-less environments fall through to the existing empty-state
    // response below, which already returns realistic seed numbers so the
    // dashboard renders without 500.
    let analytics = [];
    if (supabase) {
      const { data: postRows } = await supabase
        .from('posts')
        .select('id')
        .eq('author_id', userId);
      const postIds = Array.isArray(postRows) ? postRows.map(r => r.id) : [];

      let data = [];
      let error = null;

      if (postIds.length > 0) {
        const { data: sbData, error: sbError } = await supabase
          .from('post_analytics')
          .select('views, likes, shares, comments, engagement_rate')
          .in('post_id', postIds);
        data = sbData;
        error = sbError;
      }

      if (error) throw error;
      analytics = data || [];
    }

    // New-account fallback. Previously this returned a "phantom" response
    // labelled `SPECTRE_SIMULATION` with hardcoded 4.5M views / 284k
    // engagement — i.e. a brand-new paying customer would log in and see
    // 4.5 million views on posts they hadn't made. That is the single
    // worst credibility hit a creator-tool can ship. Return honest zeros
    // and let the dashboard render the cold-start UX.
    if (!analytics || analytics.length === 0) {
      return res.json({
        success: true,
        total_views: 0,
        total_engagement: 0,
        overall_engagement_rate: 0,
        sync_nodes: 0,
        isFallback: true,
        status: 'COLD_START',
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
    // Don't leak `GLOBAL_SYNC_FAILURE` to a new user — schema mismatches,
    // RLS denials, or transient Supabase errors should all degrade to
    // honest zeros so the dashboard renders cleanly.
    const logger = require('../../utils/logger');
    logger.warn('Global metric query failed; returning zeros', { error: error.message });
    res.json({
      success: true,
      total_views: 0,
      total_engagement: 0,
      overall_engagement_rate: 0,
      sync_nodes: 0,
      isFallback: true,
      status: 'COLD_START',
    });
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







