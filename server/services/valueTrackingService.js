// Value Tracking Service
// Track cost, value, and ROI per client and campaign

const ClientValueTracking = require('../models/ClientValueTracking');
const ScheduledPost = require('../models/ScheduledPost');
const Content = require('../models/Content');
const Campaign = require('../models/Campaign');
const logger = require('../utils/logger');

/**
 * Calculate value tracking for period
 */
async function calculateValueTracking(clientWorkspaceId, agencyWorkspaceId, period, options = {}) {
  try {
    const {
      campaignId = null,
      hourlyRate = 100,
      conversionValue = 50,
      leadValue = 10,
      serviceTier = 'silver'
    } = options;

    const startDate = new Date(period.startDate);
    const endDate = new Date(period.endDate);

    // Get all posts in period
    const postsQuery = {
      workspaceId: clientWorkspaceId,
      scheduledTime: { $gte: startDate, $lte: endDate }
    };
    if (campaignId) postsQuery.campaignId = campaignId;

    const posts = await ScheduledPost.find(postsQuery)
      .populate('contentId')
      .lean();

    // Calculate time spent (estimate based on posts)
    const timePerPost = 0.5; // hours per post (configurable)
    const timeSpent = posts.length * timePerPost;
    const timeCost = timeSpent * hourlyRate;

    // Calculate time saved (through automation)
    const timeSavedPerPost = 0.3; // hours saved per post through automation
    const timeSaved = posts.length * timeSavedPerPost;
    const timeSavedValue = timeSaved * hourlyRate;

    // Aggregate analytics
    const analytics = {
      impressions: 0,
      reach: 0,
      engagement: 0,
      clicks: 0,
      leads: 0,
      conversions: 0
    };

    posts.forEach(post => {
      if (post.analytics) {
        analytics.impressions += post.analytics.impressions || 0;
        analytics.reach += post.analytics.reach || 0;
        analytics.engagement += post.analytics.engagement || 0;
        analytics.clicks += post.analytics.clicks || 0;
      }
    });

    // Estimate leads and conversions (if not tracked)
    if (analytics.clicks > 0 && analytics.leads === 0) {
      analytics.leads = Math.round(analytics.clicks * 0.05); // 5% conversion from clicks
    }
    if (analytics.leads > 0 && analytics.conversions === 0) {
      analytics.conversions = Math.round(analytics.leads * 0.2); // 20% conversion from leads
    }

    const revenue = analytics.conversions * conversionValue;

    // Calculate breakdown by platform
    const platformBreakdown = {};
    posts.forEach(post => {
      if (!platformBreakdown[post.platform]) {
        platformBreakdown[post.platform] = {
          platform: post.platform,
          cost: 0,
          impressions: 0,
          engagement: 0,
          leads: 0,
          conversions: 0,
          posts: 0
        };
      }
      const platform = platformBreakdown[post.platform];
      platform.posts++;
      platform.cost += (timePerPost * hourlyRate) / posts.length;
      if (post.analytics) {
        platform.impressions += post.analytics.impressions || 0;
        platform.engagement += post.analytics.engagement || 0;
        platform.clicks += post.analytics.clicks || 0;
      }
    });

    // Calculate ROI for each platform
    Object.values(platformBreakdown).forEach(platform => {
      const platformLeads = Math.round((platform.clicks || 0) * 0.05);
      const platformConversions = Math.round(platformLeads * 0.2);
      platform.leads = platformLeads;
      platform.conversions = platformConversions;
      const platformValue = platformConversions * conversionValue;
      if (platform.cost > 0) {
        platform.roi = ((platformValue - platform.cost) / platform.cost) * 100;
      }
    });

    // Calculate breakdown by content type
    const contentTypeBreakdown = {};
    posts.forEach(post => {
      const contentType = post.contentId?.type || 'post';
      if (!contentTypeBreakdown[contentType]) {
        contentTypeBreakdown[contentType] = {
          contentType,
          cost: 0,
          value: 0,
          posts: 0
        };
      }
      const type = contentTypeBreakdown[contentType];
      type.posts++;
      type.cost += (timePerPost * hourlyRate) / posts.length;
      if (post.analytics) {
        const typeLeads = Math.round((post.analytics.clicks || 0) * 0.05);
        const typeConversions = Math.round(typeLeads * 0.2);
        type.value += typeConversions * conversionValue;
      }
    });

    // Calculate breakdown by campaign
    const campaignBreakdown = [];
    if (campaignId) {
      const campaign = await Campaign.findById(campaignId).lean();
      if (campaign) {
        const campaignPosts = posts.filter(p => p.campaignId?.toString() === campaignId.toString());
        const campaignCost = campaignPosts.length * timePerPost * hourlyRate;
        const campaignLeads = Math.round(analytics.leads * (campaignPosts.length / posts.length));
        const campaignConversions = Math.round(campaignLeads * 0.2);
        const campaignValue = campaignConversions * conversionValue;
        campaignBreakdown.push({
          campaignId: campaign._id,
          campaignName: campaign.name,
          cost: campaignCost,
          value: campaignValue,
          roi: campaignCost > 0 ? ((campaignValue - campaignCost) / campaignCost) * 100 : 0
        });
      }
    }

    // Create or update tracking record
    const tracking = await ClientValueTracking.findOneAndUpdate(
      {
        clientWorkspaceId,
        'period.startDate': startDate,
        'period.endDate': endDate,
        ...(campaignId ? { campaignId } : {})
      },
      {
        $set: {
          clientWorkspaceId,
          agencyWorkspaceId,
          campaignId,
          period: {
            startDate,
            endDate,
            month: startDate.getMonth() + 1,
            year: startDate.getFullYear()
          },
          cost: {
            timeSpent,
            timeCost,
            toolCost: 0, // Would be calculated from subscriptions
            adSpend: 0, // Would come from ad platform integrations
            total: timeCost
          },
          value: {
            impressions: analytics.impressions,
            reach: analytics.reach,
            engagement: analytics.engagement,
            clicks: analytics.clicks,
            leads: analytics.leads,
            conversions: analytics.conversions,
            revenue,
            timeSaved,
            timeSavedValue
          },
          breakdown: {
            byPlatform: Object.values(platformBreakdown),
            byContentType: Object.values(contentTypeBreakdown),
            byCampaign: campaignBreakdown
          },
          metadata: {
            serviceTier,
            hourlyRate,
            conversionValue,
            leadValue
          }
        }
      },
      {
        upsert: true,
        new: true
      }
    );

    logger.info('Value tracking calculated', {
      clientWorkspaceId,
      period: `${startDate.toISOString()} to ${endDate.toISOString()}`,
      roi: tracking.metrics.roi
    });

    return tracking;
  } catch (error) {
    logger.error('Error calculating value tracking', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

/**
 * Get value tracking for client
 */
async function getClientValueTracking(clientWorkspaceId, filters = {}) {
  try {
    const {
      startDate,
      endDate,
      campaignId = null,
      groupBy = 'month' // month, week, campaign
    } = filters;

    const query = { clientWorkspaceId };
    if (startDate || endDate) {
      query['period.startDate'] = {};
      if (startDate) query['period.startDate'].$gte = new Date(startDate);
      if (endDate) query['period.startDate'].$lte = new Date(endDate);
    }
    if (campaignId) query.campaignId = campaignId;

    const tracking = await ClientValueTracking.find(query)
      .populate('campaignId', 'name')
      .sort({ 'period.startDate': -1 })
      .lean();

    return tracking;
  } catch (error) {
    logger.error('Error getting client value tracking', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

/**
 * Get aggregated value across clients
 */
async function getAgencyValueTracking(agencyWorkspaceId, filters = {}) {
  try {
    const {
      startDate,
      endDate,
      groupBy = 'month'
    } = filters;

    const query = { agencyWorkspaceId };
    if (startDate || endDate) {
      query['period.startDate'] = {};
      if (startDate) query['period.startDate'].$gte = new Date(startDate);
      if (endDate) query['period.startDate'].$lte = new Date(endDate);
    }

    const tracking = await ClientValueTracking.find(query).lean();

    // Aggregate
    const aggregated = {
      totalCost: 0,
      totalValue: 0,
      totalROI: 0,
      totalImpressions: 0,
      totalLeads: 0,
      totalConversions: 0,
      totalTimeSaved: 0,
      clients: tracking.length,
      byClient: {}
    };

    tracking.forEach(record => {
      aggregated.totalCost += record.cost.total;
      aggregated.totalValue += record.value.revenue + record.value.timeSavedValue;
      aggregated.totalImpressions += record.value.impressions;
      aggregated.totalLeads += record.value.leads;
      aggregated.totalConversions += record.value.conversions;
      aggregated.totalTimeSaved += record.value.timeSaved;

      const clientId = record.clientWorkspaceId.toString();
      if (!aggregated.byClient[clientId]) {
        aggregated.byClient[clientId] = {
          clientWorkspaceId: record.clientWorkspaceId,
          cost: 0,
          value: 0,
          roi: 0
        };
      }
      aggregated.byClient[clientId].cost += record.cost.total;
      aggregated.byClient[clientId].value += record.value.revenue + record.value.timeSavedValue;
    });

    if (aggregated.totalCost > 0) {
      aggregated.totalROI = ((aggregated.totalValue - aggregated.totalCost) / aggregated.totalCost) * 100;
    }

    // Calculate ROI for each client
    Object.values(aggregated.byClient).forEach(client => {
      if (client.cost > 0) {
        client.roi = ((client.value - client.cost) / client.cost) * 100;
      }
    });

    return aggregated;
  } catch (error) {
    logger.error('Error getting agency value tracking', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

module.exports = {
  calculateValueTracking,
  getClientValueTracking,
  getAgencyValueTracking
};


