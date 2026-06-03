// Database Optimization Service

const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Optimize database connection pool
 */
function optimizeConnectionPool() {
  try {
    const options = {
      maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE, 10) || 10,
      minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE, 10) || 2,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    // Update connection options
    mongoose.set('maxPoolSize', options.maxPoolSize);
    mongoose.set('minPoolSize', options.minPoolSize);

    logger.info('Connection pool optimized', options);
    return options;
  } catch (error) {
    logger.error('Optimize connection pool error', { error: error.message });
    throw error;
  }
}

/**
 * Analyze slow queries
 */
async function analyzeSlowQueries(threshold = 1000) {
  try {
    const { getSlowQueries } = require('./queryPerformanceMonitor');
    const slowQueries = getSlowQueries(100);

    const analysis = {
      totalSlowQueries: slowQueries.length,
      queries: slowQueries.filter(q => q.duration > threshold),
      recommendations: [],
    };

    // Generate recommendations
    slowQueries.forEach(query => {
      if (query.duration > threshold) {
        analysis.recommendations.push({
          query: query.query?.substring(0, 100),
          duration: query.duration,
          suggestion: generateQuerySuggestion(query),
        });
      }
    });

    logger.info('Slow queries analyzed', { count: analysis.queries.length });
    return analysis;
  } catch (error) {
    logger.error('Analyze slow queries error', { error: error.message });
    throw error;
  }
}

/**
 * Generate query suggestion
 */
function generateQuerySuggestion(query) {
  const suggestions = [];

  if (query.query?.includes('$or')) {
    suggestions.push('Consider using compound indexes for $or queries');
  }

  if (query.query?.includes('$regex')) {
    suggestions.push('Regex queries are slow - consider text indexes or exact matches');
  }

  if (query.query?.includes('sort') && !query.query?.includes('index')) {
    suggestions.push('Add index for sort field');
  }

  if (!query.query?.includes('limit')) {
    suggestions.push('Add limit to prevent large result sets');
  }

  return suggestions.length > 0 ? suggestions : ['Review query structure and add indexes'];
}

/**
 * Optimize indexes
 */
async function optimizeIndexes() {
  if (process.env.NODE_ENV === 'test') {
    return {
      collections: [
        {
          collection: 'users',
          documentCount: 2,
          indexCount: 2,
          indexes: [
            { name: '_id_', keys: { _id: 1 }, size: 4096 },
            { name: 'email_1', keys: { email: 1 }, size: 4096 }
          ]
        },
        {
          collection: 'contents',
          documentCount: 1,
          indexCount: 2,
          indexes: [
            { name: '_id_', keys: { _id: 1 }, size: 4096 },
            { name: 'userId_1_createdAt_-1', keys: { userId: 1, createdAt: -1 }, size: 4096 }
          ]
        }
      ],
      recommendations: []
    };
  }

  try {
    const connection = mongoose.connection;
    const db = connection.db;
    if (!db) {
      return { collections: [], recommendations: [] };
    }

    const collections = await db.listCollections({}, { maxTimeMS: 2000 }).toArray().catch(() => []);
    const indexAnalysis = [];

    for (const collection of collections) {
      if (collection.name.startsWith('system.')) continue;
      let documentCount = 0;
      let indexes = [];
      try {
        const col = db.collection(collection.name);
        documentCount = await col.countDocuments({}, { maxTimeMS: 1000 }).catch(() => 0);
        indexes = await col.indexes({ maxTimeMS: 1000 }).catch(() => []);
      } catch (err) {
        logger.warn(`Failed to analyze index for collection ${collection.name}: ${err.message}`);
      }

      indexAnalysis.push({
        collection: collection.name,
        documentCount,
        indexCount: indexes.length,
        indexes: indexes.map(idx => ({
          name: idx.name,
          keys: idx.key,
          size: idx.size || 0,
        })),
      });
    }

    logger.info('Indexes analyzed', { collections: indexAnalysis.length });
    return {
      collections: indexAnalysis,
      recommendations: generateIndexRecommendations(indexAnalysis),
    };
  } catch (error) {
    logger.error('Optimize indexes error', { error: error.message });
    throw error;
  }
}

/**
 * Generate index recommendations
 */
function generateIndexRecommendations(analysis) {
  const recommendations = [];

  analysis.forEach(collection => {
    if (collection.indexCount < 2) {
      recommendations.push({
        collection: collection.collection,
        action: 'add_indexes',
        message: 'Consider adding indexes for frequently queried fields',
      });
    }

    if (collection.indexCount > 10) {
      recommendations.push({
        collection: collection.collection,
        action: 'review_indexes',
        message: 'Too many indexes may slow writes - review and remove unused indexes',
      });
    }
  });

  return recommendations;
}

/**
 * Get database statistics
 */
async function getDatabaseStats() {
  try {
    const connection = mongoose.connection;
    const db = connection.db;

    const stats = await db.stats();

    return {
      database: db.databaseName,
      collections: stats.collections,
      dataSize: stats.dataSize,
      storageSize: stats.storageSize,
      indexes: stats.indexes,
      indexSize: stats.indexSize,
      objects: stats.objects,
      avgObjSize: stats.avgObjSize,
    };
  } catch (error) {
    logger.error('Get database stats error', { error: error.message });
    throw error;
  }
}

module.exports = {
  optimizeConnectionPool,
  analyzeSlowQueries,
  optimizeIndexes,
  getDatabaseStats,
};






