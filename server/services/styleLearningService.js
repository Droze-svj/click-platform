/**
 * Style Learning Service
 * Analyzes manual editing patterns to build a personalized AI "Style Fingerprint"
 */

const UserPreferences = require('../models/UserPreferences');
const logger = require('../utils/logger');

const LEARNING_RATE = 0.3; // 0.3 means 30% weight to new data, 70% to historical profile

/**
 * Analyzes a manual edit session state to extract stylistic patterns
 * @param {Object} editState - The timeline/editor state
 * @returns {Object} Extracted patterns
 */
function analyzeEditPatterns(editState) {
  const patterns = {
    transitions: {},
    pacing: 1.0,
    captionStyle: '',
    silenceThreshold: 0
  };

  if (!editState) return patterns;

  // 1. Analyze Transitions
  if (editState.transitions && Array.isArray(editState.transitions)) {
    editState.transitions.forEach(t => {
      const type = t.type || 'fade';
      patterns.transitions[type] = (patterns.transitions[type] || 0) + 1;
    });
    
    // Normalize transition counts to weights
    const total = Object.values(patterns.transitions).reduce((a, b) => a + b, 0);
    if (total > 0) {
      Object.keys(patterns.transitions).forEach(k => {
        patterns.transitions[k] /= total;
      });
    }
  }

  // 2. Analyze Pacing (Average segment duration)
  if (editState.segments && editState.segments.length > 0) {
    const avgDuration = editState.segments.reduce((acc, s) => acc + (s.duration || 0), 0) / editState.segments.length;
    // Pacing bias: < 1.0 means faster cuts (shorter segments), > 1.0 means slower
    // Baseline is 5s per segment
    patterns.pacing = Math.max(0.5, Math.min(2.0, avgDuration / 5.0));
  }

  // 3. Caption Style
  if (editState.captionSettings && editState.captionSettings.style) {
    patterns.captionStyle = editState.captionSettings.style;
  }

  return patterns;
}

/**
 * Updates a user's style fingerprint with new pattern data using EMA
 * @param {string} userId - User identifier
 * @param {Object} newPatterns - Data from analyzeEditPatterns
 */
async function updateStyleFingerprint(userId, newPatterns) {
  try {
    let prefs = await UserPreferences.findOne({ userId });
    
    if (!prefs) {
      prefs = new UserPreferences({ userId });
    }

    if (!prefs.styleFingerprint || !prefs.styleFingerprint.learningEnabled) {
      logger.info('Style learning skipped: Disabled or not initialized', { userId });
      return;
    }

    const currentFingerprint = prefs.styleFingerprint.toObject();

    // 1. Update Transition Preferences (EMA)
    const updatedTransitions = currentFingerprint.preferredTransitions || {};
    
    // Merge new transition weights
    Object.keys(newPatterns.transitions).forEach(type => {
      const newVal = newPatterns.transitions[type];
      const oldVal = updatedTransitions[type] || 0;
      updatedTransitions[type] = (oldVal * (1 - LEARNING_RATE)) + (newVal * LEARNING_RATE);
    });

    // 2. Update Pacing Bias (EMA)
    const oldPacing = currentFingerprint.pacingBias || 1.0;
    const newPacing = (oldPacing * (1 - LEARNING_RATE)) + (newPatterns.pacing * LEARNING_RATE);

    // 3. Update Caption Style (Categorical - most recent wins or frequency?)
    // For simplicity, we use the most recent style if it's explicitly set
    const updatedCaptionStyle = newPatterns.captionStyle || currentFingerprint.captionStylePreference;

    // Update document
    prefs.styleFingerprint.preferredTransitions = updatedTransitions;
    prefs.styleFingerprint.pacingBias = newPacing;
    prefs.styleFingerprint.captionStylePreference = updatedCaptionStyle;
    prefs.styleFingerprint.lastUpdated = new Date();

    await prefs.save();
    logger.info('Style fingerprint updated', { userId, pacing: newPacing.toFixed(2) });

  } catch (error) {
    logger.error('Error updating style fingerprint', { userId, error: error.message });
  }
}

/**
 * High-level function to trigger learning from an edit session
 */
async function learnFromEditSession(userId, editState) {
  if (!userId || !editState) return;
  
  const patterns = analyzeEditPatterns(editState);
  await updateStyleFingerprint(userId, patterns);
}

module.exports = {
  analyzeEditPatterns,
  updateStyleFingerprint,
  learnFromEditSession
};
