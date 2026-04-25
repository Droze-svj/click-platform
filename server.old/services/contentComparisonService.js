// Content Comparison Service
// Compare content performance and A/B test analysis

const ContentPerformance = require('../models/ContentPerformance');
const ScheduledPost = require('../models/ScheduledPost');
const logger = require('../utils/logger');

/**
 * Compare content performance
 */
async function compareContent(postIds, filters = {}) {
  try {
    const {
      metrics = ['engagement', 'clicks', 'conversions', 'overall']
    } = filters;

    const performances = await ContentPerformance.find({
      postId: { $in: postIds }
    })
      .populate('postId', 'content platform postedAt')
      .populate('contentId', 'title type')
      .lean();

    if (performances.length === 0) {
      throw new Error('No content found for comparison');
    }

    const comparison = {
      posts: performances.map(p => ({
        postId: p.postId._id,
        platform: p.platform,
        format: p.content?.format,
        type: p.content?.type,
        topics: p.content?.topics,
        postedAt: p.postedAt
      })),
      metrics: {},
      insights: [],
      winner: null
    };

    // Compare each metric
    metrics.forEach(metric => {
      const metricData = performances.map(p => ({
        postId: p.postId._id,
        value: getMetricValue(p, metric),
        score: p.scores[metric] || 0
      }));

      const sorted = [...metricData].sort((a, b) => b.value - a.value);
      const winner = sorted[0];
      const average = metricData.reduce((sum, m) => sum + m.value, 0) / metricData.length;

      comparison.metrics[metric] = {
        data: metricData,
        winner: winner.postId,
        average,
        difference: winner.value - average,
        percentageDifference: average > 0 ? ((winner.value - average) / average) * 100 : 0
      };
    });

    // Determine overall winner
    const overallScores = performances.map(p => ({
      postId: p.postId._id,
      score: p.scores.overall || 0
    }));

    const overallWinner = overallScores.sort((a, b) => b.score - a.score)[0];
    comparison.winner = overallWinner.postId;

    // Generate insights
    comparison.insights = generateComparisonInsights(performances, comparison);

    return comparison;
  } catch (error) {
    logger.error('Error comparing content', { error: error.message, postIds });
    throw error;
  }
}

/**
 * Analyze A/B test
 */
async function analyzeABTest(testId, variantIds) {
  try {
    const performances = await ContentPerformance.find({
      postId: { $in: variantIds }
    })
      .populate('postId')
      .lean();

    if (performances.length < 2) {
      throw new Error('A/B test requires at least 2 variants');
    }

    const variants = performances.map(p => ({
      variantId: p.postId._id,
      performance: p.performance,
      scores: p.scores,
      content: p.content
    }));

    // Calculate statistical significance
    const significance = calculateStatisticalSignificance(variants);

    // Determine winner
    const winner = variants.sort((a, b) => (b.scores.overall || 0) - (a.scores.overall || 0))[0];

    // Calculate improvement
    const averageScore = variants.reduce((sum, v) => sum + (v.scores.overall || 0), 0) / variants.length;
    const improvement = winner.scores.overall > averageScore
      ? ((winner.scores.overall - averageScore) / averageScore) * 100
      : 0;

    return {
      testId,
      variants,
      winner: winner.variantId,
      improvement: Math.round(improvement * 100) / 100,
      significance,
      recommendation: generateABTestRecommendation(winner, variants, significance)
    };
  } catch (error) {
    logger.error('Error analyzing A/B test', { error: error.message, testId });
    throw error;
  }
}

/**
 * Get metric value
 */
function getMetricValue(performance, metric) {
  if (metric === 'overall') return performance.scores.overall || 0;
  return performance.performance[metric] || 0;
}

/**
 * Generate comparison insights
 */
function generateComparisonInsights(performances, comparison) {
  const insights = [];

  // Format insights
  const formatPerformance = {};
  performances.forEach(p => {
    const format = p.content?.format || 'unknown';
    if (!formatPerformance[format]) {
      formatPerformance[format] = { count: 0, totalScore: 0 };
    }
    formatPerformance[format].count++;
    formatPerformance[format].totalScore += p.scores.overall || 0;
  });

  const bestFormat = Object.entries(formatPerformance)
    .sort((a, b) => (b[1].totalScore / b[1].count) - (a[1].totalScore / a[1].count))[0];

  if (bestFormat) {
    insights.push({
      type: 'format',
      message: `${bestFormat[0]} format performs best with average score of ${(bestFormat[1].totalScore / bestFormat[1].count).toFixed(1)}`,
      recommendation: `Consider using ${bestFormat[0]} format more frequently`
    });
  }

  // Topic insights
  const topicPerformance = {};
  performances.forEach(p => {
    const topics = p.content?.topics || [];
    topics.forEach(topic => {
      if (!topicPerformance[topic]) {
        topicPerformance[topic] = { count: 0, totalScore: 0 };
      }
      topicPerformance[topic].count++;
      topicPerformance[topic].totalScore += p.scores.overall || 0;
    });
  });

  const bestTopic = Object.entries(topicPerformance)
    .sort((a, b) => (b[1].totalScore / b[1].count) - (a[1].totalScore / a[1].count))[0];

  if (bestTopic) {
    insights.push({
      type: 'topic',
      message: `Content about ${bestTopic[0]} performs best`,
      recommendation: `Create more content about ${bestTopic[0]}`
    });
  }

  return insights;
}

/**
 * Calculate statistical significance
 */
function calculateStatisticalSignificance(variants) {
  // Simplified statistical significance calculation
  // In production, would use proper statistical tests (t-test, chi-square, etc.)
  const scores = variants.map(v => v.scores.overall || 0);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  // Simplified: if difference is > 2 standard deviations, significant
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  const difference = maxScore - minScore;

  const isSignificant = difference > (stdDev * 2);
  const confidence = isSignificant ? 95 : 60;

  return {
    isSignificant,
    confidence,
    pValue: isSignificant ? 0.05 : 0.1 // Placeholder
  };
}

/**
 * Generate A/B test recommendation
 */
function generateABTestRecommendation(winner, variants, significance) {
  if (significance.isSignificant) {
    return {
      action: 'implement_winner',
      message: `Variant ${winner.variantId} is the clear winner with ${significance.confidence}% confidence`,
      nextSteps: [
        'Implement winning variant as default',
        'Consider testing new variations based on winner',
        'Document learnings for future tests'
      ]
    };
  } else {
    return {
      action: 'continue_testing',
      message: 'Results are not statistically significant. Continue testing or increase sample size.',
      nextSteps: [
        'Run test for longer period',
        'Increase sample size',
        'Test more variants'
      ]
    };
  }
}

module.exports = {
  compareContent,
  analyzeABTest
};


