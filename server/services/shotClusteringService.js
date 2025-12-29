// Shot Clustering Service
// Groups adjacent shots into scenes based on visual+audio feature similarity

const logger = require('../utils/logger');

/**
 * Cluster shots into scenes using visual+audio features
 */
function clusterShotsIntoScenes(shots, audioFeatures, options = {}) {
  const {
    visualWeight = 0.5, // Weight for visual features (0-1)
    audioWeight = 0.5, // Weight for audio features (0-1)
    similarityThreshold = 0.3, // Threshold for grouping shots (lower = more groups)
    minSceneLength = 2.0, // Minimum scene length in seconds
    maxSceneLength = 60.0, // Maximum scene length in seconds
    method = 'similarity', // 'similarity', 'hierarchical', or 'kmeans'
    linkage = 'average' // For hierarchical: 'single', 'average', 'complete'
  } = options;

  if (!shots || shots.length === 0) {
    return {
      scenes: [],
      clusters: [],
      statistics: {}
    };
  }

  logger.info('Clustering shots into scenes', {
    shotCount: shots.length,
    method,
    threshold: similarityThreshold
  });

  // Extract combined features for each shot
  const shotFeatures = extractShotFeatures(shots, audioFeatures);

  // Perform clustering
  let clusters = [];
  if (method === 'similarity') {
    clusters = clusterBySimilarity(shotFeatures, similarityThreshold, visualWeight, audioWeight);
  } else if (method === 'hierarchical') {
    clusters = clusterHierarchically(shotFeatures, similarityThreshold, linkage, visualWeight, audioWeight);
  } else if (method === 'kmeans') {
    clusters = clusterKMeans(shotFeatures, similarityThreshold, visualWeight, audioWeight);
  }

  // Convert clusters to scenes
  const scenes = clustersToScenes(clusters, shots, {
    minSceneLength,
    maxSceneLength
  });

  // Calculate statistics
  const statistics = calculateClusteringStatistics(scenes, clusters, shotFeatures);

  logger.info('Shot clustering completed', {
    scenes: scenes.length,
    clusters: clusters.length,
    averageSceneLength: statistics.averageSceneLength
  });

  return {
    scenes,
    clusters,
    shotFeatures,
    statistics
  };
}

/**
 * Extract combined visual+audio features for each shot
 */
function extractShotFeatures(shots, audioFeatures) {
  return shots.map((shot, index) => {
    // Extract visual features from shot
    const visualFeatures = extractVisualFeatures(shot);

    // Extract audio features for shot segment
    const audioShotFeatures = extractAudioFeaturesForShot(
      shot,
      audioFeatures,
      index,
      shots
    );

    // Combine features
    return {
      shotIndex: index,
      shot: shot,
      visual: visualFeatures,
      audio: audioShotFeatures,
      combined: combineFeatures(visualFeatures, audioShotFeatures),
      start: shot.start || shot.timestamp || 0,
      end: shot.end || shot.timestamp || 0
    };
  });
}

/**
 * Extract visual features from shot
 */
function extractVisualFeatures(shot) {
  return {
    // Visual change magnitude
    changeMagnitude: shot.confidence || 0.5,
    
    // Visual cues (if available)
    colorChange: shot.cues?.color || 0,
    compositionChange: shot.cues?.composition || 0,
    cameraAngleChange: shot.cues?.camera || 0,
    
    // Average visual features
    visualScore: shot.confidence || 0.5
  };
}

/**
 * Extract audio features for a shot segment
 */
function extractAudioFeaturesForShot(shot, audioFeatures, shotIndex, shotsArray = []) {
  if (!audioFeatures || !audioFeatures.windows || audioFeatures.windows.length === 0) {
    return getDefaultAudioFeatures();
  }

  const shotStart = shot.start || shot.timestamp || 0;
  const shotEnd = shot.end || (shotIndex + 1 < shotsArray.length 
    ? (shotsArray[shotIndex + 1].start || shotsArray[shotIndex + 1].timestamp || shotStart + 1)
    : shotStart + 1);

  // Find audio windows within shot segment
  const relevantWindows = audioFeatures.windows.filter(win =>
    win.start >= shotStart && win.end <= shotEnd
  );

  if (relevantWindows.length === 0) {
    return getDefaultAudioFeatures();
  }

  // Aggregate audio features
  return aggregateAudioFeaturesForShot(relevantWindows);
}

