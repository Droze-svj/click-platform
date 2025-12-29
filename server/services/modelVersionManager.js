// Model Version Manager
// Manages AI model versions, upgrades, and continuous learning improvements

const axios = require('axios');
const logger = require('../utils/logger');
const ModelVersion = require('../models/ModelVersion');
const ModelLearning = require('../models/ModelLearning');
const { FREE_AI_PROVIDERS } = require('./freeAIModelService');
const { validateVersionBeforeUpgrade, abTestVersions } = require('./modelVersionTesting');
const { rollbackVersion, checkRollbackNeeded, getRollbackCandidates } = require('./modelVersionRollback');
const { startGradualRollout, shouldUseNewVersion, updateRolloutMetrics } = require('./modelVersionGradualRollout');

/**
 * Check for available model upgrades from providers
 */
async function checkForModelUpgrades(provider, model) {
  try {
    let upgrades = null;

    switch (provider) {
      case 'openrouter':
        upgrades = await checkOpenRouterUpgrades(model);
        break;
      case 'huggingface':
        upgrades = await checkHuggingFaceUpgrades(model);
        break;
      case 'cerebras':
        upgrades = await checkCerebrasUpgrades(model);
        break;
      case 'replicate':
        upgrades = await checkReplicateUpgrades(model);
        break;
      default:
        logger.warn('Upgrade check not implemented for provider', { provider });
    }

    return upgrades;
  } catch (error) {
    logger.error('Check model upgrades error', { error: error.message, provider, model });
    return null;
  }
}

/**
 * Check OpenRouter for model upgrades
 */
async function checkOpenRouterUpgrades(model) {
  try {
    // OpenRouter provides model information via their API
    const response = await axios.get('https://openrouter.ai/api/v1/models', {
      headers: {
        'HTTP-Referer': process.env.FRONTEND_URL || 'https://click.app',
        'X-Title': 'Click - AI Content Platform',
      },
      timeout: 10000,
    });

    const models = response.data?.data || [];
    const currentModel = models.find(m => m.id === model || m.id.includes(model.split('/')[1]));

    if (!currentModel) {
      return null;
    }

    // Check for newer versions
    const currentVersion = await getCurrentVersion('openrouter', model);
    const latestVersion = currentModel.id;

    if (latestVersion !== currentVersion?.version) {
      return {
        hasUpgrade: true,
        currentVersion: currentVersion?.version || '1.0.0',
        latestVersion: latestVersion,
        improvements: extractImprovements(currentModel),
        releaseDate: currentModel.created || new Date(),
        recommended: true,
      };
    }

    return {
      hasUpgrade: false,
      currentVersion: currentVersion?.version || latestVersion,
      latestVersion: latestVersion,
    };
  } catch (error) {
    logger.warn('OpenRouter upgrade check error', { error: error.message });
    return null;
  }
}

/**
 * Check Hugging Face for model upgrades
 */
async function checkHuggingFaceUpgrades(model) {
  try {
    // Hugging Face model info API
    const modelPath = model.replace('meta-llama/', '').replace('mistralai/', '').replace('google/', '');
    const response = await axios.get(
      `https://huggingface.co/api/models/${model}`,
      { timeout: 10000 }
    );

    const modelInfo = response.data;
    const currentVersion = await getCurrentVersion('huggingface', model);

    // Check for new commits/versions
    if (modelInfo.sha && modelInfo.sha !== currentVersion?.version) {
      return {
        hasUpgrade: true,
        currentVersion: currentVersion?.version || '1.0.0',
        latestVersion: modelInfo.sha.substring(0, 8),
        improvements: extractHuggingFaceImprovements(modelInfo),
        releaseDate: modelInfo.created_at || new Date(),
        recommended: true,
      };
    }

    return {
      hasUpgrade: false,
      currentVersion: currentVersion?.version || modelInfo.sha?.substring(0, 8),
    };
  } catch (error) {
    logger.warn('Hugging Face upgrade check error', { error: error.message });
    return null;
  }
}

/**
 * Check Cerebras for model upgrades
 */
async function checkCerebrasUpgrades(model) {
  try {
    // Cerebras may have version info in their API
    // For now, check performance improvements
    const performance = await getModelPerformance('cerebras', model);
    
    if (performance && performance.avgQualityScore > 0.8) {
      // High performance suggests using latest version
      const currentVersion = await getCurrentVersion('cerebras', model);
      
      return {
        hasUpgrade: false, // No explicit version tracking
        currentVersion: currentVersion?.version || 'latest',
        latestVersion: 'latest',
        performanceBased: true,
        recommendation: 'Model performing well, using latest version',
      };
    }

    return null;
  } catch (error) {
    logger.warn('Cerebras upgrade check error', { error: error.message });
    return null;
  }
}

