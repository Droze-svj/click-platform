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

// ---------------------------------------------------------------------------
// REAL clip thumbnails (filmstrip) extraction — mirrors the waveform pattern.
// ---------------------------------------------------------------------------

// Default thumbnail width (px). Kept small so a strip of frames returned as
// data-URLs stays a modest JSON payload.
const FILMSTRIP_FRAME_WIDTH = 160;
const DEFAULT_FILMSTRIP_COUNT = 8;
const MAX_FILMSTRIP_COUNT = 24;

// Lightweight in-memory cache keyed by `${input}::${count}` so repeated
// timeline requests for the same source don't re-decode the video.
const FILMSTRIP_CACHE = new Map();
const FILMSTRIP_CACHE_MAX = 32;

function cacheFilmstrip(key, value) {
  if (FILMSTRIP_CACHE.size >= FILMSTRIP_CACHE_MAX) {
    const oldest = FILMSTRIP_CACHE.keys().next().value;
    if (oldest !== undefined) FILMSTRIP_CACHE.delete(oldest);
  }
  FILMSTRIP_CACHE.set(key, value);
}

/**
 * Probe a source for its duration (any stream). Returns { duration } — 0 when
 * unknown. Reused for filmstrip frame timing.
 */
function probeDuration(input) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(input, (err, metadata) => {
      if (err || !metadata) {
        resolve({ duration: 0 });
        return;
      }
      const videoStream = (metadata.streams || []).find((s) => s.codec_type === 'video');
      const duration = parseFloat(metadata.format?.duration) || parseFloat(videoStream?.duration) || 0;
      resolve({ duration });
    });
  });
}

/**
 * Extract a single JPEG frame at `seekTime` seconds, scaled to `width` px wide
 * (height auto, preserving aspect), and return it as a base64 data-URL. Uses an
 * input-side `-ss` seek for speed and `-frames:v 1` to grab exactly one frame.
 * The JPEG bytes are streamed to stdout — no temp file is written.
 */
function extractFrameDataUrl(input, seekTime, width) {
  return new Promise((resolve, reject) => {
    const args = [
      '-hide_banner',
      '-loglevel', 'error',
      '-ss', String(Math.max(0, seekTime)),
      '-i', input,
      '-frames:v', '1',
      '-vf', `scale=${width}:-2:flags=fast_bilinear`,
      '-f', 'image2',
      '-vcodec', 'mjpeg',
      '-q:v', '5',
      '-',
    ];

    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];
    let stderr = '';

    proc.stdout.on('data', (d) => chunks.push(d));
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', (e) => reject(e));
    proc.on('close', (code) => {
      const buf = Buffer.concat(chunks);
      if (buf.length === 0) {
        reject(new Error(`ffmpeg frame extract failed (code ${code}): ${stderr.trim()}`));
        return;
      }
      resolve(`data:image/jpeg;base64,${buf.toString('base64')}`);
    });
  });
}

/**
 * Extract a filmstrip: `count` thumbnails sampled evenly across a video/image
 * source's duration, each a small JPEG data-URL. Mirrors extractWaveformPeaks:
 * resolves remote http(s) + local /uploads paths, caches by input+count, and
 * never fabricates data (a source that yields no frames returns frames:[]).
 *
 * @param {string} input - remote http(s) URL or local /uploads path
 * @param {object} [options]
 * @param {number} [options.count=8] - number of frames to grab
 * @returns {Promise<{ frames: string[], duration: number, count: number }>}
 */
