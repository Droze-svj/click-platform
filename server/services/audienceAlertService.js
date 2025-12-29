// Audience Alert Service
// Manages audience change alerts

const AudienceAlert = require('../models/AudienceAlert');
const { getAudienceInsights } = require('./advancedAudienceInsightsService');
const notificationService = require('./notificationService');
const logger = require('../utils/logger');

/**
 * Create audience alert
 */
async function createAudienceAlert(userId, alertData) {
  try {
    const alert = new AudienceAlert({
      userId,
      name: alertData.name,
      metric: alertData.metric,
      threshold: alertData.threshold,
      value: alertData.value,
      platform: alertData.platform || 'all',
      isActive: true
    });

    await alert.save();
    logger.info('Audience alert created', { alertId: alert._id, userId });
    return alert;
  } catch (error) {
    logger.error('Error creating audience alert', { error: error.message, userId });
    throw error;
  }
}

/**
 * Check audience alerts
 */
async function checkAudienceAlerts(userId) {
  try {
    const alerts = await AudienceAlert.find({
      userId,
      isActive: true
    }).lean();

    if (alerts.length === 0) {
      return { checked: 0, triggered: 0 };
    }

    // Get current audience insights
    const insights = await getAudienceInsights(userId, { period: 7 }); // Last 7 days

    if (!insights.hasData) {
      return { checked: alerts.length, triggered: 0 };
    }

    let triggeredCount = 0;

    for (const alert of alerts) {
      try {
        let currentValue = 0;
        let shouldTrigger = false;

        // Get current value based on metric
        switch (alert.metric) {
          case 'engagement':
            currentValue = insights.insights.overview.avgEngagement;
            break;
          case 'growth':
            currentValue = insights.insights.growth.growthRate;
            break;
          case 'retention':
            // Would need retention analysis
            continue;
          case 'sentiment':
            // Would need sentiment analysis
            continue;
          case 'engagementRate':
            currentValue = insights.insights.overview.engagementRate;
            break;
        }

        // Check threshold
        switch (alert.threshold) {
          case 'increase':
            // Compare with previous period
            const previousInsights = await getAudienceInsights(userId, { period: 14 });
            if (previousInsights.hasData) {
              const previousValue = alert.metric === 'engagement'
                ? previousInsights.insights.overview.avgEngagement
                : alert.metric === 'engagementRate'
                ? previousInsights.insights.overview.engagementRate
                : previousInsights.insights.growth.growthRate;
              
              const increase = ((currentValue / previousValue) - 1) * 100;
              shouldTrigger = increase >= alert.value;
            }
            break;
          case 'decrease':
            const prevInsights = await getAudienceInsights(userId, { period: 14 });
            if (prevInsights.hasData) {
              const prevValue = alert.metric === 'engagement'
                ? prevInsights.insights.overview.avgEngagement
                : alert.metric === 'engagementRate'
                ? prevInsights.insights.overview.engagementRate
                : prevInsights.insights.growth.growthRate;
              
              const decrease = ((1 - (currentValue / prevValue)) * 100);
              shouldTrigger = decrease >= alert.value;
            }
            break;
          case 'above':
            shouldTrigger = currentValue >= alert.value;
            break;
          case 'below':
            shouldTrigger = currentValue <= alert.value;
            break;
        }

        if (shouldTrigger) {
          // Send notification
          notificationService.notifyUser(userId, {
            type: alert.threshold === 'decrease' || alert.threshold === 'below' ? 'warning' : 'info',
            title: `Audience Alert: ${alert.name}`,
            message: `${alert.metric} is ${alert.threshold} threshold (${currentValue.toFixed(1)})`,
            data: {
              alertId: alert._id,
              metric: alert.metric,
              currentValue,
              threshold: alert.value
            }
          });

          // Update alert
          await AudienceAlert.findByIdAndUpdate(alert._id, {
            lastTriggered: new Date(),
            $inc: { triggerCount: 1 }
          });

          triggeredCount++;
        }
      } catch (error) {
        logger.error('Error checking alert', { error: error.message, alertId: alert._id });
      }
    }

    return { checked: alerts.length, triggered: triggeredCount };
  } catch (error) {
    logger.error('Error checking audience alerts', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get user's alerts
 */
async function getUserAlerts(userId) {
  try {
    const alerts = await AudienceAlert.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    return alerts;
  } catch (error) {
    logger.error('Error getting user alerts', { error: error.message, userId });
    throw error;
  }
}

/**
 * Toggle alert
 */
async function toggleAlert(alertId, userId, isActive) {
  try {
    const alert = await AudienceAlert.findOneAndUpdate(
      { _id: alertId, userId },
      { isActive },
      { new: true }
    );

    if (!alert) {
      throw new Error('Alert not found');
    }

    return alert;
  } catch (error) {
    logger.error('Error toggling alert', { error: error.message, alertId });
    throw error;
  }
}

/**
 * Delete alert
 */
async function deleteAlert(alertId, userId) {
  try {
    const alert = await AudienceAlert.findOneAndDelete({
      _id: alertId,
      userId
    });

    if (!alert) {
      throw new Error('Alert not found');
    }

    return alert;
  } catch (error) {
    logger.error('Error deleting alert', { error: error.message, alertId });
    throw error;
  }
}

module.exports = {
  createAudienceAlert,
  checkAudienceAlerts,
  getUserAlerts,
  toggleAlert,
  deleteAlert
};


