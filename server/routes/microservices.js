// Microservices Routes

const express = require('express');
const auth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/requireAdmin');
const {
  healthCheckServices,
  registerService,
  getServiceStatus,
  getAllServicesStatus,
  callService,
} = require('../services/microservicesService');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/microservices/health:
 *   get:
 *     summary: Health check all services
 *     tags: [Microservices]
 */
router.get('/health', asyncHandler(async (req, res) => {
  try {
    const health = await healthCheckServices();
    sendSuccess(res, 'Services health checked', 200, health);
  } catch (error) {
    logger.error('Health check services error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/microservices/status:
 *   get:
 *     summary: Get all services status
 *     tags: [Microservices]
 */
router.get('/status', asyncHandler(async (req, res) => {
  try {
    const status = getAllServicesStatus();
    sendSuccess(res, 'Services status fetched', 200, status);
  } catch (error) {
    logger.error('Get services status error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/microservices/register:
 *   post:
 *     summary: Register service (admin)
 *     tags: [Microservices]
 *     security:
 *       - bearerAuth: []
 */
router.post('/register', auth, requireAdmin, asyncHandler(async (req, res) => {
  const { name, url } = req.body;

  if (!name || !url) {
    return sendError(res, 'Name and URL are required', 400);
  }

  try {
    registerService(name, url);
    sendSuccess(res, 'Service registered', 200);
  } catch (error) {
    logger.error('Register service error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/microservices/:serviceName/status:
 *   get:
 *     summary: Get service status
 *     tags: [Microservices]
 */
router.get('/:serviceName/status', asyncHandler(async (req, res) => {
  const { serviceName } = req.params;

  try {
    const status = getServiceStatus(serviceName);
    if (!status) {
      return sendError(res, 'Service not found', 404);
    }
    sendSuccess(res, 'Service status fetched', 200, status);
  } catch (error) {
    logger.error('Get service status error', { error: error.message, serviceName });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/microservices/:serviceName/call:
 *   post:
 *     summary: Call microservice (admin)
 *     tags: [Microservices]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:serviceName/call', auth, requireAdmin, asyncHandler(async (req, res) => {
  const { serviceName } = req.params;
  const { endpoint, method = 'GET', data } = req.body;

  if (!endpoint) {
    return sendError(res, 'Endpoint is required', 400);
  }

  try {
    const result = await callService(serviceName, endpoint, method, data);
    sendSuccess(res, 'Service called', 200, result);
  } catch (error) {
    logger.error('Call service error', { error: error.message, serviceName, endpoint });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;






