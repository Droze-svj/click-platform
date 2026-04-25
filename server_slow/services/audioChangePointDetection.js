// Audio Change Point Detection Service
// Detects significant audio changes using feature vector distance analysis

const logger = require('../utils/logger');

/**
 * Detect audio change points from feature windows
 */
function detectAudioChangePoints(windows, options = {}) {
  const {
    distanceMetric = 'euclidean', // 'euclidean' or 'cosine'
    threshold = 0.3, // Threshold for change detection
    minDistance = 0.5, // Minimum time between change points (seconds)
    detectClassTransitions = true, // Detect transitions between audio classes
    peakDetectionMethod = 'adaptive' // 'adaptive' or 'fixed'
  } = options;

  if (!windows || windows.length < 2) {
    return {
      changePoints: [],
      distances: [],
      segments: []
    };
  }

  // Compute distances between consecutive windows
  const distances = computeFeatureDistances(windows, distanceMetric);

  // Detect peaks in distance signal
  const peaks = detectPeaks(distances, threshold, minDistance, peakDetectionMethod);

  // Classify segments and detect transitions
  let classTransitions = [];
  let segments = [];
  
  if (detectClassTransitions) {
    const classificationResult = classifySegmentsAndDetectTransitions(windows, distances);
    classTransitions = classificationResult.transitions;
    segments = classificationResult.segments;
  }

  // Combine distance-based and class-based change points
  const allChangePoints = combineChangePoints(peaks, classTransitions, minDistance);

  return {
    changePoints: allChangePoints,
    distances: distances.map((d, i) => ({
      index: i,
      time: windows[i]?.start || 0,
      distance: d,
      isPeak: peaks.some(p => p.index === i)
    })),
    segments,
    statistics: {
      totalChangePoints: allChangePoints.length,
      distanceBased: peaks.length,
      classBased: classTransitions.length,
      averageDistance: distances.reduce((a, b) => a + b, 0) / distances.length,
      maxDistance: Math.max(...distances),
      minDistance: Math.min(...distances)
    }
  };
}

/**
 * Compute distances between consecutive feature vectors
 */
function computeFeatureDistances(windows, metric = 'euclidean') {
  const distances = [];

  for (let i = 1; i < windows.length; i++) {
    const prev = windows[i - 1];
    const curr = windows[i];

    let distance = 0;

    if (metric === 'euclidean') {
      distance = computeEuclideanDistance(prev, curr);
    } else if (metric === 'cosine') {
      distance = computeCosineDistance(prev, curr);
    } else {
      // Default to weighted combination
      distance = computeWeightedDistance(prev, curr);
    }

    distances.push(distance);
  }

  return distances;
}

/**
 * Compute Euclidean distance between feature vectors
 */
function computeEuclideanDistance(window1, window2) {
  let sumSquaredDiff = 0;
  let featureCount = 0;

  // Energy features
  const energy1 = window1.energy?.energy || 0;
  const energy2 = window2.energy?.energy || 0;
  sumSquaredDiff += Math.pow(energy1 - energy2, 2);
  featureCount++;

  // Spectral features
  const centroid1 = window1.spectral?.centroid || 0;
  const centroid2 = window2.spectral?.centroid || 0;
  sumSquaredDiff += Math.pow(centroid1 - centroid2, 2);
  featureCount++;

  const bandwidth1 = window1.spectral?.bandwidth || 0;
  const bandwidth2 = window2.spectral?.bandwidth || 0;
  sumSquaredDiff += Math.pow(bandwidth1 - bandwidth2, 2);
  featureCount++;

  const zcr1 = window1.spectral?.zeroCrossingRate || 0;
  const zcr2 = window2.spectral?.zeroCrossingRate || 0;
  sumSquaredDiff += Math.pow(zcr1 - zcr2, 2);
  featureCount++;

  // MFCCs (weighted - first few are more important)
  const mfccs1 = window1.spectral?.mfccs || [];
  const mfccs2 = window2.spectral?.mfccs || [];
  const minLength = Math.min(mfccs1.length, mfccs2.length);
  
  for (let i = 0; i < minLength; i++) {
    const weight = i < 4 ? 2.0 : 1.0; // Higher weight for first 4 MFCCs
    sumSquaredDiff += weight * Math.pow(mfccs1[i] - mfccs2[i], 2);
    featureCount += weight;
  }

  // Classification features (weighted)
  const class1 = window1.classification || { voice: 0.33, music: 0.33, silence: 0.34 };
  const class2 = window2.classification || { voice: 0.33, music: 0.33, silence: 0.34 };
  
  sumSquaredDiff += 1.5 * Math.pow(class1.voice - class2.voice, 2);
  sumSquaredDiff += 1.5 * Math.pow(class1.music - class2.music, 2);
  sumSquaredDiff += 1.5 * Math.pow(class1.silence - class2.silence, 2);
  featureCount += 4.5;

  return Math.sqrt(sumSquaredDiff / featureCount);
}

