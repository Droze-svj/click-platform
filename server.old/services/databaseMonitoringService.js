// Database Query Monitoring Service

const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { trackApiCall } = require('./performanceMonitoringService');

// Track slow queries
const slowQueries = [];
const queryStats = {
  total: 0,
  slow: 0,
  errors: 0,
  byModel: {},
  byOperation: {},
};

/**
 * Monitor database queries
 */
function setupDatabaseMonitoring() {
  // Monitor all queries
  mongoose.set('debug', (collectionName, method, query, doc) => {
    const startTime = Date.now();
    
    // Track query
    queryStats.total++;
    
    // Track by model
    queryStats.byModel[collectionName] = (queryStats.byModel[collectionName] || 0) + 1;
    
    // Track by operation
    queryStats.byOperation[method] = (queryStats.byOperation[method] || 0) + 1;

    // Log slow queries
    process.nextTick(() => {
      const duration = Date.now() - startTime;
      
      if (duration > 100) { // Queries > 100ms
        const queryInfo = {
          collection: collectionName,
          method,
          query: JSON.stringify(query),
          duration,
          timestamp: new Date(),
        };

        slowQueries.push(queryInfo);
        
        // Keep only last 100 slow queries
        if (slowQueries.length > 100) {
          slowQueries.shift();
        }

        if (duration > 1000) {
          queryStats.slow++;
          logger.warn('Slow database query detected', queryInfo);
        }
      }
    });
  });

  // Monitor connection events
  mongoose.connection.on('error', (error) => {
    queryStats.errors++;
    logger.error('Database connection error', { error: error.message });
  });

  logger.info('Database monitoring enabled');
}

/**
 * Get database query statistics
 */
function getQueryStats() {
  return {
    ...queryStats,
    slowQueries: slowQueries.slice(-20), // Last 20 slow queries
    averageQueryTime: queryStats.total > 0 
      ? slowQueries.reduce((sum, q) => sum + q.duration, 0) / slowQueries.length 
      : 0,
  };
}

/**
 * Get slow queries
 */
function getSlowQueries(limit = 20) {
  return slowQueries
    .sort((a, b) => b.duration - a.duration)
    .slice(0, limit);
}

/**
 * Get queries by model
 */
function getQueriesByModel() {
  return queryStats.byModel;
}

/**
 * Get queries by operation
 */
function getQueriesByOperation() {
  return queryStats.byOperation;
}

/**
 * Reset statistics
 */
function resetStats() {
  queryStats.total = 0;
  queryStats.slow = 0;
  queryStats.errors = 0;
  queryStats.byModel = {};
  queryStats.byOperation = {};
  slowQueries.length = 0;
  logger.info('Database query statistics reset');
}

module.exports = {
  setupDatabaseMonitoring,
  getQueryStats,
  getSlowQueries,
  getQueriesByModel,
  getQueriesByOperation,
  resetStats,
};




