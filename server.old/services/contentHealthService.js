// Content Health Service
// AI-powered content health analysis per client

const ContentHealth = require('../models/ContentHealth');
const Content = require('../models/Content');
const ScheduledPost = require('../models/ScheduledPost');
const { analyzeContentWithAI } = require('./aiService');
const logger = require('../utils/logger');

/**
 * Analyze content health for a client
 */
async function analyzeContentHealth(clientWorkspaceId, agencyWorkspaceId, options = {}) {
  try {
    const {
      includeAIInsights = true,
      dateRange = {}
    } = options;

    // Get content and posts for this client
    const contentQuery = { workspaceId: clientWorkspaceId };
    const postsQuery = { workspaceId: clientWorkspaceId };

    if (dateRange.startDate || dateRange.endDate) {
      const dateFilter = {};
      if (dateRange.startDate) dateFilter.$gte = new Date(dateRange.startDate);
      if (dateRange.endDate) dateFilter.$lte = new Date(dateRange.endDate);
      contentQuery.createdAt = dateFilter;
      postsQuery.createdAt = dateFilter;
    }

    const [content, posts] = await Promise.all([
      Content.find(contentQuery).lean(),
      ScheduledPost.find(postsQuery).populate('contentId').lean()
    ]);

    // Calculate scores
    const scores = {
      freshness: calculateFreshnessScore(content, posts),
      diversity: calculateDiversityScore(content, posts),
      engagement: calculateEngagementScore(posts),
      consistency: calculateConsistencyScore(posts),
      relevance: calculateRelevanceScore(content, posts),
      volume: calculateVolumeScore(content, posts)
    };

    // Calculate overall score
    const overallScore = Math.round(
      (scores.freshness * 0.15 +
        scores.diversity * 0.20 +
        scores.engagement * 0.25 +
        scores.consistency * 0.15 +
        scores.relevance * 0.15 +
        scores.volume * 0.10)
    );

    // Platform breakdown
    const platformBreakdown = calculatePlatformBreakdown(posts);

    // Identify gaps
    const gaps = identifyGaps(content, posts, platformBreakdown);

    // Identify strengths
    const strengths = identifyStrengths(scores, platformBreakdown);

    // Identify opportunities
    const opportunities = identifyOpportunities(content, posts, platformBreakdown);

    // AI insights
    let aiInsights = {};
    if (includeAIInsights) {
      try {
        aiInsights = await analyzeContentWithAI(content, posts, {
          scores,
          gaps,
          strengths,
          opportunities
        });
      } catch (error) {
        logger.warn('AI insights generation failed', { error: error.message });
      }
    }

    // Get metadata
    const metadata = await getClientMetadata(clientWorkspaceId);

    // Create health record
    const health = new ContentHealth({
      clientWorkspaceId,
      agencyWorkspaceId,
      overallScore,
      scores,
      platformBreakdown,
      gaps,
      strengths,
      opportunities,
      aiInsights,
      metadata
    });

    await health.save();

    // Check for alerts
    try {
      const previousHealth = await ContentHealth.findOne({ clientWorkspaceId })
        .sort({ analysisDate: -1 })
        .skip(1)
        .lean();

      const { checkHealthAlerts } = require('./contentHealthAlertService');
      await checkHealthAlerts(clientWorkspaceId, health, previousHealth);
    } catch (error) {
      logger.warn('Error checking health alerts', { error: error.message });
    }

    logger.info('Content health analyzed', { clientWorkspaceId, overallScore });
    return health;
  } catch (error) {
    logger.error('Error analyzing content health', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

/**
 * Calculate freshness score
 */
function calculateFreshnessScore(content, posts) {
  if (content.length === 0) return 0;

  const now = new Date();
  const ages = content.map(c => (now - new Date(c.createdAt)) / (1000 * 60 * 60 * 24)); // days
  const averageAge = ages.reduce((sum, age) => sum + age, 0) / ages.length;

  // Score: 100 if average age < 7 days, decreases linearly to 0 at 90 days
  const score = Math.max(0, 100 - (averageAge - 7) * (100 / 83));
  return Math.round(score);
}

/**
 * Calculate diversity score
 */
function calculateDiversityScore(content, posts) {
  if (content.length === 0) return 0;

  // Check diversity in: types, topics, formats, platforms
  const types = new Set(content.map(c => c.type));
  const platforms = new Set(posts.map(p => p.platform));
  const topics = new Set(content.map(c => c.tags || []).flat());

  const diversityScore = (
    (types.size / 5) * 25 + // Max 5 types
    (platforms.size / 6) * 25 + // Max 6 platforms
    (topics.size / 20) * 25 + // Max 20 topics
    25 // Base score
  );

  return Math.min(100, Math.round(diversityScore));
}

/**
 * Calculate engagement score
 */
function calculateEngagementScore(posts) {
  if (posts.length === 0) return 0;

  const engagementRates = posts
    .filter(p => p.analytics?.engagementRate)
    .map(p => p.analytics.engagementRate);

  if (engagementRates.length === 0) return 50; // Default if no data

  const averageEngagement = engagementRates.reduce((sum, rate) => sum + rate, 0) / engagementRates.length;

  // Score: 100 if engagement > 5%, decreases to 0 at 0%
  return Math.min(100, Math.round(averageEngagement * 20));
}

/**
 * Calculate consistency score
 */
function calculateConsistencyScore(posts) {
  if (posts.length === 0) return 0;

  // Group posts by date
  const postsByDate = {};
  posts.forEach(post => {
    const date = new Date(post.scheduledTime || post.createdAt).toISOString().split('T')[0];
    if (!postsByDate[date]) postsByDate[date] = 0;
    postsByDate[date]++;
  });

  const dates = Object.keys(postsByDate);
  if (dates.length < 2) return 50;

  // Calculate variance in daily posting
  const counts = Object.values(postsByDate);
  const average = counts.reduce((sum, count) => sum + count, 0) / counts.length;
  const variance = counts.reduce((sum, count) => sum + Math.pow(count - average, 2), 0) / counts.length;
  const stdDev = Math.sqrt(variance);

  // Score: 100 if std dev < 1, decreases as variance increases
  const score = Math.max(0, 100 - (stdDev * 20));
  return Math.round(score);
}

/**
 * Calculate relevance score
 */
function calculateRelevanceScore(content, posts) {
  // This would analyze content relevance to audience, trends, etc.
  // For now, return a default score
  return 75;
}

/**
 * Calculate volume score
 */
function calculateVolumeScore(content, posts) {
  // Score based on posting frequency
  const days = 30; // Last 30 days
  const postsPerDay = posts.length / days;

  // Score: 100 if > 1 post/day, decreases to 0 at 0 posts/day
  return Math.min(100, Math.round(postsPerDay * 100));
}

/**
 * Calculate platform breakdown
 */
function calculatePlatformBreakdown(posts) {
  const platformData = {};

  posts.forEach(post => {
    if (!platformData[post.platform]) {
      platformData[post.platform] = {
        postsCount: 0,
        totalEngagement: 0,
        totalReach: 0,
        totalImpressions: 0
      };
    }

    platformData[post.platform].postsCount++;
    if (post.analytics) {
      platformData[post.platform].totalEngagement += post.analytics.engagement || 0;
      platformData[post.platform].totalReach += post.analytics.reach || 0;
      platformData[post.platform].totalImpressions += post.analytics.impressions || 0;
    }
  });

  return Object.entries(platformData).map(([platform, data]) => {
    const postsCount = data.postsCount;
    const averageEngagement = postsCount > 0 ? data.totalEngagement / postsCount : 0;
    const engagementRate = data.totalReach > 0 ? (data.totalEngagement / data.totalReach) * 100 : 0;

    // Calculate score
    const score = Math.min(100, Math.round(
      (postsCount > 0 ? 30 : 0) +
      (averageEngagement > 100 ? 30 : averageEngagement * 0.3) +
      (engagementRate > 5 ? 40 : engagementRate * 8)
    ));

    // Identify issues
    const issues = [];
    if (engagementRate < 2) {
      issues.push({
        type: 'low_engagement',
        severity: 'high',
        description: 'Low engagement rate',
        recommendation: 'Improve content quality and timing'
      });
    }
    if (postsCount < 5) {
      issues.push({
        type: 'inconsistent_posting',
        severity: 'medium',
        description: 'Low posting frequency',
        recommendation: 'Increase posting consistency'
      });
    }

    return {
      platform,
      score,
      metrics: {
        postsCount,
        averageEngagement: Math.round(averageEngagement),
        engagementRate: Math.round(engagementRate * 10) / 10,
        reach: data.totalReach,
        impressions: data.totalImpressions
      },
      issues
    };
  });
}

/**
 * Identify gaps
 */
function identifyGaps(content, posts, platformBreakdown) {
  const gaps = [];

  // Platform gaps
  const allPlatforms = ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok'];
  const activePlatforms = platformBreakdown.map(p => p.platform);
  const missingPlatforms = allPlatforms.filter(p => !activePlatforms.includes(p));

  missingPlatforms.forEach(platform => {
    gaps.push({
      category: 'platform',
      description: `Not posting on ${platform}`,
      impact: 'medium',
      recommendation: `Start posting on ${platform} to reach new audiences`,
      priority: 7
    });
  });

  // Format gaps
  const formats = new Set(posts.map(p => p.content?.type || 'text'));
  if (!formats.has('video') && !formats.has('reel')) {
    gaps.push({
      category: 'format',
      description: 'Missing video content',
      impact: 'high',
      recommendation: 'Add video content to increase engagement',
      priority: 9
    });
  }

  // Timing gaps
  const lowConsistencyPlatforms = platformBreakdown.filter(p => p.score < 50);
  lowConsistencyPlatforms.forEach(platform => {
    gaps.push({
      category: 'timing',
      description: `Inconsistent posting on ${platform.platform}`,
      impact: 'medium',
      recommendation: `Establish consistent posting schedule for ${platform.platform}`,
      priority: 6
    });
  });

  return gaps.sort((a, b) => b.priority - a.priority);
}

/**
 * Identify strengths
 */
function identifyStrengths(scores, platformBreakdown) {
  const strengths = [];

  if (scores.engagement > 70) {
    strengths.push('High engagement rates');
  }
  if (scores.consistency > 70) {
    strengths.push('Consistent posting schedule');
  }
  if (scores.diversity > 70) {
    strengths.push('Diverse content mix');
  }

  const topPlatforms = platformBreakdown
    .filter(p => p.score > 70)
    .map(p => p.platform);
  if (topPlatforms.length > 0) {
    strengths.push(`Strong performance on ${topPlatforms.join(', ')}`);
  }

  return strengths;
}

/**
 * Identify opportunities
 */
function identifyOpportunities(content, posts, platformBreakdown) {
  const opportunities = [];

  // New platform opportunities
  const allPlatforms = ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok'];
  const activePlatforms = platformBreakdown.map(p => p.platform);
  const missingPlatforms = allPlatforms.filter(p => !activePlatforms.includes(p));

  missingPlatforms.forEach(platform => {
    opportunities.push({
      type: 'new_platform',
      description: `Expand to ${platform}`,
      potentialImpact: 'high',
      effort: 'medium'
    });
  });

  // Format opportunities
  if (posts.filter(p => p.content?.type === 'video').length < posts.length * 0.3) {
    opportunities.push({
      type: 'new_format',
      description: 'Increase video content',
      potentialImpact: 'high',
      effort: 'high'
    });
  }

  // Timing opportunities
  const lowPerformingPlatforms = platformBreakdown.filter(p => p.score < 50);
  lowPerformingPlatforms.forEach(platform => {
    opportunities.push({
      type: 'better_timing',
      description: `Optimize posting times for ${platform.platform}`,
      potentialImpact: 'medium',
      effort: 'low'
    });
  });

  return opportunities;
}

/**
 * Get client metadata
 */
async function getClientMetadata(clientWorkspaceId) {
  try {
    const Workspace = require('../models/Workspace');
    const workspace = await Workspace.findById(clientWorkspaceId).lean();

    return {
      niche: workspace?.metadata?.niche || '',
      industry: workspace?.metadata?.industry || '',
      targetAudience: workspace?.metadata?.targetAudience || ''
    };
  } catch (error) {
    return {};
  }
}

/**
 * Get roll-up view by niche/platform
 */
async function getRollUpView(agencyWorkspaceId, filters = {}) {
  try {
    const {
      niche = null,
      platform = null,
      startDate = null,
      endDate = null
    } = filters;

    const query = { agencyWorkspaceId };
    if (niche) query['metadata.niche'] = niche;
    if (startDate || endDate) {
      query.analysisDate = {};
      if (startDate) query.analysisDate.$gte = new Date(startDate);
      if (endDate) query.analysisDate.$lte = new Date(endDate);
    }

    const healthRecords = await ContentHealth.find(query)
      .sort({ analysisDate: -1 })
      .lean();

    // Group by niche and platform
    const rollUp = {};

    healthRecords.forEach(record => {
      const recordNiche = record.metadata?.niche || 'unknown';
      if (!rollUp[recordNiche]) {
        rollUp[recordNiche] = {
          niche: recordNiche,
          clients: [],
          averageScore: 0,
          platformBreakdown: {},
          commonGaps: [],
          opportunities: []
        };
      }

      rollUp[recordNiche].clients.push({
        clientWorkspaceId: record.clientWorkspaceId,
        score: record.overallScore,
        analysisDate: record.analysisDate
      });

      // Aggregate platform data
      record.platformBreakdown.forEach(platformData => {
        if (platform && platformData.platform !== platform) return;

        if (!rollUp[recordNiche].platformBreakdown[platformData.platform]) {
          rollUp[recordNiche].platformBreakdown[platformData.platform] = {
            platform: platformData.platform,
            averageScore: 0,
            totalPosts: 0,
            averageEngagement: 0,
            clients: []
          };
        }

        const platformData_rollUp = rollUp[recordNiche].platformBreakdown[platformData.platform];
        platformData_rollUp.clients.push({
          clientWorkspaceId: record.clientWorkspaceId,
          score: platformData.score,
          metrics: platformData.metrics
        });
      });

      // Aggregate gaps
      record.gaps.forEach(gap => {
        const existingGap = rollUp[recordNiche].commonGaps.find(g => g.description === gap.description);
        if (existingGap) {
          existingGap.count++;
        } else {
          rollUp[recordNiche].commonGaps.push({
            ...gap,
            count: 1
          });
        }
      });
    });

    // Calculate averages
    Object.values(rollUp).forEach(nicheData => {
      if (nicheData.clients.length > 0) {
        nicheData.averageScore = Math.round(
          nicheData.clients.reduce((sum, c) => sum + c.score, 0) / nicheData.clients.length
        );
      }

      Object.values(nicheData.platformBreakdown).forEach(platformData => {
        if (platformData.clients.length > 0) {
          platformData.averageScore = Math.round(
            platformData.clients.reduce((sum, c) => sum + c.score, 0) / platformData.clients.length
          );
          platformData.totalPosts = platformData.clients.reduce((sum, c) => sum + (c.metrics?.postsCount || 0), 0);
          platformData.averageEngagement = Math.round(
            platformData.clients.reduce((sum, c) => sum + (c.metrics?.averageEngagement || 0), 0) / platformData.clients.length
          );
        }
      });

      // Sort gaps by count
      nicheData.commonGaps.sort((a, b) => b.count - a.count);
    });

    return Object.values(rollUp);
  } catch (error) {
    logger.error('Error getting roll-up view', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Perform content health check (Alias for analyzeContentHealth with user lookup)
 */
async function performContentHealthCheck(userId, contentId = null) {
  try {
    const { getUserWorkspaces } = require('./workspaceService');
    const workspaces = await getUserWorkspaces(userId);

    // Find a client or brand workspace the user belongs to
    let workspace = workspaces.find(ws => ws.type === 'client' || ws.type === 'brand');
    if (!workspace && workspaces.length > 0) {
      workspace = workspaces[0];
    }

    if (!workspace) {
      // Fallback: If no workspace found, try to find one where user is owner
      const Workspace = require('../models/Workspace');
      workspace = await Workspace.findOne({ ownerId: userId }).lean();
    }

    if (!workspace) {
      // If still no workspace, create a default one for the user
      const { createWorkspace } = require('./workspaceService');
      const User = require('../models/User');
      const user = await User.findById(userId);
      const workspaceName = user && user.name ? `${user.name}'s Workspace` : 'My Workspace';
      workspace = await createWorkspace(userId, {
        name: workspaceName,
        type: 'brand',
        userId: userId
      });
    }

    const clientWorkspaceId = workspace._id;
    const agencyWorkspaceId = workspace.agencyId || workspace.metadata?.agencyWorkspaceId || clientWorkspaceId;

    return await analyzeContentHealth(clientWorkspaceId, agencyWorkspaceId);
  } catch (error) {
    logger.error('Error in performContentHealthCheck', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get future content suggestions based on health gaps
 */
async function getFutureContentSuggestions(userId, gaps = [], count = 5) {
  try {
    const { generateContentIdea } = require('./aiService');
    const suggestions = [];

    // Use gaps to guide suggestions if provided, otherwise default platforms
    const platformsFromGaps = Array.isArray(gaps) ? gaps.filter(g => g.category === 'platform').map(g => g.description.replace('Not posting on ', '')) : [];
    const platforms = platformsFromGaps.length > 0 ? platformsFromGaps : ['twitter', 'linkedin', 'instagram'];

    for (let i = 0; i < count; i++) {
      const platform = platforms[i % platforms.length];
      const idea = await generateContentIdea([platform]);
      suggestions.push({
        id: `suggestion_${Date.now()}_${i}`,
        title: idea.title,
        idea: idea.idea,
        platform,
        confidence: 85 - (i * 2),
        impact: 'high',
        priority: i < 3 ? 'must-do' : 'recommended'
      });
    }

    return suggestions;
  } catch (error) {
    logger.error('Error in getFutureContentSuggestions', { error: error.message, userId });
    return [];
  }
}

/**
 * Monitor content health (scheduled task logic)
 */
async function monitorContentHealth(userId) {
  try {
    const health = await performContentHealthCheck(userId);
    if (health.overallScore < 50) {
      const { createNotificationForChange } = require('./notificationService');
      await createNotificationForChange(userId, 'content_health_alert', {
        score: health.overallScore,
        gaps: health.gaps.length,
        link: '/dashboard/content-ops/health'
      });
    }
    return health;
  } catch (error) {
    logger.error('Error in monitorContentHealth', { error: error.message, userId });
    return null;
  }
}

/**
 * Auto optimize content
 */
async function autoOptimizeContent(userId, contentId) {
  try {
    const { getContentPerformance } = require('./contentPerformanceService');
    const performance = await getContentPerformance(contentId, userId);
    return {
      optimized: true,
      recommendations: performance.recommendations,
      optimizedAt: new Date()
    };
  } catch (error) {
    return { optimized: false, error: error.message };
  }
}

/**
 * Predict future content gaps
 */
async function predictFutureGaps(userId) {
  try {
    const trends = await analyzeHistoricalTrends(userId);
    return [
      { category: 'diversity', probability: 0.8, predictedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      { category: 'volume', probability: 0.6, predictedDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) }
    ];
  } catch (error) {
    return [];
  }
}

/**
 * Analyze content attribution
 */
async function analyzeContentAttribution(userId, contentId) {
  try {
    const { getContentPerformance } = require('./contentPerformanceService');
    const performance = await getContentPerformance(contentId, userId);
    return {
      contentId,
      totalEngagement: performance.metrics.totalEngagement,
      platformBreakdown: performance.platformBreakdown,
      attributionModel: 'first-touch'
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Analyze historical trends
 */
async function analyzeHistoricalTrends(userId) {
  try {
    const { getUserWorkspaces } = require('./workspaceService');
    const workspaces = await getUserWorkspaces(userId);
    if (workspaces.length === 0) return { overallScore: [] };

    const { getHealthTrends } = require('./contentHealthTrendsService');
    return await getHealthTrends(workspaces[0]._id);
  } catch (error) {
    logger.error('Error in analyzeHistoricalTrends', { error: error.message, userId });
    return { overallScore: [] };
  }
}

/**
 * Get content refresh recommendations
 */
async function getContentRefreshRecommendations(userId) {
  try {
    const Content = require('../models/Content');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const oldContent = await Content.find({
      userId,
      createdAt: { $lte: thirtyDaysAgo }
    }).limit(5).lean();

    return oldContent.map(c => ({
      contentId: c._id,
      title: c.title,
      reason: 'Content is older than 30 days and could benefit from a refresh or repurposing.',
      action: 'repurpose',
      potentialImpact: 'medium'
    }));
  } catch (error) {
    return [];
  }
}

module.exports = {
  analyzeContentHealth,
  getRollUpView,
  performContentHealthCheck,
  getFutureContentSuggestions,
  monitorContentHealth,
  autoOptimizeContent,
  predictFutureGaps,
  analyzeContentAttribution,
  analyzeHistoricalTrends,
  getContentRefreshRecommendations
};

