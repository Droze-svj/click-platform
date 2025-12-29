// Database query performance monitoring

const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { recordDatabaseQuery } = require('./monitoringService');
const { captureException } = require('../utils/sentry');

// Track slow queries
const slowQueries = [];
const SLOW_QUERY_THRESHOLD = 100; // milliseconds

/**
 * Initialize query performance monitoring
 */
function initQueryMonitoring() {
  // Monitor all queries
  mongoose.set('debug', (collectionName, method, query, doc) => {
    const startTime = Date.now();
    
    // Log slow queries
    const originalExec = mongoose.Query.prototype.exec;
    mongoose.Query.prototype.exec = function(...args) {
      const queryStart = Date.now();
      
      return originalExec.apply(this, args).then(result => {
        const duration = Date.now() - queryStart;
        
        if (duration > SLOW_QUERY_THRESHOLD) {
          // Record in monitoring service
          const queryString = JSON.stringify(query || {});
          recordDatabaseQuery(queryString, duration);

      logger.warn('Slow query detected', {
            collection: collectionName,
            method,
            duration,
            query: JSON.stringify(query),
          });

          slowQueries.push({
            collection: collectionName,
            method,
            query: JSON.stringify(query),
            duration,
            timestamp: new Date(),
          });

          // Keep only last 100 slow queries
          if (slowQueries.length > 100) {
            slowQueries.shift();
          }

          // Alert on very slow queries
          if (duration > 1000) {
            captureException(new Error('Very slow query detected'), {
              tags: { collection: collectionName, method },
              extra: { duration, query: JSON.stringify(query) },
            });
          }
        }

        return result;
      });
    };
  });

  logger.info('Query performance monitoring initialized');
}

/**
 * Get slow queries
 */
function getSlowQueries(limit = 50) {
  return slowQueries
    .sort((a, b) => b.duration - a.duration)
    .slice(0, limit);
}

/**
 * Get query statistics
 */
function getQueryStats() {
  const total = slowQueries.length;
  const avgDuration = total > 0
    ? slowQueries.reduce((sum, q) => sum + q.duration, 0) / total
    : 0;
  const maxDuration = total > 0
    ? Math.max(...slowQueries.map(q => q.duration))
    : 0;

  const byCollection = {};
  slowQueries.forEach(query => {
    if (!byCollection[query.collection]) {
      byCollection[query.collection] = { count: 0, totalDuration: 0 };
    }
    byCollection[query.collection].count++;
    byCollection[query.collection].totalDuration += query.duration;
  });

  return {
    total,
    avgDuration: Math.round(avgDuration),
    maxDuration,
    byCollection: Object.fromEntries(
      Object.entries(byCollection).map(([collection, stats]) => [
        collection,
        {
          count: stats.count,
          avgDuration: Math.round(stats.totalDuration / stats.count),
        },
      ])
    ),
  };
}

/**
 * Clear slow queries log
 */
function clearSlowQueries() {
  slowQueries.length = 0;
  logger.info('Slow queries log cleared');
}

module.exports = {
  initQueryMonitoring,
  getSlowQueries,
  getQueryStats,
  clearSlowQueries,
};

