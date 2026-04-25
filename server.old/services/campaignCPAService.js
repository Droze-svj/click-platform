// Campaign CPA/CLTV Service
// Track cost per acquisition and customer lifetime value

const CampaignCPA = require('../models/CampaignCPA');
const logger = require('../utils/logger');

/**
 * Create or update campaign CPA
 */
async function upsertCampaignCPA(agencyWorkspaceId, campaignData) {
  try {
    const {
      clientWorkspaceId,
      campaign,
      costs,
      performance,
      attribution
    } = campaignData;

    const cpa = await CampaignCPA.findOneAndUpdate(
      {
        agencyWorkspaceId,
        'campaign.name': campaign.name,
        'campaign.startDate': campaign.startDate
      },
      {
        $set: {
          agencyWorkspaceId,
          clientWorkspaceId,
          campaign,
          costs,
          performance,
          attribution
        }
      },
      { upsert: true, new: true }
    );

    logger.info('Campaign CPA updated', { agencyWorkspaceId, campaignId: cpa._id });
    return cpa;
  } catch (error) {
    logger.error('Error upserting campaign CPA', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Get campaign CPA metrics
 */
async function getCampaignCPAMetrics(agencyWorkspaceId, filters = {}) {
  try {
    const {
      startDate,
      endDate,
      platform = null,
      campaignType = null
    } = filters;

    const query = { agencyWorkspaceId };
    if (startDate || endDate) {
      query['campaign.startDate'] = {};
      if (startDate) query['campaign.startDate'].$gte = new Date(startDate);
      if (endDate) query['campaign.startDate'].$lte = new Date(endDate);
    }
    if (platform) query['campaign.platform'] = platform;
    if (campaignType) query['campaign.type'] = campaignType;

    const campaigns = await CampaignCPA.find(query).lean();

    // Aggregate metrics
    const totalCosts = campaigns.reduce((sum, c) => sum + (c.costs.total || 0), 0);
    const totalConversions = campaigns.reduce((sum, c) => sum + (c.performance.conversions || 0), 0);
    const totalLeads = campaigns.reduce((sum, c) => sum + (c.performance.leads || 0), 0);
    const totalClicks = campaigns.reduce((sum, c) => sum + (c.performance.clicks || 0), 0);
    const totalRevenue = campaigns.reduce((sum, c) => sum + (c.performance.revenue || 0), 0);
    const totalCLTV = campaigns.reduce((sum, c) => sum + (c.cltv.customerLifetimeValue || 0), 0);

    const averageCPA = totalConversions > 0 ? totalCosts / totalConversions : 0;
    const averageCPL = totalLeads > 0 ? totalCosts / totalLeads : 0;
    const averageCPC = totalClicks > 0 ? totalCosts / totalClicks : 0;
    const averageCLTV = campaigns.length > 0 ? totalCLTV / campaigns.length : 0;
    const averageCLTVToCAC = averageCPA > 0 ? averageCLTV / averageCPA : 0;

    // ROI metrics
    const totalROAS = totalCosts > 0 ? (totalRevenue / totalCosts) * 100 : 0;
    const totalROI = totalCosts > 0 ? ((totalRevenue - totalCosts) / totalCosts) * 100 : 0;
    const totalProfit = totalRevenue - totalCosts;

    return {
      summary: {
        totalCampaigns: campaigns.length,
        totalCosts: Math.round(totalCosts * 100) / 100,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalProfit: Math.round(totalProfit * 100) / 100,
        totalConversions,
        totalLeads,
        totalClicks
      },
      averages: {
        cpa: Math.round(averageCPA * 100) / 100,
        cpl: Math.round(averageCPL * 100) / 100,
        cpc: Math.round(averageCPC * 100) / 100,
        cltv: Math.round(averageCLTV * 100) / 100,
        cltvToCAC: Math.round(averageCLTVToCAC * 100) / 100
      },
      roi: {
        roas: Math.round(totalROAS * 100) / 100,
        roi: Math.round(totalROI * 100) / 100,
        profit: Math.round(totalProfit * 100) / 100,
        profitMargin: totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100 * 100) / 100 : 0
      },
      campaigns: campaigns.map(c => ({
        id: c._id,
        name: c.campaign.name,
        platform: c.campaign.platform,
        cpa: c.cpa.costPerAcquisition,
        cltv: c.cltv.customerLifetimeValue,
        roas: c.roi.returnOnAdSpend,
        roi: c.roi.returnOnInvestment
      }))
    };
  } catch (error) {
    logger.error('Error getting campaign CPA metrics', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

module.exports = {
  upsertCampaignCPA,
  getCampaignCPAMetrics
};