async function extractFilmstrip(input, options = {}) {
  const count = Math.max(1, Math.min(MAX_FILMSTRIP_COUNT, parseInt(options.count, 10) || DEFAULT_FILMSTRIP_COUNT));
  const resolved = resolveAudioInputPath(input);
  if (!resolved) {
    return { frames: [], duration: 0, count: 0 };
  }

  if (!isRemoteUrl(resolved) && !fs.existsSync(resolved)) {
    throw new Error('Video source not found');
  }

  const cacheKey = `${resolved}::${count}`;
  if (FILMSTRIP_CACHE.has(cacheKey)) {
    return FILMSTRIP_CACHE.get(cacheKey);
  }

  const { duration } = await probeDuration(resolved);

  // Sample frame at the centre of each of `count` even slices so the first and
  // last frames are representative rather than the very edges (which are often
  // black/blank). When duration is unknown (e.g. a still image) we just grab
  // frame 0 a single time.
  const seekTimes = [];
  if (duration > 0) {
    for (let i = 0; i < count; i++) {
      seekTimes.push((duration * (i + 0.5)) / count);
    }
  } else {
    seekTimes.push(0);
  }

  const frames = [];
  for (const t of seekTimes) {
    try {
      const dataUrl = await extractFrameDataUrl(resolved, t, FILMSTRIP_FRAME_WIDTH);
      frames.push(dataUrl);
    } catch (e) {
      // Skip an individual frame that fails to decode rather than failing the
      // whole strip; the client tolerates a partial strip.
      logger.warn('Filmstrip frame extraction failed', { input: resolved, time: t, error: e.message });
    }
  }

  const result = { frames, duration, count: frames.length };
  cacheFilmstrip(cacheKey, result);
  return result;
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

// ---------------------------------------------------------------------------
// REAL onset / beat detection (no fabricated data)
// ---------------------------------------------------------------------------
//
// ffmpeg has no `beatdetect` audio filter, so the previous implementation
// produced nothing. This computes genuine onsets from the decoded PCM:
//
//   1. Decode the source to mono s16le PCM (reusing decodePcm / probeAudio).
//   2. Slide a short analysis window over the samples and compute the
//      short-time energy of each frame.
//   3. Compute the positive energy flux (frame energy minus previous frame
//      energy, rectified) — the onset detection function. Energy *increases*
//      mark note/percussion onsets.
//   4. Pick local maxima of the flux that exceed an adaptive threshold
//      (local mean + k·std over a sliding context), enforcing a minimum
//      inter-onset spacing so a single transient isn't counted twice.
//
// Returns onset times in seconds. A source with no audio returns [].

// Onset analysis parameters. A ~23ms hop at 8kHz (the PCM_SAMPLE_RATE the
// decoder already uses) gives plenty of temporal resolution for music beats
// while keeping the per-frame loop cheap.
const ONSET_FRAME_SAMPLES = 256;          // ~32ms window @ 8kHz
const ONSET_HOP_SAMPLES = 128;            // ~16ms hop @ 8kHz
const ONSET_MIN_SPACING_SEC = 0.2;        // reject onsets closer than 200ms
const ONSET_THRESHOLD_WINDOW = 16;        // frames of context for adaptive threshold
const ONSET_THRESHOLD_K = 1.5;            // sensitivity: mean + k·std

/**
 * Compute the short-time energy envelope of a mono s16le PCM buffer.
 * Returns { energy: Float64Array, frameTimes: Float64Array, frameCount }.
 * Each energy value is the mean squared (normalized) amplitude of one frame.
 */
function computeEnergyEnvelope(pcm, sampleRate) {
  const sampleCount = Math.floor(pcm.length / 2);
  if (sampleCount < ONSET_FRAME_SAMPLES) {
    return { energy: new Float64Array(0), frameTimes: new Float64Array(0), frameCount: 0 };
  }

  const frameCount = 1 + Math.floor((sampleCount - ONSET_FRAME_SAMPLES) / ONSET_HOP_SAMPLES);
  const energy = new Float64Array(frameCount);
  const frameTimes = new Float64Array(frameCount);

  for (let f = 0; f < frameCount; f++) {
    const start = f * ONSET_HOP_SAMPLES;
    let sumSq = 0;
    for (let i = 0; i < ONSET_FRAME_SAMPLES; i++) {
      const v = pcm.readInt16LE((start + i) * 2) / 32768; // normalize -1..1
      sumSq += v * v;
    }
    energy[f] = sumSq / ONSET_FRAME_SAMPLES;
    // Time at the centre of the frame.
    frameTimes[f] = (start + ONSET_FRAME_SAMPLES / 2) / sampleRate;
  }

  return { energy, frameTimes, frameCount };
}

/**
 * Detect onset times (seconds) from an energy envelope via rectified energy
 * flux + adaptive-threshold local-maxima peak picking with a minimum
 * inter-onset spacing.
 */
function pickOnsets(energy, frameTimes, sampleRate) {
  const n = energy.length;
  if (n < 3) return [];

  // Positive energy flux (onset detection function).
  const flux = new Float64Array(n);
  for (let i = 1; i < n; i++) {
    const d = energy[i] - energy[i - 1];
    flux[i] = d > 0 ? d : 0;
  }

  const minSpacingFrames = Math.max(1, Math.round((ONSET_MIN_SPACING_SEC * sampleRate) / ONSET_HOP_SAMPLES));
  const onsets = [];
  let lastOnsetFrame = -Infinity;

  for (let i = 1; i < n - 1; i++) {
    // Must be a strict local maximum of the flux.
    if (!(flux[i] > flux[i - 1] && flux[i] >= flux[i + 1]) || flux[i] <= 0) continue;

    // Adaptive threshold from the local context window.
    const lo = Math.max(0, i - ONSET_THRESHOLD_WINDOW);
    const hi = Math.min(n - 1, i + ONSET_THRESHOLD_WINDOW);
    let sum = 0;
    let count = 0;
    for (let j = lo; j <= hi; j++) { sum += flux[j]; count++; }
    const mean = sum / count;
    let varSum = 0;
    for (let j = lo; j <= hi; j++) { const d = flux[j] - mean; varSum += d * d; }
    const std = Math.sqrt(varSum / count);
    const threshold = mean + ONSET_THRESHOLD_K * std;

    if (flux[i] < threshold) continue;

    // Enforce minimum inter-onset spacing.
    if (i - lastOnsetFrame < minSpacingFrames) continue;

    onsets.push(frameTimes[i]);
    lastOnsetFrame = i;
  }

  return onsets;
}

/**
 * Detect REAL onsets/beats from an audio/video source.
 *
 * @param {string} input - remote http(s) URL or local /uploads path
 * @returns {Promise<{ beats: number[], duration: number, hasAudio: boolean }>}
 *   beats: onset times in seconds (ascending). A source with no audio stream
 *   returns { beats: [], hasAudio: false } — never fabricated data.
 */
async function detectOnsets(input) {
  const resolved = resolveAudioInputPath(input);
  if (!resolved) {
    return { beats: [], duration: 0, hasAudio: false };
  }

  if (!isRemoteUrl(resolved) && !fs.existsSync(resolved)) {
    throw new Error('Audio source not found');
  }

  const cacheKey = `onsets::${resolved}`;
  if (ONSETS_CACHE.has(cacheKey)) {
    return ONSETS_CACHE.get(cacheKey);
  }

  const { hasAudio, duration } = await probeAudio(resolved);
  if (!hasAudio) {
    const result = { beats: [], duration, hasAudio: false };
    cacheOnsets(cacheKey, result);
    return result;
  }

  const pcm = await decodePcm(resolved);
  const { energy, frameTimes } = computeEnergyEnvelope(pcm, PCM_SAMPLE_RATE);

  // No decodable audio frames → treat as no-audio rather than fabricating.
  if (energy.length === 0) {
    const result = { beats: [], duration, hasAudio: false };
    cacheOnsets(cacheKey, result);
    return result;
  }

  const beats = pickOnsets(energy, frameTimes, PCM_SAMPLE_RATE);
  const result = { beats, duration, hasAudio: true };
  cacheOnsets(cacheKey, result);
  return result;
}

// Lightweight onset cache, mirroring the peaks cache.
const ONSETS_CACHE = new Map();
const ONSETS_CACHE_MAX = 64;
function cacheOnsets(key, value) {
  if (ONSETS_CACHE.size >= ONSETS_CACHE_MAX) {
    const oldest = ONSETS_CACHE.keys().next().value;
    if (oldest !== undefined) ONSETS_CACHE.delete(oldest);
  }
  ONSETS_CACHE.set(key, value);
}

/**
 * Detect beats in audio. Backwards-compatible wrapper around the real
 * detectOnsets implementation: accepts a local file path (the legacy
 * /waveform/beats upload route) and returns just the ascending onset times.
 */
async function detectBeats(audioPath) {
  const { beats } = await detectOnsets(audioPath);
  return beats;
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
  extractFilmstrip,
  generateWaveformData,
  generateWaveformImage,
  detectBeats,
  detectOnsets,
  analyzeAudioLevels,
  getFrequencySpectrum,
};
