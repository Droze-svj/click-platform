// Client Health Service
// Calculate overall client health score

const ClientHealthScore = require('../models/ClientHealthScore');
const { calculateBrandAwareness } = require('./brandAwarenessService');
const { getAggregatedPerformanceMetrics } = require('./socialPerformanceMetricsService');
const { getAudienceGrowthTrends } = require('./socialPerformanceMetricsService');
const CommentSentiment = require('../models/CommentSentiment');
const KeyWin = require('../models/KeyWin');
const logger = require('../utils/logger');

/**
 * Calculate client health score
 */
async function calculateClientHealthScore(clientWorkspaceId, agencyWorkspaceId, period) {
  try {
    const {
      type = 'monthly',
      startDate,
      endDate
    } = period;

    // Get workspace
    const Workspace = require('../models/Workspace');
    const workspace = await Workspace.findById(clientWorkspaceId).lean();
    const workspaceId = workspace?._id;

    // Calculate component scores
    const components = {
      awareness: await calculateAwarenessScore(workspaceId, startDate, endDate),
      engagement: await calculateEngagementScore(workspaceId, startDate, endDate),
      growth: await calculateGrowthScore(workspaceId, startDate, endDate),
      quality: await calculateQualityScore(workspaceId, startDate, endDate),
      sentiment: await calculateSentimentScore(workspaceId, startDate, endDate)
    };

    // Get previous period for comparison
    const prevStartDate = new Date(startDate);
    const prevEndDate = new Date(endDate);
    if (type === 'monthly') {
      prevStartDate.setMonth(prevStartDate.getMonth() - 1);
      prevEndDate.setMonth(prevEndDate.getMonth() - 1);
    }

    const previousHealth = await ClientHealthScore.findOne({
      clientWorkspaceId,
      'period.startDate': prevStartDate,
      'period.endDate': prevEndDate
    }).lean();

    // Calculate trends
    const previousScore = previousHealth?.healthScore || 50;
    const currentScore = calculateOverallScore(components);
    const scoreChange = previousScore > 0
      ? ((currentScore - previousScore) / previousScore) * 100
      : 0;

    // Generate insights
    const insights = generateHealthInsights(components, currentScore, previousScore);

    // Get industry average (would come from benchmark data)
    const industryAverage = 60; // Placeholder

    // Create or update health score
    const healthScore = await ClientHealthScore.findOneAndUpdate(
      {
        clientWorkspaceId,
        'period.startDate': startDate,
        'period.endDate': endDate,
        'period.type': type
      },
      {
        $set: {
          workspaceId,
          clientWorkspaceId,
          agencyWorkspaceId,
          period: {
            type,
            startDate,
            endDate
          },
          components,
          healthScore: currentScore,
          trends: {
            scoreChange,
            direction: scoreChange > 5 ? 'improving' : (scoreChange < -5 ? 'declining' : 'stable'),
            momentum: scoreChange / 10 // Normalized
          },
          comparison: {
            previousPeriod: {
              score: previousScore,
              change: scoreChange
            },
            industryAverage: {
              score: industryAverage,
              difference: currentScore - industryAverage
            },
            percentile: calculatePercentile(currentScore, industryAverage)
          },
          insights
        }
      },
      { upsert: true, new: true }
    );

    logger.info('Client health score calculated', { clientWorkspaceId, healthScore: currentScore, status: healthScore.status });
    return healthScore;
  } catch (error) {
    logger.error('Error calculating client health score', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

/**
 * Calculate awareness score
 */
async function calculateAwarenessScore(workspaceId, startDate, endDate) {
  // Get brand awareness data
  const BrandAwareness = require('../models/BrandAwareness');
  const awareness = await BrandAwareness.find({
    workspaceId,
    'period.startDate': { $gte: startDate, $lte: endDate }
  }).lean();

  if (awareness.length === 0) return { score: 50, weight: 0.25 };

  const averageScore = awareness.reduce((sum, a) => sum + a.awarenessScore, 0) / awareness.length;
  return { score: Math.round(averageScore), weight: 0.25 };
}

/**
 * Calculate engagement score
 */
async function calculateEngagementScore(workspaceId, startDate, endDate) {
  const metrics = await getAggregatedPerformanceMetrics(workspaceId, {
    startDate,
    endDate
  });

  const engagementRate = metrics.averageEngagementRate.byReach || 0;
  // Score based on engagement rate (5% = 100 score)
  const score = Math.min(100, (engagementRate / 5) * 100);

  return { score: Math.round(score), weight: 0.25 };
}

/**
 * Calculate growth score
 */
async function calculateGrowthScore(workspaceId, startDate, endDate) {
  const Workspace = require('../models/Workspace');
  const workspace = await Workspace.findById(workspaceId).lean();
  const userId = workspace?.userId;

  if (!userId) return { score: 50, weight: 0.20 };

  // Get growth trends
  const platforms = ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok'];
  let totalGrowthRate = 0;
  let count = 0;

  for (const platform of platforms) {
    try {
      const trends = await getAudienceGrowthTrends(userId, platform, {
        startDate,
        endDate
      });

      if (trends.trends.averageGrowthRate > 0) {
        totalGrowthRate += trends.trends.averageGrowthRate;
        count++;
      }
    } catch (error) {
      // Skip if no data
    }
  }

  const averageGrowthRate = count > 0 ? totalGrowthRate / count : 0;
  // Score based on growth rate (2% = 100 score)
  const score = Math.min(100, (averageGrowthRate / 2) * 100);

  return { score: Math.round(score), weight: 0.20 };
}

/**
 * Calculate quality score
 */
async function calculateQualityScore(workspaceId, startDate, endDate) {
  const ContentPerformance = require('../models/ContentPerformance');
  const performances = await ContentPerformance.find({
    workspaceId,
    postedAt: { $gte: startDate, $lte: endDate }
  }).lean();

  if (performances.length === 0) return { score: 50, weight: 0.15 };

  const averageScore = performances.reduce((sum, p) => sum + (p.scores.overall || 0), 0) / performances.length;
  return { score: Math.round(averageScore), weight: 0.15 };
}

/**
 * Calculate sentiment score
 */
async function calculateSentimentScore(workspaceId, startDate, endDate) {
  const sentiments = await CommentSentiment.find({
    workspaceId,
    'comment.timestamp': { $gte: startDate, $lte: endDate }
  }).lean();

  if (sentiments.length === 0) return { score: 50, weight: 0.15 };

  const positiveCount = sentiments.filter(s => s.sentiment.overall === 'positive').length;
  const negativeCount = sentiments.filter(s => s.sentiment.overall === 'negative').length;
  const total = sentiments.length;

  // Score based on positive/negative ratio
  const positiveRatio = positiveCount / total;
  const negativeRatio = negativeCount / total;
  const score = (positiveRatio * 100) - (negativeRatio * 50); // Positive boosts, negative hurts

  return { score: Math.max(0, Math.min(100, Math.round(score))), weight: 0.15 };
}

/**
 * Calculate overall score
 */
function calculateOverallScore(components) {
  return Math.round(
    components.awareness.score * components.awareness.weight +
    components.engagement.score * components.engagement.weight +
    components.growth.score * components.growth.weight +
    components.quality.score * components.quality.weight +
    components.sentiment.score * components.sentiment.weight
  );
}

/**
 * Generate health insights
 */
function generateHealthInsights(components, currentScore, previousScore) {
  const insights = [];

  // Strengths
  if (components.awareness.score >= 70) {
    insights.push({
      type: 'strength',
      category: 'awareness',
      message: 'Strong brand awareness with high profile visits and reach growth',
      impact: 'high'
    });
  }

  if (components.engagement.score >= 70) {
    insights.push({
      type: 'strength',
      category: 'engagement',
      message: 'Excellent engagement rates above industry average',
      impact: 'high'
    });
  }

  // Weaknesses
  if (components.growth.score < 40) {
    insights.push({
      type: 'weakness',
      category: 'growth',
      message: 'Follower growth is below optimal. Consider increasing posting frequency or improving content.',
      impact: 'medium'
    });
  }

  if (components.sentiment.score < 40) {
    insights.push({
      type: 'weakness',
      category: 'sentiment',
      message: 'Negative sentiment detected. Review content strategy and address concerns.',
      impact: 'high'
    });
  }

  // Opportunities
  if (components.quality.score >= 60 && components.engagement.score < 60) {
    insights.push({
      type: 'opportunity',
      category: 'engagement',
      message: 'High quality content but engagement could be improved. Optimize posting times and CTAs.',
      impact: 'medium'
    });
  }

  // Threats
  if (currentScore < previousScore && currentScore < 50) {
    insights.push({
      type: 'threat',
      category: 'overall',
      message: 'Health score declining. Immediate action recommended.',
      impact: 'high'
    });
  }

  return insights;
}

/**
 * Calculate percentile
 */
function calculatePercentile(score, industryAverage) {
  // Simplified percentile calculation
  if (score >= industryAverage * 1.2) return 90;
  if (score >= industryAverage * 1.1) return 75;
  if (score >= industryAverage) return 50;
  if (score >= industryAverage * 0.9) return 25;
  return 10;
}

/**
 * Get client health dashboard
 */
async function getClientHealthDashboard(clientWorkspaceId, filters = {}) {
  try {
    const {
      startDate,
      endDate,
      period = 'monthly'
    } = filters;

    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date();
    if (period === 'monthly') {
      start.setMonth(start.getMonth() - 1);
    }

    // Get health scores
    const healthScores = await ClientHealthScore.find({
      clientWorkspaceId,
      'period.startDate': { $gte: start, $lte: end }
    })
      .sort({ 'period.startDate': 1 })
      .lean();

    const currentHealth = healthScores[healthScores.length - 1];

    // Get key wins
    const keyWins = await KeyWin.find({
      clientWorkspaceId,
      'win.date': { $gte: start, $lte: end }
    })
      .sort({ 'win.date': -1 })
      .limit(5)
      .lean();

    // Get sentiment trends
    const Workspace = require('../models/Workspace');
    const workspace = await Workspace.findById(clientWorkspaceId).lean();
    const workspaceId = workspace?._id;

    const sentiments = await CommentSentiment.find({
      workspaceId,
      'comment.timestamp': { $gte: start, $lte: end }
    })
      .sort({ 'comment.timestamp': 1 })
      .lean();

    const sentimentTrend = {
      positive: sentiments.filter(s => s.sentiment.overall === 'positive').length,
      neutral: sentiments.filter(s => s.sentiment.overall === 'neutral').length,
      negative: sentiments.filter(s => s.sentiment.overall === 'negative').length,
      trend: sentiments.length >= 2
        ? (sentiments[sentiments.length - 1].sentiment.scores.positive - sentiments[0].sentiment.scores.positive)
        : 0
    };

    return {
      currentHealth,
      trends: {
        healthScore: healthScores.map(h => ({
          date: h.period.startDate,
          score: h.healthScore,
          status: h.status
        })),
        components: healthScores.map(h => ({
          date: h.period.startDate,
          awareness: h.components.awareness.score,
          engagement: h.components.engagement.score,
          growth: h.components.growth.score,
          quality: h.components.quality.score,
          sentiment: h.components.sentiment.score
        }))
      },
      keyWins,
      sentimentTrend,
      summary: {
        currentScore: currentHealth?.healthScore || 0,
        status: currentHealth?.status || 'fair',
        trend: currentHealth?.trends.direction || 'stable',
        insights: currentHealth?.insights || []
      }
    };
  } catch (error) {
    logger.error('Error getting client health dashboard', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

module.exports = {
  calculateClientHealthScore,
  getClientHealthDashboard
};


