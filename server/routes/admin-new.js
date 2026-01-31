const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { requireAdmin, requireSuperAdmin } = require('../middleware/admin');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const logger = require('../utils/logger');
const router = express.Router();

// Initialize Supabase client (only if configured)
const getSupabaseClient = () => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  }
  try {
    return createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Failed to create Supabase client', { error: error.message });
    throw error;
  }
};

/**
 * GET /api/admin/dashboard
 * Admin dashboard overview
 */
router.get('/dashboard', auth, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const supabase = getSupabaseClient();

    // Get user statistics
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    const { count: verifiedUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('email_verified', true);

    // Get post statistics
    const { count: totalPosts } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true });

    const { count: publishedPosts } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published');

    // Get recent activity
    const { data: recentUsers } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    const { data: recentPosts } = await supabase
      .from('posts')
      .select('id, title, status, author_id, created_at, users!inner(email)')
      .order('created_at', { ascending: false })
      .limit(5);

    // Get platform account connections
    const { count: connectedAccounts } = await supabase
      .from('platform_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('is_connected', true);

    // Get system health metrics (mock for now)
    const systemHealth = {
      database: 'healthy',
      api: 'healthy',
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };

    res.json({
      success: true,
      overview: {
        users: {
          total: totalUsers || 0,
          verified: verifiedUsers || 0,
          unverified: (totalUsers || 0) - (verifiedUsers || 0)
        },
        posts: {
          total: totalPosts || 0,
          published: publishedPosts || 0,
          drafts: (totalPosts || 0) - (publishedPosts || 0)
        },
        social: {
          connected_accounts: connectedAccounts || 0
        }
      },
      recent_activity: {
        users: recentUsers || [],
        posts: recentPosts || []
      },
      system_health: systemHealth
    });

  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load admin dashboard'
    });
  }
}));

/**
 * GET /api/admin/users
 * Get users with pagination and filtering
 */
router.get('/users', auth, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      verified,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    const supabase = getSupabaseClient();
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase
      .from('users')
      .select('id, email, first_name, last_name, email_verified, email_verified_at, last_login_at, login_attempts, created_at, updated_at', { count: 'exact' });

    // Apply filters
    if (search) {
      query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
    }

    if (verified !== undefined) {
      query = query.eq('email_verified', verified === 'true');
    }

    // Apply sorting
    const validSortFields = ['created_at', 'email', 'first_name', 'last_login_at'];
    const sortField = validSortFields.includes(sort_by) ? sort_by : 'created_at';
    const ascending = sort_order === 'asc';

    query = query.order(sortField, { ascending }).range(offset, offset + parseInt(limit) - 1);

    const { data: users, error, count } = await query;

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      users: users || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        pages: Math.ceil((count || 0) / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Admin users list error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load users'
    });
  }
}));

/**
 * GET /api/admin/users/:id
 * Get detailed user information
 */
router.get('/users/:id', auth, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getSupabaseClient();

    // Get user details
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get user's posts
    const { data: posts } = await supabase
      .from('posts')
      .select('id, title, status, created_at, published_at')
      .eq('author_id', id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get user's connected accounts
    const { data: accounts } = await supabase
      .from('platform_accounts')
      .select('platform, username, display_name, is_connected, created_at')
      .eq('user_id', id);

    // Get user's analytics summary
    const { data: analytics } = await supabase
      .from('post_analytics')
      .select('platform, views, likes, shares, comments')
      .in('post_id',
        supabase
          .from('posts')
          .select('id')
          .eq('author_id', id)
      );

    const analyticsSummary = analytics?.reduce((acc, item) => ({
      total_views: acc.total_views + (item.views || 0),
      total_engagement: acc.total_engagement + (item.likes || 0) + (item.shares || 0) + (item.comments || 0)
    }), { total_views: 0, total_engagement: 0 }) || { total_views: 0, total_engagement: 0 };

    res.json({
      success: true,
      user,
      stats: {
        posts_count: posts?.length || 0,
        accounts_connected: accounts?.filter(a => a.is_connected).length || 0,
        ...analyticsSummary
      },
      posts: posts || [],
      accounts: accounts || []
    });

  } catch (error) {
    console.error('Admin user details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load user details'
    });
  }
}));

/**
 * PUT /api/admin/users/:id
 * Update user information (admin only)
 */
router.put('/users/:id', auth, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const {
      first_name,
      last_name,
      email_verified,
      subscription
    } = req.body;

    const supabase = getSupabaseClient();

    const updateData = {};
    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (email_verified !== undefined) {
      updateData.email_verified = email_verified;
      if (email_verified) {
        updateData.email_verified_at = new Date().toISOString();
      }
    }
    if (subscription !== undefined) updateData.subscription = subscription;

    const { data: user, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    logger.info(`Admin updated user ${id}`, { adminId: req.user.id, updates: updateData });

    res.json({
      success: true,
      message: 'User updated successfully',
      user
    });

  } catch (error) {
    console.error('Admin update user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user'
    });
  }
}));

