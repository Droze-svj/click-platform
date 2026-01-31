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
const WebhookLog = require('../models/WebhookLog');
const { createRateLimiter } = require('../middleware/enhancedRateLimiter');

const router = express.Router();

// Rate limiter for Supabase webhook endpoint (100 requests per minute per IP)
const supabaseWebhookRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per window
  message: 'Too many webhook requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false
});

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

/**
 * GET /api/webhooks/supabase/health
 * Health check endpoint for Supabase webhooks
 */
router.get('/supabase/health', asyncHandler(async (req, res) => {
  const logger = require('../utils/logger');
  
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    endpoint: '/api/webhooks/supabase',
    features: {
      signatureVerification: !!process.env.SUPABASE_WEBHOOK_SECRET,
      logging: true,
      rateLimiting: true,
      asyncProcessing: true
    },
    environment: process.env.NODE_ENV || 'development'
  };
  
  // Check recent webhook activity (last 24 hours)
  try {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentLogs = await WebhookLog.countDocuments({
      event: { $regex: /^supabase\./ },
      createdAt: { $gte: last24Hours }
    });
    
    const recentFailures = await WebhookLog.countDocuments({
      event: { $regex: /^supabase\./ },
      status: 'failed',
      createdAt: { $gte: last24Hours }
    });
    
    health.stats = {
      recentWebhooks: recentLogs,
      recentFailures: recentFailures,
      successRate: recentLogs > 0 ? ((recentLogs - recentFailures) / recentLogs * 100).toFixed(2) + '%' : 'N/A'
    };
  } catch (error) {
    logger.warn('Supabase webhook health check: Could not fetch stats', { error: error.message });
  }
  
  res.status(200).json(health);
}));

/**
 * POST /api/webhooks/supabase
 * Receive webhooks from Supabase database changes
 * 
 * This endpoint handles Supabase Database Webhooks
 * Configure in Supabase Dashboard > Database > Webhooks
 * 
 * Features:
 * - Signature verification (HMAC SHA256)
 * - Rate limiting (100 req/min per IP)
 * - Webhook logging/audit trail
 * - Async processing for heavy operations
 * - Conditional filtering support
 * - Error recovery and retry logic
 */
