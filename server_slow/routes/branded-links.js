// Branded Links Routes
// Link shortener and tracking

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { requireWorkspaceAccess } = require('../middleware/workspaceIsolation');
const {
  createBrandedLink,
  resolveBrandedLink,
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
    limit: parseInt(limit) || 50,
    skip: parseInt(skip) || 0
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
    shortUrl: `https://${link.domain}/${link.shortCode}`
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
    shortUrl: `https://${link.domain}/${link.shortCode}`
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

/**
 * GET /l/:shortCode
 * Resolve branded link (public)
 */
router.get('/l/:shortCode', asyncHandler(async (req, res) => {
  const { shortCode } = req.params;

  // Extract click data from request
  const clickData = {
    ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    userAgent: req.headers['user-agent'],
    referrer: req.headers['referer'],
    country: req.headers['cf-ipcountry'] || null, // Cloudflare header
    utmSource: req.query.utm_source,
    utmMedium: req.query.utm_medium,
    utmCampaign: req.query.utm_campaign,
    utmTerm: req.query.utm_term,
    utmContent: req.query.utm_content
  };

  try {
    const result = await resolveBrandedLink(shortCode, clickData);
    res.redirect(result.originalUrl);
  } catch (error) {
    res.status(404).send('Link not found or expired');
  }
}));

module.exports = router;


