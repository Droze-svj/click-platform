// Real-Time Confidence Service
// Real-time confidence updates and history tracking

const AIConfidenceScore = require('../models/AIConfidenceScore');
const { analyzeContentConfidence } = require('./aiConfidenceService');
const logger = require('../utils/logger');

/**
 * Update confidence in real-time as content changes
 */
async function updateConfidenceRealTime(contentId, content, context = {}) {
  try {
    // Analyze new confidence
    const newScore = await analyzeContentConfidence(contentId, content, context);

    // Get previous score for comparison
    const previousScore = await AIConfidenceScore.findOne({ contentId })
      .sort({ createdAt: -1 })
      .skip(1)
      .lean();

    // Calculate change
    const change = previousScore ? {
      confidence: newScore.overallConfidence - previousScore.overallConfidence,
      editEffort: newScore.editEffort - previousScore.editEffort,
      flagsAdded: newScore.uncertaintyFlags.length - previousScore.uncertaintyFlags.length
    } : null;

    return {
      score: newScore,
      change,
      improved: change && change.confidence > 0,
      needsReview: newScore.needsHumanReview
    };
  } catch (error) {
    logger.error('Error updating confidence real-time', { error: error.message, contentId });
    throw error;
  }
}

/**
 * Get confidence history
 */
async function getConfidenceHistory(contentId, limit = 10) {
  try {
    const history = await AIConfidenceScore.find({ contentId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('overallConfidence editEffort needsHumanReview uncertaintyFlags createdAt')
      .lean();

    return history.map((score, index) => ({
      ...score,
      change: index < history.length - 1 ? {
        confidence: score.overallConfidence - history[index + 1].overallConfidence,
        editEffort: score.editEffort - history[index + 1].editEffort
      } : null
    }));
  } catch (error) {
    logger.error('Error getting confidence history', { error: error.message, contentId });
    throw error;
  }
}

/**
 * Get confidence recommendations
 */
async function getConfidenceRecommendations(contentId) {
  try {
    const score = await AIConfidenceScore.findOne({ contentId })
      .sort({ createdAt: -1 })
      .lean();

    if (!score) {
      return [];
    }

    const recommendations = [];

    // Low confidence recommendations
    if (score.overallConfidence < 70) {
      recommendations.push({
        type: 'confidence',
        priority: 'high',
        message: 'Overall confidence is low',
        suggestion: 'Review content for clarity, tone, and brand alignment',
        action: 'review_content'
      });
    }

    // High edit effort recommendations
    if (score.editEffort > 50) {
      recommendations.push({
        type: 'edit_effort',
        priority: 'medium',
        message: 'High edit effort detected',
        suggestion: 'Consider using assisted editing tools to reduce effort',
        action: 'use_assisted_editing'
      });
    }

    // Specific flag recommendations
    score.uncertaintyFlags.forEach(flag => {
      if (flag.severity === 'high' || flag.severity === 'critical') {
        recommendations.push({
          type: 'flag',
          priority: flag.severity === 'critical' ? 'high' : 'medium',
          message: flag.message,
          suggestion: flag.suggestion,
          action: `fix_${flag.type}`
        });
      }
    });

    // Aspect-specific recommendations
    Object.entries(score.aspectConfidence).forEach(([aspect, value]) => {
      if (value < 60) {
        recommendations.push({
          type: 'aspect',
          priority: 'medium',
          message: `${aspect} confidence is low (${value}%)`,
          suggestion: `Focus on improving ${aspect} in your content`,
          action: `improve_${aspect}`
        });
      }
    });

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  } catch (error) {
    logger.error('Error getting confidence recommendations', { error: error.message, contentId });
    return [];
  }
}

/**
 * Set confidence thresholds and alerts
 */
async function setConfidenceThresholds(contentId, thresholds) {
  try {
    const score = await AIConfidenceScore.findOne({ contentId })
      .sort({ createdAt: -1 })
      .lean();

    if (!score) {
      return { alerts: [] };
    }

    const alerts = [];

    if (thresholds.minConfidence && score.overallConfidence < thresholds.minConfidence) {
      alerts.push({
        type: 'low_confidence',
        severity: 'high',
        message: `Confidence (${score.overallConfidence}%) is below threshold (${thresholds.minConfidence}%)`,
        threshold: thresholds.minConfidence,
        current: score.overallConfidence
      });
    }

    if (thresholds.maxEditEffort && score.editEffort > thresholds.maxEditEffort) {
      alerts.push({
        type: 'high_edit_effort',
        severity: 'medium',
        message: `Edit effort (${score.editEffort}%) exceeds threshold (${thresholds.maxEditEffort}%)`,
        threshold: thresholds.maxEditEffort,
        current: score.editEffort
      });
    }

    return { alerts };
  } catch (error) {
    logger.error('Error checking confidence thresholds', { error: error.message, contentId });
    return { alerts: [] };
  }
}

/**
 * Batch analyze confidence
 */
async function batchAnalyzeConfidence(contentIds, context = {}) {
  try {
    const results = [];

    for (const contentId of contentIds) {
      try {
        const Content = require('../models/Content');
        const content = await Content.findById(contentId).lean();
        
        if (content) {
          const score = await analyzeContentConfidence(contentId, content, context);
          results.push({
            contentId,
            success: true,
            score
          });
        }
      } catch (error) {
        results.push({
          contentId,
          success: false,
          error: error.message
        });
      }
    }

    return {
      total: contentIds.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  } catch (error) {
    logger.error('Error batch analyzing confidence', { error: error.message });
    throw error;
  }
}

module.exports = {
  updateConfidenceRealTime,
  getConfidenceHistory,
  getConfidenceRecommendations,
  setConfidenceThresholds,
  batchAnalyzeConfidence
};


