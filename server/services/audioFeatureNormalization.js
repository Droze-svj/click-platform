// Audio Feature Normalization Service
// Normalizes and standardizes audio features for ML and comparison

/**
 * Normalize features to 0-1 range
 */
function normalizeFeatures(features) {
  const normalized = { ...features };

  // Normalize energy (already 0-1, but ensure bounds)
  if (normalized.energy) {
    normalized.energy.energy = Math.max(0, Math.min(1, normalized.energy.energy || 0));
    normalized.energy.rms = normalizeDB(normalized.energy.rms || -60, -60, 0);
    normalized.energy.peak = normalizeDB(normalized.energy.peak || -60, -60, 0);
  }

  // Normalize spectral features
  if (normalized.spectral) {
    // Centroid: 0-8000 Hz -> 0-1
    normalized.spectral.centroid = Math.max(0, Math.min(1, (normalized.spectral.centroid || 0) / 8000));
    
    // Bandwidth: 0-4000 Hz -> 0-1
    normalized.spectral.bandwidth = Math.max(0, Math.min(1, (normalized.spectral.bandwidth || 0) / 4000));
    
    // Rolloff: 0-22050 Hz -> 0-1
    normalized.spectral.rolloff = Math.max(0, Math.min(1, (normalized.spectral.rolloff || 0) / 22050));
    
    // ZCR: 0-0.2 -> 0-1
    normalized.spectral.zeroCrossingRate = Math.max(0, Math.min(1, (normalized.spectral.zeroCrossingRate || 0) / 0.2));
    
    // Spectral flux: normalize by max expected value
    normalized.spectral.spectralFlux = Math.max(0, Math.min(1, (normalized.spectral.spectralFlux || 0) / 100));
  }

  // Normalize MFCCs (typically range from -20 to 20)
  if (normalized.spectral?.mfccs) {
    normalized.spectral.mfccs = normalized.spectral.mfccs.map(mfcc => 
      Math.max(-1, Math.min(1, mfcc / 20))
    );
  }

  // Normalize classification (already 0-1, but ensure sum = 1)
  if (normalized.classification) {
    const total = (normalized.classification.voice || 0) + 
                  (normalized.classification.music || 0) + 
                  (normalized.classification.silence || 0);
    if (total > 0) {
      normalized.classification.voice = (normalized.classification.voice || 0) / total;
      normalized.classification.music = (normalized.classification.music || 0) / total;
      normalized.classification.silence = (normalized.classification.silence || 0) / total;
    }
  }

  return normalized;
}

/**
 * Normalize dB value to 0-1 range
 */
function normalizeDB(value, minDB, maxDB) {
  return Math.max(0, Math.min(1, (value - minDB) / (maxDB - minDB)));
}

/**
 * Standardize features (z-score normalization)
 */
function standardizeFeatures(features, mean, std) {
  if (!mean || !std) {
    // Calculate from features if not provided
    const stats = calculateFeatureStatistics([features]);
    mean = stats.mean;
    std = stats.std;
  }

  const standardized = { ...features };

  // Standardize energy
  if (standardized.energy && mean.energy) {
    standardized.energy.energy = (standardized.energy.energy - mean.energy.energy) / (std.energy.energy || 1);
  }

  // Standardize spectral
  if (standardized.spectral && mean.spectral) {
    if (mean.spectral.centroid) {
      standardized.spectral.centroid = 
        (standardized.spectral.centroid - mean.spectral.centroid) / (std.spectral.centroid || 1);
    }
    if (mean.spectral.bandwidth) {
      standardized.spectral.bandwidth = 
        (standardized.spectral.bandwidth - mean.spectral.bandwidth) / (std.spectral.bandwidth || 1);
    }
  }

  // Standardize MFCCs
  if (standardized.spectral?.mfccs && mean.mfccs) {
    standardized.spectral.mfccs = standardized.spectral.mfccs.map((mfcc, i) => {
      const m = mean.mfccs[i] || 0;
      const s = std.mfccs[i] || 1;
      return (mfcc - m) / s;
    });
  }

  return standardized;
}

/**
 * Calculate feature statistics for standardization
 */
function calculateFeatureStatistics(featuresArray) {
  if (featuresArray.length === 0) {
    return { mean: {}, std: {} };
  }

  const mean = {};
  const std = {};

  // Energy statistics
  const energies = featuresArray.map(f => f.energy?.energy || 0).filter(e => !isNaN(e));
  if (energies.length > 0) {
    mean.energy = { energy: energies.reduce((a, b) => a + b, 0) / energies.length };
    const variance = energies.reduce((sum, e) => {
      const diff = e - mean.energy.energy;
      return sum + diff * diff;
    }, 0) / energies.length;
    std.energy = { energy: Math.sqrt(variance) };
  }

  // Spectral statistics
  const centroids = featuresArray.map(f => f.spectral?.centroid || 0).filter(c => !isNaN(c) && c > 0);
  const bandwidths = featuresArray.map(f => f.spectral?.bandwidth || 0).filter(b => !isNaN(b) && b > 0);

  if (centroids.length > 0) {
    mean.spectral = {
      centroid: centroids.reduce((a, b) => a + b, 0) / centroids.length,
      bandwidth: bandwidths.length > 0 
        ? bandwidths.reduce((a, b) => a + b, 0) / bandwidths.length 
        : 0
    };

    const centroidVariance = centroids.reduce((sum, c) => {
      const diff = c - mean.spectral.centroid;
      return sum + diff * diff;
    }, 0) / centroids.length;

    const bandwidthVariance = bandwidths.length > 0
      ? bandwidths.reduce((sum, b) => {
          const diff = b - mean.spectral.bandwidth;
          return sum + diff * diff;
        }, 0) / bandwidths.length
      : 0;

    std.spectral = {
      centroid: Math.sqrt(centroidVariance),
      bandwidth: Math.sqrt(bandwidthVariance)
    };
  }

  // MFCC statistics
  const allMFCCs = featuresArray
    .map(f => f.spectral?.mfccs || [])
    .filter(m => m.length > 0);

  if (allMFCCs.length > 0) {
    const numCoeffs = Math.min(...allMFCCs.map(m => m.length));
    mean.mfccs = [];
    std.mfccs = [];

    for (let i = 0; i < numCoeffs; i++) {
      const coeffs = allMFCCs.map(m => m[i]).filter(c => !isNaN(c));
      if (coeffs.length > 0) {
        const m = coeffs.reduce((a, b) => a + b, 0) / coeffs.length;
        mean.mfccs.push(m);
        
        const variance = coeffs.reduce((sum, c) => {
          const diff = c - m;
          return sum + diff * diff;
        }, 0) / coeffs.length;
        std.mfccs.push(Math.sqrt(variance));
      }
    }
  }

  return { mean, std };
}

/**
 * Normalize all windows in a feature set
 */
function normalizeFeatureSet(features) {
  if (features.windows) {
    return {
      ...features,
      windows: features.windows.map(normalizeFeatures)
    };
  }

  if (features.shots) {
    return {
      ...features,
      shots: features.shots.map(shot => ({
        ...shot,
        features: shot.features ? normalizeFeatures(shot.features) : shot.features
      }))
    };
  }

  return features;
}

module.exports = {
  normalizeFeatures,
  standardizeFeatures,
  calculateFeatureStatistics,
  normalizeFeatureSet,
  normalizeDB
};







