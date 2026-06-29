// Privacy Routes (GDPR Compliance)

const express = require('express');
const auth = require('../middleware/auth');
const {
  exportUserData,
  deleteUserData,
  anonymizeUserData,
  getPrivacySettings,
  updatePrivacySettings,
} = require('../services/privacyService');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { createRateLimiter } = require('../middleware/enhancedRateLimiter');
const logger = require('../utils/logger');
const router = express.Router();

// Destructive / PII-heavy privacy ops (export, anonymize, delete) are irreversible
// and a prime account-takeover target — wipe the account before the owner notices.
// Tight per-user limiter so a compromised session can't mass-export or rapidly
// re-trigger destruction.
const privacyLimiter = createRateLimiter({
  windowMs: 24 * 60 * 60 * 1000, // 24h
  max: 5,
  message: { success: false, error: 'Too many privacy requests today. Please try again later.' },
});

// Forensic audit for a destructive/PII action — who, from where, when. Goes to the
// log sink (with requestId via AsyncLocalStorage) so a malicious wipe is traceable.
function auditPrivacyAction(req, action) {
  logger.warn(`[privacy] ${action}`, {
    audit: true,
    action,
    userId: String(req.user?._id),
    email: req.user?.email,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    at: new Date().toISOString(),
  });
}

/**
 * GET /api/privacy/settings
 * Get user privacy settings
 */
router.get('/settings', auth, asyncHandler(async (req, res) => {
  const settings = await getPrivacySettings(req.user._id);
  sendSuccess(res, 'Privacy settings fetched', 200, settings);
}));

/**
 * PUT /api/privacy/settings
 * Update user privacy settings
 */
router.put('/settings', auth, asyncHandler(async (req, res) => {
  const { dataSharing, analytics, marketing, cookies } = req.body;
  
  const settings = await updatePrivacySettings(req.user._id, {
    dataSharing,
    analytics,
    marketing,
    cookies,
  });
  
  sendSuccess(res, 'Privacy settings updated', 200, settings);
}));

/**
 * GET /api/privacy/export
 * Export user data (GDPR data portability)
 */
router.get('/export', auth, privacyLimiter, asyncHandler(async (req, res) => {
  auditPrivacyAction(req, 'DATA EXPORT requested');
  const exportData = await exportUserData(req.user._id);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="user-data-${req.user._id}.json"`);
  res.json(exportData);
}));

/**
 * POST /api/privacy/anonymize
 * Anonymize user data
 */
router.post('/anonymize', auth, privacyLimiter, asyncHandler(async (req, res) => {
  const { confirm } = req.body;

  if (confirm !== 'ANONYMIZE') {
    return sendError(res, 'Confirmation required. Send confirm: "ANONYMIZE"', 400);
  }

  auditPrivacyAction(req, 'ACCOUNT ANONYMIZATION');
  const result = await anonymizeUserData(req.user._id);
  sendSuccess(res, 'User data anonymized', 200, result);
}));

/**
 * DELETE /api/privacy/delete
 * Delete user data (GDPR right to be forgotten)
 */
router.delete('/delete', auth, privacyLimiter, asyncHandler(async (req, res) => {
  const { confirm } = req.body;

  if (confirm !== 'DELETE') {
    return sendError(res, 'Confirmation required. Send confirm: "DELETE"', 400);
  }

  auditPrivacyAction(req, 'ACCOUNT DELETION (right to be forgotten)');
  const result = await deleteUserData(req.user._id);
  sendSuccess(res, 'User data deleted', 200, result);
}));

module.exports = router;





