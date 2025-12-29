// Tier Management Service
// Upgrade/downgrade workflows and alerts

const ClientServiceTier = require('../models/ClientServiceTier');
const ServiceTier = require('../models/ServiceTier');
const { sendNotification } = require('./notificationService');
const logger = require('../utils/logger');

/**
 * Check tier usage and send alerts
 */
async function checkTierUsageAndAlert(clientWorkspaceId) {
  try {
    const assignment = await ClientServiceTier.findOne({ clientWorkspaceId })
      .populate('serviceTierId')
      .lean();

    if (!assignment || !assignment.serviceTierId) {
      return;
    }

    const tier = assignment.serviceTierId;
    const usage = assignment.usage;
    const alerts = [];

    // Check posts per week limit
    if (tier.features.postsPerWeek > 0 && usage.postsThisWeek >= tier.features.postsPerWeek * 0.8) {
      alerts.push({
        type: 'posts_limit',
        severity: usage.postsThisWeek >= tier.features.postsPerWeek ? 'high' : 'medium',
        message: `You've used ${usage.postsThisWeek} of ${tier.features.postsPerWeek} weekly posts`,
        recommendation: usage.postsThisWeek >= tier.features.postsPerWeek
          ? 'Consider upgrading to a higher tier'
          : 'You\'re approaching your weekly post limit'
      });
    }

    // Check platform limits
    const platformLimit = tier.features.platforms.length;
    if (usage.platformsUsed.length >= platformLimit) {
      alerts.push({
        type: 'platform_limit',
        severity: 'medium',
        message: `You're using all ${platformLimit} available platforms`,
        recommendation: 'Consider upgrading to access more platforms'
      });
    }

    // Send notifications
    if (alerts.length > 0) {
      const Workspace = require('../models/Workspace');
      const workspace = await Workspace.findById(clientWorkspaceId)
        .populate('members.userId')
        .lean();

      if (workspace && workspace.members) {
        for (const member of workspace.members) {
          if (member.role === 'owner' || member.role === 'admin') {
            for (const alert of alerts) {
              await sendNotification(member.userId, {
                type: 'tier_limit_alert',
                title: 'Service Tier Limit Alert',
                message: alert.message,
                link: `/clients/${clientWorkspaceId}/service-tier`,
                metadata: {
                  alertType: alert.type,
                  severity: alert.severity
                }
              });
            }
          }
        }
      }
    }

    return alerts;
  } catch (error) {
    logger.error('Error checking tier usage and alerting', { error: error.message, clientWorkspaceId });
    return [];
  }
}

/**
 * Recommend tier upgrade/downgrade
 */
async function recommendTierChange(clientWorkspaceId) {
  try {
    const assignment = await ClientServiceTier.findOne({ clientWorkspaceId })
      .populate('serviceTierId')
      .lean();

    if (!assignment) {
      return null;
    }

    const currentTier = assignment.serviceTierId;
    const usage = assignment.usage;

    // Get all tiers
    const allTiers = await ServiceTier.find({
      agencyWorkspaceId: assignment.agencyWorkspaceId,
      isActive: true
    })
      .sort({ order: 1 })
      .lean();

    const recommendations = {
      currentTier: currentTier.name,
      shouldUpgrade: false,
      shouldDowngrade: false,
      recommendedTier: null,
      reasons: []
    };

    // Check if should upgrade
    if (usage.postsThisWeek > currentTier.features.postsPerWeek * 0.9 && currentTier.features.postsPerWeek > 0) {
      const nextTier = allTiers.find(t => t.order > currentTier.order);
      if (nextTier && nextTier.features.postsPerWeek > usage.postsThisWeek) {
        recommendations.shouldUpgrade = true;
        recommendations.recommendedTier = nextTier.name;
        recommendations.reasons.push(`Using ${usage.postsThisWeek} posts/week, exceeding ${currentTier.features.postsPerWeek} limit`);
      }
    }

    if (usage.platformsUsed.length > currentTier.features.platforms.length) {
      const nextTier = allTiers.find(t => 
        t.order > currentTier.order && 
        t.features.platforms.length > usage.platformsUsed.length
      );
      if (nextTier) {
        recommendations.shouldUpgrade = true;
        recommendations.recommendedTier = nextTier.name;
        recommendations.reasons.push(`Using ${usage.platformsUsed.length} platforms, but tier only includes ${currentTier.features.platforms.length}`);
      }
    }

    // Check if should downgrade
    if (usage.postsThisWeek < currentTier.features.postsPerWeek * 0.3 && currentTier.features.postsPerWeek > 0) {
      const lowerTier = allTiers.find(t => t.order < currentTier.order);
      if (lowerTier && usage.postsThisWeek <= lowerTier.features.postsPerWeek) {
        recommendations.shouldDowngrade = true;
        recommendations.recommendedTier = lowerTier.name;
        recommendations.reasons.push(`Using only ${usage.postsThisWeek} posts/week, could save with ${lowerTier.name} tier`);
      }
    }

    return recommendations;
  } catch (error) {
    logger.error('Error recommending tier change', { error: error.message, clientWorkspaceId });
    return null;
  }
}

