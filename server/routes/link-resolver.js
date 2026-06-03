// Public Branded Link Resolver
//
// Dedicated, isolated router for resolving public short links and recording the
// click. Mounted ONLY at '/l' in server/index.js so the public short URL is
// `${domain}/l/:shortCode`. Kept separate from branded-links.js (which is also
// mounted under /api/agency) so the catch-all `/:shortCode` route cannot shadow
// any authenticated management routes.

const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { resolveBrandedLink } = require('../services/brandedLinkService');
const logger = require('../utils/logger');
const router = express.Router();

/**
 * GET /l/:shortCode
 * Resolve a branded short link (public), record the click, and redirect.
 */
router.get('/:shortCode', asyncHandler(async (req, res) => {
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

    // Validate redirect URL to prevent open redirect vulnerabilities
    let safeUrl;
    try {
      safeUrl = new URL(result.originalUrl);
    } catch (e) {
      logger.warn('Branded link has invalid redirect URL', { shortCode, originalUrl: result.originalUrl });
      return res.status(400).send('Invalid redirect URL format');
    }

    if (safeUrl.protocol !== 'http:' && safeUrl.protocol !== 'https:') {
      logger.warn('Branded link blocked: unsafe protocol', { shortCode, protocol: safeUrl.protocol });
      return res.status(400).send('Invalid redirect protocol. Only HTTP and HTTPS are allowed.');
    }

    return res.redirect(result.originalUrl);
  } catch (error) {
    // Expected "not found"/"expired" conditions are a clean 404; anything else
    // is an unexpected server error and must be logged and surfaced as 500.
    const message = error.message || '';
    if (message === 'Link not found' || message === 'Link has expired') {
      return res.status(404).send('Link not found or expired');
    }
    logger.error('Error resolving branded link', { error: message, shortCode });
    return res.status(500).send('Unable to resolve link');
  }
}));

module.exports = router;
