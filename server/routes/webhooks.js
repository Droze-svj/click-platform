// Webhook Routes
// Webhook management and delivery

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const {
  createWebhook,
  testWebhook,
  getWebhookLogs,
  verifySignature,
  getWebhookStats
} = require('../services/webhookService');
const Webhook = require('../models/Webhook');

const router = express.Router();

/**
 * POST /api/webhooks
 * Create webhook
 */
router.post('/', auth, asyncHandler(async (req, res) => {
  const {
    name,
    url,
    events,
    workspaceId = null,
    filters = {},
    headers = {},
    settings = {}
  } = req.body;

  if (!name || !url || !events || !Array.isArray(events) || events.length === 0) {
    return sendError(res, 'Name, URL, and events are required', 400);
  }

  const webhook = await createWebhook(req.user._id, {
    name,
    url,
    events,
    workspaceId,
    filters,
    headers,
    settings
  });

  sendSuccess(res, 'Webhook created', 201, webhook);
}));

/**
 * GET /api/webhooks
 * List webhooks
 */
router.get('/', auth, asyncHandler(async (req, res) => {
  const { workspaceId = null, status = null } = req.query;

  const query = { userId: req.user._id };
  if (workspaceId) query.workspaceId = workspaceId;
  if (status) query.status = status;

  const webhooks = await Webhook.find(query).sort({ createdAt: -1 }).lean();
  sendSuccess(res, 'Webhooks retrieved', 200, { webhooks });
}));

/**
 * GET /api/webhooks/:id
 * Get webhook
 */
router.get('/:id', auth, asyncHandler(async (req, res) => {
  const webhook = await Webhook.findOne({
    _id: req.params.id,
    userId: req.user._id
  }).lean();

  if (!webhook) {
    return sendError(res, 'Webhook not found', 404);
  }

  // Don't send secret
  delete webhook.secret;

  sendSuccess(res, 'Webhook retrieved', 200, webhook);
}));

/**
 * PUT /api/webhooks/:id
 * Update webhook
 */
router.put('/:id', auth, asyncHandler(async (req, res) => {
  const webhook = await Webhook.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!webhook) {
    return sendError(res, 'Webhook not found', 404);
  }

  Object.assign(webhook, req.body);
  await webhook.save();

  // Don't send secret
  const response = webhook.toObject();
  delete response.secret;

  sendSuccess(res, 'Webhook updated', 200, response);
}));

/**
 * DELETE /api/webhooks/:id
 * Delete webhook
 */
router.delete('/:id', auth, asyncHandler(async (req, res) => {
  const webhook = await Webhook.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!webhook) {
    return sendError(res, 'Webhook not found', 404);
  }

  await webhook.deleteOne();
  sendSuccess(res, 'Webhook deleted', 200, { id: req.params.id });
}));

/**
 * POST /api/webhooks/:id/test
 * Test webhook
 */
router.post('/:id/test', auth, asyncHandler(async (req, res) => {
  const webhook = await Webhook.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!webhook) {
    return sendError(res, 'Webhook not found', 404);
  }

  const result = await testWebhook(req.params.id);
  sendSuccess(res, 'Webhook tested', 200, result);
}));

/**
 * GET /api/webhooks/:id/logs
 * Get webhook delivery logs
 */
router.get('/:id/logs', auth, asyncHandler(async (req, res) => {
  const webhook = await Webhook.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!webhook) {
    return sendError(res, 'Webhook not found', 404);
  }

  const logs = await getWebhookLogs(req.params.id, parseInt(req.query.limit) || 50);
  sendSuccess(res, 'Webhook logs retrieved', 200, logs);
}));

/**
 * GET /api/webhooks/:id/stats
 * Get webhook statistics
 */
router.get('/:id/stats', auth, asyncHandler(async (req, res) => {
  const webhook = await Webhook.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!webhook) {
    return sendError(res, 'Webhook not found', 404);
  }

  const { getWebhookStats } = require('../services/webhookService');
  const stats = await getWebhookStats(req.params.id, req.query.timeframe || '7d');
  sendSuccess(res, 'Webhook stats retrieved', 200, stats);
}));

/**
 * POST /api/webhooks/verify
 * Verify webhook signature (for receiving webhooks)
 */
router.post('/verify', express.raw({ type: 'application/json' }), asyncHandler(async (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const webhookId = req.headers['x-webhook-id'];

  if (!signature || !webhookId) {
    return sendError(res, 'Signature and webhook ID required', 400);
  }

  const webhook = await Webhook.findById(webhookId);
  if (!webhook) {
    return sendError(res, 'Webhook not found', 404);
  }

  const isValid = verifySignature(req.body.toString(), signature, webhook.secret);
  
  if (!isValid) {
    return sendError(res, 'Invalid signature', 401);
  }

  sendSuccess(res, 'Signature verified', 200, { valid: true });
}));

/**
 * POST /api/webhooks/:id/replay
 * Replay failed webhook deliveries
 */
router.post('/:id/replay', auth, asyncHandler(async (req, res) => {
  const webhook = await Webhook.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!webhook) {
    return sendError(res, 'Webhook not found', 404);
  }

  const { replayWebhook } = require('../services/webhookService');
  const { logId } = req.body;
  const result = await replayWebhook(req.params.id, logId);
  sendSuccess(res, 'Webhook replay completed', 200, result);
}));

/**
 * GET /api/webhooks/:id/health
 * Get webhook health status
 */
router.get('/:id/health', auth, asyncHandler(async (req, res) => {
  const webhook = await Webhook.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!webhook) {
    return sendError(res, 'Webhook not found', 404);
  }

  const { getWebhookHealth } = require('../services/webhookService');
  const health = await getWebhookHealth(req.params.id);
  sendSuccess(res, 'Webhook health retrieved', 200, health);
}));

/**
 * PUT /api/webhooks/:id/settings
 * Update webhook settings (batching, transformation, rate limiting)
 */
router.put('/:id/settings', auth, asyncHandler(async (req, res) => {
  const webhook = await Webhook.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!webhook) {
    return sendError(res, 'Webhook not found', 404);
  }

  const { batching, transformation, rateLimit } = req.body;

  if (batching) {
    webhook.settings.batching = { ...webhook.settings.batching, ...batching };
  }
  if (transformation) {
    webhook.settings.transformation = { ...webhook.settings.transformation, ...transformation };
  }
  if (rateLimit) {
    webhook.settings.rateLimit = { ...webhook.settings.rateLimit, ...rateLimit };
  }

  await webhook.save();

  const response = webhook.toObject();
  delete response.secret;

  sendSuccess(res, 'Webhook settings updated', 200, response);
}));

module.exports = router;
