// Branded Link Shortener Service
// Create and manage branded short links with tracking

const BrandedLink = require('../models/BrandedLink');
const LinkClick = require('../models/LinkClick');
const Workspace = require('../models/Workspace');
const WhiteLabelPortal = require('../models/WhiteLabelPortal');
const logger = require('../utils/logger');
const crypto = require('crypto');

/**
 * Create branded link
 */
async function createBrandedLink(agencyWorkspaceId, userId, linkData) {
  try {
    const {
      originalUrl,
      clientWorkspaceId = null,
      domain = null,
      customPath = null,
      metadata = {},
      tracking = {}
    } = linkData;

    if (!originalUrl) {
      throw new Error('Original URL is required');
    }

    // Get agency workspace for default domain
    const agencyWorkspace = await Workspace.findById(agencyWorkspaceId);
    if (!agencyWorkspace) {
      throw new Error('Agency workspace not found');
    }

    // Generate short code
    let shortCode;
    if (customPath) {
      shortCode = customPath.replace(/[^a-zA-Z0-9-_]/g, '');
      // Check if already exists
      const existing = await BrandedLink.findOne({ shortCode });
      if (existing) {
        throw new Error('Custom path already in use');
      }
    } else {
      shortCode = generateShortCode();
      // Ensure uniqueness
      let exists = await BrandedLink.findOne({ shortCode });
      let attempts = 0;
      while (exists && attempts < 10) {
        shortCode = generateShortCode();
        exists = await BrandedLink.findOne({ shortCode });
        attempts++;
      }
      if (exists) {
        throw new Error('Failed to generate unique short code');
      }
    }

    // Get portal for domain
    let finalDomain = domain;
    if (!finalDomain && clientWorkspaceId) {
      const portal = await WhiteLabelPortal.findOne({
        workspaceId: agencyWorkspaceId,
        clientId: clientWorkspaceId
      });
      if (portal?.customDomain) {
        finalDomain = portal.customDomain;
      }
    }

    // Default domain
    if (!finalDomain) {
      finalDomain = process.env.BRANDED_LINK_DOMAIN || 'click.link';
    }

    const link = new BrandedLink({
      shortCode,
      originalUrl,
      agencyWorkspaceId,
      clientWorkspaceId,
      createdBy: userId,
      domain: finalDomain,
      customPath,
      metadata,
      tracking: {
        enabled: tracking.enabled !== false,
        trackClicks: tracking.trackClicks !== false,
        trackGeolocation: tracking.trackGeolocation || false,
        trackDevice: tracking.trackDevice !== false,
        trackReferrer: tracking.trackReferrer !== false,
        trackUTM: tracking.trackUTM !== false
      }
    });

    await link.save();

    logger.info('Branded link created', { linkId: link._id, shortCode });

    return {
      ...link.toObject(),
      shortUrl: `https://${finalDomain}/${shortCode}`
    };
  } catch (error) {
    logger.error('Error creating branded link', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Generate short code
 */
function generateShortCode(length = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Resolve branded link (redirect)
 */
async function resolveBrandedLink(shortCode, clickData = {}) {
  try {
    const link = await BrandedLink.findOne({ shortCode, isActive: true });
    if (!link) {
      throw new Error('Link not found');
    }

    // Check expiration
    if (link.expirationDate && new Date(link.expirationDate) < new Date()) {
      throw new Error('Link has expired');
    }

    // Track click if enabled
    if (link.tracking.enabled && link.tracking.trackClicks) {
      const clickRecord = await trackClick(link._id, clickData, link.tracking);
      
      // Create portal activity
      try {
        const { onLinkClicked } = require('./portalActivityHooks');
        await onLinkClicked(link, clickRecord);
      } catch (error) {
        // Non-critical, continue
      }
    }

    // Update analytics
    link.analytics.totalClicks++;
    link.analytics.lastClicked = new Date();
    await link.save();

    return {
      originalUrl: link.originalUrl,
      metadata: link.metadata
    };
  } catch (error) {
    logger.error('Error resolving branded link', { error: error.message, shortCode });
    throw error;
  }
}

/**
 * Track click
 */
async function trackClick(linkId, clickData, trackingOptions) {
  try {
    const LinkClick = require('../models/LinkClick');
    const {
      ipAddress,
      userAgent,
      referrer,
      country,
      city,
      device,
      browser,
      os,
      utmSource,
      utmMedium,
      utmCampaign,
      utmTerm,
      utmContent
    } = clickData;

    const click = new LinkClick({
      linkId,
      ipAddress: trackingOptions.trackGeolocation ? ipAddress : null,
      userAgent: trackingOptions.trackDevice ? userAgent : null,
      referrer: trackingOptions.trackReferrer ? referrer : null,
      country: trackingOptions.trackGeolocation ? country : null,
      city: trackingOptions.trackGeolocation ? city : null,
      device: trackingOptions.trackDevice ? device : null,
      browser: trackingOptions.trackDevice ? browser : null,
      os: trackingOptions.trackDevice ? os : null,
      utmSource: trackingOptions.trackUTM ? utmSource : null,
      utmMedium: trackingOptions.trackUTM ? utmMedium : null,
      utmCampaign: trackingOptions.trackUTM ? utmCampaign : null,
      utmTerm: trackingOptions.trackUTM ? utmTerm : null,
      utmContent: trackingOptions.trackUTM ? utmContent : null
    });

    await click.save();

    // Update link analytics
    await updateLinkAnalytics(linkId, click);

    logger.debug('Click tracked', { linkId, clickId: click._id });
    
    return click;
  } catch (error) {
    logger.error('Error tracking click', { error: error.message, linkId });
    throw error;
  }
}

/**
 * Update link analytics
 */
async function updateLinkAnalytics(linkId, click) {
  try {
    const link = await BrandedLink.findById(linkId);
    if (!link) return;

    // Update unique clicks (simplified - would need IP tracking in production)
    const uniqueClicks = await LinkClick.distinct('ipAddress', {
      linkId,
      ipAddress: { $ne: null }
    });
    link.analytics.uniqueClicks = uniqueClicks.length;

    // Update date-based analytics
    const clickDate = new Date(click.clickedAt);
    clickDate.setHours(0, 0, 0, 0);
    const dateKey = clickDate.toISOString().split('T')[0];

    let dateEntry = link.analytics.clicksByDate.find(
      e => e.date.toISOString().split('T')[0] === dateKey
    );

    if (!dateEntry) {
      dateEntry = { date: clickDate, clicks: 0, uniqueClicks: 0 };
      link.analytics.clicksByDate.push(dateEntry);
    }

    dateEntry.clicks++;
    if (click.ipAddress) {
      const uniqueForDate = await LinkClick.distinct('ipAddress', {
        linkId,
        clickedAt: {
          $gte: clickDate,
          $lt: new Date(clickDate.getTime() + 24 * 60 * 60 * 1000)
        },
        ipAddress: { $ne: null }
      });
      dateEntry.uniqueClicks = uniqueForDate.length;
    }

    // Update country analytics
    if (click.country) {
      let countryEntry = link.analytics.clicksByCountry.find(
        e => e.country === click.country
      );
      if (!countryEntry) {
        countryEntry = { country: click.country, clicks: 0 };
        link.analytics.clicksByCountry.push(countryEntry);
      }
      countryEntry.clicks++;
    }

    // Update device analytics
    if (click.device) {
      let deviceEntry = link.analytics.clicksByDevice.find(
        e => e.device === click.device
      );
      if (!deviceEntry) {
        deviceEntry = { device: click.device, clicks: 0 };
        link.analytics.clicksByDevice.push(deviceEntry);
      }
      deviceEntry.clicks++;
    }

    // Update referrer analytics
    if (click.referrer) {
      const domain = new URL(click.referrer).hostname;
      let referrerEntry = link.analytics.clicksByReferrer.find(
        e => e.referrer === domain
      );
      if (!referrerEntry) {
        referrerEntry = { referrer: domain, clicks: 0 };
        link.analytics.clicksByReferrer.push(referrerEntry);
      }
      referrerEntry.clicks++;
    }

    await link.save();
  } catch (error) {
    logger.error('Error updating link analytics', { error: error.message, linkId });
  }
}

/**
 * Get link analytics
 */
async function getLinkAnalytics(linkId, filters = {}) {
  try {
    const link = await BrandedLink.findById(linkId);
    if (!link) {
      throw new Error('Link not found');
    }

    const {
      startDate,
      endDate,
      groupBy = 'day' // 'day', 'week', 'month'
    } = filters;

    const clickQuery = { linkId };
    if (startDate || endDate) {
      clickQuery.clickedAt = {};
      if (startDate) clickQuery.clickedAt.$gte = new Date(startDate);
      if (endDate) clickQuery.clickedAt.$lte = new Date(endDate);
    }

    const clicks = await LinkClick.find(clickQuery).sort({ clickedAt: -1 }).lean();

    return {
      link: {
        shortCode: link.shortCode,
        originalUrl: link.originalUrl,
        shortUrl: `https://${link.domain}/${link.shortCode}`,
        metadata: link.metadata
      },
      summary: {
        totalClicks: link.analytics.totalClicks,
        uniqueClicks: link.analytics.uniqueClicks,
        lastClicked: link.analytics.lastClicked
      },
      breakdown: {
        byDate: link.analytics.clicksByDate,
        byCountry: link.analytics.clicksByCountry,
        byDevice: link.analytics.clicksByDevice,
        byReferrer: link.analytics.clicksByReferrer
      },
      recentClicks: clicks.slice(0, 100)
    };
  } catch (error) {
    logger.error('Error getting link analytics', { error: error.message, linkId });
    throw error;
  }
}

/**
 * Get all links for agency/client
 */
async function getBrandedLinks(agencyWorkspaceId, clientWorkspaceId = null, filters = {}) {
  try {
    const query = { agencyWorkspaceId };
    if (clientWorkspaceId) {
      query.clientWorkspaceId = clientWorkspaceId;
    }

    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    if (filters.search) {
      query.$or = [
        { 'metadata.title': { $regex: filters.search, $options: 'i' } },
        { 'metadata.description': { $regex: filters.search, $options: 'i' } },
        { shortCode: { $regex: filters.search, $options: 'i' } }
      ];
    }

    const links = await BrandedLink.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(filters.limit || 50)
      .skip(filters.skip || 0)
      .lean();

    return links.map(link => ({
      ...link,
      shortUrl: `https://${link.domain}/${link.shortCode}`
    }));
  } catch (error) {
    logger.error('Error getting branded links', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

module.exports = {
  createBrandedLink,
  resolveBrandedLink,
  getLinkAnalytics,
  getBrandedLinks,
  trackClick
};

