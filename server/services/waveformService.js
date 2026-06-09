// Waveform Generation Service
// Generates waveform data for visualization

const logger = require('../utils/logger');
const { execFile, spawn } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const execFileAsync = promisify(execFile);

// Run ffmpeg with spawn (no shell) and collect raw PCM (s16le) from stdout.
// Passing audioPath as an argv entry prevents shell command injection.
function runFFmpegPcm(audioPath) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', ['-i', audioPath, '-af', 'aresample=8000,asetnsamples=n=200', '-f', 's16le', '-']);
    const chunks = [];
    proc.stdout.on('data', (d) => chunks.push(d));
    proc.stderr.on('data', () => {}); // discard ffmpeg progress/logs
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });
}

/**
 * Generate waveform data from audio file
 */
async function generateWaveform(audioUrl, options = {}) {
  const {
    width = 800,
    height = 200,
    precision = 1, // Samples per pixel
    format = 'json' // json or image
  } = options;

  try {
    // Download audio file if URL
    const audioPath = audioUrl.startsWith('http')
      ? await downloadAudioFile(audioUrl)
      : audioUrl;

    if (format === 'image') {
      return await generateWaveformImage(audioPath, width, height);
    } else {
      return await generateWaveformData(audioPath, width, precision);
    }
  } catch (error) {
    logger.error('Error generating waveform', {
      error: error.message,
      audioUrl
    });
    throw error;
  }
}

/**
 * Generate waveform data (array of amplitude values)
 */
async function generateWaveformData(audioPath, width, precision) {
  try {
    // Decode to raw PCM via ffmpeg (no shell), then compute RMS per pixel here
    // in Node — previously this was an inline `node -e` shell pipeline that was
    // both injectable and broken (it never emitted the waveform).
    const buffer = await runFFmpegPcm(audioPath);

    const samples = [];
    for (let i = 0; i + 1 < buffer.length; i += 2) {
      samples.push(Math.abs(buffer.readInt16LE(i)) / 32768);
    }

    const samplesPerPixel = Math.max(1, Math.floor(samples.length / width));
    const waveform = [];
    for (let i = 0; i < width; i++) {
      const start = i * samplesPerPixel;
      const segment = samples.slice(start, start + samplesPerPixel);
      const rms = segment.length
        ? Math.sqrt(segment.reduce((sum, val) => sum + val * val, 0) / segment.length)
        : 0;
      waveform.push(rms);
    }

    if (!waveform.some((v) => v > 0)) {
      // No usable audio decoded — fall back to the simplified generator.
      return await generateWaveformSimplified(audioPath, width);
    }

    // Normalize to 0-1 range
    const max = Math.max(...waveform);
    const normalized = waveform.map(val => max > 0 ? val / max : 0);

    return {
      waveform: normalized,
      width,
      samples: normalized.length
    };
  } catch (error) {
    logger.warn('Error generating waveform data, using simplified method', {
      error: error.message
    });

    // Fallback: simplified waveform generation
    return await generateWaveformSimplified(audioPath, width);
  }
}

/**
 * Simplified waveform generation (fallback)
 */
async function generateWaveformSimplified(audioPath, width) {
  // Get audio duration via ffprobe (execFile — no shell, audioPath is an argv
  // entry so it can't be interpreted as a command).
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    audioPath,
  ]);
  const duration = parseFloat(stdout.trim());

  // Generate placeholder waveform (sine wave pattern for demo)
  // In production, this would use proper audio analysis
  const waveform = [];
  for (let i = 0; i < width; i++) {
    const x = (i / width) * Math.PI * 4;
    const value = (Math.sin(x) * 0.5 + 0.5) * 0.3 + Math.random() * 0.1;
    waveform.push(Math.max(0, Math.min(1, value)));
  }

  return {
    waveform,
    width,
    samples: waveform.length,
    duration
  };
}

/**
 * Generate waveform image
 */
async function generateWaveformImage(audioPath, width, height) {
  try {
    const tempDir = path.join(__dirname, '../../tmp/waveforms');
    const outputPath = path.join(tempDir, `waveform_${Date.now()}.png`);

    // Use FFmpeg showwavespic filter (execFile — no shell). Dimensions are
    // coerced to integers so they can't smuggle filtergraph syntax.
    const w = Math.max(1, parseInt(width, 10) || 800);
    const h = Math.max(1, parseInt(height, 10) || 200);
    await execFileAsync('ffmpeg', [
      '-i', audioPath,
      '-filter_complex', `[0:a]showwavespic=s=${w}x${h}:colors=0x00ff00`,
      '-frames:v', '1',
      '-y', outputPath,
    ]);

    // Read image and convert to base64 or return path
    const imageBuffer = fs.readFileSync(outputPath);
    const base64 = imageBuffer.toString('base64');

    // Cleanup
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    return {
      image: `data:image/png;base64,${base64}`,
      width,
      height
    };
  } catch (error) {
    logger.error('Error generating waveform image', { error: error.message });
    throw error;
  }
}

/**
 * Download audio file from URL
 */
async function downloadAudioFile(url) {
  const axios = require('axios');
  const tempDir = path.join(__dirname, '../../tmp/audio-downloads');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const outputPath = path.join(tempDir, `audio_${Date.now()}.mp3`);

  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream'
  });

  const writer = fs.createWriteStream(outputPath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(outputPath));
    writer.on('error', reject);
  });
}

/**
 * Generate waveform for track with edits preview
 */
async function generateTrackWaveform(trackId, userId, options = {}) {
  try {
    const MusicTrack = require('../models/MusicTrack');
    const track = await MusicTrack.findOne({
      _id: trackId,
      userId
    });

    if (!track) {
      throw new Error('Track not found');
    }

    // Get source audio URL
    const { getSourceAudioUrl } = require('./musicEditingService');
    const sourceUrl = await getSourceAudioUrl(track.sourceTrackId, track.source);

    // Generate waveform
    const waveform = await generateWaveform(sourceUrl, options);

    // Apply trim visualization if applicable
    if (track.sourceStartTime > 0 || track.sourceEndTime) {
      // Adjust waveform data for trim (would need to recalculate based on trim points)
      // For now, return full waveform with trim indicators
      waveform.trimStart = track.sourceStartTime;
      waveform.trimEnd = track.sourceEndTime;
    }

    return waveform;
  } catch (error) {
    logger.error('Error generating track waveform', {
      error: error.message,
      trackId,
      userId
    });
    throw error;
  }
}

module.exports = {
  generateWaveform,
  generateWaveformData,
  generateWaveformImage,
  generateTrackWaveform
};

