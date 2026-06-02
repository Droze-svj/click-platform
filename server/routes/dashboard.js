// Dashboard routes

const express = require('express');
const auth = require('../middleware/auth');
const { createClient } = require('@supabase/supabase-js');
const asyncHandler = require('../middleware/asyncHandler');
const logger = require('../utils/logger');
const { ensureObjectId } = require('../utils/devUser');
const Content = require('../models/Content');
const ScheduledPost = require('../models/ScheduledPost');
const AudienceGrowth = require('../models/AudienceGrowth');

const router = express.Router();

// Initialize Supabase client (only if configured)
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  try {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    logger.info('Supabase client initialized successfully in dashboard routes');
  } catch (error) {
    logger.warn('Failed to initialize Supabase client in dashboard routes', { error: error.message });
    supabase = null;
  }
} else {
  logger.warn('Supabase not configured in dashboard routes. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
}

/**
 * GET /api/dashboard/stats
 * Get user dashboard statistics
 */
router.get('/stats', auth, asyncHandler(async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    // Content/ScheduledPost.userId are Strings (support both ObjectIds and
    // Supabase UUIDs); AudienceGrowth.userId is an ObjectId. Scope each query
    // with the right form. Every metric is computed independently and guarded
    // so a single failing query can't blank out the whole dashboard.
    const uidStr = String(userId);
    const uidObj = ensureObjectId(userId);

    const [postsCount, engagement, followersCount] = await Promise.all([
      // Real published post count (all-time).
      ScheduledPost.countDocuments({ userId: uidStr, status: 'posted' }).catch((e) => {
        logger.warn('dashboard postsCount query failed', { error: e.message });
        return 0;
      }),
      // Real engagement rate = total engagement / total reach across posted posts.
      ScheduledPost.aggregate([
        { $match: { userId: uidStr, status: 'posted' } },
        {
          $group: {
            _id: null,
            totalEngagement: { $sum: { $ifNull: ['$analytics.engagement', 0] } },
            totalReach: { $sum: { $ifNull: ['$analytics.reach', 0] } },
          },
        },
      ]).then((rows) => {
        const r = rows[0] || { totalEngagement: 0, totalReach: 0 };
        return r.totalReach > 0
          ? parseFloat(((r.totalEngagement / r.totalReach) * 100).toFixed(2))
          : 0;
      }).catch((e) => {
        logger.warn('dashboard engagement query failed', { error: e.message });
        return 0;
      }),
      // Real follower count = sum of the latest snapshot per connected platform.
      AudienceGrowth.aggregate([
        { $match: { userId: uidObj } },
        { $sort: { snapshotDate: -1 } },
        { $group: { _id: '$platform', currentFollowers: { $first: '$followers.current' } } },
        { $group: { _id: null, total: { $sum: '$currentFollowers' } } },
      ]).then((rows) => rows[0]?.total || 0).catch((e) => {
        logger.warn('dashboard followers query failed', { error: e.message });
        return 0;
      }),
    ]);

    const stats = {
      postsCount,
      followersCount,
      engagementRate: engagement,
      subscriptionStatus: req.user?.subscription?.status || 'trial',
      trialDaysLeft: req.user?.subscription?.status === 'trial' ?
        Math.max(0, Math.ceil((new Date(req.user.subscription?.endDate || Date.now()) - new Date()) / (1000 * 60 * 60 * 24))) : 0
    };

    // Real recent activity: merge the user's most recent content + posts.
    let recentActivity = [];
    try {
      const [recentContent, recentPosts] = await Promise.all([
        Content.find({ userId: uidStr })
          .select('type status createdAt')
          .sort({ createdAt: -1 })
          .limit(5)
          .lean(),
        ScheduledPost.find({ userId: uidStr, status: 'posted' })
          .select('platform postedAt')
          .sort({ postedAt: -1 })
          .limit(5)
          .lean(),
      ]);

      const contentActivity = (recentContent || []).map((c) => ({
        id: String(c._id),
        type: 'content',
        message: `${c.type ? c.type[0].toUpperCase() + c.type.slice(1) : 'Content'} ${c.status === 'completed' ? 'ready' : c.status}`,
        timestamp: c.createdAt,
        icon: '🎬',
      }));
      const postActivity = (recentPosts || []).map((p) => ({
        id: String(p._id),
        type: 'post',
        message: `Published to ${p.platform}`,
        timestamp: p.postedAt,
        icon: '🚀',
      }));

      recentActivity = [...contentActivity, ...postActivity]
        .filter((a) => a.timestamp)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 8);
    } catch (e) {
      logger.warn('dashboard recentActivity query failed', { error: e.message });
    }

    // New user with no activity yet — show the welcome card instead of empty.
    if (recentActivity.length === 0) {
      recentActivity = [{
        id: 'welcome',
        type: 'welcome',
        message: 'Welcome to Click Platform!',
        timestamp: req.user?.created_at || new Date().toISOString(),
        icon: '🎉',
      }];
    }

    res.json({
      success: true,
      stats,
      recentActivity
    });

  } catch (error) {
    logger.error('Dashboard stats error:', { error: error.message, stack: error.stack, userId: req.user?._id || req.user?.id });
    res.status(500).json({ success: false, error: 'Failed to load dashboard stats' });
  }
}));

/**
 * GET /api/dashboard/overview
 * Get dashboard overview data
 */
router.get('/overview', auth, asyncHandler(async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const overview = {
      user: {
        id: req.user?.id || req.user?._id,
        name: req.user?.name || 'User',
        email: req.user?.email || '',
        avatar: req.user?.avatar || null,
        subscription: req.user?.subscription || null,
        emailVerified: req.user?.email_verified || false
      },
      quickActions: [
        {
          id: 'create-post',
          title: 'Create Post',
          description: 'Create a new social media post',
          icon: '✍️',
          action: '/create-post'
        },
        {
          id: 'view-analytics',
          title: 'View Analytics',
          description: 'Check your performance metrics',
          icon: '📊',
          action: '/analytics'
        },
        {
          id: 'manage-profile',
          title: 'Manage Profile',
          description: 'Update your profile settings',
          icon: '👤',
          action: '/profile'
        }
      ],
      notifications: [
        {
          id: '1',
          type: 'info',
          title: 'Welcome!',
          message: 'Your account is ready. Start creating amazing content!',
          read: false,
          timestamp: new Date().toISOString()
        }
      ]
    };

    res.json({
      success: true,
      overview
    });

  } catch (error) {
    const userId = req.user?._id || req.user?.id;
    logger.error('Dashboard overview error:', { error: error.message, stack: error.stack, userId });
    res.status(500).json({ success: false, error: 'Failed to load dashboard overview' });
  }
}));

module.exports = router;
