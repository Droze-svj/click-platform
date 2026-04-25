// Advanced Shot Clustering Service
// Enhanced clustering with dynamic thresholds, coherence optimization, and ML

const logger = require('../utils/logger');
const { clusterShotsIntoScenes } = require('./shotClusteringService');
const { 
  extractFeaturesInParallel,
  buildSimilarityMatrixOptimized,
  precomputeFeatureStatistics,
  normalizeFeaturesWithStats
} = require('./shotClusteringOptimizations');

/**
 * Advanced shot clustering with optimizations
 */
function clusterShotsIntoScenesAdvanced(shots, audioFeatures, options = {}) {
  const {
    visualWeight = null, // Auto-tune if null
    audioWeight = null, // Auto-tune if null
    similarityThreshold = null, // Auto-tune if null
    minSceneLength = 2.0,
    maxSceneLength = 60.0,
    method = 'similarity',
    linkage = 'average',
    optimizeCoherence = true, // Optimize for maximum coherence
    dynamicThresholds = true, // Adjust thresholds dynamically
    multiResolution = false, // Try multiple resolutions
    refineBoundaries = true, // Post-process boundaries
    classifySceneTypes = true // Classify scene types
  } = options;

  if (!shots || shots.length === 0) {
    return {
      scenes: [],
      clusters: [],
      statistics: {}
    };
  }

  logger.info('Advanced shot clustering', {
    shotCount: shots.length,
    method,
    optimizeCoherence,
    dynamicThresholds
  });

  // Auto-tune parameters if enabled
  let tunedParams = {
    visualWeight: visualWeight || 0.5,
    audioWeight: audioWeight || 0.5,
    similarityThreshold: similarityThreshold || 0.3
  };

  if (dynamicThresholds) {
    tunedParams = autoTuneClusteringParameters(shots, audioFeatures);
  }

  // Pre-compute feature statistics for optimization
  const { extractShotFeatures } = require('./shotClusteringService');
  const shotFeatures = extractShotFeatures(shots, audioFeatures);
  const featureStats = precomputeFeatureStatistics(shotFeatures);
  const normalizedFeatures = normalizeFeaturesWithStats(shotFeatures, featureStats);

  // Multi-resolution clustering if enabled
  let clusteringResult;
  if (multiResolution) {
    clusteringResult = clusterMultiResolution(shots, audioFeatures, {
      ...tunedParams,
      minSceneLength,
      maxSceneLength,
      method,
      linkage,
      normalizedFeatures
    });
  } else {
    // Standard clustering (with optimized features)
    clusteringResult = clusterShotsIntoScenes(shots, audioFeatures, {
      ...tunedParams,
      minSceneLength,
      maxSceneLength,
      method,
      linkage
    });
    // Override with normalized features if available
    if (normalizedFeatures && normalizedFeatures.length > 0) {
      clusteringResult.shotFeatures = normalizedFeatures;
    }
  }

  // Optimize coherence if enabled
  if (optimizeCoherence) {
    clusteringResult = optimizeClusterCoherence(clusteringResult, shots, audioFeatures, tunedParams);
  }

  // Refine boundaries if enabled
  if (refineBoundaries) {
    clusteringResult.scenes = refineClusterBoundaries(clusteringResult.scenes, shots, audioFeatures);
  }

  // Classify scene types if enabled
  if (classifySceneTypes) {
    clusteringResult.scenes = classifySceneTypesFromClusters(clusteringResult.scenes, clusteringResult.clusters);
  }

  // Recalculate statistics
  clusteringResult.statistics = calculateAdvancedClusteringStatistics(
    clusteringResult.scenes,
    clusteringResult.clusters,
    clusteringResult.shotFeatures
  );

  return clusteringResult;
}

/**
 * Auto-tune clustering parameters
 */
function autoTuneClusteringParameters(shots, audioFeatures) {
  // Extract features to analyze
  const { extractShotFeatures } = require('./shotClusteringService');
  const shotFeatures = extractShotFeatures(shots, audioFeatures);

  if (shotFeatures.length < 2) {
    return {
      visualWeight: 0.5,
      audioWeight: 0.5,
      similarityThreshold: 0.3
    };
  }

  // Calculate feature variances
  const visualVariances = calculateFeatureVariances(shotFeatures, 'visual');
  const audioVariances = calculateFeatureVariances(shotFeatures, 'audio');

  // Determine weights based on feature discriminative power
  const totalVariance = visualVariances.total + audioVariances.total;
  const visualWeight = totalVariance > 0 
    ? Math.max(0.3, Math.min(0.7, visualVariances.total / totalVariance))
    : 0.5;
  const audioWeight = 1 - visualWeight;

  // Calculate optimal similarity threshold
  const similarities = [];
  for (let i = 1; i < shotFeatures.length; i++) {
    const { calculateShotSimilarity } = require('./shotClusteringService');
    const similarity = calculateShotSimilarity(
      shotFeatures[i - 1],
      shotFeatures[i],
      0.5,
      0.5
    );
    similarities.push(similarity);
  }

  const meanSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;
  const stdSimilarity = Math.sqrt(
    similarities.reduce((sum, s) => {
      const diff = s - meanSimilarity;
      return sum + diff * diff;
    }, 0) / similarities.length
  );

  // Optimal threshold: mean - 0.5 * std (captures ~70% of similar shots)
  const similarityThreshold = Math.max(0.2, Math.min(0.5, meanSimilarity - 0.5 * stdSimilarity));

  logger.info('Auto-tuned clustering parameters', {
    visualWeight,
    audioWeight,
    similarityThreshold
  });

  return {
    visualWeight,
    audioWeight,
    similarityThreshold
  };
}

