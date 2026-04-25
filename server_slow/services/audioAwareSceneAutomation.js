// Audio-Aware Scene Automation Service
// Filters and processes scenes based on audio characteristics

const logger = require('../utils/logger');
const Scene = require('../models/Scene');

/**
 * Filter scenes based on audio criteria
 */
function filterScenesByAudioCriteria(scenes, criteria = {}) {
  const {
    requireSpeech = false,
    minSpeechConfidence = 0.5,
    requireHighEnergy = false,
    minEnergy = 0.6,
    skipSilence = false,
    maxSilenceRatio = 0.3,
    skipNoise = false,
    requireTopicChange = false,
    audioTags = [], // Array of required audio tags (e.g., ['speech', 'music'])
    excludeTags = [] // Array of excluded tags (e.g., ['silence', 'noise'])
  } = criteria;

  return scenes.filter(scene => {
    const audioFeatures = scene.audioFeatures || {};
    const audioCues = scene.audioCues || [];
    const metadata = scene.metadata || {};

    // Check speech requirement
    if (requireSpeech) {
      const hasSpeech = metadata.hasSpeech === true || 
                       audioFeatures.classification?.voice > minSpeechConfidence ||
                       audioCues.some(cue => cue.type === 'speech_change' || cue.type?.includes('voice'));
      
      if (!hasSpeech) {
        return false;
      }
    }

    // Check energy requirement
    if (requireHighEnergy) {
      const energy = audioFeatures.energy || audioFeatures.averageEnergy || 0;
      if (energy < minEnergy) {
        return false;
      }
    }

    // Check silence ratio
    if (skipSilence) {
      const silenceRatio = calculateSilenceRatio(scene, audioCues);
      if (silenceRatio > maxSilenceRatio) {
        return false;
      }
    }

    // Check noise (low signal quality)
    if (skipNoise) {
      const isNoise = isNoiseSegment(audioFeatures, audioCues);
      if (isNoise) {
        return false;
      }
    }

    // Check required audio tags
    if (audioTags.length > 0) {
      const sceneTags = extractAudioTags(scene, audioCues, audioFeatures);
      const hasAllTags = audioTags.every(tag => sceneTags.includes(tag));
      if (!hasAllTags) {
        return false;
      }
    }

    // Check excluded tags
    if (excludeTags.length > 0) {
      const sceneTags = extractAudioTags(scene, audioCues, audioFeatures);
      const hasExcludedTag = excludeTags.some(tag => sceneTags.includes(tag));
      if (hasExcludedTag) {
        return false;
      }
    }

    // Check topic change (if text segmentation available)
    if (requireTopicChange) {
      const hasTopicChange = scene.detectionSources?.includes('text') ||
                            scene.audioCues?.some(cue => cue.type === 'topic_change');
      if (!hasTopicChange) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Calculate silence ratio for a scene
 */
function calculateSilenceRatio(scene, audioCues) {
  if (!audioCues || audioCues.length === 0) {
    return 0;
  }

  const duration = scene.duration || (scene.end - scene.start);
  if (duration === 0) return 0;

  // Find silence cues within scene
  const silenceCues = audioCues.filter(cue => 
    cue.type === 'silence' || cue.type === 'long_silence'
  );

  const totalSilenceDuration = silenceCues.reduce((sum, cue) => {
    const cueStart = cue.timestamp || 0;
    const cueEnd = (cue.timestamp || 0) + (cue.duration || 0);
    
    // Calculate overlap with scene
    const sceneStart = scene.start || 0;
    const sceneEnd = scene.end || 0;
    
    const overlapStart = Math.max(cueStart, sceneStart);
    const overlapEnd = Math.min(cueEnd, sceneEnd);
    const overlap = Math.max(0, overlapEnd - overlapStart);
    
    return sum + overlap;
  }, 0);

  return totalSilenceDuration / duration;
}

/**
 * Check if segment is noise (low signal quality)
 */
function isNoiseSegment(audioFeatures, audioCues) {
  // Check for very low energy
  const energy = audioFeatures.energy || audioFeatures.averageEnergy || 0;
  if (energy < 0.1) {
    return true;
  }

  // Check for inconsistent classification (sign of noise)
  const classification = audioFeatures.classification || {};
  const maxClassProb = Math.max(
    classification.voice || 0,
    classification.music || 0,
    classification.silence || 0
  );
  
  // If no dominant class, likely noise
  if (maxClassProb < 0.5) {
    return true;
  }

  return false;
}

/**
 * Extract audio tags from scene
 */
function extractAudioTags(scene, audioCues, audioFeatures) {
  const tags = [];

  // Classification-based tags
  const classification = audioFeatures.classification || {};
  if (classification.voice > 0.5) tags.push('speech');
  if (classification.music > 0.5) tags.push('music');
  if (classification.silence > 0.5) tags.push('silence');

  // Energy-based tags
  const energy = audioFeatures.energy || audioFeatures.averageEnergy || 0;
  if (energy > 0.7) tags.push('high_energy');
  if (energy < 0.3) tags.push('low_energy');

  // Cue-based tags
  audioCues.forEach(cue => {
    if (cue.type === 'music_change' || cue.type?.includes('music')) {
      tags.push('music');
    }
    if (cue.type === 'silence' || cue.type === 'long_silence') {
      tags.push('silence');
    }
    if (cue.type === 'applause') {
      tags.push('applause');
    }
    if (cue.type === 'speech_change' || cue.type?.includes('speech') || cue.type?.includes('voice')) {
      tags.push('speech');
    }
    if (cue.type === 'volume_change') {
      tags.push('volume_change');
    }
  });

  // Remove duplicates
  return [...new Set(tags)];
}

/**
 * Create clips from audio-filtered scenes
 */
async function createClipsFromAudioFilteredScenes(contentId, userId, criteria = {}, clipConfig = {}) {
  try {
    // Get all scenes for content
    const scenes = await Scene.find({
      contentId,
      userId
    }).sort({ sceneIndex: 1 });

    if (scenes.length === 0) {
      throw new Error('No scenes found for content');
    }

    // Filter scenes based on audio criteria
    const filteredScenes = filterScenesByAudioCriteria(scenes, criteria);

    if (filteredScenes.length === 0) {
      logger.warn('No scenes matched audio criteria', { contentId, criteria });
      return {
        clipsCreated: 0,
        scenesProcessed: scenes.length,
        scenesFiltered: 0,
        clips: []
      };
    }

    // Create clips from filtered scenes
    const { createClipsFromScenes } = require('./sceneWorkflowService');
    const clipResults = await createClipsFromScenes(
      contentId,
      userId,
      {
        sceneIds: filteredScenes.map(s => s._id),
        ...clipConfig
      }
    );

    logger.info('Created clips from audio-filtered scenes', {
      contentId,
      scenesProcessed: scenes.length,
      scenesFiltered: filteredScenes.length,
      clipsCreated: clipResults.clips?.length || 0
    });

    return {
      clipsCreated: clipResults.clips?.length || 0,
      scenesProcessed: scenes.length,
      scenesFiltered: filteredScenes.length,
      clips: clipResults.clips || []
    };
  } catch (error) {
    logger.error('Error creating clips from audio-filtered scenes', {
      error: error.message,
      contentId,
      userId
    });
    throw error;
  }
}

/**
 * Skip segments based on audio criteria
 */
async function skipSegmentsByAudioCriteria(contentId, userId, criteria = {}) {
  try {
    const scenes = await Scene.find({
      contentId,
      userId
    }).sort({ sceneIndex: 1 });

    if (scenes.length === 0) {
      return { skipped: 0, scenes: [] };
    }

    // Identify scenes to skip
    const skipCriteria = {
      skipSilence: criteria.skipSilence !== false,
      skipNoise: criteria.skipNoise !== false,
      maxSilenceRatio: criteria.maxSilenceRatio || 0.5,
      excludeTags: criteria.excludeTags || ['noise']
    };

    const scenesToSkip = filterScenesByAudioCriteria(scenes, skipCriteria);
    const skipIds = scenesToSkip.map(s => s._id);

    // Mark scenes as skipped (or remove, depending on requirements)
    if (criteria.action === 'mark_skipped') {
      await Scene.updateMany(
        { _id: { $in: skipIds } },
        { $set: { 'metadata.skipped': true, 'metadata.skipReason': 'audio_criteria' } }
      );
    }

    logger.info('Skipped segments by audio criteria', {
      contentId,
      totalScenes: scenes.length,
      skipped: scenesToSkip.length
    });

    return {
      skipped: scenesToSkip.length,
      totalScenes: scenes.length,
      skippedSceneIds: skipIds
    };
  } catch (error) {
    logger.error('Error skipping segments by audio criteria', {
      error: error.message,
      contentId,
      userId
    });
    throw error;
  }
}

/**
 * Get scenes with audio tags
 */
function enrichScenesWithAudioTags(scenes) {
  return scenes.map(scene => {
    const audioFeatures = scene.audioFeatures || {};
    const audioCues = scene.audioCues || [];
    
    const audioTags = extractAudioTags(scene, audioCues, audioFeatures);
    
    return {
      ...scene.toObject ? scene.toObject() : scene,
      audioTags,
      audioSummary: {
        dominantClass: audioFeatures.dominantClass || 
                      audioFeatures.classification?.dominantClass || 'unknown',
        energy: audioFeatures.energy || audioFeatures.averageEnergy || 0,
        hasSpeech: audioTags.includes('speech'),
        hasMusic: audioTags.includes('music'),
        hasSilence: audioTags.includes('silence'),
        isHighEnergy: audioTags.includes('high_energy')
      }
    };
  });
}

module.exports = {
  filterScenesByAudioCriteria,
  createClipsFromAudioFilteredScenes,
  skipSegmentsByAudioCriteria,
  enrichScenesWithAudioTags,
  extractAudioTags,
  calculateSilenceRatio,
  isNoiseSegment
};







