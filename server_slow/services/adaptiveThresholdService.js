// Adaptive Threshold Learning Service
// Learns optimal thresholds from user edits and feedback

const SceneDetectionAnalytics = require('../models/SceneDetectionAnalytics');
const logger = require('../utils/logger');

/**
 * Learn optimal sensitivity from user edits
 */
async function learnOptimalSensitivity(workspaceId, days = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const analytics = await SceneDetectionAnalytics.find({
      workspaceId,
      createdAt: { $gte: startDate }
    }).lean();

    if (analytics.length === 0) {
      return null;
    }

    // Group by sensitivity and calculate edit rates
    const sensitivityGroups = {};
    
    analytics.forEach(record => {
      const sens = record.sensitivity || 0.3;
      const key = sens.toFixed(2);
      
      if (!sensitivityGroups[key]) {
        sensitivityGroups[key] = {
          sensitivity: sens,
          count: 0,
          totalEdits: 0,
          totalScenes: 0,
          averageQuality: [],
          editRate: 0
        };
      }

      const group = sensitivityGroups[key];
      group.count++;
      group.totalEdits += record.userEdits?.totalEdits || 0;
      group.totalScenes += record.sceneCount;
      
      if (record.averageQuality) {
        group.averageQuality.push(record.averageQuality);
      }
    });

    // Calculate metrics for each sensitivity
    Object.keys(sensitivityGroups).forEach(key => {
      const group = sensitivityGroups[key];
      group.averageScenes = group.totalScenes / group.count;
      group.editRate = group.totalEdits / group.totalScenes; // Edits per scene
      group.averageQuality = group.averageQuality.length > 0
        ? group.averageQuality.reduce((a, b) => a + b, 0) / group.averageQuality.length
        : 0.5;
    });

    // Find optimal sensitivity (lowest edit rate, good quality, reasonable scene count)
    let optimalSensitivity = 0.3;
    let bestScore = -1;

    Object.values(sensitivityGroups).forEach(group => {
      // Score based on:
      // - Low edit rate (fewer corrections needed) - 40%
      // - Good quality - 30%
      // - Reasonable scene count (5-15) - 20%
      // - High scene count (more scenes = better granularity) - 10%

      const editScore = Math.max(0, 1 - (group.editRate * 2)); // Lower is better
      const qualityScore = group.averageQuality;
      const sceneCountScore = group.averageScenes >= 5 && group.averageScenes <= 15 
        ? 1.0 
        : Math.max(0, 1 - Math.abs(group.averageScenes - 10) / 10);
      const granularityScore = Math.min(1, group.averageScenes / 20);

      const totalScore = 
        (editScore * 0.4) +
        (qualityScore * 0.3) +
        (sceneCountScore * 0.2) +
        (granularityScore * 0.1);

      if (totalScore > bestScore) {
        bestScore = totalScore;
        optimalSensitivity = group.sensitivity;
      }
    });

    logger.info('Optimal sensitivity learned', { workspaceId, optimalSensitivity, bestScore });
    return {
      optimalSensitivity,
      confidence: bestScore,
      metrics: sensitivityGroups
    };
  } catch (error) {
    logger.error('Error learning optimal sensitivity', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Learn optimal min/max scene lengths from user edits
 */
async function learnOptimalSceneLengths(workspaceId, days = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const analytics = await SceneDetectionAnalytics.find({
      workspaceId,
      createdAt: { $gte: startDate },
      'userEdits.scenesMerged': { $gt: 0 } // Only analyze where users merged scenes
    }).lean();

    if (analytics.length === 0) {
      return null;
    }

    // Analyze merged scenes to understand preferred lengths
    const mergedScenes = analytics
      .filter(a => a.userEdits?.scenesMerged > 0)
      .map(a => ({
        minLength: a.minSceneLength,
        maxLength: a.maxSceneLength,
        averageLength: a.averageSceneLength,
        mergeCount: a.userEdits.scenesMerged
      }));

    // Calculate weighted average of scene lengths where merges happened
    let totalWeight = 0;
    let weightedLength = 0;

    mergedScenes.forEach(scene => {
      const weight = scene.mergeCount;
      weightedLength += scene.averageLength * weight;
      totalWeight += weight;
    });

    const optimalLength = totalWeight > 0 ? weightedLength / totalWeight : null;

    // Analyze split scenes to understand minimum preferred length
    const splitScenes = analytics
      .filter(a => a.userEdits?.scenesSplit > 0)
      .map(a => a.minSceneLength);

    const optimalMinLength = splitScenes.length > 0
      ? splitScenes.reduce((a, b) => a + b, 0) / splitScenes.length
      : null;

    return {
      optimalMinLength: optimalMinLength || 1.0,
      optimalMaxLength: optimalLength || null,
      confidence: mergedScenes.length > 5 ? 0.8 : 0.5
    };
  } catch (error) {
    logger.error('Error learning optimal scene lengths', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Update workspace settings with learned values
 */
async function updateWorkspaceWithLearnedValues(workspaceId) {
  try {
    const { getWorkspaceSettings, updateWorkspaceSettings } = require('./workspaceSceneSettingsService');

    // Learn optimal values
    const [sensitivityResult, lengthResult] = await Promise.all([
      learnOptimalSensitivity(workspaceId),
      learnOptimalSceneLengths(workspaceId)
    ]);

    const updates = {};

    if (sensitivityResult && sensitivityResult.confidence > 0.6) {
      updates.defaultSensitivity = sensitivityResult.optimalSensitivity;
    }

    if (lengthResult && lengthResult.confidence > 0.6) {
      if (lengthResult.optimalMinLength) {
        updates.defaultMinSceneLength = lengthResult.optimalMinLength;
      }
      if (lengthResult.optimalMaxLength) {
        updates.defaultMaxSceneLength = lengthResult.optimalMaxLength;
      }
    }

    if (Object.keys(updates).length > 0) {
      await updateWorkspaceSettings(workspaceId, updates);
      logger.info('Workspace settings updated with learned values', { workspaceId, updates });
      return updates;
    }

    return null;
  } catch (error) {
    logger.error('Error updating workspace with learned values', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Get adaptive recommendations for content
 */
async function getAdaptiveRecommendations(workspaceId, contentId) {
  try {
    const Scene = require('../models/Scene');
    const scenes = await Scene.find({ contentId }).lean();

    if (scenes.length === 0) {
      return null;
    }

    // Analyze current scenes
    const sceneLengths = scenes.map(s => s.duration || (s.end - s.start));
    const averageLength = sceneLengths.reduce((a, b) => a + b, 0) / sceneLengths.length;
    const minLength = Math.min(...sceneLengths);
    const maxLength = Math.max(...sceneLengths);

    // Get learned optimal values
    const sensitivityResult = await learnOptimalSensitivity(workspaceId, 7); // Last 7 days
    const lengthResult = await learnOptimalSceneLengths(workspaceId, 7);

    const recommendations = {
      current: {
        sceneCount: scenes.length,
        averageLength,
        minLength,
        maxLength
      },
      suggested: {}
    };

    // Suggest sensitivity adjustment if scenes are too fragmented or too few
    if (sensitivityResult) {
      const currentSensitivity = scenes[0]?.detectionParams?.sensitivity || 0.3;
      const diff = Math.abs(currentSensitivity - sensitivityResult.optimalSensitivity);
      
      if (diff > 0.1) {
        recommendations.suggested.sensitivity = {
          current: currentSensitivity,
          recommended: sensitivityResult.optimalSensitivity,
          reason: diff > 0 ? 'Too many scenes detected' : 'Too few scenes detected'
        };
      }
    }

    // Suggest length adjustments
    if (lengthResult) {
      if (averageLength < lengthResult.optimalMinLength * 0.8) {
        recommendations.suggested.minLength = {
          current: minLength,
          recommended: lengthResult.optimalMinLength,
          reason: 'Scenes are too short based on your editing patterns'
        };
      }
    }

    return recommendations;
  } catch (error) {
    logger.error('Error getting adaptive recommendations', { error: error.message, workspaceId, contentId });
    throw error;
  }
}

module.exports = {
  learnOptimalSensitivity,
  learnOptimalSceneLengths,
  updateWorkspaceWithLearnedValues,
  getAdaptiveRecommendations
};







