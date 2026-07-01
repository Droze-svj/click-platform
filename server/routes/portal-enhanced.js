// Enhanced Portal Routes
// Real-time updates, activity feed, QR codes, A/B testing

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { requireWorkspaceAccess } = require('../middleware/workspaceIsolation');
const { generateQRCode } = require('../services/qrCodeService');
const { escapeRegex } = require('../utils/escapeRegex');
const { clampInt } = require('../utils/pagination');
const {
  createABTest,
  getABTestResults,
  routeABTestTraffic
} = require('../services/linkABTestingService');
const PortalActivity = require('../models/PortalActivity');
const LinkGroup = require('../models/LinkGroup');
const router = express.Router();

/**
 * Derive a link group's analytics from its member links.
 * LinkGroup.analytics is computed on read (never persisted on every click), so
 * we always recompute from the source BrandedLink documents to avoid serving
 * stale zeros. `links` may be populated BrandedLink docs or an array of ids.
 */
function computeGroupAnalytics(links = []) {
  const populated = links.filter(l => l && typeof l === 'object' && l.analytics);
  let topLink = null;
  let topClicks = -1;
  for (const link of populated) {
    const clicks = link.analytics?.totalClicks || 0;
    if (clicks > topClicks) {
      topClicks = clicks;
      topLink = link._id;
    }
  }
  return {
    totalClicks: populated.reduce((sum, l) => sum + (l.analytics?.totalClicks || 0), 0),
    uniqueClicks: populated.reduce((sum, l) => sum + (l.analytics?.uniqueClicks || 0), 0),
    totalLinks: links.length,
    topLink
  };
}

/**
 * GET /api/client-portal/:portalId/activity
 * Get activity feed
 */
router.get('/:portalId/activity', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { portalId } = req.params;
  const { limit = 50, offset = 0, types } = req.query;

  const query = { portalId };
  if (types) {
    query.type = { $in: types.split(',') };
  }

  const activities = await PortalActivity.find(query)
    .populate('actor.userId', 'name email')
    .populate('actor.portalUserId', 'name email')
    .sort({ createdAt: -1 })
    .limit(clampInt(limit, 20, 500))
    .skip(clampInt(offset, 0, 100000, 0))
    .lean();

  const unreadCount = await PortalActivity.countDocuments({
    portalId,
    isRead: false
  });

  sendSuccess(res, 'Activity feed retrieved', 200, {
    activities,
    unreadCount,
    pagination: {
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      total: await PortalActivity.countDocuments(query)
    }
  });
}));

/**
 * PUT /api/client-portal/:portalId/activity/:activityId/read
 * Mark activity as read
 */
router.put('/:portalId/activity/:activityId/read', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { portalId, activityId } = req.params;
  // Resource-ownership guard — the activityId must belong to the same
  // portal the caller is authorised against. Without this, a logged-in
  // user could mark any activity row read by guessing its id.
  const updated = await PortalActivity.findOneAndUpdate(
    { _id: activityId, portalId },
    { isRead: true },
    { new: true },
  );
  if (!updated) {
    return sendError(res, 'Activity not found for this portal', 404);
  }
  sendSuccess(res, 'Activity marked as read', 200);
}));

/**
 * PUT /api/client-portal/:portalId/activity/read-all
 * Mark all activities as read
 */
router.put('/:portalId/activity/read-all', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { portalId } = req.params;
  await PortalActivity.updateMany({ portalId, isRead: false }, { isRead: true });
  sendSuccess(res, 'All activities marked as read', 200);
}));

/**
 * GET /api/agency/:agencyWorkspaceId/links/:linkId/qr-code
 * Generate QR code for link
 */