/**
 * Compute cosine distance between feature vectors
 */
function computeCosineDistance(window1, window2) {
  // Build feature vectors
  const vec1 = buildFeatureVector(window1);
  const vec2 = buildFeatureVector(window2);

  // Compute dot product
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

  if (norm1 === 0 || norm2 === 0) {
    return 1.0; // Maximum distance if one vector is zero
  }

  const cosineSimilarity = dotProduct / (norm1 * norm2);
  return 1 - cosineSimilarity; // Convert similarity to distance
}

/**
 * Compute weighted distance (combination of Euclidean and cosine)
 */
function computeWeightedDistance(window1, window2) {
  const euclidean = computeEuclideanDistance(window1, window2);
  const cosine = computeCosineDistance(window1, window2);
  
  // Normalize both to 0-1 range (approximate)
  const normalizedEuclidean = Math.min(1, euclidean / 5);
  const normalizedCosine = cosine; // Already 0-1
  
  // Weighted combination (60% Euclidean, 40% Cosine)
  return (normalizedEuclidean * 0.6) + (normalizedCosine * 0.4);
}

/**
 * Build feature vector from window
 */
function buildFeatureVector(window) {
  const vector = [];

  // Energy
  vector.push(window.energy?.energy || 0);
  vector.push(window.energy?.rms || -50);
  vector.push(window.energy?.peak || -40);

  // Spectral
  vector.push(window.spectral?.centroid || 0);
  vector.push(window.spectral?.bandwidth || 0);
  vector.push(window.spectral?.rolloff || 0);
  vector.push(window.spectral?.zeroCrossingRate || 0);
  vector.push(window.spectral?.spectralFlux || 0);

  // MFCCs
  const mfccs = window.spectral?.mfccs || [];
  for (let i = 0; i < 13; i++) {
    vector.push(mfccs[i] || 0);
  }

  // Classification
  const classification = window.classification || { voice: 0.33, music: 0.33, silence: 0.34 };
  vector.push(classification.voice);
  vector.push(classification.music);
  vector.push(classification.silence);

  return vector;
}

/**
 * Detect peaks in distance signal
 */
function detectPeaks(distances, threshold, minDistance, method = 'adaptive') {
  if (distances.length === 0) {
    return [];
  }

  if (method === 'adaptive') {
    return detectPeaksAdaptive(distances, threshold, minDistance);
  } else {
    return detectPeaksFixed(distances, threshold, minDistance);
  }
}

/**
 * Adaptive peak detection
 */
function detectPeaksAdaptive(distances, threshold, minDistance) {
  // Calculate adaptive threshold based on statistics
  const mean = distances.reduce((a, b) => a + b, 0) / distances.length;
  const variance = distances.reduce((sum, d) => {
    const diff = d - mean;
    return sum + diff * diff;
  }, 0) / distances.length;
  const std = Math.sqrt(variance);

  // Adaptive threshold: mean + (threshold * std)
  const adaptiveThreshold = mean + (threshold * std);

  const peaks = [];
  const minIndexDistance = Math.max(1, Math.floor(minDistance * 2)); // Assuming 0.5s windows

  for (let i = 1; i < distances.length - 1; i++) {
    const distance = distances[i];
    const prevDistance = distances[i - 1];
    const nextDistance = distances[i + 1];

    // Check if it's a local maximum and above threshold
    if (distance > prevDistance && 
        distance > nextDistance && 
        distance > adaptiveThreshold) {
      
      // Check minimum distance from previous peak
      const lastPeakIndex = peaks.length > 0 ? peaks[peaks.length - 1].index : -minIndexDistance;
      if (i - lastPeakIndex >= minIndexDistance) {
        peaks.push({
          index: i,
          distance: distance,
          confidence: calculatePeakConfidence(distance, mean, std),
          method: 'distance'
        });
      }
    }
  }

  return peaks;
}

/**
 * Fixed threshold peak detection
 */
function detectPeaksFixed(distances, threshold, minDistance) {
  const peaks = [];
  const minIndexDistance = Math.max(1, Math.floor(minDistance * 2));

  for (let i = 1; i < distances.length - 1; i++) {
    const distance = distances[i];
    const prevDistance = distances[i - 1];
    const nextDistance = distances[i + 1];

    if (distance > prevDistance && 
        distance > nextDistance && 
        distance > threshold) {
      
      const lastPeakIndex = peaks.length > 0 ? peaks[peaks.length - 1].index : -minIndexDistance;
      if (i - lastPeakIndex >= minIndexDistance) {
        peaks.push({
          index: i,
          distance: distance,
          confidence: distance, // Use distance as confidence
          method: 'distance'
        });
      }
    }
  }

  return peaks;
}

/**
 * Calculate peak confidence
 */
