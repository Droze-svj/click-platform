// Automation Analytics Service
// Tracks and analyzes automation rule performance

const logger = require('../utils/logger');
const AutomationRule = require('../models/AutomationRule');
const Scene = require('../models/Scene');

/**
 * Track automation execution with detailed metrics
 */
async function trackAutomationExecution(ruleId, executionData) {
  try {
    const {
      duration,
      scenesProcessed,
      scenesFiltered,
      clipsCreated,
      errors,
      success,
      criteria,
      adaptiveThresholds
    } = executionData;

    const rule = await AutomationRule.findById(ruleId);
    if (!rule) {
      throw new Error('Rule not found');
    }

    // Update execution stats
    const execution = {
      timestamp: new Date(),
      duration,
      scenesProcessed,
      scenesFiltered,
      clipsCreated,
      success,
      criteria: criteria || {},
      adaptiveThresholds: adaptiveThresholds || null
    };

    // Store execution history (keep last 100)
    if (!rule.analytics) {
      rule.analytics = {
        executions: [],
        summary: {
          totalExecutions: 0,
          successRate: 0,
          averageDuration: 0,
          averageScenesProcessed: 0,
          averageScenesFiltered: 0,
          averageClipsCreated: 0
        }
      };
    }

    rule.analytics.executions.push(execution);

    // Keep only last 100 executions
    if (rule.analytics.executions.length > 100) {
      rule.analytics.executions = rule.analytics.executions.slice(-100);
    }

    // Update summary statistics
    updateAnalyticsSummary(rule.analytics);

    await rule.save();

    logger.info('Automation execution tracked', {
      ruleId,
      duration,
      success,
      scenesFiltered
    });

    return execution;
  } catch (error) {
    logger.error('Error tracking automation execution', {
      error: error.message,
      ruleId
    });
    throw error;
  }
}

/**
 * Update analytics summary
 */
function updateAnalyticsSummary(analytics) {
  const executions = analytics.executions || [];

  if (executions.length === 0) {
    return;
  }

  const successful = executions.filter(e => e.success);
  const durations = executions.map(e => e.duration || 0);
  const scenesProcessed = executions.map(e => e.scenesProcessed || 0);
  const scenesFiltered = executions.map(e => e.scenesFiltered || 0);
  const clipsCreated = executions.map(e => e.clipsCreated || 0);

  analytics.summary = {
    totalExecutions: executions.length,
    successRate: successful.length / executions.length,
    averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
    averageScenesProcessed: scenesProcessed.reduce((a, b) => a + b, 0) / scenesProcessed.length,
    averageScenesFiltered: scenesFiltered.reduce((a, b) => a + b, 0) / scenesFiltered.length,
    averageClipsCreated: clipsCreated.reduce((a, b) => a + b, 0) / clipsCreated.length,
    lastExecution: executions[executions.length - 1]?.timestamp
  };
}

/**
 * Get automation analytics
 */
async function getAutomationAnalytics(ruleId, options = {}) {
  const {
    startDate,
    endDate,
    includeExecutions = false
  } = options;

  try {
    const rule = await AutomationRule.findById(ruleId);
    if (!rule) {
      throw new Error('Rule not found');
    }

    let analytics = rule.analytics || {
      executions: [],
      summary: {}
    };

    // Filter executions by date if specified
    if (startDate || endDate) {
      const filtered = analytics.executions.filter(exec => {
        const execDate = new Date(exec.timestamp);
        if (startDate && execDate < startDate) return false;
        if (endDate && execDate > endDate) return false;
        return true;
      });

      analytics = {
        ...analytics,
        executions: filtered
      };
      updateAnalyticsSummary(analytics);
    }

    const result = {
      ruleId: rule._id,
      ruleName: rule.name,
      summary: analytics.summary,
      ...(includeExecutions && { executions: analytics.executions })
    };

    return result;
  } catch (error) {
    logger.error('Error getting automation analytics', {
      error: error.message,
      ruleId
    });
    throw error;
  }
}

/**
 * Analyze rule effectiveness
 */
