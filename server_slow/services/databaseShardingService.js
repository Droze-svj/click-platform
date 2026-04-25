// Database Sharding & Replication Service

const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Shard configuration
const shardConfig = {
  enabled: process.env.DATABASE_SHARDING === 'true',
  shards: [],
  replicaSet: process.env.MONGODB_REPLICA_SET || null,
};

/**
 * Initialize database sharding
 */
async function initSharding() {
  try {
    if (!shardConfig.enabled) {
      logger.info('Database sharding disabled');
      return;
    }

    // In production, configure MongoDB sharding
    // This is a simplified version for setup
    
    const shardHosts = process.env.MONGODB_SHARD_HOSTS?.split(',') || [];
    
    if (shardHosts.length > 0) {
      shardConfig.shards = shardHosts.map((host, index) => ({
        id: `shard${index}`,
        host,
      }));

      logger.info('Database sharding initialized', {
        shardCount: shardConfig.shards.length,
      });
    }

    // Configure replica set if specified
    if (shardConfig.replicaSet) {
      logger.info('Replica set configured', {
        replicaSet: shardConfig.replicaSet,
      });
    }
  } catch (error) {
    logger.error('Init sharding error', { error: error.message });
    throw error;
  }
}

/**
 * Get shard for user
 */
function getShardForUser(userId) {
  if (!shardConfig.enabled || shardConfig.shards.length === 0) {
    return null; // No sharding
  }

  // Simple hash-based sharding
  const hash = simpleHash(userId.toString());
  const shardIndex = hash % shardConfig.shards.length;
  return shardConfig.shards[shardIndex];
}

/**
 * Get shard for content
 */
function getShardForContent(contentId) {
  if (!shardConfig.enabled || shardConfig.shards.length === 0) {
    return null;
  }

  const hash = simpleHash(contentId.toString());
  const shardIndex = hash % shardConfig.shards.length;
  return shardConfig.shards[shardIndex];
}

/**
 * Simple hash function
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Get read preference
 */
function getReadPreference() {
  if (shardConfig.replicaSet) {
    // Use secondary for read operations (read scaling)
    return {
      readPreference: 'secondaryPreferred',
    };
  }
  return {};
}

/**
 * Get write concern
 */
function getWriteConcern() {
  if (shardConfig.replicaSet) {
    // Require majority write concern for durability
    return {
      w: 'majority',
      j: true, // Journal write
    };
  }
  return {};
}

/**
 * Check database health
 */
async function checkDatabaseHealth() {
  try {
    const connection = mongoose.connection;

    if (connection.readyState !== 1) {
      return {
        healthy: false,
        status: 'disconnected',
        message: 'Database not connected',
      };
    }

    // Check replica set status if configured
    if (shardConfig.replicaSet) {
      const admin = connection.db.admin();
      const status = await admin.command({ replSetGetStatus: 1 });

      return {
        healthy: true,
        status: 'connected',
        replicaSet: {
          name: status.set,
          members: status.members?.length || 0,
          primary: status.members?.find(m => m.stateStr === 'PRIMARY')?.name || null,
        },
      };
    }

    return {
      healthy: true,
      status: 'connected',
      sharding: shardConfig.enabled,
      shardCount: shardConfig.shards.length,
    };
  } catch (error) {
    logger.error('Check database health error', { error: error.message });
    return {
      healthy: false,
      status: 'error',
      error: error.message,
    };
  }
}

/**
 * Get sharding statistics
 */
function getShardingStats() {
  return {
    enabled: shardConfig.enabled,
    shardCount: shardConfig.shards.length,
    replicaSet: shardConfig.replicaSet,
    shards: shardConfig.shards.map(s => ({
      id: s.id,
      // Don't expose full host in stats
      configured: !!s.host,
    })),
  };
}

module.exports = {
  initSharding,
  getShardForUser,
  getShardForContent,
  getReadPreference,
  getWriteConcern,
  checkDatabaseHealth,
  getShardingStats,
};






