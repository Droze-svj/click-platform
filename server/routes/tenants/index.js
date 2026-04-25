// Multi-Tenant Routes

const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/roleAuth');
const { sendSuccess, sendError } = require('../../utils/response');
const multiTenantService = require('../../services/multiTenantService');
const logger = require('../../utils/logger');

/**
 * POST /api/tenants
 * Create tenant (admin only)
 */
router.post('/', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const tenant = await multiTenantService.createTenant(req.body);
    return sendSuccess(res, tenant, 'Tenant created successfully');
  } catch (error) {
    logger.error('Error creating tenant', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * GET /api/tenants/:tenantId
 * Get tenant
 */
router.get('/:tenantId', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { tenantId } = req.params;
    const tenant = multiTenantService.getTenant(tenantId);
    if (!tenant) {
      return sendError(res, 'Tenant not found', 404);
    }
    return sendSuccess(res, tenant);
  } catch (error) {
    logger.error('Error getting tenant', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * PUT /api/tenants/:tenantId/features
 * Update tenant features
 */
router.put('/:tenantId/features', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { features } = req.body;

    const tenant = await multiTenantService.updateTenantFeatures(tenantId, features);
    return sendSuccess(res, tenant, 'Tenant features updated');
  } catch (error) {
    logger.error('Error updating tenant features', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * GET /api/tenants/:tenantId/users
 * Get tenant users
 */
router.get('/:tenantId/users', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { tenantId } = req.params;
    const users = await multiTenantService.getTenantUsers(tenantId);
    return sendSuccess(res, { users, count: users.length });
  } catch (error) {
    logger.error('Error getting tenant users', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * GET /api/tenants/:tenantId/billing
 * Get tenant billing info
 */
router.get('/:tenantId/billing', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { tenantId } = req.params;
    const billing = await multiTenantService.getTenantBilling(tenantId);
    return sendSuccess(res, billing);
  } catch (error) {
    logger.error('Error getting tenant billing', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

module.exports = router;