/**
 * Calculate feature variances
 */
function calculateFeatureVariances(shotFeatures, type) {
  if (shotFeatures.length === 0) return { total: 0, features: {} };

  const features = shotFeatures.map(s => s[type]);
  const featureKeys = Object.keys(features[0] || {});

  const variances = {};
  let totalVariance = 0;

  featureKeys.forEach(key => {
    const values = features.map(f => {
      if (typeof f[key] === 'object' && f[key] !== null) {
        // For nested objects, use a representative value
        return Object.values(f[key]).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
      }
      return typeof f[key] === 'number' ? f[key] : 0;
    }).filter(v => !isNaN(v));

    if (values.length > 0) {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, v) => {
        const diff = v - mean;
        return sum + diff * diff;
      }, 0) / values.length;
      
      variances[key] = variance;
      totalVariance += variance;
    }
  });

  return { total: totalVariance, features: variances };
}

/**
 * Optimize cluster coherence
 */
function optimizeClusterCoherence(clusteringResult, shots, audioFeatures, params) {
  const { extractShotFeatures } = require('./shotClusteringService');
  const shotFeatures = clusteringResult.shotFeatures || extractShotFeatures(shots, audioFeatures);

  // Calculate current coherence
  const currentCoherence = calculateOverallCoherence(clusteringResult.clusters, shotFeatures);

  // Try adjusting threshold to improve coherence
  const thresholds = [
    params.similarityThreshold * 0.9,
    params.similarityThreshold,
    params.similarityThreshold * 1.1
  ];

  let bestResult = clusteringResult;
  let bestCoherence = currentCoherence;

  for (const threshold of thresholds) {
    if (Math.abs(threshold - params.similarityThreshold) < 0.01) continue; // Skip current

    const { clusterShotsIntoScenes } = require('./shotClusteringService');
    const testResult = clusterShotsIntoScenes(shots, audioFeatures, {
      ...params,
      similarityThreshold: threshold,
      method: clusteringResult.method || 'similarity'
    });

    const coherence = calculateOverallCoherence(testResult.clusters, shotFeatures);

    if (coherence > bestCoherence) {
      bestCoherence = coherence;
      bestResult = testResult;
    }
  }

  if (bestResult !== clusteringResult) {
    logger.info('Coherence optimized', {
      original: currentCoherence,
      optimized: bestCoherence,
      improvement: bestCoherence - currentCoherence
    });
  }

  return bestResult;
}

/**
 * Calculate overall coherence
 */
function calculateOverallCoherence(clusters, shotFeatures) {
  if (clusters.length === 0) return 0;

  let totalCoherence = 0;
  let clusterCount = 0;

  clusters.forEach(cluster => {
    if (cluster.length <= 1) {
      totalCoherence += 1.0;
      clusterCount++;
      return;
    }

    let similaritySum = 0;
    let pairCount = 0;

    for (let i = 0; i < cluster.length; i++) {
      for (let j = i + 1; j < cluster.length; j++) {
        const { calculateShotSimilarity } = require('./shotClusteringService');
        const similarity = calculateShotSimilarity(cluster[i], cluster[j], 0.5, 0.5);
        similaritySum += similarity;
        pairCount++;
      }
    }

    const clusterCoherence = pairCount > 0 ? similaritySum / pairCount : 1.0;
    totalCoherence += clusterCoherence;
    clusterCount++;
  });

  return clusterCount > 0 ? totalCoherence / clusterCount : 0;
}

/**
 * Multi-resolution clustering
 */
