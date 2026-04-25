// Webhook Service
// Webhook delivery and management

const Webhook = require('../models/Webhook');
const WebhookLog = require('../models/WebhookLog');
const crypto = require('crypto');
const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Create webhook
 */
async function createWebhook(userId, webhookData) {
  try {
    const {
      name,
      url,
      events,
      workspaceId = null,
      filters = {},
      headers = {},
      settings = {}
    } = webhookData;

    // Generate secret
    const secret = crypto.randomBytes(32).toString('hex');

    const webhook = new Webhook({
      userId,
      workspaceId,
      name,
      url,
      secret,
      events,
      filters,
      headers,
      settings: {
        retryAttempts: settings.retryAttempts || 3,
        retryDelay: settings.retryDelay || 1000,
        timeout: settings.timeout || 30000,
        verifySSL: settings.verifySSL !== false
      },
      status: 'active'
    });

    await webhook.save();

    logger.info('Webhook created', { userId, webhookId: webhook._id, events: events.length });
    return webhook;
  } catch (error) {
    logger.error('Error creating webhook', { error: error.message, userId });
    throw error;
  }
}

/**
 * Deliver webhook event
 */
async function deliverWebhook(webhookId, event, payload) {
  try {
    const webhook = await Webhook.findById(webhookId);
    if (!webhook || webhook.status !== 'active') {
      return { delivered: false, reason: 'webhook_inactive' };
    }

    // Check if webhook subscribes to this event
    if (!webhook.events.includes(event)) {
      return { delivered: false, reason: 'event_not_subscribed' };
    }

    // Apply filters
    if (!passesFilters(payload, webhook.filters)) {
      return { delivered: false, reason: 'filtered_out' };
    }

    // Create webhook payload
    const webhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data: payload
    };

    // Generate signature
    const signature = generateSignature(JSON.stringify(webhookPayload), webhook.secret);

    // Prepare headers
    const headers = {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Webhook-Event': event,
      'X-Webhook-Id': webhook._id.toString(),
      ...webhook.headers
    };

    // Deliver webhook
    let attempts = 0;
    let lastError = null;
    let logEntry = null;

    while (attempts < webhook.settings.retryAttempts) {
      const startTime = Date.now();
      attempts++;

      try {
        // Create log entry for this attempt
        logEntry = new WebhookLog({
          webhookId: webhook._id,
          userId: webhook.userId,
          event,
          status: attempts === 1 ? 'pending' : 'retrying',
          attempt: attempts,
          payload: webhookPayload
        });

        const response = await axios.post(webhook.url, webhookPayload, {
          headers,
          timeout: webhook.settings.timeout,
          validateStatus: () => true // Don't throw on any status
        });

        const responseTime = Date.now() - startTime;

        if (response.status >= 200 && response.status < 300) {
          // Success
          webhook.stats.totalDeliveries++;
          webhook.stats.successfulDeliveries++;
          webhook.stats.lastDelivery = new Date();
          webhook.stats.lastSuccess = new Date();
          await webhook.save();

          // Log success
          logEntry.status = 'delivered';
          logEntry.httpStatus = response.status;
          logEntry.responseTime = responseTime;
          logEntry.response = response.data;
          logEntry.deliveredAt = new Date();
          await logEntry.save();

          logger.info('Webhook delivered', { webhookId, event, status: response.status, responseTime });
          return { delivered: true, status: response.status, attempts, responseTime };
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        lastError = error;
        const responseTime = Date.now() - startTime;

        // Log failure
        if (logEntry) {
          logEntry.status = attempts < webhook.settings.retryAttempts ? 'retrying' : 'failed';
          logEntry.responseTime = responseTime;
          logEntry.error = {
            message: error.message,
            code: error.code || error.response?.status,
            stack: error.stack
          };
          if (error.response) {
            logEntry.httpStatus = error.response.status;
            logEntry.response = error.response.data;
          }
          await logEntry.save();
        }

        if (attempts < webhook.settings.retryAttempts) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, webhook.settings.retryDelay * attempts));
        }
      }
    }

    // All attempts failed
    webhook.stats.totalDeliveries++;
    webhook.stats.failedDeliveries++;
    webhook.stats.lastDelivery = new Date();
    webhook.stats.lastFailure = new Date();

    // Mark as failed if too many failures
    if (webhook.stats.failedDeliveries > 10 && 
        webhook.stats.failedDeliveries / webhook.stats.totalDeliveries > 0.5) {
      webhook.status = 'failed';
    }

    await webhook.save();

    logger.error('Webhook delivery failed', { 
      webhookId, 
      event, 
      attempts, 
      error: lastError?.message 
    });

    return { 
      delivered: false, 
      error: lastError?.message, 
      attempts 
    };
  } catch (error) {
    logger.error('Error delivering webhook', { error: error.message, webhookId });
    throw error;
  }
}