/**
 * Aggregate audio features for a shot
 */
function aggregateAudioFeaturesForShot(windows) {
  if (windows.length === 0) {
    return getDefaultAudioFeatures();
  }

  // Aggregate energy
  const energies = windows.map(w => w.energy?.energy || 0).filter(e => !isNaN(e));
  const avgEnergy = energies.length > 0
    ? energies.reduce((a, b) => a + b, 0) / energies.length
    : 0;

  // Aggregate spectral features
  const centroids = windows.map(w => w.spectral?.centroid || 0).filter(c => c > 0);
  const bandwidths = windows.map(w => w.spectral?.bandwidth || 0).filter(b => b > 0);
  const zcrs = windows.map(w => w.spectral?.zeroCrossingRate || 0);

  // Aggregate classification
  const classifications = windows.map(w => w.classification || { voice: 0.33, music: 0.33, silence: 0.34 });
  const avgClassification = {
    voice: classifications.reduce((sum, c) => sum + (c.voice || 0), 0) / classifications.length,
    music: classifications.reduce((sum, c) => sum + (c.music || 0), 0) / classifications.length,
    silence: classifications.reduce((sum, c) => sum + (c.silence || 0), 0) / classifications.length
  };

  // Aggregate MFCCs
  const mfccArrays = windows.map(w => w.spectral?.mfccs || []).filter(m => m.length > 0);
  const avgMFCCs = aggregateMFCCsForClustering(mfccArrays);

  return {
    energy: avgEnergy,
    centroid: centroids.length > 0 ? centroids.reduce((a, b) => a + b, 0) / centroids.length : 0,
    bandwidth: bandwidths.length > 0 ? bandwidths.reduce((a, b) => a + b, 0) / bandwidths.length : 0,
    zeroCrossingRate: zcrs.length > 0 ? zcrs.reduce((a, b) => a + b, 0) / zcrs.length : 0,
    classification: avgClassification,
    mfccs: avgMFCCs,
    dominantClass: getDominantClass(avgClassification)
  };
}

/**
 * Aggregate MFCCs
 */
function aggregateMFCCsForClustering(mfccArrays) {
  if (mfccArrays.length === 0) return [];

  const numCoeffs = Math.min(...mfccArrays.map(a => a.length));
  const aggregated = [];

  for (let i = 0; i < numCoeffs; i++) {
    const values = mfccArrays.map(arr => arr[i]).filter(v => !isNaN(v));
    if (values.length > 0) {
      aggregated.push(values.reduce((a, b) => a + b, 0) / values.length);
    }
  }

  return aggregated;
}

/**
 * Get dominant audio class
 */
function getDominantClass(classification) {
  if (!classification) return 'unknown';
  
  const classes = [
    { name: 'voice', prob: classification.voice || 0 },
    { name: 'music', prob: classification.music || 0 },
    { name: 'silence', prob: classification.silence || 0 }
  ];

  classes.sort((a, b) => b.prob - a.prob);
  return classes[0].name;
}

/**
 * Get default audio features
 */
function getDefaultAudioFeatures() {
  return {
    energy: 0.5,
    centroid: 2000,
    bandwidth: 1000,
    zeroCrossingRate: 0.05,
    classification: { voice: 0.33, music: 0.33, silence: 0.34 },
    mfccs: [],
    dominantClass: 'unknown'
  };
}

/**
 * Combine visual and audio features into single feature vector
 */
function combineFeatures(visualFeatures, audioFeatures) {
  // Normalize features to 0-1 range
  const visualVector = [
    visualFeatures.changeMagnitude,
    visualFeatures.colorChange || 0,
    visualFeatures.compositionChange || 0,
    visualFeatures.cameraAngleChange || 0
  ];

  const audioVector = [
    audioFeatures.energy,
    audioFeatures.centroid / 8000, // Normalize
    audioFeatures.bandwidth / 4000, // Normalize
    audioFeatures.zeroCrossingRate * 10, // Normalize
    audioFeatures.classification.voice,
    audioFeatures.classification.music,
    audioFeatures.classification.silence,
    ...(audioFeatures.mfccs || []).slice(0, 5) // First 5 MFCCs
  ];

  return {
    visual: visualVector,
    audio: audioVector,
    combined: [...visualVector, ...audioVector]
  };
}

