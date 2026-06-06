// Audio Waveform Visualization Service
// Generate waveform data and visualizations for audio editing

const ffmpeg = require('fluent-ffmpeg');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const { toAbsolutePath } = require('../utils/pathUtils');

// ---------------------------------------------------------------------------
// REAL audio peaks extraction (no fabricated data)
// ---------------------------------------------------------------------------

// PCM decode parameters. Mono, 8kHz, signed 16-bit little-endian. 8kHz is far
// more than enough resolution to compute a few hundred visual peak buckets and
// keeps the decode fast even for long clips.
const PCM_SAMPLE_RATE = 8000;
const DEFAULT_BUCKETS = 400;
const MAX_BUCKETS = 2000;

// Lightweight in-memory cache keyed by `${input}::${buckets}` so repeated
// timeline requests for the same source don't re-decode the audio.
const PEAKS_CACHE = new Map();
const PEAKS_CACHE_MAX = 64;

function isRemoteUrl(p) {
  return typeof p === 'string' && /^https?:\/\//i.test(p);
}

/**
 * Resolve an input reference (remote http(s) URL or local /uploads-style path)
 * to something ffmpeg can read. Mirrors videoRenderService's resolveInputPath
 * pattern: remote URLs pass through untouched; everything else is made
 * absolute from the project root.
 */
function resolveAudioInputPath(input) {
  if (!input || typeof input !== 'string') return null;
  return isRemoteUrl(input) ? input : toAbsolutePath(input);
}

/**
 * Probe whether the source actually has an audio stream and grab its duration.
 * Returns { hasAudio, duration }.
 */
function probeAudio(input) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(input, (err, metadata) => {
      if (err || !metadata) {
        resolve({ hasAudio: false, duration: 0 });
        return;
      }
      const audioStream = (metadata.streams || []).find((s) => s.codec_type === 'audio');
      const duration = parseFloat(metadata.format?.duration) || parseFloat(audioStream?.duration) || 0;
      resolve({ hasAudio: !!audioStream, duration });
    });
  });
}

/**
 * Decode the audio to raw mono s16le PCM via ffmpeg and stream it back as a
 * single Buffer. Uses `-map 0:a?` so a video container with no audio simply
 * yields an empty stream rather than erroring.
 */
function decodePcm(input) {
  return new Promise((resolve, reject) => {
    const args = [
      '-hide_banner',
      '-loglevel', 'error',
      '-i', input,
      '-map', '0:a?',
      '-ac', '1',
      '-ar', String(PCM_SAMPLE_RATE),
      '-f', 's16le',
      '-',
    ];

    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];
    let stderr = '';

    proc.stdout.on('data', (d) => chunks.push(d));
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', (e) => reject(e));
    proc.on('close', (code) => {
      if (code !== 0 && chunks.length === 0) {
        reject(new Error(`ffmpeg PCM decode failed (code ${code}): ${stderr.trim()}`));
        return;
      }
      resolve(Buffer.concat(chunks));
    });
  });
}

/**
 * Downsample a mono s16le PCM buffer into N normalized peak values (0..1).
 * Each bucket's value is the peak (max absolute amplitude) of the samples that
 * fall inside it — the standard waveform-overview representation.
 */
function pcmToPeaks(pcm, buckets) {
  const sampleCount = Math.floor(pcm.length / 2); // 2 bytes per s16le sample
  if (sampleCount === 0) return [];

  const n = Math.max(1, Math.min(MAX_BUCKETS, buckets));
  const peaks = new Array(n).fill(0);
  const samplesPerBucket = sampleCount / n;

  for (let b = 0; b < n; b++) {
    const start = Math.floor(b * samplesPerBucket);
    const end = Math.min(sampleCount, Math.floor((b + 1) * samplesPerBucket));
    let max = 0;
    for (let i = start; i < end; i++) {
      const v = Math.abs(pcm.readInt16LE(i * 2));
      if (v > max) max = v;
    }
    peaks[b] = max / 32768; // normalize 0..1
  }
  return peaks;
}

/**
 * Extract REAL normalized audio peaks from a video/audio source.
 *
 * @param {string} input - remote http(s) URL or local /uploads path
 * @param {object} [options]
 * @param {number} [options.buckets=400] - number of peak values to return
 * @returns {Promise<{ peaks: number[], duration: number, sampleRate: number, hasAudio: boolean }>}
 *   On a source with no audio stream returns { peaks: [], hasAudio: false } —
 *   never fabricated data.
 */
async function extractWaveformPeaks(input, options = {}) {
  const buckets = Math.max(1, Math.min(MAX_BUCKETS, parseInt(options.buckets, 10) || DEFAULT_BUCKETS));
  const resolved = resolveAudioInputPath(input);
  if (!resolved) {
    return { peaks: [], duration: 0, sampleRate: PCM_SAMPLE_RATE, hasAudio: false };
  }

  // For local paths, fail fast if the file is missing.
  if (!isRemoteUrl(resolved) && !fs.existsSync(resolved)) {
    throw new Error('Audio source not found');
  }

  const cacheKey = `${resolved}::${buckets}`;
  if (PEAKS_CACHE.has(cacheKey)) {
    return PEAKS_CACHE.get(cacheKey);
  }

  const { hasAudio, duration } = await probeAudio(resolved);
  if (!hasAudio) {
    const result = { peaks: [], duration, sampleRate: PCM_SAMPLE_RATE, hasAudio: false };
    cachePeaks(cacheKey, result);
    return result;
  }

  const pcm = await decodePcm(resolved);
  const peaks = pcmToPeaks(pcm, buckets);

  // A genuinely empty PCM stream (no decodable audio) is treated as no-audio
  // rather than returning an all-zero fabricated-looking array.
  if (peaks.length === 0) {
    const result = { peaks: [], duration, sampleRate: PCM_SAMPLE_RATE, hasAudio: false };
    cachePeaks(cacheKey, result);
    return result;
  }

  const result = { peaks, duration, sampleRate: PCM_SAMPLE_RATE, hasAudio: true };
  cachePeaks(cacheKey, result);
  return result;
}

