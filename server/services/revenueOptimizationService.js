// Revenue Optimization Service
// AI-powered revenue optimization recommendations

const RevenueAttribution = require('../models/RevenueAttribution');
const Conversion = require('../models/Conversion');
const ScheduledPost = require('../models/ScheduledPost');
const ClickTracking = require('../models/ClickTracking');
const logger = require('../utils/logger');

/**
 * Get revenue optimization recommendations
 */
async function getRevenueOptimizationRecommendations(workspaceId, filters = {}) {
  try {
    const {
      startDate,
      endDate,
      platform = null
    } = filters;

    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date();
    start.setDate(start.getDate() - 30); // Last 30 days

    // Get performance data
    const conversions = await Conversion.find({
      workspaceId,
      'conversionData.timestamp': { $gte: start, $lte: end },
      ...(platform ? { platform } : {})
    }).lean();

    const posts = await ScheduledPost.find({
      workspaceId,
      status: 'posted',
      postedAt: { $gte: start, $lte: end },
      ...(platform ? { platform } : {})
    }).lean();

    const clicks = await ClickTracking.find({
      workspaceId,
      'click.timestamp': { $gte: start, $lte: end },
      ...(platform ? { platform } : {})
    }).lean();

    const recommendations = [];

    // 1. Content Type Analysis
    const contentTypePerformance = analyzeContentTypePerformance(posts, conversions);
    if (contentTypePerformance.bestPerformer) {
      recommendations.push({
        type: 'content_type',
        priority: 'high',
        title: 'Optimize Content Types',
        message: `${contentTypePerformance.bestPerformer.type} content generates ${contentTypePerformance.bestPerformer.revenuePerPost.toFixed(2)}x more revenue per post`,
        action: `Increase ${contentTypePerformance.bestPerformer.type} content by 30%`,
        expectedImpact: `+${(contentTypePerformance.bestPerformer.revenuePerPost * 0.3).toFixed(2)} revenue per post`,
        data: contentTypePerformance
      });
    }

    // 2. Posting Time Optimization
    const timePerformance = analyzeTimePerformance(posts, conversions);
    if (timePerformance.bestTime) {
      recommendations.push({
        type: 'posting_time',
        priority: 'medium',
        title: 'Optimize Posting Times',
        message: `Posts at ${timePerformance.bestTime.hour}:00 generate ${timePerformance.bestTime.revenuePerPost.toFixed(2)}x more revenue`,
        action: `Schedule more posts at ${timePerformance.bestTime.hour}:00`,
        expectedImpact: `+${(timePerformance.bestTime.revenuePerPost * 0.2).toFixed(2)} revenue per post`,
        data: timePerformance
      });
    }

    // 3. Platform Optimization
    const platformPerformance = analyzePlatformPerformance(posts, conversions);
    if (platformPerformance.bestPlatform) {
      recommendations.push({
        type: 'platform',
        priority: 'high',
        title: 'Focus on High-Performing Platforms',
        message: `${platformPerformance.bestPlatform.platform} generates ${platformPerformance.bestPlatform.revenuePerPost.toFixed(2)}x more revenue per post`,
        action: `Increase ${platformPerformance.bestPlatform.platform} posts by 25%`,
        expectedImpact: `+${(platformPerformance.bestPlatform.revenuePerPost * 0.25).toFixed(2)} revenue per post`,
        data: platformPerformance
      });
    }

    // 4. CTR Optimization
    const ctrAnalysis = analyzeCTRPerformance(posts, clicks);
    if (ctrAnalysis.needsImprovement) {
      recommendations.push({
        type: 'ctr',
        priority: 'medium',
        title: 'Improve Click-Through Rate',
        message: `Current CTR is ${ctrAnalysis.currentCTR.toFixed(2)}%. Industry average is ${ctrAnalysis.industryAverage.toFixed(2)}%`,
        action: 'A/B test headlines, CTAs, and link placement',
        expectedImpact: `+${((ctrAnalysis.industryAverage - ctrAnalysis.currentCTR) * ctrAnalysis.impressions / 100).toFixed(0)} additional clicks`,
        data: ctrAnalysis
      });
    }

    // 5. Conversion Rate Optimization
    const conversionRateAnalysis = analyzeConversionRate(clicks, conversions);
    if (conversionRateAnalysis.needsImprovement) {
      recommendations.push({
        type: 'conversion_rate',
        priority: 'high',
        title: 'Improve Conversion Rate',
        message: `Current conversion rate is ${conversionRateAnalysis.currentRate.toFixed(2)}%. Target is ${conversionRateAnalysis.targetRate.toFixed(2)}%`,
        action: 'Optimize landing pages, reduce friction, improve messaging',
        expectedImpact: `+${((conversionRateAnalysis.targetRate - conversionRateAnalysis.currentRate) * conversionRateAnalysis.clicks / 100).toFixed(0)} additional conversions`,
        data: conversionRateAnalysis
      });
    }

    // 6. Campaign Performance
    const campaignPerformance = analyzeCampaignPerformance(posts, conversions);
    if (campaignPerformance.topCampaign) {
      recommendations.push({
        type: 'campaign',
        priority: 'medium',
        title: 'Scale Top-Performing Campaign',
        message: `${campaignPerformance.topCampaign.campaign} has ROAS of ${campaignPerformance.topCampaign.roas.toFixed(2)}`,
        action: `Increase budget for ${campaignPerformance.topCampaign.campaign} by 20%`,
        expectedImpact: `+${(campaignPerformance.topCampaign.revenue * 0.2).toFixed(2)} revenue`,
        data: campaignPerformance
      });
    }

    // Sort by priority and impact
    recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    return {
      recommendations,
      summary: {
        totalRecommendations: recommendations.length,
        highPriority: recommendations.filter(r => r.priority === 'high').length,
        estimatedImpact: calculateTotalImpact(recommendations)
      }
    };
  } catch (error) {
    logger.error('Error getting revenue optimization recommendations', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Analyze content type performance
 */
function analyzeContentTypePerformance(posts, conversions) {
  const typePerformance = {};

  posts.forEach(post => {
    const type = post.contentId?.type || 'post';
    if (!typePerformance[type]) {
      typePerformance[type] = { posts: 0, revenue: 0 };
    }
    typePerformance[type].posts++;
  });

  conversions.forEach(conversion => {
    const post = posts.find(p => p._id.toString() === conversion.postId.toString());
    if (post) {
      const type = post.contentId?.type || 'post';
      if (typePerformance[type]) {
        typePerformance[type].revenue += conversion.revenue.attributed || conversion.conversionValue || 0;
      }
    }
  });

  const results = Object.entries(typePerformance).map(([type, data]) => ({
    type,
    posts: data.posts,
    revenue: data.revenue,
    revenuePerPost: data.posts > 0 ? data.revenue / data.posts : 0
  }));

  const bestPerformer = results.reduce((best, current) => 
    current.revenuePerPost > best.revenuePerPost ? current : best
  , results[0] || null);

  return { typePerformance: results, bestPerformer };
}

/**
 * Analyze time performance
 */
function analyzeTimePerformance(posts, conversions) {
  const hourPerformance = {};

  posts.forEach(post => {
    const hour = new Date(post.postedAt).getHours();
    if (!hourPerformance[hour]) {
      hourPerformance[hour] = { posts: 0, revenue: 0 };
    }
    hourPerformance[hour].posts++;
  });

  conversions.forEach(conversion => {
    const post = posts.find(p => p._id.toString() === conversion.postId.toString());
    if (post) {
      const hour = new Date(post.postedAt).getHours();
      if (hourPerformance[hour]) {
        hourPerformance[hour].revenue += conversion.revenue.attributed || conversion.conversionValue || 0;
      }
    }
  });

  const results = Object.entries(hourPerformance).map(([hour, data]) => ({
    hour: parseInt(hour),
    posts: data.posts,
    revenue: data.revenue,
    revenuePerPost: data.posts > 0 ? data.revenue / data.posts : 0
  }));

  const bestTime = results.reduce((best, current) => 
    current.revenuePerPost > best.revenuePerPost ? current : best
  , results[0] || null);

  return { hourPerformance: results, bestTime };
}

/**
 * Analyze platform performance
 */
function analyzePlatformPerformance(posts, conversions) {
  const platformPerformance = {};

  posts.forEach(post => {
    const platform = post.platform;
    if (!platformPerformance[platform]) {
      platformPerformance[platform] = { posts: 0, revenue: 0 };
    }
    platformPerformance[platform].posts++;
  });

  conversions.forEach(conversion => {
    if (platformPerformance[conversion.platform]) {
      platformPerformance[conversion.platform].revenue += conversion.revenue.attributed || conversion.conversionValue || 0;
    }
  });

  const results = Object.entries(platformPerformance).map(([platform, data]) => ({
    platform,
    posts: data.posts,
    revenue: data.revenue,
    revenuePerPost: data.posts > 0 ? data.revenue / data.posts : 0
  }));

  const bestPlatform = results.reduce((best, current) => 
    current.revenuePerPost > best.revenuePerPost ? current : best
  , results[0] || null);

  return { platformPerformance: results, bestPlatform };
}

/**
 * Analyze CTR performance
 */
function analyzeCTRPerformance(posts, clicks) {
  const totalImpressions = posts.reduce((sum, p) => sum + (p.analytics?.impressions || 0), 0);
  const totalClicks = clicks.length;
  const currentCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const industryAverage = 2.0; // Industry average CTR

  return {
    currentCTR,
    industryAverage,
    needsImprovement: currentCTR < industryAverage,
    impressions: totalImpressions,
    clicks: totalClicks
  };
}

/**
 * Analyze conversion rate
 */
function analyzeConversionRate(clicks, conversions) {
  const totalClicks = clicks.length;
  const totalConversions = conversions.length;
  const currentRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
  const targetRate = 3.0; // Target conversion rate

  return {
    currentRate,
    targetRate,
    needsImprovement: currentRate < targetRate,
    clicks: totalClicks,
    conversions: totalConversions
  };
}

/**
 * Analyze campaign performance
 */
function analyzeCampaignPerformance(posts, conversions) {
  const campaignPerformance = {};

  posts.forEach(post => {
    if (post.campaignId) {
      const campaignId = post.campaignId.toString();
      if (!campaignPerformance[campaignId]) {
        campaignPerformance[campaignId] = { posts: 0, revenue: 0, costs: 0 };
      }
      campaignPerformance[campaignId].posts++;
      campaignPerformance[campaignId].costs += post.metadata?.costs?.total || 0;
    }
  });

  conversions.forEach(conversion => {
    if (conversion.attribution.campaign) {
      const campaignId = conversion.attribution.campaign;
      if (campaignPerformance[campaignId]) {
        campaignPerformance[campaignId].revenue += conversion.revenue.attributed || conversion.conversionValue || 0;
      }
    }
  });

  const results = Object.entries(campaignPerformance).map(([campaign, data]) => ({
    campaign,
    posts: data.posts,
    revenue: data.revenue,
    costs: data.costs,
    roas: data.costs > 0 ? data.revenue / data.costs : 0
  }));

  const topCampaign = results.reduce((best, current) => 
    current.roas > best.roas ? current : best
  , results[0] || null);

  return { campaignPerformance: results, topCampaign };
}

/**
 * Calculate total impact
 */
function calculateTotalImpact(recommendations) {
  // Simplified calculation - would be more sophisticated in production
  return {
    estimatedRevenueIncrease: recommendations.length * 100, // Placeholder
    estimatedConversionIncrease: recommendations.length * 5, // Placeholder
    confidence: 70
  };
}

module.exports = {
  getRevenueOptimizationRecommendations
};


