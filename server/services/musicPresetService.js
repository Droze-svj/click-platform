// Music Preset Service
// Manages editing presets

const logger = require('../utils/logger');
const MusicEditingPreset = require('../models/MusicEditingPreset');

/**
 * Create system presets
 */
async function createSystemPresets() {
  try {
    const presets = [
      {
        name: 'Background Bed at -18 dB',
        description: 'Background music at -18 dB under voice',
        config: {
          volume: -18,
          autoDucking: {
            enabled: true,
            sensitivity: 0.7,
            duckAmount: -18
          },
          fitToVideoLength: true
        },
        useCases: ['background', 'vlog', 'tutorial'],
        isSystem: true,
        isPublic: true
      },
      {
        name: 'Beat Drop at 3 Seconds',
        description: 'Music starts quietly, drops at 3 seconds',
        config: {
          volume: -12,
          fadeIn: {
            enabled: true,
            duration: 3
          },
          alignment: {
            type: 'key_moment'
          }
        },
        useCases: ['intro', 'highlight'],
        isSystem: true,
        isPublic: true
      },
      {
        name: 'Smooth Fade Out',
        description: 'Fade out over last 5 seconds',
        config: {
          fadeOut: {
            enabled: true,
            duration: 5
          }
        },
        useCases: ['outro', 'transition'],
        isSystem: true,
        isPublic: true
      },
      {
        name: 'Foreground Music',
        description: 'Music at full volume, no ducking',
        config: {
          volume: 0,
          autoDucking: {
            enabled: false
          }
        },
        useCases: ['foreground', 'highlight'],
        isSystem: true,
        isPublic: true
      }
    ];

    for (const presetData of presets) {
      const existing = await MusicEditingPreset.findOne({
        name: presetData.name,
        isSystem: true
      });

      if (!existing) {
        const preset = new MusicEditingPreset(presetData);
        await preset.save();
      }
    }

    logger.info('System presets created');
  } catch (error) {
    logger.error('Error creating system presets', { error: error.message });
  }
}

/**
 * Apply preset to track
 */
async function applyPresetToTrack(trackId, presetId, userId) {
  try {
    const preset = await MusicEditingPreset.findById(presetId);
    if (!preset) {
      throw new Error('Preset not found');
    }

    // Check access (public or user's own)
    if (!preset.isPublic && !preset.isSystem && preset.userId?.toString() !== userId.toString()) {
      throw new Error('Preset access denied');
    }

    const MusicTrack = require('../models/MusicTrack');
    const track = await MusicTrack.findOne({
      _id: trackId,
      userId
    });

    if (!track) {
      throw new Error('Track not found');
    }

    // Apply preset configuration
    if (preset.config.volume !== undefined) {
      track.volume = preset.config.volume;
    }

    if (preset.config.fadeIn) {
      track.fadeIn = preset.config.fadeIn;
    }

    if (preset.config.fadeOut) {
      track.fadeOut = preset.config.fadeOut;
    }

    if (preset.config.autoDucking) {
      track.autoDucking = preset.config.autoDucking;
    }

    if (preset.config.fitToVideoLength !== undefined) {
      track.fitToVideoLength = preset.config.fitToVideoLength;
    }

    if (preset.config.alignment) {
      track.alignment.type = preset.config.alignment.type;
    }

    track.preset = {
      name: preset.name,
      appliedAt: new Date()
    };

    await track.save();

    // Update preset usage count
    preset.usageCount++;
    await preset.save();

    return { track, preset: preset.name };
  } catch (error) {
    logger.error('Error applying preset to track', {
      error: error.message,
      trackId,
      presetId,
      userId
    });
    throw error;
  }
}

/**
 * Get available presets
 */
async function getAvailablePresets(userId, options = {}) {
  const { useCase, includeSystem = true } = options;

  try {
    const query = {
      $or: [
        { userId },
        { isPublic: true }
      ]
    };

    if (includeSystem) {
      query.$or.push({ isSystem: true });
    }

    if (useCase) {
      query.useCases = useCase;
    }

    const presets = await MusicEditingPreset.find(query)
      .sort({ isSystem: -1, usageCount: -1, createdAt: -1 })
      .lean();

    return presets;
  } catch (error) {
    logger.error('Error getting presets', { error: error.message });
    return [];
  }
}

module.exports = {
  createSystemPresets,
  applyPresetToTrack,
  getAvailablePresets
};







