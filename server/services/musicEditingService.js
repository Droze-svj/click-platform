// Music Editing Service
// Handles audio processing for timeline tracks

const logger = require('../utils/logger');
const MusicTrack = require('../models/MusicTrack');
// Use execFile (no shell) and pass FFmpeg/FFprobe arguments as an array. Values
// sourced from the database (e.g. a track's download URL) are passed as single
// argv entries and can never be interpreted as shell syntax — this prevents
// command injection.
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

async function execFFmpeg(args) {
  try {
    const { stdout, stderr } = await execFileAsync('ffmpeg', args);
    if (stderr && !stderr.includes('Deprecated')) {
      logger.warn('FFmpeg warning', { stderr });
    }
    return stdout;
  } catch (error) {
    logger.error('FFmpeg error', { error: error.message, args });
    throw error;
  }
}

async function execFFprobe(args) {
  try {
    const { stdout } = await execFileAsync('ffprobe', args);
    return stdout;
  } catch (error) {
    logger.error('FFprobe error', { error: error.message, args });
    throw error;
  }
}
const path = require('path');
const fs = require('fs');

/**
 * Process audio track with edits (trim, fade, volume, etc.)
 */
async function processAudioTrack(trackId, userId) {
  try {
    const track = await MusicTrack.findOne({
      _id: trackId,
      userId
    });

    if (!track) {
      throw new Error('Track not found');
    }

    // Get source audio file URL
    const sourceUrl = await getSourceAudioUrl(track.sourceTrackId, track.source);

    // Build FFmpeg command for processing
    const outputPath = await buildProcessedAudio(track, sourceUrl);

    return {
      processedAudioUrl: outputPath,
      trackId: track._id
    };
  } catch (error) {
    logger.error('Error processing audio track', {
      error: error.message,
      trackId,
      userId
    });
    throw error;
  }
}

/**
 * Build processed audio with all edits applied
 */
async function buildProcessedAudio(track, sourceUrl) {
  const tempDir = path.join(__dirname, '../../tmp/audio');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const outputPath = path.join(tempDir, `${track._id}_processed.mp3`);
  const filters = [];

  // Trim
  if (track.sourceStartTime > 0 || track.sourceEndTime) {
    const start = track.sourceStartTime || 0;
    const duration = track.sourceEndTime
      ? track.sourceEndTime - start
      : track.duration;
    filters.push(`atrim=${start}:${start + duration}`);
  }

  // Fade in
  if (track.fadeIn.enabled && track.fadeIn.duration > 0) {
    filters.push(`afade=t=in:st=0:d=${track.fadeIn.duration}`);
  }

  // Volume adjustment
  if (track.volume !== 0) {
    const volumeGain = track.volume; // Already in dB
    filters.push(`volume=${volumeGain}dB`);
  }

  // Volume automation (keyframes)
  if (track.volumeAutomation && track.volumeAutomation.length > 0) {
    const automationFilter = buildVolumeAutomationFilter(track.volumeAutomation);
    if (automationFilter) {
      filters.push(automationFilter);
    }
  }

  // Fade out
  if (track.fadeOut.enabled && track.fadeOut.duration > 0) {
    const fadeStart = track.duration - track.fadeOut.duration;
    filters.push(`afade=t=out:st=${fadeStart}:d=${track.fadeOut.duration}`);
  }

  // Build FFmpeg args (passed to execFile — no shell, see execFFmpeg).
  const args = ['-i', sourceUrl];
  if (filters.length > 0) {
    args.push('-af', filters.join(','));
  }
  args.push('-y', outputPath);

  await execFFmpeg(args);

  return outputPath;
}

/**
 * Build volume automation filter
 */
function buildVolumeAutomationFilter(automationPoints) {
  if (automationPoints.length === 0) return null;

  // Sort by time
  const sorted = [...automationPoints].sort((a, b) => a.time - b.time);

  // Build volume curve string for FFmpeg
  // Format: volume=enable='between(t,start,end)':volume=value
  const curves = sorted.map((point, index) => {
    const nextTime = index < sorted.length - 1 ? sorted[index + 1].time : sorted[sorted.length - 1].time + 1;
    return `volume=enable='between(t,${point.time},${nextTime})':volume=${point.volume}dB`;
  });

  return curves.join(',');
}

/**
 * Get source audio file URL
 */
async function getSourceAudioUrl(sourceTrackId, source) {
  if (source === 'licensed') {
    const MusicLicense = require('../models/MusicLicense');
    const track = await MusicLicense.findById(sourceTrackId).lean();
    if (!track || !track.downloadUrl) {
      throw new Error('Source track not found or download not available');
    }
    return track.downloadUrl || track.previewUrl;
  } else if (source === 'ai_generated' || source === 'user_upload') {
    const Music = require('../models/Music');
    const track = await Music.findById(sourceTrackId).lean();
    if (!track || !track.file?.url) {
      throw new Error('Source track not found');
    }
    return track.file.url;
  }
  throw new Error('Invalid source type');
}

/**
 * Apply automatic ducking under speech
 */
