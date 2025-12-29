// Music Beat Sync Service
// Syncs music beats to visual cuts and key moments

const logger = require('../utils/logger');
const Scene = require('../models/Scene');

/**
 * Sync music beats to scene boundaries and key moments
 */
async function syncBeatsToScenes(trackId, contentId, userId, options = {}) {
  const {
    syncToCuts = true,
    syncToKeyMoments = true,
    beatOffset = 0, // Offset in seconds
    snapTolerance = 0.1 // Seconds within which to snap
  } = options;

  try {
    const MusicTrack = require('../models/MusicTrack');
    const track = await MusicTrack.findOne({
      _id: trackId,
      userId
    });

    if (!track) {
      throw new Error('Track not found');
    }

    // Get track BPM
    const bpm = await getTrackBPM(track.sourceTrackId, track.source);
    if (!bpm) {
      throw new Error('Could not determine track BPM');
    }

    // Get scenes
    const scenes = await Scene.find({
      contentId,
      userId
    }).sort({ start: 1 }).lean();

    // Calculate beat positions
    const beatsPerSecond = bpm / 60;
    const beatInterval = 1 / beatsPerSecond;

    // Find key moments
    const keyMoments = syncToKeyMoments
      ? scenes.filter(s => s.isKeyMoment).map(s => s.start)
      : [];

    // Find scene boundaries (cuts)
    const cuts = syncToCuts
      ? scenes.map(s => s.start).filter((cut, index, arr) => index === 0 || cut !== arr[index - 1])
      : [];

    // Calculate optimal start time to align beats with cuts/key moments
    const alignment = calculateBestAlignment(
      track.startTime || 0,
      cuts,
      keyMoments,
      beatInterval,
      snapTolerance,
      beatOffset
    );

    // Update track with aligned start time
    track.startTime = alignment.alignedStartTime;
    track.alignment = {
      type: 'beat',
      targetTime: alignment.bestAlignment,
      snapOffset: alignment.offset,
      syncedTo: {
        cuts: syncToCuts,
        keyMoments: syncToKeyMoments,
        beatCount: alignment.beatCount
      }
    };

    await track.save();

    return {
      track,
      alignment,
      bpm,
      beatInterval,
      syncedMoments: alignment.syncedMoments
    };
  } catch (error) {
    logger.error('Error syncing beats to scenes', {
      error: error.message,
      trackId,
      contentId,
      userId
    });
    throw error;
  }
}

/**
 * Calculate best alignment for beats
 */
function calculateBestAlignment(currentStartTime, cuts, keyMoments, beatInterval, tolerance, offset) {
  // Combine all sync points
  const syncPoints = [...cuts, ...keyMoments].sort((a, b) => a - b);

  if (syncPoints.length === 0) {
    return {
      alignedStartTime: currentStartTime,
      bestAlignment: currentStartTime,
      offset: 0,
      beatCount: 0,
      syncedMoments: []
    };
  }

  // Try aligning to each sync point
  let bestAlignment = null;
  let bestScore = -Infinity;

  syncPoints.forEach(syncPoint => {
    // Calculate how many beats from track start to sync point
    const beatsToSync = syncPoint / beatInterval;
    const beatOffset = beatsToSync % 1; // Distance to nearest beat

    // Score based on how close to a beat and importance
    const isKeyMoment = keyMoments.includes(syncPoint);
    const score = (1 - beatOffset) * (isKeyMoment ? 2 : 1); // Key moments weighted higher

    if (score > bestScore) {
      bestScore = score;
      bestAlignment = {
        syncPoint,
        beatOffset: beatOffset * beatInterval,
        isKeyMoment,
        score
      };
    }
  });

  if (!bestAlignment) {
    return {
      alignedStartTime: currentStartTime,
      bestAlignment: currentStartTime,
      offset: 0,
      beatCount: 0,
      syncedMoments: []
    };
  }

  // Calculate aligned start time
  const alignedStartTime = bestAlignment.syncPoint - bestAlignment.beatOffset + offset;

  // Count how many sync points are aligned
  const syncedMoments = syncPoints.filter(point => {
    const timeFromStart = point - alignedStartTime;
    const beatsFromStart = timeFromStart / beatInterval;
    const beatDistance = Math.abs(beatsFromStart % 1);
    return beatDistance < tolerance || beatDistance > (1 - tolerance);
  });

  return {
    alignedStartTime,
    bestAlignment: bestAlignment.syncPoint,
    offset: bestAlignment.beatOffset + offset,
    beatCount: Math.floor(bestAlignment.syncPoint / beatInterval),
    syncedMoments,
    alignmentScore: bestScore
  };
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
 * Create volume automation that follows dialogue rhythm
 */
async function syncVolumeToDialogue(trackId, contentId, userId, options = {}) {
  const {
    duckAmount = -18,
    attackTime = 0.1,
    releaseTime = 0.3
  } = options;

  try {
    // This would use the advanced ducking service
    const { applyAdvancedDucking } = require('./advancedDuckingService');
    
    const result = await applyAdvancedDucking(
      trackId,
      contentId,
      userId,
      {
        duckAmount,
        attackTime,
        releaseTime
      }
    );

    return {
      ...result,
      syncType: 'dialogue_rhythm'
    };
  } catch (error) {
    logger.error('Error syncing volume to dialogue', {
      error: error.message,
      trackId,
      userId
    });
    throw error;
  }
}

module.exports = {
  syncBeatsToScenes,
  syncVolumeToDialogue
};







