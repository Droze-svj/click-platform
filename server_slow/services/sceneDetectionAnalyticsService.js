// Scene Detection Analytics Service
// Tracks metrics for continuous improvement

const SceneDetectionAnalytics = require('../models/SceneDetectionAnalytics');
const Scene = require('../models/Scene');
const logger = require('../utils/logger');

/**
 * Track user edit to scenes
 */
async function trackSceneEdit(contentId, userId, editType) {
  try {
    // Find latest analytics record for this content
    const analytics = await SceneDetectionAnalytics.findOne({ contentId, userId })
      .sort({ createdAt: -1 });

    if (!analytics) {
      logger.warn('No analytics record found for scene edit tracking', { contentId, editType });
      return;
    }

    // Update edit counts
    const updateField = `userEdits.${editType}`;
    await SceneDetectionAnalytics.findByIdAndUpdate(analytics._id, {
      $inc: {
        [updateField]: 1,
        'userEdits.totalEdits': 1
      },
      $set: { updatedAt: new Date() }
    });

    logger.info('Scene edit tracked', { contentId, editType });
  } catch (error) {
    logger.warn('Error tracking scene edit', { error: error.message, contentId, editType });
  }
}

/**
 * Get analytics summary for workspace
 */
async function getWorkspaceAnalytics(workspaceId, startDate, endDate) {
  try {
    const query = { workspaceId };
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const analytics = await SceneDetectionAnalytics.find(query).lean();

    if (analytics.length === 0) {
      return {
        totalDetections: 0,
        averageSceneCount: 0,
        averageSceneLength: 0,
        totalEdits: 0,
        averageQuality: 0
      };
    }

    // Calculate aggregations
    const totalDetections = analytics.length;
    const totalScenes = analytics.reduce((sum, a) => sum + a.sceneCount, 0);
    const totalLength = analytics.reduce((sum, a) => sum + (a.averageSceneLength * a.sceneCount), 0);
    const totalEdits = analytics.reduce((sum, a) => sum + (a.userEdits?.totalEdits || 0), 0);
    const qualities = analytics
      .map(a => a.averageQuality)
      .filter(q => q !== null && q !== undefined);
    const averageQuality = qualities.length > 0
      ? qualities.reduce((a, b) => a + b, 0) / qualities.length
      : null;

    // Count edit types
    const editTypes = {
      scenesMerged: analytics.reduce((sum, a) => sum + (a.userEdits?.scenesMerged || 0), 0),
      scenesSplit: analytics.reduce((sum, a) => sum + (a.userEdits?.scenesSplit || 0), 0),
      scenesDeleted: analytics.reduce((sum, a) => sum + (a.userEdits?.scenesDeleted || 0), 0),
      scenesPromoted: analytics.reduce((sum, a) => sum + (a.userEdits?.scenesPromoted || 0), 0)
    };

    return {
      totalDetections,
      averageSceneCount: totalScenes / totalDetections,
      averageSceneLength: totalLength / totalScenes,
      totalEdits,
      editTypes,
      averageQuality,
      highQualityRate: qualities.filter(q => q >= 0.7).length / qualities.length
    };
  } catch (error) {
    logger.error('Error getting workspace analytics', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Get detection effectiveness metrics
 */
async function getDetectionEffectivenessMetrics(workspaceId, days = 30) {
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

    // Group by sensitivity
    const bySensitivity = {};
    analytics.forEach(a => {
      const sens = a.sensitivity || 0.3;
      const key = sens.toFixed(1);
      if (!bySensitivity[key]) {
        bySensitivity[key] = {
          count: 0,
          totalScenes: 0,
          totalEdits: 0,
          averageQuality: []
        };
      }
      bySensitivity[key].count++;
      bySensitivity[key].totalScenes += a.sceneCount;
      bySensitivity[key].totalEdits += a.userEdits?.totalEdits || 0;
      if (a.averageQuality) {
        bySensitivity[key].averageQuality.push(a.averageQuality);
      }
    });

    // Calculate averages
    Object.keys(bySensitivity).forEach(key => {
      const data = bySensitivity[key];
      data.averageScenes = data.totalScenes / data.count;
      data.averageEdits = data.totalEdits / data.count;
      data.averageQuality = data.averageQuality.length > 0
        ? data.averageQuality.reduce((a, b) => a + b, 0) / data.averageQuality.length
        : null;
      delete data.averageQuality; // Remove array
    });

    return bySensitivity;
  } catch (error) {
    logger.error('Error getting detection effectiveness', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Get recommended sensitivity based on analytics
 */
async function getRecommendedSensitivity(workspaceId) {
  try {
    const metrics = await getDetectionEffectivenessMetrics(workspaceId, 30);
    
    if (!metrics || Object.keys(metrics).length === 0) {
      return 0.3; // Default
    }

    // Find sensitivity with best balance:
    // - Reasonable scene count (not too many, not too few)
    // - Low edit rate (fewer user corrections needed)
    // - Good quality scores

    let bestSensitivity = 0.3;
    let bestScore = -1;

    Object.entries(metrics).forEach(([sens, data]) => {
      const sensitivity = parseFloat(sens);
      
      // Score based on:
      // - Scene count (prefer 5-15 scenes per video)
      // - Edit rate (lower is better)
      // - Quality (higher is better)

      const sceneScore = data.averageScenes >= 5 && data.averageScenes <= 15 ? 1.0 : 0.5;
      const editScore = data.averageEdits < 2 ? 1.0 : Math.max(0, 1 - (data.averageEdits / 10));
      const qualityScore = data.averageQuality || 0.5;

      const totalScore = (sceneScore * 0.4) + (editScore * 0.3) + (qualityScore * 0.3);

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestSensitivity = sensitivity;
      }
    });

    return bestSensitivity;
  } catch (error) {
    logger.warn('Error getting recommended sensitivity', { error: error.message });
    return 0.3; // Default fallback
  }
}

module.exports = {
  trackSceneEdit,
  getWorkspaceAnalytics,
  getDetectionEffectivenessMetrics,
  getRecommendedSensitivity
};