async function applyAutoDucking(trackId, videoContentId, userId) {
  try {
    const track = await MusicTrack.findOne({
      _id: trackId,
      userId
    });

    if (!track || !track.autoDucking.enabled) {
      throw new Error('Track not found or auto-ducking not enabled');
    }

    // Get scene detection results for speech activity
    const Scene = require('../models/Scene');
    const scenes = await Scene.find({
      contentId: videoContentId,
      userId
    }).sort({ start: 1 }).lean();

    // Build volume automation based on speech activity
    const automationPoints = [];
    const duckVolume = track.autoDucking.duckAmount;
    const normalVolume = track.volume || 0;

    scenes.forEach(scene => {
      const hasSpeech = scene.metadata?.hasSpeech || 
                       (scene.audioFeatures?.classification?.voice || 0) > track.autoDucking.sensitivity;

      if (hasSpeech) {
        // Duck during speech
        automationPoints.push({
          time: Math.max(0, scene.start - track.startTime),
          volume: duckVolume
        });
        automationPoints.push({
          time: Math.min(track.duration, scene.end - track.startTime),
          volume: normalVolume
        });
      }
    });

    // Sort and merge overlapping points
    const mergedPoints = mergeAutomationPoints(automationPoints);

    // Update track with automation
    track.volumeAutomation = mergedPoints;
    await track.save();

    return { automationPoints: mergedPoints };
  } catch (error) {
    logger.error('Error applying auto-ducking', {
      error: error.message,
      trackId,
      userId
    });
    throw error;
  }
}

/**
 * Merge overlapping automation points
 */
function mergeAutomationPoints(points) {
  if (points.length === 0) return [];

  // Sort by time
  const sorted = [...points].sort((a, b) => a.time - b.time);

  // Merge consecutive points with same volume
  const merged = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0 || sorted[i].volume !== sorted[i - 1].volume) {
      merged.push(sorted[i]);
    }
  }

  return merged;
}

/**
 * Fit track to video length
 */
async function fitTrackToVideoLength(trackId, videoDuration, userId) {
  try {
    const track = await MusicTrack.findOne({
      _id: trackId,
      userId
    });

    if (!track) {
      throw new Error('Track not found');
    }

    // Calculate source duration
    const sourceDuration = track.sourceEndTime 
      ? track.sourceEndTime - track.sourceStartTime
      : null; // Will need to get from source file

    if (!sourceDuration) {
      // Get from source file metadata
      const sourceUrl = await getSourceAudioUrl(track.sourceTrackId, track.source);
      const metadata = await getAudioMetadata(sourceUrl);
      track.sourceDuration = metadata.duration;
    }

    // Enable looping if track is shorter than video
    if (track.sourceDuration < videoDuration) {
      track.loop.enabled = true;
      track.loop.count = Math.ceil(videoDuration / track.sourceDuration);
      track.duration = videoDuration;
    } else {
      // Trim to video length
      track.sourceEndTime = track.sourceStartTime + videoDuration;
      track.duration = videoDuration;
      track.loop.enabled = false;
    }

    track.fitToVideoLength = true;
    await track.save();

    return { track };
  } catch (error) {
    logger.error('Error fitting track to video length', {
      error: error.message,
      trackId,
      userId
    });
    throw error;
  }
}

/**
 * Get audio metadata
 */
async function getAudioMetadata(audioUrl) {
  const output = await execFFprobe([
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    audioUrl,
  ]);
  const duration = parseFloat(output.trim());

  return { duration };
}

/**
 * Render final audio mix (all tracks combined)
 */
async function renderAudioMix(projectId, userId) {
  try {
    const tracks = await MusicTrack.find({
      projectId,
      userId,
      muted: false
    }).sort({ layer: 1, startTime: 1 }).lean();

    const SFXTrack = require('../models/SFXTrack');
    const sfxTracks = await SFXTrack.find({
      projectId,
      userId,
      muted: false
    }).sort({ layer: 1, startTime: 1 }).lean();

    // Process each track
    const processedTracks = await Promise.all(
      tracks.map(track => processAudioTrack(track._id, userId))
    );

    // Mix tracks with FFmpeg
    // This is a simplified version - production would use more sophisticated mixing
    const mixPath = await mixAudioTracks(processedTracks, tracks);

    return { mixUrl: mixPath };
  } catch (error) {
    logger.error('Error rendering audio mix', {
      error: error.message,
      projectId,
      userId
    });
    throw error;
  }
}

/**
 * Mix multiple audio tracks
 */
async function mixAudioTracks(processedTracks, trackConfigs) {
  // Complex FFmpeg mixing would go here
  // Simplified: use amix filter
  const tempDir = path.join(__dirname, '../../tmp/audio');
  const outputPath = path.join(tempDir, `mix_${Date.now()}.mp3`);

  // For now, return first track (production would mix all)
  return processedTracks[0]?.processedAudioUrl || null;
}

module.exports = {
  processAudioTrack,
  applyAutoDucking,
  fitTrackToVideoLength,
  renderAudioMix,
  getSourceAudioUrl
};