function clusterMultiResolution(shots, audioFeatures, params) {
  const resolutions = [
    { threshold: params.similarityThreshold * 0.8, name: 'fine' },
    { threshold: params.similarityThreshold, name: 'medium' },
    { threshold: params.similarityThreshold * 1.2, name: 'coarse' }
  ];

  const results = resolutions.map(res => {
    const { clusterShotsIntoScenes } = require('./shotClusteringService');
    return {
      resolution: res.name,
      threshold: res.threshold,
      result: clusterShotsIntoScenes(shots, audioFeatures, {
        ...params,
        similarityThreshold: res.threshold
      })
    };
  });

  // Select best resolution based on coherence and scene count
  let bestResult = results[0];
  let bestScore = -1;

  results.forEach(res => {
    const coherence = res.result.statistics?.coherence || 0;
    const sceneCount = res.result.scenes?.length || 0;
    const shotsPerScene = res.result.statistics?.averageShotsPerScene || 0;

    // Score: balance coherence, reasonable scene count, and shots per scene
    const coherenceScore = coherence;
    const countScore = sceneCount >= 3 && sceneCount <= 20 ? 1.0 : 0.5;
    const shotsScore = shotsPerScene >= 2 && shotsPerScene <= 8 ? 1.0 : 0.5;

    const totalScore = (coherenceScore * 0.5) + (countScore * 0.25) + (shotsScore * 0.25);

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestResult = res;
    }
  });

  logger.info('Multi-resolution clustering completed', {
    selected: bestResult.resolution,
    threshold: bestResult.threshold,
    score: bestScore
  });

  return {
    ...bestResult.result,
    selectedResolution: bestResult.resolution,
    allResolutions: results
  };
}

/**
 * Refine cluster boundaries
 */
function refineClusterBoundaries(scenes, shots, audioFeatures) {
  if (scenes.length === 0) return scenes;

  const refined = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const nextScene = i < scenes.length - 1 ? scenes[i + 1] : null;

    // Check if boundary should be adjusted based on audio
    if (nextScene) {
      const boundaryTime = scene.end;
      const refinedBoundary = refineBoundaryWithAudio(
        boundaryTime,
        audioFeatures,
        scene,
        nextScene
      );

      refined.push({
        ...scene,
        end: refinedBoundary,
        originalEnd: scene.end,
        boundaryRefined: Math.abs(refinedBoundary - scene.end) > 0.1
      });

      // Update next scene start
      if (i < scenes.length - 1) {
        scenes[i + 1].start = refinedBoundary;
      }
    } else {
      refined.push(scene);
    }
  }

  // Recalculate durations
  refined.forEach(scene => {
    scene.duration = scene.end - scene.start;
  });

  return refined;
}

/**
 * Refine boundary using audio features
 */
function refineBoundaryWithAudio(boundaryTime, audioFeatures, prevScene, nextScene) {
  if (!audioFeatures || !audioFeatures.windows) {
    return boundaryTime;
  }

  // Find audio windows around boundary
  const windowSize = 2.0; // 2 seconds around boundary
  const relevantWindows = audioFeatures.windows.filter(win =>
    win.start >= boundaryTime - windowSize && win.end <= boundaryTime + windowSize
  );

  if (relevantWindows.length === 0) {
    return boundaryTime;
  }

  // Find window with maximum change (best boundary location)
  let maxChange = 0;
  let bestTime = boundaryTime;

  for (let i = 1; i < relevantWindows.length; i++) {
    const prev = relevantWindows[i - 1];
    const curr = relevantWindows[i];

    // Calculate change magnitude
    const energyChange = Math.abs((prev.energy?.energy || 0) - (curr.energy?.energy || 0));
    const classChange = calculateClassificationChange(prev.classification, curr.classification);
    const change = energyChange + classChange;

    if (change > maxChange) {
      maxChange = change;
      bestTime = curr.start;
    }
  }

  // Only refine if significant improvement
  if (maxChange > 0.3 && Math.abs(bestTime - boundaryTime) < 2.0) {
    return bestTime;
  }

  return boundaryTime;
}

/**
 * Calculate classification change
 */
function calculateClassificationChange(class1, class2) {
  if (!class1 || !class2) return 0;

  const voiceDiff = Math.abs((class1.voice || 0) - (class2.voice || 0));
  const musicDiff = Math.abs((class1.music || 0) - (class2.music || 0));
  const silenceDiff = Math.abs((class1.silence || 0) - (class2.silence || 0));

  return (voiceDiff + musicDiff + silenceDiff) / 3;
}

/**
 * Classify scene types from clusters
 */
function classifySceneTypesFromClusters(scenes, clusters) {
  return scenes.map(scene => {
    const cluster = clusters[scene.clusterIndex] || [];
    
    if (cluster.length === 0) {
      return {
        ...scene,
        sceneType: 'unknown',
        typeConfidence: 0.5
      };
    }

    // Analyze cluster features to determine scene type
    const type = classifySceneTypeFromFeatures(scene.features, cluster);

    return {
      ...scene,
      sceneType: type.type,
      typeConfidence: type.confidence,
      typeFeatures: type.features
    };
  });
}

