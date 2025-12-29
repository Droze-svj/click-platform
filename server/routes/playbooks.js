// Playbook Routes
// Cross-client templates and playbooks

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const {
  createPlaybook,
  getPlaybooks,
  applyPlaybookToClient,
  getPlaybookPerformance,
  getPlaybookSuggestions
} = require('../services/playbookService');
const {
  createPlaybookVersion,
  getPlaybookVersions,
  comparePlaybookVersions,
  getPlaybookAnalytics,
  publishToMarketplace,
  searchMarketplace
} = require('../services/playbookEnhancementService');
const router = express.Router();

/**
 * POST /api/playbooks
 * Create playbook
 */
router.post('/', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const playbook = await createPlaybook(userId, req.body);
  sendSuccess(res, 'Playbook created', 201, playbook);
}));

/**
 * GET /api/playbooks
 * Get playbooks
 */
router.get('/', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { category, includeShared = true, includePublic = true } = req.query;
  
  const playbooks = await getPlaybooks(userId, {
    category: category || null,
    includeShared: includeShared === 'true',
    includePublic: includePublic === 'true'
  });
  
  sendSuccess(res, 'Playbooks retrieved', 200, { playbooks });
}));

/**
 * POST /api/playbooks/:playbookId/apply
 * Apply playbook to client
 */
router.post('/:playbookId/apply', auth, asyncHandler(async (req, res) => {
  const { playbookId } = req.params;
  const userId = req.user._id;
  const { clientId, customizations } = req.body;

  if (!clientId) {
    return sendError(res, 'Client ID is required', 400);
  }

  const result = await applyPlaybookToClient(playbookId, userId, clientId, customizations || {});
  sendSuccess(res, 'Playbook applied', 200, result);
}));

/**
 * GET /api/playbooks/:playbookId/performance
 * Get playbook performance
 */
router.get('/:playbookId/performance', auth, asyncHandler(async (req, res) => {
  const { playbookId } = req.params;
  const performance = await getPlaybookPerformance(playbookId);
  sendSuccess(res, 'Performance retrieved', 200, performance);
}));

/**
 * GET /api/playbooks/suggestions/:clientId
 * Get playbook suggestions for client
 */
router.get('/suggestions/:clientId', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { clientId } = req.params;
  const suggestions = await getPlaybookSuggestions(userId, clientId);
  sendSuccess(res, 'Suggestions retrieved', 200, { suggestions });
}));

/**
 * POST /api/playbooks/:playbookId/versions
 * Create playbook version
 */
router.post('/:playbookId/versions', auth, asyncHandler(async (req, res) => {
  const { playbookId } = req.params;
  const userId = req.user._id;
  const version = await createPlaybookVersion(playbookId, userId, req.body);
  sendSuccess(res, 'Version created', 201, version);
}));

/**
 * GET /api/playbooks/:playbookId/versions
 * Get playbook versions
 */
router.get('/:playbookId/versions', auth, asyncHandler(async (req, res) => {
  const { playbookId } = req.params;
  const versions = await getPlaybookVersions(playbookId);
  sendSuccess(res, 'Versions retrieved', 200, { versions });
}));

/**
 * GET /api/playbooks/:playbookId/versions/compare
 * Compare playbook versions
 */
router.get('/:playbookId/versions/compare', auth, asyncHandler(async (req, res) => {
  const { playbookId } = req.params;
  const { version1, version2 } = req.query;

  if (!version1 || !version2) {
    return sendError(res, 'Both version1 and version2 are required', 400);
  }

  const comparison = await comparePlaybookVersions(playbookId, parseInt(version1), parseInt(version2));
  sendSuccess(res, 'Versions compared', 200, comparison);
}));

/**
 * GET /api/playbooks/:playbookId/analytics
 * Get playbook analytics
 */
router.get('/:playbookId/analytics', auth, asyncHandler(async (req, res) => {
  const { playbookId } = req.params;
  const analytics = await getPlaybookAnalytics(playbookId);
  sendSuccess(res, 'Analytics retrieved', 200, analytics);
}));

/**
 * POST /api/playbooks/:playbookId/publish
 * Publish playbook to marketplace
 */
router.post('/:playbookId/publish', auth, asyncHandler(async (req, res) => {
  const { playbookId } = req.params;
  const userId = req.user._id;
  const playbook = await publishToMarketplace(playbookId, userId, req.body);
  sendSuccess(res, 'Playbook published', 200, playbook);
}));

/**
 * GET /api/playbooks/marketplace/search
 * Search marketplace playbooks
 */
router.get('/marketplace/search', asyncHandler(async (req, res) => {
  const { q, category, tags, featured } = req.query;
  
  const playbooks = await searchMarketplace(q || '', {
    category: category || null,
    tags: tags ? tags.split(',') : null,
    featured: featured === 'true' ? true : null
  });
  
  sendSuccess(res, 'Marketplace playbooks found', 200, { playbooks });
}));

module.exports = router;

