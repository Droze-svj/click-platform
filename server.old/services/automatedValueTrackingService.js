// Automated Value Tracking Service
// Real-time value tracking as posts are published

const ClientValueTracking = require('../models/ClientValueTracking');
const ScheduledPost = require('../models/ScheduledPost');
const { calculateValueTracking } = require('./valueTrackingService');
const logger = require('../utils/logger');

/**
 * Auto-update value tracking when post is published
 */
async function updateValueTrackingOnPost(postId, analytics) {
  try {
    const post = await ScheduledPost.findById(postId)
      .populate('contentId')
      .lean();

    if (!post || !post.workspaceId) {
      return;
    }

    const workspace = await require('../models/Workspace').findById(post.workspaceId).lean();
    if (!workspace || !workspace.agencyWorkspaceId) {
      return;
    }

    // Get current month period
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Get or create tracking record
    let tracking = await ClientValueTracking.findOne({
      clientWorkspaceId: post.workspaceId,
      'period.startDate': monthStart,
      'period.endDate': monthEnd
    });

    if (!tracking) {
      // Create new tracking record
      tracking = await calculateValueTracking(
        post.workspaceId,
        workspace.agencyWorkspaceId,
        { startDate: monthStart, endDate: monthEnd },
        {
          hourlyRate: workspace.metadata?.hourlyRate || 100,
          conversionValue: workspace.metadata?.conversionValue || 50,
          serviceTier: workspace.metadata?.serviceTier || 'silver'
        }
      );
    } else {
      // Update existing tracking with new analytics
      if (analytics) {
        tracking.value.impressions += analytics.impressions || 0;
        tracking.value.reach += analytics.reach || 0;
        tracking.value.engagement += analytics.engagement || 0;
        tracking.value.clicks += analytics.clicks || 0;

        // Update platform breakdown
        const platformBreakdown = tracking.breakdown.byPlatform.find(
          p => p.platform === post.platform
        );
        if (platformBreakdown) {
          platformBreakdown.impressions += analytics.impressions || 0;
          platformBreakdown.engagement += analytics.engagement || 0;
          platformBreakdown.clicks += analytics.clicks || 0;
        }

        // Recalculate metrics
        tracking.markModified('value');
        tracking.markModified('breakdown');
        await tracking.save();
      }
    }

    logger.debug('Value tracking updated for post', { postId, clientWorkspaceId: post.workspaceId });
  } catch (error) {
    logger.warn('Error updating value tracking on post', { error: error.message, postId });
  }
}

/**
 * Recalculate value tracking for period
 */
async function recalculateValueTracking(clientWorkspaceId, period) {
  try {
    const workspace = await require('../models/Workspace').findById(clientWorkspaceId).lean();
    if (!workspace || !workspace.agencyWorkspaceId) {
      throw new Error('Workspace not found or not associated with agency');
    }

    const tracking = await calculateValueTracking(
      clientWorkspaceId,
      workspace.agencyWorkspaceId,
      period,
      {
        hourlyRate: workspace.metadata?.hourlyRate || 100,
        conversionValue: workspace.metadata?.conversionValue || 50,
        serviceTier: workspace.metadata?.serviceTier || 'silver'
      }
    );

    return tracking;
  } catch (error) {
    logger.error('Error recalculating value tracking', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

/**
 * Auto-calculate monthly tracking for all clients
 */
async function autoCalculateMonthlyTracking(agencyWorkspaceId) {
  try {
    const Workspace = require('../models/Workspace');
    const clients = await Workspace.find({
      agencyWorkspaceId,
      type: 'client'
    }).lean();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const results = {
      total: clients.length,
      successful: 0,
      failed: 0,
      errors: []
    };

    for (const client of clients) {
      try {
        await calculateValueTracking(
          client._id,
          agencyWorkspaceId,
          { startDate: monthStart, endDate: monthEnd },
          {
            hourlyRate: client.metadata?.hourlyRate || 100,
            conversionValue: client.metadata?.conversionValue || 50,
            serviceTier: client.metadata?.serviceTier || 'silver'
          }
        );
        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          clientWorkspaceId: client._id,
          error: error.message
        });
      }
    }

    logger.info('Auto-calculated monthly tracking', { agencyWorkspaceId, ...results });
    return results;
  } catch (error) {
    logger.error('Error in auto-calculate monthly tracking', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

module.exports = {
  updateValueTrackingOnPost,
  recalculateValueTracking,
  autoCalculateMonthlyTracking
};


