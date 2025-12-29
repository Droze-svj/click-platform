// Advanced Visual-Audio Fusion Service
// Enhanced with ML, adaptive thresholds, and temporal consistency

const logger = require('../utils/logger');
const { fuseVisualAudioBoundaries } = require('./visualAudioFusion');

/**
 * Advanced visual-audio fusion with ML and adaptive thresholds
 */
function fuseVisualAudioBoundariesAdvanced(visualBoundaries, audioFeatures, options = {}) {
  const {
    audioThreshold = null, // Auto-tune if null
    visualThreshold = null, // Auto-tune if null
    classChangeThreshold = 0.5,
    requireBoth = false,
    useML = true, // Use ML-based decision model
    temporalConsistency = true, // Check temporal consistency
    adaptiveThresholds = true, // Learn optimal thresholds
    confidenceCalibration = true // Calibrate confidence based on agreement
  } = options;

  if (!visualBoundaries || visualBoundaries.length === 0) {
    return {
      sceneBoundaries: [],
      shotCuts: [],
      statistics: {}
    };
  }

  // Auto-tune thresholds if enabled
  let tunedThresholds = {
    audioThreshold: audioThreshold || 0.3,
    visualThreshold: visualThreshold || 0.5,
    classChangeThreshold
  };

  if (adaptiveThresholds) {
    tunedThresholds = autoTuneFusionThresholds(visualBoundaries, audioFeatures);
  }

  // Perform initial fusion
  const fusionResult = fuseVisualAudioBoundaries(
    visualBoundaries,
    audioFeatures,
    {
      ...tunedThresholds,
      requireBoth,
      audioFeatureWindow: 1.0
    }
  );

  // Apply ML-based refinement if enabled
  let refinedDecisions = fusionResult.decisions;
  if (useML) {
    refinedDecisions = applyMLFusionModel(fusionResult.decisions, audioFeatures);
  }

  // Apply temporal consistency if enabled
  if (temporalConsistency) {
    refinedDecisions = applyTemporalConsistency(refinedDecisions, visualBoundaries, audioFeatures);
  }

  // Rebuild scene boundaries and shot cuts from refined decisions
  const sceneBoundaries = [];
  const shotCuts = [];

  refinedDecisions.forEach((decision, index) => {
    const boundary = visualBoundaries[index];
    if (!boundary) return;

    if (decision.isSceneBoundary) {
      sceneBoundaries.push({
        timestamp: boundary.timestamp,
        confidence: decision.confidence,
        visualChange: decision.visualChange,
        audioDistance: decision.audioDistance,
        audioClassChange: decision.audioClassChange,
        sources: decision.sources || ['visual', 'audio'],
        decision: decision,
        mlScore: decision.mlScore,
        temporalConsistent: decision.temporalConsistent
      });
    } else {
      shotCuts.push({
        timestamp: boundary.timestamp,
        visualChange: decision.visualChange,
        audioDistance: decision.audioDistance,
        reason: decision.reason
      });
    }
  });

  // Calibrate confidence based on agreement
  if (confidenceCalibration) {
    sceneBoundaries.forEach(boundary => {
      boundary.confidence = calibrateConfidence(boundary, fusionResult.statistics);
    });
  }

  return {
    sceneBoundaries,
    shotCuts,
    decisions: refinedDecisions,
    statistics: {
      ...fusionResult.statistics,
      tunedThresholds,
      mlRefined: useML,
      temporalRefined: temporalConsistency
    }
  };
}

/**
 * Auto-tune fusion thresholds based on audio characteristics
 */
