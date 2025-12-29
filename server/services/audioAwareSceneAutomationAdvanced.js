// Advanced Audio-Aware Scene Automation
// Enhanced with caching, parallel processing, and adaptive learning

const logger = require('../utils/logger');
const Scene = require('../models/Scene');
const { filterScenesByAudioCriteria, enrichScenesWithAudioTags } = require('./audioAwareSceneAutomation');

/**
 * Cache for audio feature extraction results
 */
const audioFeatureCache = new Map();
const CACHE_TTL = 3600000; // 1 hour

/**
 * Get cached audio features or extract new ones
 */
async function getCachedAudioFeatures(contentId, videoPath) {
  const cacheKey = `${contentId}_audio_features`;
  const cached = audioFeatureCache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    logger.debug('Using cached audio features', { contentId });
    return cached.features;
  }

  // Extract features
  const { extractAudioFeatures } = require('./advancedAudioFeatureExtraction');
  const features = await extractAudioFeatures(videoPath, {
    windowSize: 0.5,
    hopSize: 0.25,
    duration: null
  });

  // Cache results
  audioFeatureCache.set(cacheKey, {
    features,
    timestamp: Date.now()
  });

  return features;
}

/**
 * Parallel scene filtering with batch processing
 */
async function filterScenesByAudioCriteriaParallel(scenes, criteria, options = {}) {
  const {
    batchSize = 50,
    useCache = true,
    parallel = true
  } = options;

  if (scenes.length === 0) {
    return [];
  }

  // Process in batches for better memory management
  const batches = [];
  for (let i = 0; i < scenes.length; i += batchSize) {
    batches.push(scenes.slice(i, i + batchSize));
  }

  if (parallel && batches.length > 1) {
    // Process batches in parallel
    const batchResults = await Promise.all(
      batches.map(batch => Promise.resolve(filterScenesByAudioCriteria(batch, criteria)))
    );

    return batchResults.flat();
  } else {
    // Process sequentially
    const filtered = [];
    for (const batch of batches) {
      const batchFiltered = filterScenesByAudioCriteria(batch, criteria);
      filtered.push(...batchFiltered);
    }
    return filtered;
  }
}

/**
 * Adaptive threshold learning from user feedback
 */
class AdaptiveThresholdLearner {
  constructor(contentId, userId) {
    this.contentId = contentId;
    this.userId = userId;
    this.feedbackHistory = [];
  }

  /**
   * Record user feedback (scene promoted/demoted, clips created/deleted)
   */
  async recordFeedback(sceneId, feedback) {
    const {
      action, // 'promote', 'demote', 'clip_created', 'clip_deleted', 'scene_skipped'
      audioFeatures,
      originalCriteria,
      reason
    } = feedback;

    const feedbackRecord = {
      sceneId,
      action,
      timestamp: Date.now(),
      audioFeatures: audioFeatures || {},
      originalCriteria: originalCriteria || {},
      reason
    };

    this.feedbackHistory.push(feedbackRecord);

    // Persist feedback (could store in database)
    try {
      // Update scene with feedback
      await Scene.findByIdAndUpdate(sceneId, {
        $push: {
          'metadata.userFeedback': feedbackRecord
        }
      });
    } catch (error) {
      logger.warn('Failed to persist feedback', { error: error.message, sceneId });
    }
  }

  /**
   * Learn optimal thresholds from feedback
   */
  async learnOptimalThresholds() {
    if (this.feedbackHistory.length < 5) {
      return null; // Not enough data to learn
    }

    // Analyze feedback patterns
    const promotedScenes = this.feedbackHistory.filter(f => f.action === 'promote' || f.action === 'clip_created');
    const demotedScenes = this.feedbackHistory.filter(f => f.action === 'demote' || f.action === 'clip_deleted' || f.action === 'scene_skipped');

    if (promotedScenes.length === 0 || demotedScenes.length === 0) {
      return null;
    }

    // Calculate optimal thresholds based on feature distributions
    const promotedFeatures = this.extractFeatures(promotedScenes);
    const demotedFeatures = this.extractFeatures(demotedScenes);

    const optimalThresholds = {
      minEnergy: this.calculateOptimalThreshold(promotedFeatures.energy, demotedFeatures.energy),
      minSpeechConfidence: this.calculateOptimalThreshold(promotedFeatures.speechConfidence, demotedFeatures.speechConfidence),
      maxSilenceRatio: this.calculateOptimalThreshold(demotedFeatures.silenceRatio, promotedFeatures.silenceRatio, true), // Inverse
      similarityThreshold: this.calculateOptimalThreshold(promotedFeatures.similarity, demotedFeatures.similarity)
    };

    logger.info('Learned optimal thresholds', {
      contentId: this.contentId,
      thresholds: optimalThresholds,
      feedbackCount: this.feedbackHistory.length
    });

    return optimalThresholds;
  }

