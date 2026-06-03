// Branded Links Routes
// Link shortener and tracking

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { requireWorkspaceAccess } = require('../middleware/workspaceIsolation');
const {
  createBrandedLink,
  getLinkAnalytics,
  getBrandedLinks
} = require('../services/brandedLinkService');
const BrandedLink = require('../models/BrandedLink');
const router = express.Router();

/**
 * POST /api/agency/:agencyWorkspaceId/links
 * Create branded link
 */
router.post('/:agencyWorkspaceId/links', auth, requireWorkspaceAccess('canCreate'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const link = await createBrandedLink(agencyWorkspaceId, req.user._id, req.body);
  sendSuccess(res, 'Branded link created', 201, link);
}));

/**
 * GET /api/agency/:agencyWorkspaceId/links
 * Get branded links
 */
router.get('/:agencyWorkspaceId/links', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const { clientWorkspaceId, search, isActive, limit, skip } = req.query;

  const links = await getBrandedLinks(agencyWorkspaceId, clientWorkspaceId, {
    search,
    isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    limit: parseInt(limit, 10) || 50,
    skip: parseInt(skip, 10) || 0
  });

  sendSuccess(res, 'Links retrieved', 200, { links });
}));

/**
 * GET /api/agency/:agencyWorkspaceId/links/:linkId
 * Get link details
 */
router.get('/:agencyWorkspaceId/links/:linkId', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { linkId } = req.params;
  const link = await BrandedLink.findById(linkId).populate('createdBy', 'name email').lean();

  if (!link) {
    return sendError(res, 'Link not found', 404);
  }

  sendSuccess(res, 'Link retrieved', 200, {
    ...link,
    shortUrl: `https://${link.domain}/l/${link.shortCode}`
  });
}));

/**
 * GET /api/agency/:agencyWorkspaceId/links/:linkId/analytics
 * Get link analytics
 */
router.get('/:agencyWorkspaceId/links/:linkId/analytics', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { linkId } = req.params;
  const { startDate, endDate, groupBy } = req.query;

  const analytics = await getLinkAnalytics(linkId, {
    startDate,
    endDate,
    groupBy
  });

  sendSuccess(res, 'Analytics retrieved', 200, analytics);
}));

/**
 * PUT /api/agency/:agencyWorkspaceId/links/:linkId
 * Update link
 */
router.put('/:agencyWorkspaceId/links/:linkId', auth, requireWorkspaceAccess('canEdit'), asyncHandler(async (req, res) => {
  const { linkId } = req.params;
  const link = await BrandedLink.findById(linkId);

  if (!link) {
    return sendError(res, 'Link not found', 404);
  }

  if (req.body.metadata) link.metadata = { ...link.metadata, ...req.body.metadata };
  if (req.body.tracking) link.tracking = { ...link.tracking, ...req.body.tracking };
  if (req.body.isActive !== undefined) link.isActive = req.body.isActive;
  if (req.body.expirationDate) link.expirationDate = new Date(req.body.expirationDate);

  await link.save();

  sendSuccess(res, 'Link updated', 200, {
    ...link.toObject(),
    shortUrl: `https://${link.domain}/l/${link.shortCode}`
  });
}));

/**
 * DELETE /api/agency/:agencyWorkspaceId/links/:linkId
 * Delete link
 */
router.delete('/:agencyWorkspaceId/links/:linkId', auth, requireWorkspaceAccess('canDelete'), asyncHandler(async (req, res) => {
  const { linkId } = req.params;
  await BrandedLink.findByIdAndDelete(linkId);
  sendSuccess(res, 'Link deleted', 200);
}));

// NOTE: Public short-link resolution (GET /l/:shortCode) lives in its own
// router at routes/link-resolver.js so the catch-all path cannot shadow the
// authenticated /api/agency management routes above.

module.exports = router;


