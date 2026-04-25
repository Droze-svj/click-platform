// Business Alert Service
// Monitor and send business metric alerts

const BusinessAlert = require('../models/BusinessAlert');
const ClientRetention = require('../models/ClientRetention');
const { calculateNPS } = require('./clientSatisfactionService');
const { getCampaignCPAMetrics } = require('./campaignCPAService');
const { getInternalEfficiencyMetrics } = require('./internalEfficiencyService');
const { predictClientChurn } = require('./predictiveAnalyticsService');
const NotificationService = require('./notificationService');
const logger = require('../utils/logger');

/**
 * Check and create business alerts
 */
async function checkBusinessAlerts(agencyWorkspaceId) {
  try {
    const alerts = [];

    // Check churn risk
    const atRiskClients = await ClientRetention.find({
      agencyWorkspaceId,
      'subscription.status': 'active',
      'churn.churnRiskScore': { $gte: 50 }
    }).lean();

    for (const client of atRiskClients) {
      const prediction = await predictClientChurn(agencyWorkspaceId, client.clientWorkspaceId);
      
      if (prediction.churnProbability >= 50) {
        const alert = await createBusinessAlert(agencyWorkspaceId, {
          type: 'churn_risk',
          severity: prediction.churnProbability >= 70 ? 'critical' : 'high',
          title: `High Churn Risk: ${client.client.name}`,
          message: `Client has ${prediction.churnProbability}% churn probability. Predicted timeframe: ${prediction.timeframe}`,
          threshold: 50,
          currentValue: prediction.churnProbability,
          previousValue: client.churn.churnRiskScore || 0,
          clientWorkspaceId: client.clientWorkspaceId,
          recommendations: prediction.recommendations
        });
        alerts.push(alert);
      }
    }

    // Check NPS
    const nps = await calculateNPS(agencyWorkspaceId);
    if (nps.nps < 0) {
      alerts.push(await createBusinessAlert(agencyWorkspaceId, {
        type: 'low_nps',
        severity: nps.nps < -20 ? 'critical' : 'high',
        title: 'Low NPS Alert',
        message: `NPS is ${nps.nps}. ${nps.detractors} detractors vs ${nps.promoters} promoters.`,
        threshold: 0,
        currentValue: nps.nps,
        previousValue: 0,
        recommendations: [
          {
            action: 'nps_improvement',
            description: 'Focus on addressing detractor concerns and improving overall satisfaction',
            priority: 'high',
            expectedImpact: 'Improve NPS score'
          }
        ]
      }));
    }

    // Check CPA
    const cpa = await getCampaignCPAMetrics(agencyWorkspaceId);
    if (cpa.averages.cpa > 100) { // Threshold
      alerts.push(await createBusinessAlert(agencyWorkspaceId, {
        type: 'high_cpa',
        severity: cpa.averages.cpa > 200 ? 'critical' : 'high',
        title: 'High CPA Alert',
        message: `Average CPA is $${cpa.averages.cpa}, which is above optimal threshold.`,
        threshold: 100,
        currentValue: cpa.averages.cpa,
        previousValue: 0,
        recommendations: [
          {
            action: 'optimize_campaigns',
            description: 'Review and optimize campaigns to reduce CPA',
            priority: 'high',
            expectedImpact: 'Reduce CPA'
          }
        ]
      }));
    }

    // Check utilization
    const efficiency = await getInternalEfficiencyMetrics(agencyWorkspaceId);
    if (efficiency.summary?.current) {
      const utilization = efficiency.summary.current.team.utilizationRate;
      if (utilization < 70) {
        alerts.push(await createBusinessAlert(agencyWorkspaceId, {
          type: 'low_utilization',
          severity: utilization < 50 ? 'high' : 'medium',
          title: 'Low Utilization Alert',
          message: `Team utilization is ${utilization.toFixed(1)}%, below optimal 70-85% range.`,
          threshold: 70,
          currentValue: utilization,
          previousValue: 0,
          recommendations: [
            {
              action: 'optimize_capacity',
              description: 'Review team capacity and workload distribution',
              priority: 'medium',
              expectedImpact: 'Improve utilization'
            }
          ]
        }));
      }
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
            type: 'business_alert_critical',
            title: 'Critical Business Alert',
            message: `${criticalAlerts.length} critical business alert(s) require attention`,
            data: {
              agencyWorkspaceId,
              alertCount: criticalAlerts.length
            }
          });
        } catch (error) {
          logger.warn('Error sending business alert notification', { error: error.message });
        }
      }
    }

    logger.info('Business alerts checked', { agencyWorkspaceId, alertsCreated: alerts.length });
    return alerts;
  } catch (error) {
    logger.error('Error checking business alerts', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Create business alert
 */
async function createBusinessAlert(agencyWorkspaceId, alertData) {
  const {
    type,
    severity,
    title,
    message,
    threshold,
    currentValue,
    previousValue,
    clientWorkspaceId = null,
    campaignId = null,
    recommendations = []
  } = alertData;

  const alert = new BusinessAlert({
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
      clientWorkspaceId,
      campaignId,
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
 * Get active alerts
 */
async function getActiveAlerts(agencyWorkspaceId, filters = {}) {
  try {
    const {
      severity = null,
      type = null
    } = filters;

    const query = {
      agencyWorkspaceId,
      status: 'active'
    };

    if (severity) query['alert.severity'] = severity;
    if (type) query['alert.type'] = type;

    const alerts = await BusinessAlert.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return alerts;
  } catch (error) {
    logger.error('Error getting active alerts', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

module.exports = {
  checkBusinessAlerts,
  getActiveAlerts
};


