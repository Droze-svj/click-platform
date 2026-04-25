// Competitor Monitoring Service
// Automated competitor tracking

const CompetitorMonitoring = require('../models/CompetitorMonitoring');
const CompetitorBenchmark = require('../models/CompetitorBenchmark');
const HealthAlert = require('../models/HealthAlert');
const logger = require('../utils/logger');

/**
 * Add competitor for monitoring
 */
async function addCompetitor(workspaceId, clientWorkspaceId, competitorData) {
  try {
    const {
      name,
      handle,
      platform,
      profileUrl,
      verified = false,
      frequency = 'daily'
    } = competitorData;

    // Calculate next check time
    const nextCheck = calculateNextCheck(frequency);

    const competitor = new CompetitorMonitoring({
      workspaceId,
      clientWorkspaceId,
      competitor: {
        name,
        handle,
        platform,
        profileUrl,
        verified
      },
      monitoring: {
        enabled: true,
        frequency,
        nextCheck
      }
    });

    await competitor.save();

    logger.info('Competitor added for monitoring', { workspaceId, competitor: handle, platform });
    return competitor;
  } catch (error) {
    logger.error('Error adding competitor', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Sync competitor metrics
 */
async function syncCompetitorMetrics(competitorId) {
  try {
    const competitor = await CompetitorMonitoring.findById(competitorId).lean();
    if (!competitor) {
      throw new Error('Competitor not found');
    }

    // In production, would fetch from platform APIs
    // For now, simulate with placeholder data
    const metrics = await fetchCompetitorMetrics(competitor.competitor);

    // Update competitor
    await CompetitorMonitoring.findByIdAndUpdate(competitorId, {
      $set: {
        'metrics': metrics,
        'monitoring.lastChecked': new Date(),
        'monitoring.nextCheck': calculateNextCheck(competitor.monitoring.frequency)
      },
      $push: {
        history: {
          $each: [{
            date: new Date(),
            ...metrics
          }],
          $slice: -30 // Keep last 30 entries
        }
      }
    });

    // Check for alerts
    await checkCompetitorAlerts(competitorId, metrics);

    logger.info('Competitor metrics synced', { competitorId, handle: competitor.competitor.handle });
    return metrics;
  } catch (error) {
    logger.error('Error syncing competitor metrics', { error: error.message, competitorId });
    throw error;
  }
}

/**
 * Fetch competitor metrics (placeholder - would use platform APIs)
 */
async function fetchCompetitorMetrics(competitor) {
  // In production, would use platform APIs to fetch:
  // - Follower count
  // - Recent engagement
  // - Reach estimates
  // - Post count
  // - Engagement rate

  return {
    followers: 0, // Would fetch from API
    engagement: 0,
    reach: 0,
    posts: 0,
    engagementRate: 0,
    growthRate: 0
  };
}

/**
 * Check competitor alerts
 */
async function checkCompetitorAlerts(competitorId, newMetrics) {
  try {
    const competitor = await CompetitorMonitoring.findById(competitorId).lean();
    if (!competitor || !competitor.alerts.enabled) {
      return;
    }

    // Get our metrics for comparison
    const Workspace = require('../models/Workspace');
    const workspace = await Workspace.findById(competitor.workspaceId).lean();
    
    // Get our current metrics
    const ourMetrics = await getOurMetricsForComparison(competitor.workspaceId, competitor.competitor.platform);

    // Check for follower overtake
    if (competitor.alerts.thresholds.followerOvertake && 
        newMetrics.followers > ourMetrics.followers && 
        competitor.metrics.followers <= ourMetrics.followers) {
      await createCompetitorAlert(competitor, {
        type: 'follower_overtake',
        message: `${competitor.competitor.name} has overtaken us in followers`,
        severity: 'high'
      });
    }

    // Check for engagement overtake
    if (competitor.alerts.thresholds.engagementOvertake && 
        newMetrics.engagement > ourMetrics.engagement && 
        competitor.metrics.engagement <= ourMetrics.engagement) {
      await createCompetitorAlert(competitor, {
        type: 'engagement_overtake',
        message: `${competitor.competitor.name} has overtaken us in engagement`,
        severity: 'high'
      });
    }

    // Check for significant growth
    if (competitor.alerts.thresholds.significantGrowth && 
        competitor.metrics.followers > 0) {
      const growthRate = ((newMetrics.followers - competitor.metrics.followers) / competitor.metrics.followers) * 100;
      const ourGrowthRate = ourMetrics.growthRate || 0;

      if (growthRate > ourGrowthRate * 1.5) {
        await createCompetitorAlert(competitor, {
          type: 'significant_growth',
          message: `${competitor.competitor.name} is growing ${(growthRate / ourGrowthRate).toFixed(1)}x faster than us`,
          severity: 'medium'
        });
      }
    }
  } catch (error) {
    logger.error('Error checking competitor alerts', { error: error.message, competitorId });
  }
}

/**
 * Create competitor alert
 */
async function createCompetitorAlert(competitor, alertData) {
  const HealthAlert = require('../models/HealthAlert');
  
  const alert = new HealthAlert({
    clientWorkspaceId: competitor.clientWorkspaceId,
    agencyWorkspaceId: competitor.workspaceId, // Assuming workspaceId is agency
    alert: {
      type: 'competitor_overtake',
      severity: alertData.severity || 'medium',
      title: 'Competitor Alert',
      message: alertData.message,
      threshold: 0,
      currentValue: 0,
      previousValue: 0
    },
    context: {
      platform: competitor.competitor.platform,
      component: 'competitor'
    }
  });

  await alert.save();
}

/**
 * Get our metrics for comparison
 */
async function getOurMetricsForComparison(workspaceId, platform) {
  // Get our current metrics
  const AudienceGrowth = require('../models/AudienceGrowth');
  const ScheduledPost = require('../models/ScheduledPost');
  const { getAggregatedPerformanceMetrics } = require('./socialPerformanceMetricsService');

  const Workspace = require('../models/Workspace');
  const workspace = await Workspace.findById(workspaceId).lean();
  const userId = workspace?.userId;

  let followers = 0;
  let growthRate = 0;

  if (userId) {
    const growth = await AudienceGrowth.findOne({
      userId,
      platform
    })
      .sort({ snapshotDate: -1 })
      .lean();

    if (growth) {
      followers = growth.followers.current || 0;
      growthRate = growth.growth.growthRate || 0;
    }
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  const metrics = await getAggregatedPerformanceMetrics(workspaceId, {
    platform,
    startDate,
    endDate
  });

  return {
    followers,
    engagement: metrics.totalEngagement || 0,
    reach: metrics.totalReach || 0,
    growthRate
  };
}

/**
 * Calculate next check time
 */
function calculateNextCheck(frequency) {
  const next = new Date();
  if (frequency === 'daily') {
    next.setDate(next.getDate() + 1);
    next.setHours(3, 0, 0, 0); // 3 AM
  } else if (frequency === 'weekly') {
    next.setDate(next.getDate() + 7);
    next.setHours(3, 0, 0, 0);
  } else if (frequency === 'monthly') {
    next.setMonth(next.getMonth() + 1);
    next.setDate(1);
    next.setHours(3, 0, 0, 0);
  }
  return next;
}

/**
 * Sync all competitors
 */
async function syncAllCompetitors() {
  try {
    const competitors = await CompetitorMonitoring.find({
      'monitoring.enabled': true,
      'monitoring.nextCheck': { $lte: new Date() }
    }).lean();

    logger.info('Syncing competitors', { count: competitors.length });

    for (const competitor of competitors) {
      try {
        await syncCompetitorMetrics(competitor._id);
      } catch (error) {
        logger.warn('Error syncing competitor', { competitorId: competitor._id, error: error.message });
      }
    }

    return { synced: competitors.length };
  } catch (error) {
    logger.error('Error syncing all competitors', { error: error.message });
    throw error;
  }
}

module.exports = {
  addCompetitor,
  syncCompetitorMetrics,
  syncAllCompetitors
};


