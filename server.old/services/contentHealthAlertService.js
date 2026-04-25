// Content Health Alert Service
// Monitor and alert on content health issues

const ContentHealthAlert = require('../models/ContentHealthAlert');
const ContentHealth = require('../models/ContentHealth');
const { sendNotification } = require('./notificationService');
const logger = require('../utils/logger');

/**
 * Check for health alerts
 */
async function checkHealthAlerts(clientWorkspaceId, currentHealth, previousHealth = null) {
  try {
    const alerts = [];

    // Score drop alert
    if (previousHealth && currentHealth.overallScore < previousHealth.overallScore - 10) {
      alerts.push({
        alertType: 'score_drop',
        severity: currentHealth.overallScore < 50 ? 'critical' : 'high',
        title: 'Content Health Score Dropped',
        message: `Content health score dropped from ${previousHealth.overallScore} to ${currentHealth.overallScore}`,
        details: {
          previousScore: previousHealth.overallScore,
          currentScore: currentHealth.overallScore,
          recommendation: 'Review recent content and posting strategy'
        }
      });
    }

    // Platform issue alerts
    currentHealth.platformBreakdown.forEach(platform => {
      if (platform.score < 50) {
        alerts.push({
          alertType: 'platform_issue',
          severity: platform.score < 30 ? 'high' : 'medium',
          title: `Low Performance on ${platform.platform}`,
          message: `${platform.platform} has a health score of ${platform.score}`,
          details: {
            platform: platform.platform,
            score: platform.score,
            issues: platform.issues,
            recommendation: platform.issues[0]?.recommendation || 'Improve content strategy for this platform'
          }
        });
      }

      // Engagement drop
      if (platform.metrics.engagementRate < 2) {
        alerts.push({
          alertType: 'engagement_drop',
          severity: 'high',
          title: `Low Engagement on ${platform.platform}`,
          message: `Engagement rate is ${platform.metrics.engagementRate}% on ${platform.platform}`,
          details: {
            platform: platform.platform,
            engagementRate: platform.metrics.engagementRate,
            recommendation: 'Improve content quality and timing'
          }
        });
      }
    });

    // Consistency issue
    if (currentHealth.scores.consistency < 50) {
      alerts.push({
        alertType: 'consistency_issue',
        severity: 'medium',
        title: 'Inconsistent Posting Schedule',
        message: 'Posting consistency score is low',
        details: {
          score: currentHealth.scores.consistency,
          recommendation: 'Establish and maintain consistent posting schedule'
        }
      });
    }

    // Volume drop
    if (currentHealth.scores.volume < 30) {
      alerts.push({
        alertType: 'volume_drop',
        severity: 'medium',
        title: 'Low Posting Volume',
        message: 'Posting frequency is below optimal',
        details: {
          score: currentHealth.scores.volume,
          recommendation: 'Increase posting frequency'
        }
      });
    }

    // High-priority gaps
    const highPriorityGaps = currentHealth.gaps.filter(g => g.priority >= 8);
    if (highPriorityGaps.length > 0) {
      alerts.push({
        alertType: 'gap_identified',
        severity: 'high',
        title: 'High-Priority Content Gaps Identified',
        message: `${highPriorityGaps.length} high-priority gaps found`,
        details: {
          gaps: highPriorityGaps,
          recommendation: 'Address these gaps to improve content health'
        }
      });
    }

    // Create alert records
    const createdAlerts = [];
    for (const alertData of alerts) {
      const alert = new ContentHealthAlert({
        ...alertData,
        clientWorkspaceId,
        agencyWorkspaceId: currentHealth.agencyWorkspaceId
      });

      await alert.save();
      createdAlerts.push(alert);

      // Send notification
      try {
        const Workspace = require('../models/Workspace');
        const workspace = await Workspace.findById(clientWorkspaceId)
          .populate('members.userId')
          .lean();

        if (workspace && workspace.members) {
          for (const member of workspace.members) {
            if (member.role === 'owner' || member.role === 'admin') {
              await sendNotification(member.userId, {
                type: 'content_health_alert',
                title: alertData.title,
                message: alertData.message,
                link: `/clients/${clientWorkspaceId}/content-health`,
                metadata: {
                  alertId: alert._id.toString(),
                  alertType: alertData.alertType,
                  severity: alertData.severity
                }
              });
            }
          }
        }
      } catch (error) {
        logger.warn('Error sending health alert notification', { error: error.message });
      }
    }

    logger.info('Health alerts checked', { clientWorkspaceId, alertsCreated: createdAlerts.length });
    return createdAlerts;
  } catch (error) {
    logger.error('Error checking health alerts', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

/**
 * Get active alerts for client
 */
async function getClientAlerts(clientWorkspaceId, filters = {}) {
  try {
    const {
      status = 'active',
      severity = null,
      alertType = null
    } = filters;

    const query = { clientWorkspaceId, status };
    if (severity) query.severity = severity;
    if (alertType) query.alertType = alertType;

    const alerts = await ContentHealthAlert.find(query)
      .populate('acknowledgedBy', 'name email')
      .sort({ severity: -1, createdAt: -1 })
      .lean();

    return alerts;
  } catch (error) {
    logger.error('Error getting client alerts', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

/**
 * Acknowledge alert
 */
async function acknowledgeAlert(alertId, userId) {
  try {
    const alert = await ContentHealthAlert.findById(alertId);
    if (!alert) {
      throw new Error('Alert not found');
    }

    alert.status = 'acknowledged';
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = new Date();
    await alert.save();

    return alert;
  } catch (error) {
    logger.error('Error acknowledging alert', { error: error.message, alertId });
    throw error;
  }
}

/**
 * Resolve alert
 */
async function resolveAlert(alertId, userId) {
  try {
    const alert = await ContentHealthAlert.findById(alertId);
    if (!alert) {
      throw new Error('Alert not found');
    }

    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    await alert.save();

    return alert;
  } catch (error) {
    logger.error('Error resolving alert', { error: error.message, alertId });
    throw error;
  }
}

module.exports = {
  checkHealthAlerts,
  getClientAlerts,
  acknowledgeAlert,
  resolveAlert
};


