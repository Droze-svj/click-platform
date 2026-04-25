// Audio Feature ML Classification Service
// Machine learning-based classification for better accuracy

const logger = require('../utils/logger');

/**
 * Classify audio type using ML-based features
 */
function classifyAudioTypeML(features) {
  const {
    energy,
    spectral,
    zeroCrossingRate,
    mfccs
  } = features;

  // Feature extraction for ML
  const mlFeatures = extractMLFeatures(features);

  // Voice classification (using decision tree-like logic)
  const voiceScore = classifyVoice(mlFeatures);
  
  // Music classification
  const musicScore = classifyMusic(mlFeatures);
  
  // Silence classification
  const silenceScore = classifySilence(mlFeatures);

  // Normalize scores
  const total = voiceScore + musicScore + silenceScore;
  const voice = total > 0 ? voiceScore / total : 0.33;
  const music = total > 0 ? musicScore / total : 0.33;
  const silence = total > 0 ? silenceScore / total : 0.34;

  return {
    voice: Math.max(0, Math.min(1, voice)),
    music: Math.max(0, Math.min(1, music)),
    silence: Math.max(0, Math.min(1, silence)),
    confidence: Math.max(voice, music, silence),
    features: mlFeatures
  };
}

/**
 * Extract ML features from audio features
 */
function extractMLFeatures(features) {
  const {
    energy = {},
    spectral = {},
    zeroCrossingRate = 0,
    mfccs = []
  } = features;

  return {
    // Energy features
    energyMean: energy.energy || 0,
    energyVariance: energy.variance || 0,
    rms: energy.rms || -50,
    peak: energy.peak || -40,
    
    // Spectral features
    centroid: spectral.centroid || 0,
    bandwidth: spectral.bandwidth || 0,
    rolloff: spectral.rolloff || 0,
    flux: spectral.spectralFlux || 0,
    
    // Temporal features
    zcr: zeroCrossingRate,
    
    // MFCC features (first few are most important)
    mfcc1: mfccs[0] || 0,
    mfcc2: mfccs[1] || 0,
    mfcc3: mfccs[2] || 0,
    mfcc4: mfccs[3] || 0,
    
    // Derived features
    spectralSpread: calculateSpectralSpread(spectral),
    energyRatio: calculateEnergyRatio(energy),
    harmonicity: calculateHarmonicity(spectral, mfccs)
  };
}

/**
 * Classify voice using ML features
 */
function classifyVoice(features) {
  let score = 0;

  // Voice characteristics:
  // - High ZCR (0.05-0.15)
  // - Mid-range centroid (1000-4000 Hz)
  // - Moderate energy
  // - Specific MFCC pattern

  // ZCR check
  if (features.zcr > 0.05 && features.zcr < 0.15) {
    score += 0.3;
  } else if (features.zcr > 0.03 && features.zcr < 0.2) {
    score += 0.15;
  }

  // Centroid check (voice is typically 1000-4000 Hz)
  if (features.centroid > 1000 && features.centroid < 4000) {
    score += 0.3;
  } else if (features.centroid > 500 && features.centroid < 5000) {
    score += 0.15;
  }

  // Energy check (voice is moderate energy)
  if (features.energyMean > 0.3 && features.energyMean < 0.8) {
    score += 0.2;
  }

  // MFCC pattern (voice has specific MFCC characteristics)
  if (features.mfcc1 > -5 && features.mfcc1 < 5) {
    score += 0.1;
  }

  // Harmonicity (voice has harmonics)
  if (features.harmonicity > 0.3) {
    score += 0.1;
  }

  return score;
}

/**
 * Classify music using ML features
 */
function classifyMusic(features) {
  let score = 0;

  // Music characteristics:
  // - Lower ZCR (< 0.05)
  // - Wider frequency range
  // - More consistent energy
  // - Different MFCC pattern

  // ZCR check (music has lower ZCR)
  if (features.zcr < 0.05) {
    score += 0.3;
  } else if (features.zcr < 0.08) {
    score += 0.15;
  }

  // Centroid check (music can span wider range)
  if (features.centroid > 500) {
    score += 0.2;
  }

  // Bandwidth check (music has wider bandwidth)
  if (features.bandwidth > 1000) {
    score += 0.2;
  }

  // Energy consistency (music has more consistent energy)
  if (features.energyVariance < 0.1) {
    score += 0.15;
  }

  // Spectral spread (music has wider spread)
  if (features.spectralSpread > 0.5) {
    score += 0.15;
  }

  return score;
}

