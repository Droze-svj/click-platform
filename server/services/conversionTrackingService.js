// Conversion Tracking Service
// Track conversions and calculate conversion rates

const Conversion = require('../models/Conversion');
const ClickTracking = require('../models/ClickTracking');
const ScheduledPost = require('../models/ScheduledPost');
const { updateCustomerLTV } = require('./customerLTVService');
const logger = require('../utils/logger');

/**
 * Track a conversion
 */
async function trackConversion(postId, conversionData) {
  try {
    const post = await ScheduledPost.findById(postId).lean();
    if (!post) {
      throw new Error('Post not found');
    }

    const {
      clickId,
      conversionType,
      conversionValue = 0,
      currency = 'USD',
      conversionId,
      customerId,
      orderId,
      productId,
      quantity = 1,
      metadata = {},
      funnelStage = 'purchase'
    } = conversionData;

    // Get click data if available
    let click = null;
    if (clickId) {
      click = await ClickTracking.findById(clickId).lean();
    }

    // Calculate time to convert
    let timeToConvert = 0;
    if (click && click.click.timestamp) {
      timeToConvert = (new Date() - new Date(click.click.timestamp)) / (1000 * 60 * 60); // Hours
    }

    const conversion = new Conversion({
      clickId,
      postId,
      workspaceId: post.workspaceId,
      userId: post.userId,
      platform: post.platform,
      conversionType,
      conversionValue,
      currency,
      attribution: {
        source: click?.utm?.source || post.platform,
        medium: click?.utm?.medium || 'social',
        campaign: click?.utm?.campaign,
        firstTouch: true,
        lastTouch: true
      },
      conversionData: {
        timestamp: new Date(),
        conversionId,
        customerId,
        orderId,
        productId,
        quantity,
        metadata
      },
      funnel: {
        stage: funnelStage,
        timeToConvert,
        touchpoints: 1
      },
      revenue: {
        gross: conversionValue,
        net: conversionValue * 0.8, // Assuming 20% costs
        attributed: conversionValue
      }
    });

    await conversion.save();

    // Update click tracking
    if (clickId) {
      await ClickTracking.findByIdAndUpdate(clickId, {
        $set: {
          'conversion.converted': true,
          'conversion.conversionType': conversionType,
          'conversion.conversionValue': conversionValue,
          'conversion.conversionTimestamp': new Date(),
          'conversion.conversionId': conversionId
        }
      });
    }

    // Update post analytics
    await ScheduledPost.findByIdAndUpdate(postId, {
      $inc: {
        'analytics.conversions': 1
      },
      $set: {
        'analytics.lastUpdated': new Date()
      }
    });

    // Update customer LTV
    if (customerId) {
      try {
        await updateCustomerLTV(post.workspaceId, customerId, conversion);
      } catch (error) {
        logger.warn('Error updating customer LTV', { error: error.message });
      }
    }

    logger.info('Conversion tracked', { postId, conversionId: conversion._id, conversionType, conversionValue });
    return conversion;
  } catch (error) {
    logger.error('Error tracking conversion', { error: error.message, postId });
    throw error;
  }
}

/**
 * Get conversion analytics
 */
