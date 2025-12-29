// Health Alert Service
// Monitor and send health alerts

const HealthAlert = require('../models/HealthAlert');
const ClientHealthScore = require('../models/ClientHealthScore');
const CompetitorBenchmark = require('../models/CompetitorBenchmark');
const CommentSentiment = require('../models/CommentSentiment');
const BrandAwareness = require('../models/BrandAwareness');
const NotificationService = require('./notificationService');
const logger = require('../utils/logger');

/**
 * Check and create health alerts
 */
async function checkHealthAlerts(clientWorkspaceId, agencyWorkspaceId) {
  try {
    const alerts = [];

    // Get current health score
    const currentHealth = await ClientHealthScore.findOne({
      clientWorkspaceId
    })
      .sort({ 'period.startDate': -1 })
      .lean();

    if (!currentHealth) {
      return alerts;
    }

    // Get previous health score
    const previousHealth = await ClientHealthScore.findOne({
      clientWorkspaceId,
      'period.startDate': { $lt: currentHealth.period.startDate }
    })
      .sort({ 'period.startDate': -1 })
      .lean();

    // Check for health score drop
    if (previousHealth && currentHealth.healthScore < previousHealth.healthScore - 10) {
      const alert = await createHealthAlert(clientWorkspaceId, agencyWorkspaceId, {
        type: 'health_score_drop',
        severity: currentHealth.healthScore < 40 ? 'critical' : 'high',
        title: 'Health Score Decline',
        message: `Health score dropped from ${previousHealth.healthScore} to ${currentHealth.healthScore}`,
        threshold: previousHealth.healthScore - 10,
        currentValue: currentHealth.healthScore,
        previousValue: previousHealth.healthScore,
        component: 'overall',
        recommendations: generateHealthScoreRecommendations(currentHealth)
      });
      alerts.push(alert);
    }

    // Check component drops
    if (previousHealth) {
      const components = ['awareness', 'engagement', 'growth', 'quality', 'sentiment'];
      components.forEach(component => {
        const current = currentHealth.components[component]?.score || 0;
        const previous = previousHealth.components[component]?.score || 0;
        
        if (current < previous - 15) {
          alerts.push(createHealthAlert(clientWorkspaceId, agencyWorkspaceId, {
            type: `${component}_drop`,
            severity: current < 30 ? 'high' : 'medium',
            title: `${component.charAt(0).toUpperCase() + component.slice(1)} Score Decline`,
            message: `${component} score dropped from ${previous} to ${current}`,
            threshold: previous - 15,
            currentValue: current,
            previousValue: previous,
            component,
            recommendations: generateComponentRecommendations(component, current)
          }));
        }
      });
    }

    // Check for negative sentiment trend
    const recentSentiments = await CommentSentiment.find({
      workspaceId: currentHealth.workspaceId,
      'comment.timestamp': { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    }).lean();

    if (recentSentiments.length > 0) {
      const negativeRatio = recentSentiments.filter(s => s.sentiment.overall === 'negative').length / recentSentiments.length;
      
      if (negativeRatio > 0.3) { // More than 30% negative
        alerts.push(await createHealthAlert(clientWorkspaceId, agencyWorkspaceId, {
          type: 'sentiment_negative',
          severity: negativeRatio > 0.5 ? 'high' : 'medium',
          title: 'Negative Sentiment Alert',
          message: `${(negativeRatio * 100).toFixed(1)}% of recent comments are negative`,
          threshold: 0.3,
          currentValue: negativeRatio * 100,
          previousValue: 0,
          component: 'sentiment',
          recommendations: [
            {
              action: 'review_content',
              description: 'Review recent content for potential issues',
              priority: 'high',
              expectedImpact: 'Improve sentiment'
            },
            {
              action: 'engage_negatively',
              description: 'Respond to negative comments professionally',
              priority: 'high',
              expectedImpact: 'Address concerns'
            }
          ]
        }));
      }
    }

    // Check awareness decline
    const awareness = await BrandAwareness.find({
      workspaceId: currentHealth.workspaceId
    })
      .sort({ 'period.startDate': -1 })
      .limit(2)
      .lean();

    if (awareness.length >= 2 && awareness[0].awarenessScore < awareness[1].awarenessScore - 10) {
      alerts.push(await createHealthAlert(clientWorkspaceId, agencyWorkspaceId, {
        type: 'awareness_decline',
        severity: 'medium',
        title: 'Brand Awareness Decline',
        message: `Awareness score dropped from ${awareness[1].awarenessScore} to ${awareness[0].awarenessScore}`,
        threshold: awareness[1].awarenessScore - 10,
        currentValue: awareness[0].awarenessScore,
        previousValue: awareness[1].awarenessScore,
        component: 'awareness',
        recommendations: [
          {
            action: 'increase_posting',
            description: 'Increase posting frequency to boost awareness',
            priority: 'medium',
            expectedImpact: 'Improve reach and profile visits'
          }
        ]
      }));
    }

    // Send notifications for critical alerts
    const criticalAlerts = alerts.filter(a => a.alert.severity === 'critical');
    if (criticalAlerts.length > 0) {
      const Workspace = require('../models/Workspace');
      const workspace = await Workspace.findById(agencyWorkspaceId).lean();
      const userId = workspace?.userId;

      if (userId) {
        try {
          NotificationService.notifyUser(userId.toString(), {
            type: 'health_alert_critical',
            title: 'Critical Health Alert',
            message: `${criticalAlerts.length} critical health alert(s) for client`,
            data: {
              clientWorkspaceId,
              alertCount: criticalAlerts.length
            }
          });
        } catch (error) {
          logger.warn('Error sending health alert notification', { error: error.message });
        }
      }
    }

    logger.info('Health alerts checked', { clientWorkspaceId, alertsCreated: alerts.length });
    return alerts;
  } catch (error) {
    logger.error('Error checking health alerts', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

/**
 * Create health alert
 */
async function createHealthAlert(clientWorkspaceId, agencyWorkspaceId, alertData) {
  const {
    type,
    severity,
    title,
    message,
    threshold,
    currentValue,
    previousValue,
    component,
    recommendations = []
  } = alertData;

  const Workspace = require('../models/Workspace');
  const workspace = await Workspace.findById(clientWorkspaceId).lean();
  const workspaceId = workspace?._id;

  const alert = new HealthAlert({
    clientWorkspaceId,
    agencyWorkspaceId,
    alert: {
      type,
      severity,
      title,
      message,
      threshold,
      currentValue,
      previousValue
    },
    context: {
      component,
      period: {
        startDate: new Date(),
        endDate: new Date()
      }
    },
    recommendations
  });

  await alert.save();
  return alert;
}

/**
 * Generate health score recommendations
 */
function generateHealthScoreRecommendations(health) {
  const recommendations = [];

  if (health.components.awareness.score < 50) {
    recommendations.push({
      action: 'boost_awareness',
      description: 'Increase brand awareness through more frequent posting and engagement',
      priority: 'high',
      expectedImpact: 'Improve awareness component score'
    });
  }

  if (health.components.engagement.score < 50) {
    recommendations.push({
      action: 'improve_engagement',
      description: 'Optimize content for better engagement rates',
      priority: 'high',
      expectedImpact: 'Improve engagement component score'
    });
  }

  if (health.components.growth.score < 50) {
    recommendations.push({
      action: 'accelerate_growth',
      description: 'Focus on follower growth strategies',
      priority: 'medium',
      expectedImpact: 'Improve growth component score'
    });
  }

  return recommendations;
}

/**
 * Generate component recommendations
 */
function generateComponentRecommendations(component, score) {
  const recommendations = [];

  switch (component) {
    case 'awareness':
      recommendations.push({
        action: 'increase_posting',
        description: 'Post more frequently to increase reach and profile visits',
        priority: 'high',
        expectedImpact: 'Boost awareness score'
      });
      break;
    case 'engagement':
      recommendations.push({
        action: 'optimize_content',
        description: 'Improve content quality and posting times for better engagement',
        priority: 'high',
        expectedImpact: 'Boost engagement score'
      });
      break;
    case 'growth':
      recommendations.push({
        action: 'growth_strategy',
        description: 'Implement follower growth strategies and collaborations',
        priority: 'medium',
        expectedImpact: 'Boost growth score'
      });
      break;
    case 'quality':
      recommendations.push({
        action: 'content_quality',
        description: 'Focus on creating higher quality content',
        priority: 'medium',
        expectedImpact: 'Boost quality score'
      });
      break;
    case 'sentiment':
      recommendations.push({
        action: 'sentiment_management',
        description: 'Address negative sentiment and improve brand perception',
        priority: 'high',
        expectedImpact: 'Boost sentiment score'
      });
      break;
  }

  return recommendations;
}

/**
 * Get active alerts
 */
async function getActiveAlerts(clientWorkspaceId, filters = {}) {
  try {
    const {
      severity = null,
      type = null
    } = filters;

    const query = {
      clientWorkspaceId,
      status: 'active'
    };

    if (severity) query['alert.severity'] = severity;
    if (type) query['alert.type'] = type;

    const alerts = await HealthAlert.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return alerts;
  } catch (error) {
    logger.error('Error getting active alerts', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

module.exports = {
  checkHealthAlerts,
  getActiveAlerts
};