/**
 * Generate webhook signature
 */
function generateSignature(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Verify webhook signature
 */
function verifySignature(payload, signature, secret) {
  const expectedSignature = generateSignature(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Check if payload passes filters
 */
function passesFilters(payload, filters) {
  if (!filters || Object.keys(filters).length === 0) {
    return true;
  }

  // Platform filter
  if (filters.platforms && filters.platforms.length > 0) {
    if (payload.platform && !filters.platforms.includes(payload.platform)) {
      return false;
    }
  }

  // Content type filter
  if (filters.contentTypes && filters.contentTypes.length > 0) {
    if (payload.type && !filters.contentTypes.includes(payload.type)) {
      return false;
    }
  }

  // Tags filter
  if (filters.tags && filters.tags.length > 0) {
    const payloadTags = payload.tags || [];
    if (!filters.tags.some(tag => payloadTags.includes(tag))) {
      return false;
    }
  }

  // Min engagement filter
  if (filters.minEngagement) {
    const engagement = payload.engagement || payload.analytics?.engagement || 0;
    if (engagement < filters.minEngagement) {
      return false;
    }
  }

  return true;
}

/**
 * Trigger webhook for event
 */
async function triggerWebhook(userId, event, payload, workspaceId = null) {
  try {
    const query = {
      userId,
      status: 'active',
      events: event
    };

    if (workspaceId) {
      query.workspaceId = workspaceId;
    }

    const webhooks = await Webhook.find(query);

    // Also broadcast via SSE if available
    try {
      const { broadcastEvent } = require('../routes/events');
      broadcastEvent(userId, event, payload);
    } catch (error) {
      // SSE not critical, continue
    }

    const results = await Promise.allSettled(
      webhooks.map(webhook => deliverWebhook(webhook._id, event, payload))
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.delivered).length;
    const failed = results.length - successful;

    logger.info('Webhooks triggered', { userId, event, total: webhooks.length, successful, failed });
    return { triggered: webhooks.length, successful, failed };
  } catch (error) {
    logger.error('Error triggering webhooks', { error: error.message, userId, event });
    throw error;
  }
}

/**
 * Test webhook
 */
async function testWebhook(webhookId) {
  try {
    const webhook = await Webhook.findById(webhookId);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const testPayload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook',
        webhookId: webhook._id.toString(),
        webhookName: webhook.name
      }
    };

    const result = await deliverWebhook(webhookId, 'webhook.test', testPayload.data);
    return result;
  } catch (error) {
    logger.error('Error testing webhook', { error: error.message, webhookId });
    throw error;
  }
}

/**
 * Get webhook delivery logs
 */
async function getWebhookLogs(webhookId, limit = 50) {
  try {
    const webhook = await Webhook.findById(webhookId);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const logs = await WebhookLog.find({ webhookId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return {
      webhookId,
      stats: webhook.stats,
      recentDeliveries: logs
    };
  } catch (error) {
    logger.error('Error getting webhook logs', { error: error.message, webhookId });
    throw error;
  }
}

/**
 * Get webhook statistics
 */
async function getWebhookStats(webhookId, timeframe = '7d') {
  try {
    const webhook = await Webhook.findById(webhookId);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const days = parseInt(timeframe) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await WebhookLog.find({
      webhookId,
      createdAt: { $gte: startDate }
    }).lean();

    const stats = {
      total: logs.length,
      delivered: logs.filter(l => l.status === 'delivered').length,
      failed: logs.filter(l => l.status === 'failed').length,
      retrying: logs.filter(l => l.status === 'retrying').length,
      averageResponseTime: 0,
      byEvent: {},
      byStatus: {}
    };

    let totalResponseTime = 0;
    let responseTimeCount = 0;

    logs.forEach(log => {
      if (log.responseTime) {
        totalResponseTime += log.responseTime;
        responseTimeCount++;
      }

      if (!stats.byEvent[log.event]) {
        stats.byEvent[log.event] = { total: 0, delivered: 0, failed: 0 };
      }
      stats.byEvent[log.event].total++;
      if (log.status === 'delivered') stats.byEvent[log.event].delivered++;
      if (log.status === 'failed') stats.byEvent[log.event].failed++;

      if (!stats.byStatus[log.status]) {
        stats.byStatus[log.status] = 0;
      }
      stats.byStatus[log.status]++;
    });

    stats.averageResponseTime = responseTimeCount > 0 
      ? Math.round(totalResponseTime / responseTimeCount) 
      : 0;

    return stats;
  } catch (error) {
    logger.error('Error getting webhook stats', { error: error.message, webhookId });
    throw error;
  }
}

/**
 * Replay failed webhook deliveries
 */
async function replayWebhook(webhookId, logId = null) {
  try {
    const webhook = await Webhook.findById(webhookId);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    let logs;
    if (logId) {
      // Replay specific log
      logs = await WebhookLog.find({ _id: logId, webhookId, status: 'failed' });
    } else {
      // Replay all failed logs from last 24 hours
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      logs = await WebhookLog.find({
        webhookId,
        status: 'failed',
        createdAt: { $gte: yesterday }
      }).sort({ createdAt: -1 }).limit(100);
    }

    if (logs.length === 0) {
      return { replayed: 0, message: 'No failed deliveries to replay' };
    }

    const results = [];
    for (const log of logs) {
      const result = await deliverWebhook(webhookId, log.event, log.payload);
      results.push({ logId: log._id, ...result });
    }

    const successful = results.filter(r => r.delivered).length;
    logger.info('Webhook replay completed', { webhookId, total: logs.length, successful });
    return { replayed: logs.length, successful, results };
  } catch (error) {
    logger.error('Error replaying webhook', { error: error.message, webhookId });
    throw error;
  }
}

/**
 * Transform webhook payload using custom script
 */
function transformPayload(payload, transformationScript) {
  try {
    if (!transformationScript) {
      return payload;
    }

    // Create safe execution context
    const context = {
      payload: JSON.parse(JSON.stringify(payload)), // Deep clone
      console: {
        log: () => {} // Disable console.log
      }
    };

    // Execute transformation (in production, use a sandbox like vm2)
    const transformed = eval(`(function() { ${transformationScript} return payload; })()`);
    return transformed || payload;
  } catch (error) {
    logger.error('Error transforming webhook payload', { error: error.message });
    return payload; // Return original on error
  }
}

/**
 * Batch webhook deliveries
 */
async function deliverBatchedWebhook(webhookId, events) {
  try {
    const webhook = await Webhook.findById(webhookId);
    if (!webhook || webhook.status !== 'active') {
      return { delivered: false, reason: 'webhook_inactive' };
    }

    if (!webhook.settings.batching?.enabled) {
      return { delivered: false, reason: 'batching_not_enabled' };
    }

    // Create batched payload
    const batchedPayload = {
      batch: true,
      count: events.length,
      events: events.map(e => ({
        event: e.event,
        timestamp: e.timestamp || new Date().toISOString(),
        data: e.data
      }))
    };

    // Apply transformation if enabled
    let finalPayload = batchedPayload;
    if (webhook.settings.transformation?.enabled) {
      finalPayload = transformPayload(batchedPayload, webhook.settings.transformation.script);
    }

    // Deliver batched webhook
    const webhookPayload = {
      event: 'webhook.batch',
      timestamp: new Date().toISOString(),
      data: finalPayload
    };

    const signature = generateSignature(JSON.stringify(webhookPayload), webhook.secret);
    const headers = {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Webhook-Event': 'webhook.batch',
      'X-Webhook-Id': webhook._id.toString(),
      'X-Webhook-Batch-Size': events.length.toString(),
      ...webhook.headers
    };

    const response = await axios.post(webhook.url, webhookPayload, {
      headers,
      timeout: webhook.settings.timeout,
      validateStatus: () => true
    });

    if (response.status >= 200 && response.status < 300) {
      webhook.stats.totalDeliveries += events.length;
      webhook.stats.successfulDeliveries += events.length;
      webhook.stats.lastDelivery = new Date();
      webhook.stats.lastSuccess = new Date();
      await webhook.save();

      logger.info('Batched webhook delivered', { webhookId, eventCount: events.length });
      return { delivered: true, status: response.status, eventCount: events.length };
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    logger.error('Error delivering batched webhook', { error: error.message, webhookId });
    return { delivered: false, error: error.message };
  }
}

/**
 * Get webhook health status
 */
async function getWebhookHealth(webhookId) {
  try {
    const webhook = await Webhook.findById(webhookId);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const last24Hours = new Date();
    last24Hours.setHours(last24Hours.getHours() - 24);

    const recentLogs = await WebhookLog.find({
      webhookId,
      createdAt: { $gte: last24Hours }
    }).lean();

    const total = recentLogs.length;
    const delivered = recentLogs.filter(l => l.status === 'delivered').length;
    const failed = recentLogs.filter(l => l.status === 'failed').length;
    const successRate = total > 0 ? (delivered / total) * 100 : 100;

    const avgResponseTime = recentLogs
      .filter(l => l.responseTime)
      .reduce((sum, l) => sum + l.responseTime, 0) / (recentLogs.filter(l => l.responseTime).length || 1);

    let healthStatus = 'healthy';
    if (successRate < 50) {
      healthStatus = 'critical';
    } else if (successRate < 80) {
      healthStatus = 'degraded';
    }

    // Check if webhook is responding
    let endpointHealth = 'unknown';
    try {
      const testResponse = await axios.get(webhook.url, {
        timeout: 5000,
        validateStatus: () => true
      });
      endpointHealth = testResponse.status < 500 ? 'healthy' : 'degraded';
    } catch (error) {
      endpointHealth = 'down';
    }

    return {
      webhookId,
      status: webhook.status,
      health: healthStatus,
      endpointHealth,
      metrics: {
        totalDeliveries: total,
        successfulDeliveries: delivered,
        failedDeliveries: failed,
        successRate: Math.round(successRate * 100) / 100,
        averageResponseTime: Math.round(avgResponseTime),
        lastDelivery: webhook.stats.lastDelivery,
        lastSuccess: webhook.stats.lastSuccess,
        lastFailure: webhook.stats.lastFailure
      },
      recommendations: generateHealthRecommendations(webhook, successRate, avgResponseTime)
    };
  } catch (error) {
    logger.error('Error getting webhook health', { error: error.message, webhookId });
    throw error;
  }
}

/**
 * Generate health recommendations
 */
function generateHealthRecommendations(webhook, successRate, avgResponseTime) {
  const recommendations = [];

  if (successRate < 80) {
    recommendations.push({
      type: 'warning',
      message: 'Low success rate detected. Consider checking endpoint availability and retry settings.',
      action: 'review_endpoint'
    });
  }

  if (avgResponseTime > 5000) {
    recommendations.push({
      type: 'warning',
      message: 'Slow response times detected. Consider optimizing endpoint or increasing timeout.',
      action: 'optimize_endpoint'
    });
  }

  if (webhook.stats.failedDeliveries > 10) {
    recommendations.push({
      type: 'error',
      message: 'Multiple failed deliveries. Review webhook configuration and endpoint.',
      action: 'review_configuration'
    });
  }

  if (webhook.settings.retryAttempts < 3) {
    recommendations.push({
      type: 'info',
      message: 'Consider increasing retry attempts for better reliability.',
      action: 'increase_retries'
    });
  }

  return recommendations;
}

module.exports = {
  createWebhook,
  deliverWebhook,
  verifySignature,
  triggerWebhook,
  testWebhook,
  getWebhookLogs,
  getWebhookStats,
  replayWebhook,
  transformPayload,
  deliverBatchedWebhook,
  getWebhookHealth
};
