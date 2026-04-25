// Music Track Template Service
// Templates for track configurations and copy/paste

const logger = require('../utils/logger');
const MusicTrack = require('../models/MusicTrack');

/**
 * Create track template from existing track
 */
async function createTrackTemplate(trackId, userId, templateName) {
  try {
    const track = await MusicTrack.findOne({
      _id: trackId,
      userId
    });

    if (!track) {
      throw new Error('Track not found');
    }

    // Extract configuration (exclude project-specific fields)
    const template = {
      name: templateName,
      source: track.source,
      // Audio processing
      volume: track.volume,
      fadeIn: track.fadeIn,
      fadeOut: track.fadeOut,
      volumeAutomation: track.volumeAutomation,
      loop: track.loop,
      // Advanced features
      autoDucking: track.autoDucking,
      alignment: {
        type: track.alignment?.type
      },
      preset: track.preset?.name
    };

    return template;
  } catch (error) {
    logger.error('Error creating track template', {
      error: error.message,
      trackId,
      userId
    });
    throw error;
  }
}

/**
 * Apply template to track
 */
async function applyTemplateToTrack(template, trackId, userId) {
  try {
    const track = await MusicTrack.findOne({
      _id: trackId,
      userId
    });

    if (!track) {
      throw new Error('Track not found');
    }

    // Apply template configuration
    if (template.volume !== undefined) track.volume = template.volume;
    if (template.fadeIn) track.fadeIn = template.fadeIn;
    if (template.fadeOut) track.fadeOut = template.fadeOut;
    if (template.volumeAutomation) track.volumeAutomation = template.volumeAutomation;
    if (template.loop) track.loop = template.loop;
    if (template.autoDucking) track.autoDucking = template.autoDucking;
    if (template.alignment) {
      track.alignment = {
        ...track.alignment,
        type: template.alignment.type
      };
    }

    await track.save();

    return { track };
  } catch (error) {
    logger.error('Error applying template to track', {
      error: error.message,
      trackId,
      userId
    });
    throw error;
  }
}

/**
 * Copy track settings to another track
 */
async function copyTrackSettings(sourceTrackId, targetTrackId, userId, options = {}) {
  const {
    copyVolume = true,
    copyFade = true,
    copyAutomation = true,
    copyDucking = true,
    copyAlignment = false // Usually don't copy alignment as it's position-specific
  } = options;

  try {
    const sourceTrack = await MusicTrack.findOne({
      _id: sourceTrackId,
      userId
    });

    if (!sourceTrack) {
      throw new Error('Source track not found');
    }

    const targetTrack = await MusicTrack.findOne({
      _id: targetTrackId,
      userId
    });

    if (!targetTrack) {
      throw new Error('Target track not found');
    }

    // Copy settings
    if (copyVolume) {
      targetTrack.volume = sourceTrack.volume;
    }

    if (copyFade) {
      targetTrack.fadeIn = sourceTrack.fadeIn;
      targetTrack.fadeOut = sourceTrack.fadeOut;
    }

    if (copyAutomation) {
      targetTrack.volumeAutomation = sourceTrack.volumeAutomation;
    }

    if (copyDucking) {
      targetTrack.autoDucking = sourceTrack.autoDucking;
    }

    if (copyAlignment && sourceTrack.alignment) {
      targetTrack.alignment = {
        type: sourceTrack.alignment.type
      };
    }

    await targetTrack.save();

    return {
      sourceTrack: sourceTrack._id,
      targetTrack: targetTrack._id,
      copiedSettings: {
        volume: copyVolume,
        fade: copyFade,
        automation: copyAutomation,
        ducking: copyDucking,
        alignment: copyAlignment
      }
    };
  } catch (error) {
    logger.error('Error copying track settings', {
      error: error.message,
      sourceTrackId,
      targetTrackId,
      userId
    });
    throw error;
  }
}

/**
 * Get common track templates
 */
function getCommonTemplates() {
  return [
    {
      name: 'Background Music',
      volume: -18,
      fadeIn: { enabled: true, duration: 2 },
      fadeOut: { enabled: true, duration: 3 },
      autoDucking: {
        enabled: true,
        sensitivity: 0.7,
        duckAmount: -18
      }
    },
    {
      name: 'Foreground Music',
      volume: 0,
      fadeIn: { enabled: true, duration: 1 },
      fadeOut: { enabled: true, duration: 2 },
      autoDucking: {
        enabled: false
      }
    },
    {
      name: 'Intro Music',
      volume: 0,
      fadeIn: { enabled: false, duration: 0 },
      fadeOut: { enabled: true, duration: 5 },
      alignment: {
        type: 'scene_boundary'
      }
    },
    {
      name: 'Outro Music',
      volume: 0,
      fadeIn: { enabled: true, duration: 3 },
      fadeOut: { enabled: true, duration: 5 },
      alignment: {
        type: 'scene_boundary'
      }
    }
  ];
}

module.exports = {
  createTrackTemplate,
  applyTemplateToTrack,
  copyTrackSettings,
  getCommonTemplates
};







