// Advanced Audio Change Point Detection
// Enhanced algorithms with smoothing, multi-scale analysis, and validation

const logger = require('../utils/logger');
const { detectAudioChangePoints } = require('./audioChangePointDetection');

/**
 * Advanced change point detection with signal processing
 */
function detectAudioChangePointsAdvanced(windows, options = {}) {
  const {
    distanceMetric = 'weighted',
    threshold = 0.3,
    minDistance = 0.5,
    detectClassTransitions = true,
    peakDetectionMethod = 'adaptive',
    smoothing = true,
    smoothingWindow = 3,
    multiScale = false,
    validateChangePoints = true,
    hierarchical = false
  } = options;

  if (!windows || windows.length < 2) {
    return {
      changePoints: [],
      distances: [],
      segments: [],
      statistics: {}
    };
  }

  // Compute raw distances
  const { computeFeatureDistances } = require('./audioChangePointDetection');
  const rawDistances = computeFeatureDistances(windows, distanceMetric);

  // Apply smoothing if enabled
  const distances = smoothing 
    ? smoothDistanceSignal(rawDistances, smoothingWindow)
    : rawDistances;

  // Multi-scale detection if enabled
  let allChangePoints = [];
  
  if (multiScale) {
    allChangePoints = detectMultiScaleChangePoints(distances, windows, options);
  } else {
    // Standard detection with enhanced peak detection
    const peaks = detectPeaksAdvanced(distances, threshold, minDistance, peakDetectionMethod);
    
    // Class transitions
    let classTransitions = [];
    if (detectClassTransitions) {
      const { classifySegmentsAndDetectTransitions } = require('./audioChangePointDetection');
      const result = classifySegmentsAndDetectTransitions(windows, distances);
      classTransitions = result.transitions;
    }
    
    // Combine change points
    const { combineChangePoints } = require('./audioChangePointDetection');
    allChangePoints = combineChangePoints(peaks, classTransitions, minDistance);
  }

  // Validate change points if enabled
  if (validateChangePoints) {
    allChangePoints = validateAndScoreChangePoints(allChangePoints, distances, windows);
  }

  // Hierarchical classification if enabled
  let hierarchy = null;
  if (hierarchical) {
    hierarchy = classifyChangePointHierarchy(allChangePoints, distances);
  }

  // Get segments
  let segments = [];
  if (detectClassTransitions) {
    const { classifySegmentsAndDetectTransitions } = require('./audioChangePointDetection');
    const result = classifySegmentsAndDetectTransitions(windows, distances);
    segments = result.segments;
  }

  return {
    changePoints: allChangePoints,
    distances: distances.map((d, i) => ({
      index: i,
      time: windows[i]?.start || 0,
      distance: d,
      rawDistance: rawDistances[i],
      isPeak: allChangePoints.some(p => p.index === i)
    })),
    segments,
    hierarchy,
    statistics: calculateAdvancedStatistics(distances, allChangePoints, segments)
  };
}

/**
 * Smooth distance signal using moving average
 */
function smoothDistanceSignal(distances, windowSize = 3) {
  if (distances.length === 0) return distances;
  
  const smoothed = [];
  const halfWindow = Math.floor(windowSize / 2);

  for (let i = 0; i < distances.length; i++) {
    let sum = 0;
    let count = 0;

    // Average over window
    for (let j = Math.max(0, i - halfWindow); j <= Math.min(distances.length - 1, i + halfWindow); j++) {
      sum += distances[j];
      count++;
    }

    smoothed.push(sum / count);
  }

  return smoothed;
}

/**
 * Advanced peak detection with prominence
 */
function detectPeaksAdvanced(distances, threshold, minDistance, method = 'adaptive') {
  if (distances.length === 0) return [];

  // Apply prominence-based detection
  const peaks = detectPeaksWithProminence(distances, threshold, minDistance, method);

  // Filter by prominence
  const prominentPeaks = peaks.filter(peak => peak.prominence > threshold * 0.5);

  return prominentPeaks;
}