/**
 * Cluster shots by similarity (greedy grouping)
 */
function clusterBySimilarity(shotFeatures, threshold, visualWeight, audioWeight) {
  if (shotFeatures.length === 0) return [];

  const clusters = [[shotFeatures[0]]];
  
  for (let i = 1; i < shotFeatures.length; i++) {
    const currentShot = shotFeatures[i];
    const lastCluster = clusters[clusters.length - 1];
    const lastShot = lastCluster[lastCluster.length - 1];

    // Calculate similarity with last shot in current cluster
    const similarity = calculateShotSimilarity(
      lastShot,
      currentShot,
      visualWeight,
      audioWeight
    );

    // If similar, add to current cluster; otherwise, start new cluster
    if (similarity >= (1 - threshold)) {
      lastCluster.push(currentShot);
    } else {
      clusters.push([currentShot]);
    }
  }

  return clusters;
}

/**
 * Calculate similarity between two shots
 */
function calculateShotSimilarity(shot1, shot2, visualWeight, audioWeight) {
  // Visual similarity
  const visualSimilarity = calculateVisualSimilarity(shot1.visual, shot2.visual);
  
  // Audio similarity
  const audioSimilarity = calculateAudioSimilarity(shot1.audio, shot2.audio);

  // Combined similarity (weighted)
  const combinedSimilarity = (visualSimilarity * visualWeight) + (audioSimilarity * audioWeight);

  return combinedSimilarity;
}

/**
 * Calculate visual similarity
 */
function calculateVisualSimilarity(visual1, visual2) {
  // Cosine similarity of visual features
  const vec1 = [
    visual1.changeMagnitude,
    visual1.colorChange || 0,
    visual1.compositionChange || 0,
    visual1.cameraAngleChange || 0
  ];
  const vec2 = [
    visual2.changeMagnitude,
    visual2.colorChange || 0,
    visual2.compositionChange || 0,
    visual2.cameraAngleChange || 0
  ];

  return cosineSimilarity(vec1, vec2);
}

/**
 * Calculate audio similarity
 */
function calculateAudioSimilarity(audio1, audio2) {
  // Combine multiple similarity metrics
  const energySim = 1 - Math.abs((audio1.energy || 0) - (audio2.energy || 0));
  const centroidSim = 1 - Math.min(1, Math.abs((audio1.centroid || 0) - (audio2.centroid || 0)) / 4000);
  const classSim = calculateClassificationSimilarity(
    audio1.classification,
    audio2.classification
  );
  const mfccSim = calculateMFCCSimilarity(audio1.mfccs || [], audio2.mfccs || []);

  // Weighted combination
  return (
    energySim * 0.2 +
    centroidSim * 0.2 +
    classSim * 0.3 +
    mfccSim * 0.3
  );
}

/**
 * Calculate classification similarity
 */
function calculateClassificationSimilarity(class1, class2) {
  if (!class1 || !class2) return 0.5;

  const voiceDiff = Math.abs((class1.voice || 0) - (class2.voice || 0));
  const musicDiff = Math.abs((class1.music || 0) - (class2.music || 0));
  const silenceDiff = Math.abs((class1.silence || 0) - (class2.silence || 0));

  const avgDiff = (voiceDiff + musicDiff + silenceDiff) / 3;
  return 1 - avgDiff;
}

/**
 * Calculate MFCC similarity
 */
function calculateMFCCSimilarity(mfccs1, mfccs2) {
  if (mfccs1.length === 0 || mfccs2.length === 0) return 0.5;

  const minLength = Math.min(mfccs1.length, mfccs2.length);
  let sumSquaredDiff = 0;

  for (let i = 0; i < minLength; i++) {
    const diff = (mfccs1[i] || 0) - (mfccs2[i] || 0);
    sumSquaredDiff += diff * diff;
  }

  const euclideanDistance = Math.sqrt(sumSquaredDiff / minLength);
  return Math.max(0, 1 - (euclideanDistance / 10)); // Normalize
}

/**
 * Calculate cosine similarity
 */
