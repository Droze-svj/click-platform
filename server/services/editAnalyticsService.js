// Edit Analytics Service
// Track edit session analytics, feature usage, performance metrics

const logger = require('../utils/logger');
const UserPreferences = require('../models/UserPreferences');

/**
 * Track edit session
 */
async function trackEditSession(userId, sessionData) {
  try {
    let preferences = await UserPreferences.findOne({ userId });
    if (!preferences) {
      preferences = new UserPreferences({ userId, editAnalytics: { sessions: [] } });
    }

    if (!preferences.editAnalytics) {
      preferences.editAnalytics = { sessions: [] };
    }

    if (!preferences.editAnalytics.sessions) {
      preferences.editAnalytics.sessions = [];
    }

    const session = {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...sessionData,
      startedAt: sessionData.startedAt || new Date().toISOString(),
      endedAt: sessionData.endedAt || new Date().toISOString()
    };

    preferences.editAnalytics.sessions.push(session);

    // Keep last 100 sessions
    if (preferences.editAnalytics.sessions.length > 100) {
      preferences.editAnalytics.sessions.shift();
    }

    await preferences.save();

    logger.info('Edit session tracked', { userId, sessionId: session.id });
    return { success: true, sessionId: session.id };
  } catch (error) {
    logger.error('Track edit session error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Track feature usage
 */
async function trackFeatureUsage(userId, feature, usageData) {
  try {
    let preferences = await UserPreferences.findOne({ userId });
    if (!preferences) {
      preferences = new UserPreferences({ userId, editAnalytics: { featureUsage: {} } });
    }

    if (!preferences.editAnalytics) {
      preferences.editAnalytics = { featureUsage: {} };
    }

    if (!preferences.editAnalytics.featureUsage) {
      preferences.editAnalytics.featureUsage = {};
    }

    if (!preferences.editAnalytics.featureUsage[feature]) {
      preferences.editAnalytics.featureUsage[feature] = {
        count: 0,
        totalTime: 0,
        lastUsed: null
      };
    }

    const featureData = preferences.editAnalytics.featureUsage[feature];
    featureData.count = (featureData.count || 0) + 1;
    featureData.totalTime = (featureData.totalTime || 0) + (usageData.duration || 0);
    featureData.lastUsed = new Date().toISOString();

    await preferences.save();

    logger.info('Feature usage tracked', { userId, feature, count: featureData.count });
    return { success: true };
  } catch (error) {
    logger.error('Track feature usage error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get edit analytics
 */
async function getEditAnalytics(userId, period = '30d') {
  try {
    const preferences = await UserPreferences.findOne({ userId });
    
    if (!preferences || !preferences.editAnalytics) {
      return {
        sessions: [],
        featureUsage: {},
        totalTime: 0,
        mostUsedFeatures: []
      };
    }

    const analytics = preferences.editAnalytics;
    const now = new Date();
    const periodMs = period === '7d' ? 7 * 24 * 60 * 60 * 1000 :
                     period === '30d' ? 30 * 24 * 60 * 60 * 1000 :
                     90 * 24 * 60 * 60 * 1000;

    // Filter sessions by period
    const recentSessions = (analytics.sessions || []).filter(session => {
      const sessionDate = new Date(session.startedAt);
      return (now - sessionDate) <= periodMs;
    });

    // Calculate total time
    const totalTime = recentSessions.reduce((sum, session) => {
      const start = new Date(session.startedAt);
      const end = new Date(session.endedAt || now);
      return sum + (end - start);
    }, 0);

    // Get most used features
    const featureUsage = analytics.featureUsage || {};
    const mostUsedFeatures = Object.entries(featureUsage)
      .map(([feature, data]) => ({
        feature,
        count: data.count || 0,
        totalTime: data.totalTime || 0,
        lastUsed: data.lastUsed
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      sessions: recentSessions,
      featureUsage,
      totalTime: totalTime / 1000 / 60, // Convert to minutes
      mostUsedFeatures,
      sessionCount: recentSessions.length,
      averageSessionTime: recentSessions.length > 0 ? (totalTime / recentSessions.length) / 1000 / 60 : 0
    };
  } catch (error) {
    logger.error('Get edit analytics error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get performance metrics
 */
async function getPerformanceMetrics(userId) {
  try {
    const preferences = await UserPreferences.findOne({ userId });
    
    if (!preferences || !preferences.editAnalytics) {
      return {
        averageRenderTime: 0,
        averageExportTime: 0,
        cacheHitRate: 0,
        errorRate: 0
      };
    }

    const analytics = preferences.editAnalytics;
    const sessions = analytics.sessions || [];

    // Calculate metrics
    const renderTimes = sessions
      .filter(s => s.renderTime)
      .map(s => s.renderTime);
    
    const exportTimes = sessions
      .filter(s => s.exportTime)
      .map(s => s.exportTime);

    const errors = sessions.filter(s => s.errors && s.errors.length > 0).length;

    return {
      averageRenderTime: renderTimes.length > 0 
        ? renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length 
        : 0,
      averageExportTime: exportTimes.length > 0
        ? exportTimes.reduce((a, b) => a + b, 0) / exportTimes.length
        : 0,
      cacheHitRate: analytics.cacheHitRate || 0,
      errorRate: sessions.length > 0 ? (errors / sessions.length) * 100 : 0,
      totalSessions: sessions.length
    };
  } catch (error) {
    logger.error('Get performance metrics error', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  trackEditSession,
  trackFeatureUsage,
  getEditAnalytics,
  getPerformanceMetrics,
};