/**
 * Detect peaks with prominence calculation
 */
function detectPeaksWithProminence(distances, threshold, minDistance, method) {
  const peaks = [];
  const minIndexDistance = Math.max(1, Math.floor(minDistance * 2));

  // Calculate adaptive threshold if needed
  let adaptiveThreshold = threshold;
  if (method === 'adaptive') {
    const mean = distances.reduce((a, b) => a + b, 0) / distances.length;
    const variance = distances.reduce((sum, d) => {
      const diff = d - mean;
      return sum + diff * diff;
    }, 0) / distances.length;
    const std = Math.sqrt(variance);
    adaptiveThreshold = mean + (threshold * std);
  }

  for (let i = 1; i < distances.length - 1; i++) {
    const distance = distances[i];
    const prevDistance = distances[i - 1];
    const nextDistance = distances[i + 1];

    // Check if local maximum and above threshold
    if (distance > prevDistance && distance > nextDistance && distance > adaptiveThreshold) {
      // Calculate prominence
      const prominence = calculatePeakProminence(distances, i);

      // Check minimum distance
      const lastPeakIndex = peaks.length > 0 ? peaks[peaks.length - 1].index : -minIndexDistance;
      if (i - lastPeakIndex >= minIndexDistance) {
        peaks.push({
          index: i,
          distance: distance,
          prominence: prominence,
          confidence: calculatePeakConfidence(distance, adaptiveThreshold, prominence),
          method: 'prominence_peak'
        });
      }
    }
  }

  return peaks;
}

/**
 * Calculate peak prominence
 */
function calculatePeakProminence(distances, peakIndex) {
  const peakValue = distances[peakIndex];
  
  // Find lowest point on left side
  let leftMin = peakValue;
  for (let i = peakIndex - 1; i >= 0; i--) {
    if (distances[i] < peakValue) {
      if (distances[i] < leftMin) {
        leftMin = distances[i];
      }
    } else {
      break; // Reached a higher point
    }
  }

  // Find lowest point on right side
  let rightMin = peakValue;
  for (let i = peakIndex + 1; i < distances.length; i++) {
    if (distances[i] < peakValue) {
      if (distances[i] < rightMin) {
        rightMin = distances[i];
      }
    } else {
      break; // Reached a higher point
    }
  }

  // Prominence is the minimum of the two sides
  const prominence = peakValue - Math.max(leftMin, rightMin);
  return Math.max(0, prominence);
}

/**
 * Calculate peak confidence with prominence
 */
function calculatePeakConfidence(distance, threshold, prominence) {
  const distanceScore = Math.min(1, (distance - threshold) / threshold);
  const prominenceScore = Math.min(1, prominence / threshold);
  
  // Combined confidence
  return (distanceScore * 0.6) + (prominenceScore * 0.4);
}

/**
 * Multi-scale change point detection
 */
function detectMultiScaleChangePoints(distances, windows, options) {
  const scales = [1, 2, 4]; // Different window aggregations
  const allPeaks = [];

  scales.forEach(scale => {
    // Aggregate distances at this scale
    const aggregatedDistances = aggregateDistances(distances, scale);
    
    // Detect peaks at this scale
    const peaks = detectPeaksAdvanced(
      aggregatedDistances,
      options.threshold * (1 / scale), // Lower threshold for larger scales
      options.minDistance * scale,
      options.peakDetectionMethod
    );

    // Map back to original indices
    const mappedPeaks = peaks.map(peak => ({
      ...peak,
      index: peak.index * scale,
      scale: scale,
      originalIndex: peak.index
    }));

    allPeaks.push(...mappedPeaks);
  });

  // Merge peaks from different scales
  const { combineChangePoints } = require('./audioChangePointDetection');
  return combineChangePoints(allPeaks, [], options.minDistance);
}

/**
 * Aggregate distances at different scales
 */