function cosineSimilarity(vec1, vec2) {
  if (vec1.length !== vec2.length) return 0;

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  norm1 = Math.sqrt(norm1);
  norm2 = Math.sqrt(norm2);

  if (norm1 === 0 || norm2 === 0) return 0;
  return dotProduct / (norm1 * norm2);
}

/**
 * Hierarchical clustering
 */
function clusterHierarchically(shotFeatures, threshold, linkage, visualWeight, audioWeight) {
  if (shotFeatures.length <= 1) {
    return shotFeatures.length === 1 ? [[shotFeatures[0]]] : [];
  }

  // Build similarity matrix
  const similarityMatrix = buildSimilarityMatrix(shotFeatures, visualWeight, audioWeight);

  // Initialize clusters (each shot is its own cluster)
  let clusters = shotFeatures.map(shot => [shot]);
  const distances = [];

  // Calculate initial distances between clusters
  for (let i = 0; i < clusters.length; i++) {
    distances[i] = [];
    for (let j = i + 1; j < clusters.length; j++) {
      distances[i][j] = calculateClusterDistance(clusters[i], clusters[j], linkage, similarityMatrix);
    }
  }

  // Merge clusters iteratively
  while (clusters.length > 1) {
    // Find closest clusters
    let minDistance = Infinity;
    let mergeI = -1;
    let mergeJ = -1;

    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const dist = distances[i][j];
        if (dist < minDistance) {
          minDistance = dist;
          mergeI = i;
          mergeJ = j;
        }
      }
    }

    // Check if we should stop merging
    if (minDistance > threshold) {
      break;
    }

    // Merge clusters
    clusters[mergeI] = [...clusters[mergeI], ...clusters[mergeJ]];
    clusters.splice(mergeJ, 1);

    // Update distance matrix
    updateDistanceMatrix(distances, clusters, mergeI, mergeJ, linkage, similarityMatrix);
  }

  return clusters;
}

/**
 * Build similarity matrix
 */
function buildSimilarityMatrix(shotFeatures, visualWeight, audioWeight) {
  const matrix = [];
  
  for (let i = 0; i < shotFeatures.length; i++) {
    matrix[i] = [];
    for (let j = 0; j < shotFeatures.length; j++) {
      if (i === j) {
        matrix[i][j] = 1.0;
      } else {
        const similarity = calculateShotSimilarity(
          shotFeatures[i],
          shotFeatures[j],
          visualWeight,
          audioWeight
        );
        matrix[i][j] = similarity;
      }
    }
  }

  return matrix;
}

/**
 * Calculate distance between clusters
 */
function calculateClusterDistance(cluster1, cluster2, linkage, similarityMatrix) {
  const similarities = [];
  
  for (const shot1 of cluster1) {
    for (const shot2 of cluster2) {
      const idx1 = shot1.shotIndex;
      const idx2 = shot2.shotIndex;
      similarities.push(1 - similarityMatrix[idx1][idx2]); // Convert to distance
    }
  }

  if (linkage === 'single') {
    return Math.min(...similarities); // Single linkage (min distance)
  } else if (linkage === 'complete') {
    return Math.max(...similarities); // Complete linkage (max distance)
  } else {
    // Average linkage
    return similarities.reduce((a, b) => a + b, 0) / similarities.length;
  }
}

/**
 * Update distance matrix after merging
 */
function updateDistanceMatrix(distances, clusters, mergedI, mergedJ, linkage, similarityMatrix) {
  // Remove merged cluster column/row
  for (let i = 0; i < distances.length; i++) {
    if (i < mergedJ) {
      distances[i].splice(mergedJ, 1);
    }
  }
  distances.splice(mergedJ, 1);

  // Recalculate distances for merged cluster
  for (let i = 0; i < clusters.length; i++) {
    if (i < mergedI) {
      distances[i][mergedI] = calculateClusterDistance(clusters[i], clusters[mergedI], linkage, similarityMatrix);
    } else if (i > mergedI) {
      distances[mergedI][i] = calculateClusterDistance(clusters[mergedI], clusters[i], linkage, similarityMatrix);
    }
  }
}

/**
 * K-means clustering (simplified - uses similarity threshold for k)
 */