/**
 * DELETE /api/admin/users/:id
 * Delete user (super admin only)
 */
router.delete('/users/:id', auth, requireSuperAdmin, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getSupabaseClient();

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', id)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Delete user's data (cascade will handle related records)
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    logger.info(`Super admin deleted user ${id}`, {
      adminId: req.user.id,
      deletedUserEmail: user.email
    });

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user'
    });
  }
}));

/**
 * GET /api/admin/posts
 * Get posts with moderation features
 */
router.get('/posts', auth, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      author_email,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    const supabase = getSupabaseClient();
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase
      .from('posts')
      .select(`
        id,
        title,
        content,
        status,
        created_at,
        published_at,
        updated_at,
        author_id,
        users!inner(email, first_name, last_name)
      `, { count: 'exact' });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (author_email) {
      query = query.eq('users.email', author_email);
    }

    // Apply sorting
    const validSortFields = ['created_at', 'published_at', 'updated_at', 'title'];
    const sortField = validSortFields.includes(sort_by) ? sort_by : 'created_at';
    const ascending = sort_order === 'asc';

    query = query.order(sortField, { ascending }).range(offset, offset + parseInt(limit) - 1);

    const { data: posts, error, count } = await query;

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      posts: posts || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        pages: Math.ceil((count || 0) / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Admin posts list error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load posts'
    });
  }
}));

/**
 * PUT /api/admin/posts/:id/moderate
 * Moderate a post (approve/reject)
 */
router.put('/posts/:id/moderate', auth, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body; // action: 'approve', 'reject', 'flag'

    if (!['approve', 'reject', 'flag'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid moderation action'
      });
    }

    const supabase = getSupabaseClient();

    // Get current post
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('id, title, status, author_id, users!inner(email)')
      .eq('id', id)
      .single();

    if (postError || !post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }

    const updateData = {};

    switch (action) {
      case 'approve':
        if (post.status === 'draft') {
          updateData.status = 'published';
          updateData.published_at = new Date().toISOString();
        }
        break;
      case 'reject':
        updateData.status = 'rejected';
        break;
      case 'flag':
        updateData.status = 'flagged';
        break;
    }

    const { data: updatedPost, error } = await supabase
      .from('posts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.info(`Admin moderated post ${id}`, {
      adminId: req.user.id,
      action,
      reason,
      postTitle: post.title,
      authorEmail: post.users.email
    });

    res.json({
      success: true,
      message: `Post ${action}d successfully`,
      post: updatedPost
    });

  } catch (error) {
    console.error('Admin moderate post error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to moderate post'
    });
  }
}));

/**
 * GET /api/admin/analytics
 * System-wide analytics for admin
 */
router.get('/analytics', auth, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const supabase = getSupabaseClient();

    // User growth over time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: userGrowth } = await supabase
      .from('users')
      .select('created_at')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: true });

    const dailyUserGrowth = {};
    userGrowth?.forEach(user => {
      const date = user.created_at.split('T')[0];
      dailyUserGrowth[date] = (dailyUserGrowth[date] || 0) + 1;
    });

    // Post creation over time
    const { data: postGrowth } = await supabase
      .from('posts')
      .select('created_at')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: true });

    const dailyPostGrowth = {};
    postGrowth?.forEach(post => {
      const date = post.created_at.split('T')[0];
      dailyPostGrowth[date] = (dailyPostGrowth[date] || 0) + 1;
    });

    // Platform distribution
    const { data: platformStats } = await supabase
      .from('platform_accounts')
      .select('platform, is_connected')
      .eq('is_connected', true);

    const platformDistribution = {};
    platformStats?.forEach(account => {
      platformDistribution[account.platform] = (platformDistribution[account.platform] || 0) + 1;
    });

    // Engagement metrics
    const { data: engagementData } = await supabase
      .from('post_analytics')
      .select('views, likes, shares, comments');

    const totalEngagement = engagementData?.reduce((acc, item) => ({
      views: acc.views + (item.views || 0),
      likes: acc.likes + (item.likes || 0),
      shares: acc.shares + (item.shares || 0),
      comments: acc.comments + (item.comments || 0)
    }), { views: 0, likes: 0, shares: 0, comments: 0 }) || { views: 0, likes: 0, shares: 0, comments: 0 };

    res.json({
      success: true,
      system_analytics: {
        user_growth: dailyUserGrowth,
        post_growth: dailyPostGrowth,
        platform_distribution: platformDistribution,
        total_engagement: totalEngagement,
        period: '30 days'
      }
    });

  } catch (error) {
    console.error('Admin analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load admin analytics'
    });
  }
}));

module.exports = router;