function aggregateDistances(distances, scale) {
  if (scale === 1) return distances;

  const aggregated = [];
  
  for (let i = 0; i < distances.length; i += scale) {
    const window = distances.slice(i, i + scale);
    if (window.length > 0) {
      // Use maximum in window (most significant change)
      aggregated.push(Math.max(...window));
    }
  }

  return aggregated;
}

/**
 * Validate and score change points
 */
function validateAndScoreChangePoints(changePoints, distances, windows) {
  return changePoints.map(point => {
    const score = calculateChangePointScore(point, distances, windows);
    
    return {
      ...point,
      validationScore: score.score,
      isValid: score.score > 0.5,
      validationFactors: score.factors
    };
  }).filter(point => point.isValid || point.validationScore > 0.3); // Keep marginal ones too
}

/**
 * Calculate change point validation score
 */
function calculateChangePointScore(changePoint, distances, windows) {
  const factors = {};
  let score = 0;

  // Factor 1: Distance magnitude (0-0.3)
  const maxDistance = Math.max(...distances);
  factors.distanceMagnitude = changePoint.distance / maxDistance;
  score += factors.distanceMagnitude * 0.3;

  // Factor 2: Local contrast (0-0.2)
  const localContrast = calculateLocalContrast(distances, changePoint.index);
  factors.localContrast = localContrast;
  score += localContrast * 0.2;

  // Factor 3: Temporal consistency (0-0.2)
  const temporalConsistency = calculateTemporalConsistency(distances, changePoint.index);
  factors.temporalConsistency = temporalConsistency;
  score += temporalConsistency * 0.2;

  // Factor 4: Classification confidence (0-0.2)
  factors.classificationConfidence = changePoint.confidence || 0.5;
  score += factors.classificationConfidence * 0.2;

  // Factor 5: Window feature consistency (0-0.1)
  if (windows[changePoint.index] && windows[changePoint.index - 1]) {
    const featureConsistency = calculateFeatureConsistency(
      windows[changePoint.index - 1],
      windows[changePoint.index]
    );
    factors.featureConsistency = featureConsistency;
    score += featureConsistency * 0.1;
  } else {
    factors.featureConsistency = 0.5;
    score += 0.05;
  }

  return {
    score: Math.min(1, score),
    factors
  };
}

/**
 * Calculate local contrast around peak
 */
function calculateLocalContrast(distances, index, window = 5) {
  if (index < window || index >= distances.length - window) {
    return 0.5; // Default for edges
  }

  const peakValue = distances[index];
  const localMean = distances
    .slice(index - window, index + window + 1)
    .reduce((a, b) => a + b, 0) / (window * 2 + 1);

  const contrast = peakValue > localMean 
    ? (peakValue - localMean) / (peakValue + localMean + 0.01)
    : 0;

  return Math.min(1, contrast * 2);
}

/**
 * Calculate temporal consistency
 */
function calculateTemporalConsistency(distances, index, window = 3) {
  if (index < window || index >= distances.length - window) {
    return 0.5;
  }

  // Check if change is consistent across nearby windows
  const localWindow = distances.slice(index - window, index + window + 1);
  const peakIndex = window;
  const peakValue = localWindow[peakIndex];

  // Count how many points in window are also high
  const highPoints = localWindow.filter(d => d > peakValue * 0.7).length;
  const consistency = highPoints / localWindow.length;

  return consistency;
}

/**
 * Calculate feature consistency between windows
 */
function calculateFeatureConsistency(window1, window2) {
  // Compare key features
  const energyDiff = Math.abs(
    (window1.energy?.energy || 0) - (window2.energy?.energy || 0)
  );

  const centroidDiff = Math.abs(
    (window1.spectral?.centroid || 0) - (window2.spectral?.centroid || 0)
  ) / 4000; // Normalize

  const classDiff = calculateClassificationDifference(
    window1.classification,
    window2.classification
  );

  // Combine differences (lower = more consistent = better)
  const totalDiff = (energyDiff + centroidDiff + classDiff) / 3;
  return 1 - Math.min(1, totalDiff); // Convert to consistency score
}

