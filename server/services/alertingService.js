// Alerting Service for Critical Errors and Issues

const logger = require('../utils/logger');
const { captureException, captureMessage } = require('../utils/sentry');
const { sendEmail } = require('./emailService');
const { sendToAllWebhooks } = require('./webhookAlertService');

// Alert thresholds
const ALERT_THRESHOLDS = {
  errorRate: 5, // 5% error rate triggers alert
  responseTime: 5000, // 5 seconds average response time
  consecutiveErrors: 10, // 10 consecutive errors
  memoryUsage: 90, // 90% memory usage
  diskUsage: 90, // 90% disk usage
};

// Track consecutive errors
let consecutiveErrorCount = 0;
let lastAlertTime = {};

/**
 * Check if alert should be sent (rate limiting)
 */
function shouldSendAlert(alertType, cooldownMinutes = 60) {
  const now = Date.now();
  const lastSent = lastAlertTime[alertType] || 0;
  const cooldown = cooldownMinutes * 60 * 1000;

  if (now - lastSent < cooldown) {
    return false;
  }

  lastAlertTime[alertType] = now;
  return true;
}

/**
 * Send alert via multiple channels
 */
async function sendAlert(alertType, severity, message, details = {}) {
  const alert = {
    type: alertType,
    severity, // 'critical', 'warning', 'info'
    message,
    details,
    timestamp: new Date(),
  };

  // Log alert
  const logLevel = severity === 'critical' ? 'error' : severity === 'warning' ? 'warn' : 'info';
  logger[logLevel]('Alert triggered', alert);

  // Send to Sentry for critical alerts
  if (severity === 'critical') {
    captureMessage(message, 'error', {
      tags: { alertType, severity },
      extra: details,
    });
  }

  // Send email to admins for critical alerts
  if (severity === 'critical' && process.env.ADMIN_EMAIL) {
    try {
      await sendEmail({
        to: process.env.ADMIN_EMAIL,
        subject: `[CRITICAL] ${message}`,
        html: `
          <h2>Critical Alert: ${alertType}</h2>
          <p><strong>Message:</strong> ${message}</p>
          <pre>${JSON.stringify(details, null, 2)}</pre>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
        `,
      });
    } catch (error) {
      logger.error('Failed to send alert email', { error: error.message });
    }
  }

  // Send to webhooks (Slack, Discord, etc.) for critical and warning alerts
  if ((severity === 'critical' || severity === 'warning') && 
      (process.env.SLACK_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL)) {
    try {
      await sendToAllWebhooks(alert);
    } catch (error) {
      logger.error('Failed to send webhook alerts', { error: error.message });
    }
  }

  return alert;
}

/**
 * Check error rate and alert if high
 */
async function checkErrorRate(errorRate, totalRequests) {
  if (errorRate > ALERT_THRESHOLDS.errorRate && totalRequests > 100) {
    if (shouldSendAlert('high_error_rate')) {
      await sendAlert(
        'high_error_rate',
        'critical',
        `High error rate detected: ${errorRate.toFixed(2)}%`,
        { errorRate, totalRequests }
      );
    }
  }
}

/**
 * Check response time and alert if slow
 */
async function checkResponseTime(avgResponseTime) {
  if (avgResponseTime > ALERT_THRESHOLDS.responseTime) {
    if (shouldSendAlert('slow_response_time')) {
      await sendAlert(
        'slow_response_time',
        'warning',
        `Slow average response time: ${avgResponseTime}ms`,
        { avgResponseTime }
      );
    }
  }
}

/**
 * Track consecutive errors
 */
async function trackConsecutiveError(error) {
  consecutiveErrorCount++;

  if (consecutiveErrorCount >= ALERT_THRESHOLDS.consecutiveErrors) {
    if (shouldSendAlert('consecutive_errors', 30)) {
      await sendAlert(
        'consecutive_errors',
        'critical',
        `${consecutiveErrorCount} consecutive errors detected`,
        {
          count: consecutiveErrorCount,
          lastError: error.message,
        }
      );
    }
  }
}

/**
 * Reset consecutive error count
 */
function resetConsecutiveErrors() {
  consecutiveErrorCount = 0;
}

/**
 * Check memory usage
 */
async function checkMemoryUsage() {
  const usage = process.memoryUsage();
  const heapUsedMB = usage.heapUsed / 1024 / 1024;
  const heapTotalMB = usage.heapTotal / 1024 / 1024;
  const usagePercent = (heapUsedMB / heapTotalMB) * 100;

  if (usagePercent > ALERT_THRESHOLDS.memoryUsage) {
    if (shouldSendAlert('high_memory_usage', 120)) {
      await sendAlert(
        'high_memory_usage',
        'warning',
        `High memory usage: ${usagePercent.toFixed(2)}%`,
        {
          heapUsed: `${heapUsedMB.toFixed(2)}MB`,
          heapTotal: `${heapTotalMB.toFixed(2)}MB`,
          usagePercent: usagePercent.toFixed(2),
        }
      );
    }
  }
}

/**
 * Monitor database connection
 */
async function checkDatabaseConnection() {
  const mongoose = require('mongoose');
  
  if (mongoose.connection.readyState !== 1) {
    if (shouldSendAlert('database_disconnected')) {
      await sendAlert(
        'database_disconnected',
        'critical',
        'Database connection lost',
        { readyState: mongoose.connection.readyState }
      );
    }
  }
}

/**
 * Start monitoring loop
 */
function startMonitoring(intervalMs = 60000) { // Default 1 minute
  setInterval(async () => {
    try {
      await checkMemoryUsage();
      await checkDatabaseConnection();
    } catch (error) {
      logger.error('Monitoring check error', { error: error.message });
    }
  }, intervalMs);

  logger.info('Alerting service monitoring started', { interval: `${intervalMs / 1000}s` });
}

module.exports = {
  sendAlert,
  checkErrorRate,
  checkResponseTime,
  trackConsecutiveError,
  resetConsecutiveErrors,
  checkMemoryUsage,
  checkDatabaseConnection,
  startMonitoring,
  ALERT_THRESHOLDS,
};

