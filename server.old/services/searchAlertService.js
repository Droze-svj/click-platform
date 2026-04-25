// Search Alert Service
// Manages search alerts and notifications

const SearchAlert = require('../models/SearchAlert');
const Content = require('../models/Content');
const { facetedSearch } = require('./advancedSearchService');
const notificationService = require('./notificationService');
const logger = require('../utils/logger');

/**
 * Create search alert
 */
async function createSearchAlert(userId, alertData) {
  try {
    const alert = new SearchAlert({
      userId,
      name: alertData.name || 'Search Alert',
      query: alertData.query || '',
      filters: alertData.filters || {},
      frequency: alertData.frequency || 'daily',
      isActive: true,
      lastChecked: new Date()
    });

    await alert.save();
    logger.info('Search alert created', { alertId: alert._id, userId });
    return alert;
  } catch (error) {
    logger.error('Error creating search alert', { error: error.message, userId });
    throw error;
  }
}

/**
 * Check search alerts and send notifications
 */
async function checkSearchAlerts() {
  try {
    const now = new Date();
    const alerts = await SearchAlert.find({
      isActive: true,
      $or: [
        { frequency: 'realtime' },
        { frequency: 'daily', lastChecked: { $lt: new Date(now.setHours(0, 0, 0, 0)) } },
        { frequency: 'weekly', lastChecked: { $lt: new Date(now.setDate(now.getDate() - 7)) } }
      ]
    }).lean();

    logger.info('Checking search alerts', { count: alerts.length });

    for (const alert of alerts) {
      try {
        await checkAlert(alert);
      } catch (error) {
        logger.error('Error checking alert', { error: error.message, alertId: alert._id });
      }
    }

    return { checked: alerts.length };
  } catch (error) {
    logger.error('Error checking search alerts', { error: error.message });
    throw error;
  }
}

/**
 * Check individual alert
 */
async function checkAlert(alert) {
  try {
    // Perform search
    const searchResult = await facetedSearch(alert.userId, alert.query, alert.filters);

    // Find new content since last check
    const newContent = searchResult.results.filter(content => {
      const contentId = content._id || content.content?._id;
      if (!contentId) return false;

      // Check if content was created after last check
      const createdAt = new Date(content.createdAt || content.content?.createdAt);
      if (createdAt <= new Date(alert.lastChecked)) {
        return false;
      }

      // Check if already notified
      return !alert.matchedContentIds.includes(contentId.toString());
    });

    if (newContent.length > 0) {
      // Send notification
      const contentIds = newContent.map(c => c._id || c.content?._id).filter(Boolean);
      
      notificationService.notifyUser(alert.userId, {
        type: 'info',
        title: `New content matches "${alert.name}"`,
        message: `${newContent.length} new ${newContent.length === 1 ? 'item' : 'items'} found`,
        data: {
          alertId: alert._id,
          contentIds,
          count: newContent.length
        }
      });

      // Update alert
      await SearchAlert.findByIdAndUpdate(alert._id, {
        lastNotification: new Date(),
        lastChecked: new Date(),
        $inc: { notificationCount: 1 },
        $addToSet: { matchedContentIds: { $each: contentIds } }
      });

      logger.info('Search alert notification sent', {
        alertId: alert._id,
        userId: alert.userId,
        count: newContent.length
      });
    } else {
      // Update last checked even if no new content
      await SearchAlert.findByIdAndUpdate(alert._id, {
        lastChecked: new Date()
      });
    }
  } catch (error) {
    logger.error('Error checking alert', { error: error.message, alertId: alert._id });
    throw error;
  }
}

/**
 * Get user's search alerts
 */
async function getUserAlerts(userId) {
  try {
    const alerts = await SearchAlert.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    return alerts;
  } catch (error) {
    logger.error('Error getting user alerts', { error: error.message, userId });
    // Return empty array instead of throwing to prevent 500 errors
    return [];
  }
}

/**
 * Toggle alert active status
 */
async function toggleAlert(alertId, userId, isActive) {
  try {
    const alert = await SearchAlert.findOne({
      _id: alertId,
      userId
    });

    if (!alert) {
      throw new Error('Alert not found');
    }

    alert.isActive = isActive;
    await alert.save();

    return alert;
  } catch (error) {
    logger.error('Error toggling alert', { error: error.message, alertId });
    throw error;
  }
}

/**
 * Delete search alert
 */
async function deleteAlert(alertId, userId) {
  try {
    const alert = await SearchAlert.findOneAndDelete({
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
  createSearchAlert,
  checkSearchAlerts,
  getUserAlerts,
  toggleAlert,
  deleteAlert
};


