// Service Tier Service
// Manage service tiers and client assignments

const ServiceTier = require('../models/ServiceTier');
const ClientServiceTier = require('../models/ClientServiceTier');
const Workspace = require('../models/Workspace');
const logger = require('../utils/logger');

/**
 * Create service tier
 */
async function createServiceTier(agencyWorkspaceId, tierData) {
  try {
    const tier = new ServiceTier({
      ...tierData,
      agencyWorkspaceId
    });

    await tier.save();
    logger.info('Service tier created', { tierId: tier._id, agencyWorkspaceId });
    return tier;
  } catch (error) {
    logger.error('Error creating service tier', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Create default tiers
 */
async function createDefaultTiers(agencyWorkspaceId) {
  try {
    const tiers = [];

    // Bronze Tier
    const bronze = await createServiceTier(agencyWorkspaceId, {
      name: 'bronze',
      displayName: 'Bronze',
      description: 'Essential social media management',
      pricing: {
        monthly: 499,
        annual: 4990
      },
      features: {
        postsPerWeek: 5,
        platforms: ['linkedin', 'twitter'],
        reportTypes: ['basic'],
        reportFrequency: 'monthly',
        contentTypes: ['post'],
        aiFeatures: {
          contentGeneration: true,
          hashtagGeneration: true
        },
        support: 'email',
        revisions: 2,
        approvalWorkflows: 1,
        teamMembers: 1
      },
      limits: {
        storage: 5,
        contentLibrary: 100
      },
      isDefault: true,
      order: 1
    });
    tiers.push(bronze);

    // Silver Tier
    const silver = await createServiceTier(agencyWorkspaceId, {
      name: 'silver',
      displayName: 'Silver',
      description: 'Professional social media management',
      pricing: {
        monthly: 999,
        annual: 9990
      },
      features: {
        postsPerWeek: 10,
        platforms: ['linkedin', 'twitter', 'facebook', 'instagram'],
        reportTypes: ['basic', 'standard'],
        reportFrequency: 'biweekly',
        contentTypes: ['post', 'video', 'carousel'],
        aiFeatures: {
          contentGeneration: true,
          hashtagGeneration: true,
          optimalTiming: true,
          performancePrediction: true
        },
        support: 'priority_email',
        revisions: 5,
        approvalWorkflows: 2,
        teamMembers: 3
      },
      limits: {
        storage: 20,
        contentLibrary: 500
      },
      isDefault: true,
      order: 2
    });
    tiers.push(silver);

    // Gold Tier
    const gold = await createServiceTier(agencyWorkspaceId, {
      name: 'gold',
      displayName: 'Gold',
      description: 'Premium social media management',
      pricing: {
        monthly: 1999,
        annual: 19990
      },
      features: {
        postsPerWeek: 20,
        platforms: ['linkedin', 'twitter', 'facebook', 'instagram', 'youtube', 'tiktok'],
        reportTypes: ['basic', 'standard', 'advanced', 'custom'],
        reportFrequency: 'weekly',
        contentTypes: ['post', 'video', 'carousel', 'story', 'reel', 'article'],
        aiFeatures: {
          contentGeneration: true,
          hashtagGeneration: true,
          optimalTiming: true,
          performancePrediction: true,
          contentRecycling: true
        },
        support: 'dedicated',
        revisions: 0, // unlimited
        approvalWorkflows: 5,
        teamMembers: 10,
        customBranding: true,
        apiAccess: true
      },
      limits: {
        storage: 0, // unlimited
        contentLibrary: 0 // unlimited
      },
      isDefault: true,
      order: 3
    });
    tiers.push(gold);

    return tiers;
  } catch (error) {
    logger.error('Error creating default tiers', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Assign tier to client
 */
async function assignTierToClient(clientWorkspaceId, agencyWorkspaceId, tierId, options = {}) {
  try {
    const tier = await ServiceTier.findById(tierId);
    if (!tier) {
      throw new Error('Service tier not found');
    }

    // Check if client already has a tier
    const existing = await ClientServiceTier.findOne({ clientWorkspaceId });
    if (existing) {
      existing.serviceTierId = tierId;
      existing.tierName = tier.name;
      existing.status = 'active';
      if (options.upgrade) existing.status = 'upgraded';
      if (options.downgrade) existing.status = 'downgraded';
      await existing.save();
      return existing;
    }

    // Create new assignment
    const assignment = new ClientServiceTier({
      clientWorkspaceId,
      agencyWorkspaceId,
      serviceTierId: tierId,
      tierName: tier.name,
      billing: {
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        amount: tier.pricing.monthly,
        currency: 'USD'
      },
      metadata: {
        assignedBy: options.userId
      }
    });

    await assignment.save();
    logger.info('Tier assigned to client', { clientWorkspaceId, tierId });
    return assignment;
  } catch (error) {
    logger.error('Error assigning tier to client', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

/**
 * Get client tier
 */
async function getClientTier(clientWorkspaceId) {
  try {
    const assignment = await ClientServiceTier.findOne({ clientWorkspaceId })
      .populate('serviceTierId')
      .lean();

    return assignment;
  } catch (error) {
    logger.error('Error getting client tier', { error: error.message, clientWorkspaceId });
    return null;
  }
}

/**
 * Update tier usage
 */
async function updateTierUsage(clientWorkspaceId, usageData) {
  try {
    const assignment = await ClientServiceTier.findOne({ clientWorkspaceId });
    if (!assignment) {
      throw new Error('Client tier assignment not found');
    }

    if (usageData.posts) {
      assignment.usage.postsThisWeek += usageData.posts;
      assignment.usage.postsThisMonth += usageData.posts;
    }

    if (usageData.platform) {
      if (!assignment.usage.platformsUsed.includes(usageData.platform)) {
        assignment.usage.platformsUsed.push(usageData.platform);
      }
    }

    if (usageData.report) {
      assignment.usage.reportsGenerated += 1;
    }

    await assignment.save();
    return assignment;
  } catch (error) {
    logger.error('Error updating tier usage', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

/**
 * Check tier limits
 */
async function checkTierLimits(clientWorkspaceId) {
  try {
    const assignment = await ClientServiceTier.findOne({ clientWorkspaceId })
      .populate('serviceTierId')
      .lean();

    if (!assignment || !assignment.serviceTierId) {
      return { withinLimits: true };
    }

    const tier = assignment.serviceTierId;
    const limits = {
      postsPerWeek: {
        current: assignment.usage.postsThisWeek,
        limit: tier.features.postsPerWeek,
        withinLimit: tier.features.postsPerWeek === 0 || assignment.usage.postsThisWeek < tier.features.postsPerWeek
      },
      platforms: {
        current: assignment.usage.platformsUsed.length,
        limit: tier.features.platformsCount,
        withinLimit: assignment.usage.platformsUsed.every(p => tier.features.platforms.includes(p))
      }
    };

    return {
      withinLimits: limits.postsPerWeek.withinLimit && limits.platforms.withinLimit,
      limits
    };
  } catch (error) {
    logger.error('Error checking tier limits', { error: error.message, clientWorkspaceId });
    return { withinLimits: true };
  }
}

module.exports = {
  createServiceTier,
  createDefaultTiers,
  assignTierToClient,
  getClientTier,
  updateTierUsage,
  checkTierLimits
};