router.get('/:agencyWorkspaceId/links/:linkId/qr-code', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { linkId } = req.params;
  const {
    size = 300,
    margin = 1,
    color = '#000000',
    backgroundColor = '#FFFFFF',
    format = 'png' // 'png', 'svg', 'dataurl'
  } = req.query;

  const qrCode = await generateQRCode(linkId, {
    size: parseInt(size, 10),
    margin: parseInt(margin, 10),
    color,
    backgroundColor
  });

  if (format === 'dataurl') {
    return sendSuccess(res, 'QR code generated', 200, {
      dataUrl: qrCode.dataUrl,
      url: qrCode.url
    });
  }

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Disposition', `attachment; filename="qr-code-${linkId}.png"`);
  res.send(qrCode.buffer);
}));

/**
 * POST /api/agency/:agencyWorkspaceId/links/ab-test
 * Create A/B test for links
 */
router.post('/:agencyWorkspaceId/links/ab-test', auth, requireWorkspaceAccess('canCreate'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const test = await createABTest(agencyWorkspaceId, req.body);
  sendSuccess(res, 'A/B test created', 201, test);
}));

/**
 * GET /api/agency/:agencyWorkspaceId/links/ab-test/:testId
 * Get A/B test results
 */
router.get('/:agencyWorkspaceId/links/ab-test/:testId', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { testId } = req.params;
  const results = await getABTestResults(testId);
  sendSuccess(res, 'A/B test results retrieved', 200, results);
}));

/**
 * POST /api/agency/:agencyWorkspaceId/links/groups
 * Create link group/campaign
 */
router.post('/:agencyWorkspaceId/links/groups', auth, requireWorkspaceAccess('canCreate'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const {
    name,
    description,
    type = 'campaign',
    clientWorkspaceId,
    links = [],
    metadata = {}
  } = req.body;

  const group = new LinkGroup({
    name,
    description,
    agencyWorkspaceId,
    clientWorkspaceId,
    type,
    links,
    metadata,
    createdBy: req.user._id
  });

  await group.save();
  sendSuccess(res, 'Link group created', 201, group);
}));

/**
 * GET /api/agency/:agencyWorkspaceId/links/groups
 * Get link groups
 */
router.get('/:agencyWorkspaceId/links/groups', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const { clientWorkspaceId, type, search } = req.query;

  const query = { agencyWorkspaceId };
  if (clientWorkspaceId) query.clientWorkspaceId = clientWorkspaceId;
  if (type) query.type = type;
  if (search) {
    query.$or = [
      { name: { $regex: escapeRegex(search), $options: 'i' } },
      { description: { $regex: escapeRegex(search), $options: 'i' } }
    ];
  }

  const groups = await LinkGroup.find(query)
    .populate('links')
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 })
    .lean();

  const groupsWithAnalytics = groups.map(group => ({
    ...group,
    analytics: computeGroupAnalytics(group.links)
  }));

  sendSuccess(res, 'Link groups retrieved', 200, { groups: groupsWithAnalytics });
}));

/**
 * GET /api/agency/:agencyWorkspaceId/links/groups/:groupId
 * Get link group details
 */
router.get('/:agencyWorkspaceId/links/groups/:groupId', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const group = await LinkGroup.findById(groupId)
    .populate('links')
    .populate('createdBy', 'name email')
    .lean();

  if (!group) {
    return sendError(res, 'Link group not found', 404);
  }

  // Calculate group analytics from the populated member links (computed on read)
  sendSuccess(res, 'Link group retrieved', 200, {
    ...group,
    analytics: computeGroupAnalytics(group.links)
  });
}));

/**
 * PUT /api/agency/:agencyWorkspaceId/links/groups/:groupId
 * Update link group
 */
router.put('/:agencyWorkspaceId/links/groups/:groupId', auth, requireWorkspaceAccess('canEdit'), asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const group = await LinkGroup.findById(groupId);

  if (!group) {
    return sendError(res, 'Link group not found', 404);
  }

  // Mass-assignment guard: never let the body reassign ownership
  // (agencyWorkspaceId/clientWorkspaceId/createdBy) or overwrite computed analytics.
  require('../utils/safeUpdate').applySafeUpdates(group, req.body, { block: ['analytics'] });
  await group.save();

  sendSuccess(res, 'Link group updated', 200, group);
}));

module.exports = router;


