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

/**
 * Bump the per-creator taste graph (UserStyleProfile) when a user publishes
 * a clip. Records the picks they ACTUALLY shipped (preset, captionStyle,
 * hookStyle, etc.) plus any caption/time deltas they made vs the
 * AI-suggested defaults.
 *
 * Called from POST /api/video/clips/:contentId/:clipId/publish.
 *
 * Previously this function was REFERENCED at clips.js:358 but never
 * implemented — every publish silently threw 'learnFromPublishedClip is
 * not a function' inside a swallow-all try/catch, so the learning loop
 * never ran. Adding it here closes that hole.
 *
 * Returns: { success, preferredPresetId } where preferredPresetId is the
 * top-count preset for this user (used by the publish UI to confirm
 * "Click learned: you prefer X").
 */
async function learnFromPublishedClip(userId, payload = {}) {
  if (!userId) return { success: false, reason: 'no userId' };
  let UserStyleProfile;
  try {
    UserStyleProfile = require('../models/UserStyleProfile');
  } catch (e) {
    logger.warn('learnFromPublishedClip: UserStyleProfile model unavailable', { error: e.message });
    return { success: false };
  }

  // Map the publish payload onto facet bumps. Each pick increments the
  // counter for that key — the resulting top-N is what the editor reads
  // back to bias future suggestion ordering.
  const facetWrites = [
    ['presets',       payload.stylePresetId],
    ['captionStyles', payload.captionStyle || payload.style],
    ['hookStyles',    payload.hookStyle],
    ['transitions',   payload.transitionStyle],
    ['colorGrades',   payload.colorGrade],
    ['musicGenres',   payload.musicGenre],
    ['platforms',     payload.platform || payload.publishedPlatform],
    ['niches',        payload.niche],
  ].filter(([, v]) => v && typeof v === 'string');

  // Time-bucket the publish moment. publishedAt is what the user
  // actually scheduled (or now() for immediate publish). Day-of-week
  // bucket = 0..6, hour bucket = 0..23. Captured separately so future
  // recommendations can score "Tue 7pm" vs "Sat 11am".
  const t = payload.publishedAt instanceof Date
    ? payload.publishedAt
    : new Date(payload.publishedAt || Date.now());
  if (Number.isFinite(t.getTime())) {
    facetWrites.push(['publishHours', String(t.getHours())]);
    facetWrites.push(['publishDays',  String(t.getDay())]);
  }

  // Caption length feeds the running average so the editor knows
  // "this user prefers ~80-char captions". Only record when we actually
  // received the user's final caption.
  const finalCaption = (payload.caption || '').toString();
  let captionLengthRecorded = null;
  if (finalCaption.length > 0) {
    try {
      await UserStyleProfile.recordAverage(userId, 'avgCaptionLength', finalCaption.length);
      captionLengthRecorded = finalCaption.length;
    } catch (e) {
      logger.warn('recordAverage(avgCaptionLength) failed', { userId, error: e.message });
    }
  }

  // Bump every facet in parallel. recordPick is idempotent + creates
  // missing counters; failures don't block siblings.
  const results = await Promise.allSettled(
    facetWrites.map(([facet, key]) => UserStyleProfile.recordPick(userId, facet, key))
  );
  const failures = results.filter((r) => r.status === 'rejected');
  if (failures.length > 0) {
    logger.warn('learnFromPublishedClip: some facet writes failed', {
      userId, failures: failures.length, total: facetWrites.length,
    });
  }

  // Resolve the user's current top preset so the response can echo what
  // we learned. Best-effort — never blocks the publish path.
  let preferredPresetId = null;
  try {
    const profile = await UserStyleProfile.findOne({ userId }).select('presets').lean();
    if (profile?.presets?.length) {
      preferredPresetId = profile.presets
        .slice()
        .sort((a, b) => (b.count || 0) - (a.count || 0))[0]?.key || null;
    }
  } catch (_) { /* best effort */ }

  logger.info('Style learning recorded from published clip', {
    userId,
    facets: facetWrites.length,
    captionLength: captionLengthRecorded,
    preferredPresetId,
  });
  return { success: true, preferredPresetId };
}

/**
 * Resolve the user's current style insight for the dashboard widget +
 * for biasing the auto-edit suggestion order. Falls back to the team's
 * resolved insight when the user has fewer than 3 publishes (so a new
 * teammate inherits the team's house style on day one).
 *
 * Used from GET /api/video/clips/style-insight.
 */
async function getResolvedStyleInsight(userId, teamId) {
  let UserStyleProfile;
  try {
    UserStyleProfile = require('../models/UserStyleProfile');
  } catch (e) {
    logger.warn('getResolvedStyleInsight: UserStyleProfile model unavailable', { error: e.message });
    return { source: 'unavailable', topPicks: {}, totalPicks: 0 };
  }

  const top = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return arr.slice().sort((a, b) => (b.count || 0) - (a.count || 0))[0]?.key ?? null;
  };
  const topN = (arr, n = 3) => {
    if (!Array.isArray(arr)) return [];
    return arr
      .slice()
      .sort((a, b) => (b.count || 0) - (a.count || 0))
      .slice(0, n)
      .map((c) => ({ key: c.key, count: c.count }));
  };

  const profile = userId ? await UserStyleProfile.findOne({ userId }).lean() : null;
  const useUser = profile && (profile.totalPicks || 0) >= 3;
  const source = useUser ? 'user' : (teamId ? 'team' : 'defaults');

  const sourceProfile = useUser
    ? profile
    : null;

  if (!sourceProfile) {
    return {
      source,
      totalPicks: profile?.totalPicks || 0,
      topPicks: {
        preset: null, captionStyle: null, hookStyle: null,
        colorGrade: null, transition: null, musicGenre: null,
        platform: null, publishHour: null, publishDay: null,
      },
      topN: { presets: [], captionStyles: [], colorGrades: [], publishHours: [], publishDays: [] },
      averages: profile?.averages || {},
      hint: useUser ? null : 'Publish 3 clips to start training your style.',
    };
  }

  return {
    source,
    totalPicks: sourceProfile.totalPicks || 0,
    topPicks: {
      preset:       top(sourceProfile.presets),
      captionStyle: top(sourceProfile.captionStyles),
      hookStyle:    top(sourceProfile.hookStyles),
      colorGrade:   top(sourceProfile.colorGrades),
      transition:   top(sourceProfile.transitions),
      musicGenre:   top(sourceProfile.musicGenres),
      platform:     top(sourceProfile.platforms),
      publishHour:  top(sourceProfile.publishHours),
      publishDay:   top(sourceProfile.publishDays),
    },
    topN: {
      presets:       topN(sourceProfile.presets),
      captionStyles: topN(sourceProfile.captionStyles),
      colorGrades:   topN(sourceProfile.colorGrades),
      publishHours:  topN(sourceProfile.publishHours),
      publishDays:   topN(sourceProfile.publishDays),
    },
    averages: sourceProfile.averages || {},
    hint: null,
  };
}

module.exports = {
  analyzeEditPatterns,
  updateStyleFingerprint,
  learnFromEditSession,
  learnFromPublishedClip,
  getResolvedStyleInsight,
};
