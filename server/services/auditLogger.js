/**
 * Thin wrapper around the SecurityLog model for audit-event recording.
 * Failures NEVER throw — audit logging must not break the request path.
 *
 * Use one of the named helpers (recordLogin, recordExport, etc.) when the
 * eventType maps cleanly; use recordSecurityEvent for ad-hoc events.
 */

const logger = require('../utils/logger');

let SecurityLog;
function getModel() {
  if (SecurityLog === undefined) {
    try {
      SecurityLog = require('../models/SecurityLog');
    } catch (err) {
      logger.warn('[audit] SecurityLog model unavailable', { error: err.message });
      SecurityLog = null;
    }
  }
  return SecurityLog;
}

function clientIpFrom(req) {
  return (
    req?.ip ||
    (req?.headers && (req.headers['x-forwarded-for'] || '').split(',')[0].trim()) ||
    req?.connection?.remoteAddress ||
    'unknown'
  );
}

async function recordSecurityEvent({
  req,
  userId,
  eventType,
  severity = 'low',
  details,
  metadata,
}) {
  const Model = getModel();
  if (!Model) return null;
  try {
    const doc = await Model.create({
      userId: userId || undefined,
      eventType,
      severity,
      ipAddress: clientIpFrom(req),
      userAgent: req?.get ? req.get('user-agent') : undefined,
      details: details || undefined,
      metadata: metadata || undefined,
    });
    return doc;
  } catch (err) {
    logger.warn('[audit] recordSecurityEvent failed (non-blocking)', {
      eventType,
      error: err.message,
    });
    return null;
  }
}

const recordLogin = (args) => recordSecurityEvent({ ...args, eventType: 'login' });
const recordLoginFailed = (args) =>
  recordSecurityEvent({ ...args, eventType: 'login_failed', severity: 'medium' });
const recordLogout = (args) => recordSecurityEvent({ ...args, eventType: 'logout' });
const recordPasswordChange = (args) =>
  recordSecurityEvent({ ...args, eventType: 'password_change', severity: 'medium' });
const recordPermissionChange = (args) =>
  recordSecurityEvent({ ...args, eventType: 'permission_change', severity: 'high' });
const recordExport = (args) =>
  recordSecurityEvent({ ...args, eventType: 'data_export', severity: 'medium' });
const recordAdminAction = (args) =>
  recordSecurityEvent({ ...args, eventType: 'admin_action', severity: 'high' });

module.exports = {
  recordSecurityEvent,
  recordLogin,
  recordLoginFailed,
  recordLogout,
  recordPasswordChange,
  recordPermissionChange,
  recordExport,
  recordAdminAction,
};
