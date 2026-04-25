// AI Music Recommendation Service
// Recommends music generation parameters based on video/scene content

const logger = require('../utils/logger');
const Scene = require('../models/Scene');

/**
 * Recommend music parameters based on scene analysis
 */
async function recommendMusicForScene(sceneId, userId) {
  try {
    const scene = await Scene.findOne({
      _id: sceneId,
      userId
    }).lean();

    if (!scene) {
      throw new Error('Scene not found');
    }

    const recommendations = {
      mood: recommendMood(scene),
      genre: recommendGenre(scene),
      intensity: recommendIntensity(scene),
      duration: scene.duration || 60,
      bpm: recommendBPM(scene),
      provider: 'mubert' // Default, could be selected based on other factors
    };

    return recommendations;
  } catch (error) {
    logger.error('Error recommending music for scene', {
      error: error.message,
      sceneId,
      userId
    });
    throw error;
  }
}

/**
 * Recommend mood based on scene
 */
function recommendMood(scene) {
  const audioFeatures = scene.audioFeatures || {};
  const metadata = scene.metadata || {};

  // Analyze audio characteristics
  const energy = audioFeatures.energy || audioFeatures.averageEnergy || 0.5;
  const classification = audioFeatures.classification || {};

  // High energy scenes
  if (energy > 0.7) {
    return 'energetic';
  }

  // Speech-heavy scenes
  if (classification.voice > 0.7 || metadata.hasSpeech) {
    return 'calm'; // Subtle background for speech
  }

  // Music-heavy scenes
  if (classification.music > 0.6) {
    return 'energetic';
  }

  // Scene type analysis
  const label = metadata.label || '';
  if (label.includes('intro')) return 'inspiring';
  if (label.includes('outro')) return 'dramatic';
  if (label.includes('transition')) return 'calm';

  // Default
  return 'energetic';
}

/**
 * Recommend genre based on scene
 */
function recommendGenre(scene) {
  const metadata = scene.metadata || {};
  const label = metadata.label || '';

  // Scene type-based recommendations
  if (label.includes('tech') || label.includes('tutorial')) {
    return 'electronic';
  }
  if (label.includes('vlog') || label.includes('lifestyle')) {
    return 'pop';
  }
  if (label.includes('gaming')) {
    return 'electronic';
  }
  if (label.includes('fitness') || label.includes('sports')) {
    return 'electronic';
  }
  if (label.includes('cooking') || label.includes('food')) {
    return 'jazz';
  }

  // Default
  return 'electronic';
}

/**
 * Recommend intensity based on scene
 */
function recommendIntensity(scene) {
  const audioFeatures = scene.audioFeatures || {};
  const energy = audioFeatures.energy || audioFeatures.averageEnergy || 0.5;
  const metadata = scene.metadata || {};

  // High motion/energy scenes
  if (metadata.motionLevel > 0.7 || energy > 0.7) {
    return 'high';
  }

  // Speech-heavy scenes
  if (metadata.hasSpeech) {
    return 'low'; // Subtle background
  }

  // Default
  return 'medium';
}

/**
 * Recommend BPM based on scene
 */
function recommendBPM(scene) {
  const metadata = scene.metadata || {};
  const motionLevel = metadata.motionLevel || 0.5;

  // High motion = higher BPM
  if (motionLevel > 0.7) {
    return 128; // Typical EDM tempo
  } else if (motionLevel > 0.4) {
    return 110; // Medium tempo
  } else {
    return 90; // Slow tempo
  }
}

/**
 * Recommend music for multiple scenes (batch)
 */
async function recommendMusicForScenes(sceneIds, userId) {
  try {
    const scenes = await Scene.find({
      _id: { $in: sceneIds },
      userId
    }).lean();

    const recommendations = scenes.map(scene => ({
      sceneId: scene._id,
      sceneIndex: scene.sceneIndex,
      recommendations: {
        mood: recommendMood(scene),
        genre: recommendGenre(scene),
        intensity: recommendIntensity(scene),
        duration: scene.duration || 60,
        bpm: recommendBPM(scene)
      }
    }));

    return recommendations;
  } catch (error) {
    logger.error('Error recommending music for scenes', {
      error: error.message,
      sceneIds,
      userId
    });
    throw error;
  }
}

/**
 * Recommend based on video metadata
 */
function recommendMusicForVideo(videoMetadata) {
  const {
    category,
    tags = [],
    description = ''
  } = videoMetadata;

  const text = `${category || ''} ${tags.join(' ')} ${description}`.toLowerCase();

  let mood = 'energetic';
  let genre = 'electronic';
  let intensity = 'medium';

  // Category-based recommendations
  if (category) {
    if (category.includes('tech') || category.includes('tutorial')) {
      genre = 'electronic';
      mood = 'calm';
      intensity = 'low';
    } else if (category.includes('lifestyle') || category.includes('vlog')) {
      genre = 'pop';
      mood = 'happy';
      intensity = 'medium';
    } else if (category.includes('gaming')) {
      genre = 'electronic';
      mood = 'energetic';
      intensity = 'high';
    } else if (category.includes('fitness')) {
      genre = 'electronic';
      mood = 'energetic';
      intensity = 'high';
    }
  }

  // Tag-based refinements
  if (text.includes('calm') || text.includes('relax')) {
    mood = 'calm';
    intensity = 'low';
  }
  if (text.includes('energetic') || text.includes('upbeat')) {
    mood = 'energetic';
    intensity = 'high';
  }
  if (text.includes('dramatic') || text.includes('cinematic')) {
    genre = 'cinematic';
    mood = 'dramatic';
  }

  return {
    mood,
    genre,
    intensity,
    duration: 60,
    bpm: intensity === 'high' ? 128 : intensity === 'medium' ? 110 : 90
  };
}

module.exports = {
  recommendMusicForScene,
  recommendMusicForScenes,
  recommendMusicForVideo
};







