// Music License Validation Service
// Validates licenses and tracks expiration

const logger = require('../utils/logger');
const MusicLicense = require('../models/MusicLicense');
const MusicProviderConfig = require('../models/MusicProviderConfig');

/**
 * Validate license for track usage
 */
async function validateLicense(trackId, source, userId, context = {}) {
  try {
    if (source === 'licensed') {
      return await validateLicensedTrack(trackId, userId, context);
    } else if (source === 'ai_generated') {
      return await validateAIGeneratedTrack(trackId, userId);
    } else if (source === 'user_upload') {
      return await validateUserUploadTrack(trackId, userId);
    }

    return {
      valid: false,
      reason: 'Unknown source type'
    };
  } catch (error) {
    logger.error('Error validating license', {
      error: error.message,
      trackId,
      source,
      userId
    });
    return {
      valid: false,
      reason: error.message
    };
  }
}

/**
 * Validate licensed track
 */
async function validateLicensedTrack(trackId, userId, context) {
  try {
    const license = await MusicLicense.findById(trackId).lean();

    if (!license) {
      return {
        valid: false,
        reason: 'License not found'
      };
    }

    // Check if license is active
    if (license.licenseStatus !== 'active') {
      return {
        valid: false,
        reason: `License status: ${license.licenseStatus}`,
        licenseStatus: license.licenseStatus
      };
    }

    // Check expiration
    if (license.licenseEndDate && new Date(license.licenseEndDate) < new Date()) {
      return {
        valid: false,
        reason: 'License has expired',
        expiredAt: license.licenseEndDate
      };
    }

    // Check if allows embedding
    if (!license.allowsEmbedding) {
      return {
        valid: false,
        reason: 'License does not allow embedding in SaaS platform'
      };
    }

    // Check usage limits if applicable
    if (license.usageLimit) {
      const usageCount = license.usageCount || 0;
      if (usageCount >= license.usageLimit) {
        return {
          valid: false,
          reason: 'License usage limit reached',
          usageCount,
          usageLimit: license.usageLimit
        };
      }
    }

    // Platform-specific checks
    if (context.exportPlatform) {
      const allowedPlatforms = license.platforms || ['all'];
      if (!allowedPlatforms.includes('all') && !allowedPlatforms.includes(context.exportPlatform)) {
        return {
          valid: false,
          reason: `Platform ${context.exportPlatform} not allowed`,
          allowedPlatforms
        };
      }
    }

    return {
      valid: true,
      license,
      restrictions: {
        requiresAttribution: license.requiresAttribution,
        downloadRawAudio: false,
        exportInVideoOnly: true
      }
    };
  } catch (error) {
    logger.error('Error validating licensed track', {
      error: error.message,
      trackId
    });
    throw error;
  }
}

/**
 * Validate AI-generated track
 */
async function validateAIGeneratedTrack(trackId, userId) {
  try {
    const MusicGeneration = require('../models/MusicGeneration');
    const generation = await MusicGeneration.findById(trackId).lean();

    if (!generation) {
      return {
        valid: false,
        reason: 'Generation not found'
      };
    }

    // Check if user owns the generation
    if (generation.userId.toString() !== userId.toString()) {
      return {
        valid: false,
        reason: 'User does not own this track'
      };
    }

    // Check if generation is completed
    if (generation.status !== 'completed') {
      return {
        valid: false,
        reason: `Generation status: ${generation.status}`,
        status: generation.status
      };
    }

    return {
      valid: true,
      restrictions: {
        requiresAttribution: false,
        downloadRawAudio: true,
        exportInVideoOnly: false
      }
    };
  } catch (error) {
    logger.error('Error validating AI-generated track', {
      error: error.message,
      trackId
    });
    throw error;
  }
}

/**
 * Validate user upload track
 */
async function validateUserUploadTrack(trackId, userId) {
  try {
    const Music = require('../models/Music');
    const music = await Music.findById(trackId).lean();

    if (!music) {
      return {
        valid: false,
        reason: 'Track not found'
      };
    }

    // Check if user owns the track
    if (music.userId.toString() !== userId.toString()) {
      return {
        valid: false,
        reason: 'User does not own this track'
      };
    }

    // Check if license is attested
    if (!music.licenseAttestation) {
      return {
        valid: false,
        reason: 'License attestation required',
        requiresAttestation: true
      };
    }

    return {
      valid: true,
      restrictions: {
        requiresAttribution: music.requiresAttribution || false,
        downloadRawAudio: true,
        exportInVideoOnly: false
      }
    };
  } catch (error) {
    logger.error('Error validating user upload track', {
      error: error.message,
      trackId
    });
    throw error;
  }
}

/**
 * Validate multiple tracks
 */
async function validateTracks(tracks, userId, context = {}) {
  try {
    const validations = [];

    for (const track of tracks) {
      const validation = await validateLicense(
        track.trackId || track.id,
        track.source,
        userId,
        context
      );

      validations.push({
        trackId: track.trackId || track.id,
        source: track.source,
        ...validation
      });
    }

    const allValid = validations.every(v => v.valid);
    const invalidTracks = validations.filter(v => !v.valid);

    return {
      allValid,
      validations,
      invalidTracks,
      validCount: validations.filter(v => v.valid).length,
      invalidCount: invalidTracks.length
    };
  } catch (error) {
    logger.error('Error validating tracks', {
      error: error.message,
      userId
    });
    throw error;
  }
}

/**
 * Check license expiration
 */
async function checkLicenseExpiration(trackId, source) {
  try {
    if (source === 'licensed') {
      const license = await MusicLicense.findById(trackId).lean();
      
      if (!license || !license.licenseEndDate) {
        return {
          expires: false,
          expiresAt: null
        };
      }

      const expiresAt = new Date(license.licenseEndDate);
      const now = new Date();
      const daysUntilExpiration = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

      return {
        expires: expiresAt < now,
        expiresAt,
        daysUntilExpiration,
        warningThreshold: daysUntilExpiration <= 30 // Warn if expires within 30 days
      };
    }

    return {
      expires: false,
      expiresAt: null
    };
  } catch (error) {
    logger.error('Error checking license expiration', {
      error: error.message,
      trackId,
      source
    });
    return {
      expires: false,
      expiresAt: null
    };
  }
}

module.exports = {
  validateLicense,
  validateTracks,
  checkLicenseExpiration
};

