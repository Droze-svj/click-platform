// AI Model Learning Service
// Continuous learning and improvement tracking for AI models

const logger = require('../utils/logger');
const ModelLearning = require('../models/ModelLearning');
const ModelVersion = require('../models/ModelVersion');

/**
 * Track model usage and performance
 */
async function trackModelUsage(data) {
  try {
    const {
      userId,
      provider,
      model,
      taskType,
      prompt,
      response,
      responseTime,
      tokensUsed,
      qualityScore,
    } = data;

    // Save learning data
    const learning = new ModelLearning({
      userId,
      provider,
      model,
      taskType,
      promptLength: prompt?.length || 0,
      responseLength: response?.length || 0,
      responseTime,
      tokensUsed,
      qualityScore: qualityScore || calculateQualityScore(response, responseTime),
      metadata: {
        timestamp: new Date(),
        userAgent: data.userAgent,
        platform: data.platform,
      },
    });

    await learning.save();

    // Update aggregated performance metrics
    await updateModelPerformance(provider, model, taskType, {
      responseTime,
      tokensUsed,
      qualityScore: learning.qualityScore,
    });

    logger.debug('Model usage tracked', { provider, model, taskType });
    return learning;
  } catch (error) {
    logger.error('Track model usage error', { error: error.message });
    throw error;
  }
}

/**
 * Calculate quality score for response
 */
function calculateQualityScore(response, responseTime) {
  let score = 0.5;

  // Length score (optimal range)
  if (response && response.length > 50 && response.length < 5000) {
    score += 0.2;
  }

  // Response time score (faster is better, but not suspiciously fast)
  if (responseTime) {
    if (responseTime < 2000 && responseTime > 500) {
      score += 0.2;
    } else if (responseTime > 10000) {
      score -= 0.1;
    }
  }

  // Content quality indicators
  if (response) {
    // Check for proper formatting
    if (response.includes('\n') || response.includes('. ')) {
      score += 0.1;
    }

    // Check for relevant keywords (basic heuristic)
    const relevantKeywords = ['content', 'social', 'media', 'post', 'caption'];
    const hasKeywords = relevantKeywords.some(keyword => 
      response.toLowerCase().includes(keyword)
    );
    if (hasKeywords) {
      score += 0.1;
    }
  }

  return Math.min(1.0, Math.max(0.0, score));
}

/**
 * Update aggregated model performance
 */
async function updateModelPerformance(provider, model, taskType, metrics) {
  try {
    const key = `${provider}:${model}:${taskType}`;
    
    // Get or create performance record
    let performance = await ModelLearning.findOne({ 
      provider, 
      model, 
      taskType,
      aggregated: true,
    });

    if (!performance) {
      performance = new ModelLearning({
        provider,
        model,
        taskType,
        aggregated: true,
        usageCount: 0,
        totalResponseTime: 0,
        totalTokens: 0,
        totalQualityScore: 0,
        avgQualityScore: 0,
        avgResponseTime: 0,
        avgTokens: 0,
      });
    }

    // Update metrics
    performance.usageCount += 1;
    performance.totalResponseTime += metrics.responseTime || 0;
    performance.totalTokens += metrics.tokensUsed || 0;
    performance.totalQualityScore += metrics.qualityScore || 0;

    // Calculate averages
    performance.avgResponseTime = performance.totalResponseTime / performance.usageCount;
    performance.avgTokens = performance.totalTokens / performance.usageCount;
    performance.avgQualityScore = performance.totalQualityScore / performance.usageCount;

    // Update last used
    performance.lastUsed = new Date();

    await performance.save();

    logger.debug('Model performance updated', {
      provider,
      model,
      taskType,
      avgScore: performance.avgQualityScore,
    });
  } catch (error) {
    logger.error('Update model performance error', { error: error.message });
  }
}

/**
 * Get best model for task based on learning
 */