/**
 * Check Replicate for model upgrades
 */
async function checkReplicateUpgrades(model) {
  try {
    // Replicate has version tracking
    const providerConfig = FREE_AI_PROVIDERS.replicate;
    if (!providerConfig?.apiKey) {
      return null;
    }

    const response = await axios.get(
      `https://api.replicate.com/v1/models/${model}/versions`,
      {
        headers: {
          'Authorization': `Token ${providerConfig.apiKey}`,
        },
        timeout: 10000,
      }
    );

    const versions = response.data?.results || [];
    if (versions.length === 0) {
      return null;
    }

    const latestVersion = versions[0];
    const currentVersion = await getCurrentVersion('replicate', model);

    if (latestVersion.id !== currentVersion?.version) {
      return {
        hasUpgrade: true,
        currentVersion: currentVersion?.version || 'unknown',
        latestVersion: latestVersion.id,
        improvements: extractReplicateImprovements(latestVersion),
        releaseDate: latestVersion.created_at || new Date(),
        recommended: true,
      };
    }

    return {
      hasUpgrade: false,
      currentVersion: currentVersion?.version || latestVersion.id,
      latestVersion: latestVersion.id,
    };
  } catch (error) {
    logger.warn('Replicate upgrade check error', { error: error.message });
    return null;
  }
}

/**
 * Extract improvements from model info
 */
function extractImprovements(modelInfo) {
  const improvements = [];

  if (modelInfo.description) {
    improvements.push(`Updated: ${modelInfo.description.substring(0, 100)}`);
  }

  if (modelInfo.pricing) {
    improvements.push('Pricing optimized');
  }

  if (modelInfo.top_provider) {
    improvements.push('Top provider performance');
  }

  return improvements.length > 0 ? improvements : ['Performance improvements', 'Bug fixes'];
}

/**
 * Extract improvements from Hugging Face model
 */
function extractHuggingFaceImprovements(modelInfo) {
  const improvements = [];

  if (modelInfo.tags) {
    if (modelInfo.tags.includes('latest')) {
      improvements.push('Latest version available');
    }
    if (modelInfo.tags.includes('improved')) {
      improvements.push('Improved performance');
    }
  }

  if (modelInfo.downloads) {
    improvements.push(`High usage: ${modelInfo.downloads.toLocaleString()} downloads`);
  }

  return improvements.length > 0 ? improvements : ['Model updates', 'Performance improvements'];
}

/**
 * Extract improvements from Replicate version
 */
function extractReplicateImprovements(version) {
  const improvements = [];

  if (version.cog_version) {
    improvements.push(`Cog version: ${version.cog_version}`);
  }

  if (version.openapi_schema) {
    improvements.push('OpenAPI schema updated');
  }

  return improvements.length > 0 ? improvements : ['New version available', 'Performance updates'];
}

/**
 * Get current version from database
 */
async function getCurrentVersion(provider, model) {
  try {
    const version = await ModelVersion.findOne({
      provider,
      model,
      current: true,
    }).lean();

    return version;
  } catch (error) {
    logger.error('Get current version error', { error: error.message });
    return null;
  }
}

/**
 * Get model performance data
 */
async function getModelPerformance(provider, model) {
  try {
    const performance = await ModelLearning.findOne({
      provider,
      model,
      aggregated: true,
    }).lean();

    return performance;
  } catch (error) {
    logger.error('Get model performance error', { error: error.message });
    return null;
  }
}

/**
 * Record model upgrade
 */
async function recordModelUpgrade(provider, model, upgradeInfo) {
  try {
    const {
      oldVersion,
      newVersion,
      improvements = [],
      breakingChanges = [],
      migrationNotes = '',
    } = upgradeInfo;

    // Mark old version as deprecated
    await ModelVersion.updateMany(
      { provider, model, current: true },
      {
        current: false,
        deprecated: new Date(),
      }
    );

    // Get baseline performance before upgrade
    const baselinePerformance = await getModelPerformance(provider, model);

    // Create new version record
    const newVersionRecord = new ModelVersion({
      provider,
      model,
      version: newVersion,
      previousVersion: oldVersion,
      current: true,
      released: new Date(),
      improvements,
      breakingChanges,
      migrationNotes,
      baselinePerformance: baselinePerformance ? {
        avgQualityScore: baselinePerformance.avgQualityScore,
        avgResponseTime: baselinePerformance.avgResponseTime,
        avgTokens: baselinePerformance.avgTokens,
      } : null,
    });

    await newVersionRecord.save();

    logger.info('Model version upgrade recorded', {
      provider,
      model,
      oldVersion,
      newVersion,
      improvements: improvements.length,
    });

    return newVersionRecord;
  } catch (error) {
    logger.error('Record model upgrade error', { error: error.message });
    throw error;
  }
}

