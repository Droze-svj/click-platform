// White-Label Routes

const express = require('express');
const auth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/requireAdmin');
const {
  getWhiteLabelConfig,
  generateCustomCSS,
  getBrandedEmailTemplate,
  updateWhiteLabelConfig,
} = require('../services/whiteLabelService');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/white-label/config:
 *   get:
 *     summary: Get white-label configuration
 *     tags: [White-Label]
 */
router.get('/config', asyncHandler(async (req, res) => {
  const domain = req.headers.host || req.query.domain;

  try {
    const config = await getWhiteLabelConfig(domain);
    sendSuccess(res, 'White-label config fetched', 200, config);
  } catch (error) {
    logger.error('Get white-label config error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/white-label/css:
 *   get:
 *     summary: Get custom CSS
 *     tags: [White-Label]
 */
router.get('/css', asyncHandler(async (req, res) => {
  const domain = req.headers.host || req.query.domain;

  try {
    const config = await getWhiteLabelConfig(domain);
    const css = generateCustomCSS(config);
    
    res.setHeader('Content-Type', 'text/css');
    res.send(css);
  } catch (error) {
    logger.error('Get custom CSS error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/white-label/config:
 *   put:
 *     summary: Update white-label configuration (admin)
 *     tags: [White-Label]
 *     security:
 *       - bearerAuth: []
 */
router.put('/config', auth, requireAdmin, asyncHandler(async (req, res) => {
  const { domain, config } = req.body;

  if (!domain || !config) {
    return sendError(res, 'Domain and config are required', 400);
  }

  try {
    await updateWhiteLabelConfig(domain, config);
    sendSuccess(res, 'White-label config updated', 200);
  } catch (error) {
    logger.error('Update white-label config error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;