async function getBestModelForTask(taskType, options = {}) {
  try {
    const {
      provider = null,
      minUsageCount = 10,
      minQualityScore = 0.5,
    } = options;

    const query = {
      taskType,
      aggregated: true,
      usageCount: { $gte: minUsageCount },
      avgQualityScore: { $gte: minQualityScore },
    };

    if (provider) {
      query.provider = provider;
    }

    // Get all models for this task
    const models = await ModelLearning.find(query)
      .sort({ avgQualityScore: -1, usageCount: -1 })
      .limit(10);

    if (models.length === 0) {
      // No learning data, return default
      return {
        provider: 'openrouter',
        model: 'qwen/qwen-2.5-7b-instruct:free',
        confidence: 'low',
        reason: 'No learning data available',
      };
    }

    const best = models[0];
    return {
      provider: best.provider,
      model: best.model,
      confidence: best.avgQualityScore > 0.7 ? 'high' : 'medium',
      score: best.avgQualityScore,
      usageCount: best.usageCount,
      avgResponseTime: best.avgResponseTime,
      reason: `Best performing model based on ${best.usageCount} uses`,
    };
  } catch (error) {
    logger.error('Get best model error', { error: error.message });
    return {
      provider: 'openrouter',
      model: 'qwen/qwen-2.5-7b-instruct:free',
      confidence: 'low',
      reason: 'Error getting learning data',
    };
  }
}

/**
 * Get model learning insights
 */
async function getLearningInsights(options = {}) {
  try {
    const {
      provider = null,
      taskType = null,
      days = 30,
    } = options;

    const query = { aggregated: true };
    if (provider) query.provider = provider;
    if (taskType) query.taskType = taskType;

    const since = new Date();
    since.setDate(since.getDate() - days);

    query.lastUsed = { $gte: since };

    const models = await ModelLearning.find(query)
      .sort({ avgQualityScore: -1 })
      .limit(20);

    const insights = {
      totalModels: models.length,
      bestModels: [],
      recommendations: [],
      trends: {},
    };

    // Group by task type
    const byTask = {};
    for (const model of models) {
      if (!byTask[model.taskType]) {
        byTask[model.taskType] = [];
      }
      byTask[model.taskType].push(model);
    }

    // Get best model for each task
    for (const [task, taskModels] of Object.entries(byTask)) {
      if (taskModels.length > 0) {
        const best = taskModels[0];
        insights.bestModels.push({
          task,
          provider: best.provider,
          model: best.model,
          score: best.avgQualityScore,
          usage: best.usageCount,
        });

        insights.recommendations.push({
          task,
          recommendation: `Use ${best.model} (${best.provider}) for ${task}`,
          confidence: best.avgQualityScore > 0.7 ? 'high' : 'medium',
        });
      }
    }

    return insights;
  } catch (error) {
    logger.error('Get learning insights error', { error: error.message });
    return {
      totalModels: 0,
      bestModels: [],
      recommendations: [],
      trends: {},
    };
  }
}

/**
 * Check for model upgrades
 */
async function checkForModelUpgrades(provider, model) {
  try {
    // Get current version
    const currentVersion = await ModelVersion.findOne({
      provider,
      model,
      current: true,
    });

    if (!currentVersion) {
      // Create initial version
      const version = new ModelVersion({
        provider,
        model,
        version: '1.0.0',
        current: true,
        released: new Date(),
      });
      await version.save();
      return null;
    }

    // Check if there's a newer version available
    // This would typically check with the provider's API
    // For now, we'll check performance improvements
    const performance = await ModelLearning.findOne({
      provider,
      model,
      aggregated: true,
    });

    if (performance && performance.avgQualityScore > 0.8) {
      // High performance, suggest upgrade check
      return {
        currentVersion: currentVersion.version,
        hasUpgrade: false, // Would check provider API
        recommendation: 'Model performing well, monitor for updates',
      };
    }

    return {
      currentVersion: currentVersion.version,
      hasUpgrade: false,
    };
  } catch (error) {
    logger.error('Check model upgrades error', { error: error.message });
    return null;
  }
}

/**
 * Record model version upgrade
 */
async function recordModelUpgrade(provider, model, oldVersion, newVersion, improvements = []) {
  try {
    // Mark old version as not current
    await ModelVersion.updateMany(
      { provider, model, current: true },
      { current: false, deprecated: new Date() }
    );

    // Create new version
    const version = new ModelVersion({
      provider,
      model,
      version: newVersion,
      previousVersion: oldVersion,
      current: true,
      released: new Date(),
      improvements,
    });

    await version.save();

    logger.info('Model version upgrade recorded', {
      provider,
      model,
      oldVersion,
      newVersion,
    });

    return version;
  } catch (error) {
    logger.error('Record model upgrade error', { error: error.message });
    throw error;
  }
}

module.exports = {
  trackModelUsage,
  calculateQualityScore,
  updateModelPerformance,
  getBestModelForTask,
  getLearningInsights,
  checkForModelUpgrades,
  recordModelUpgrade,
};