router.post('/supabase', 
  supabaseWebhookRateLimiter,
  express.raw({ type: 'application/json' }),
  asyncHandler(async (req, res) => {
  const crypto = require('crypto');
  const logger = require('../utils/logger');
  
  try {
    // Get Supabase webhook signature (case-insensitive header lookup)
    const signature = req.headers['x-supabase-signature'] || 
                     req.headers['X-Supabase-Signature'] ||
                     req.headers['x-supabase-webhook-signature'] ||
                     req.headers['X-Supabase-Webhook-Signature'];
    const webhookSecret = process.env.SUPABASE_WEBHOOK_SECRET;
    
    // Parse the webhook payload
    const rawBody = req.body.toString();
    if (!rawBody || rawBody.trim().length === 0) {
      logger.warn('Supabase webhook: Empty payload received');
      return sendError(res, 'Empty webhook payload', 400);
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (error) {
      logger.error('Supabase webhook: Invalid JSON payload', { 
        error: error.message,
        bodyPreview: rawBody.substring(0, 200)
      });
      return sendError(res, 'Invalid JSON payload', 400);
    }

    // Validate payload structure
    if (!payload || typeof payload !== 'object') {
      logger.error('Supabase webhook: Invalid payload structure', { payload });
      return sendError(res, 'Invalid payload structure', 400);
    }

    // Verify webhook signature if secret is configured
    if (webhookSecret && signature) {
      try {
        // Supabase uses HMAC SHA256 for webhook signatures
        const expectedSignature = crypto
          .createHmac('sha256', webhookSecret)
          .update(rawBody)
          .digest('hex');
        
        // Use constant-time comparison for security
        // Check lengths first to avoid timingSafeEqual throwing
        if (signature.length !== expectedSignature.length) {
          logger.warn('Supabase webhook: Signature length mismatch', { 
            receivedLength: signature.length,
            expectedLength: expectedSignature.length
          });
          return sendError(res, 'Invalid webhook signature', 401);
        }
        
        const signatureMatch = crypto.timingSafeEqual(
          Buffer.from(signature),
          Buffer.from(expectedSignature)
        );
        
        if (!signatureMatch) {
          logger.warn('Supabase webhook: Invalid signature', { 
            received: signature?.substring(0, 20) + '...',
            expected: expectedSignature.substring(0, 20) + '...'
          });
          return sendError(res, 'Invalid webhook signature', 401);
        }
      } catch (sigError) {
        // Fallback to simple string comparison if timingSafeEqual fails
        logger.error('Supabase webhook: Signature verification error', { 
          error: sigError.message,
          stack: sigError.stack
        });
        return sendError(res, 'Signature verification failed', 401);
      }
    } else if (process.env.NODE_ENV === 'production') {
      // In production, require signature verification
      logger.warn('Supabase webhook: Missing signature or secret in production', {
        hasSecret: !!webhookSecret,
        hasSignature: !!signature
      });
      return sendError(res, 'Webhook authentication required', 401);
    }

    // Extract webhook event details with defaults
    const {
      type,        // 'INSERT', 'UPDATE', 'DELETE'
      table,       // Table name (e.g., 'users', 'content')
      schema = 'public',  // Schema name (usually 'public')
      record,      // New/updated record (for INSERT/UPDATE)
      old_record,  // Old record (for UPDATE/DELETE)
      timestamp = new Date().toISOString()  // Event timestamp
    } = payload;

    // Validate required fields
    if (!type || !table) {
      logger.error('Supabase webhook: Missing required fields', { 
        hasType: !!type, 
        hasTable: !!table,
        payload 
      });
      return sendError(res, 'Missing required fields: type and table are required', 400);
    }

    // Validate event type
    const validTypes = ['INSERT', 'UPDATE', 'DELETE'];
    if (!validTypes.includes(type)) {
      logger.warn('Supabase webhook: Invalid event type', { type, validTypes });
      return sendError(res, `Invalid event type. Must be one of: ${validTypes.join(', ')}`, 400);
    }

    // Create webhook log entry
    const webhookLogId = new require('mongoose').Types.ObjectId();
    const eventName = `supabase.${table.toLowerCase()}.${type.toLowerCase()}`;
    const recordId = record?.id || old_record?.id;
    
    // Log the webhook event
    logger.info('Supabase webhook received', {
      type,
      table,
      schema,
      recordId,
      timestamp,
      hasRecord: !!record,
      hasOldRecord: !!old_record,
      eventName
    });

    // Start processing timer
    const startTime = Date.now();
    let processingStatus = 'pending';
    let processingError = null;

    // Handle different event types with async processing
    // Respond immediately and process asynchronously for better reliability
    const processWebhookAsync = async () => {
      try {
        // Check conditional filters if configured
        const shouldProcess = await checkWebhookFilters(table, type, record, old_record);
        if (!shouldProcess) {
          logger.info('Supabase webhook: Filtered out by conditions', { 
            table, type, recordId 
          });
          processingStatus = 'filtered';
          await logWebhookEvent({
            _id: webhookLogId,
            event: eventName,
            status: 'filtered',
            payload: { type, table, schema, record, old_record, timestamp },
            createdAt: new Date()
          });
          return;
        }

        switch (type) {
          case 'INSERT':
            if (!record) {
              throw new Error('INSERT event requires a record');
            }
            await handleSupabaseInsert(table, schema, record, timestamp);
            break;
          
          case 'UPDATE':
            if (!record) {
              throw new Error('UPDATE event requires a record');
            }
            await handleSupabaseUpdate(table, schema, record, old_record, timestamp);
            break;
          
          case 'DELETE':
            if (!old_record) {
              throw new Error('DELETE event requires old_record');
            }
            await handleSupabaseDelete(table, schema, old_record, timestamp);
            break;
          
          default:
            logger.warn('Supabase webhook: Unknown event type', { type });
        }

        processingStatus = 'delivered';
        const processingTime = Date.now() - startTime;

        // Log successful webhook delivery
        await logWebhookEvent({
          _id: webhookLogId,
          event: eventName,
          status: 'delivered',
          httpStatus: 200,
          responseTime: processingTime,
          payload: { type, table, schema, record, old_record, timestamp },
          deliveredAt: new Date(),
          createdAt: new Date()
        });

        logger.info('Supabase webhook processed successfully', {
          type,
          table,
          recordId,
          processingTime: `${processingTime}ms`
        });

      } catch (handlerError) {
        processingStatus = 'failed';
        processingError = handlerError;
        const processingTime = Date.now() - startTime;

        logger.error('Supabase webhook handler error', {
          type,
          table,
          recordId,
          error: handlerError.message,
          stack: handlerError.stack,
          processingTime: `${processingTime}ms`
        });

        // Log failed webhook delivery
        await logWebhookEvent({
          _id: webhookLogId,
          event: eventName,
          status: 'failed',
          httpStatus: 500,
          responseTime: processingTime,
          payload: { type, table, schema, record, old_record, timestamp },
          error: {
            message: handlerError.message,
            code: handlerError.code || 'PROCESSING_ERROR',
            stack: process.env.NODE_ENV === 'development' ? handlerError.stack : undefined
          },
          createdAt: new Date()
        });

        // Retry logic for transient errors (async, don't block response)
        if (shouldRetry(handlerError)) {
          logger.info('Supabase webhook: Scheduling retry', { 
            type, table, recordId 
          });
          // Schedule retry (you can implement a job queue here if needed)
          setTimeout(() => {
            processWebhookAsync().catch(err => {
              logger.error('Supabase webhook retry failed', { 
                error: err.message, type, table, recordId 
              });
            });
          }, 5000); // Retry after 5 seconds
        }
      }
    };

    // Process asynchronously (fire and forget)
    processWebhookAsync().catch(err => {
      logger.error('Supabase webhook async processing error', { 
        error: err.message, type, table, recordId 
      });
    });

    // Always respond immediately with 200 to acknowledge receipt
    // This prevents Supabase from retrying and allows async processing
    res.status(200).json({
      success: true,
      message: 'Webhook received and queued for processing',
      event: {
        type,
        table,
        schema,
        timestamp,
        recordId,
        eventName
      },
      processing: 'async'
    });

  } catch (error) {
    logger.error('Supabase webhook processing error', {
      error: error.message,
      stack: error.stack,
      headers: Object.keys(req.headers),
      bodyPreview: req.body?.toString()?.substring(0, 200)
    });
    
    // Still return 200 to prevent Supabase from retrying
    // Log the error for investigation
    res.status(200).json({
      success: false,
      message: 'Webhook received but processing failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal error'
    });
  }
}));

/**
 * Handle Supabase INSERT events
 */
async function handleSupabaseInsert(table, schema, record, timestamp) {
  const logger = require('../utils/logger');
  
  try {
    logger.info(`Supabase INSERT: ${schema}.${table}`, { recordId: record?.id });
    
    // Handle specific tables
    switch (table) {
      case 'users':
        await handleUserInserted(record);
        break;
      
      case 'content':
      case 'contents':
        await handleContentInserted(record);
        break;
      
      default:
        logger.info(`Supabase INSERT: No handler for table ${table}`);
    }
  } catch (error) {
    logger.error('Supabase INSERT handler error', {
      table,
      error: error.message
    });
    throw error;
  }
}

/**
 * Handle Supabase UPDATE events
 */
async function handleSupabaseUpdate(table, schema, record, old_record, timestamp) {
  const logger = require('../utils/logger');
  
  try {
    logger.info(`Supabase UPDATE: ${schema}.${table}`, { 
      recordId: record?.id || old_record?.id 
    });
    
    // Handle specific tables
    switch (table) {
      case 'users':
        await handleUserUpdated(record, old_record);
        break;
      
      case 'content':
      case 'contents':
        await handleContentUpdated(record, old_record);
        break;
      
      default:
        logger.info(`Supabase UPDATE: No handler for table ${table}`);
    }
  } catch (error) {
    logger.error('Supabase UPDATE handler error', {
      table,
      error: error.message
    });
    throw error;
  }
}

/**
 * Handle Supabase DELETE events
 */
async function handleSupabaseDelete(table, schema, old_record, timestamp) {
  const logger = require('../utils/logger');
  
  try {
    logger.info(`Supabase DELETE: ${schema}.${table}`, { recordId: old_record?.id });
    
    // Handle specific tables
    switch (table) {
      case 'users':
        await handleUserDeleted(old_record);
        break;
      
      case 'content':
      case 'contents':
        await handleContentDeleted(old_record);
        break;
      
      default:
        logger.info(`Supabase DELETE: No handler for table ${table}`);
    }
  } catch (error) {
    logger.error('Supabase DELETE handler error', {
      table,
      error: error.message
    });
    throw error;
  }
}

/**
 * Handler functions for specific tables
 */
async function handleUserInserted(record) {
  const logger = require('../utils/logger');
  const { triggerWebhook } = require('../services/webhookService');
  
  logger.info('User inserted via Supabase', { userId: record.id });
  
  // Trigger internal webhook for user.created event
  try {
    await triggerWebhook(record.id, 'user.created', {
      userId: record.id,
      email: record.email,
      createdAt: record.created_at
    });
  } catch (error) {
    logger.warn('Failed to trigger user.created webhook', { error: error.message });
  }
}

async function handleUserUpdated(record, old_record) {
  const logger = require('../utils/logger');
  const { triggerWebhook } = require('../services/webhookService');
  
  logger.info('User updated via Supabase', { userId: record.id });
  
  // Determine what changed
  const changes = {};
  Object.keys(record).forEach(key => {
    if (JSON.stringify(record[key]) !== JSON.stringify(old_record?.[key])) {
      changes[key] = { from: old_record?.[key], to: record[key] };
    }
  });
  
  // Trigger internal webhook for user.updated event
  try {
    await triggerWebhook(record.id, 'user.updated', {
      userId: record.id,
      changes,
      updatedAt: record.updated_at
    });
  } catch (error) {
    logger.warn('Failed to trigger user.updated webhook', { error: error.message });
  }
}

async function handleUserDeleted(old_record) {
  const logger = require('../utils/logger');
  const { triggerWebhook } = require('../services/webhookService');
  
  logger.info('User deleted via Supabase', { userId: old_record.id });
  
  // Trigger internal webhook for user.deleted event
  try {
    await triggerWebhook(old_record.id, 'user.deleted', {
      userId: old_record.id,
      email: old_record.email
    });
  } catch (error) {
    logger.warn('Failed to trigger user.deleted webhook', { error: error.message });
  }
}

async function handleContentInserted(record) {
  const logger = require('../utils/logger');
  const { triggerWebhook } = require('../services/webhookService');
  
  logger.info('Content inserted via Supabase', { contentId: record.id });
  
  // Trigger internal webhook for content.created event
  try {
    await triggerWebhook(record.user_id, 'content.created', {
      contentId: record.id,
      userId: record.user_id,
      type: record.type,
      status: record.status
    }, record.workspace_id);
  } catch (error) {
    logger.warn('Failed to trigger content.created webhook', { error: error.message });
  }
}

async function handleContentUpdated(record, old_record) {
  const logger = require('../utils/logger');
  const { triggerWebhook } = require('../services/webhookService');
  
  logger.info('Content updated via Supabase', { contentId: record.id });
  
  // Determine what changed
  const changes = {};
  Object.keys(record).forEach(key => {
    if (JSON.stringify(record[key]) !== JSON.stringify(old_record?.[key])) {
      changes[key] = { from: old_record?.[key], to: record[key] };
    }
  });
  
  // Trigger internal webhook for content.updated event
  try {
    await triggerWebhook(record.user_id, 'content.updated', {
      contentId: record.id,
      userId: record.user_id,
      changes,
      status: record.status
    }, record.workspace_id);
  } catch (error) {
    logger.warn('Failed to trigger content.updated webhook', { error: error.message });
  }
}

async function handleContentDeleted(old_record) {
  const logger = require('../utils/logger');
  const { triggerWebhook } = require('../services/webhookService');
  
  logger.info('Content deleted via Supabase', { contentId: old_record.id });
  
  // Trigger internal webhook for content.deleted event
  try {
    await triggerWebhook(old_record.user_id, 'content.deleted', {
      contentId: old_record.id,
      userId: old_record.user_id,
      type: old_record.type
    }, old_record.workspace_id);
  } catch (error) {
    logger.warn('Failed to trigger content.deleted webhook', { error: error.message });
  }
}

/**
 * Check if webhook should be processed based on filters
 * Supports conditional filtering via environment variables or configuration
 */
async function checkWebhookFilters(table, type, record, old_record) {
  const logger = require('../utils/logger');
  
  try {
    // Check environment variable filters (e.g., SUPABASE_WEBHOOK_FILTER_TABLES=users,content)
    const allowedTables = process.env.SUPABASE_WEBHOOK_FILTER_TABLES?.split(',').map(t => t.trim());
    if (allowedTables && allowedTables.length > 0 && !allowedTables.includes(table)) {
      logger.debug('Supabase webhook: Table filtered out', { table, allowedTables });
      return false;
    }

    // Check blocked tables (e.g., SUPABASE_WEBHOOK_BLOCK_TABLES=logs,audit)
    const blockedTables = process.env.SUPABASE_WEBHOOK_BLOCK_TABLES?.split(',').map(t => t.trim());
    if (blockedTables && blockedTables.includes(table)) {
      logger.debug('Supabase webhook: Table blocked', { table, blockedTables });
      return false;
    }

    // Check event type filters (e.g., SUPABASE_WEBHOOK_FILTER_EVENTS=INSERT,UPDATE)
    const allowedEvents = process.env.SUPABASE_WEBHOOK_FILTER_EVENTS?.split(',').map(e => e.trim().toUpperCase());
    if (allowedEvents && allowedEvents.length > 0 && !allowedEvents.includes(type)) {
      logger.debug('Supabase webhook: Event type filtered out', { type, allowedEvents });
      return false;
    }

    // Custom filter logic can be added here
    // For example, filter records based on specific field values
    
    return true;
  } catch (error) {
    logger.error('Supabase webhook: Filter check error', { 
      error: error.message, table, type 
    });
    // On filter error, allow processing (fail open)
    return true;
  }
}

/**
 * Determine if webhook should be retried based on error type
 */
function shouldRetry(error) {
  // Retry on transient errors
  const retryableErrors = [
    'ETIMEDOUT',
    'ECONNRESET',
    'ENOTFOUND',
    'ECONNREFUSED',
    'ENETUNREACH',
    'TIMEOUT',
    'NETWORK_ERROR'
  ];

  // Don't retry on validation errors or authentication errors
  if (error.status === 400 || error.status === 401 || error.status === 403) {
    return false;
  }

  // Retry on network/timeout errors
  if (retryableErrors.some(code => error.code === code || error.message?.includes(code))) {
    return true;
  }

  // Retry on 5xx errors (server errors)
  if (error.status >= 500) {
    return true;
  }

  return false;
}

/**
 * Log webhook event to database for audit trail
 */
async function logWebhookEvent(logData) {
  const logger = require('../utils/logger');
  
  try {
    // Create webhook log entry
    const webhookLog = new WebhookLog({
      ...logData,
      // Use a system user ID for Supabase webhooks (or create a dedicated system user)
      userId: logData.userId || new require('mongoose').Types.ObjectId('000000000000000000000000'),
      webhookId: logData.webhookId || new require('mongoose').Types.ObjectId('000000000000000000000000')
    });

    await webhookLog.save();
  } catch (error) {
    // Don't fail webhook processing if logging fails
    logger.warn('Supabase webhook: Failed to log event', { 
      error: error.message,
      event: logData.event
    });
  }
}

module.exports = router;
