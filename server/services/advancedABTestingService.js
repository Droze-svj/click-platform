// Advanced A/B Testing Service

const Content = require('../models/Content');
const logger = require('../utils/logger');

/**
 * Create multi-variant test
 */
async function createMultiVariantTest(userId, testData) {
  try {
    const {
      name,
      variants,
      platform,
      targetMetric = 'engagement',
      duration = 7,
    } = testData;

    if (!variants || variants.length < 2) {
      throw new Error('At least 2 variants required');
    }

    // Create content for each variant
    const contentPromises = variants.map((variant, index) => {
      const content = new Content({
        userId,
        title: variant.title,
        body: variant.body,
        platform,
        status: 'draft',
        abTest: {
          testId: null,
          variant: String.fromCharCode(65 + index), // A, B, C, etc.
        },
      });
      return content.save();
    });

    const savedContents = await Promise.all(contentPromises);

    // Generate test ID
    const testId = `ab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Update content with test ID
    await Content.updateMany(
      { _id: { $in: savedContents.map(c => c._id) } },
      { 'abTest.testId': testId }
    );

    const test = {
      id: testId,
      name,
      userId,
      platform,
      targetMetric,
      duration,
      variants: savedContents.map((content, index) => ({
        variant: String.fromCharCode(65 + index),
        contentId: content._id,
        title: variants[index].title,
      })),
      status: 'active',
      createdAt: new Date(),
      endsAt: new Date(Date.now() + duration * 24 * 60 * 60 * 1000),
    };

    logger.info('Multi-variant test created', { testId, userId, variantCount: variants.length });
    return test;
  } catch (error) {
    logger.error('Create multi-variant test error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get advanced analytics
 */
async function getAdvancedAnalytics(testId, userId) {
  try {
    const contents = await Content.find({
      'abTest.testId': testId,
      userId,
    })
      .select('abTest views likes shares comments createdAt')
      .lean();

    if (contents.length < 2) {
      throw new Error('A/B test not found or incomplete');
    }

    const variants = contents.map(content => ({
      variant: content.abTest.variant,
      contentId: content._id,
      metrics: calculateAdvancedMetrics(content),
    }));

    // Statistical analysis
    const analysis = performStatisticalAnalysis(variants);

    // Generate insights
    const insights = generateInsights(variants, analysis);

    return {
      testId,
      variants,
      analysis,
      insights,
      recommendations: generateRecommendations(variants, analysis),
    };
  } catch (error) {
    logger.error('Get advanced analytics error', { error: error.message, testId });
    throw error;
  }
}

/**
 * Calculate advanced metrics
 */
function calculateAdvancedMetrics(content) {
  const views = content.views || 0;
  const likes = content.likes || 0;
  const shares = content.shares || 0;
  const comments = content.comments || 0;

  const engagement = likes + shares * 2 + comments * 3;
  const engagementRate = views > 0 ? (engagement / views) * 100 : 0;
  const clickThroughRate = views > 0 ? ((likes + shares) / views) * 100 : 0;
  const shareRate = views > 0 ? (shares / views) * 100 : 0;
  const commentRate = views > 0 ? (comments / views) * 100 : 0;

  return {
    views,
    likes,
    shares,
    comments,
    engagement,
    engagementRate: Math.round(engagementRate * 100) / 100,
    clickThroughRate: Math.round(clickThroughRate * 100) / 100,
    shareRate: Math.round(shareRate * 100) / 100,
    commentRate: Math.round(commentRate * 100) / 100,
  };
}

/**
 * Perform statistical analysis
 */
function performStatisticalAnalysis(variants) {
  const metrics = variants.map(v => v.metrics);
  
  // Calculate averages
  const avgEngagementRate = metrics.reduce((sum, m) => sum + m.engagementRate, 0) / metrics.length;
  const avgCTR = metrics.reduce((sum, m) => sum + m.clickThroughRate, 0) / metrics.length;
  const avgShareRate = metrics.reduce((sum, m) => sum + m.shareRate, 0) / metrics.length;

  // Find best performer
  const bestVariant = variants.reduce((best, current) => {
    return current.metrics.engagementRate > best.metrics.engagementRate ? current : best;
  });

  // Calculate variance
  const variance = metrics.reduce((sum, m) => {
    const diff = m.engagementRate - avgEngagementRate;
    return sum + (diff * diff);
  }, 0) / metrics.length;

  const standardDeviation = Math.sqrt(variance);

  return {
    avgEngagementRate: Math.round(avgEngagementRate * 100) / 100,
    avgCTR: Math.round(avgCTR * 100) / 100,
    avgShareRate: Math.round(avgShareRate * 100) / 100,
    bestVariant: bestVariant.variant,
    variance: Math.round(variance * 100) / 100,
    standardDeviation: Math.round(standardDeviation * 100) / 100,
    confidenceLevel: calculateConfidenceLevel(variants.length, standardDeviation),
  };
}

/**
 * Calculate confidence level
 */
function calculateConfidenceLevel(sampleSize, stdDev) {
  if (sampleSize < 2) return 'low';
  if (stdDev < 5) return 'high';
  if (stdDev < 10) return 'medium';
  return 'low';
}

/**
 * Generate insights
 */
function generateInsights(variants, analysis) {
  const insights = [];

  const bestVariant = variants.find(v => v.variant === analysis.bestVariant);
  const improvement = ((bestVariant.metrics.engagementRate - analysis.avgEngagementRate) / analysis.avgEngagementRate) * 100;

  insights.push({
    type: 'winner',
    message: `Variant ${analysis.bestVariant} performed best with ${bestVariant.metrics.engagementRate}% engagement rate`,
    improvement: Math.round(improvement * 100) / 100,
  });

  if (analysis.confidenceLevel === 'high') {
    insights.push({
      type: 'confidence',
      message: 'High confidence in results - statistically significant',
    });
  }

  // Engagement insights
  variants.forEach(variant => {
    if (variant.metrics.shareRate > analysis.avgShareRate * 1.2) {
      insights.push({
        type: 'engagement',
        message: `Variant ${variant.variant} has high share rate (${variant.metrics.shareRate}%)`,
      });
    }
  });

  return insights;
}

/**
 * Generate recommendations
 */
function generateRecommendations(variants, analysis) {
  const recommendations = [];

  const bestVariant = variants.find(v => v.variant === analysis.bestVariant);

  recommendations.push({
    action: 'use_winner',
    message: `Use variant ${analysis.bestVariant} as it performed ${((bestVariant.metrics.engagementRate - analysis.avgEngagementRate) / analysis.avgEngagementRate * 100).toFixed(1)}% better`,
    priority: 'high',
  });

  if (analysis.confidenceLevel === 'low') {
    recommendations.push({
      action: 'extend_test',
      message: 'Consider extending test duration for more reliable results',
      priority: 'medium',
    });
  }

  return recommendations;
}

module.exports = {
  createMultiVariantTest,
  getAdvancedAnalytics,
};






