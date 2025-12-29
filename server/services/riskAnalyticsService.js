// Risk Analytics Service
// Risk scoring, predictive analytics, automated remediation

const RiskFlag = require('../models/RiskFlag');
const WorkloadDashboard = require('../models/WorkloadDashboard');
const logger = require('../utils/logger');

/**
 * Calculate risk score for client
 */
async function calculateRiskScore(userId, clientId) {
  try {
    // Get active risk flags
    const activeFlags = await RiskFlag.find({
      userId,
      clientId,
      status: 'active'
    }).lean();

    if (activeFlags.length === 0) {
      return {
        score: 0,
        level: 'low',
        flags: [],
        recommendations: []
      };
    }

    // Calculate weighted risk score
    const severityWeights = { low: 1, medium: 3, high: 7, critical: 15 };
    const riskScore = activeFlags.reduce((sum, flag) => {
      return sum + (severityWeights[flag.severity] || 0);
    }, 0);

    // Normalize to 0-100
    const normalizedScore = Math.min(100, riskScore * 2);

    // Determine risk level
    let level = 'low';
    if (normalizedScore >= 70) level = 'critical';
    else if (normalizedScore >= 50) level = 'high';
    else if (normalizedScore >= 30) level = 'medium';

    return {
      score: Math.round(normalizedScore),
      level,
      flags: activeFlags.map(f => ({
        type: f.riskType,
        severity: f.severity,
        title: f.details.title
      })),
      recommendations: generateRiskScoreRecommendations(activeFlags, normalizedScore)
    };
  } catch (error) {
    logger.error('Error calculating risk score', { error: error.message, userId, clientId });
    throw error;
  }
}

/**
 * Predict future risks
 */
async function predictFutureRisks(userId, clientId, horizon = 30) {
  try {
    // Get historical risk flags
    const historicalFlags = await RiskFlag.find({
      userId,
      clientId
    })
      .sort({ createdAt: -1 })
      .limit(12)
      .lean();

    if (historicalFlags.length < 3) {
      return {
        predictions: [],
        confidence: 'low',
        message: 'Insufficient data for predictions'
      };
    }

    // Get current dashboard
    const WorkloadDashboardService = require('./workloadDashboardService');
    const dashboard = await WorkloadDashboardService.getWorkloadDashboard(userId, clientId);

    const predictions = [];

    // Predict engagement risk
    if (dashboard.trends.postsTrend === 'decreasing') {
      predictions.push({
        riskType: 'falling_engagement',
        probability: 0.7,
        timeframe: 'next_30_days',
        severity: 'medium',
        reason: 'Posts trend is decreasing, which may lead to engagement drop'
      });
    }

    // Predict posting frequency risk
    if (dashboard.workload.postsPerWeek < 5) {
      predictions.push({
        riskType: 'low_posting_frequency',
        probability: 0.8,
        timeframe: 'next_30_days',
        severity: 'high',
        reason: 'Current posting frequency is below recommended minimum'
      });
    }

    // Predict content gap risk
    if (dashboard.contentGaps.overallGapScore > 20) {
      predictions.push({
        riskType: 'content_gap',
        probability: 0.6,
        timeframe: 'next_30_days',
        severity: 'medium',
        reason: 'Content gap score indicates potential issues'
      });
    }

    return {
      predictions,
      confidence: historicalFlags.length >= 6 ? 'high' : 'medium',
      horizon: horizon
    };
  } catch (error) {
    logger.error('Error predicting future risks', { error: error.message, userId, clientId });
    throw error;
  }
}

/**
 * Get risk trends
 */
async function getRiskTrends(userId, clientId, period = 'month') {
  try {
    const now = new Date();
    let startDate;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const flags = await RiskFlag.find({
      userId,
      clientId,
      createdAt: { $gte: startDate }
    }).lean();

    const trends = {
      totalFlags: flags.length,
      byType: {},
      bySeverity: {},
      byStatus: {},
      timeline: groupByTime(flags),
      trend: calculateRiskTrend(flags)
    };

    // Group by type
    flags.forEach(flag => {
      trends.byType[flag.riskType] = (trends.byType[flag.riskType] || 0) + 1;
    });

    // Group by severity
    flags.forEach(flag => {
      trends.bySeverity[flag.severity] = (trends.bySeverity[flag.severity] || 0) + 1;
    });

    // Group by status
    flags.forEach(flag => {
      trends.byStatus[flag.status] = (trends.byStatus[flag.status] || 0) + 1;
    });

    return trends;
  } catch (error) {
    logger.error('Error getting risk trends', { error: error.message, userId, clientId });
    throw error;
  }
}

/**
 * Group by time
 */
