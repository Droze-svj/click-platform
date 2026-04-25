// Playbook Enhancement Service
// Versioning, A/B testing, marketplace, analytics

const Playbook = require('../models/Playbook');
const PlaybookVersion = require('../models/PlaybookVersion');
const logger = require('../utils/logger');

/**
 * Create playbook version
 */
async function createPlaybookVersion(playbookId, userId, versionData) {
  try {
    const playbook = await Playbook.findById(playbookId);
    if (!playbook) {
      throw new Error('Playbook not found');
    }

    // Get current version number
    const currentVersions = await PlaybookVersion.find({ playbookId })
      .sort({ versionNumber: -1 })
      .limit(1)
      .lean();

    const nextVersion = currentVersions.length > 0 
      ? currentVersions[0].versionNumber + 1 
      : 1;

    const version = new PlaybookVersion({
      playbookId,
      versionNumber: nextVersion,
      createdBy: userId,
      changes: versionData.changes || [],
      snapshot: {
        structure: playbook.structure,
        contentTemplates: playbook.contentTemplates,
        scheduling: playbook.scheduling,
        approval: playbook.approval,
        successCriteria: playbook.successCriteria
      },
      changeDescription: versionData.changeDescription || `Version ${nextVersion}`
    });

    await version.save();

    // Update playbook
    playbook.updatedAt = new Date();
    await playbook.save();

    return version;
  } catch (error) {
    logger.error('Error creating playbook version', { error: error.message, playbookId });
    throw error;
  }
}

/**
 * Get playbook versions
 */
async function getPlaybookVersions(playbookId) {
  try {
    const versions = await PlaybookVersion.find({ playbookId })
      .populate('createdBy', 'name email')
      .sort({ versionNumber: -1 })
      .lean();

    return versions;
  } catch (error) {
    logger.error('Error getting playbook versions', { error: error.message, playbookId });
    throw error;
  }
}

/**
 * Compare playbook versions
 */
async function comparePlaybookVersions(playbookId, version1, version2) {
  try {
    const [v1, v2] = await Promise.all([
      PlaybookVersion.findOne({ playbookId, versionNumber: version1 }).lean(),
      PlaybookVersion.findOne({ playbookId, versionNumber: version2 }).lean()
    ]);

    if (!v1 || !v2) {
      throw new Error('One or both versions not found');
    }

    const comparison = {
      version1: {
        number: version1,
        snapshot: v1.snapshot,
        changes: v1.changes
      },
      version2: {
        number: version2,
        snapshot: v2.snapshot,
        changes: v2.changes
      },
      differences: findDifferences(v1.snapshot, v2.snapshot)
    };

    return comparison;
  } catch (error) {
    logger.error('Error comparing versions', { error: error.message, playbookId });
    throw error;
  }
}

/**
 * Find differences
 */
function findDifferences(snapshot1, snapshot2) {
  const differences = [];

  // Compare content templates
  if (snapshot1.contentTemplates.length !== snapshot2.contentTemplates.length) {
    differences.push({
      type: 'content_templates',
      change: `Template count changed from ${snapshot1.contentTemplates.length} to ${snapshot2.contentTemplates.length}`
    });
  }

  // Compare scheduling
  if (JSON.stringify(snapshot1.scheduling) !== JSON.stringify(snapshot2.scheduling)) {
    differences.push({
      type: 'scheduling',
      change: 'Scheduling configuration changed'
    });
  }

  return differences;
}

/**
 * Get playbook analytics
 */
