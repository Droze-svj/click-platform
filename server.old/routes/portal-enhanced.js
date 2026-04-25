// Enhanced Portal Routes
// Real-time updates, activity feed, QR codes, A/B testing

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { requireWorkspaceAccess } = require('../middleware/workspaceIsolation');
const { generateQRCode } = require('../services/qrCodeService');
const {
  createABTest,
  getABTestResults,
  routeABTestTraffic
} = require('../services/linkABTestingService');
const PortalActivity = require('../models/PortalActivity');
const LinkGroup = require('../models/LinkGroup');
const router = express.Router();

/**
 * GET /api/client-portal/:portalId/activity
 * Get activity feed
 */
router.get('/:portalId/activity', asyncHandler(async (req, res) => {
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
    .limit(parseInt(limit))
    .skip(parseInt(offset))
    .lean();

  const unreadCount = await PortalActivity.countDocuments({
    portalId,
    isRead: false
  });

  sendSuccess(res, 'Activity feed retrieved', 200, {
    activities,
    unreadCount,
    pagination: {
      limit: parseInt(limit),
      offset: parseInt(offset),
      total: await PortalActivity.countDocuments(query)
    }
  });
}));

/**
 * PUT /api/client-portal/:portalId/activity/:activityId/read
 * Mark activity as read
 */
router.put('/:portalId/activity/:activityId/read', asyncHandler(async (req, res) => {
  const { activityId } = req.params;
  await PortalActivity.findByIdAndUpdate(activityId, { isRead: true });
  sendSuccess(res, 'Activity marked as read', 200);
}));

/**
 * PUT /api/client-portal/:portalId/activity/read-all
 * Mark all activities as read
 */
router.put('/:portalId/activity/read-all', asyncHandler(async (req, res) => {
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
    size: parseInt(size),
    margin: parseInt(margin),
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
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  const groups = await LinkGroup.find(query)
    .populate('links')
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 })
    .lean();

  sendSuccess(res, 'Link groups retrieved', 200, { groups });
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

  // Calculate group analytics
  const BrandedLink = require('../models/BrandedLink');
  const links = await BrandedLink.find({ _id: { $in: group.links } }).lean();
  
  const analytics = {
    totalClicks: links.reduce((sum, link) => sum + (link.analytics?.totalClicks || 0), 0),
    uniqueClicks: links.reduce((sum, link) => sum + (link.analytics?.uniqueClicks || 0), 0),
    totalLinks: links.length
  };

  sendSuccess(res, 'Link group retrieved', 200, {
    ...group,
    analytics
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

  Object.assign(group, req.body);
  await group.save();

  sendSuccess(res, 'Link group updated', 200, group);
}));

module.exports = router;


