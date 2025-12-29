// Model Version Gradual Rollout Service
// Manages gradual rollout of new model versions

const logger = require('../utils/logger');
const ModelVersion = require('../models/ModelVersion');

// Rollout tracking
const rollouts = new Map();

/**
 * Start gradual rollout of new version
 */
async function startGradualRollout(provider, model, newVersion, options = {}) {
  try {
    const {
      initialPercentage = 10, // Start with 10%
      incrementPercentage = 10, // Increase by 10% daily
      maxPercentage = 100,
      minDaysBetweenIncrements = 1,
      successThreshold = 0.7, // Quality score threshold
    } = options;

    // Get current version
    const currentVersion = await ModelVersion.findOne({
      provider,
      model,
      current: true,
    });

    if (!currentVersion) {
      throw new Error('Current version not found');
    }

    const rolloutId = `${provider}:${model}:${newVersion}`;

    // Create rollout plan
    const rollout = {
      id: rolloutId,
      provider,
      model,
      fromVersion: currentVersion.version,
      toVersion: newVersion,
      currentPercentage: initialPercentage,
      targetPercentage: maxPercentage,
      incrementPercentage,
      minDaysBetweenIncrements,
      successThreshold,
      started: new Date(),
      lastIncrement: new Date(),
      status: 'active',
      metrics: {
        totalRequests: 0,
        successCount: 0,
        failureCount: 0,
        avgQuality: 0,
        avgResponseTime: 0,
      },
    };

    rollouts.set(rolloutId, rollout);

    logger.info('Gradual rollout started', {
      provider,
      model,
      fromVersion: currentVersion.version,
      toVersion: newVersion,
      initialPercentage,
    });

    return rollout;
  } catch (error) {
    logger.error('Start gradual rollout error', { error: error.message });
    throw error;
  }
}

/**
 * Check if request should use new version (based on rollout percentage)
 */
function shouldUseNewVersion(provider, model, newVersion, userId = null) {
  const rolloutId = `${provider}:${model}:${newVersion}`;
  const rollout = rollouts.get(rolloutId);

  if (!rollout || rollout.status !== 'active') {
    return false;
  }

  // Use consistent hashing for user-based rollout
  if (userId) {
    const hash = simpleHash(`${userId}:${rolloutId}`);
    const userPercentage = (hash % 100);
    return userPercentage < rollout.currentPercentage;
  }

  // Random rollout
  return Math.random() * 100 < rollout.currentPercentage;
}

/**
 * Simple hash function for consistent user assignment
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Update rollout metrics
 */
function updateRolloutMetrics(provider, model, newVersion, metrics) {
  const rolloutId = `${provider}:${model}:${newVersion}`;
  const rollout = rollouts.get(rolloutId);

  if (!rollout) {
    return;
  }

  rollout.metrics.totalRequests += 1;
  
  if (metrics.success) {
    rollout.metrics.successCount += 1;
  } else {
    rollout.metrics.failureCount += 1;
  }

  // Update averages
  if (metrics.qualityScore !== undefined) {
    const currentAvg = rollout.metrics.avgQuality;
    const count = rollout.metrics.totalRequests;
    rollout.metrics.avgQuality = (currentAvg * (count - 1) + metrics.qualityScore) / count;
  }

  if (metrics.responseTime !== undefined) {
    const currentAvg = rollout.metrics.avgResponseTime;
    const count = rollout.metrics.totalRequests;
    rollout.metrics.avgResponseTime = (currentAvg * (count - 1) + metrics.responseTime) / count;
  }

  rollouts.set(rolloutId, rollout);
}

/**
 * Increment rollout percentage
 */
async function incrementRollout(provider, model, newVersion) {
  const rolloutId = `${provider}:${model}:${newVersion}`;
  const rollout = rollouts.get(rolloutId);

  if (!rollout || rollout.status !== 'active') {
    return null;
  }

  // Check if enough time has passed
  const daysSinceLastIncrement = (Date.now() - rollout.lastIncrement.getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysSinceLastIncrement < rollout.minDaysBetweenIncrements) {
    return rollout;
  }

  // Check if metrics are good
  if (rollout.metrics.totalRequests > 0) {
    const successRate = rollout.metrics.successCount / rollout.metrics.totalRequests;
    
    if (successRate < rollout.successThreshold) {
      logger.warn('Rollout paused due to low success rate', {
        rolloutId,
        successRate,
        threshold: rollout.successThreshold,
      });
      rollout.status = 'paused';
      rollouts.set(rolloutId, rollout);
      return rollout;
    }
  }

  // Increment percentage
  rollout.currentPercentage = Math.min(
    rollout.currentPercentage + rollout.incrementPercentage,
    rollout.targetPercentage
  );
  rollout.lastIncrement = new Date();

  // Check if rollout complete
  if (rollout.currentPercentage >= rollout.targetPercentage) {
    rollout.status = 'completed';
    
    // Mark new version as current
    await ModelVersion.updateMany(
      { provider, model, current: true },
      { current: false, deprecated: new Date() }
    );
    
    await ModelVersion.updateOne(
      { provider, model, version: newVersion },
      { current: true }
    );

    logger.info('Rollout completed', { rolloutId, newVersion });
  }

  rollouts.set(rolloutId, rollout);

  logger.info('Rollout incremented', {
    rolloutId,
    newPercentage: rollout.currentPercentage,
  });

  return rollout;
}

/**
 * Get rollout status
 */
function getRolloutStatus(provider, model, newVersion) {
  const rolloutId = `${provider}:${model}:${newVersion}`;
  return rollouts.get(rolloutId) || null;
}

/**
 * Pause rollout
 */
function pauseRollout(provider, model, newVersion, reason = '') {
  const rolloutId = `${provider}:${model}:${newVersion}`;
  const rollout = rollouts.get(rolloutId);

  if (rollout) {
    rollout.status = 'paused';
    rollout.pauseReason = reason;
    rollouts.set(rolloutId, rollout);

    logger.info('Rollout paused', { rolloutId, reason });
  }

  return rollout;
}

/**
 * Cancel rollout
 */
async function cancelRollout(provider, model, newVersion, reason = '') {
  const rolloutId = `${provider}:${model}:${newVersion}`;
  const rollout = rollouts.get(rolloutId);

  if (rollout) {
    rollout.status = 'cancelled';
    rollout.cancelReason = reason;
    rollouts.set(rolloutId, rollout);

    logger.info('Rollout cancelled', { rolloutId, reason });
  }

  return rollout;
}

/**
 * Schedule automatic rollout increments
 */
function scheduleRolloutIncrements() {
  const cron = require('node-cron');

  // Check rollouts every hour
  cron.schedule('0 * * * *', async () => {
    for (const [rolloutId, rollout] of rollouts.entries()) {
      if (rollout.status === 'active') {
        try {
          await incrementRollout(rollout.provider, rollout.model, rollout.toVersion);
        } catch (error) {
          logger.error('Rollout increment error', { rolloutId, error: error.message });
        }
      }
    }
  });

  logger.info('Rollout increment scheduler started');
}

module.exports = {
  startGradualRollout,
  shouldUseNewVersion,
  updateRolloutMetrics,
  incrementRollout,
  getRolloutStatus,
  pauseRollout,
  cancelRollout,
  scheduleRolloutIncrements,
};


