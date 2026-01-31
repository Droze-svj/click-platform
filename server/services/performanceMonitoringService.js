// Performance Monitoring Service
// Tracks API performance, database queries, cache hit rates, and system metrics

const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');
const { getStats } = require('./cacheService');
const os = require('os');

// In-memory metrics storage
const metrics = {
  api: {
    requests: 0,
    errors: 0,
    totalResponseTime: 0,
    endpoints: new Map(), // endpoint -> { count, totalTime, errors }
  },
  database: {
    queries: 0,
    slowQueries: 0,
    totalQueryTime: 0,
    queryTypes: new Map(), // type -> { count, totalTime }
  },
  cache: {
    hits: 0,
    misses: 0,
    sets: 0,
    errors: 0,
  },
  jobs: {
    completed: 0,
    failed: 0,
    totalProcessingTime: 0,
    queueLengths: new Map(), // queueName -> length
  },
  system: {
    memoryUsage: [],
    cpuUsage: [],
    uptime: Date.now(),
  },
};

/**
 * Track API request performance
 */
function trackAPIRequest(endpoint, method, responseTime, statusCode) {
  try {
    metrics.api.requests++;
    metrics.api.totalResponseTime += responseTime;

    if (statusCode >= 400) {
      metrics.api.errors++;
    }

    const key = `${method} ${endpoint}`;
    if (!metrics.api.endpoints.has(key)) {
      metrics.api.endpoints.set(key, { count: 0, totalTime: 0, errors: 0 });
    }

    const endpointMetrics = metrics.api.endpoints.get(key);
    endpointMetrics.count++;
    endpointMetrics.totalTime += responseTime;
    if (statusCode >= 400) {
      endpointMetrics.errors++;
    }

    // Track slow requests (>1 second)
    if (responseTime > 1000) {
      logger.warn('Slow API request', { endpoint, method, responseTime, statusCode });
    }
  } catch (error) {
    logger.error('Error tracking API request', { error: error.message });
  }
}

/**
 * Track database query performance
 */
function trackDatabaseQuery(queryType, queryTime, isSlow = false) {
  try {
    metrics.database.queries++;
    metrics.database.totalQueryTime += queryTime;

    if (isSlow || queryTime > 100) {
      metrics.database.slowQueries++;
      logger.warn('Slow database query', { queryType, queryTime });
    }

    if (!metrics.database.queryTypes.has(queryType)) {
      metrics.database.queryTypes.set(queryType, { count: 0, totalTime: 0 });
    }

    const typeMetrics = metrics.database.queryTypes.get(queryType);
    typeMetrics.count++;
    typeMetrics.totalTime += queryTime;
  } catch (error) {
    logger.error('Error tracking database query', { error: error.message });
  }
}

/**
 * Track cache operations
 */
function trackCacheOperation(operation, hit = false) {
  try {
    switch (operation) {
      case 'hit':
        metrics.cache.hits++;
        break;
      case 'miss':
        metrics.cache.misses++;
        break;
      case 'set':
        metrics.cache.sets++;
        break;
      case 'error':
        metrics.cache.errors++;
        break;
    }
  } catch (error) {
    logger.error('Error tracking cache operation', { error: error.message });
  }
}

/**
 * Track job performance
 */
function trackJob(queueName, processingTime, success = true) {
  try {
    if (success) {
      metrics.jobs.completed++;
    } else {
      metrics.jobs.failed++;
    }
    metrics.jobs.totalProcessingTime += processingTime;
  } catch (error) {
    logger.error('Error tracking job', { error: error.message });
  }
}

/**
 * Update queue length
 */
function updateQueueLength(queueName, length) {
  try {
    metrics.jobs.queueLengths.set(queueName, length);
  } catch (error) {
    logger.error('Error updating queue length', { error: error.message });
  }
}

/**
 * Collect system metrics
 */
