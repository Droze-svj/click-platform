const asyncHandler = require('./asyncHandler');
const logger = require('../utils/logger');

// Resolve an admin email allowlist from an env var, FAIL-CLOSED. When the var
// is unset we return an empty list (deny everyone) instead of a baked-in
// default — a hardcoded default address would silently grant admin on any
// deploy that forgot to set the var (and is a backdoor if that address is
// ever registrable/spoofable). Set ADMIN_EMAILS / SUPER_ADMIN_EMAILS explicitly.
const _warned = new Set();
function emailAllowlist(envVar) {
  const raw = process.env[envVar];
  if (!raw || !raw.trim()) {
    if (!_warned.has(envVar)) {
      logger.warn(`[admin] ${envVar} is not set — denying ALL access for this gate (fail-closed)`);
      _warned.add(envVar);
    }
    return [];
  }
  return raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
}

// Admin middleware - checks the user's email against an explicit allowlist.
const requireAdmin = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  const adminEmails = emailAllowlist('ADMIN_EMAILS');
  const email = (req.user.email || '').toLowerCase();
  if (!email || !adminEmails.includes(email)) {
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }

  next();
});

// Super admin middleware - for critical operations
const requireSuperAdmin = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  const superAdminEmails = emailAllowlist('SUPER_ADMIN_EMAILS');
  const email = (req.user.email || '').toLowerCase();
  if (!email || !superAdminEmails.includes(email)) {
    return res.status(403).json({
      success: false,
      error: 'Super admin access required'
    });
  }

  next();
});

module.exports = {
  requireAdmin,
  requireSuperAdmin
};