async function getPlaybookAnalytics(playbookId) {
  try {
    const playbook = await Playbook.findById(playbookId).lean();
    if (!playbook) {
      throw new Error('Playbook not found');
    }

    // Get content created from this playbook
    const Content = require('../models/Content');
    const contents = await Content.find({
      'metadata.createdFromPlaybook': true,
      'metadata.playbookId': playbookId
    }).lean();

    // Calculate analytics
    const analytics = {
      usage: {
        totalUses: playbook.stats.timesUsed,
        totalClients: playbook.stats.clientsUsed,
        totalContentCreated: contents.length,
        averageContentPerUse: playbook.stats.timesUsed > 0
          ? Math.round(contents.length / playbook.stats.timesUsed)
          : 0
      },
      performance: {
        averageEngagement: playbook.stats.averagePerformance.engagement || 0,
        averageReach: playbook.stats.averagePerformance.reach || 0,
        averageConversions: playbook.stats.averagePerformance.conversions || 0,
        successRate: playbook.stats.successRate
      },
      trends: {
        usageTrend: calculateUsageTrend(playbook),
        performanceTrend: 'stable' // Would calculate from historical data
      },
      recommendations: generatePlaybookRecommendations(playbook, contents)
    };

    return analytics;
  } catch (error) {
    logger.error('Error getting playbook analytics', { error: error.message, playbookId });
    throw error;
  }
}

/**
 * Calculate usage trend
 */
function calculateUsageTrend(playbook) {
  // Would calculate from historical usage data
  return 'stable';
}

/**
 * Generate playbook recommendations
 */
function generatePlaybookRecommendations(playbook, contents) {
  const recommendations = [];

  if (playbook.stats.successRate < 70) {
    recommendations.push({
      type: 'optimization',
      priority: 'high',
      message: 'Playbook success rate is below 70%. Consider optimizing content templates.',
      action: 'optimize_templates'
    });
  }

  if (playbook.stats.timesUsed < 5) {
    recommendations.push({
      type: 'usage',
      priority: 'medium',
      message: 'Playbook has low usage. Consider sharing or promoting it.',
      action: 'promote_playbook'
    });
  }

  return recommendations;
}

/**
 * Publish playbook to marketplace
 */
async function publishToMarketplace(playbookId, userId, marketplaceData) {
  try {
    const playbook = await Playbook.findById(playbookId);
    if (!playbook) {
      throw new Error('Playbook not found');
    }

    if (playbook.userId.toString() !== userId.toString()) {
      throw new Error('Not authorized to publish this playbook');
    }

    playbook.sharing.isPublic = true;
    playbook.sharing.marketplace = {
      published: true,
      publishedAt: new Date(),
      description: marketplaceData.description || playbook.description,
      tags: marketplaceData.tags || playbook.tags,
      category: marketplaceData.category || playbook.category,
      featured: marketplaceData.featured || false
    };

    await playbook.save();
    return playbook;
  } catch (error) {
    logger.error('Error publishing to marketplace', { error: error.message, playbookId });
    throw error;
  }
}

/**
 * Search marketplace playbooks
 */
async function searchMarketplace(query, filters = {}) {
  try {
    const {
      category = null,
      tags = null,
      featured = null,
      limit = 20
    } = filters;

    const searchQuery = {
      'sharing.isPublic': true,
      'sharing.marketplace.published': true,
      isActive: true
    };

    if (category) {
      searchQuery.category = category;
    }

    if (tags && Array.isArray(tags)) {
      searchQuery.tags = { $in: tags };
    }

    if (featured !== null) {
      searchQuery['sharing.marketplace.featured'] = featured;
    }

    // Text search
    if (query) {
      searchQuery.$or = [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { tags: { $in: [new RegExp(query, 'i')] } }
      ];
    }

    const playbooks = await Playbook.find(searchQuery)
      .populate('userId', 'name')
      .sort({ 'stats.timesUsed': -1, 'sharing.marketplace.featured': -1, createdAt: -1 })
      .limit(limit)
      .lean();

    return playbooks;
  } catch (error) {
    logger.error('Error searching marketplace', { error: error.message });
    throw error;
  }
}

module.exports = {
  createPlaybookVersion,
  getPlaybookVersions,
  comparePlaybookVersions,
  getPlaybookAnalytics,
  publishToMarketplace,
  searchMarketplace
};


