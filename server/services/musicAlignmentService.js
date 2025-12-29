// Music Alignment Service
// Smart alignment with scene boundaries and key moments

const logger = require('../utils/logger');
const MusicTrack = require('../models/MusicTrack');
const Scene = require('../models/Scene');

/**
 * Align track to scene boundary
 */
async function alignToSceneBoundary(trackId, sceneId, alignmentType, userId) {
  try {
    const track = await MusicTrack.findOne({
      _id: trackId,
      userId
    });

    if (!track) {
      throw new Error('Track not found');
    }

    const scene = await Scene.findOne({
      _id: sceneId,
      userId
    }).lean();

    if (!scene) {
      throw new Error('Scene not found');
    }

    let targetTime = 0;

    switch (alignmentType) {
      case 'start':
        targetTime = scene.start;
        break;
      case 'end':
        targetTime = scene.end;
        break;
      case 'center':
        targetTime = (scene.start + scene.end) / 2;
        break;
      default:
        targetTime = scene.start;
    }

    track.alignment = {
      type: 'scene_boundary',
      targetSceneId: scene._id,
      targetTime,
      snapOffset: 0
    };

    track.startTime = targetTime;
    await track.save();

    return { track, alignedTo: targetTime };
  } catch (error) {
    logger.error('Error aligning to scene boundary', {
      error: error.message,
      trackId,
      sceneId,
      userId
    });
    throw error;
  }
}

/**
 * Align track beat to key moment
 */
async function alignBeatToKeyMoment(trackId, contentId, userId) {
  try {
    const track = await MusicTrack.findOne({
      _id: trackId,
      userId
    });

    if (!track) {
      throw new Error('Track not found');
    }

    // Get key moments (scenes marked as key moments)
    const keyScenes = await Scene.find({
      contentId,
      userId,
      isKeyMoment: true
    }).sort({ start: 1 }).lean();

    if (keyScenes.length === 0) {
      throw new Error('No key moments found');
    }

    // Get track BPM (from source track metadata)
    const bpm = await getTrackBPM(track.sourceTrackId, track.source);
    if (!bpm) {
      throw new Error('Could not determine track BPM');
    }

    // Calculate beat positions
    const beatsPerSecond = bpm / 60;
    const beatInterval = 1 / beatsPerSecond;

    // Find best alignment point
    let bestAlignment = null;
    let bestScore = 0;

    keyScenes.forEach(scene => {
      // Try aligning beat to scene start
      const alignmentTime = scene.start;
      const beatsFromStart = alignmentTime / beatInterval;
      const beatOffset = beatsFromStart % 1; // Distance to nearest beat

      // Score based on how close to a beat
      const score = 1 - beatOffset;
      if (score > bestScore) {
        bestScore = score;
        bestAlignment = {
          targetTime: alignmentTime,
          sceneId: scene._id,
          beatOffset: beatOffset * beatInterval
        };
      }
    });

    if (bestAlignment) {
      track.alignment = {
        type: 'beat',
        targetSceneId: bestAlignment.sceneId,
        targetTime: bestAlignment.targetTime,
        snapOffset: bestAlignment.beatOffset
      };

      track.startTime = bestAlignment.targetTime - bestAlignment.beatOffset;
      await track.save();

      return {
        track,
        alignedTo: bestAlignment.targetTime,
        beatOffset: bestAlignment.beatOffset
      };
    }

    throw new Error('Could not find suitable alignment');
  } catch (error) {
    logger.error('Error aligning beat to key moment', {
      error: error.message,
      trackId,
      userId
    });
    throw error;
  }
}

/**
 * Get track BPM
 */
async function getTrackBPM(sourceTrackId, source) {
  try {
    if (source === 'licensed') {
      const MusicLicense = require('../models/MusicLicense');
      const track = await MusicLicense.findById(sourceTrackId).select('bpm').lean();
      return track?.bpm || null;
    } else if (source === 'ai_generated') {
      const MusicGeneration = require('../models/MusicGeneration');
      const generation = await MusicGeneration.findById(sourceTrackId)
        .select('params.bpm')
        .lean();
      return generation?.params?.bpm || null;
    }
    return null;
  } catch (error) {
    logger.warn('Error getting track BPM', { error: error.message });
    return null;
  }
}

/**
 * Snap track to nearest scene boundary
 */
async function snapToNearestSceneBoundary(trackId, contentId, userId) {
  try {
    const track = await MusicTrack.findOne({
      _id: trackId,
      userId
    });

    if (!track) {
      throw new Error('Track not found');
    }

    const scenes = await Scene.find({
      contentId,
      userId
    }).sort({ start: 1 }).lean();

    if (scenes.length === 0) {
      throw new Error('No scenes found');
    }

    // Find nearest scene boundary
    let nearestBoundary = null;
    let minDistance = Infinity;

    scenes.forEach(scene => {
      const startDistance = Math.abs(track.startTime - scene.start);
      const endDistance = Math.abs(track.startTime - scene.end);

      if (startDistance < minDistance) {
        minDistance = startDistance;
        nearestBoundary = { time: scene.start, type: 'start', sceneId: scene._id };
      }

      if (endDistance < minDistance) {
        minDistance = endDistance;
        nearestBoundary = { time: scene.end, type: 'end', sceneId: scene._id };
      }
    });

    if (nearestBoundary) {
      track.alignment = {
        type: 'scene_boundary',
        targetSceneId: nearestBoundary.sceneId,
        targetTime: nearestBoundary.time,
        snapOffset: 0
      };

      track.startTime = nearestBoundary.time;
      await track.save();

      return {
        track,
        snappedTo: nearestBoundary.time,
        boundaryType: nearestBoundary.type
      };
    }

    throw new Error('Could not find nearest boundary');
  } catch (error) {
    logger.error('Error snapping to scene boundary', {
      error: error.message,
      trackId,
      userId
    });
    throw error;
  }
}

/**
 * Align track chorus/hook to specific scene
 */
async function alignChorusToScene(trackId, sceneId, userId) {
  try {
    const track = await MusicTrack.findOne({
      _id: trackId,
      userId
    });

    if (!track) {
      throw new Error('Track not found');
    }

    const scene = await Scene.findOne({
      _id: sceneId,
      userId
    }).lean();

    if (!scene) {
      throw new Error('Scene not found');
    }

    // Estimate chorus position (typically at 1/3 of track)
    // In production, this would use audio analysis to detect chorus
    const trackDuration = track.duration;
    const estimatedChorusStart = trackDuration / 3;

    // Align chorus start to scene start
    const alignmentOffset = estimatedChorusStart;
    track.startTime = scene.start - alignmentOffset;

    track.alignment = {
      type: 'key_moment',
      targetSceneId: scene._id,
      targetTime: scene.start,
      snapOffset: -alignmentOffset
    };

    await track.save();

    return {
      track,
      chorusAlignedTo: scene.start,
      offset: alignmentOffset
    };
  } catch (error) {
    logger.error('Error aligning chorus to scene', {
      error: error.message,
      trackId,
      sceneId,
      userId
    });
    throw error;
  }
}

module.exports = {
  alignToSceneBoundary,
  alignBeatToKeyMoment,
  snapToNearestSceneBoundary,
  alignChorusToScene
};