function collectSystemMetrics() {
  try {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const loadAvg = os.loadavg();

    metrics.system.memoryUsage.push({
      timestamp: Date.now(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      rss: memUsage.rss,
      external: memUsage.external,
    });

    metrics.system.cpuUsage.push({
      timestamp: Date.now(),
      user: cpuUsage.user,
      system: cpuUsage.system,
      loadAvg: loadAvg[0], // 1-minute load average
    });

    // Keep last 100 data points
    if (metrics.system.memoryUsage.length > 100) {
      metrics.system.memoryUsage.shift();
    }
    if (metrics.system.cpuUsage.length > 100) {
      metrics.system.cpuUsage.shift();
    }
  } catch (error) {
    logger.error('Error collecting system metrics', { error: error.message });
  }
}

/**
 * Get performance metrics
 */
function getMetrics() {
  try {
    const apiAvgResponseTime =
      metrics.api.requests > 0
        ? metrics.api.totalResponseTime / metrics.api.requests
        : 0;

    const dbAvgQueryTime =
      metrics.database.queries > 0
        ? metrics.database.totalQueryTime / metrics.database.queries
        : 0;

    const cacheHitRate =
      metrics.cache.hits + metrics.cache.misses > 0
        ? (metrics.cache.hits / (metrics.cache.hits + metrics.cache.misses)) * 100
        : 0;

    const jobAvgTime =
      metrics.jobs.completed > 0
        ? metrics.jobs.totalProcessingTime / metrics.jobs.completed
        : 0;

    const errorRate =
      metrics.api.requests > 0
        ? (metrics.api.errors / metrics.api.requests) * 100
        : 0;

    // Get top slow endpoints
    const slowEndpoints = Array.from(metrics.api.endpoints.entries())
      .map(([endpoint, data]) => ({
        endpoint,
        avgTime: data.count > 0 ? data.totalTime / data.count : 0,
        count: data.count,
        errors: data.errors,
        errorRate: data.count > 0 ? (data.errors / data.count) * 100 : 0,
      }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 10);

    // Get top slow queries
    const slowQueries = Array.from(metrics.database.queryTypes.entries())
      .map(([type, data]) => ({
        type,
        avgTime: data.count > 0 ? data.totalTime / data.count : 0,
        count: data.count,
      }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 10);

    // Current system state
    const memUsage = process.memoryUsage();
    const loadAvg = os.loadavg();
    const uptime = Date.now() - metrics.system.uptime;

    return {
      api: {
        totalRequests: metrics.api.requests,
        totalErrors: metrics.api.errors,
        errorRate: errorRate.toFixed(2) + '%',
        avgResponseTime: Math.round(apiAvgResponseTime) + 'ms',
        slowEndpoints,
      },
      database: {
        totalQueries: metrics.database.queries,
        slowQueries: metrics.database.slowQueries,
        avgQueryTime: Math.round(dbAvgQueryTime) + 'ms',
        slowQueries: slowQueries,
      },
      cache: {
        hits: metrics.cache.hits,
        misses: metrics.cache.misses,
        sets: metrics.cache.sets,
        errors: metrics.cache.errors,
        hitRate: cacheHitRate.toFixed(2) + '%',
      },
      jobs: {
        completed: metrics.jobs.completed,
        failed: metrics.jobs.failed,
        avgProcessingTime: Math.round(jobAvgTime) + 'ms',
        queueLengths: Object.fromEntries(metrics.jobs.queueLengths),
      },
      system: {
        memory: {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
          rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
        },
        cpu: {
          loadAvg: loadAvg[0].toFixed(2),
        },
        uptime: Math.round(uptime / 1000 / 60) + ' minutes',
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Error getting metrics', { error: error.message });
    return null;
  }
}

/**
 * Reset metrics (for testing or periodic reset)
 */
function resetMetrics() {
  try {
    metrics.api.requests = 0;
    metrics.api.errors = 0;
    metrics.api.totalResponseTime = 0;
    metrics.api.endpoints.clear();

    metrics.database.queries = 0;
    metrics.database.slowQueries = 0;
    metrics.database.totalQueryTime = 0;
    metrics.database.queryTypes.clear();

    metrics.cache.hits = 0;
    metrics.cache.misses = 0;
    metrics.cache.sets = 0;
    metrics.cache.errors = 0;

    metrics.jobs.completed = 0;
    metrics.jobs.failed = 0;
    metrics.jobs.totalProcessingTime = 0;
    metrics.jobs.queueLengths.clear();

    logger.info('Performance metrics reset');
  } catch (error) {
    logger.error('Error resetting metrics', { error: error.message });
  }
}

// Collect system metrics every 30 seconds
setInterval(collectSystemMetrics, 30000);

// Initial collection
collectSystemMetrics();

module.exports = {
  trackAPIRequest,
  trackDatabaseQuery,
  trackCacheOperation,
  trackJob,
  updateQueueLength,
  getMetrics,
  resetMetrics,
  collectSystemMetrics,
};
