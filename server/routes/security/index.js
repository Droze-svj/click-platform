// Security Routes - 2FA, IP Management, Device Management

const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const { sendSuccess, sendError } = require('../../utils/response');
const securityService = require('../../services/securityService');
const logger = require('../../utils/logger');

/**
 * POST /api/security/2fa/generate
 * Generate 2FA secret
 */
router.post('/2fa/generate', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const email = req.user.email;

    const secretData = await securityService.generate2FASecret(userId, email);
    return sendSuccess(res, secretData);
  } catch (error) {
    logger.error('Error generating 2FA secret', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * POST /api/security/2fa/enable
 * Enable 2FA
 */
router.post('/2fa/enable', authenticate, async (req, res) => {
  try {
    const { token, secret } = req.body;
    const userId = req.user.id;

    if (!token || !secret) {
      return sendError(res, 'Token and secret are required', 400);
    }

    await securityService.enable2FA(userId, token, secret);
    return sendSuccess(res, null, '2FA enabled successfully');
  } catch (error) {
    logger.error('Error enabling 2FA', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * POST /api/security/2fa/disable
 * Disable 2FA
 */
router.post('/2fa/disable', authenticate, async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.user.id;

    await securityService.disable2FA(userId, password);
    return sendSuccess(res, null, '2FA disabled successfully');
  } catch (error) {
    logger.error('Error disabling 2FA', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * POST /api/security/2fa/verify
 * Verify 2FA token
 */
router.post('/2fa/verify', authenticate, async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user.id;

    if (!token) {
      return sendError(res, 'Token is required', 400);
    }

    const isValid = await securityService.verify2FAToken(userId, token);
    return sendSuccess(res, { valid: isValid });
  } catch (error) {
    logger.error('Error verifying 2FA token', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * POST /api/security/ip/whitelist
 * Add IP to whitelist
 */
router.post('/ip/whitelist', authenticate, async (req, res) => {
  try {
    const { ip } = req.body;
    const userId = req.user.id;

    if (!ip) {
      return sendError(res, 'IP address is required', 400);
    }

    await securityService.whitelistIP(userId, ip);
    return sendSuccess(res, null, 'IP whitelisted successfully');
  } catch (error) {
    logger.error('Error whitelisting IP', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * DELETE /api/security/ip/whitelist/:ip
 * Remove IP from whitelist
 */
router.delete('/ip/whitelist/:ip', authenticate, async (req, res) => {
  try {
    const { ip } = req.params;
    const userId = req.user.id;

    await securityService.removeWhitelistedIP(userId, ip);
    return sendSuccess(res, null, 'IP removed from whitelist');
  } catch (error) {
    logger.error('Error removing whitelisted IP', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * GET /api/security/devices
 * Get user devices
 */
router.get('/devices', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const devices = securityService.getUserDevices(userId);
    return sendSuccess(res, { devices });
  } catch (error) {
    logger.error('Error getting devices', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * DELETE /api/security/devices/:deviceId
 * Revoke device
 */
router.delete('/devices/:deviceId', authenticate, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user.id;

    await securityService.revokeDevice(userId, deviceId);
    return sendSuccess(res, null, 'Device revoked successfully');
  } catch (error) {
    logger.error('Error revoking device', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * GET /api/security/events
 * Get security events
 */
router.get('/events', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50 } = req.query;
    const events = securityService.getSecurityEvents(userId, parseInt(limit));
    return sendSuccess(res, { events });
  } catch (error) {
    logger.error('Error getting security events', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * GET /api/security/summary
 * Get security summary
 */
router.get('/summary', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const summary = securityService.getSecuritySummary(userId);
    return sendSuccess(res, summary);
  } catch (error) {
    logger.error('Error getting security summary', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

module.exports = router;
