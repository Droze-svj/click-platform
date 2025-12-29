// Click Tracking Service
// Track clicks and calculate CTR

const ClickTracking = require('../models/ClickTracking');
const ScheduledPost = require('../models/ScheduledPost');
const logger = require('../utils/logger');

/**
 * Track a click from social post
 */
async function trackClick(postId, clickData) {
  try {
    const post = await ScheduledPost.findById(postId).lean();
    if (!post) {
      throw new Error('Post not found');
    }

    const {
      url,
      shortUrl,
      linkId,
      campaignId,
      utm = {},
      device,
      browser,
      os,
      ipAddress,
      userAgent,
      referrer,
      country,
      city
    } = clickData;

    // Check if unique click (same IP + user agent within 24 hours)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const existingClick = await ClickTracking.findOne({
      postId,
      'click.ipAddress': ipAddress,
      'click.userAgent': userAgent,
      'click.timestamp': { $gte: oneDayAgo }
    }).lean();

    const isUnique = !existingClick;

    const click = new ClickTracking({
      postId,
      workspaceId: post.workspaceId,
      userId: post.userId,
      platform: post.platform,
      utm: {
        source: utm.source || post.platform,
        medium: utm.medium || 'social',
        campaign: utm.campaign || campaignId?.toString(),
        term: utm.term,
        content: utm.content
      },
      link: {
        url,
        shortUrl,
        linkId,
        campaignId
      },
      click: {
        timestamp: new Date(),
        ipAddress,
        userAgent,
        referrer,
        device: device || detectDevice(userAgent),
        browser: browser || detectBrowser(userAgent),
        os: os || detectOS(userAgent),
        country,
        city,
        isUnique
      }
    });

    await click.save();

    // Update post analytics
    await ScheduledPost.findByIdAndUpdate(postId, {
      $inc: {
        'analytics.clicks': 1,
        'analytics.engagementBreakdown.clicks': 1
      },
      $set: {
        'analytics.lastUpdated': new Date()
      }
    });

    // Recalculate CTR
    await calculateCTR(postId);

    logger.info('Click tracked', { postId, clickId: click._id, isUnique });
    return click;
  } catch (error) {
    logger.error('Error tracking click', { error: error.message, postId });
    throw error;
  }
}

/**
 * Calculate CTR for a post
 */
async function calculateCTR(postId) {
  try {
    const post = await ScheduledPost.findById(postId).lean();
    if (!post || !post.analytics) {
      return;
    }

    const analytics = post.analytics;
    const impressions = analytics.impressions || 0;
    const reach = analytics.reach || 0;
    const clicks = analytics.clicks || 0;

    // Calculate CTR by impressions
    if (impressions > 0) {
      analytics.clickThroughRate = (clicks / impressions) * 100;
    }

    // Calculate CTR by reach
    if (reach > 0) {
      analytics.ctrByReach = (clicks / reach) * 100;
    }

    await ScheduledPost.findByIdAndUpdate(postId, {
      $set: {
        'analytics.clickThroughRate': analytics.clickThroughRate || 0,
        'analytics.ctrByReach': analytics.ctrByReach || 0,
        'analytics.lastUpdated': new Date()
      }
    });

    return {
      ctrByImpressions: analytics.clickThroughRate || 0,
      ctrByReach: analytics.ctrByReach || 0,
      clicks,
      impressions,
      reach
    };
  } catch (error) {
    logger.error('Error calculating CTR', { error: error.message, postId });
    throw error;
  }
}

/**
 * Get click analytics for a post
 */
async function getClickAnalytics(postId, filters = {}) {
  try {
    const {
      startDate,
      endDate,
      uniqueOnly = false
    } = filters;

    const query = { postId };
    if (startDate || endDate) {
      query['click.timestamp'] = {};
      if (startDate) query['click.timestamp'].$gte = new Date(startDate);
      if (endDate) query['click.timestamp'].$lte = new Date(endDate);
    }
    if (uniqueOnly) {
      query['click.isUnique'] = true;
    }

    const clicks = await ClickTracking.find(query).lean();

    const analytics = {
      totalClicks: clicks.length,
      uniqueClicks: clicks.filter(c => c.click.isUnique).length,
      clicksByDevice: {},
      clicksByCountry: {},
      clicksByUTM: {},
      conversionRate: 0,
      topReferrers: []
    };

    clicks.forEach(click => {
      // Device breakdown
      const device = click.click.device || 'unknown';
      analytics.clicksByDevice[device] = (analytics.clicksByDevice[device] || 0) + 1;

      // Country breakdown
      const country = click.click.country || 'unknown';
      analytics.clicksByCountry[country] = (analytics.clicksByCountry[country] || 0) + 1;

      // UTM breakdown
      if (click.utm.campaign) {
        if (!analytics.clicksByUTM[click.utm.campaign]) {
          analytics.clicksByUTM[click.utm.campaign] = 0;
        }
        analytics.clicksByUTM[click.utm.campaign]++;
      }

      // Conversions
      if (click.conversion.converted) {
        analytics.conversionRate = (analytics.conversionRate || 0) + 1;
      }
    });

    if (analytics.totalClicks > 0) {
      analytics.conversionRate = (analytics.conversionRate / analytics.totalClicks) * 100;
    }

    return analytics;
  } catch (error) {
    logger.error('Error getting click analytics', { error: error.message, postId });
    throw error;
  }
}

/**
 * Detect device from user agent
 */
function detectDevice(userAgent) {
  if (!userAgent) return 'unknown';
  if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent)) {
    return 'mobile';
  }
  if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
    return 'tablet';
  }
  return 'desktop';
}

/**
 * Detect browser from user agent
 */
function detectBrowser(userAgent) {
  if (!userAgent) return 'unknown';
  if (/chrome/i.test(userAgent) && !/edg/i.test(userAgent)) return 'chrome';
  if (/firefox/i.test(userAgent)) return 'firefox';
  if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) return 'safari';
  if (/edg/i.test(userAgent)) return 'edge';
  if (/opera|opr/i.test(userAgent)) return 'opera';
  return 'unknown';
}

/**
 * Detect OS from user agent
 */
function detectOS(userAgent) {
  if (!userAgent) return 'unknown';
  if (/windows/i.test(userAgent)) return 'windows';
  if (/macintosh|mac os x/i.test(userAgent)) return 'macos';
  if (/linux/i.test(userAgent)) return 'linux';
  if (/android/i.test(userAgent)) return 'android';
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios';
  return 'unknown';
}

module.exports = {
  trackClick,
  calculateCTR,
  getClickAnalytics
};


