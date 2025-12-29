// Repost Alert Service
// Manages repost performance alerts

const RepostAlert = require('../models/RepostAlert');
const ContentRecycle = require('../models/ContentRecycle');
const { detectContentDecay, predictRepostPerformance } = require('./contentRecyclingService');
const logger = require('../utils/logger');

/**
 * Create repost alert
 */
async function createRepostAlert(userId, alertData) {
  try {
    const alert = new RepostAlert({
      userId,
      recycleId: alertData.recycleId,
      name: alertData.name,
      metric: alertData.metric,
      threshold: alertData.threshold,
      value: alertData.value,
      isActive: true
    });

    await alert.save();
    logger.info('Repost alert created', { alertId: alert._id, userId });
    return alert;
  } catch (error) {
    logger.error('Error creating repost alert', { error: error.message, userId });
    throw error;
  }
}

/**
 * Check repost alerts
 */
async function checkRepostAlerts(userId) {
  try {
    const alerts = await RepostAlert.find({
      userId,
      isActive: true
    }).lean();

    if (alerts.length === 0) {
      return { checked: 0, triggered: 0 };
    }

    let triggeredCount = 0;

    for (const alert of alerts) {
      try {
        const recycle = await ContentRecycle.findById(alert.recycleId).lean();
        if (!recycle) continue;

        let shouldTrigger = false;
        let currentValue = 0;

        switch (alert.metric) {
          case 'engagement':
            currentValue = recycle.repostPerformance?.engagement || 0;
            if (alert.threshold === 'below') {
              shouldTrigger = currentValue < alert.value;
            } else if (alert.threshold === 'above') {
              shouldTrigger = currentValue > alert.value;
            }
            break;

          case 'engagementRate':
            currentValue = recycle.repostPerformance?.engagementRate || 0;
            if (alert.threshold === 'below') {
              shouldTrigger = currentValue < alert.value;
            } else if (alert.threshold === 'above') {
              shouldTrigger = currentValue > alert.value;
            }
            break;

          case 'performance':
            const original = recycle.originalPerformance?.engagement || 0;
            const repost = recycle.repostPerformance?.engagement || 0;
            if (original > 0) {
              currentValue = (repost / original) * 100;
              if (alert.threshold === 'below') {
                shouldTrigger = currentValue < alert.value;
              }
            }
            break;

          case 'decay':
            const decayResult = await detectContentDecay(alert.recycleId);
            if (decayResult.decayDetected) {
              shouldTrigger = true;
              currentValue = decayResult.decayScore;
            }
            break;
        }

        if (shouldTrigger) {
          // Send notification (if notification service exists)
          try {
            const notificationService = require('./notificationService');
            if (notificationService && notificationService.notifyUser) {
              notificationService.notifyUser(userId, {
                type: 'warning',
                title: `Repost Alert: ${alert.name}`,
                message: `${alert.metric} ${alert.threshold} threshold (${currentValue.toFixed(1)})`,
                data: {
                  alertId: alert._id,
                  recycleId: alert.recycleId,
                  metric: alert.metric,
                  currentValue,
                  threshold: alert.value
                }
              });
            }
          } catch (error) {
            logger.warn('Notification service not available', { error: error.message });
          }

          // Update alert
          await RepostAlert.findByIdAndUpdate(alert._id, {
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
    logger.error('Error checking repost alerts', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get user's alerts
 */
async function getUserAlerts(userId) {
  try {
    const alerts = await RepostAlert.find({ userId })
      .populate('recycleId', 'originalContentId platform')
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
    const alert = await RepostAlert.findOneAndUpdate(
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
    const alert = await RepostAlert.findOneAndDelete({
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
  createRepostAlert,
  checkRepostAlerts,
  getUserAlerts,
  toggleAlert,
  deleteAlert
};

