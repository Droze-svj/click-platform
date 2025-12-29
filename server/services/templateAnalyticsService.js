// Template Analytics Service
// Track template performance and A/B testing

const AITemplate = require('../models/AITemplate');
const AITemplateVersion = require('../models/AITemplateVersion');
const AIConfidenceScore = require('../models/AIConfidenceScore');
const logger = require('../utils/logger');

/**
 * Get template performance analytics
 */
async function getTemplatePerformance(templateId, period = null) {
  try {
    const template = await AITemplate.findById(templateId).lean();
    if (!template) {
      throw new Error('Template not found');
    }

    // Get content generated with this template
    const GeneratedContent = require('../models/Content');
    const content = await GeneratedContent.find({
      'metadata.templateId': templateId,
      createdAt: period ? {
        $gte: period.startDate,
        $lte: period.endDate
      } : {}
    }).select('_id').lean();

    const contentIds = content.map(c => c._id);

    // Get confidence scores
    const scores = await AIConfidenceScore.find({
      contentId: { $in: contentIds }
    }).lean();

    // Calculate metrics
    const totalUsage = content.length;
    const avgConfidence = scores.length > 0
      ? scores.reduce((sum, s) => sum + s.overallConfidence, 0) / scores.length
      : 0;
    const avgEditEffort = scores.length > 0
      ? scores.reduce((sum, s) => sum + s.editEffort, 0) / scores.length
      : 0;
    const needsReviewRate = scores.length > 0
      ? (scores.filter(s => s.needsHumanReview).length / scores.length) * 100
      : 0;

    // Flag distribution
    const flagDistribution = {};
    scores.forEach(score => {
      score.uncertaintyFlags.forEach(flag => {
        flagDistribution[flag.type] = (flagDistribution[flag.type] || 0) + 1;
      });
    });

    return {
      template: {
        id: template._id,
        name: template.name
      },
      metrics: {
        totalUsage,
        avgConfidence: Math.round(avgConfidence * 100) / 100,
        avgEditEffort: Math.round(avgEditEffort * 100) / 100,
        needsReviewRate: Math.round(needsReviewRate * 100) / 100,
        flagDistribution
      },
      period
    };
  } catch (error) {
    logger.error('Error getting template performance', { error: error.message, templateId });
    throw error;
  }
}

/**
 * Compare template versions (A/B testing)
 */
async function compareTemplateVersions(templateId, version1, version2) {
  try {
    const [v1, v2] = await Promise.all([
      AITemplateVersion.findOne({ templateId, versionNumber: version1 }).lean(),
      AITemplateVersion.findOne({ templateId, versionNumber: version2 }).lean()
    ]);

    if (!v1 || !v2) {
      throw new Error('One or both versions not found');
    }

    // Get performance for each version
    const perf1 = await getVersionPerformance(templateId, version1);
    const perf2 = await getVersionPerformance(templateId, version2);

    // Calculate differences
    const differences = {
      confidence: perf2.avgConfidence - perf1.avgConfidence,
      editEffort: perf2.avgEditEffort - perf1.avgEditEffort,
      reviewRate: perf2.needsReviewRate - perf1.needsReviewRate,
      usage: perf2.totalUsage - perf1.totalUsage
    };

    // Determine winner
    const winner = determineWinner(perf1, perf2);

    return {
      version1: {
        number: version1,
        performance: perf1,
        snapshot: v1.snapshot
      },
      version2: {
        number: version2,
        performance: perf2,
        snapshot: v2.snapshot
      },
      differences,
      winner,
      recommendation: generateRecommendation(winner, differences)
    };
  } catch (error) {
    logger.error('Error comparing template versions', { error: error.message, templateId });
    throw error;
  }
}

/**
 * Get version performance
 */
async function getVersionPerformance(templateId, versionNumber) {
  // Would query actual performance data
  // For now, return placeholder
  return {
    totalUsage: 0,
    avgConfidence: 75,
    avgEditEffort: 30,
    needsReviewRate: 15
  };
}

/**
 * Determine winner
 */
function determineWinner(perf1, perf2) {
  // Higher confidence, lower edit effort, lower review rate = better
  const score1 = perf1.avgConfidence - perf1.avgEditEffort - perf1.needsReviewRate;
  const score2 = perf2.avgConfidence - perf2.avgEditEffort - perf2.needsReviewRate;

  if (score2 > score1) return 'version2';
  if (score1 > score2) return 'version1';
  return 'tie';
}

/**
 * Generate recommendation
 */
function generateRecommendation(winner, differences) {
  if (winner === 'version2') {
    return 'Version 2 performs better. Consider making it the default.';
  }
  if (winner === 'version1') {
    return 'Version 1 performs better. Keep it as default.';
  }
  return 'Both versions perform similarly. Consider keeping both for different use cases.';
}

/**
 * Get template suggestions
 */
async function getTemplateSuggestions(contentType, platform, brandStyle) {
  try {
    // Find similar templates
    const query = {
      isActive: true
    };

    if (brandStyle?.tone) {
      query['brandStyle.tone'] = brandStyle.tone;
    }

    const templates = await AITemplate.find(query)
      .sort({ usageCount: -1, 'performance.averageConfidence': -1 })
      .limit(5)
      .lean();

    return templates.map(t => ({
      id: t._id,
      name: t.name,
      reason: `Similar tone (${t.brandStyle?.tone || 'N/A'}) and high usage`,
      matchScore: calculateMatchScore(t, contentType, platform, brandStyle)
    })).sort((a, b) => b.matchScore - a.matchScore);
  } catch (error) {
    logger.error('Error getting template suggestions', { error: error.message });
    return [];
  }
}

/**
 * Calculate match score
 */
function calculateMatchScore(template, contentType, platform, brandStyle) {
  let score = 0;

  if (template.brandStyle?.tone === brandStyle?.tone) {
    score += 30;
  }

  if (template.platformRules?.[platform]) {
    score += 20;
  }

  score += template.usageCount * 0.1;
  score += (template.performance?.averageConfidence || 75) * 0.5;

  return score;
}

module.exports = {
  getTemplatePerformance,
  compareTemplateVersions,
  getTemplateSuggestions
};
