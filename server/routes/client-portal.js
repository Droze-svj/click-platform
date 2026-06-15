// Client Portal Routes
// Client login portal with dashboard

const express = require('express');
const jwt = require('jsonwebtoken');
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

// Portal-scoped JWT helpers. The previous implementation issued the
// literal string "portal-token-placeholder" on login and pulled the
// user id straight from an unauthenticated `x-portal-user-id` header —
// anyone could read any other portal user's dashboard by setting that
// header. We now sign a real JWT keyed by both userId and portalId so
// the token is useless on a different portal, and the auth middleware
// verifies the signature on every protected read.
const PORTAL_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

function getPortalJwtSecret() {
  // Reuse the main JWT secret. If the user wants to revoke portal
  // tokens independently they can rotate via PORTAL_JWT_SECRET.
  return process.env.PORTAL_JWT_SECRET || process.env.JWT_SECRET || '';
}

function signPortalToken(payload) {
  const secret = getPortalJwtSecret();
  if (!secret) throw new Error('Portal JWT secret not configured');
  return jwt.sign(payload, secret, { expiresIn: PORTAL_TOKEN_TTL_SECONDS });
}

/**
 * Express middleware — verifies the portal JWT and exposes the decoded
 * `portalUserId` + `portalId` on req. Used by every protected portal
 * read below. Accepts the token from either `Authorization: Bearer …`
 * (preferred) or the legacy `x-portal-token` header so existing portal
 * clients keep working through a deploy.
 */
function portalAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  const token = bearer || req.headers['x-portal-token'] || null;
  if (!token) return sendError(res, 'Authentication required', 401);
  try {
    const decoded = jwt.verify(token, getPortalJwtSecret(), { algorithms: ['HS256'] });
    if (!decoded?.portalUserId || !decoded?.portalId) {
      return sendError(res, 'Invalid portal token', 401);
    }
    // Enforce that the token was issued for THIS portal — without this
    // check, a token from portal A could read portal B's data.
    if (req.params.portalId && String(decoded.portalId) !== String(req.params.portalId)) {
      return sendError(res, 'Token does not match portal', 403);
    }
    req.portalUserId = decoded.portalUserId;
    req.portalId = decoded.portalId;
    next();
  } catch (_) {
    return sendError(res, 'Invalid or expired portal token', 401);
  }
}

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

  // Sign a real JWT (replaces the literal placeholder string). The
  // token carries `portalUserId` + `portalId` so the verifier can
  // refuse cross-portal reads.
  const portalUserId = result.user?.id || result.user?._id;
  if (!portalUserId) {
    return sendError(res, 'Authentication failed', 401);
  }
  let token;
  try {
    token = signPortalToken({ portalUserId: String(portalUserId), portalId: String(portalId) });
  } catch (signErr) {
    return sendError(res, 'Portal authentication is not configured', 500);
  }
  sendSuccess(res, 'Login successful', 200, {
    user: result.user,
    token,
    expiresIn: PORTAL_TOKEN_TTL_SECONDS,
  });
}));

/**
 * GET /api/client-portal/:portalId/dashboard
 * Get client portal dashboard
 */
router.get('/:portalId/dashboard', portalAuth, asyncHandler(async (req, res) => {
  // `req.portalUserId` comes from the verified JWT, NOT from a
  // user-supplied header. Previously the route accepted any value in
  // `x-portal-user-id` — so any logged-in portal user could read any
  // other portal user's dashboard by guessing the id.
  const { portalId } = req.params;
  const dashboard = await getClientPortalDashboard(portalId, req.portalUserId);
  sendSuccess(res, 'Dashboard retrieved', 200, dashboard);
}));

/**
 * GET /api/client-portal/:portalId/calendar
 * Get client calendar
 */
router.get('/:portalId/calendar', portalAuth, asyncHandler(async (req, res) => {
  const { portalId } = req.params;
  const userId = req.portalUserId;

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
router.get('/:portalId/drafts', portalAuth, asyncHandler(async (req, res) => {
  const { portalId } = req.params;
  const userId = req.portalUserId;

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
router.get('/:portalId/performance', portalAuth, asyncHandler(async (req, res) => {
  const { portalId } = req.params;
  const userId = req.portalUserId;

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
router.post('/:portalId/users', portalAuth, asyncHandler(async (req, res) => {
  const { portalId } = req.params;
  const { email, password, name, role, permissions } = req.body;

  if (!email || !password || !name) {
    return sendError(res, 'Email, password, and name are required', 400);
  }

  // Admin-only — without this guard, any portal user could create new
  // portal users (including admin-role users) and effectively escalate
  // their privileges. The previous version had no auth at all.
  const caller = await ClientPortalUser.findById(req.portalUserId).lean();
  if (!caller || !(caller.role === 'admin' || caller.permissions?.canManageUsers)) {
    return sendError(res, 'Access denied', 403);
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
router.get('/:portalId/users', portalAuth, asyncHandler(async (req, res) => {
  const { portalId } = req.params;
  // Same guard as the create endpoint — without auth, anyone could
  // enumerate every portal user (emails, names, roles).
  const caller = await ClientPortalUser.findById(req.portalUserId).lean();
  if (!caller || !(caller.role === 'admin' || caller.permissions?.canManageUsers)) {
    return sendError(res, 'Access denied', 403);
  }
  const users = await ClientPortalUser.find({ portalId, isActive: true })
    .select('-password')
    .lean();

  sendSuccess(res, 'Users retrieved', 200, { users });
}));

module.exports = router;


