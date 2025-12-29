// Advanced Audio Feature Extraction Service
// Extracts comprehensive audio features from short windows

const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const os = require('os');
const logger = require('../utils/logger');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

/**
 * Extract audio features from video/audio file
 */
async function extractAudioFeatures(videoPath, options = {}) {
  const {
    windowSize = 0.5, // Window size in seconds (0.5-1.0s recommended)
    hopSize = 0.25, // Hop size (overlap) in seconds
    sampleRate = 44100,
    aggregateByShots = false, // Aggregate by visual shot boundaries if available
    shotBoundaries = [] // Visual shot boundaries: [{start, end}, ...]
  } = options;

  try {
    // Extract audio to temporary file
    const tempAudioPath = await extractAudioFile(videoPath, sampleRate);

    try {
      // Extract features from audio windows
      const windows = await extractFeatureWindows(
        tempAudioPath,
        windowSize,
        hopSize,
        sampleRate
      );

      // Aggregate by shots if requested
      if (aggregateByShots && shotBoundaries.length > 0) {
        return aggregateFeaturesByShots(windows, shotBoundaries, windowSize);
      }

      // Normalize features
      const { normalizeFeatureSet } = require('./audioFeatureNormalization');
      const normalized = normalizeFeatureSet({
        windows,
        windowSize,
        hopSize,
        totalWindows: windows.length
      });

      return normalized;
    } finally {
      // Cleanup
      if (fs.existsSync(tempAudioPath)) {
        fs.unlinkSync(tempAudioPath);
      }
    }
  } catch (error) {
    logger.error('Error extracting audio features', { error: error.message, videoPath });
    throw error;
  }
}

/**
 * Extract audio file from video
 */
async function extractAudioFile(videoPath, sampleRate = 44100) {
  const tempAudioPath = path.join(os.tmpdir(), `audio-features-${Date.now()}.wav`);

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec('pcm_s16le')
      .audioFrequency(sampleRate)
      .audioChannels(1) // Mono for analysis
      .output(tempAudioPath)
      .on('end', () => resolve(tempAudioPath))
      .on('error', reject)
      .run();
  });
}

/**
 * Extract features from audio windows with speaker change tracking
 */
async function extractFeatureWindows(audioPath, windowSize, hopSize, sampleRate) {
  // Get audio duration first
  const duration = await getAudioDuration(audioPath);
  
  const windows = [];
  let currentTime = 0;
  let previousFeatures = null;

  while (currentTime < duration) {
    const windowEnd = Math.min(currentTime + windowSize, duration);
    const actualWindowSize = windowEnd - currentTime;

    if (actualWindowSize < 0.1) break; // Skip windows smaller than 100ms

    try {
      const features = await extractWindowFeatures(
        audioPath,
        currentTime,
        actualWindowSize,
        sampleRate,
        previousFeatures
      );

      windows.push({
        start: currentTime,
        end: windowEnd,
        duration: actualWindowSize,
        ...features
      });

      // Store features for next window comparison
      previousFeatures = {
        energy: features.energy,
        spectral: features.spectral,
        mfccs: features.spectral?.mfccs || []
      };
    } catch (error) {
      logger.warn('Error extracting features for window', { 
        start: currentTime, 
        error: error.message 
      });
    }

    currentTime += hopSize;
  }

  return windows;
}

/**
 * Extract features for a single window
 */
