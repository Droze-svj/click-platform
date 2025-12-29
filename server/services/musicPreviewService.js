// Music Preview Service
// Real-time preview of edited tracks

const logger = require('../utils/logger');
const MusicTrack = require('../models/MusicTrack');
const { processAudioTrack } = require('./musicEditingService');
const { getSignedUrlForFile, uploadFile } = require('./storageService');
const path = require('path');
const fs = require('fs');

/**
 * Generate preview URL for track with edits
 */
async function generatePreviewUrl(trackId, userId, options = {}) {
  const {
    startTime = 0,
    duration = 30, // Preview 30 seconds by default
    quality = 'medium' // low, medium, high
  } = options;

  try {
    const track = await MusicTrack.findOne({
      _id: trackId,
      userId
    });

    if (!track) {
      throw new Error('Track not found');
    }

    // Process track with edits
    const processedResult = await processAudioTrack(trackId, userId);
    const processedPath = processedResult.processedAudioUrl;

    // Create preview (trimmed to requested duration)
    const previewPath = await createPreviewClip(
      processedPath,
      startTime,
      duration,
      quality
    );

    // Upload to storage and get signed URL
    const uploadedUrl = await uploadFile(previewPath, {
      folder: 'audio-previews',
      expiresIn: 3600 // 1 hour
    });

    // Cleanup temp file
    if (fs.existsSync(previewPath)) {
      fs.unlinkSync(previewPath);
    }

    return {
      previewUrl: uploadedUrl,
      duration,
      expiresAt: new Date(Date.now() + 3600000)
    };
  } catch (error) {
    logger.error('Error generating preview URL', {
      error: error.message,
      trackId,
      userId
    });
    throw error;
  }
}

/**
 * Create preview clip from processed audio
 */
async function createPreviewClip(audioPath, startTime, duration, quality) {
  const tempDir = path.join(__dirname, '../../tmp/audio-previews');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const outputPath = path.join(tempDir, `preview_${Date.now()}.mp3`);

  const bitrateMap = {
    low: '64k',
    medium: '128k',
    high: '192k'
  };

  const bitrate = bitrateMap[quality] || '128k';

  const command = `ffmpeg -i "${audioPath}" -ss ${startTime} -t ${duration} -b:a ${bitrate} -y "${outputPath}"`;

  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);

  await execAsync(command);

  return outputPath;
}

/**
 * Generate preview for multiple tracks (mix preview)
 */
async function generateMixPreview(projectId, userId, options = {}) {
  const {
    startTime = 0,
    duration = 30,
    quality = 'medium'
  } = options;

  try {
    // Get all unmuted tracks
    const tracks = await MusicTrack.find({
      projectId,
      userId,
      muted: false
    }).sort({ layer: 1 }).lean();

    if (tracks.length === 0) {
      throw new Error('No tracks to preview');
    }

    // Process and mix tracks
    const processedPaths = [];
    for (const track of tracks) {
      try {
        const processed = await processAudioTrack(track._id.toString(), userId);
        processedPaths.push(processed.processedAudioUrl);
      } catch (error) {
        logger.warn('Error processing track for preview', {
          trackId: track._id,
          error: error.message
        });
      }
    }

    // Mix tracks
    const mixPath = await mixTracksForPreview(processedPaths, startTime, duration, quality);

    // Upload and get URL
    const uploadedUrl = await uploadFile(mixPath, {
      folder: 'audio-previews',
      expiresIn: 3600
    });

    // Cleanup
    if (fs.existsSync(mixPath)) {
      fs.unlinkSync(mixPath);
    }

    return {
      previewUrl: uploadedUrl,
      duration,
      trackCount: tracks.length,
      expiresAt: new Date(Date.now() + 3600000)
    };
  } catch (error) {
    logger.error('Error generating mix preview', {
      error: error.message,
      projectId,
      userId
    });
    throw error;
  }
}

/**
 * Mix tracks for preview
 */
async function mixTracksForPreview(audioPaths, startTime, duration, quality) {
  const tempDir = path.join(__dirname, '../../tmp/audio-previews');
  const outputPath = path.join(tempDir, `mix_preview_${Date.now()}.mp3`);

  if (audioPaths.length === 1) {
    // Single track, just trim it
    const command = `ffmpeg -i "${audioPaths[0]}" -ss ${startTime} -t ${duration} -y "${outputPath}"`;
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    await execAsync(command);
    return outputPath;
  }

  // Multiple tracks - mix them
  // Build complex filter for mixing
  const inputs = audioPaths.map((path, index) => `[${index}:a]`).join('');
  const amixFilter = `[0:a][1:a]amix=inputs=${audioPaths.length}:duration=longest[aout]`;

  let command = audioPaths.map((p, i) => `-i "${p}"`).join(' ');
  command += ` -filter_complex "${amixFilter}" -map "[aout]" -ss ${startTime} -t ${duration} -y "${outputPath}"`;

  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  await execAsync(command);

  return outputPath;
}

module.exports = {
  generatePreviewUrl,
  generateMixPreview
};