/**
 * Classify scene type from features
 */
function classifySceneTypeFromFeatures(features, cluster) {
  if (!features) {
    return { type: 'unknown', confidence: 0.5, features: {} };
  }

  const audio = features.audio || {};
  const visual = features.visual || {};

  // Determine scene type based on dominant characteristics
  let type = 'general';
  let confidence = 0.5;
  const typeFeatures = {};

  // Talking head scene
  if (audio.dominantClass === 'voice' && audio.classification?.voice > 0.6) {
    type = 'talking_head';
    confidence = audio.classification.voice;
    typeFeatures.hasSpeech = true;
    typeFeatures.hasFaces = true; // Assumed for talking head
  }
  // Music/B-roll scene
  else if (audio.dominantClass === 'music' && audio.classification?.music > 0.6) {
    type = 'b_roll';
    confidence = audio.classification.music;
    typeFeatures.hasMusic = true;
    typeFeatures.isVisual = true;
  }
  // Silent scene
  else if (audio.dominantClass === 'silence' && audio.classification?.silence > 0.7) {
    type = 'silent';
    confidence = audio.classification.silence;
    typeFeatures.isSilent = true;
  }
  // Mixed scene
  else if (audio.classification?.voice > 0.4 && audio.classification?.music > 0.3) {
    type = 'mixed';
    confidence = (audio.classification.voice + audio.classification.music) / 2;
    typeFeatures.hasSpeech = true;
    typeFeatures.hasMusic = true;
  }
  // High visual change = transition
  else if (visual.averageChange > 0.7) {
    type = 'transition';
    confidence = visual.averageChange;
    typeFeatures.isTransition = true;
  }

  return { type, confidence, features: typeFeatures };
}

/**
 * Calculate advanced clustering statistics
 */
function calculateAdvancedClusteringStatistics(scenes, clusters, shotFeatures) {
  const baseStats = calculateClusteringStatistics(scenes, clusters, shotFeatures);

  // Additional statistics
  const sceneTypes = {};
  scenes.forEach(scene => {
    const type = scene.sceneType || 'unknown';
    sceneTypes[type] = (sceneTypes[type] || 0) + 1;
  });

  const refinedBoundaries = scenes.filter(s => s.boundaryRefined).length;
  const averageTypeConfidence = scenes.length > 0
    ? scenes.reduce((sum, s) => sum + (s.typeConfidence || 0.5), 0) / scenes.length
    : 0;

  return {
    ...baseStats,
    sceneTypes,
    refinedBoundaries,
    refinementRate: scenes.length > 0 ? refinedBoundaries / scenes.length : 0,
    averageTypeConfidence,
    typeDistribution: Object.entries(sceneTypes).map(([type, count]) => ({
      type,
      count,
      percentage: (count / scenes.length) * 100
    }))
  };
}

/**
 * Calculate clustering statistics (from base service)
 */
function calculateClusteringStatistics(scenes, clusters, shotFeatures) {
  if (scenes.length === 0) {
    return {
      sceneCount: 0,
      averageSceneLength: 0,
      averageShotsPerScene: 0,
      coherence: 0
    };
  }

  const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);
  const totalShots = scenes.reduce((sum, s) => sum + s.shotCount, 0);

  // Calculate coherence
  const { calculateShotSimilarity } = require('./shotClusteringService');
  let totalCoherence = 0;
  let clusterCount = 0;

  clusters.forEach(cluster => {
    if (cluster.length <= 1) {
      totalCoherence += 1.0;
      clusterCount++;
      return;
    }

    let similaritySum = 0;
    let pairCount = 0;

    for (let i = 0; i < cluster.length; i++) {
      for (let j = i + 1; j < cluster.length; j++) {
        const similarity = calculateShotSimilarity(cluster[i], cluster[j], 0.5, 0.5);
        similaritySum += similarity;
        pairCount++;
      }
    }

    const clusterCoherence = pairCount > 0 ? similaritySum / pairCount : 1.0;
    totalCoherence += clusterCoherence;
    clusterCount++;
  });

  const coherence = clusterCount > 0 ? totalCoherence / clusterCount : 0;

  return {
    sceneCount: scenes.length,
    averageSceneLength: totalDuration / scenes.length,
    averageShotsPerScene: totalShots / scenes.length,
    coherence,
    minSceneLength: Math.min(...scenes.map(s => s.duration)),
    maxSceneLength: Math.max(...scenes.map(s => s.duration))
  };
}

module.exports = {
  clusterShotsIntoScenesAdvanced,
  autoTuneClusteringParameters,
  optimizeClusterCoherence,
  clusterMultiResolution,
  refineClusterBoundaries,
  classifySceneTypesFromClusters
};