/**
 * Get version history for a model
 */
async function getVersionHistory(provider, model) {
  try {
    const versions = await ModelVersion.find({
      provider,
      model,
    })
      .sort({ released: -1 })
      .lean();

    return versions;
  } catch (error) {
    logger.error('Get version history error', { error: error.message });
    return [];
  }
}

/**
 * Compare versions
 */
async function compareVersions(provider, model, version1, version2) {
  try {
    const v1 = await ModelVersion.findOne({ provider, model, version: version1 }).lean();
    const v2 = await ModelVersion.findOne({ provider, model, version: version2 }).lean();

    if (!v1 || !v2) {
      return null;
    }

    return {
      version1: {
        version: v1.version,
        released: v1.released,
        improvements: v1.improvements || [],
        baselinePerformance: v1.baselinePerformance,
      },
      version2: {
        version: v2.version,
        released: v2.released,
        improvements: v2.improvements || [],
        baselinePerformance: v2.baselinePerformance,
      },
      comparison: {
        performanceDelta: v2.baselinePerformance && v1.baselinePerformance
          ? {
              qualityScore: (v2.baselinePerformance.avgQualityScore || 0) - (v1.baselinePerformance.avgQualityScore || 0),
              responseTime: (v2.baselinePerformance.avgResponseTime || 0) - (v1.baselinePerformance.avgResponseTime || 0),
            }
          : null,
        newFeatures: v2.improvements?.filter(imp => !v1.improvements?.includes(imp)) || [],
        breakingChanges: v2.breakingChanges || [],
      },
    };
  } catch (error) {
    logger.error('Compare versions error', { error: error.message });
    return null;
  }
}

/**
 * Get upgrade recommendations based on learning
 */
async function getUpgradeRecommendations(provider = null) {
  try {
    const recommendations = [];

    // Get all models with learning data
    const query = { aggregated: true };
    if (provider) {
      query.provider = provider;
    }

    const models = await ModelLearning.find(query)
      .sort({ avgQualityScore: -1 })
      .limit(20)
      .lean();

    for (const model of models) {
      // Check for upgrades
      const upgrades = await checkForModelUpgrades(model.provider, model.model);

      if (upgrades?.hasUpgrade) {
        recommendations.push({
          provider: model.provider,
          model: model.model,
          currentVersion: upgrades.currentVersion,
          latestVersion: upgrades.latestVersion,
          improvements: upgrades.improvements || [],
          currentPerformance: {
            qualityScore: model.avgQualityScore,
            responseTime: model.avgResponseTime,
            usageCount: model.usageCount,
          },
          recommended: upgrades.recommended || false,
          reason: 'New version available with improvements',
        });
      } else if (model.avgQualityScore < 0.6 && model.usageCount > 10) {
        // Low performance - recommend checking for upgrades
        recommendations.push({
          provider: model.provider,
          model: model.model,
          currentVersion: 'unknown',
          latestVersion: 'checking...',
          currentPerformance: {
            qualityScore: model.avgQualityScore,
            responseTime: model.avgResponseTime,
            usageCount: model.usageCount,
          },
          recommended: true,
          reason: 'Low performance detected - check for upgrades',
        });
      }
    }

    return recommendations.sort((a, b) => {
      // Sort by recommendation priority
      if (a.recommended && !b.recommended) return -1;
      if (!a.recommended && b.recommended) return 1;
      return (b.currentPerformance.qualityScore || 0) - (a.currentPerformance.qualityScore || 0);
    });
  } catch (error) {
    logger.error('Get upgrade recommendations error', { error: error.message });
    return [];
  }
}

/**
 * Auto-upgrade model if recommended (with testing)
 */
