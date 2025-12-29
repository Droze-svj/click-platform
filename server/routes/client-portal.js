// Client Portal Routes
// Client login portal with dashboard

const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const {
  getClientPortalDashboard,
  authenticatePortalUser,
  createPortalUser
} = require('../services/clientPortalService');
const WhiteLabelPortal = require('../models/WhiteLabelPortal');
const ClientPortalUser = require('../models/ClientPortalUser');
const router = express.Router();

/**
 * POST /api/client-portal/:portalId/login
 * Client portal login
 */
router.post('/:portalId/login', asyncHandler(async (req, res) => {
  const { portalId } = req.params;
  const { email, password } = req.body;

  if (!email || !password) {
    return sendError(res, 'Email and password are required', 400);
  }

  const result = await authenticatePortalUser(portalId, email, password);

  if (!result.success) {
    return sendError(res, result.error || 'Authentication failed', 401);
  }

  // Generate token (simplified - use JWT in production)
  sendSuccess(res, 'Login successful', 200, {
    user: result.user,
    token: 'portal-token-placeholder' // Would be JWT token
  });
}));

/**
 * GET /api/client-portal/:portalId/dashboard
 * Get client portal dashboard
 */
router.get('/:portalId/dashboard', asyncHandler(async (req, res) => {
  const { portalId } = req.params;
  const userId = req.headers['x-portal-user-id']; // Would come from JWT token

  if (!userId) {
    return sendError(res, 'Authentication required', 401);
  }

  const dashboard = await getClientPortalDashboard(portalId, userId);
  sendSuccess(res, 'Dashboard retrieved', 200, dashboard);
}));

/**
 * GET /api/client-portal/:portalId/calendar
 * Get client calendar
 */
router.get('/:portalId/calendar', asyncHandler(async (req, res) => {
  const { portalId } = req.params;
  const userId = req.headers['x-portal-user-id'];

  if (!userId) {
    return sendError(res, 'Authentication required', 401);
  }

  const portalUser = await ClientPortalUser.findById(userId).populate('portalId');
  if (!portalUser || !portalUser.permissions.canViewCalendar) {
    return sendError(res, 'Access denied', 403);
  }

  const { getClientCalendar } = require('../services/clientPortalService');
  const calendar = await getClientCalendar(portalUser.clientWorkspaceId, true);
  sendSuccess(res, 'Calendar retrieved', 200, calendar);
}));

/**
 * GET /api/client-portal/:portalId/drafts
 * Get drafts awaiting approval
 */
router.get('/:portalId/drafts', asyncHandler(async (req, res) => {
  const { portalId } = req.params;
  const userId = req.headers['x-portal-user-id'];

  if (!userId) {
    return sendError(res, 'Authentication required', 401);
  }

  const portalUser = await ClientPortalUser.findById(userId).populate('portalId');
  if (!portalUser || !portalUser.permissions.canViewDrafts) {
    return sendError(res, 'Access denied', 403);
  }

  const { getDraftsAwaitingApproval } = require('../services/clientPortalService');
  const drafts = await getDraftsAwaitingApproval(portalUser.clientWorkspaceId, true);
  sendSuccess(res, 'Drafts retrieved', 200, drafts);
}));

/**
 * GET /api/client-portal/:portalId/performance
 * Get performance dashboard
 */
router.get('/:portalId/performance', asyncHandler(async (req, res) => {
  const { portalId } = req.params;
  const userId = req.headers['x-portal-user-id'];

  if (!userId) {
    return sendError(res, 'Authentication required', 401);
  }

  const portalUser = await ClientPortalUser.findById(userId).populate('portalId');
  if (!portalUser || !portalUser.permissions.canViewAnalytics) {
    return sendError(res, 'Access denied', 403);
  }

  const { getClientPerformance } = require('../services/clientPortalService');
  const performance = await getClientPerformance(portalUser.clientWorkspaceId, true);
  sendSuccess(res, 'Performance retrieved', 200, performance);
}));

/**
 * POST /api/client-portal/:portalId/users
 * Create portal user (agency only)
 */
router.post('/:portalId/users', asyncHandler(async (req, res) => {
  const { portalId } = req.params;
  const { email, password, name, role, permissions } = req.body;

  if (!email || !password || !name) {
    return sendError(res, 'Email, password, and name are required', 400);
  }

  // Check if user already exists
  const existing = await ClientPortalUser.findOne({ email: email.toLowerCase(), portalId });
  if (existing) {
    return sendError(res, 'User already exists', 400);
  }

  const user = await createPortalUser(portalId, {
    email: email.toLowerCase(),
    password,
    name,
    role: role || 'viewer',
    permissions: permissions || {}
  });

  sendSuccess(res, 'Portal user created', 201, {
    id: user._id,
    email: user.email,
    name: user.name,
    role: user.role
  });
}));

/**
 * GET /api/client-portal/:portalId/users
 * List portal users
 */
router.get('/:portalId/users', asyncHandler(async (req, res) => {
  const { portalId } = req.params;
  const users = await ClientPortalUser.find({ portalId, isActive: true })
    .select('-password')
    .lean();

  sendSuccess(res, 'Users retrieved', 200, { users });
}));

module.exports = router;


