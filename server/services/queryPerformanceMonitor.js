// Database query performance monitoring

const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { recordDatabaseQuery } = require('./monitoringService');
const { captureException } = require('../utils/sentry');

// Track slow queries
const slowQueries = [];
const SLOW_QUERY_THRESHOLD = 100; // milliseconds

// Debug counters (do not log secrets)
let __agentExecWrapCount = 0;
let __monitoringInitialized = false;
let __execAlreadyWrapped = false;

/**
 * Initialize query performance monitoring
 */
function initQueryMonitoring() {
  // #region agent log
  // #endregion

  if (__monitoringInitialized) {
    // Avoid double-initializing in dev/hot-reload scenarios.
    // #region agent log
    // #endregion
    return;
  }
  __monitoringInitialized = true;

  // IMPORTANT: Wrap mongoose.Query.prototype.exec ONLY ONCE.
  // The previous implementation wrapped exec inside mongoose debug callback,
  // causing exec to be re-wrapped repeatedly and destroying performance.
  if (!__execAlreadyWrapped) {
    const originalExec = mongoose.Query.prototype.exec;
    mongoose.Query.prototype.exec = function(...args) {
      __agentExecWrapCount += 1;
      // #region agent log
      if (__agentExecWrapCount <= 3 || __agentExecWrapCount === 10) {
      }
      // #endregion

      const queryStart = Date.now();
      return originalExec.apply(this, args).then(result => {
        const duration = Date.now() - queryStart;

        if (duration > SLOW_QUERY_THRESHOLD) {
          const collectionName = String((this && this.mongooseCollection && this.mongooseCollection.name) || '');
          const method = String((this && this.op) || '');
          const queryObj = (this && typeof this.getQuery === 'function') ? this.getQuery() : {};
          const queryString = JSON.stringify(queryObj || {});

          // Record in monitoring service
          recordDatabaseQuery(queryString, duration);

          logger.warn('Slow query detected', {
            collection: collectionName,
            method,
            duration,
            query: queryString,
          });

          slowQueries.push({
            collection: collectionName,
            method,
            query: queryString,
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
              extra: { duration, query: queryString },
            });
          }
        }

        return result;
      });
    };
    __execAlreadyWrapped = true;
  }

  logger.info('Query performance monitoring initialized');

  // #region agent log
  // #endregion
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