function clusterKMeans(shotFeatures, threshold, visualWeight, audioWeight) {
  // Estimate number of clusters based on similarity threshold
  // Lower threshold = more clusters
  const estimatedK = Math.max(1, Math.floor(shotFeatures.length * (1 - threshold)));
  const k = Math.min(estimatedK, shotFeatures.length);

  if (k === shotFeatures.length) {
    // Each shot is its own cluster
    return shotFeatures.map(shot => [shot]);
  }

  // Initialize centroids (random selection)
  const centroids = [];
  const indices = [];
  for (let i = 0; i < k; i++) {
    let idx;
    do {
      idx = Math.floor(Math.random() * shotFeatures.length);
    } while (indices.includes(idx));
    indices.push(idx);
    centroids.push(shotFeatures[idx].combined.combined);
  }

  // Iterate until convergence
  let clusters = null;
  let iterations = 0;
  const maxIterations = 10;

  while (iterations < maxIterations) {
    // Assign shots to nearest centroid
    const newClusters = Array(k).fill(null).map(() => []);

    for (const shot of shotFeatures) {
      let minDistance = Infinity;
      let nearestCluster = 0;

      for (let i = 0; i < centroids.length; i++) {
        const distance = euclideanDistance(shot.combined.combined, centroids[i]);
        if (distance < minDistance) {
          minDistance = distance;
          nearestCluster = i;
        }
      }

      newClusters[nearestCluster].push(shot);
    }

    // Update centroids
    let converged = true;
    for (let i = 0; i < k; i++) {
      if (newClusters[i].length === 0) continue;

      const newCentroid = calculateCentroid(newClusters[i]);
      const oldCentroid = centroids[i];
      
      if (euclideanDistance(newCentroid, oldCentroid) > 0.01) {
        converged = false;
      }
      
      centroids[i] = newCentroid;
    }

    clusters = newClusters;

    if (converged) break;
    iterations++;
  }

  // Filter out empty clusters
  return clusters.filter(cluster => cluster.length > 0);
}

/**
 * Calculate centroid of cluster
 */
function calculateCentroid(cluster) {
  if (cluster.length === 0) return [];

  const featureLength = cluster[0].combined.combined.length;
  const centroid = new Array(featureLength).fill(0);

  for (const shot of cluster) {
    for (let i = 0; i < featureLength; i++) {
      centroid[i] += shot.combined.combined[i] || 0;
    }
  }

  for (let i = 0; i < featureLength; i++) {
    centroid[i] /= cluster.length;
  }

  return centroid;
}

/**
 * Calculate Euclidean distance
 */
function euclideanDistance(vec1, vec2) {
  if (vec1.length !== vec2.length) return Infinity;

  let sumSquaredDiff = 0;
  for (let i = 0; i < vec1.length; i++) {
    const diff = (vec1[i] || 0) - (vec2[i] || 0);
    sumSquaredDiff += diff * diff;
  }

  return Math.sqrt(sumSquaredDiff);
}

/**
 * Convert clusters to scenes
 */