function autoTuneFusionThresholds(visualBoundaries, audioFeatures) {
  if (!audioFeatures || !audioFeatures.windows || audioFeatures.windows.length === 0) {
    return {
      audioThreshold: 0.3,
      visualThreshold: 0.5,
      classChangeThreshold: 0.5
    };
  }

  // Calculate audio feature statistics
  const { compareShotAudioFeatures } = require('./visualAudioFusion');
  const distances = [];
  const classChanges = [];

  for (let i = 1; i < visualBoundaries.length; i++) {
    const prevEnd = i > 0 ? visualBoundaries[i - 1].timestamp : 0;
    const currStart = visualBoundaries[i].timestamp;

    const comparison = compareShotAudioFeatures(
      prevEnd,
      currStart,
      audioFeatures,
      1.0
    );

    distances.push(comparison.distance);
    if (comparison.classChange) {
      classChanges.push(comparison.classChangeMagnitude);
    }
  }

  // Calculate statistics
  const meanDistance = distances.length > 0
    ? distances.reduce((a, b) => a + b, 0) / distances.length
    : 0.3;
  const stdDistance = distances.length > 0
    ? Math.sqrt(distances.reduce((sum, d) => {
        const diff = d - meanDistance;
        return sum + diff * diff;
      }, 0) / distances.length)
    : 0.1;

  // Adaptive thresholds: mean + 0.5 * std (captures ~70% of significant changes)
  const audioThreshold = Math.max(0.2, Math.min(0.5, meanDistance + 0.5 * stdDistance));

  // Visual threshold: based on visual boundary confidence distribution
  const visualConfidences = visualBoundaries.map(b => b.confidence || 0.5);
  const meanVisual = visualConfidences.reduce((a, b) => a + b, 0) / visualConfidences.length;
  const visualThreshold = Math.max(0.3, Math.min(0.7, meanVisual * 0.8));

  // Class change threshold: based on observed class changes
  const classChangeThreshold = classChanges.length > 0
    ? Math.max(0.3, Math.min(0.7, classChanges.reduce((a, b) => a + b, 0) / classChanges.length))
    : 0.5;

  logger.info('Auto-tuned fusion thresholds', {
    audioThreshold,
    visualThreshold,
    classChangeThreshold
  });

  return {
    audioThreshold,
    visualThreshold,
    classChangeThreshold
  };
}

/**
 * Apply ML-based fusion model for better decisions
 */
function applyMLFusionModel(decisions, audioFeatures) {
  return decisions.map(decision => {
    // Extract ML features from decision
    const mlFeatures = extractMLFeaturesFromDecision(decision, audioFeatures);

    // ML-based scoring (rule-based model, can be replaced with trained model)
    const mlScore = scoreDecisionWithML(mlFeatures);

    // Adjust decision based on ML score
    const adjustedConfidence = (decision.confidence * 0.7) + (mlScore * 0.3);
    const adjustedIsScene = decision.isSceneBoundary || (mlScore > 0.6);

    return {
      ...decision,
      mlScore,
      confidence: Math.max(decision.confidence, adjustedConfidence),
      isSceneBoundary: adjustedIsScene,
      mlFeatures
    };
  });
}

/**
 * Extract ML features from decision
 */
function extractMLFeaturesFromDecision(decision, audioFeatures) {
  return {
    // Visual features
    visualChange: decision.visualChange || 0,
    visualConfidence: decision.visualChange || 0,

    // Audio features
    audioDistance: decision.audioDistance || 0,
    audioClassChange: decision.audioClassChange ? 1 : 0,
    classChangeMagnitude: decision.classChangeMagnitude || 0,

    // Agreement features
    bothAgree: (decision.hasLargeVisualChange && 
                (decision.hasLargeAudioDistance || decision.hasStrongClassChange)) ? 1 : 0,
    disagreement: (decision.hasLargeVisualChange !== 
                   (decision.hasLargeAudioDistance || decision.hasStrongClassChange)) ? 1 : 0,

    // Derived features
    combinedScore: (decision.visualChange || 0) + (decision.audioDistance || 0),
    agreementStrength: calculateAgreementStrength(decision)
  };
}

/**
 * Score decision using ML model (rule-based, can be replaced with trained model)
 */
