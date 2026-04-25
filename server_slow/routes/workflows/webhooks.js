// Workflow webhook routes

const express = require('express');
const auth = require('../../middleware/auth');
const WorkflowWebhook = require('../../models/WorkflowWebhook');
const { sendWebhook, triggerWorkflowWebhook } = require('../../services/webhookService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/workflows/webhooks:
 *   post:
 *     summary: Create workflow webhook
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { workflowId, url, secret, events, retries, timeout } = req.body;

  if (!workflowId || !url) {
    return sendError(res, 'Workflow ID and URL are required', 400);
  }

  try {
    const webhook = new WorkflowWebhook({
      userId,
      workflowId,
      url,
      secret,
      events: events || ['workflow.completed'],
      retries: retries || 3,
      timeout: timeout || 5000,
    });

    await webhook.save();
    sendSuccess(res, 'Webhook created successfully', 200, webhook);
  } catch (error) {
    logger.error('Create webhook error', { error: error.message, userId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/workflows/webhooks:
 *   get:
 *     summary: Get workflow webhooks
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { workflowId } = req.query;

  try {
    const query = { userId };
    if (workflowId) {
      query.workflowId = workflowId;
    }

    const webhooks = await WorkflowWebhook.find(query).populate('workflowId', 'name');
    sendSuccess(res, 'Webhooks fetched', 200, webhooks);
  } catch (error) {
    logger.error('Get webhooks error', { error: error.message, userId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/workflows/webhooks/:id:
 *   delete:
 *     summary: Delete webhook
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { id } = req.params;

  try {
    const webhook = await WorkflowWebhook.findOneAndDelete({ _id: id, userId });
    if (!webhook) {
      return sendError(res, 'Webhook not found', 404);
    }

    sendSuccess(res, 'Webhook deleted successfully', 200);
  } catch (error) {
    logger.error('Delete webhook error', { error: error.message, userId, id });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/workflows/webhooks/:id/test:
 *   post:
 *     summary: Test webhook
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/test', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { id } = req.params;

  try {
    const webhook = await WorkflowWebhook.findOne({ _id: id, userId });
    if (!webhook) {
      return sendError(res, 'Webhook not found', 404);
    }

    const testPayload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook from Click',
        webhookId: webhook._id.toString(),
      },
    };

    const result = await sendWebhook(webhook.url, testPayload, {
      secret: webhook.secret,
      retries: 1,
    });

    // Update webhook stats
    if (result.success) {
      webhook.successCount++;
    } else {
      webhook.failureCount++;
    }
    webhook.lastTriggered = new Date();
    await webhook.save();

    sendSuccess(res, 'Webhook test completed', 200, result);
  } catch (error) {
    logger.error('Test webhook error', { error: error.message, userId, id });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;






