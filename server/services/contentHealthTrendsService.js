// Content Health Trends Service
// Track health trends over time and benchmarking

const ContentHealth = require('../models/ContentHealth');
const Workspace = require('../models/Workspace');
const logger = require('../utils/logger');

/**
 * Get content health trends
 */
async function getHealthTrends(clientWorkspaceId, filters = {}) {
  try {
    const {
      startDate = null,
      endDate = null,
      period = 'daily' // daily, weekly, monthly
    } = filters;

    const query = { clientWorkspaceId };
    if (startDate || endDate) {
      query.analysisDate = {};
      if (startDate) query.analysisDate.$gte = new Date(startDate);
      if (endDate) query.analysisDate.$lte = new Date(endDate);
    }

    const healthRecords = await ContentHealth.find(query)
      .sort({ analysisDate: 1 })
      .lean();

    // Group by period
    const trends = {
      overallScore: [],
      scores: {
        freshness: [],
        diversity: [],
        engagement: [],
        consistency: [],
        relevance: [],
        volume: []
      },
      platformTrends: {},
      gapsOverTime: [],
      opportunitiesOverTime: []
    };

    healthRecords.forEach(record => {
      const date = new Date(record.analysisDate);
      const periodKey = getPeriodKey(date, period);

      // Overall score
      trends.overallScore.push({
        date: periodKey,
        score: record.overallScore
      });

      // Individual scores
      Object.keys(record.scores).forEach(key => {
        if (trends.scores[key]) {
          trends.scores[key].push({
            date: periodKey,
            score: record.scores[key]
          });
        }
      });

      // Platform trends
      record.platformBreakdown.forEach(platform => {
        if (!trends.platformTrends[platform.platform]) {
          trends.platformTrends[platform.platform] = [];
        }
        trends.platformTrends[platform.platform].push({
          date: periodKey,
          score: platform.score,
          engagement: platform.metrics.averageEngagement
        });
      });

      // Gaps and opportunities
      trends.gapsOverTime.push({
        date: periodKey,
        count: record.gaps.length,
        highPriority: record.gaps.filter(g => g.priority >= 8).length
      });

      trends.opportunitiesOverTime.push({
        date: periodKey,
        count: record.opportunities.length,
        highImpact: record.opportunities.filter(o => o.potentialImpact === 'high').length
      });
    });

    return trends;
  } catch (error) {
    logger.error('Error getting health trends', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

/**
 * Get period key
 */
function getPeriodKey(date, period) {
  const d = new Date(date);
  switch (period) {
    case 'daily':
      return d.toISOString().split('T')[0];
    case 'weekly':
      const week = Math.floor(d.getDate() / 7);
      return `${d.getFullYear()}-W${week}`;
    case 'monthly':
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    default:
      return d.toISOString().split('T')[0];
  }
}

/**
 * Get benchmark comparison
 */
async function getBenchmarkComparison(clientWorkspaceId, agencyWorkspaceId) {
  try {
    // Get client health
    const clientHealth = await ContentHealth.findOne({ clientWorkspaceId })
      .sort({ analysisDate: -1 })
      .lean();

    if (!clientHealth) {
      throw new Error('No health data found for client');
    }

    // Get client metadata
    const client = await Workspace.findById(clientWorkspaceId).lean();
    const niche = client?.metadata?.niche || 'general';

    // Get average health for same niche
    const nicheHealth = await ContentHealth.aggregate([
      {
        $match: {
          agencyWorkspaceId,
          'metadata.niche': niche,
          analysisDate: {
            $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
          }
        }
      },
      {
        $group: {
          _id: null,
          avgOverallScore: { $avg: '$overallScore' },
          avgFreshness: { $avg: '$scores.freshness' },
          avgDiversity: { $avg: '$scores.diversity' },
          avgEngagement: { $avg: '$scores.engagement' },
          avgConsistency: { $avg: '$scores.consistency' },
          avgRelevance: { $avg: '$scores.relevance' },
          avgVolume: { $avg: '$scores.volume' }
        }
      }
    ]);

    const benchmark = nicheHealth[0] || {};

    // Calculate comparison
    const comparison = {
      overallScore: {
        client: clientHealth.overallScore,
        benchmark: Math.round(benchmark.avgOverallScore || 0),
        difference: clientHealth.overallScore - Math.round(benchmark.avgOverallScore || 0),
        percentile: calculatePercentile(clientHealth.overallScore, benchmark.avgOverallScore || 0)
      },
      scores: {}
    };

    Object.keys(clientHealth.scores).forEach(key => {
      const clientScore = clientHealth.scores[key];
      const benchmarkScore = Math.round(benchmark[`avg${key.charAt(0).toUpperCase() + key.slice(1)}`] || 0);
      comparison.scores[key] = {
        client: clientScore,
        benchmark: benchmarkScore,
        difference: clientScore - benchmarkScore,
        percentile: calculatePercentile(clientScore, benchmarkScore)
      };
    });

    return {
      client: clientHealth,
      benchmark,
      comparison,
      niche
    };
  } catch (error) {
    logger.error('Error getting benchmark comparison', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

/**
 * Calculate percentile
 */
function calculatePercentile(clientScore, benchmarkScore) {
  if (benchmarkScore === 0) return 50;
  const ratio = clientScore / benchmarkScore;
  if (ratio >= 1.2) return 90;
  if (ratio >= 1.1) return 75;
  if (ratio >= 1.0) return 60;
  if (ratio >= 0.9) return 40;
  if (ratio >= 0.8) return 25;
  return 10;
}

module.exports = {
  getHealthTrends,
  getBenchmarkComparison
};