function groupByTime(flags) {
  const grouped = {};

  flags.forEach(flag => {
    const date = new Date(flag.createdAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    
    if (!grouped[key]) {
      grouped[key] = {
        date: key,
        count: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      };
    }

    grouped[key].count++;
    if (flag.severity === 'critical') grouped[key].critical++;
    else if (flag.severity === 'high') grouped[key].high++;
    else if (flag.severity === 'medium') grouped[key].medium++;
    else grouped[key].low++;
  });

  return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Calculate risk trend
 */
function calculateRiskTrend(flags) {
  if (flags.length < 2) return 'stable';

  const sorted = flags.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
  const secondHalf = sorted.slice(Math.floor(sorted.length / 2));

  const firstAvg = firstHalf.length > 0 ? firstHalf.length / (firstHalf.length / 2) : 0;
  const secondAvg = secondHalf.length > 0 ? secondHalf.length / (secondHalf.length / 2) : 0;

  if (secondAvg > firstAvg * 1.2) return 'increasing';
  if (secondAvg < firstAvg * 0.8) return 'decreasing';
  return 'stable';
}

/**
 * Generate risk score recommendations
 */
function generateRiskScoreRecommendations(flags, score) {
  const recommendations = [];

  if (score >= 70) {
    recommendations.push({
      type: 'urgent',
      priority: 'critical',
      message: 'Critical risk level detected. Immediate intervention required.',
      actions: ['review_all_flags', 'escalate_to_manager', 'create_action_plan']
    });
  } else if (score >= 50) {
    recommendations.push({
      type: 'high',
      priority: 'high',
      message: 'High risk level. Review and address flags promptly.',
      actions: ['review_flags', 'apply_playbooks', 'increase_monitoring']
    });
  } else if (score >= 30) {
    recommendations.push({
      type: 'medium',
      priority: 'medium',
      message: 'Moderate risk level. Monitor closely.',
      actions: ['monitor_flags', 'preventive_actions']
    });
  }

  // Specific recommendations based on flag types
  const flagTypes = flags.map(f => f.riskType);
  if (flagTypes.includes('falling_engagement')) {
    recommendations.push({
      type: 'engagement',
      priority: 'high',
      message: 'Address falling engagement immediately',
      actions: ['content_optimization', 'audience_analysis']
    });
  }

  return recommendations;
}

/**
 * Get risk dashboard
 */
async function getRiskDashboard(userId) {
  try {
    // Get all active flags
    const activeFlags = await RiskFlag.find({
      userId,
      status: 'active'
    })
      .populate('clientId', 'name')
      .lean();

    // Calculate overall metrics
    const dashboard = {
      totalActiveFlags: activeFlags.length,
      bySeverity: {
        critical: activeFlags.filter(f => f.severity === 'critical').length,
        high: activeFlags.filter(f => f.severity === 'high').length,
        medium: activeFlags.filter(f => f.severity === 'medium').length,
        low: activeFlags.filter(f => f.severity === 'low').length
      },
      byType: {},
      byClient: {},
      topRisks: activeFlags
        .sort((a, b) => {
          const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          return severityOrder[b.severity] - severityOrder[a.severity];
        })
        .slice(0, 10)
        .map(f => ({
          client: f.clientId.name,
          type: f.riskType,
          severity: f.severity,
          title: f.details.title
        }))
    };

    // Group by type
    activeFlags.forEach(flag => {
      dashboard.byType[flag.riskType] = (dashboard.byType[flag.riskType] || 0) + 1;
    });

    // Group by client
    activeFlags.forEach(flag => {
      const clientName = flag.clientId.name;
      if (!dashboard.byClient[clientName]) {
        dashboard.byClient[clientName] = {
          client: clientName,
          flags: 0,
          critical: 0,
          high: 0
        };
      }
      dashboard.byClient[clientName].flags++;
      if (flag.severity === 'critical') dashboard.byClient[clientName].critical++;
      if (flag.severity === 'high') dashboard.byClient[clientName].high++;
    });

    dashboard.byClient = Object.values(dashboard.byClient);

    return dashboard;
  } catch (error) {
    logger.error('Error getting risk dashboard', { error: error.message, userId });
    throw error;
  }
}

/**
 * Automated remediation
 */
async function automatedRemediation(flagId) {
  try {
    const flag = await RiskFlag.findById(flagId);
    if (!flag) {
      throw new Error('Risk flag not found');
    }

    const remediationActions = [];

    // Auto-fix based on risk type
    switch (flag.riskType) {
      case 'low_posting_frequency':
        // Suggest playbook application
        const PlaybookService = require('./playbookService');
        const suggestions = await PlaybookService.getPlaybookSuggestions(flag.userId, flag.clientId);
        if (suggestions.length > 0) {
          remediationActions.push({
            type: 'suggest_playbook',
            playbook: suggestions[0],
            message: 'Suggested playbook to increase posting frequency'
          });
        }
        break;

      case 'content_gap':
        // Suggest content planning
        remediationActions.push({
          type: 'content_planning',
          message: 'Create content plan to fill gaps'
        });
        break;

      case 'falling_engagement':
        // Suggest content optimization
        remediationActions.push({
          type: 'content_optimization',
          message: 'Review and optimize content strategy'
        });
        break;
    }

    // Update flag with remediation actions
    flag.actions = flag.actions.map(action => {
      if (action.type === 'auto_fix' && !action.taken) {
        return {
          ...action,
          taken: true,
          takenAt: new Date(),
          result: JSON.stringify(remediationActions)
        };
      }
      return action;
    });

    await flag.save();

    return {
      flagId: flag._id,
      remediationActions,
      applied: remediationActions.length > 0
    };
  } catch (error) {
    logger.error('Error in automated remediation', { error: error.message, flagId });
    throw error;
  }
}

module.exports = {
  calculateRiskScore,
  predictFutureRisks,
  getRiskTrends,
  getRiskDashboard,
  automatedRemediation
};