  /**
   * Extract features from feedback records
   */
  extractFeatures(feedbackRecords) {
    const features = {
      energy: [],
      speechConfidence: [],
      silenceRatio: [],
      similarity: []
    };

    feedbackRecords.forEach(record => {
      const audio = record.audioFeatures || {};
      if (audio.energy !== undefined) features.energy.push(audio.energy);
      if (audio.speechConfidence !== undefined) features.speechConfidence.push(audio.speechConfidence);
      if (audio.silenceRatio !== undefined) features.silenceRatio.push(audio.silenceRatio);
      if (audio.similarity !== undefined) features.similarity.push(audio.similarity);
    });

    return features;
  }

  /**
   * Calculate optimal threshold using percentile method
   */
  calculateOptimalThreshold(promotedValues, demotedValues, inverse = false) {
    if (promotedValues.length === 0 || demotedValues.length === 0) {
      return null;
    }

    // Sort values
    promotedValues.sort((a, b) => a - b);
    demotedValues.sort((a, b) => a - b);

    // Use 75th percentile of promoted and 25th percentile of demoted
    const promoted75 = promotedValues[Math.floor(promotedValues.length * 0.75)];
    const demoted25 = demotedValues[Math.floor(demotedValues.length * 0.25)];

    if (inverse) {
      // For inverse metrics (like silence ratio), use lower of promoted and higher of demoted
      return Math.min(promoted75 || 0.5, demoted25 || 0.5);
    } else {
      // Use higher of promoted and lower of demoted
      return Math.max(promoted75 || 0.5, demoted25 || 0.5);
    }
  }

  /**
   * Apply learned thresholds to criteria
   */
  applyLearnedThresholds(criteria, optimalThresholds) {
    if (!optimalThresholds) {
      return criteria;
    }

    const adapted = { ...criteria };

    if (optimalThresholds.minEnergy !== null && adapted.minEnergy === undefined) {
      adapted.minEnergy = optimalThresholds.minEnergy;
      adapted.requireHighEnergy = true;
    }

    if (optimalThresholds.minSpeechConfidence !== null && adapted.minSpeechConfidence === undefined) {
      adapted.minSpeechConfidence = optimalThresholds.minSpeechConfidence;
      adapted.requireSpeech = true;
    }

    if (optimalThresholds.maxSilenceRatio !== null && adapted.maxSilenceRatio === undefined) {
      adapted.maxSilenceRatio = optimalThresholds.maxSilenceRatio;
      adapted.skipSilence = true;
    }

    return adapted;
  }
}

/**
 * Enhanced audio classification with ML-like features
 */
async function enhanceAudioClassification(audioFeatures) {
  // Extract additional features for better classification
  const enhanced = {
    ...audioFeatures,
    classification: {
      ...audioFeatures.classification,
      // Confidence scores
      confidence: calculateClassificationConfidence(audioFeatures),
      // Quality indicators
      quality: {
        signalQuality: calculateSignalQuality(audioFeatures),
        clarity: calculateClarity(audioFeatures),
        consistency: calculateConsistency(audioFeatures)
      },
      // Temporal features
      temporal: {
        stability: calculateStability(audioFeatures),
        variability: calculateVariability(audioFeatures)
      }
    }
  };

  return enhanced;
}

/**
 * Calculate classification confidence
 */
function calculateClassificationConfidence(audioFeatures) {
  const classification = audioFeatures.classification || {};
  const maxProb = Math.max(
    classification.voice || 0,
    classification.music || 0,
    classification.silence || 0
  );

  // Confidence is higher when one class dominates
  return maxProb;
}

/**
 * Calculate signal quality
 */
function calculateSignalQuality(audioFeatures) {
  const energy = audioFeatures.energy || 0;
  const classification = audioFeatures.classification || {};
  
  // Higher quality if energy is moderate (not too low, not too high)
  const energyScore = 1 - Math.abs(energy - 0.6);
  
  // Higher quality if classification is confident
  const confidenceScore = calculateClassificationConfidence(audioFeatures);
  
  return (energyScore + confidenceScore) / 2;
}

