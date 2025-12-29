// Advanced Audio Analysis Service
// Enhanced audio feature extraction for scene detection

const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const os = require('os');
const logger = require('../utils/logger');

/**
 * Analyze audio segment with advanced features
 */
async function analyzeAudioSegmentAdvanced(videoPath, startTime, duration) {
  const tempAudioPath = path.join(os.tmpdir(), `audio-advanced-${Date.now()}.wav`);

  try {
    // Extract audio segment
    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .setStartTime(startTime)
        .setDuration(duration)
        .noVideo()
        .audioCodec('pcm_s16le')
        .audioFrequency(44100)
        .audioChannels(1) // Mono for analysis
        .output(tempAudioPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    // Get comprehensive audio analysis
    const analysis = await getAdvancedAudioAnalysis(tempAudioPath);

    // Cleanup
    if (fs.existsSync(tempAudioPath)) {
      fs.unlinkSync(tempAudioPath);
    }

    return analysis;
  } catch (error) {
    logger.warn('Advanced audio analysis failed', { error: error.message });
    // Cleanup on error
    if (fs.existsSync(tempAudioPath)) {
      fs.unlinkSync(tempAudioPath);
    }
    return getDefaultAudioAnalysis();
  }
}

/**
 * Get advanced audio analysis using ffmpeg filters
 */
function getAdvancedAudioAnalysis(audioPath) {
  return new Promise((resolve) => {
    let volume = -50;
    let peakVolume = -50;
    let isSilence = false;
    let spectralData = {
      lowFreq: 0,
      midFreq: 0,
      highFreq: 0
    };

    // Use multiple filters to analyze audio
    ffmpeg(audioPath)
      .outputOptions([
        '-af', 'volumedetect,astats=metadata=1:reset=1',
        '-f', 'null'
      ])
      .on('stderr', (stderrLine) => {
        // Parse volume detection
        const meanVolumeMatch = stderrLine.match(/mean_volume: ([\d.-]+) dB/);
        if (meanVolumeMatch) {
          volume = parseFloat(meanVolumeMatch[1]);
          isSilence = volume < -40;
        }

        const peakVolumeMatch = stderrLine.match(/max_volume: ([\d.-]+) dB/);
        if (peakVolumeMatch) {
          peakVolume = parseFloat(peakVolumeMatch[1]);
        }

        // Parse spectral data (simplified - would need proper FFT analysis)
        // For now, use volume as proxy
        if (!isSilence) {
          const normalizedVolume = (volume + 60) / 60; // Normalize -60 to 0 dB
          spectralData.midFreq = normalizedVolume;
        }
      })
      .on('end', () => {
        // Detect music characteristics
        const isMusic = detectMusicCharacteristics(volume, peakVolume, spectralData);
        
        // Detect speech (typically in mid frequencies, dynamic range)
        const isSpeech = detectSpeechCharacteristics(volume, peakVolume);

        // Detect applause (high frequency content, rhythmic)
        const isApplause = detectApplause(volume, peakVolume);

        resolve({
          volume,
          peakVolume,
          isSilence,
          isMusic,
          isSpeech,
          isApplause,
          applauseConfidence: isApplause ? 0.7 : 0,
          spectralData,
          dynamicRange: peakVolume - volume,
          musicConfidence: isMusic ? 0.6 : 0
        });
      })
      .on('error', () => {
        resolve(getDefaultAudioAnalysis());
      })
      .run();
  });
}

/**
 * Detect music characteristics
 */
function detectMusicCharacteristics(volume, peakVolume, spectralData) {
  // Music typically has:
  // - Consistent volume (low dynamic range)
  // - Presence in multiple frequency bands
  // - Not too quiet, not too loud
  const dynamicRange = peakVolume - volume;
  const hasMusicLikeVolume = volume > -35 && volume < -10;
  const hasLowDynamicRange = dynamicRange < 15;

  return hasMusicLikeVolume && hasLowDynamicRange;
}

/**
 * Detect speech characteristics
 */
function detectSpeechCharacteristics(volume, peakVolume) {
  // Speech typically has:
  // - Higher dynamic range than music
  // - Mid-range frequencies
  // - Variable volume
  const dynamicRange = peakVolume - volume;
  const hasSpeechLikeVolume = volume > -40 && volume < -15;
  const hasHighDynamicRange = dynamicRange > 10;

  return hasSpeechLikeVolume && (hasHighDynamicRange || volume > -25);
}

/**
 * Detect applause
 */
function detectApplause(volume, peakVolume) {
  // Applause typically:
  // - High volume spikes
  // - Wide dynamic range
  // - Clustered peaks
  const dynamicRange = peakVolume - volume;
  const hasHighPeaks = peakVolume > -10;
  const hasWideRange = dynamicRange > 20;

  return hasHighPeaks && hasWideRange;
}

/**
 * Get default audio analysis
 */
function getDefaultAudioAnalysis() {
  return {
    volume: -30,
    peakVolume: -20,
    isSilence: false,
    isMusic: false,
    isSpeech: false,
    isApplause: false,
    applauseConfidence: 0,
    spectralData: { lowFreq: 0, midFreq: 0, highFreq: 0 },
    dynamicRange: 10,
    musicConfidence: 0
  };
}

/**
 * Compare audio analyses for scene change detection
 */
function compareAudioAnalysesAdvanced(analysis1, analysis2) {
  const metrics = {
    volumeChange: 0,
    musicChange: 0,
    spectralChange: 0,
    speechChange: 0
  };

  // Volume change
  const volumeDiff = Math.abs(analysis1.volume - analysis2.volume);
  metrics.volumeChange = Math.min(1.0, volumeDiff / 30); // Normalize to 0-1

  // Music change (detect if music presence changed)
  if (analysis1.isMusic !== analysis2.isMusic) {
    metrics.musicChange = 0.8;
  } else if (analysis1.musicConfidence > 0 && analysis2.musicConfidence > 0) {
    const musicDiff = Math.abs(analysis1.musicConfidence - analysis2.musicConfidence);
    metrics.musicChange = musicDiff;
  }

  // Spectral change (frequency distribution)
  const spectralDiff = Math.abs(
    analysis1.spectralData.midFreq - analysis2.spectralData.midFreq
  );
  metrics.spectralChange = spectralDiff;

  // Speech change
  if (analysis1.isSpeech !== analysis2.isSpeech) {
    metrics.speechChange = 0.7;
  }

  // Weighted combination
  const totalChange = 
    metrics.volumeChange * 0.3 +
    metrics.musicChange * 0.4 +
    metrics.spectralChange * 0.2 +
    metrics.speechChange * 0.1;

  return {
    totalChange: Math.min(1.0, totalChange),
    metrics
  };
}

module.exports = {
  analyzeAudioSegmentAdvanced,
  compareAudioAnalysesAdvanced,
  getAdvancedAudioAnalysis
};