/**
 * Classify silence using ML features
 */
function classifySilence(features) {
  let score = 0;

  // Silence characteristics:
  // - Very low energy
  // - Low spectral content
  // - Low ZCR

  // Energy check
  if (features.energyMean < 0.1) {
    score += 0.5;
  } else if (features.energyMean < 0.2) {
    score += 0.25;
  }

  // RMS check
  if (features.rms < -40) {
    score += 0.3;
  }

  // Spectral check (silence has low spectral content)
  if (features.centroid < 500) {
    score += 0.2;
  }

  return score;
}

/**
 * Calculate spectral spread
 */
function calculateSpectralSpread(spectral) {
  if (!spectral || !spectral.bandwidth || !spectral.centroid) {
    return 0;
  }
  return spectral.bandwidth / (spectral.centroid + 1);
}

/**
 * Calculate energy ratio
 */
function calculateEnergyRatio(energy) {
  if (!energy || !energy.max || !energy.min) {
    return 1;
  }
  return energy.min > 0 ? energy.max / energy.min : 1;
}

/**
 * Calculate harmonicity (simplified)
 */
function calculateHarmonicity(spectral, mfccs) {
  // Simplified harmonicity based on MFCC pattern
  // Real harmonicity would require pitch detection
  if (!mfccs || mfccs.length < 3) {
    return 0.5;
  }
  
  // Voice/music typically have more structured MFCC patterns
  const mfccVariance = calculateVariance(mfccs.slice(0, 5));
  return Math.max(0, 1 - mfccVariance / 10);
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
 * Enhanced speaker change detection using MFCC distance
 */
function detectSpeakerChangeML(currentFeatures, previousFeatures) {
  if (!previousFeatures) {
    return {
      hasChange: false,
      probability: 0,
      mfccDistance: 0,
      confidence: 0
    };
  }

  // Calculate MFCC distance (Euclidean distance)
  const mfccDistance = calculateMFCCDistance(
    currentFeatures.mfccs || [],
    previousFeatures.mfccs || []
  );

  // Calculate spectral distance
  const spectralDistance = calculateSpectralDistance(
    currentFeatures.spectral,
    previousFeatures.spectral
  );

  // Calculate energy change
  const energyChange = Math.abs(
    (currentFeatures.energy?.energy || 0) - (previousFeatures.energy?.energy || 0)
  );

  // Combined probability
  const mfccWeight = 0.5;
  const spectralWeight = 0.3;
  const energyWeight = 0.2;

  const mfccScore = Math.min(1, mfccDistance / 5); // Normalize
  const spectralScore = Math.min(1, spectralDistance / 2000); // Normalize
  const energyScore = Math.min(1, energyChange / 0.5); // Normalize

  const probability = 
    (mfccScore * mfccWeight) +
    (spectralScore * spectralWeight) +
    (energyScore * energyWeight);

  return {
    hasChange: probability > 0.5,
    probability: Math.min(1, probability),
    mfccDistance,
    spectralDistance,
    energyChange,
    confidence: probability > 0.7 ? 0.9 : (probability > 0.4 ? 0.6 : 0.3)
  };
}

/**
 * Calculate MFCC distance
 */
function calculateMFCCDistance(mfccs1, mfccs2) {
  if (mfccs1.length === 0 || mfccs2.length === 0) {
    return 0;
  }

  const minLength = Math.min(mfccs1.length, mfccs2.length);
  let distance = 0;

  for (let i = 0; i < minLength; i++) {
    const diff = mfccs1[i] - mfccs2[i];
    distance += diff * diff;
  }

  return Math.sqrt(distance);
}

/**
 * Calculate spectral distance
 */
function calculateSpectralDistance(spectral1, spectral2) {
  if (!spectral1 || !spectral2) {
    return 0;
  }

  const centroidDiff = Math.abs((spectral1.centroid || 0) - (spectral2.centroid || 0));
  const bandwidthDiff = Math.abs((spectral1.bandwidth || 0) - (spectral2.bandwidth || 0));

  return Math.sqrt(centroidDiff * centroidDiff + bandwidthDiff * bandwidthDiff);
}

module.exports = {
  classifyAudioTypeML,
  detectSpeakerChangeML,
  extractMLFeatures
};







