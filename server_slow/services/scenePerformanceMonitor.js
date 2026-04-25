// Scene Detection Performance Monitor
// Tracks performance metrics and provides insights

const logger = require('../utils/logger');
const SceneDetectionJob = require('../models/SceneDetectionJob');

/**
 * Get performance metrics for scene detection
 */
async function getPerformanceMetrics(workspaceId, days = 7) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const jobs = await SceneDetectionJob.find({
      workspaceId,
      createdAt: { $gte: startDate },
      status: { $in: ['completed', 'failed'] }
    }).lean();

    if (jobs.length === 0) {
      return {
        totalJobs: 0,
        averageDuration: 0,
        successRate: 0,
        averageSceneCount: 0
      };
    }

    const completed = jobs.filter(j => j.status === 'completed');
    const failed = jobs.filter(j => j.status === 'failed');

    const durations = completed
      .filter(j => j.duration)
      .map(j => j.duration);

    const sceneCounts = completed
      .filter(j => j.sceneCount)
      .map(j => j.sceneCount);

    return {
      totalJobs: jobs.length,
      completedJobs: completed.length,
      failedJobs: failed.length,
      successRate: completed.length / jobs.length,
      averageDuration: durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0,
      minDuration: durations.length > 0 ? Math.min(...durations) : 0,
      maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
      averageSceneCount: sceneCounts.length > 0
        ? sceneCounts.reduce((a, b) => a + b, 0) / sceneCounts.length
        : 0,
      totalScenesDetected: sceneCounts.reduce((a, b) => a + b, 0, 0)
    };
  } catch (error) {
    logger.error('Error getting performance metrics', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Get performance trends over time
 */
async function getPerformanceTrends(workspaceId, days = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const jobs = await SceneDetectionJob.find({
      workspaceId,
      createdAt: { $gte: startDate },
      status: 'completed'
    })
      .sort({ createdAt: 1 })
      .lean();

    // Group by day
    const dailyMetrics = {};
    
    jobs.forEach(job => {
      const date = job.createdAt.toISOString().split('T')[0];
      
      if (!dailyMetrics[date]) {
        dailyMetrics[date] = {
          date,
          count: 0,
          totalDuration: 0,
          totalScenes: 0
        };
      }

      dailyMetrics[date].count++;
      if (job.duration) {
        dailyMetrics[date].totalDuration += job.duration;
      }
      if (job.sceneCount) {
        dailyMetrics[date].totalScenes += job.sceneCount;
      }
    });

    // Calculate averages
    const trends = Object.values(dailyMetrics).map(day => ({
      date: day.date,
      jobCount: day.count,
      averageDuration: day.count > 0 ? day.totalDuration / day.count : 0,
      averageSceneCount: day.count > 0 ? day.totalScenes / day.count : 0
    }));

    return trends;
  } catch (error) {
    logger.error('Error getting performance trends', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Detect performance issues
 */
async function detectPerformanceIssues(workspaceId) {
  try {
    const metrics = await getPerformanceMetrics(workspaceId, 7);
    const issues = [];

    // Check success rate
    if (metrics.successRate < 0.9) {
      issues.push({
        type: 'low_success_rate',
        severity: 'high',
        message: `Success rate is ${(metrics.successRate * 100).toFixed(1)}% (target: 90%+)`,
        value: metrics.successRate
      });
    }

    // Check average duration
    if (metrics.averageDuration > 300) { // 5 minutes
      issues.push({
        type: 'slow_processing',
        severity: 'medium',
        message: `Average processing time is ${(metrics.averageDuration / 60).toFixed(1)} minutes`,
        value: metrics.averageDuration
      });
    }

    // Check for recent failures
    if (metrics.failedJobs > 0) {
      const recentFailures = await SceneDetectionJob.find({
        workspaceId,
        status: 'failed',
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      }).countDocuments();

      if (recentFailures > 0) {
        issues.push({
          type: 'recent_failures',
          severity: 'high',
          message: `${recentFailures} job(s) failed in the last 24 hours`,
          value: recentFailures
        });
      }
    }

    return {
      hasIssues: issues.length > 0,
      issues
    };
  } catch (error) {
    logger.error('Error detecting performance issues', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Get cost estimates
 */
async function getCostEstimates(workspaceId, days = 30) {
  try {
    const metrics = await getPerformanceMetrics(workspaceId, days);
    
    // Estimate costs based on:
    // - Multi-modal detection: $0.01 per minute
    // - Audio analysis: $0.005 per minute
    // - Text segmentation: $0.01 per minute (Whisper API)
    
    const { getWorkspaceSettings } = require('./workspaceSceneSettingsService');
    const settings = await getWorkspaceSettings(workspaceId);

    let costPerMinute = 0;
    if (settings.enableMultiModal && !settings.disableHeavyAIAnalysis) {
      costPerMinute += 0.01;
    }
    if (settings.enableAudioAnalysis) {
      costPerMinute += 0.005;
    }
    if (settings.enableTextSegmentation) {
      costPerMinute += 0.01;
    }

    // Estimate total video minutes processed
    const SceneDetectionAnalytics = require('../models/SceneDetectionAnalytics');
    const analytics = await SceneDetectionAnalytics.find({
      workspaceId,
      createdAt: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) }
    }).lean();

    const totalVideoMinutes = analytics.reduce((sum, a) => {
      // Estimate video duration from scene data
      const estimatedDuration = a.averageSceneLength * a.sceneCount;
      return sum + (estimatedDuration / 60); // Convert to minutes
    }, 0);

    const estimatedCost = totalVideoMinutes * costPerMinute;

    return {
      costPerMinute,
      totalVideoMinutes,
      estimatedCost,
      jobsProcessed: metrics.totalJobs,
      averageCostPerJob: metrics.totalJobs > 0 ? estimatedCost / metrics.totalJobs : 0
    };
  } catch (error) {
    logger.error('Error getting cost estimates', { error: error.message, workspaceId });
    throw error;
  }
}

module.exports = {
  getPerformanceMetrics,
  getPerformanceTrends,
  detectPerformanceIssues,
  getCostEstimates
};







