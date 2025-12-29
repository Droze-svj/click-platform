// Cache Warming Service

const { cacheAtEdge } = require('./cdnService');
const { getOrSet } = require('./cacheService');
const logger = require('../utils/logger');

/**
 * Warm cache for popular paths
 */
async function warmCache(paths, options = {}) {
  try {
    const {
      priority = 'normal',
      concurrency = 5,
    } = options;

    const results = {
      warmed: 0,
      failed: 0,
      errors: [],
    };

    // Process in batches
    for (let i = 0; i < paths.length; i += concurrency) {
      const batch = paths.slice(i, i + concurrency);
      
      await Promise.allSettled(
        batch.map(async (path) => {
          try {
            // In production, fetch the actual content
            // For now, just mark as warmed
            await cacheAtEdge(`path:${path}`, { warmed: true, timestamp: new Date() }, 3600);
            results.warmed++;
            logger.debug('Cache warmed', { path });
          } catch (error) {
            results.failed++;
            results.errors.push({ path, error: error.message });
            logger.error('Cache warm error', { path, error: error.message });
          }
        })
      );
    }

    logger.info('Cache warming completed', {
      total: paths.length,
      warmed: results.warmed,
      failed: results.failed,
    });

    return results;
  } catch (error) {
    logger.error('Warm cache error', { error: error.message });
    throw error;
  }
}

/**
 * Warm cache for popular content
 */
async function warmPopularContent(limit = 100) {
  try {
    const Content = require('../models/Content');
    
    // Get popular content
    const popularContent = await Content.find({ status: 'published' })
      .sort({ views: -1 })
      .limit(limit)
      .select('_id title')
      .lean();

    const paths = popularContent.map(content => `/api/content/${content._id}`);
    
    await warmCache(paths, { priority: 'high' });
    
    logger.info('Popular content cache warmed', { count: paths.length });
    return { warmed: paths.length };
  } catch (error) {
    logger.error('Warm popular content error', { error: error.message });
    throw error;
  }
}

/**
 * Warm cache for user dashboard
 */
async function warmUserDashboard(userId) {
  try {
    const paths = [
      `/api/dashboard/stats`,
      `/api/dashboard/recent`,
      `/api/dashboard/analytics`,
    ];

    await warmCache(paths.map(path => `${path}?userId=${userId}`), {
      priority: 'high',
    });

    logger.info('User dashboard cache warmed', { userId });
    return { warmed: paths.length };
  } catch (error) {
    logger.error('Warm user dashboard error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Schedule cache warming
 */
async function scheduleCacheWarming(schedule = '0 3 * * *') {
  try {
    const { scheduleRecurringJob } = require('./jobSchedulerService');

    await scheduleRecurringJob(
      'cache-warming',
      {
        type: 'popular-content',
        limit: 100,
      },
      schedule
    );

    logger.info('Cache warming scheduled', { schedule });
    return { success: true };
  } catch (error) {
    logger.error('Schedule cache warming error', { error: error.message });
    throw error;
  }
}

module.exports = {
  warmCache,
  warmPopularContent,
  warmUserDashboard,
  scheduleCacheWarming,
};
