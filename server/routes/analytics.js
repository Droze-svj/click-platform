const express = require('express');
const ScheduledPost = require('../models/ScheduledPost');
const Content = require('../models/Content');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { generatePerformanceInsights } = require('../services/aiService');
const router = express.Router();

// Get performance analytics
router.get('/performance', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = {};
    
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Get posts data
    const posts = await ScheduledPost.find({
      userId: req.user._id,
      status: 'posted',
      ...dateFilter
    });

    // Calculate metrics
    const metrics = {
      totalPosts: posts.length,
      totalImpressions: posts.reduce((sum, p) => sum + (p.analytics?.impressions || 0), 0),
      totalEngagement: posts.reduce((sum, p) => sum + (p.analytics?.engagement || 0), 0),
      totalClicks: posts.reduce((sum, p) => sum + (p.analytics?.clicks || 0), 0),
      byPlatform: {},
      bestPerforming: [],
      engagementRate: 0
    };

    // Group by platform
    posts.forEach(post => {
      if (!metrics.byPlatform[post.platform]) {
        metrics.byPlatform[post.platform] = {
          posts: 0,
          impressions: 0,
          engagement: 0,
          clicks: 0
        };
      }
      metrics.byPlatform[post.platform].posts++;
      metrics.byPlatform[post.platform].impressions += post.analytics?.impressions || 0;
      metrics.byPlatform[post.platform].engagement += post.analytics?.engagement || 0;
      metrics.byPlatform[post.platform].clicks += post.analytics?.clicks || 0;
    });

    // Calculate engagement rate
    if (metrics.totalImpressions > 0) {
      metrics.engagementRate = (metrics.totalEngagement / metrics.totalImpressions) * 100;
    }

    // Get best performing posts
    const sortedPosts = [...posts].sort((a, b) => {
      const aEngagement = a.analytics?.engagement || 0;
      const bEngagement = b.analytics?.engagement || 0;
      return bEngagement - aEngagement;
    });

    metrics.bestPerforming = sortedPosts.slice(0, 10).map(post => ({
      id: post._id,
      platform: post.platform,
      content: post.content.text.substring(0, 100),
      engagement: post.analytics?.engagement || 0,
      impressions: post.analytics?.impressions || 0
    }));

    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get weekly report
router.get('/weekly-report', auth, async (req, res) => {
  try {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    const posts = await ScheduledPost.find({
      userId: req.user._id,
      status: 'posted',
      createdAt: { $gte: startDate, $lte: endDate }
    });

    const contents = await Content.find({
      userId: req.user._id,
      createdAt: { $gte: startDate, $lte: endDate }
    });

    // Prepare analytics data
    const analyticsData = {
      posts: posts.map(p => ({
        platform: p.platform,
        engagement: p.analytics?.engagement || 0,
        impressions: p.analytics?.impressions || 0
      })),
      contentTypes: contents.map(c => c.type),
      niche: req.user.niche
    };

    // Generate AI insights
    const insights = await generatePerformanceInsights(analyticsData, req.user.niche);

    // Get top niches/topics
    const topTopics = await getTopTopics(contents, posts);

    res.json({
      period: {
        start: startDate,
        end: endDate
      },
      summary: {
        postsPublished: posts.length,
        contentCreated: contents.length,
        totalEngagement: posts.reduce((sum, p) => sum + (p.analytics?.engagement || 0), 0),
        totalImpressions: posts.reduce((sum, p) => sum + (p.analytics?.impressions || 0), 0)
      },
      insights,
      topTopics,
      recommendations: await generateRecommendations(posts, contents, req.user.niche)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function getTopTopics(contents, posts) {
  // Extract topics from content titles and post content
  const topics = {};
  
  contents.forEach(content => {
    const words = (content.title || '').toLowerCase().split(/\s+/);
    words.forEach(word => {
      if (word.length > 4) {
        topics[word] = (topics[word] || 0) + 1;
      }
    });
  });

  const sorted = Object.entries(topics)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic, count]) => ({ topic, count }));

  return sorted;
}

async function generateRecommendations(posts, contents, niche) {
  // Analyze patterns and suggest new topics
  const bestPlatform = posts.reduce((acc, p) => {
    const platform = p.platform;
    acc[platform] = (acc[platform] || 0) + (p.analytics?.engagement || 0);
    return acc;
  }, {});

  const topPlatform = Object.entries(bestPlatform)
    .sort((a, b) => b[1] - a[1])[0]?.[0];

  return [
    {
      type: 'platform',
      suggestion: `Focus more on ${topPlatform || 'Instagram'} - your best performing platform`,
      reason: 'Highest engagement rate'
    },
    {
      type: 'content',
      suggestion: `Create more ${niche} content - your niche is performing well`,
      reason: 'Niche alignment drives engagement'
    },
    {
      type: 'timing',
      suggestion: 'Post between 6-9 PM for maximum reach',
      reason: 'Peak engagement hours'
    }
  ];
}

// Get content performance
router.get('/content/:contentId', auth, async (req, res) => {
  try {
    const content = await Content.findOne({
      _id: req.params.contentId,
      userId: req.user._id
    });

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Get related posts
    const posts = await ScheduledPost.find({
      userId: req.user._id,
      contentId: req.params.contentId
    });

    const totalEngagement = posts.reduce((sum, p) => sum + (p.analytics?.engagement || 0), 0);
    const totalImpressions = posts.reduce((sum, p) => sum + (p.analytics?.impressions || 0), 0);

    res.json({
      content: {
        id: content._id,
        title: content.title,
        type: content.type
      },
      performance: {
        postsCreated: posts.length,
        totalEngagement,
        totalImpressions,
        engagementRate: totalImpressions > 0 ? (totalEngagement / totalImpressions) * 100 : 0
      },
      posts: posts.map(p => ({
        platform: p.platform,
        engagement: p.analytics?.engagement || 0,
        impressions: p.analytics?.impressions || 0
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;







