// Resource Management Routes

const express = require('express');
const auth = require('../../middleware/auth');
const { requireAdmin } = require('../../middleware/requireAdmin');
const {
  monitorResources,
  checkResourceThresholds,
  getResourceRecommendations,
} = require('../../services/resourceManagementService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

router.get('/monitor', auth, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const resources = monitorResources();
    sendSuccess(res, 'Resources monitored', 200, resources);
  } catch (error) {
    logger.error('Monitor resources error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.get('/thresholds', auth, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const status = checkResourceThresholds();
    sendSuccess(res, 'Resource thresholds checked', 200, status);
  } catch (error) {
    logger.error('Check resource thresholds error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.get('/recommendations', auth, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const recommendations = getResourceRecommendations();
    sendSuccess(res, 'Resource recommendations fetched', 200, recommendations);
  } catch (error) {
    logger.error('Get resource recommendations error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;






