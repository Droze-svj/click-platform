const logger = require('../utils/logger');
const notificationService = require('./notificationService');

/**
 * Style-DNA Drift Alert Service
 * Monitors and notifies creators when their aesthetic style drifts from the viral curve.
 */
class StyleDnaAlertService {
  constructor() {
    this.alerts = [];
  }

  /**
   * Trigger a drift alert for a creator/region
   * @param {string} regionId
   * @param {Object} driftData
   */
  async triggerDriftAlert(regionId, driftData) {
    try {
      const alert = {
        id: `DRIFT-${Date.now()}`,
        regionId,
        ...driftData,
        timestamp: Date.now(),
        status: 'active'
      };

      this.alerts.push(alert);

      logger.warn('ALERT: Style-DNA Drift Alert Created', alert);

      // Send notification to the "Agency Dashboard" or "Creator Portal"
      await notificationService.createNotification(
        '000000000000000000000000', // System ADMIN ID
        `🔥 Style-DNA Drift: ${driftData.styleName}`,
        `Your style in ${regionId} has drifted. Performance: ${driftData.performance * 100}%. We recommend a Phoenix Re-Render.`,
        'warning',
        null,
        { urgency: 'high', category: 'system', data: alert }
      );

      return alert;
    } catch (error) {
      logger.error('Error in triggerDriftAlert', { error: error.message });
      throw error;
    }
  }

  getActiveAlerts() {
    return this.alerts.filter(a => a.status === 'active');
  }

  dismissAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) alert.status = 'dismissed';
  }
}

module.exports = new StyleDnaAlertService();