function cachePeaks(key, value) {
  if (PEAKS_CACHE.size >= PEAKS_CACHE_MAX) {
    // Evict oldest entry (insertion order).
    const oldest = PEAKS_CACHE.keys().next().value;
    if (oldest !== undefined) PEAKS_CACHE.delete(oldest);
  }
  PEAKS_CACHE.set(key, value);
}

/**
 * Generate waveform data from audio using REAL decoded peaks.
 *
 * Each sample is { time, min, max, rms } derived from actual PCM amplitude —
 * no fabricated/random data. `width` controls how many time buckets are
 * returned. A source with no audio stream yields an empty `samples` array
 * (hasAudio:false) rather than synthetic motion.
 */
async function generateWaveformData(audioPath, options = {}) {
  const { width = 800, height = 200, color = '#000000' } = options;

  if (!fs.existsSync(audioPath)) {
    throw new Error('Audio file not found');
  }

  const { peaks, duration, sampleRate, hasAudio } = await extractWaveformPeaks(audioPath, { buckets: width });

  const interval = peaks.length > 0 ? duration / peaks.length : 0;
  const samples = peaks.map((p, i) => ({
    time: i * interval,
    // Symmetric waveform overview: the decoded peak is the envelope magnitude.
    min: -p,
    max: p,
    rms: p,
  }));

  return {
    samples,
    peaks,
    duration,
    sampleRate,
    hasAudio,
    width,
    height,
    color,
  };
}

/**
 * Generate waveform image
 */
async function generateWaveformImage(audioPath, outputPath, options = {}) {
  const { width = 800, height = 200, color = '#000000', bgColor = '#ffffff' } = options;

  return new Promise((resolve, reject) => {
    // Use FFmpeg to generate waveform image
    const filter = `showwavespic=s=${width}x${height}:colors=${color}:scale=lin`;
    
    ffmpeg(audioPath)
      .complexFilter([filter])
      .frames(1)
      .output(outputPath)
      .on('end', () => {
        logger.info('Waveform image generated', { outputPath });
        resolve(outputPath);
      })
      .on('error', reject)
      .run();
  });
}

/**
 * Detect beats in audio
 */
async function detectBeats(audioPath) {
  return new Promise((resolve, reject) => {
    const beats = [];
    
    ffmpeg(audioPath)
      .outputOptions([
        '-af', 'beatdetect',
        '-f', 'null'
      ])
      .on('stderr', (stderrLine) => {
        const beatMatch = stderrLine.match(/beat at ([\d.]+)/i);
        if (beatMatch) {
          beats.push(parseFloat(beatMatch[1]));
        }
      })
      .on('end', () => {
        resolve(beats.sort((a, b) => a - b));
      })
      .on('error', reject)
      .output('/dev/null')
      .run();
  });
}

/**
 * Analyze audio levels
 */
async function analyzeAudioLevels(audioPath) {
  return new Promise((resolve, reject) => {
    const levels = {
      peak: 0,
      rms: 0,
      lufs: -23, // Default
      truePeak: 0
    };

    ffmpeg(audioPath)
      .outputOptions([
        '-af', 'astats=metadata=1:reset=1',
        '-f', 'null'
      ])
      .on('stderr', (stderrLine) => {
        // Parse audio statistics
        const peakMatch = stderrLine.match(/Peak level:\s*([-\d.]+)\s*dB/);
        if (peakMatch) {
          levels.peak = parseFloat(peakMatch[1]);
        }
        
        const rmsMatch = stderrLine.match(/RMS level:\s*([-\d.]+)\s*dB/);
        if (rmsMatch) {
          levels.rms = parseFloat(rmsMatch[1]);
        }
      })
      .on('end', () => {
        resolve(levels);
      })
      .on('error', reject)
      .output('/dev/null')
      .run();
  });
}

/**
 * Get frequency spectrum
 */
async function getFrequencySpectrum(audioPath, time = 0) {
  return new Promise((resolve, reject) => {
    // Extract frequency data at specific time
    const spectrum = {
      frequencies: [],
      magnitudes: []
    };

    // Simplified - full implementation would use FFT analysis
    for (let i = 0; i < 256; i++) {
      spectrum.frequencies.push(i * 86.13); // Frequency bins
      spectrum.magnitudes.push(Math.random() * 0.5); // Simulated magnitude
    }

    resolve(spectrum);
  });
}

module.exports = {
  extractWaveformPeaks,
  generateWaveformData,
  generateWaveformImage,
  detectBeats,
  analyzeAudioLevels,
  getFrequencySpectrum,
};
