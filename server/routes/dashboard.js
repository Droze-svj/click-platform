// Dashboard routes

const express = require('express');
const auth = require('../middleware/auth');
const { createClient } = require('@supabase/supabase-js');
const asyncHandler = require('../middleware/asyncHandler');
const logger = require('../utils/logger');

const router = express.Router();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET /api/dashboard/stats
 * Get user dashboard statistics
 */
router.get('/stats', auth, asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user stats (mock data for now - in production, calculate from actual data)
    const stats = {
      postsCount: 0,
      followersCount: 0,
      engagementRate: 0,
      subscriptionStatus: req.user.subscription?.status || 'trial',
      trialDaysLeft: req.user.subscription?.status === 'trial' ?
        Math.max(0, Math.ceil((new Date(req.user.subscription?.endDate) - new Date()) / (1000 * 60 * 60 * 24))) : 0
    };

    // Get recent activity (mock data for now)
    const recentActivity = [
      {
        id: '1',
        type: 'welcome',
        message: 'Welcome to Click Platform!',
        timestamp: req.user.created_at,
        icon: '🎉'
      }
    ];

    res.json({
      success: true,
      stats,
      recentActivity
    });

  } catch (error) {
    logger.error('Dashboard stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to load dashboard stats' });
  }
}));

/**
 * GET /api/dashboard/overview
 * Get dashboard overview data
 */
router.get('/overview', auth, asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;

    const overview = {
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        avatar: req.user.avatar,
        subscription: req.user.subscription,
        emailVerified: req.user.email_verified
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
    logger.error('Dashboard overview error:', error);
    res.status(500).json({ success: false, error: 'Failed to load dashboard overview' });
  }
}));

module.exports = router;