function clustersToScenes(clusters, shots, options = {}) {
  const { minSceneLength = 2.0, maxSceneLength = 60.0 } = options;

  const scenes = [];

  clusters.forEach((cluster, clusterIndex) => {
    if (cluster.length === 0) return;

    // Sort cluster by shot index (maintain temporal order)
    cluster.sort((a, b) => a.shotIndex - b.shotIndex);

    const firstShot = cluster[0].shot;
    const lastShot = cluster[cluster.length - 1].shot;

    const start = firstShot.start || firstShot.timestamp || 0;
    const end = lastShot.end || lastShot.timestamp || (start + 1);
    const duration = end - start;

    // Apply length constraints
    if (duration < minSceneLength) {
      // Merge with adjacent scene if too short
      if (scenes.length > 0) {
        scenes[scenes.length - 1].end = end;
        scenes[scenes.length - 1].shotCount += cluster.length;
        scenes[scenes.length - 1].duration = scenes[scenes.length - 1].end - scenes[scenes.length - 1].start;
      } else {
        // First scene, keep it
        scenes.push({
          start,
          end,
          duration,
          shotCount: cluster.length,
          shotIndices: cluster.map(s => s.shotIndex),
          clusterIndex,
          features: aggregateClusterFeatures(cluster)
        });
      }
    } else if (duration > maxSceneLength) {
      // Split long scenes
      const numSplits = Math.ceil(duration / maxSceneLength);
      const splitDuration = duration / numSplits;

      for (let i = 0; i < numSplits; i++) {
        const splitStart = start + (i * splitDuration);
        const splitEnd = start + ((i + 1) * splitDuration);
        
        const splitCluster = cluster.filter(s => {
          const shotStart = s.shot.start || s.shot.timestamp || 0;
          return shotStart >= splitStart && shotStart < splitEnd;
        });

        if (splitCluster.length > 0) {
          scenes.push({
            start: splitStart,
            end: splitEnd,
            duration: splitDuration,
            shotCount: splitCluster.length,
            shotIndices: splitCluster.map(s => s.shotIndex),
            clusterIndex: clusterIndex + (i * 0.1), // Fractional for split scenes
            features: aggregateClusterFeatures(splitCluster)
          });
        }
      }
    } else {
      // Scene is within bounds
      scenes.push({
        start,
        end,
        duration,
        shotCount: cluster.length,
        shotIndices: cluster.map(s => s.shotIndex),
        clusterIndex,
        features: aggregateClusterFeatures(cluster)
      });
    }
  });

  // Sort scenes by start time
  scenes.sort((a, b) => a.start - b.start);

  return scenes;
}

/**
 * Aggregate features for a cluster
 */
function aggregateClusterFeatures(cluster) {
  if (cluster.length === 0) return null;

  // Aggregate visual features
  const visualChanges = cluster.map(s => s.visual.changeMagnitude || 0);
  const avgVisualChange = visualChanges.reduce((a, b) => a + b, 0) / visualChanges.length;

  // Aggregate audio features
  const energies = cluster.map(s => s.audio.energy || 0);
  const centroids = cluster.map(s => s.audio.centroid || 0).filter(c => c > 0);
  const classifications = cluster.map(s => s.audio.classification || { voice: 0.33, music: 0.33, silence: 0.34 });

  const dominantClasses = cluster.map(s => s.audio.dominantClass);
  const mostCommonClass = getMostCommon(dominantClasses);

  return {
    visual: {
      averageChange: avgVisualChange
    },
    audio: {
      averageEnergy: energies.reduce((a, b) => a + b, 0) / energies.length,
      averageCentroid: centroids.length > 0 ? centroids.reduce((a, b) => a + b, 0) / centroids.length : 0,
      dominantClass: mostCommonClass,
      classification: {
        voice: classifications.reduce((sum, c) => sum + (c.voice || 0), 0) / classifications.length,
        music: classifications.reduce((sum, c) => sum + (c.music || 0), 0) / classifications.length,
        silence: classifications.reduce((sum, c) => sum + (c.silence || 0), 0) / classifications.length
      }
    }
  };
}

/**
 * Get most common value in array
 */
function getMostCommon(arr) {
  if (arr.length === 0) return 'unknown';

  const counts = {};
  arr.forEach(item => {
    counts[item] = (counts[item] || 0) + 1;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0][0];
}

/**
 * Calculate clustering statistics
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

  // Calculate coherence (average similarity within scenes)
  const coherence = calculateCoherence(clusters, shotFeatures);

  return {
    sceneCount: scenes.length,
    averageSceneLength: totalDuration / scenes.length,
    averageShotsPerScene: totalShots / scenes.length,
    coherence,
    minSceneLength: Math.min(...scenes.map(s => s.duration)),
    maxSceneLength: Math.max(...scenes.map(s => s.duration))
  };
}

/**
 * Calculate coherence (average similarity within clusters)
 */
function calculateCoherence(clusters, shotFeatures) {
  if (clusters.length === 0) return 0;

  let totalCoherence = 0;
  let clusterCount = 0;

  clusters.forEach(cluster => {
    if (cluster.length <= 1) {
      totalCoherence += 1.0; // Perfect coherence for single-shot clusters
      clusterCount++;
      return;
    }

    // Calculate average similarity within cluster
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

  return clusterCount > 0 ? totalCoherence / clusterCount : 0;
}

module.exports = {
  clusterShotsIntoScenes,
  extractShotFeatures,
  calculateShotSimilarity
};

