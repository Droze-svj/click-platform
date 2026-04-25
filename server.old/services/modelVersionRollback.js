// Model Version Rollback Service
// Handles version rollbacks and recovery

const logger = require('../utils/logger');
const ModelVersion = require('../models/ModelVersion');
const ModelLearning = require('../models/ModelLearning');

/**
 * Rollback to previous version
 */
async function rollbackVersion(provider, model, targetVersion, reason = '') {
  try {
    // Get current version
    const currentVersion = await ModelVersion.findOne({
      provider,
      model,
      current: true,
    });

    if (!currentVersion) {
      throw new Error('Current version not found');
    }

    // Get target version
    const target = await ModelVersion.findOne({
      provider,
      model,
      version: targetVersion,
    });

    if (!target) {
      throw new Error(`Target version ${targetVersion} not found`);
    }

    // Mark current as deprecated
    await ModelVersion.updateOne(
      { _id: currentVersion._id },
      {
        current: false,
        deprecated: new Date(),
        rollbackReason: reason || 'Manual rollback',
      }
    );

    // Mark target as current
    await ModelVersion.updateOne(
      { _id: target._id },
      {
        current: true,
        deprecated: null,
        rollbackDate: new Date(),
        rollbackReason: reason,
      }
    );

    // Create rollback record
    const rollbackRecord = new ModelVersion({
      provider,
      model,
      version: currentVersion.version,
      previousVersion: targetVersion,
      current: false,
      released: new Date(),
      improvements: [`Rolled back from ${currentVersion.version}`],
      breakingChanges: [`Rollback to ${targetVersion}`],
      migrationNotes: reason || 'Rollback due to performance issues',
      baselinePerformance: currentVersion.baselinePerformance,
    });

    await rollbackRecord.save();

    logger.info('Version rolled back', {
      provider,
      model,
      from: currentVersion.version,
      to: targetVersion,
      reason,
    });

    return {
      success: true,
      from: currentVersion.version,
      to: targetVersion,
      reason,
      timestamp: new Date(),
    };
  } catch (error) {
    logger.error('Rollback version error', { error: error.message });
    throw error;
  }
}

/**
 * Check if rollback is needed based on performance
 */
async function checkRollbackNeeded(provider, model, options = {}) {
  try {
    const {
      minQualityThreshold = 0.6,
      minUsageCount = 20,
      daysSinceUpgrade = 7,
    } = options;

    // Get current version
    const currentVersion = await ModelVersion.findOne({
      provider,
      model,
      current: true,
    });

    if (!currentVersion) {
      return { needed: false, reason: 'No current version' };
    }

    // Get performance since upgrade
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - daysSinceUpgrade);

    const performance = await ModelLearning.findOne({
      provider,
      model,
      aggregated: true,
      lastUsed: { $gte: sinceDate },
    });

    if (!performance || performance.usageCount < minUsageCount) {
      return { needed: false, reason: 'Insufficient data' };
    }

    // Check if performance dropped
    if (performance.avgQualityScore < minQualityThreshold) {
      // Get previous version
      const previousVersion = await ModelVersion.findOne({
        provider,
        model,
        version: currentVersion.previousVersion,
      });

      if (previousVersion) {
        // Get previous version performance
        const previousPerf = await ModelLearning.findOne({
          provider,
          model,
          aggregated: true,
          // Get performance before upgrade
        }).sort({ lastUsed: -1 });

        if (previousPerf && previousPerf.avgQualityScore > performance.avgQualityScore) {
          return {
            needed: true,
            reason: `Performance dropped from ${previousPerf.avgQualityScore.toFixed(2)} to ${performance.avgQualityScore.toFixed(2)}`,
            currentQuality: performance.avgQualityScore,
            previousQuality: previousPerf.avgQualityScore,
            recommendedVersion: currentVersion.previousVersion,
          };
        }
      }

      return {
        needed: true,
        reason: `Quality score (${performance.avgQualityScore.toFixed(2)}) below threshold (${minQualityThreshold})`,
        currentQuality: performance.avgQualityScore,
      };
    }

    return { needed: false, reason: 'Performance acceptable' };
  } catch (error) {
    logger.error('Check rollback needed error', { error: error.message });
    return { needed: false, reason: `Error: ${error.message}` };
  }
}

/**
 * Get rollback candidates
 */
async function getRollbackCandidates(provider, model) {
  try {
    // Get all previous versions
    const versions = await ModelVersion.find({
      provider,
      model,
      current: false,
    })
      .sort({ released: -1 })
      .limit(10)
      .lean();

    // Get performance for each
    const candidates = await Promise.all(
      versions.map(async (version) => {
        const performance = await ModelLearning.findOne({
          provider,
          model,
          aggregated: true,
        }).lean();

        return {
          version: version.version,
          released: version.released,
          improvements: version.improvements || [],
          baselinePerformance: version.baselinePerformance,
          historicalPerformance: performance?.avgQualityScore || null,
        };
      })
    );

    // Sort by historical performance
    return candidates.sort((a, b) => {
      const scoreA = a.historicalPerformance || 0;
      const scoreB = b.historicalPerformance || 0;
      return scoreB - scoreA;
    });
  } catch (error) {
    logger.error('Get rollback candidates error', { error: error.message });
    return [];
  }
}

module.exports = {
  rollbackVersion,
  checkRollbackNeeded,
  getRollbackCandidates,
};


