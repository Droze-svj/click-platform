// Webhook Alert Service (Slack, Discord, etc.)

const https = require('https');
const http = require('http');
const { URL } = require('url');
const logger = require('../utils/logger');

/**
 * Send alert to webhook
 */
async function sendWebhookAlert(webhookUrl, alert) {
  try {
    const url = new URL(webhookUrl);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const payload = JSON.stringify({
      text: alert.message,
      attachments: [{
        color: getColorForSeverity(alert.severity),
        fields: [
          {
            title: 'Type',
            value: alert.type,
            short: true,
          },
          {
            title: 'Severity',
            value: alert.severity,
            short: true,
          },
          {
            title: 'Time',
            value: alert.timestamp.toISOString(),
            short: true,
          },
        ],
        ...(alert.details && {
          fields: [
            ...(alert.attachments?.[0]?.fields || []),
            {
              title: 'Details',
              value: '```' + JSON.stringify(alert.details, null, 2) + '```',
              short: false,
            },
          ],
        }),
      }],
    });

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    return new Promise((resolve, reject) => {
      const req = client.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            logger.info('Webhook alert sent', { webhookUrl: url.hostname, alertType: alert.type });
            resolve({ success: true, statusCode: res.statusCode });
          } else {
            reject(new Error(`Webhook returned status ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        logger.error('Webhook alert error', { error: error.message, webhookUrl: url.hostname });
        reject(error);
      });

      req.write(payload);
      req.end();
    });
  } catch (error) {
    logger.error('Send webhook alert error', { error: error.message, webhookUrl });
    throw error;
  }
}

/**
 * Send Slack alert
 */
async function sendSlackAlert(alert) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    logger.warn('Slack webhook URL not configured');
    return { success: false, error: 'Slack webhook not configured' };
  }

  return sendWebhookAlert(webhookUrl, alert);
}

/**
 * Send Discord alert
 */
async function sendDiscordAlert(alert) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    logger.warn('Discord webhook URL not configured');
    return { success: false, error: 'Discord webhook not configured' };
  }

  // Discord uses a slightly different format
  const discordPayload = {
    embeds: [{
      title: alert.message,
      color: getDiscordColorForSeverity(alert.severity),
      fields: [
        {
          name: 'Type',
          value: alert.type,
          inline: true,
        },
        {
          name: 'Severity',
          value: alert.severity,
          inline: true,
        },
      ],
      timestamp: alert.timestamp.toISOString(),
      ...(alert.details && {
        description: '```json\n' + JSON.stringify(alert.details, null, 2) + '\n```',
      }),
    }],
  };

  try {
    const url = new URL(webhookUrl);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const payload = JSON.stringify(discordPayload);

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    return new Promise((resolve, reject) => {
      const req = client.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            logger.info('Discord alert sent', { alertType: alert.type });
            resolve({ success: true, statusCode: res.statusCode });
          } else {
            reject(new Error(`Discord webhook returned status ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        logger.error('Discord alert error', { error: error.message });
        reject(error);
      });

      req.write(payload);
      req.end();
    });
  } catch (error) {
    logger.error('Send Discord alert error', { error: error.message });
    throw error;
  }
}

/**
 * Get color for severity (Slack)
 */
function getColorForSeverity(severity) {
  switch (severity) {
    case 'critical': return 'danger';
    case 'warning': return 'warning';
    case 'info': return 'good';
    default: return '#808080';
  }
}

/**
 * Get color for severity (Discord - decimal)
 */
function getDiscordColorForSeverity(severity) {
  switch (severity) {
    case 'critical': return 15158332; // Red
    case 'warning': return 16776960; // Yellow
    case 'info': return 3066993; // Green
    default: return 9807270; // Gray
  }
}

/**
 * Send alert to all configured webhooks
 */
async function sendToAllWebhooks(alert) {
  const results = [];

  // Send to Slack if configured
  if (process.env.SLACK_WEBHOOK_URL) {
    try {
      const result = await sendSlackAlert(alert);
      results.push({ service: 'slack', ...result });
    } catch (error) {
      results.push({ service: 'slack', success: false, error: error.message });
    }
  }

  // Send to Discord if configured
  if (process.env.DISCORD_WEBHOOK_URL) {
    try {
      const result = await sendDiscordAlert(alert);
      results.push({ service: 'discord', ...result });
    } catch (error) {
      results.push({ service: 'discord', success: false, error: error.message });
    }
  }

  return results;
}

module.exports = {
  sendWebhookAlert,
  sendSlackAlert,
  sendDiscordAlert,
  sendToAllWebhooks,
};