function calculatePeakConfidence(distance, mean, std) {
  if (std === 0) return 0.5;
  
  const zScore = (distance - mean) / std;
  // Convert z-score to confidence (0-1)
  return Math.min(1, Math.max(0, 0.5 + (zScore / 6)));
}

/**
 * Classify segments and detect transitions
 */
function classifySegmentsAndDetectTransitions(windows, distances) {
  const segments = [];
  const transitions = [];
  
  if (windows.length === 0) {
    return { segments, transitions };
  }

  // Classify each window
  const classifications = windows.map(win => {
    const classification = win.classification || { voice: 0.33, music: 0.33, silence: 0.34 };
    const dominant = getDominantClass(classification);
    return {
      window: win,
      class: dominant.class,
      confidence: dominant.confidence,
      probabilities: classification
    };
  });

  // Group consecutive windows with same class into segments
  let currentSegment = {
    start: classifications[0].window.start,
    end: classifications[0].window.end,
    class: classifications[0].class,
    confidence: classifications[0].confidence,
    windows: [classifications[0]]
  };

  for (let i = 1; i < classifications.length; i++) {
    const current = classifications[i];
    
    if (current.class === currentSegment.class) {
      // Extend current segment
      currentSegment.end = current.window.end;
      currentSegment.windows.push(current);
      currentSegment.confidence = Math.max(
        currentSegment.confidence,
        current.confidence
      );
    } else {
      // Save current segment and start new one
      segments.push(currentSegment);
      
      // Mark transition
      transitions.push({
        index: i,
        time: current.window.start,
        fromClass: currentSegment.class,
        toClass: current.class,
        confidence: (currentSegment.confidence + current.confidence) / 2,
        distance: distances[i - 1] || 0,
        method: 'class_transition'
      });

      currentSegment = {
        start: current.window.start,
        end: current.window.end,
        class: current.class,
        confidence: current.confidence,
        windows: [current]
      };
    }
  }

  // Add final segment
  if (currentSegment.windows.length > 0) {
    segments.push(currentSegment);
  }

  return { segments, transitions };
}

/**
 * Get dominant class from classification probabilities
 */
function getDominantClass(classification) {
  const classes = [
    { name: 'voice', prob: classification.voice || 0 },
    { name: 'music', prob: classification.music || 0 },
    { name: 'silence', prob: classification.silence || 0 }
  ];

  classes.sort((a, b) => b.prob - a.prob);
  const dominant = classes[0];

  return {
    class: dominant.name,
    confidence: dominant.prob,
    probabilities: classification
  };
}

/**
 * Combine distance-based and class-based change points
 */
function combineChangePoints(distancePeaks, classTransitions, minDistance) {
  const allPoints = [];

  // Add distance-based peaks
  distancePeaks.forEach(peak => {
    allPoints.push({
      index: peak.index,
      time: null, // Will be set from windows
      distance: peak.distance,
      confidence: peak.confidence,
      method: peak.method,
      type: 'distance_peak'
    });
  });

  // Add class transitions
  classTransitions.forEach(transition => {
    allPoints.push({
      index: transition.index,
      time: transition.time,
      distance: transition.distance,
      confidence: transition.confidence,
      method: transition.method,
      type: 'class_transition',
      fromClass: transition.fromClass,
      toClass: transition.toClass
    });
  });

  // Sort by index
  allPoints.sort((a, b) => a.index - b.index);

  // Merge nearby points (within minDistance)
  const merged = [];
  const minIndexDistance = Math.max(1, Math.floor(minDistance * 2));

  for (const point of allPoints) {
    if (merged.length === 0) {
      merged.push(point);
    } else {
      const lastPoint = merged[merged.length - 1];
      const indexDiff = point.index - lastPoint.index;

      if (indexDiff < minIndexDistance) {
        // Merge points - keep the one with higher confidence
        if (point.confidence > lastPoint.confidence) {
          merged[merged.length - 1] = {
            ...point,
            methods: [lastPoint.method, point.method],
            types: [lastPoint.type, point.type]
          };
        } else {
          merged[merged.length - 1] = {
            ...lastPoint,
            methods: [lastPoint.method, point.method],
            types: [lastPoint.type, point.type],
            confidence: Math.max(lastPoint.confidence, point.confidence)
          };
        }
      } else {
        merged.push(point);
      }
    }
  }

  return merged;
}

/**
 * Detect change points from audio features
 */
async function detectChangePointsFromAudio(audioFeatures, options = {}) {
  if (!audioFeatures.windows || audioFeatures.windows.length === 0) {
    return {
      changePoints: [],
      distances: [],
      segments: []
    };
  }

  return detectAudioChangePoints(audioFeatures.windows, options);
}

module.exports = {
  detectAudioChangePoints,
  detectChangePointsFromAudio,
  computeFeatureDistances,
  classifySegmentsAndDetectTransitions
};







