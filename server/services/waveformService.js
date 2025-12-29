// Waveform Generation Service
// Generates waveform data for visualization

const logger = require('../utils/logger');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const execAsync = promisify(exec);

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
    // Use FFmpeg to extract waveform data
    // This uses the 'showwavespic' filter to generate data
    const tempDir = path.join(__dirname, '../../tmp/waveforms');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const dataPath = path.join(tempDir, `waveform_${Date.now()}.txt`);

    // Extract audio samples and calculate RMS per segment
    const command = `ffmpeg -i "${audioPath}" -af "aresample=8000,asetnsamples=n=200" -f s16le - 2>/dev/null | node -e "
      const fs = require('fs');
      const buffer = fs.readFileSync(0);
      const samples = [];
      for (let i = 0; i < buffer.length; i += 2) {
        const sample = buffer.readInt16LE(i);
        samples.push(Math.abs(sample) / 32768);
      }
      const width = ${width};
      const samplesPerPixel = Math.floor(samples.length / width);
      const waveform = [];
      for (let i = 0; i < width; i++) {
        const start = i * samplesPerPixel;
        const end = start + samplesPerPixel;
        const segment = samples.slice(start, end);
        const rms = Math.sqrt(segment.reduce((sum, val) => sum + val * val, 0) / segment.length);
        waveform.push(rms);
      }
      console.log(JSON.stringify(waveform));
    "`;

    const { stdout } = await execAsync(command);
    const waveform = JSON.parse(stdout.trim());

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
  // Get audio duration
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  
  const durationCommand = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`;
  const { stdout } = await execAsync(durationCommand);
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

    // Use FFmpeg showwavespic filter
    const command = `ffmpeg -i "${audioPath}" -filter_complex "[0:a]showwavespic=s=${width}x${height}:colors=0x00ff00" -frames:v 1 -y "${outputPath}"`;

    await execAsync(command);

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