/**
 * Calculate classification difference
 */
function calculateClassificationDifference(class1, class2) {
  if (!class1 || !class2) return 0.5;

  const diff = Math.abs((class1.voice || 0) - (class2.voice || 0)) +
               Math.abs((class1.music || 0) - (class2.music || 0)) +
               Math.abs((class1.silence || 0) - (class2.silence || 0));

  return diff / 2; // Normalize to 0-1
}

/**
 * Classify change points by hierarchy (major vs minor)
 */
function classifyChangePointHierarchy(changePoints, distances) {
  if (changePoints.length === 0) {
    return { major: [], minor: [] };
  }

  // Calculate statistics
  const confidences = changePoints.map(p => p.confidence || 0);
  const meanConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
  const stdConfidence = Math.sqrt(
    confidences.reduce((sum, c) => {
      const diff = c - meanConfidence;
      return sum + diff * diff;
    }, 0) / confidences.length
  );

  const threshold = meanConfidence + stdConfidence * 0.5;

  const major = changePoints.filter(p => (p.confidence || 0) >= threshold);
  const minor = changePoints.filter(p => (p.confidence || 0) < threshold);

  return {
    major: major.map(p => ({ ...p, level: 'major' })),
    minor: minor.map(p => ({ ...p, level: 'minor' })),
    threshold
  };
}

/**
 * Calculate advanced statistics
 */
function calculateAdvancedStatistics(distances, changePoints, segments) {
  if (distances.length === 0) {
    return {};
  }

  const mean = distances.reduce((a, b) => a + b, 0) / distances.length;
  const variance = distances.reduce((sum, d) => {
    const diff = d - mean;
    return sum + diff * diff;
  }, 0) / distances.length;
  const std = Math.sqrt(variance);

  const confidences = changePoints.map(p => p.confidence || 0);
  const validations = changePoints.map(p => p.validationScore || 0);

  return {
    distance: {
      mean,
      std,
      min: Math.min(...distances),
      max: Math.max(...distances),
      median: calculateMedian(distances)
    },
    changePoints: {
      total: changePoints.length,
      averageConfidence: confidences.length > 0 
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length 
        : 0,
      averageValidationScore: validations.length > 0
        ? validations.reduce((a, b) => a + b, 0) / validations.length
        : 0,
      valid: changePoints.filter(p => p.isValid !== false).length
    },
    segments: {
      total: segments.length,
      averageLength: segments.length > 0
        ? segments.reduce((sum, s) => sum + (s.end - s.start), 0) / segments.length
        : 0
    }
  };
}

/**
 * Calculate median
 */
function calculateMedian(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Auto-tune parameters based on audio characteristics
 */
function autoTuneParameters(distances, windows) {
  const mean = distances.reduce((a, b) => a + b, 0) / distances.length;
  const std = Math.sqrt(
    distances.reduce((sum, d) => {
      const diff = d - mean;
      return sum + diff * diff;
    }, 0) / distances.length
  );

  // Adaptive threshold (mean + 1 std)
  const threshold = mean + std;

  // Estimate min distance based on audio length
  const duration = windows.length > 0 
    ? windows[windows.length - 1].end - windows[0].start
    : 1;
  const minDistance = Math.max(0.3, Math.min(1.0, duration / 100));

  // Determine if multi-scale is needed (based on variance)
  const coefficientOfVariation = std / mean;
  const multiScale = coefficientOfVariation > 0.5;

  return {
    threshold,
    minDistance,
    multiScale,
    smoothing: std / mean > 0.3, // Enable smoothing if noisy
    smoothingWindow: Math.max(3, Math.min(7, Math.ceil(std * 10)))
  };
}

module.exports = {
  detectAudioChangePointsAdvanced,
  smoothDistanceSignal,
  detectPeaksAdvanced,
  calculatePeakProminence,
  detectMultiScaleChangePoints,
  validateAndScoreChangePoints,
  classifyChangePointHierarchy,
  autoTuneParameters
};