async function extractWindowFeatures(audioPath, startTime, duration, sampleRate, previousFeatures = null) {
  // Extract window to temporary file
  const tempWindowPath = path.join(os.tmpdir(), `window-${Date.now()}-${Math.random()}.wav`);

  try {
    await new Promise((resolve, reject) => {
      ffmpeg(audioPath)
        .setStartTime(startTime)
        .setDuration(duration)
        .noVideo()
        .audioCodec('pcm_s16le')
        .audioFrequency(sampleRate)
        .audioChannels(1)
        .output(tempWindowPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    // Extract all features in parallel (except speaker change which needs previous)
    const [
      energy,
      spectralFeatures,
      classification
    ] = await Promise.all([
      extractEnergyFeatures(tempWindowPath),
      extractSpectralFeatures(tempWindowPath, sampleRate),
      classifyAudioType(tempWindowPath)
    ]);

    // Speaker change detection (needs previous features)
    const speakerChange = await detectSpeakerChange(
      tempWindowPath, 
      sampleRate, 
      previousFeatures
    );

    return {
      energy,
      spectral: spectralFeatures,
      classification,
      speakerChange
    };
  } finally {
    // Cleanup
    if (fs.existsSync(tempWindowPath)) {
      fs.unlinkSync(tempWindowPath);
    }
  }
}

/**
 * Extract energy/loudness features
 */
async function extractEnergyFeatures(audioPath) {
  return new Promise((resolve) => {
    let rms = 0;
    let peak = 0;
    let meanVolume = -60;

    ffmpeg(audioPath)
      .outputOptions([
        '-af', 'astats=metadata=1:reset=1,volumedetect',
        '-f', 'null'
      ])
      .on('stderr', (stderrLine) => {
        // Parse RMS
        const rmsMatch = stderrLine.match(/RMS level:\s*([\d.-]+)\s*dB/);
        if (rmsMatch) {
          rms = parseFloat(rmsMatch[1]);
        }

        // Parse peak
        const peakMatch = stderrLine.match(/Peak level:\s*([\d.-]+)\s*dB/);
        if (peakMatch) {
          peak = parseFloat(peakMatch[1]);
        }

        // Parse mean volume
        const meanMatch = stderrLine.match(/mean_volume:\s*([\d.-]+)\s*dB/);
        if (meanMatch) {
          meanVolume = parseFloat(meanMatch[1]);
        }
      })
      .on('end', () => {
        // Calculate energy (normalized RMS)
        const energy = Math.max(0, (rms + 60) / 60); // Normalize to 0-1
        
        resolve({
          rms,
          peak,
          meanVolume,
          energy,
          loudness: meanVolume, // LUFS would require more complex calculation
          isSilence: meanVolume < -40
        });
      })
      .on('error', () => {
        resolve({
          rms: -50,
          peak: -40,
          meanVolume: -50,
          energy: 0.2,
          loudness: -50,
          isSilence: true
        });
      })
      .run();
  });
}

/**
 * Extract spectral features (MFCCs, centroid, bandwidth)
 */
async function extractSpectralFeatures(audioPath, sampleRate) {
  try {
    // Extract raw audio data for spectral analysis
    const audioData = await extractRawAudioData(audioPath);
    
    // Calculate spectral features
    const fft = computeFFT(audioData);
    const magnitude = fft.magnitude;
    
    // Spectral centroid
    const centroid = calculateSpectralCentroid(magnitude, sampleRate);
    
    // Spectral bandwidth
    const bandwidth = calculateSpectralBandwidth(magnitude, sampleRate, centroid);
    
    // MFCCs using proper mel filterbank
    const { calculateMFCCs } = require('./melFilterbank');
    const fftSize = Math.pow(2, Math.ceil(Math.log2(audioData.length)));
    const mfccs = calculateMFCCs(magnitude, sampleRate, fftSize, 13);
    
    // Spectral rolloff
    const rolloff = calculateSpectralRolloff(magnitude, sampleRate);
    
    // Zero crossing rate
    const zcr = calculateZeroCrossingRate(audioData);

    return {
      centroid,
      bandwidth,
      mfccs,
      rolloff,
      zeroCrossingRate: zcr,
      spectralFlux: calculateSpectralFlux(magnitude)
    };
  } catch (error) {
    logger.warn('Error extracting spectral features', { error: error.message });
    return getDefaultSpectralFeatures();
  }
}

/**
 * Extract raw audio data (16-bit PCM)
 */
async function extractRawAudioData(audioPath) {
  return new Promise((resolve, reject) => {
    const tempRawPath = path.join(os.tmpdir(), `raw-${Date.now()}.raw`);
    
    ffmpeg(audioPath)
      .format('s16le')
      .output(tempRawPath)
      .on('end', () => {
        try {
          const buffer = fs.readFileSync(tempRawPath);
          const samples = [];
          
          // Convert 16-bit PCM to array
          for (let i = 0; i < buffer.length; i += 2) {
            const sample = buffer.readInt16LE(i);
            samples.push(sample / 32768.0); // Normalize to -1.0 to 1.0
          }
          
          fs.unlinkSync(tempRawPath);
          resolve(samples);
        } catch (error) {
          if (fs.existsSync(tempRawPath)) fs.unlinkSync(tempRawPath);
          reject(error);
        }
      })
      .on('error', (error) => {
        if (fs.existsSync(tempRawPath)) fs.unlinkSync(tempRawPath);
        reject(error);
      })
      .run();
  });
}

/**
 * Compute FFT (simplified - for production use a proper FFT library)
 */
function computeFFT(audioData) {
  const N = audioData.length;
  const fftSize = Math.pow(2, Math.ceil(Math.log2(N))); // Next power of 2
  const padded = [...audioData, ...Array(fftSize - N).fill(0)];
  
  // Simple DFT (not optimized - for production use FFTW or similar)
  const real = new Array(fftSize / 2);
  const imag = new Array(fftSize / 2);
  const magnitude = new Array(fftSize / 2);
  
  for (let k = 0; k < fftSize / 2; k++) {
    let realSum = 0;
    let imagSum = 0;
    
    for (let n = 0; n < fftSize; n++) {
      const angle = -2 * Math.PI * k * n / fftSize;
      realSum += padded[n] * Math.cos(angle);
      imagSum += padded[n] * Math.sin(angle);
    }
    
    real[k] = realSum;
    imag[k] = imagSum;
    magnitude[k] = Math.sqrt(realSum * realSum + imagSum * imagSum);
  }
  
  return { real, imag, magnitude };
}

/**
 * Calculate spectral centroid
 */
function calculateSpectralCentroid(magnitude, sampleRate) {
  let weightedSum = 0;
  let magnitudeSum = 0;
  
  const binFreq = sampleRate / (magnitude.length * 2);
  
  for (let i = 0; i < magnitude.length; i++) {
    const freq = i * binFreq;
    weightedSum += freq * magnitude[i];
    magnitudeSum += magnitude[i];
  }
  
  return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
}

/**
 * Calculate spectral bandwidth
 */
function calculateSpectralBandwidth(magnitude, sampleRate, centroid) {
  let weightedSum = 0;
  let magnitudeSum = 0;
  
  const binFreq = sampleRate / (magnitude.length * 2);
  
  for (let i = 0; i < magnitude.length; i++) {
    const freq = i * binFreq;
    const diff = Math.abs(freq - centroid);
    weightedSum += diff * diff * magnitude[i];
    magnitudeSum += magnitude[i];
  }
  
  return magnitudeSum > 0 ? Math.sqrt(weightedSum / magnitudeSum) : 0;
}

// MFCC calculation moved to melFilterbank.js

/**
 * Calculate spectral rolloff
 */
function calculateSpectralRolloff(magnitude, sampleRate, percentile = 0.85) {
  const totalEnergy = magnitude.reduce((a, b) => a + b, 0);
  const threshold = totalEnergy * percentile;
  
  let cumsum = 0;
  for (let i = 0; i < magnitude.length; i++) {
    cumsum += magnitude[i];
    if (cumsum >= threshold) {
      return (i / magnitude.length) * (sampleRate / 2);
    }
  }
  
  return sampleRate / 2;
}

/**
 * Calculate zero crossing rate
 */
function calculateZeroCrossingRate(audioData) {
  let crossings = 0;
  for (let i = 1; i < audioData.length; i++) {
    if ((audioData[i - 1] >= 0) !== (audioData[i] >= 0)) {
      crossings++;
    }
  }
  return crossings / audioData.length;
}

/**
 * Calculate spectral flux
 */
function calculateSpectralFlux(magnitude) {
  // Simplified - compare with previous frame
  let flux = 0;
  for (let i = 1; i < magnitude.length; i++) {
    const diff = magnitude[i] - magnitude[i - 1];
    flux += diff > 0 ? diff : 0;
  }
  return flux;
}

/**
 * Classify audio type (voice/music/silence) using ML-based approach
 */
async function classifyAudioType(audioPath) {
  try {
    // Extract features for classification
    const energy = await extractEnergyFeatures(audioPath);
    const audioData = await extractRawAudioData(audioPath);
    const fft = computeFFT(audioData);
    const zcr = calculateZeroCrossingRate(audioData);
    const centroid = calculateSpectralCentroid(fft.magnitude, 44100);
    const bandwidth = calculateSpectralBandwidth(fft.magnitude, 44100, centroid);
    const rolloff = calculateSpectralRolloff(fft.magnitude, 44100);
    
    // Calculate MFCCs
    const { calculateMFCCs } = require('./melFilterbank');
    const fftSize = Math.pow(2, Math.ceil(Math.log2(audioData.length)));
    const mfccs = calculateMFCCs(fft.magnitude, 44100, fftSize, 13);
    
    // Build feature object
    const features = {
      energy: {
        energy: energy.energy,
        rms: energy.rms,
        peak: energy.peak,
        variance: 0 // Would need multiple windows for variance
      },
      spectral: {
        centroid,
        bandwidth,
        rolloff,
        spectralFlux: calculateSpectralFlux(fft.magnitude)
      },
      zeroCrossingRate: zcr,
      mfccs
    };
    
    // Use ML-based classification
    const { classifyAudioTypeML } = require('./audioFeatureML');
    return classifyAudioTypeML(features);
  } catch (error) {
    logger.warn('Error classifying audio type', { error: error.message });
    return {
      voice: 0.33,
      music: 0.33,
      silence: 0.34,
      confidence: 0.5
    };
  }
}

/**
 * Detect speaker changes using ML-based approach
 * Note: This requires previous window features for comparison
 */
async function detectSpeakerChange(audioPath, sampleRate, previousFeatures = null) {
  try {
    // Extract features
    const audioData = await extractRawAudioData(audioPath);
    const fft = computeFFT(audioData);
    const energy = await extractEnergyFeatures(audioPath);
    const zcr = calculateZeroCrossingRate(audioData);
    const centroid = calculateSpectralCentroid(fft.magnitude, sampleRate);
    const bandwidth = calculateSpectralBandwidth(fft.magnitude, sampleRate, centroid);
    
    // Calculate MFCCs using proper mel filterbank
    const { calculateMFCCs } = require('./melFilterbank');
    const fftSize = Math.pow(2, Math.ceil(Math.log2(audioData.length)));
    const mfccs = calculateMFCCs(fft.magnitude, sampleRate, fftSize, 13);
    
    const currentFeatures = {
      energy: {
        energy: energy.energy,
        rms: energy.rms,
        peak: energy.peak
      },
      spectral: {
        centroid,
        bandwidth
      },
      mfccs
    };
    
    // Use ML-based speaker change detection
    const { detectSpeakerChangeML } = require('./audioFeatureML');
    return detectSpeakerChangeML(currentFeatures, previousFeatures);
  } catch (error) {
    logger.warn('Error detecting speaker change', { error: error.message });
    return {
      hasChange: false,
      probability: 0,
      mfccDistance: 0,
      confidence: 0
    };
  }
}

/**
 * Calculate spectral variance
 */
function calculateSpectralVariance(magnitude) {
  const mean = magnitude.reduce((a, b) => a + b, 0) / magnitude.length;
  const variance = magnitude.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / magnitude.length;
  return variance;
}

/**
 * Aggregate features by visual shot boundaries
 */
function aggregateFeaturesByShots(windows, shotBoundaries, windowSize) {
  const shotFeatures = shotBoundaries.map(shot => {
    // Find windows that fall within this shot
    const shotWindows = windows.filter(win => 
      win.start >= shot.start && win.end <= shot.end
    );

    if (shotWindows.length === 0) {
      return {
        start: shot.start,
        end: shot.end,
        duration: shot.end - shot.start,
        windowCount: 0,
        features: getDefaultShotFeatures()
      };
    }

    // Aggregate features
    const features = aggregateWindowFeatures(shotWindows);

    return {
      start: shot.start,
      end: shot.end,
      duration: shot.end - shot.start,
      windowCount: shotWindows.length,
      features
    };
  });

  // Normalize aggregated features
  const { normalizeFeatureSet } = require('./audioFeatureNormalization');
  const normalized = normalizeFeatureSet({
    shots: shotFeatures,
    totalShots: shotFeatures.length,
    aggregationMethod: 'mean_and_variance'
  });

  return normalized;
}

/**
 * Aggregate window features into shot-level features
 */
function aggregateWindowFeatures(windows) {
  if (windows.length === 0) {
    return getDefaultShotFeatures();
  }

  // Energy features
  const energies = windows.map(w => w.energy?.energy || 0);
  const energyMean = energies.reduce((a, b) => a + b, 0) / energies.length;
  const energyVariance = calculateVariance(energies);
  const energyChanges = calculateEnergyChanges(energies);

  // Spectral features
  const centroids = windows.map(w => w.spectral?.centroid || 0).filter(c => c > 0);
  const bandwidths = windows.map(w => w.spectral?.bandwidth || 0).filter(b => b > 0);
  const zcrs = windows.map(w => w.spectral?.zeroCrossingRate || 0);

  // Classification (weighted average)
  const classifications = windows.map(w => w.classification || { voice: 0.33, music: 0.33, silence: 0.34 });
  const avgClassification = {
    voice: classifications.reduce((sum, c) => sum + c.voice, 0) / classifications.length,
    music: classifications.reduce((sum, c) => sum + c.music, 0) / classifications.length,
    silence: classifications.reduce((sum, c) => sum + c.silence, 0) / classifications.length
  };

  // Speaker changes
  const speakerChanges = windows.filter(w => w.speakerChange?.hasChange).length;
  const speakerChangeProbability = speakerChanges / windows.length;

  return {
    energy: {
      mean: energyMean,
      variance: energyVariance,
      changes: energyChanges,
      max: Math.max(...energies),
      min: Math.min(...energies)
    },
    spectral: {
      centroid: {
        mean: centroids.length > 0 ? centroids.reduce((a, b) => a + b, 0) / centroids.length : 0,
        variance: centroids.length > 0 ? calculateVariance(centroids) : 0
      },
      bandwidth: {
        mean: bandwidths.length > 0 ? bandwidths.reduce((a, b) => a + b, 0) / bandwidths.length : 0,
        variance: bandwidths.length > 0 ? calculateVariance(bandwidths) : 0
      },
      zeroCrossingRate: {
        mean: zcrs.reduce((a, b) => a + b, 0) / zcrs.length,
        variance: calculateVariance(zcrs)
      }
    },
    classification: avgClassification,
    speakerChange: {
      count: speakerChanges,
      probability: speakerChangeProbability,
      hasChange: speakerChangeProbability > 0.3
    },
    // Average MFCCs (first few coefficients)
    mfccs: aggregateMFCCs(windows.map(w => w.spectral?.mfccs || []))
  };
}

/**
 * Aggregate MFCCs across windows
 */
function aggregateMFCCs(mfccArrays) {
  if (mfccArrays.length === 0) return [];
  
  const numCoeffs = Math.min(...mfccArrays.map(a => a.length));
  const aggregated = [];

  for (let i = 0; i < numCoeffs; i++) {
    const values = mfccArrays.map(arr => arr[i]).filter(v => !isNaN(v));
    if (values.length > 0) {
      aggregated.push({
        mean: values.reduce((a, b) => a + b, 0) / values.length,
        variance: calculateVariance(values)
      });
    }
  }

  return aggregated;
}

/**
 * Calculate variance
 */
function calculateVariance(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return variance;
}

/**
 * Calculate energy changes
 */
function calculateEnergyChanges(energies) {
  if (energies.length < 2) return [];
  const changes = [];
  for (let i = 1; i < energies.length; i++) {
    changes.push(Math.abs(energies[i] - energies[i - 1]));
  }
  return {
    mean: changes.reduce((a, b) => a + b, 0) / changes.length,
    max: Math.max(...changes),
    count: changes.filter(c => c > 0.1).length // Significant changes
  };
}

/**
 * Get default spectral features
 */
function getDefaultSpectralFeatures() {
  return {
    centroid: 2000,
    bandwidth: 1000,
    mfccs: Array(13).fill(0),
    rolloff: 10000,
    zeroCrossingRate: 0.05,
    spectralFlux: 0
  };
}

/**
 * Get default shot features
 */
function getDefaultShotFeatures() {
  return {
    energy: { mean: 0, variance: 0, changes: { mean: 0, max: 0, count: 0 }, max: 0, min: 0 },
    spectral: {
      centroid: { mean: 0, variance: 0 },
      bandwidth: { mean: 0, variance: 0 },
      zeroCrossingRate: { mean: 0, variance: 0 }
    },
    classification: { voice: 0.33, music: 0.33, silence: 0.34 },
    speakerChange: { count: 0, probability: 0, hasChange: false },
    mfccs: []
  };
}

/**
 * Get audio duration
 */
function getAudioDuration(audioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata.format.duration || 0);
    });
  });
}

module.exports = {
  extractAudioFeatures,
  extractWindowFeatures,
  aggregateFeaturesByShots
};

