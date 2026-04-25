// Audio Effects Service
// EQ, reverb, compression, and other audio effects

const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

/**
 * Apply audio effects to track
 */
async function applyAudioEffects(audioPath, effects, outputPath) {
  try {
    const filters = [];

    // EQ (Equalizer)
    if (effects.eq) {
      filters.push(buildEQFilter(effects.eq));
    }

    // Reverb
    if (effects.reverb) {
      filters.push(buildReverbFilter(effects.reverb));
    }

    // Compression
    if (effects.compression) {
      filters.push(buildCompressionFilter(effects.compression));
    }

    // High-pass filter
    if (effects.highpass) {
      filters.push(`highpass=f=${effects.highpass.frequency}`);
    }

    // Low-pass filter
    if (effects.lowpass) {
      filters.push(`lowpass=f=${effects.lowpass.frequency}`);
    }

    // Normalize
    if (effects.normalize) {
      filters.push('loudnorm=I=-16:TP=-1.5:LRA=11');
    }

    if (filters.length === 0) {
      // No effects, just copy file
      fs.copyFileSync(audioPath, outputPath);
      return outputPath;
    }

    // Build FFmpeg command
    const filterComplex = filters.join(',');
    const command = `ffmpeg -i "${audioPath}" -af "${filterComplex}" -y "${outputPath}"`;

    await execAsync(command);

    return outputPath;
  } catch (error) {
    logger.error('Error applying audio effects', {
      error: error.message,
      effects
    });
    throw error;
  }
}

/**
 * Build EQ filter
 */
function buildEQFilter(eqConfig) {
  // Parametric EQ using aeval filter
  // Format: aeval=f="expr1|expr2|..."
  
  const bands = eqConfig.bands || [];
  const gain = eqConfig.globalGain || 0;

  if (bands.length === 0) {
    return `volume=${gain}dB`;
  }

  // Build EQ using a more practical approach with multiple filters
  const filters = bands.map(band => {
    const { frequency, gain: bandGain, q = 1.0 } = band;
    // Use equalizer filter for each band
    return `equalizer=f=${frequency}:width_type=o:width=${q}:g=${bandGain}`;
  });

  return filters.join(',');
}

/**
 * Build reverb filter
 */
function buildReverbFilter(reverbConfig) {
  const {
    roomSize = 0.5, // 0.0 to 1.0
    damping = 0.5, // 0.0 to 1.0
    width = 1.0, // Stereo width
    wetLevel = 0.3, // 0.0 to 1.0
    dryLevel = 0.7 // 0.0 to 1.0
  } = reverbConfig;

  // Use aecho filter for simple reverb
  // Format: aecho=in_gain:out_gain:delays:decays
  const delay = Math.round(roomSize * 500); // 0-500ms
  const decay = 1.0 - damping;

  return `aecho=0.8:0.88:${delay}:0.${Math.round(decay * 10)}`;
}

/**
 * Build compression filter
 */
function buildCompressionFilter(compressionConfig) {
  const {
    threshold = -12, // dB threshold
    ratio = 4, // Compression ratio (4:1)
    attack = 5, // Attack time in ms
    release = 50, // Release time in ms
    makeupGain = 0 // Makeup gain in dB
  } = compressionConfig;

  // Use acompressor filter
  // Format: acompressor=threshold:ratio:attack:release:makeup
  return `acompressor=threshold=${threshold}dB:ratio=${ratio}:attack=${attack}:release=${release}:makeup=${makeupGain}dB`;
}

/**
 * Process track with effects
 */
async function processTrackWithEffects(trackId, userId, effects) {
  try {
    const MusicTrack = require('../models/MusicTrack');
    const { getSourceAudioUrl, processAudioTrack } = require('./musicEditingService');

    const track = await MusicTrack.findOne({
      _id: trackId,
      userId
    });

    if (!track) {
      throw new Error('Track not found');
    }

    // First process track with edits (trim, fade, volume, etc.)
    const processedResult = await processAudioTrack(trackId, userId);
    const processedPath = processedResult.processedAudioUrl;

    // Apply audio effects
    const tempDir = path.join(__dirname, '../../tmp/audio-effects');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const outputPath = path.join(tempDir, `${trackId}_effects_${Date.now()}.mp3`);
    await applyAudioEffects(processedPath, effects, outputPath);

    return {
      processedPath: outputPath,
      effects: Object.keys(effects)
    };
  } catch (error) {
    logger.error('Error processing track with effects', {
      error: error.message,
      trackId,
      userId
    });
    throw error;
  }
}

/**
 * Get effect presets
 */
function getEffectPresets() {
  return {
    'vocal_enhance': {
      name: 'Vocal Enhance',
      eq: {
        bands: [
          { frequency: 200, gain: -3, q: 1.0 }, // Reduce low end
          { frequency: 2000, gain: 3, q: 1.5 }, // Boost presence
          { frequency: 5000, gain: 2, q: 2.0 } // Boost clarity
        ]
      },
      compression: {
        threshold: -12,
        ratio: 3,
        attack: 5,
        release: 50
      }
    },
    'bass_boost': {
      name: 'Bass Boost',
      eq: {
        bands: [
          { frequency: 60, gain: 6, q: 1.0 },
          { frequency: 100, gain: 4, q: 1.0 }
        ]
      }
    },
    'warm_analog': {
      name: 'Warm Analog',
      eq: {
        bands: [
          { frequency: 5000, gain: -2, q: 1.0 }, // Slight high-end rolloff
          { frequency: 200, gain: 2, q: 1.0 } // Boost low-mids
        ]
      },
      reverb: {
        roomSize: 0.3,
        damping: 0.7,
        wetLevel: 0.2
      }
    },
    'radio_voice': {
      name: 'Radio Voice',
      highpass: { frequency: 80 },
      lowpass: { frequency: 8000 },
      compression: {
        threshold: -15,
        ratio: 4,
        attack: 3,
        release: 40,
        makeupGain: 3
      }
    }
  };
}

module.exports = {
  applyAudioEffects,
  processTrackWithEffects,
  getEffectPresets
};