async function getConversionAnalytics(workspaceId, filters = {}) {
  try {
    const {
      startDate,
      endDate,
      platform = null,
      conversionType = null,
      campaignId = null
    } = filters;

    const query = { workspaceId };
    if (startDate || endDate) {
      query['conversionData.timestamp'] = {};
      if (startDate) query['conversionData.timestamp'].$gte = new Date(startDate);
      if (endDate) query['conversionData.timestamp'].$lte = new Date(endDate);
    }
    if (platform) query.platform = platform;
    if (conversionType) query.conversionType = conversionType;

    const conversions = await Conversion.find(query).lean();

    // Get clicks for conversion rate
    const ClickTracking = require('../models/ClickTracking');
    const clickQuery = { workspaceId };
    if (startDate || endDate) {
      clickQuery['click.timestamp'] = {};
      if (startDate) clickQuery['click.timestamp'].$gte = new Date(startDate);
      if (endDate) clickQuery['click.timestamp'].$lte = new Date(endDate);
    }
    if (platform) clickQuery.platform = platform;
    const clicks = await ClickTracking.find(clickQuery).lean();

    const analytics = {
      totalConversions: conversions.length,
      totalRevenue: 0,
      conversionRate: 0,
      byType: {},
      byPlatform: {},
      byCampaign: {},
      averageTimeToConvert: 0,
      funnelBreakdown: {}
    };

    let totalTimeToConvert = 0;
    let conversionsWithTime = 0;

    conversions.forEach(conversion => {
      // Revenue
      analytics.totalRevenue += conversion.revenue.attributed || conversion.conversionValue || 0;

      // By type
      const type = conversion.conversionType;
      if (!analytics.byType[type]) {
        analytics.byType[type] = { count: 0, revenue: 0 };
      }
      analytics.byType[type].count++;
      analytics.byType[type].revenue += conversion.revenue.attributed || conversion.conversionValue || 0;

      // By platform
      const platform = conversion.platform;
      if (!analytics.byPlatform[platform]) {
        analytics.byPlatform[platform] = { count: 0, revenue: 0 };
      }
      analytics.byPlatform[platform].count++;
      analytics.byPlatform[platform].revenue += conversion.revenue.attributed || conversion.conversionValue || 0;

      // By campaign
      if (conversion.attribution.campaign) {
        const campaign = conversion.attribution.campaign;
        if (!analytics.byCampaign[campaign]) {
          analytics.byCampaign[campaign] = { count: 0, revenue: 0 };
        }
        analytics.byCampaign[campaign].count++;
        analytics.byCampaign[campaign].revenue += conversion.revenue.attributed || conversion.conversionValue || 0;
      }

      // Funnel breakdown
      const stage = conversion.funnel.stage;
      if (!analytics.funnelBreakdown[stage]) {
        analytics.funnelBreakdown[stage] = 0;
      }
      analytics.funnelBreakdown[stage]++;

      // Time to convert
      if (conversion.funnel.timeToConvert > 0) {
        totalTimeToConvert += conversion.funnel.timeToConvert;
        conversionsWithTime++;
      }
    });

    // Calculate conversion rate
    if (clicks.length > 0) {
      analytics.conversionRate = (conversions.length / clicks.length) * 100;
    }

    // Average time to convert
    if (conversionsWithTime > 0) {
      analytics.averageTimeToConvert = totalTimeToConvert / conversionsWithTime;
    }

    return analytics;
  } catch (error) {
    logger.error('Error getting conversion analytics', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Get conversion funnel
 */
async function getConversionFunnel(workspaceId, filters = {}) {
  try {
    const {
      startDate,
      endDate,
      platform = null
    } = filters;

    const query = { workspaceId };
    if (startDate || endDate) {
      query['conversionData.timestamp'] = {};
      if (startDate) query['conversionData.timestamp'].$gte = new Date(startDate);
      if (endDate) query['conversionData.timestamp'].$lte = new Date(endDate);
    }
    if (platform) query.platform = platform;

    const conversions = await Conversion.find(query).lean();

    const funnel = {
      awareness: 0,
      interest: 0,
      consideration: 0,
      purchase: 0,
      retention: 0
    };

    conversions.forEach(conversion => {
      const stage = conversion.funnel.stage;
      if (funnel.hasOwnProperty(stage)) {
        funnel[stage]++;
      }
    });

    // Calculate drop-off rates
    const funnelWithDropOff = {
      awareness: {
        count: funnel.awareness,
        dropOff: 0
      },
      interest: {
        count: funnel.interest,
        dropOff: funnel.awareness > 0 ? ((funnel.awareness - funnel.interest) / funnel.awareness) * 100 : 0
      },
      consideration: {
        count: funnel.consideration,
        dropOff: funnel.interest > 0 ? ((funnel.interest - funnel.consideration) / funnel.interest) * 100 : 0
      },
      purchase: {
        count: funnel.purchase,
        dropOff: funnel.consideration > 0 ? ((funnel.consideration - funnel.purchase) / funnel.consideration) * 100 : 0
      },
      retention: {
        count: funnel.retention,
        dropOff: funnel.purchase > 0 ? ((funnel.purchase - funnel.retention) / funnel.purchase) * 100 : 0
      }
    };

    return funnelWithDropOff;
  } catch (error) {
    logger.error('Error getting conversion funnel', { error: error.message, workspaceId });
    throw error;
  }
}

module.exports = {
  trackConversion,
  getConversionAnalytics,
  getConversionFunnel
};