/**
 * Calculate audio clarity
 */
function calculateClarity(audioFeatures) {
  const classification = audioFeatures.classification || {};
  
  // Clarity is higher when one class clearly dominates
  const maxProb = Math.max(
    classification.voice || 0,
    classification.music || 0,
    classification.silence || 0
  );
  
  // Penalize silence for clarity
  const silencePenalty = classification.silence > 0.5 ? 0.5 : 1;
  
  return maxProb * silencePenalty;
}

/**
 * Calculate consistency
 */
function calculateConsistency(audioFeatures) {
  // Placeholder - would compare with neighboring windows
  return 0.8;
}

/**
 * Calculate stability
 */
function calculateStability(audioFeatures) {
  // Placeholder - would analyze temporal variance
  return 0.75;
}

/**
 * Calculate variability
 */
function calculateVariability(audioFeatures) {
  // Placeholder - would calculate feature variance over time
  return 0.3;
}

/**
 * Create clips with adaptive learning
 */
async function createClipsWithAdaptiveLearning(contentId, userId, criteria = {}, clipConfig = {}) {
  try {
    // Initialize learner
    const learner = new AdaptiveThresholdLearner(contentId, userId);

    // Load existing feedback
    const scenes = await Scene.find({ contentId, userId });
    scenes.forEach(scene => {
      const feedback = scene.metadata?.userFeedback || [];
      feedback.forEach(f => learner.feedbackHistory.push(f));
    });

    // Learn optimal thresholds
    const optimalThresholds = await learner.learnOptimalThresholds();

    // Apply learned thresholds
    const adaptedCriteria = learner.applyLearnedThresholds(criteria, optimalThresholds);

    // Filter scenes with adapted criteria
    const filteredScenes = await filterScenesByAudioCriteriaParallel(scenes, adaptedCriteria, {
      parallel: true,
      batchSize: 50
    });

    // Create clips
    const { createClipsFromAudioFilteredScenes } = require('./audioAwareSceneAutomation');
    const result = await createClipsFromAudioFilteredScenes(contentId, userId, adaptedCriteria, clipConfig);

    // Record feedback for learning
    if (result.clipsCreated > 0) {
      filteredScenes.forEach(scene => {
        learner.recordFeedback(scene._id, {
          action: 'clip_created',
          audioFeatures: scene.audioFeatures,
          originalCriteria: criteria
        });
      });
    }

    return {
      ...result,
      adaptiveThresholds: optimalThresholds,
      adaptedCriteria
    };
  } catch (error) {
    logger.error('Error creating clips with adaptive learning', {
      error: error.message,
      contentId,
      userId
    });
    throw error;
  }
}

/**
 * Batch process multiple content items
 */
async function batchProcessAudioFiltering(contentIds, userId, criteria, options = {}) {
  const {
    parallel = true,
    maxConcurrent = 5
  } = options;

  const results = [];

  if (parallel && contentIds.length > 1) {
    // Process in batches to limit concurrency
    for (let i = 0; i < contentIds.length; i += maxConcurrent) {
      const batch = contentIds.slice(i, i + maxConcurrent);
      const batchResults = await Promise.all(
        batch.map(async contentId => {
          try {
            const scenes = await Scene.find({ contentId, userId });
            const filtered = filterScenesByAudioCriteria(scenes, criteria);
            return { contentId, success: true, filteredCount: filtered.length, totalCount: scenes.length };
          } catch (error) {
            logger.error('Error in batch audio filtering', { error: error.message, contentId });
            return { contentId, success: false, error: error.message };
          }
        })
      );
      results.push(...batchResults);
    }
  } else {
    // Process sequentially
    for (const contentId of contentIds) {
      try {
        const scenes = await Scene.find({ contentId, userId });
        const filtered = filterScenesByAudioCriteria(scenes, criteria);
        results.push({ contentId, success: true, filteredCount: filtered.length, totalCount: scenes.length });
      } catch (error) {
        logger.error('Error in batch audio filtering', { error: error.message, contentId });
        results.push({ contentId, success: false, error: error.message });
      }
    }
  }

  return results;
}

module.exports = {
  getCachedAudioFeatures,
  filterScenesByAudioCriteriaParallel,
  AdaptiveThresholdLearner,
  enhanceAudioClassification,
  createClipsWithAdaptiveLearning,
  batchProcessAudioFiltering
};







