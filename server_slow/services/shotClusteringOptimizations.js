// Performance Optimizations for Shot Clustering

const logger = require('../utils/logger');

/**
 * Parallel feature extraction
 */
async function extractFeaturesInParallel(shots, audioFeatures, batchSize = 10) {
  const { extractShotFeatures } = require('./shotClusteringService');
  
  // Process in batches for better memory management
  const batches = [];
  for (let i = 0; i < shots.length; i += batchSize) {
    batches.push(shots.slice(i, i + batchSize));
  }

  const allFeatures = [];
  
  for (const batch of batches) {
    // Extract features for batch
    const batchFeatures = extractShotFeatures(batch, audioFeatures);
    allFeatures.push(...batchFeatures);
  }

  return allFeatures;
}

/**
 * Cache similarity calculations
 */
class SimilarityCache {
  constructor() {
    this.cache = new Map();
    this.maxSize = 10000; // Limit cache size
  }

  getKey(shot1Index, shot2Index) {
    return shot1Index < shot2Index 
      ? `${shot1Index}_${shot2Index}`
      : `${shot2Index}_${shot1Index}`;
  }

  get(shot1Index, shot2Index) {
    const key = this.getKey(shot1Index, shot2Index);
    return this.cache.get(key);
  }

  set(shot1Index, shot2Index, similarity) {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entries (simple FIFO)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    const key = this.getKey(shot1Index, shot2Index);
    this.cache.set(key, similarity);
  }

  clear() {
    this.cache.clear();
  }
}

/**
 * Optimized similarity matrix calculation with caching
 */
function buildSimilarityMatrixOptimized(shotFeatures, visualWeight, audioWeight, cache = null) {
  const matrix = [];
  const similarityCache = cache || new SimilarityCache();
  const { calculateShotSimilarity } = require('./shotClusteringService');
  
  for (let i = 0; i < shotFeatures.length; i++) {
    matrix[i] = [];
    for (let j = 0; j < shotFeatures.length; j++) {
      if (i === j) {
        matrix[i][j] = 1.0;
      } else {
        // Check cache first
        let similarity = similarityCache.get(i, j);
        if (similarity === undefined) {
          similarity = calculateShotSimilarity(
            shotFeatures[i],
            shotFeatures[j],
            visualWeight,
            audioWeight
          );
          similarityCache.set(i, j, similarity);
        }
        matrix[i][j] = similarity;
      }
    }
  }

  return matrix;
}

/**
 * Incremental clustering for large datasets
 */
function clusterIncremental(shotFeatures, threshold, visualWeight, audioWeight, chunkSize = 50) {
  if (shotFeatures.length <= chunkSize) {
    // Small dataset, use standard clustering
    const { clusterBySimilarity } = require('./shotClusteringService');
    return clusterBySimilarity(shotFeatures, threshold, visualWeight, audioWeight);
  }

  // Process in chunks
  const chunks = [];
  for (let i = 0; i < shotFeatures.length; i += chunkSize) {
    chunks.push(shotFeatures.slice(i, i + chunkSize));
  }

  const clusters = [];
  const similarityCache = new SimilarityCache();

  chunks.forEach((chunk, chunkIndex) => {
    // Cluster within chunk
    const { clusterBySimilarity } = require('./shotClusteringService');
    const chunkClusters = clusterBySimilarity(chunk, threshold, visualWeight, audioWeight);

    // Merge with previous clusters if similar
    if (chunkIndex > 0 && clusters.length > 0) {
      const lastCluster = clusters[clusters.length - 1];
      const firstChunkShot = chunk[0];

      // Check similarity with last shot of previous cluster
      const { calculateShotSimilarity } = require('./shotClusteringService');
      const similarity = calculateShotSimilarity(
        lastCluster[lastCluster.length - 1],
        firstChunkShot,
        visualWeight,
        audioWeight
      );

      if (similarity >= (1 - threshold)) {
        // Merge clusters
        lastCluster.push(...chunkClusters[0] || []);
        clusters.push(...chunkClusters.slice(1));
      } else {
        clusters.push(...chunkClusters);
      }
    } else {
      clusters.push(...chunkClusters);
    }
  });

  return clusters;
}

/**
 * Pre-compute feature statistics for faster clustering
 */
function precomputeFeatureStatistics(shotFeatures) {
  const stats = {
    visual: {
      mean: {},
      std: {},
      min: {},
      max: {}
    },
    audio: {
      mean: {},
      std: {},
      min: {},
      max: {}
    }
  };

  if (shotFeatures.length === 0) return stats;

  // Visual statistics
  const visualKeys = Object.keys(shotFeatures[0].visual || {});
  visualKeys.forEach(key => {
    const values = shotFeatures.map(s => s.visual[key] || 0).filter(v => !isNaN(v));
    if (values.length > 0) {
      stats.visual.mean[key] = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, v) => {
        const diff = v - stats.visual.mean[key];
        return sum + diff * diff;
      }, 0) / values.length;
      stats.visual.std[key] = Math.sqrt(variance);
      stats.visual.min[key] = Math.min(...values);
      stats.visual.max[key] = Math.max(...values);
    }
  });

  // Audio statistics
  const audioKeys = Object.keys(shotFeatures[0].audio || {});
  audioKeys.forEach(key => {
    const values = shotFeatures.map(s => {
      const val = s.audio[key];
      if (typeof val === 'object' && val !== null) {
        return Object.values(val).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
      }
      return typeof val === 'number' ? val : 0;
    }).filter(v => !isNaN(v));

    if (values.length > 0) {
      stats.audio.mean[key] = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, v) => {
        const diff = v - stats.audio.mean[key];
        return sum + diff * diff;
      }, 0) / values.length;
      stats.audio.std[key] = Math.sqrt(variance);
      stats.audio.min[key] = Math.min(...values);
      stats.audio.max[key] = Math.max(...values);
    }
  });

  return stats;
}

/**
 * Normalize features using pre-computed statistics
 */
function normalizeFeaturesWithStats(shotFeatures, stats) {
  return shotFeatures.map(shot => {
    const normalized = {
      ...shot,
      visual: { ...shot.visual },
      audio: { ...shot.audio }
    };

    // Normalize visual features
    Object.keys(shot.visual || {}).forEach(key => {
      const mean = stats.visual.mean[key] || 0;
      const std = stats.visual.std[key] || 1;
      if (std > 0) {
        normalized.visual[key] = (shot.visual[key] - mean) / std;
      }
    });

    // Normalize audio features
    Object.keys(shot.audio || {}).forEach(key => {
      const mean = stats.audio.mean[key] || 0;
      const std = stats.audio.std[key] || 1;
      if (std > 0 && typeof shot.audio[key] === 'number') {
        normalized.audio[key] = (shot.audio[key] - mean) / std;
      }
    });

    return normalized;
  });
}

module.exports = {
  extractFeaturesInParallel,
  SimilarityCache,
  buildSimilarityMatrixOptimized,
  clusterIncremental,
  precomputeFeatureStatistics,
  normalizeFeaturesWithStats
};