function scoreDecisionWithML(features) {
  let score = 0;

  // Strong agreement (both modalities agree)
  if (features.bothAgree) {
    score += 0.4;
  }

  // High visual change
  if (features.visualChange > 0.6) {
    score += 0.2;
  }

  // High audio distance
  if (features.audioDistance > 0.4) {
    score += 0.2;
  }

  // Strong class change
  if (features.audioClassChange && features.classChangeMagnitude > 0.6) {
    score += 0.2;
  }

  // Penalize disagreement
  if (features.disagreement) {
    score -= 0.1;
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Calculate agreement strength
 */
function calculateAgreementStrength(decision) {
  const visual = decision.hasLargeVisualChange ? 1 : 0;
  const audio = (decision.hasLargeAudioDistance || decision.hasStrongClassChange) ? 1 : 0;
  
  if (visual === audio) {
    return visual === 1 ? 1.0 : 0.0; // Both agree on change or no change
  } else {
    return 0.5; // Disagreement
  }
}

/**
 * Apply temporal consistency checking
 */
function applyTemporalConsistency(decisions, visualBoundaries, audioFeatures) {
  return decisions.map((decision, index) => {
    // Check consistency with neighboring decisions
    const prevDecision = index > 0 ? decisions[index - 1] : null;
    const nextDecision = index < decisions.length - 1 ? decisions[index + 1] : null;

    const temporalScore = calculateTemporalConsistencyScore(
      decision,
      prevDecision,
      nextDecision,
      visualBoundaries[index]
    );

    // Adjust decision if temporally inconsistent
    const isConsistent = temporalScore > 0.5;
    let adjustedDecision = { ...decision };

    if (!isConsistent && decision.isSceneBoundary) {
      // Check if this is an outlier
      const isOutlier = detectTemporalOutlier(decision, prevDecision, nextDecision);
      
      if (isOutlier) {
        // Demote to shot cut if inconsistent outlier
        adjustedDecision.isSceneBoundary = false;
        adjustedDecision.reason = 'Temporally inconsistent - demoted to shot cut';
        adjustedDecision.confidence *= 0.7;
      }
    }

    adjustedDecision.temporalConsistent = isConsistent;
    adjustedDecision.temporalScore = temporalScore;

    return adjustedDecision;
  });
}

/**
 * Calculate temporal consistency score
 */
function calculateTemporalConsistencyScore(decision, prevDecision, nextDecision, boundary) {
  let score = 0.5; // Default neutral

  // Check consistency with previous decision
  if (prevDecision) {
    const timeDiff = boundary.timestamp - (boundary.prevTimestamp || 0);
    const expectedInterval = 5.0; // Expected scene length in seconds

    // If decisions are similar and close together, might be over-segmentation
    if (timeDiff < expectedInterval * 0.5) {
          if (prevDecision.isSceneBoundary === decision.isSceneBoundary) {
            score += 0.2; // Consistent
          } else {
            score -= 0.1; // Inconsistent
          }
    }
  }

  // Check consistency with next decision
  if (nextDecision) {
    const timeDiff = (boundary.nextTimestamp || 0) - boundary.timestamp;
    const expectedInterval = 5.0;

    if (timeDiff < expectedInterval * 0.5) {
      if (nextDecision.isSceneBoundary === decision.isSceneBoundary) {
        score += 0.2;
      } else {
        score -= 0.1;
      }
    }
  }

  // Check if decision matches local pattern
  const localPattern = analyzeLocalPattern(prevDecision, decision, nextDecision);
  if (localPattern.matches) {
    score += 0.1;
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Detect temporal outlier
 */
function detectTemporalOutlier(decision, prevDecision, nextDecision) {
  if (!prevDecision || !nextDecision) {
    return false; // Can't determine if outlier without neighbors
  }

  // Outlier if this decision differs from both neighbors
  const differsFromPrev = prevDecision.isSceneBoundary !== decision.isSceneBoundary;
  const differsFromNext = nextDecision.isSceneBoundary !== decision.isSceneBoundary;

  return differsFromPrev && differsFromNext;
}

/**
 * Analyze local pattern
 */
function analyzeLocalPattern(prevDecision, currentDecision, nextDecision) {
  if (!prevDecision || !nextDecision) {
    return { matches: true, pattern: 'unknown' };
  }

  const pattern = [
    prevDecision.isSceneBoundary ? 1 : 0,
    currentDecision.isSceneBoundary ? 1 : 0,
    nextDecision.isSceneBoundary ? 1 : 0
  ].join('');

  // Common patterns: 010 (isolated), 111 (all scenes), 000 (all cuts), 101 (alternating)
  const matches = pattern === '111' || pattern === '000' || pattern === '101';

  return {
    matches,
    pattern
  };
}

/**
 * Calibrate confidence based on agreement
 */
function calibrateConfidence(boundary, statistics) {
  let confidence = boundary.confidence || 0.5;

  // Boost confidence if both modalities agree
  if (boundary.sources && boundary.sources.includes('visual') && boundary.sources.includes('audio')) {
    confidence = Math.min(1, confidence * 1.15);
  }

  // Boost if temporal consistency
  if (boundary.temporalConsistent) {
    confidence = Math.min(1, confidence * 1.1);
  }

  // Boost if ML score is high
  if (boundary.mlScore && boundary.mlScore > 0.7) {
    confidence = Math.min(1, confidence * 1.1);
  }

  // Reduce if only one modality
  if (boundary.sources && boundary.sources.length === 1) {
    confidence = confidence * 0.9;
  }

  return Math.max(0, Math.min(1, confidence));
}

/**
 * Multi-pass boundary refinement
 */
function refineBoundariesMultiPass(sceneBoundaries, audioFeatures, options = {}) {
  const {
    maxPasses = 3,
    minConfidenceGain = 0.05
  } = options;

  let refined = [...sceneBoundaries];
  let pass = 0;
  let improved = true;

  while (pass < maxPasses && improved) {
    const beforeCount = refined.length;
    const beforeAvgConfidence = refined.reduce((sum, b) => sum + (b.confidence || 0), 0) / refined.length;

    // Pass 1: Remove low-confidence boundaries
    refined = refined.filter(b => (b.confidence || 0) > 0.4);

    // Pass 2: Merge nearby boundaries
    refined = mergeNearbyBoundariesAdvanced(refined, 1.0);

    // Pass 3: Add missing boundaries from audio
    const audioOnly = detectAudioOnlyBoundariesForRefinement(refined, audioFeatures);
    refined = [...refined, ...audioOnly];
    refined.sort((a, b) => a.timestamp - b.timestamp);

    const afterCount = refined.length;
    const afterAvgConfidence = refined.reduce((sum, b) => sum + (b.confidence || 0), 0) / refined.length;

    const confidenceGain = afterAvgConfidence - beforeAvgConfidence;
    improved = (afterCount !== beforeCount) || (confidenceGain > minConfidenceGain);

    pass++;
  }

  return refined;
}

/**
 * Merge nearby boundaries with advanced logic
 */
function mergeNearbyBoundariesAdvanced(boundaries, mergeDistance) {
  if (boundaries.length === 0) return [];

  const merged = [boundaries[0]];

  for (let i = 1; i < boundaries.length; i++) {
    const current = boundaries[i];
    const last = merged[merged.length - 1];

    const timeDiff = current.timestamp - last.timestamp;

    if (timeDiff < mergeDistance) {
      // Merge: weighted by confidence
      const totalConfidence = (last.confidence || 0) + (current.confidence || 0);
      const lastWeight = (last.confidence || 0) / totalConfidence;
      const currentWeight = (current.confidence || 0) / totalConfidence;

      merged[merged.length - 1] = {
        timestamp: last.timestamp * lastWeight + current.timestamp * currentWeight,
        confidence: Math.max(last.confidence || 0, current.confidence || 0),
        visualChange: Math.max(last.visualChange || 0, current.visualChange || 0),
        audioDistance: Math.max(last.audioDistance || 0, current.audioDistance || 0),
        sources: [...new Set([...(last.sources || []), ...(current.sources || [])])]
      };
    } else {
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Detect audio-only boundaries for refinement
 */
function detectAudioOnlyBoundariesForRefinement(existingBoundaries, audioFeatures) {
  if (!audioFeatures || !audioFeatures.windows || audioFeatures.windows.length < 2) {
    return [];
  }

  const { detectAudioChangePoints } = require('./audioChangePointDetection');
  const changePoints = detectAudioChangePoints(audioFeatures.windows, {
    threshold: 0.25, // Lower threshold for refinement
    minDistance: 0.5
  });

  const audioOnly = [];

  changePoints.changePoints.forEach(point => {
    const window = audioFeatures.windows[point.index];
    if (!window) return;

    const timestamp = window.start;
    
    // Check if not too close to existing boundaries
    const tooClose = existingBoundaries.some(b => 
      Math.abs(b.timestamp - timestamp) < 1.0
    );

    if (!tooClose) {
      audioOnly.push({
        timestamp,
        confidence: (point.confidence || 0.5) * 0.7, // Lower confidence for audio-only
        visualChange: 0,
        audioDistance: point.distance || 0,
        sources: ['audio'],
        decision: {
          isSceneBoundary: true,
          reason: 'Audio-only boundary (refinement)'
        }
      });
    }
  });

  return audioOnly;
}

module.exports = {
  fuseVisualAudioBoundariesAdvanced,
  autoTuneFusionThresholds,
  applyMLFusionModel,
  applyTemporalConsistency,
  refineBoundariesMultiPass,
  calibrateConfidence
};







