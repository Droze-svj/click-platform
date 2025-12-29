// Scene Detection Cache Service
// Caches scene detection results to avoid re-processing

const Scene = require('../models/Scene');
const logger = require('../utils/logger');

// In-memory cache for frequently accessed results
const memoryCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached scene detection result
 */
async function getCachedResult(contentId, parameters) {
  try {
    // Check memory cache first
    const cacheKey = getCacheKey(contentId, parameters);
    const cached = memoryCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      logger.debug('Scene detection cache hit (memory)', { contentId });
      return cached.data;
    }

    // Check database cache (scenes with matching parameters)
    const scenes = await Scene.find({ contentId }).sort({ sceneIndex: 1 }).lean();
    
    if (scenes.length === 0) {
      return null;
    }

    // Check if parameters match
    const firstScene = scenes[0];
    if (parametersMatch(firstScene.detectionParams || {}, parameters)) {
      logger.debug('Scene detection cache hit (database)', { contentId });
      
      // Store in memory cache
      memoryCache.set(cacheKey, {
        data: scenes,
        timestamp: Date.now()
      });

      return scenes;
    }

    return null;
  } catch (error) {
    logger.warn('Error getting cached result', { error: error.message, contentId });
    return null;
  }
}

/**
 * Store scene detection result in cache
 */
function storeCachedResult(contentId, parameters, scenes) {
  try {
    const cacheKey = getCacheKey(contentId, parameters);
    memoryCache.set(cacheKey, {
      data: scenes,
      timestamp: Date.now()
    });

    // Limit cache size (keep last 100 entries)
    if (memoryCache.size > 100) {
      const firstKey = memoryCache.keys().next().value;
      memoryCache.delete(firstKey);
    }
  } catch (error) {
    logger.warn('Error storing cached result', { error: error.message });
  }
}

/**
 * Invalidate cache for content
 */
function invalidateCache(contentId) {
  try {
    const keysToDelete = [];
    for (const key of memoryCache.keys()) {
      if (key.startsWith(`${contentId}:`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => memoryCache.delete(key));
    logger.debug('Cache invalidated', { contentId, count: keysToDelete.length });
  } catch (error) {
    logger.warn('Error invalidating cache', { error: error.message });
  }
}

/**
 * Get cache key
 */
function getCacheKey(contentId, parameters) {
  const paramString = JSON.stringify({
    sensitivity: parameters.sensitivity || 0.3,
    minSceneLength: parameters.minSceneLength || 1.0,
    maxSceneLength: parameters.maxSceneLength || null,
    fps: parameters.fps || 3,
    useMultiModal: parameters.useMultiModal !== false,
    workflowType: parameters.workflowType || 'general'
  });
  return `${contentId}:${paramString}`;
}

/**
 * Check if parameters match
 */
function parametersMatch(params1, params2) {
  const keys = ['sensitivity', 'minSceneLength', 'maxSceneLength', 'fps', 'useMultiModal', 'workflowType'];
  
  for (const key of keys) {
    const val1 = params1[key];
    const val2 = params2[key] !== undefined ? params2[key] : getDefault(key);
    
    if (val1 !== val2) {
      return false;
    }
  }
  
  return true;
}

/**
 * Get default parameter value
 */
function getDefault(key) {
  const defaults = {
    sensitivity: 0.3,
    minSceneLength: 1.0,
    maxSceneLength: null,
    fps: 3,
    useMultiModal: true,
    workflowType: 'general'
  };
  return defaults[key];
}

/**
 * Clear all cache
 */
function clearCache() {
  memoryCache.clear();
  logger.info('Scene detection cache cleared');
}

module.exports = {
  getCachedResult,
  storeCachedResult,
  invalidateCache,
  clearCache
};