/**
 * Process tier upgrade
 */
async function processTierUpgrade(clientWorkspaceId, newTierId, userId) {
  try {
    const assignment = await ClientServiceTier.findOne({ clientWorkspaceId })
      .populate('serviceTierId')
      .lean();

    if (!assignment) {
      throw new Error('Client tier assignment not found');
    }

    const newTier = await ServiceTier.findById(newTierId);
    if (!newTier) {
      throw new Error('New tier not found');
    }

    // Update assignment
    const updated = await ClientServiceTier.findByIdAndUpdate(
      assignment._id,
      {
        serviceTierId: newTierId,
        tierName: newTier.name,
        status: 'upgraded',
        billing: {
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          amount: newTier.pricing.monthly,
          currency: 'USD'
        }
      },
      { new: true }
    );

    // Reset usage (optional - might want to keep it)
    updated.usage.postsThisWeek = 0;
    updated.usage.platformsUsed = [];
    await updated.save();

    logger.info('Tier upgraded', { clientWorkspaceId, from: assignment.tierName, to: newTier.name });
    return updated;
  } catch (error) {
    logger.error('Error processing tier upgrade', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

/**
 * Process tier downgrade
 */
async function processTierDowngrade(clientWorkspaceId, newTierId, userId) {
  try {
    const assignment = await ClientServiceTier.findOne({ clientWorkspaceId })
      .populate('serviceTierId')
      .lean();

    if (!assignment) {
      throw new Error('Client tier assignment not found');
    }

    const newTier = await ServiceTier.findById(newTierId);
    if (!newTier) {
      throw new Error('New tier not found');
    }

    // Check if usage fits new tier
    if (newTier.features.postsPerWeek > 0 && assignment.usage.postsThisWeek > newTier.features.postsPerWeek) {
      throw new Error(`Cannot downgrade: current usage (${assignment.usage.postsThisWeek} posts/week) exceeds new tier limit (${newTier.features.postsPerWeek} posts/week)`);
    }

    // Update assignment
    const updated = await ClientServiceTier.findByIdAndUpdate(
      assignment._id,
      {
        serviceTierId: newTierId,
        tierName: newTier.name,
        status: 'downgraded',
        billing: {
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          amount: newTier.pricing.monthly,
          currency: 'USD'
        }
      },
      { new: true }
    );

    logger.info('Tier downgraded', { clientWorkspaceId, from: assignment.tierName, to: newTier.name });
    return updated;
  } catch (error) {
    logger.error('Error processing tier downgrade', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

module.exports = {
  checkTierUsageAndAlert,
  recommendTierChange,
  processTierUpgrade,
  processTierDowngrade
};