async function autoUpgradeModel(provider, model, options = {}) {
  try {
    const {
      autoUpgrade = false,
      minQualityImprovement = 0.1,
      testBeforeUpgrade = true,
      useGradualRollout = true,
    } = options;

    if (!autoUpgrade) {
      return { upgraded: false, reason: 'Auto-upgrade disabled' };
    }

    // Check for upgrades
    const upgrades = await checkForModelUpgrades(provider, model);

    if (!upgrades?.hasUpgrade) {
      return { upgraded: false, reason: 'No upgrades available' };
    }

    // Test new version before upgrading
    if (testBeforeUpgrade) {
      const validation = await validateVersionBeforeUpgrade(
        provider,
        model,
        upgrades.latestVersion,
        { minQualityImprovement }
      );

      if (!validation.valid) {
        return {
          upgraded: false,
          reason: validation.reason,
          testResults: validation.testResults,
        };
      }

      // If gradual rollout enabled, start rollout instead of immediate upgrade
      if (useGradualRollout) {
        const rollout = await startGradualRollout(provider, model, upgrades.latestVersion, {
          initialPercentage: 10,
          incrementPercentage: 10,
        });

        return {
          upgraded: false,
          rollout: true,
          rolloutId: rollout.id,
          reason: 'Gradual rollout started',
          newVersion: upgrades.latestVersion,
        };
      }
    }

    // Record upgrade
    await recordModelUpgrade(provider, model, {
      oldVersion: upgrades.currentVersion,
      newVersion: upgrades.latestVersion,
      improvements: upgrades.improvements || [],
    });

    logger.info('Model auto-upgraded', {
      provider,
      model,
      oldVersion: upgrades.currentVersion,
      newVersion: upgrades.latestVersion,
    });

    return {
      upgraded: true,
      oldVersion: upgrades.currentVersion,
      newVersion: upgrades.latestVersion,
      improvements: upgrades.improvements,
    };
  } catch (error) {
    logger.error('Auto-upgrade model error', { error: error.message });
    return { upgraded: false, error: error.message };
  }
}

/**
 * Schedule automatic upgrade checks
 */
function scheduleUpgradeChecks() {
  const cron = require('node-cron');

  // Check for upgrades daily at 2 AM
  cron.schedule('0 2 * * *', async () => {
    logger.info('Running scheduled model upgrade checks...');

    try {
      const recommendations = await getUpgradeRecommendations();

      if (recommendations.length > 0) {
        logger.info('Model upgrades available', {
          count: recommendations.length,
          models: recommendations.map(r => `${r.provider}:${r.model}`),
        });

        // Log recommendations for admin review
        for (const rec of recommendations) {
          logger.info('Upgrade recommendation', {
            provider: rec.provider,
            model: rec.model,
            currentVersion: rec.currentVersion,
            latestVersion: rec.latestVersion,
            reason: rec.reason,
          });
        }
      } else {
        logger.info('No model upgrades available');
      }
    } catch (error) {
      logger.error('Scheduled upgrade check error', { error: error.message });
    }
  });

  logger.info('Model upgrade checks scheduled (daily at 2 AM)');
}

/**
 * Get version analytics and insights
 */
async function getVersionAnalytics(provider, model, days = 30) {
  try {
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Get all versions
    const versions = await ModelVersion.find({
      provider,
      model,
    })
      .sort({ released: -1 })
      .lean();

    // Get performance for each version
    const analytics = await Promise.all(
      versions.map(async (version) => {
        const performance = await ModelLearning.find({
          provider,
          model,
          aggregated: true,
          lastUsed: { $gte: since },
        })
          .sort({ lastUsed: -1 })
          .limit(1)
          .lean();

        return {
          version: version.version,
          released: version.released,
          current: version.current,
          deprecated: version.deprecated,
          improvements: version.improvements || [],
          performance: performance[0] ? {
            avgQuality: performance[0].avgQualityScore,
            avgResponseTime: performance[0].avgResponseTime,
            usageCount: performance[0].usageCount,
          } : null,
        };
      })
    );

    return {
      provider,
      model,
      versions: analytics,
      totalVersions: versions.length,
      currentVersion: versions.find(v => v.current)?.version,
    };
  } catch (error) {
    logger.error('Get version analytics error', { error: error.message });
    return null;
  }
}

module.exports = {
  checkForModelUpgrades,
  checkOpenRouterUpgrades,
  checkHuggingFaceUpgrades,
  checkCerebrasUpgrades,
  checkReplicateUpgrades,
  recordModelUpgrade,
  getVersionHistory,
  compareVersions,
  getUpgradeRecommendations,
  autoUpgradeModel,
  scheduleUpgradeChecks,
  getCurrentVersion,
  getVersionAnalytics,
  // Testing
  validateVersionBeforeUpgrade,
  abTestVersions,
  // Rollback
  rollbackVersion,
  checkRollbackNeeded,
  getRollbackCandidates,
  // Gradual Rollout
  startGradualRollout,
  shouldUseNewVersion,
  updateRolloutMetrics,
};

