// Music Mood Transition Service
// Creates smooth mood transitions throughout video

const logger = require('../utils/logger');
const Scene = require('../models/Scene');
const MusicTrack = require('../models/MusicTrack');

/**
 * Create mood transitions across video
 */
async function createMoodTransitions(contentId, userId, options = {}) {
  const {
    trackId,
    transitionSmoothness = 0.5, // 0-1, higher = smoother
    preserveTheme = true
  } = options;

  try {
    // Get scenes
    const scenes = await Scene.find({
      contentId,
      userId
    }).sort({ start: 1 }).lean();

    if (scenes.length === 0) {
      throw new Error('No scenes found');
    }

    // Analyze mood for each scene
    const sceneMoods = scenes.map(scene => {
      const metadata = scene.metadata || {};
      const audioFeatures = scene.audioFeatures || {};
      
      const mood = determineSceneMood(scene, metadata, audioFeatures);
      return {
        sceneId: scene._id,
        start: scene.start,
        end: scene.end,
        mood,
        energy: metadata.motionLevel || audioFeatures.energy || 0.5
      };
    });

    // Detect mood changes
    const moodChanges = detectMoodChanges(sceneMoods);

    // Create transition points
    const transitions = createTransitionPoints(moodChanges, transitionSmoothness);

    // Get or create track
    let track;
    if (trackId) {
      track = await MusicTrack.findOne({ _id: trackId, userId });
    }

    if (!track) {
      throw new Error('Track not found');
    }

    // Build volume automation for mood transitions
    const automation = buildMoodTransitionAutomation(
      transitions,
      track.duration,
      transitionSmoothness
    );

    // Update track with mood transitions
    track.volumeAutomation = [
      ...(track.volumeAutomation || []),
      ...automation
    ].sort((a, b) => a.time - b.time);

    await track.save();

    return {
      track,
      transitions,
      sceneMoods,
      automationPoints: automation.length
    };
  } catch (error) {
    logger.error('Error creating mood transitions', {
      error: error.message,
      contentId,
      userId
    });
    throw error;
  }
}

/**
 * Determine mood for a scene
 */
function determineSceneMood(scene, metadata, audioFeatures) {
  const label = metadata.label || '';
  const motionLevel = metadata.motionLevel || 0.5;
  const energy = audioFeatures.energy || audioFeatures.averageEnergy || 0.5;

  if (label.includes('intro')) return 'inspiring';
  if (label.includes('outro')) return 'dramatic';
  if (motionLevel > 0.7 || energy > 0.7) return 'energetic';
  if (motionLevel < 0.3 || energy < 0.3) return 'calm';
  if (label.includes('talking')) return 'serious';

  return 'balanced';
}

/**
 * Detect mood changes between scenes
 */
function detectMoodChanges(sceneMoods) {
  const changes = [];

  for (let i = 0; i < sceneMoods.length - 1; i++) {
    const current = sceneMoods[i];
    const next = sceneMoods[i + 1];

    if (current.mood !== next.mood) {
      changes.push({
        transitionTime: current.end, // Transition at scene boundary
        fromMood: current.mood,
        toMood: next.mood,
        fromEnergy: current.energy,
        toEnergy: next.energy,
        sceneIndex: i
      });
    }
  }

  return changes;
}

/**
 * Create transition points
 */
function createTransitionPoints(moodChanges, smoothness) {
  const transitionDuration = smoothness * 5; // 0-5 seconds transition

  return moodChanges.map(change => ({
    ...change,
    transitionStart: change.transitionTime - (transitionDuration / 2),
    transitionEnd: change.transitionTime + (transitionDuration / 2),
    duration: transitionDuration
  }));
}

/**
 * Build volume automation for mood transitions
 */
function buildMoodTransitionAutomation(transitions, trackDuration, smoothness) {
  const automation = [];
  const transitionDuration = smoothness * 5;

  transitions.forEach(transition => {
    // Energy-based volume adjustment
    const energyDiff = transition.toEnergy - transition.fromEnergy;
    const volumeChange = energyDiff * 6; // Scale to dB

    // Create smooth transition curve
    const steps = Math.ceil(transitionDuration * 10); // 10 steps per second

    for (let i = 0; i <= steps; i++) {
      const t = transition.transitionStart + (i / 10);
      if (t < 0 || t > trackDuration) continue;

      const progress = i / steps;
      // Smooth curve (ease-in-out)
      const easedProgress = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const volume = volumeChange * easedProgress;

      automation.push({
        time: t,
        volume: volume
      });
    }
  });

  // Merge close points
  return mergeAutomationPoints(automation);
}

/**
 * Merge automation points
 */
function mergeAutomationPoints(points) {
  if (points.length === 0) return [];

  const sorted = [...points].sort((a, b) => a.time - b.time);
  const merged = [];
  const tolerance = 0.05; // 50ms

  for (let i = 0; i < sorted.length; i++) {
    const point = sorted[i];

    if (merged.length === 0) {
      merged.push(point);
      continue;
    }

    const lastPoint = merged[merged.length - 1];

    if (Math.abs(point.time - lastPoint.time) < tolerance) {
      // Update volume if significantly different
      if (Math.abs(point.volume - lastPoint.volume) > 0.5) {
        lastPoint.volume = point.volume;
      }
    } else {
      merged.push(point);
    }
  }

  return merged;
}

module.exports = {
  createMoodTransitions
};







