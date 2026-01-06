const asyncHandler = require('./asyncHandler');

// Admin middleware - checks if user has admin role
const requireAdmin = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  // For now, we'll check if the user email is in a hardcoded admin list
  // In production, you'd have a proper roles table
  const adminEmails = process.env.ADMIN_EMAILS ?
    process.env.ADMIN_EMAILS.split(',') :
    ['admin@clickplatform.com', 'dariovuma@gmail.com']; // Default admin emails

  if (!adminEmails.includes(req.user.email)) {
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

  // Even more restricted super admin list
  const superAdminEmails = process.env.SUPER_ADMIN_EMAILS ?
    process.env.SUPER_ADMIN_EMAILS.split(',') :
    ['superadmin@clickplatform.com'];

  if (!superAdminEmails.includes(req.user.email)) {
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
