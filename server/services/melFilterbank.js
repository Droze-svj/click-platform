// Mel Filterbank Implementation
// Proper mel-scale filterbank for MFCC calculation

/**
 * Create mel filterbank
 */
function createMelFilterbank(numFilters, fftSize, sampleRate, lowFreq = 0, highFreq = null) {
  if (!highFreq) {
    highFreq = sampleRate / 2;
  }

  const numFFTBins = fftSize / 2;
  const melLow = hzToMel(lowFreq);
  const melHigh = hzToMel(highFreq);
  const melSpacing = (melHigh - melLow) / (numFilters + 1);

  const filterbank = [];
  const centerFreqs = [];

  // Create triangular filters
  for (let i = 0; i < numFilters; i++) {
    const melCenter = melLow + (i + 1) * melSpacing;
    const hzCenter = melToHz(melCenter);
    centerFreqs.push(hzCenter);

    const filter = new Array(numFFTBins).fill(0);
    const melStart = melLow + i * melSpacing;
    const melEnd = melLow + (i + 2) * melSpacing;
    const hzStart = melToHz(melStart);
    const hzEnd = melToHz(melEnd);

    // Create triangular filter
    for (let j = 0; j < numFFTBins; j++) {
      const binFreq = (j * sampleRate) / fftSize;
      
      if (binFreq >= hzStart && binFreq <= hzCenter) {
        filter[j] = (binFreq - hzStart) / (hzCenter - hzStart);
      } else if (binFreq > hzCenter && binFreq <= hzEnd) {
        filter[j] = (hzEnd - binFreq) / (hzEnd - hzCenter);
      }
    }

    filterbank.push(filter);
  }

  return {
    filters: filterbank,
    centerFrequencies: centerFreqs
  };
}

/**
 * Convert Hz to Mel
 */
function hzToMel(hz) {
  return 2595 * Math.log10(1 + hz / 700);
}

/**
 * Convert Mel to Hz
 */
function melToHz(mel) {
  return 700 * (Math.pow(10, mel / 2595) - 1);
}

/**
 * Apply mel filterbank to magnitude spectrum
 */
function applyMelFilterbank(magnitudeSpectrum, filterbank) {
  const numFilters = filterbank.filters.length;
  const melSpectrum = [];

  for (let i = 0; i < numFilters; i++) {
    const filter = filterbank.filters[i];
    let energy = 0;

    for (let j = 0; j < Math.min(filter.length, magnitudeSpectrum.length); j++) {
      energy += magnitudeSpectrum[j] * filter[j];
    }

    melSpectrum.push(energy);
  }

  return melSpectrum;
}

/**
 * Calculate MFCCs using mel filterbank
 */
function calculateMFCCs(magnitudeSpectrum, sampleRate, fftSize, numCoeffs = 13) {
  // Create mel filterbank
  const numFilters = 26; // Standard number of mel filters
  const filterbank = createMelFilterbank(numFilters, fftSize, sampleRate);

  // Apply mel filterbank
  const melSpectrum = applyMelFilterbank(magnitudeSpectrum, filterbank);

  // Log mel spectrum
  const logMelSpectrum = melSpectrum.map(energy => 
    Math.log10(energy + 1e-10)
  );

  // Apply DCT (Discrete Cosine Transform)
  const mfccs = [];
  const N = logMelSpectrum.length;

  for (let k = 0; k < numCoeffs; k++) {
    let sum = 0;
    for (let n = 0; n < N; n++) {
      sum += logMelSpectrum[n] * Math.cos(
        Math.PI * k * (n + 0.5) / N
      );
    }
    mfccs.push(sum * Math.sqrt(2 / N));
  }

  return mfccs;
}

module.exports = {
  createMelFilterbank,
  applyMelFilterbank,
  calculateMFCCs,
  hzToMel,
  melToHz
};