async function analyzeRuleEffectiveness(ruleId) {
  try {
    const rule = await AutomationRule.findById(ruleId);
    if (!rule) {
      throw new Error('Rule not found');
    }

    const analytics = rule.analytics || { executions: [] };
    const executions = analytics.executions || [];

    if (executions.length === 0) {
      return {
        effectiveness: 'no_data',
        message: 'Not enough execution data'
      };
    }

    // Calculate effectiveness metrics
    const successRate = analytics.summary?.successRate || 0;
    const avgScenesFiltered = analytics.summary?.averageScenesFiltered || 0;
    const avgClipsCreated = analytics.summary?.averageClipsCreated || 0;

    // Effectiveness scoring
    let effectiveness = 'low';
    let score = 0;

    // Success rate weight: 40%
    score += successRate * 0.4;

    // Scene filtering weight: 30% (filtering some but not all is good)
    const filteringScore = Math.min(1, avgScenesFiltered / 10); // Normalize to 0-1
    score += filteringScore * 0.3;

    // Clip creation weight: 30%
    const clipsScore = Math.min(1, avgClipsCreated / 5); // Normalize to 0-1
    score += clipsScore * 0.3;

    if (score >= 0.7) {
      effectiveness = 'high';
    } else if (score >= 0.4) {
      effectiveness = 'medium';
    }

    // Recommendations
    const recommendations = [];
    if (successRate < 0.5) {
      recommendations.push('Consider adjusting audio criteria thresholds');
    }
    if (avgScenesFiltered === 0) {
      recommendations.push('Criteria may be too strict, no scenes are being filtered');
    }
    if (avgScenesFiltered === avgScenesFiltered) {
      recommendations.push('Criteria may be too lenient, all scenes are passing');
    }
    if (avgClipsCreated === 0 && avgScenesFiltered > 0) {
      recommendations.push('Scenes are being filtered but no clips are created - check clip creation config');
    }

    return {
      effectiveness,
      score,
      metrics: {
        successRate,
        averageScenesFiltered: avgScenesFiltered,
        averageClipsCreated: avgClipsCreated
      },
      recommendations
    };
  } catch (error) {
    logger.error('Error analyzing rule effectiveness', {
      error: error.message,
      ruleId
    });
    throw error;
  }
}

/**
 * Get user automation analytics summary
 */
async function getUserAutomationAnalytics(userId, options = {}) {
  const {
    startDate,
    endDate
  } = options;

  try {
    const query = { userId };
    if (startDate || endDate) {
      query['analytics.summary.lastExecution'] = {};
      if (startDate) query['analytics.summary.lastExecution'].$gte = startDate;
      if (endDate) query['analytics.summary.lastExecution'].$lte = endDate;
    }

    const rules = await AutomationRule.find(query).lean();

    const summary = {
      totalRules: rules.length,
      activeRules: rules.filter(r => r.enabled).length,
      totalExecutions: 0,
      totalClipsCreated: 0,
      averageSuccessRate: 0,
      topRules: []
    };

    let totalSuccessRate = 0;
    let rulesWithAnalytics = 0;

    rules.forEach(rule => {
      const analytics = rule.analytics || {};
      const summaryStats = analytics.summary || {};

      if (summaryStats.totalExecutions) {
        summary.totalExecutions += summaryStats.totalExecutions;
        summary.totalClipsCreated += (summaryStats.averageClipsCreated || 0) * (summaryStats.totalExecutions || 0);
        totalSuccessRate += summaryStats.successRate || 0;
        rulesWithAnalytics++;
      }
    });

    if (rulesWithAnalytics > 0) {
      summary.averageSuccessRate = totalSuccessRate / rulesWithAnalytics;
    }

    // Top performing rules
    summary.topRules = rules
      .filter(r => r.analytics?.summary?.totalExecutions > 0)
      .sort((a, b) => {
        const aScore = (a.analytics?.summary?.successRate || 0) * (a.analytics?.summary?.totalExecutions || 0);
        const bScore = (b.analytics?.summary?.successRate || 0) * (b.analytics?.summary?.totalExecutions || 0);
        return bScore - aScore;
      })
      .slice(0, 5)
      .map(r => ({
        ruleId: r._id,
        ruleName: r.name,
        successRate: r.analytics?.summary?.successRate || 0,
        totalExecutions: r.analytics?.summary?.totalExecutions || 0
      }));

    return summary;
  } catch (error) {
    logger.error('Error getting user automation analytics', {
      error: error.message,
      userId
    });
    throw error;
  }
}

module.exports = {
  trackAutomationExecution,
  getAutomationAnalytics,
  analyzeRuleEffectiveness,
  getUserAutomationAnalytics
};







