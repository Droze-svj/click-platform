// Music Restrictions Service
// Enforces licensing restrictions (no raw downloads, video-only export)

const logger = require('../utils/logger');
const MusicLicense = require('../models/MusicLicense');
const Music = require('../models/Music');

/**
 * Check if track can be downloaded as raw audio
 */
async function canDownloadRawAudio(trackId, source, userId) {
  try {
    if (source === 'user_upload') {
      // User uploads can be downloaded by owner
      const music = await Music.findOne({
        _id: trackId,
        userId
      });

      if (!music) {
        throw new Error('Track not found');
      }

      return {
        allowed: true,
        reason: 'User owns the track'
      };
    }

    if (source === 'ai_generated') {
      // AI-generated tracks can typically be downloaded
      return {
        allowed: true,
        reason: 'AI-generated track'
      };
    }

    if (source === 'licensed') {
      const license = await MusicLicense.findById(trackId).lean();
      
      if (!license) {
        throw new Error('License not found');
      }

      // Licensed tracks typically cannot be downloaded raw
      // They must be exported within video only
      return {
        allowed: false,
        reason: 'Licensed track can only be exported within video',
        restriction: 'export_in_video_only'
      };
    }

    return {
      allowed: false,
      reason: 'Unknown source type'
    };
  } catch (error) {
    logger.error('Error checking download permission', {
      error: error.message,
      trackId,
      source,
      userId
    });
    throw error;
  }
}

/**
 * Check if track can be exported
 */
async function canExportTrack(trackId, source, userId, exportType) {
  try {
    // All tracks can be exported in video
    if (exportType === 'video') {
      return {
        allowed: true,
        reason: 'Export in video is allowed'
      };
    }

    // Check raw audio export
    if (exportType === 'audio') {
      return await canDownloadRawAudio(trackId, source, userId);
    }

    return {
      allowed: false,
      reason: 'Unknown export type'
    };
  } catch (error) {
    logger.error('Error checking export permission', {
      error: error.message,
      trackId,
      source,
      userId,
      exportType
    });
    throw error;
  }
}

/**
 * Validate export request
 */
async function validateExportRequest(tracks, exportType, userId) {
  try {
    const validations = [];

    for (const track of tracks) {
      const validation = await canExportTrack(
        track.trackId || track.id,
        track.source,
        userId,
        exportType
      );

      validations.push({
        trackId: track.trackId || track.id,
        source: track.source,
        allowed: validation.allowed,
        reason: validation.reason,
        restriction: validation.restriction
      });
    }

    const allAllowed = validations.every(v => v.allowed);

    return {
      allowed: allAllowed,
      validations,
      blockedTracks: validations.filter(v => !v.allowed)
    };
  } catch (error) {
    logger.error('Error validating export request', {
      error: error.message,
      tracks,
      exportType,
      userId
    });
    throw error;
  }
}

/**
 * Get track restrictions
 */
async function getTrackRestrictions(trackId, source, userId) {
  try {
    const downloadCheck = await canDownloadRawAudio(trackId, source, userId);

    return {
      downloadRawAudio: downloadCheck.allowed,
      exportInVideoOnly: !downloadCheck.allowed,
      restrictions: downloadCheck.restriction ? [downloadCheck.restriction] : []
    };
  } catch (error) {
    logger.error('Error getting track restrictions', {
      error: error.message,
      trackId,
      source,
      userId
    });
    throw error;
  }
}

module.exports = {
  canDownloadRawAudio,
  canExportTrack,
  validateExportRequest,
  getTrackRestrictions
};







