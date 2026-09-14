// Privacy Routes (GDPR Compliance)

const express = require('express');
const crypto = require('crypto');
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

/**
 * Verify Meta's `signed_request` and return its decoded payload, or null.
 *
 * Format is `<base64url signature>.<base64url payload>`, where the signature is
 * HMAC-SHA256 over the RAW payload STRING (not the decoded JSON) keyed with the
 * app secret. Anyone can POST to this endpoint — the HMAC is the only thing that
 * proves the caller is Meta, so a failure here must reject, never fall through.
 */
function verifyMetaSignedRequest(signedRequest, appSecret) {
  if (!signedRequest || !appSecret || typeof signedRequest !== 'string') return null;

  const [encodedSig, encodedPayload] = signedRequest.split('.');
  if (!encodedSig || !encodedPayload) return null;

  const b64url = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

  let expected;
  try {
    expected = crypto.createHmac('sha256', appSecret).update(encodedPayload).digest();
  } catch (_) {
    return null;
  }
  const actual = b64url(encodedSig);

  // timingSafeEqual throws on a length mismatch, so check that first.
  if (actual.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(actual, expected)) return null;

  try {
    const payload = JSON.parse(b64url(encodedPayload).toString('utf8'));
    if (String(payload.algorithm || '').toUpperCase() !== 'HMAC-SHA256') return null;
    return payload;
  } catch (_) {
    return null;
  }
}

/**
 * POST /api/privacy/facebook-data-deletion
 *
 * Meta's data-deletion callback, required by Meta Developer Policy for the
 * Facebook/Instagram OAuth apps. Meta's crawler calls it WITHOUT a session, so
 * it cannot use `auth`; it authenticates the caller by the signed_request HMAC
 * instead. Listed in tests/server/routeAuthCoverage.test.js with that reason.
 *
 * Meta's contract is to acknowledge the request with a status URL and a
 * confirmation code — not to delete synchronously. This records an auditable
 * request; it deliberately does NOT claim the account was erased.
 */
router.post('/facebook-data-deletion', asyncHandler(async (req, res) => {
  const appSecret = process.env.FACEBOOK_APP_SECRET;

  if (!appSecret) {
    // Fail closed. Without the secret nothing can be verified, and answering
    // anyway would hand out confirmation codes for requests we cannot attribute.
    logger.error('[privacy] Meta data-deletion callback hit but FACEBOOK_APP_SECRET is unset');
    return sendError(res, 'Data deletion callback is not configured', 503);
  }

  const payload = verifyMetaSignedRequest(req.body && req.body.signed_request, appSecret);
  if (!payload) {
    logger.warn('[privacy] rejected an unsigned/invalid Meta data-deletion callback', {
      audit: true, ip: req.ip,
    });
    return sendError(res, 'Invalid signed_request', 400);
  }

  const confirmationCode = `del_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

  logger.warn('[privacy] Meta data-deletion request accepted', {
    audit: true,
    action: 'META_DATA_DELETION_REQUEST',
    facebookUserId: payload.user_id,
    confirmationCode,
    ip: req.ip,
    at: new Date().toISOString(),
  });

  const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || '';

  // Meta requires exactly these two keys.
  return res.json({
    url: `${appUrl}/data-deletion?code=${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
}));

module.exports = router;





