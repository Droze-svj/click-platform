// Template Analytics Service
// Track template performance and A/B testing

const mongoose = require('mongoose');
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
    // `createdAt: {}` is an exact-match on an empty object, so the no-period call
    // matched NOTHING and every unscoped lookup reported zero usage. Omit the
    // field entirely instead when there's no window.
    const query = { 'metadata.templateId': templateIdMatch(templateId) };
    if (period?.startDate && period?.endDate) {
      query.createdAt = { $gte: period.startDate, $lte: period.endDate };
    }
    const content = await GeneratedContent.find(query).select('_id').lean();

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
      // uncertaintyFlags is optional on the schema — a score saved without it
      // would throw here and take down the whole analytics call.
      (score.uncertaintyFlags || []).forEach(flag => {
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

/**
 * Content.metadata is Mixed, so metadata.templateId may have been written as an
 * ObjectId or as its hex string depending on the caller. Routes pass the string
 * from the URL. Match both forms so the join can't silently miss usage.
 */
function templateIdMatch(templateId) {
  const asString = String(templateId);
  const forms = [asString];
  if (mongoose.Types.ObjectId.isValid(asString)) forms.push(new mongoose.Types.ObjectId(asString));
  return { $in: forms };
}

/** Start of the window `days` before now. */
function windowStart(days) {
  const since = new Date();
  since.setDate(since.getDate() - (Number(days) > 0 ? Number(days) : 30));
  return since;
}

/** YYYY-MM-DD key for day-bucketing. */
function dayKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

/**
 * Mean of a numeric field over a set of docs, rounded to 2dp.
 */
function avgOf(docs, field) {
  if (!docs.length) return 0;
  const sum = docs.reduce((acc, d) => acc + (Number(d[field]) || 0), 0);
  return Math.round((sum / docs.length) * 100) / 100;
}

/**
 * Daily trend of a template's usage and output quality.
 *
 * Same join as getTemplatePerformance (Content.metadata.templateId →
 * AIConfidenceScore.contentId), bucketed by day instead of aggregated into a
 * single window. Days with no usage are emitted as zeros so the series is
 * continuous and a client can chart it without filling gaps itself.
 *
 * @param {string} templateId
 * @param {number} period days back from now (default 30)
 */
async function getTemplateTrends(templateId, period = 30) {
  try {
    const template = await AITemplate.findById(templateId).lean();
    if (!template) throw new Error('Template not found');

    const days = Number(period) > 0 ? Number(period) : 30;
    const since = windowStart(days);

    const Content = require('../models/Content');
    const content = await Content.find({
      'metadata.templateId': templateIdMatch(templateId),
      createdAt: { $gte: since },
    }).select('_id createdAt').lean();

    const scores = await AIConfidenceScore.find({
      contentId: { $in: content.map((c) => c._id) },
    }).lean();

    // contentId → its score, so each day's content can pull its own quality data.
    const scoreByContent = new Map(scores.map((s) => [String(s.contentId), s]));

    const buckets = new Map();
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      buckets.set(dayKey(d), { date: dayKey(d), usage: 0, _scores: [] });
    }

    for (const c of content) {
      const bucket = buckets.get(dayKey(c.createdAt));
      if (!bucket) continue; // outside the window after rounding
      bucket.usage += 1;
      const score = scoreByContent.get(String(c._id));
      if (score) bucket._scores.push(score);
    }

    const series = [...buckets.values()].map((b) => ({
      date: b.date,
      usage: b.usage,
      avgConfidence: avgOf(b._scores, 'overallConfidence'),
      avgEditEffort: avgOf(b._scores, 'editEffort'),
      needsReviewCount: b._scores.filter((s) => s.needsHumanReview).length,
      scoredCount: b._scores.length,
    }));

    // Direction of travel: first half of the window vs second half.
    const mid = Math.floor(series.length / 2);
    const usageFirst = series.slice(0, mid).reduce((a, b) => a + b.usage, 0);
    const usageSecond = series.slice(mid).reduce((a, b) => a + b.usage, 0);

    return {
      template: { id: template._id, name: template.name },
      periodDays: days,
      series,
      totals: {
        usage: content.length,
        avgConfidence: avgOf(scores, 'overallConfidence'),
        avgEditEffort: avgOf(scores, 'editEffort'),
        needsReviewRate: scores.length
          ? Math.round((scores.filter((s) => s.needsHumanReview).length / scores.length) * 10000) / 100
          : 0,
      },
      trend: {
        usageChange: usageSecond - usageFirst,
        direction: usageSecond > usageFirst ? 'up' : usageSecond < usageFirst ? 'down' : 'flat',
      },
    };
  } catch (error) {
    logger.error('Error getting template trends', { error: error.message, templateId });
    throw error;
  }
}

/**
 * Analytics across every template a creator owns.
 *
 * Scoped by createdBy so one creator never sees another's templates.
 *
 * @param {string|ObjectId} userId owner (req.user._id)
 * @param {number} period days back from now (default 30)
 */
async function getCreatorAnalytics(userId, period = 30) {
  try {
    if (!userId) throw new Error('userId is required');

    const days = Number(period) > 0 ? Number(period) : 30;
    const since = windowStart(days);

    const templates = await AITemplate.find({ createdBy: userId })
      .select('_id name usageCount performance')
      .lean();

    if (templates.length === 0) {
      return {
        periodDays: days,
        totals: { templates: 0, usage: 0, avgConfidence: 0, avgEditEffort: 0, needsReviewRate: 0 },
        templates: [],
      };
    }

    // Both id forms, for the same Mixed-field reason as templateIdMatch().
    const templateIds = templates.flatMap((t) => [String(t._id), t._id]);

    const Content = require('../models/Content');
    const content = await Content.find({
      'metadata.templateId': { $in: templateIds },
      createdAt: { $gte: since },
    }).select('_id metadata.templateId').lean();

    const scores = await AIConfidenceScore.find({
      contentId: { $in: content.map((c) => c._id) },
    }).lean();
    const scoreByContent = new Map(scores.map((s) => [String(s.contentId), s]));

    // Group each template's content + scores.
    const perTemplate = new Map(templates.map((t) => [String(t._id), { template: t, content: [], scores: [] }]));
    for (const c of content) {
      const entry = perTemplate.get(String(c.metadata?.templateId));
      if (!entry) continue;
      entry.content.push(c);
      const score = scoreByContent.get(String(c._id));
      if (score) entry.scores.push(score);
    }

    const perTemplateStats = [...perTemplate.values()].map(({ template, content: tContent, scores: tScores }) => ({
      id: template._id,
      name: template.name,
      usage: tContent.length,
      lifetimeUsage: template.usageCount || 0,
      avgConfidence: avgOf(tScores, 'overallConfidence'),
      avgEditEffort: avgOf(tScores, 'editEffort'),
      needsReviewCount: tScores.filter((s) => s.needsHumanReview).length,
    })).sort((a, b) => b.usage - a.usage);

    return {
      periodDays: days,
      totals: {
        templates: templates.length,
        usage: content.length,
        avgConfidence: avgOf(scores, 'overallConfidence'),
        avgEditEffort: avgOf(scores, 'editEffort'),
        needsReviewRate: scores.length
          ? Math.round((scores.filter((s) => s.needsHumanReview).length / scores.length) * 10000) / 100
          : 0,
      },
      // Most-used first; the tail is what a creator prunes.
      templates: perTemplateStats,
      mostUsed: perTemplateStats[0] || null,
      unused: perTemplateStats.filter((t) => t.usage === 0).map((t) => ({ id: t.id, name: t.name })),
    };
  } catch (error) {
    logger.error('Error getting creator analytics', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  getTemplatePerformance,
  compareTemplateVersions,
  getTemplateSuggestions,
  getTemplateTrends,
  getCreatorAnalytics
};
