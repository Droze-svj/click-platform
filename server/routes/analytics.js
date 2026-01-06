const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const logger = require('../utils/logger');
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
 * GET /api/analytics/posts/:postId
 * Get analytics for a specific post
 */
router.get('/posts/:postId', auth, asyncHandler(async (req, res) => {
  try {
    const { postId } = req.params;
    const { platform } = req.query;

    // Verify user owns the post
    const supabase = getSupabaseClient();
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('id, author_id')
      .eq('id', postId)
      .eq('author_id', req.user.id)
      .single();

    if (postError || !post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    // Get analytics data
    let query = supabase
      .from('post_analytics')
      .select(`
        id,
        platform,
        platform_post_id,
        platform_post_url,
        views,
        likes,
        shares,
        comments,
        retweets,
        saves,
        engagement_rate,
        click_through_rate,
        posted_at,
        last_updated,
        metadata,
        created_at
      `)
      .eq('post_id', postId);

    if (platform) {
      query = query.eq('platform', platform);
    }

    const { data: analytics, error } = await query;

    if (error) {
      console.error('Analytics fetch error:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
    }

    // Get content insights
    const { data: insights } = await supabase
      .from('content_insights')
      .select('*')
      .eq('post_id', postId)
      .eq('user_id', req.user.id)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    // Calculate aggregate metrics
    const aggregateMetrics = analytics?.reduce((acc, curr) => {
      return {
        total_views: acc.total_views + (curr.views || 0),
        total_likes: acc.total_likes + (curr.likes || 0),
        total_shares: acc.total_shares + (curr.shares || 0),
        total_comments: acc.total_comments + (curr.comments || 0),
        total_retweets: acc.total_retweets + (curr.retweets || 0),
        total_saves: acc.total_saves + (curr.saves || 0),
        platforms_count: acc.platforms_count + 1
      };
    }, {
      total_views: 0,
      total_likes: 0,
      total_shares: 0,
      total_comments: 0,
      total_retweets: 0,
      total_saves: 0,
      platforms_count: 0
    }) || {
      total_views: 0,
      total_likes: 0,
      total_shares: 0,
      total_comments: 0,
      total_retweets: 0,
      total_saves: 0,
      platforms_count: 0
    };

    // Calculate overall engagement rate
    const totalEngagement = aggregateMetrics.total_likes + aggregateMetrics.total_comments + aggregateMetrics.total_shares;
    aggregateMetrics.overall_engagement_rate = aggregateMetrics.total_views > 0
      ? (totalEngagement / aggregateMetrics.total_views * 100).toFixed(2)
      : 0;

    res.json({
      success: true,
      post_id: postId,
      analytics: analytics || [],
      insights: insights || null,
      aggregate: aggregateMetrics
    });

  } catch (error) {
    console.error('Get post analytics error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
}));

/**
 * POST /api/analytics/posts/:postId
 * Update analytics for a post (called by platform webhooks or manual updates)
 */
router.post('/posts/:postId', auth, asyncHandler(async (req, res) => {
  try {
    const { postId } = req.params;
    const {
      platform,
      platform_post_id,
      platform_post_url,
      views,
      likes,
      shares,
      comments,
      retweets,
      saves,
      posted_at,
      metadata
    } = req.body;

    if (!platform) {
      return res.status(400).json({ success: false, error: 'Platform is required' });
    }

    // Verify user owns the post
    const supabase = getSupabaseClient();
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('id, author_id')
      .eq('id', postId)
      .eq('author_id', req.user.id)
      .single();

    if (postError || !post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    // Calculate engagement rate
    const totalEngagement = (likes || 0) + (comments || 0) + (shares || 0);
    const engagementRate = (views || 0) > 0 ? (totalEngagement / views * 100) : 0;

    // Upsert analytics data
    const { data: analytics, error } = await supabase
      .from('post_analytics')
      .upsert({
        post_id: postId,
        platform,
        platform_post_id,
        platform_post_url,
        views: views || 0,
        likes: likes || 0,
        shares: shares || 0,
        comments: comments || 0,
        retweets: retweets || 0,
        saves: saves || 0,
        engagement_rate: engagementRate,
        posted_at: posted_at ? new Date(posted_at).toISOString() : null,
        metadata: metadata || {},
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'post_id,platform'
      })
      .select()
      .single();

    if (error) {
      console.error('Analytics update error:', error);
      return res.status(500).json({ success: false, error: 'Failed to update analytics' });
    }

    // Record engagement history
    await supabase
      .from('engagement_history')
      .insert({
        post_analytics_id: analytics.id,
        views: views || 0,
        likes: likes || 0,
        shares: shares || 0,
        comments: comments || 0
      });

    res.json({
      success: true,
      message: 'Analytics updated successfully',
      analytics
    });

  } catch (error) {
    console.error('Update post analytics error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
}));

/**
 * GET /api/analytics/dashboard
 * Get dashboard overview with key metrics
 */
router.get('/dashboard', auth, asyncHandler(async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const userId = req.user.id;

    // Get total posts count
    const { count: totalPosts } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', userId);

    // Get published posts count
    const { count: publishedPosts } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', userId)
      .eq('status', 'published');

    // Get total views across all posts
    const { data: viewsData } = await supabase
      .from('post_analytics')
      .select('views')
      .in('post_id',
        supabase
          .from('posts')
          .select('id')
          .eq('author_id', userId)
      );

    const totalViews = viewsData?.reduce((sum, item) => sum + (item.views || 0), 0) || 0;

    // Get total engagement
    const { data: engagementData } = await supabase
      .from('post_analytics')
      .select('likes, shares, comments')
      .in('post_id',
        supabase
          .from('posts')
          .select('id')
          .eq('author_id', userId)
      );

    const totalEngagement = engagementData?.reduce((sum, item) =>
      sum + (item.likes || 0) + (item.shares || 0) + (item.comments || 0), 0
    ) || 0;

    // Get recent posts performance (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentPosts } = await supabase
      .from('posts')
      .select(`
        id,
        title,
        status,
        published_at,
        created_at,
        post_analytics (
          platform,
          views,
          likes,
          shares,
          comments,
          engagement_rate
        )
      `)
      .eq('author_id', userId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    // Get platform distribution
    const { data: platformStats } = await supabase
      .from('post_analytics')
      .select('platform, views, likes, shares, comments')
      .in('post_id',
        supabase
          .from('posts')
          .select('id')
          .eq('author_id', userId)
      );

    const platformDistribution = {};
    platformStats?.forEach(stat => {
      if (!platformDistribution[stat.platform]) {
        platformDistribution[stat.platform] = {
          posts: 0,
          views: 0,
          engagement: 0
        };
      }
      platformDistribution[stat.platform].posts += 1;
      platformDistribution[stat.platform].views += stat.views || 0;
      platformDistribution[stat.platform].engagement += (stat.likes || 0) + (stat.shares || 0) + (stat.comments || 0);
    });

    // Get top performing posts
    const { data: topPosts } = await supabase
      .from('posts')
      .select(`
        id,
        title,
        published_at,
        post_analytics (
          platform,
          views,
          likes,
          shares,
          comments,
          engagement_rate
        )
      `)
      .eq('author_id', userId)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(5);

    // Calculate performance scores for top posts
    const topPostsWithScores = topPosts?.map(post => {
      const analytics = post.post_analytics || [];
      const totalViews = analytics.reduce((sum, a) => sum + (a.views || 0), 0);
      const totalEngagement = analytics.reduce((sum, a) => sum + (a.likes || 0) + (a.shares || 0) + (a.comments || 0), 0);

      return {
        ...post,
        total_views: totalViews,
        total_engagement: totalEngagement,
        avg_engagement_rate: totalViews > 0 ? (totalEngagement / totalViews * 100).toFixed(2) : 0
      };
    }).sort((a, b) => b.total_engagement - a.total_engagement) || [];

    res.json({
      success: true,
      overview: {
        total_posts: totalPosts || 0,
        published_posts: publishedPosts || 0,
        total_views: totalViews,
        total_engagement: totalEngagement,
        avg_engagement_rate: totalViews > 0 ? (totalEngagement / totalViews * 100).toFixed(2) : 0
      },
      platform_distribution: platformDistribution,
      recent_posts: recentPosts || [],
      top_performing_posts: topPostsWithScores
    });

  } catch (error) {
    console.error('Get analytics dashboard error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
}));

/**
 * GET /api/analytics/insights/:postId
 * Generate AI insights for a post
 */
router.get('/insights/:postId', auth, asyncHandler(async (req, res) => {
  try {
    const { postId } = req.params;

    // Verify user owns the post
    const supabase = getSupabaseClient();
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('id, author_id, title, content, tags, categories')
      .eq('id', postId)
      .eq('author_id', req.user.id)
      .single();

    if (postError || !post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    // Check if insights already exist and are fresh (less than 7 days old)
    const { data: existingInsights } = await supabase
      .from('content_insights')
      .select('*')
      .eq('post_id', postId)
      .eq('user_id', req.user.id)
      .gte('expires_at', new Date().toISOString())
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    if (existingInsights) {
      return res.json({
        success: true,
        insights: existingInsights,
        cached: true
      });
    }

    // Get analytics data for insights generation
    const { data: analytics } = await supabase
      .from('post_analytics')
      .select('*')
      .eq('post_id', postId);

    // Generate mock insights (in a real app, this would call an AI service)
    const insights = {
      post_id: postId,
      user_id: req.user.id,
      performance_score: Math.floor(Math.random() * 40) + 60, // 60-100 score
      best_posting_time: generateBestPostingTime(),
      recommended_hashtags: generateRecommendedHashtags(post.tags || []),
      content_improvements: generateContentImprovements(analytics || []),
      audience_reach_estimate: Math.floor(Math.random() * 50000) + 10000,
      trending_topics: generateTrendingTopics(post.categories || []),
      competitor_performance: generateCompetitorPerformance(),
      generated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };

    // Save insights to database
    const { data: savedInsights, error: saveError } = await supabase
      .from('content_insights')
      .insert(insights)
      .select()
      .single();

    if (saveError) {
      console.error('Save insights error:', saveError);
      // Return insights even if save fails
      return res.json({
        success: true,
        insights,
        cached: false,
        save_error: 'Failed to save insights'
      });
    }

    res.json({
      success: true,
      insights: savedInsights,
      cached: false
    });

  } catch (error) {
    console.error('Generate insights error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
}));

/**
 * GET /api/analytics/performance
 * Get performance trends over time
 */
router.get('/performance', auth, asyncHandler(async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const userId = req.user.id;
    const { period = '30' } = req.query; // days

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Get engagement history
    const { data: history } = await supabase
      .from('engagement_history')
      .select(`
        recorded_at,
        views,
        likes,
        shares,
        comments,
        post_analytics (
          platform,
          posts (
            title
          )
        )
      `)
      .in('post_analytics.post_id',
        supabase
          .from('posts')
          .select('id')
          .eq('author_id', userId)
      )
      .gte('recorded_at', startDate.toISOString())
      .order('recorded_at', { ascending: true });

    // Aggregate by date
    const dailyStats = {};
    history?.forEach(record => {
      const date = record.recorded_at.split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = {
          date,
          views: 0,
          likes: 0,
          shares: 0,
          comments: 0,
          posts_count: 0
        };
      }
      dailyStats[date].views += record.views || 0;
      dailyStats[date].likes += record.likes || 0;
      dailyStats[date].shares += record.shares || 0;
      dailyStats[date].comments += record.comments || 0;
      dailyStats[date].posts_count += 1;
    });

    const performanceData = Object.values(dailyStats).sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    res.json({
      success: true,
      period: `${period} days`,
      performance_data: performanceData
    });

  } catch (error) {
    console.error('Get performance data error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
}));

// Helper functions for generating insights
function generateBestPostingTime() {
  const times = [
    'Monday 9-11 AM',
    'Tuesday 2-4 PM',
    'Wednesday 10 AM-12 PM',
    'Thursday 3-5 PM',
    'Friday 11 AM-1 PM',
    'Saturday 8-10 AM',
    'Sunday 7-9 PM'
  ];
  return times[Math.floor(Math.random() * times.length)];
}

function generateRecommendedHashtags(existingTags) {
  const baseHashtags = ['#contentcreation', '#socialmedia', '#marketing', '#business', '#growth'];
  const recommended = [...baseHashtags];

  // Add some based on existing tags
  existingTags.forEach(tag => {
    if (tag.length > 3) {
      recommended.push(`#${tag.replace(/\s+/g, '')}`);
    }
  });

  return recommended.slice(0, 8);
}

function generateContentImprovements(analytics) {
  const improvements = [
    'Add more engaging visuals to increase click-through rates',
    'Use questions in your content to boost engagement',
    'Post consistently to build audience loyalty',
    'Include calls-to-action to drive conversions'
  ];

  if (analytics.length > 0) {
    const avgEngagement = analytics.reduce((sum, a) => sum + (a.engagement_rate || 0), 0) / analytics.length;
    if (avgEngagement < 2) {
      improvements.unshift('Your engagement rate could be improved - try more interactive content');
    }
  }

  return improvements.slice(0, 4);
}

function generateTrendingTopics(categories) {
  const topics = [
    'AI Content Creation',
    'Social Media Strategy',
    'Digital Marketing',
    'Brand Building',
    'Content Marketing',
    'Influencer Marketing'
  ];

  // Filter based on categories
  if (categories.length > 0) {
    return topics.filter(topic =>
      categories.some(cat =>
        topic.toLowerCase().includes(cat.toLowerCase()) ||
        cat.toLowerCase().includes(topic.toLowerCase())
      )
    ).slice(0, 3);
  }

  return topics.slice(0, 3);
}

function generateCompetitorPerformance() {
  return {
    avg_engagement_rate: (Math.random() * 5 + 2).toFixed(2),
    top_performing_content: 'How-to guides and tutorials',
    posting_frequency: '3-5 posts per week',
    best_platform: 'LinkedIn',
    competitor_insights: 'Competitors are seeing 40% higher engagement with video content'
  };
}

module.exports = router;







