// Webhook Testing Service

const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Test webhook
 */
async function testWebhook(webhookId, webhookData, testEvent = 'test') {
  try {
    const { url, secret } = webhookData;

    // Create test payload
    const payload = {
      event: testEvent,
      data: {
        test: true,
        timestamp: new Date().toISOString(),
        message: 'This is a test webhook',
      },
      timestamp: new Date().toISOString(),
      webhookId: webhookId.toString(),
    };

    // Sign payload
    const signature = signPayload(JSON.stringify(payload), secret);

    // Send test webhook
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': testEvent,
      },
      timeout: 10000,
      validateStatus: () => true, // Don't throw on any status
    });

    return {
      success: response.status >= 200 && response.status < 300,
      status: response.status,
      statusText: response.statusText,
      responseTime: response.headers['x-response-time'] || 'unknown',
      responseData: response.data,
      timestamp: new Date(),
    };
  } catch (error) {
    logger.error('Test webhook error', {
      error: error.message,
      webhookId,
    });

    return {
      success: false,
      error: error.message,
      timestamp: new Date(),
    };
  }
}

/**
 * Sign payload
 */
function signPayload(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Validate webhook URL
 */
function validateWebhookURL(url) {
  try {
    const parsed = new URL(url);
    
    // Only allow HTTPS in production
    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
      return {
        valid: false,
        error: 'Webhook URL must use HTTPS in production',
      };
    }

    // Check for localhost in production
    if (process.env.NODE_ENV === 'production' && 
        (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
      return {
        valid: false,
        error: 'Localhost URLs not allowed in production',
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid URL format',
    };
  }
}

/**
 * Get webhook statistics
 */
async function getWebhookStats(webhookId, period = 30) {
  try {
    const Webhook = require('../models/Webhook');
    const webhook = await Webhook.findById(webhookId).lean();

    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    // Calculate success rate
    const totalTriggers = webhook.successCount + (webhook.failureCount || 0);
    const successRate = totalTriggers > 0
      ? (webhook.successCount / totalTriggers) * 100
      : 0;

    return {
      webhookId,
      period,
      totalTriggers,
      successCount: webhook.successCount || 0,
      failureCount: webhook.failureCount || 0,
      successRate: Math.round(successRate * 100) / 100,
      lastTriggered: webhook.lastTriggered,
      lastStatus: webhook.lastStatus,
      averageResponseTime: webhook.averageResponseTime || 0,
    };
  } catch (error) {
    logger.error('Get webhook stats error', {
      error: error.message,
      webhookId,
    });
    throw error;
  }
}

module.exports = {
  testWebhook,
  validateWebhookURL,
  getWebhookStats,
};






