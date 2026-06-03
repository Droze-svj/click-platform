// ROAS/ROI Service
// Calculate Return on Ad Spend and Return on Investment

const RevenueAttribution = require('../models/RevenueAttribution');
const Conversion = require('../models/Conversion');
const ClickTracking = require('../models/ClickTracking');
const ScheduledPost = require('../models/ScheduledPost');
const { netFromGross, estimateLifetimeValue } = require('../config/revenueAssumptions');
const logger = require('../utils/logger');

/**
 * Calculate ROAS/ROI for a period
 */
async function calculateROASROI(workspaceId, period, filters = {}) {
  try {
    const {
      platform = null,
      campaignId = null,
      attributionModel = 'last_touch'
    } = filters;

    const {
      type = 'monthly',
      startDate,
      endDate
    } = period;

    // Get conversions
    const conversionQuery = {
      workspaceId,
      'conversionData.timestamp': { $gte: startDate, $lte: endDate }
    };
    if (platform) conversionQuery.platform = platform;
    if (campaignId) conversionQuery['attribution.campaign'] = campaignId.toString();

    const conversions = await Conversion.find(conversionQuery).lean();

    // Get clicks
    const clickQuery = {
      workspaceId,
      'click.timestamp': { $gte: startDate, $lte: endDate }
    };
    if (platform) clickQuery.platform = platform;
    if (campaignId) clickQuery['link.campaignId'] = campaignId;

    const clicks = await ClickTracking.find(clickQuery).lean();

    // Get posts for cost calculation
    const postQuery = {
      workspaceId,
      status: 'posted',
      postedAt: { $gte: startDate, $lte: endDate }
    };
    if (platform) postQuery.platform = platform;
    if (campaignId) postQuery.campaignId = campaignId;

    const posts = await ScheduledPost.find(postQuery).lean();

    // Calculate revenue
    let totalRevenue = 0;
    conversions.forEach(conversion => {
      totalRevenue += conversion.revenue?.attributed || conversion.conversionValue || 0;
    });

    // Calculate costs
    const costs = {
      adSpend: 0,
      agencyFees: 0,
      contentCreation: 0,
      tools: 0,
      total: 0
    };

    // Get costs from posts metadata or calculate
    posts.forEach(post => {
      const postCosts = post.metadata?.costs || {};
      costs.adSpend += postCosts.adSpend || 0;
      costs.agencyFees += postCosts.agencyFees || 0;
      costs.contentCreation += postCosts.contentCreation || 0;
      costs.tools += postCosts.tools || 0;
    });

    costs.total = costs.adSpend + costs.agencyFees + costs.contentCreation + costs.tools;

    // Calculate metrics
    const metrics = {
      clicks: clicks.length,
      conversions: conversions.length,
      ctr: 0,
      conversionRate: 0,
      costPerClick: 0,
      costPerConversion: 0,
      revenuePerClick: 0,
      revenuePerConversion: 0
    };

    // Get impressions/reach for CTR
    let totalImpressions = 0;
    let totalReach = 0;
    posts.forEach(post => {
      totalImpressions += post.analytics?.impressions || 0;
      totalReach += post.analytics?.reach || 0;
    });

    if (totalImpressions > 0) {
      metrics.ctr = (metrics.clicks / totalImpressions) * 100;
    }

    if (metrics.clicks > 0) {
      metrics.conversionRate = (metrics.conversions / metrics.clicks) * 100;
      metrics.costPerClick = costs.total / metrics.clicks;
      metrics.revenuePerClick = totalRevenue / metrics.clicks;
    }

    if (metrics.conversions > 0) {
      metrics.costPerConversion = costs.total / metrics.conversions;
      metrics.revenuePerConversion = totalRevenue / metrics.conversions;
    }

    // Calculate ROAS
    const roas = {
      value: 0,
      percentage: 0
    };

    if (costs.adSpend > 0) {
      roas.value = totalRevenue / costs.adSpend;
      roas.percentage = ((totalRevenue - costs.adSpend) / costs.adSpend) * 100;
    }

    // Calculate ROI
    const roi = {
      value: 0,
      percentage: 0
    };

    if (costs.total > 0) {
      roi.value = totalRevenue / costs.total;
      roi.percentage = ((totalRevenue - costs.total) / costs.total) * 100;
    }

    // Create or update revenue attribution
    const attribution = await RevenueAttribution.findOneAndUpdate(
      {
        workspaceId,
        'period.startDate': startDate,
        'period.endDate': endDate,
        'period.type': type,
        ...(platform ? { platform } : {}),
        ...(campaignId ? { campaignId } : {})
      },
      {
        $set: {
          workspaceId,
          ...(campaignId ? { campaignId } : {}),
          ...(platform ? { platform } : {}),
          period: {
            type,
            startDate,
            endDate
          },
          revenue: {
            gross: totalRevenue,
            net: netFromGross(totalRevenue),
            attributed: totalRevenue,
            lifetimeValue: estimateLifetimeValue(totalRevenue)
          },
          costs,
          metrics,
          roas,
          roi,
          attributionModel
        }
      },
      {
        upsert: true,
        new: true
      }
    );

    logger.info('ROAS/ROI calculated', { workspaceId, period, roas: roas.value, roi: roi.percentage });
    return attribution;
  } catch (error) {
    logger.error('Error calculating ROAS/ROI', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Get ROAS/ROI dashboard
 */
async function getROASROIDashboard(workspaceId, filters = {}) {
  try {
    const {
      startDate,
      endDate,
      platform = null,
      campaignId = null
    } = filters;

    // Get revenue attribution
    const query = {
      workspaceId,
      'period.startDate': { $gte: startDate },
      'period.endDate': { $lte: endDate }
    };
    if (platform) query.platform = platform;
    if (campaignId) query.campaignId = campaignId;

    const attributions = await RevenueAttribution.find(query).lean();

    // Aggregate
    const dashboard = {
      totalRevenue: 0,
      totalCosts: 0,
      totalAdSpend: 0,
      totalROAS: 0,
      totalROI: 0,
      byPlatform: {},
      byCampaign: {},
      trends: [],
      topPerformers: []
    };

    attributions.forEach(attribution => {
      const revenue = attribution.revenue?.attributed || 0;
      const cost = attribution.costs?.total || 0;
      const adSpend = attribution.costs?.adSpend || 0;

      dashboard.totalRevenue += revenue;
      dashboard.totalCosts += cost;
      dashboard.totalAdSpend += adSpend;

      // By platform
      if (attribution.platform) {
        if (!dashboard.byPlatform[attribution.platform]) {
          dashboard.byPlatform[attribution.platform] = {
            revenue: 0,
            costs: 0,
            adSpend: 0,
            roas: 0,
            roi: 0
          };
        }
        dashboard.byPlatform[attribution.platform].revenue += revenue;
        dashboard.byPlatform[attribution.platform].costs += cost;
        dashboard.byPlatform[attribution.platform].adSpend += adSpend;
      }

      // By campaign
      if (attribution.campaignId) {
        const campaignId = attribution.campaignId.toString();
        if (!dashboard.byCampaign[campaignId]) {
          dashboard.byCampaign[campaignId] = {
            revenue: 0,
            costs: 0,
            adSpend: 0,
            roas: 0,
            roi: 0
          };
        }
        dashboard.byCampaign[campaignId].revenue += revenue;
        dashboard.byCampaign[campaignId].costs += cost;
        dashboard.byCampaign[campaignId].adSpend += adSpend;
      }

      // Trends
      dashboard.trends.push({
        date: attribution.period?.startDate,
        revenue,
        costs: cost,
        roas: attribution.roas?.value || 0,
        roi: attribution.roi?.percentage || 0
      });
    });

    // Calculate totals.
    // ROAS measures return on AD SPEND (revenue / adSpend), matching the
    // per-record roas.value definition. ROI measures return on TOTAL cost.
    if (dashboard.totalAdSpend > 0) {
      dashboard.totalROAS = dashboard.totalRevenue / dashboard.totalAdSpend;
    }
    if (dashboard.totalCosts > 0) {
      dashboard.totalROI = ((dashboard.totalRevenue - dashboard.totalCosts) / dashboard.totalCosts) * 100;
    }

    // Calculate platform/campaign ROAS (on ad spend) / ROI (on total costs)
    Object.keys(dashboard.byPlatform).forEach(platform => {
      const data = dashboard.byPlatform[platform];
      if (data.adSpend > 0) {
        data.roas = data.revenue / data.adSpend;
      }
      if (data.costs > 0) {
        data.roi = ((data.revenue - data.costs) / data.costs) * 100;
      }
    });

    Object.keys(dashboard.byCampaign).forEach(campaignId => {
      const data = dashboard.byCampaign[campaignId];
      if (data.adSpend > 0) {
        data.roas = data.revenue / data.adSpend;
      }
      if (data.costs > 0) {
        data.roi = ((data.revenue - data.costs) / data.costs) * 100;
      }
    });

    // Top performers
    dashboard.topPerformers = attributions
      .sort((a, b) => (b.roi?.percentage || 0) - (a.roi?.percentage || 0))
      .slice(0, 10)
      .map(attribution => ({
        platform: attribution.platform,
        campaignId: attribution.campaignId,
        revenue: attribution.revenue?.attributed || 0,
        costs: attribution.costs?.total || 0,
        roas: attribution.roas?.value || 0,
        roi: attribution.roi?.percentage || 0
      }));

    return dashboard;
  } catch (error) {
    logger.error('Error getting ROAS/ROI dashboard', { error: error.message, workspaceId });
    throw error;
  }
}

module.exports = {
  calculateROASROI,
  getROASROIDashboard
};


