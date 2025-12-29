// Require admin middleware

const { sendError } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Middleware to require admin role
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return sendError(res, 'Authentication required', 401);
  }

  if (req.user.role !== 'admin') {
    logger.warn('Admin access denied', {
      userId: req.user._id,
      role: req.user.role,
      path: req.path,
    });
    return sendError(res, 'Admin access required', 403);
  }

  next();
}

module.exports = { requireAdmin };






