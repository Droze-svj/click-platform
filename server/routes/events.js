// Event Streaming Routes
// Server-Sent Events (SSE) for real-time event streaming

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { triggerWebhook } = require('../services/webhookService');
const logger = require('../utils/logger');

const router = express.Router();

// Store active SSE connections
const activeConnections = new Map();

/**
 * GET /api/events/stream
 * Stream events via Server-Sent Events
 */
router.get('/stream', auth, asyncHandler(async (req, res) => {
  const { events, filters } = req.query;
  const eventList = events ? events.split(',') : ['*']; // '*' means all events

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  const connectionId = `${req.user._id}-${Date.now()}`;
  const connection = {
    userId: req.user._id,
    events: eventList,
    filters: filters ? JSON.parse(filters) : {},
    res,
    createdAt: new Date()
  };

  activeConnections.set(connectionId, connection);

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', connectionId, timestamp: new Date().toISOString() })}\n\n`);

  // Handle client disconnect
  req.on('close', () => {
    activeConnections.delete(connectionId);
    logger.info('SSE connection closed', { connectionId, userId: req.user._id });
  });

  // Keep connection alive with heartbeat
  const heartbeat = setInterval(() => {
    if (!activeConnections.has(connectionId)) {
      clearInterval(heartbeat);
      return;
    }
    try {
      res.write(`: heartbeat\n\n`);
    } catch (error) {
      clearInterval(heartbeat);
      activeConnections.delete(connectionId);
    }
  }, 30000); // Every 30 seconds

  logger.info('SSE connection established', { connectionId, userId: req.user._id, events: eventList });
}));

/**
 * Broadcast event to all active connections
 */
function broadcastEvent(userId, event, data, filters = {}) {
  let sent = 0;
  const timestamp = new Date().toISOString();

  activeConnections.forEach((connection, connectionId) => {
    // Check if connection matches user and event
    if (connection.userId.toString() !== userId.toString()) {
      return;
    }

    // Check if connection subscribes to this event
    if (!connection.events.includes('*') && !connection.events.includes(event)) {
      return;
    }

    // Apply filters
    if (connection.filters && Object.keys(connection.filters).length > 0) {
      let matches = true;
      for (const [key, value] of Object.entries(connection.filters)) {
        if (data[key] !== value) {
          matches = false;
          break;
        }
      }
      if (!matches) return;
    }

    try {
      const message = {
        type: 'event',
        event,
        data,
        timestamp
      };

      connection.res.write(`data: ${JSON.stringify(message)}\n\n`);
      sent++;
    } catch (error) {
      logger.warn('Error sending SSE message', { connectionId, error: error.message });
      activeConnections.delete(connectionId);
    }
  });

  if (sent > 0) {
    logger.info('Event broadcasted via SSE', { userId, event, connections: sent });
  }

  return sent;
}

/**
 * POST /api/events/broadcast
 * Broadcast event to connected clients (admin/internal use)
 */
router.post('/broadcast', auth, asyncHandler(async (req, res) => {
  const { event, data, filters } = req.body;

  if (!event || !data) {
    return sendError(res, 'Event and data are required', 400);
  }

  const sent = broadcastEvent(req.user._id, event, data, filters);
  sendSuccess(res, 'Event broadcasted', 200, { sent });
}));

/**
 * GET /api/events/connections
 * Get active SSE connections (for monitoring)
 */
router.get('/connections', auth, asyncHandler(async (req, res) => {
  const userConnections = Array.from(activeConnections.entries())
    .filter(([_, conn]) => conn.userId.toString() === req.user._id.toString())
    .map(([id, conn]) => ({
      id,
      events: conn.events,
      filters: conn.filters,
      createdAt: conn.createdAt
    }));

  sendSuccess(res, 'Connections retrieved', 200, { connections: userConnections });
}));

module.exports = { router, broadcastEvent };


