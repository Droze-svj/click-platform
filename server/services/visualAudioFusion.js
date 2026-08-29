// visualAudioFusion — decides which VISUAL cuts are real SCENE changes.
//
// A video is full of shot cuts (camera angle changes) but only some of them are
// scene changes (the subject/setting/topic actually moved on). Visual detection
// alone can't tell them apart: a reverse-angle cut inside one continuous
// conversation looks exactly like a cut to a new location. Audio disambiguates
// it — across a real scene change the sound bed changes too (different speaker,
// music in or out, room tone shift), while a shot cut inside a scene leaves the
// audio essentially untouched.
//
// So each visual boundary is scored on how much the audio changed across it, and
// promoted to a scene boundary when the audio agrees (OR-logic by default, AND
// when `requireBoth`).
//
// This module was previously committed BLANK (0 bytes) and then as an honest
// empty stub. That was NOT inert: multiModalSceneDetection →
// visualAudioFusionAdvanced → here is a live path, and the empty stub returned
// no decisions, so `sceneBoundaries` came back empty with no exception thrown to
// trip the caller's fallback. Every multi-modal detection silently produced
// shot cuts and zero scenes.
//
// Feature source: advancedAudioFeatureExtraction.extractAudioFeatures(), whose
// windows look like:
//   { start, end, duration,
//     energy: { rms, peak, meanVolume, energy, loudness, isSilence },
//     spectral: { centroid, bandwidth, mfccs[], rolloff, zeroCrossingRate, spectralFlux },
//     classification: { voice, music, silence },
//     speakerChange: { hasChange, ... } }

const logger = require('../utils/logger');

// Rough full-scale ranges used to put each feature on a comparable 0-1 axis
// before distances are taken. Without this, spectral centroid (0-8000 Hz) would
// drown out everything else in the vector.
const FEATURE_SCALE = {
  energy: 1,          // already normalized 0-1
  centroid: 4000,     // Hz
  bandwidth: 4000,    // Hz
  rolloff: 8000,      // Hz
  zeroCrossingRate: 0.5,
  spectralFlux: 1,
};
const MFCC_SCALE = 50;   // MFCCs are roughly ±50 in this extractor
const MFCC_COUNT = 8;    // low-order coefficients carry the timbre

/** Mean of an array, or 0 for an empty one. */
function mean(values) {
  const nums = values.filter((v) => Number.isFinite(v));
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

// Windows that straddle the boundary belong to neither side: counting them on
// both sides averages the "before" sound into the "after" summary and vice
// versa, which shrinks exactly the difference we are trying to measure. So each
// side takes only windows that lie wholly on its own side of the instant.
// EDGE_TOLERANCE absorbs float error on windows that end exactly on it.
const EDGE_TOLERANCE = 1e-6;

/** Windows lying wholly in [boundary - span, boundary]. */
function windowsBefore(windows, boundary, span) {
  if (!Array.isArray(windows)) return [];
  return windows.filter((w) => {
    const start = Number(w?.start);
    const end = Number(w?.end ?? w?.start);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
    return end <= boundary + EDGE_TOLERANCE && end > boundary - span;
  });
}

/** Windows lying wholly in [boundary, boundary + span]. */
function windowsAfter(windows, boundary, span) {
  if (!Array.isArray(windows)) return [];
  return windows.filter((w) => {
    const start = Number(w?.start);
    const end = Number(w?.end ?? w?.start);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
    return start >= boundary - EDGE_TOLERANCE && start < boundary + span;
  });
}

/**
 * Average a set of windows into one comparable feature vector, plus the mean
 * class probabilities. Returns null when there is nothing to average, so callers
 * can distinguish "no audio here" from "audio that happens to be all zeros".
 */
function summarizeWindows(windows) {
  if (!windows.length) return null;

  const vector = [
    mean(windows.map((w) => w.energy?.energy)) / FEATURE_SCALE.energy,
    mean(windows.map((w) => w.spectral?.centroid)) / FEATURE_SCALE.centroid,
    mean(windows.map((w) => w.spectral?.bandwidth)) / FEATURE_SCALE.bandwidth,
    mean(windows.map((w) => w.spectral?.rolloff)) / FEATURE_SCALE.rolloff,
    mean(windows.map((w) => w.spectral?.zeroCrossingRate)) / FEATURE_SCALE.zeroCrossingRate,
    mean(windows.map((w) => w.spectral?.spectralFlux)) / FEATURE_SCALE.spectralFlux,
  ];

  for (let i = 0; i < MFCC_COUNT; i++) {
    vector.push(mean(windows.map((w) => w.spectral?.mfccs?.[i])) / MFCC_SCALE);
  }

  const classification = {
    voice: mean(windows.map((w) => w.classification?.voice)),
    music: mean(windows.map((w) => w.classification?.music)),
    silence: mean(windows.map((w) => w.classification?.silence)),
  };

  const speakerChange = windows.some((w) => w.speakerChange?.hasChange);

  return { vector, classification, speakerChange };
}

/** Dominant label of a {voice, music, silence} distribution. */
function dominantClass(classification) {
  if (!classification) return null;
  const entries = Object.entries(classification).filter(([, v]) => Number.isFinite(v));
  if (!entries.length) return null;
  return entries.reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];
}

/**
 * Normalized distance in [0,1] between two feature vectors.
 * Mean absolute difference per dimension, clamped — bounded and stable even
 * when a feature is missing, unlike a raw L2 norm.
 */
function vectorDistance(a, b) {
  if (!a?.length || !b?.length) return 0;
  const n = Math.min(a.length, b.length);
  let total = 0;
  for (let i = 0; i < n; i++) {
    const da = Number.isFinite(a[i]) ? a[i] : 0;
    const db = Number.isFinite(b[i]) ? b[i] : 0;
    total += Math.abs(da - db);
  }
  return Math.min(1, total / n);
}

/** Total-variation distance between two class distributions, in [0,1]. */
function classificationDistance(a, b) {
  if (!a || !b) return 0;
  const keys = ['voice', 'music', 'silence'];
  const total = keys.reduce((sum, k) => sum + Math.abs((a[k] || 0) - (b[k] || 0)), 0);
  return Math.min(1, total / 2);
}

/**
 * How different the audio is on either side of an instant.
 *
 * @param {number} prevEnd    end of the outgoing shot (seconds)
 * @param {number} currStart  start of the incoming shot (seconds)
 * @param {object} audioFeatures  { windows: [...] } from extractAudioFeatures
 * @param {number} window     seconds of audio to average on each side
 * @returns {{distance:number, classChange:boolean, classChangeMagnitude:number,
 *           speakerChange:boolean, hasAudio:boolean}}
 */
function compareShotAudioFeatures(prevEnd, currStart, audioFeatures, window = 1.0) {
  const windows = audioFeatures?.windows;
  const span = Number.isFinite(window) && window > 0 ? window : 1.0;

  const before = summarizeWindows(windowsBefore(windows, prevEnd, span));
  const after = summarizeWindows(windowsAfter(windows, currStart, span));

  // No audio on one side (start/end of file, or extraction failed) — report an
  // honest "no evidence" rather than a fabricated distance of 0, which would
  // read as "the audio is identical" and actively suppress a real boundary.
  if (!before || !after) {
    return { distance: 0, classChange: false, classChangeMagnitude: 0, speakerChange: false, hasAudio: false };
  }

  const classChangeMagnitude = classificationDistance(before.classification, after.classification);

  return {
    distance: vectorDistance(before.vector, after.vector),
    classChange: dominantClass(before.classification) !== dominantClass(after.classification),
    classChangeMagnitude,
    speakerChange: after.speakerChange,
    hasAudio: true,
  };
}

/**
 * Classify every visual boundary as a scene boundary or a within-scene shot cut.
 *
 * @param {Array<{timestamp:number, confidence?:number}>} visualBoundaries
 * @param {object} audioFeatures  { windows: [...] }
 * @param {object} options
 * @returns {{decisions:Array, sceneBoundaries:Array, shotCuts:Array, statistics:object}}
 */
function fuseVisualAudioBoundaries(visualBoundaries, audioFeatures, options = {}) {
  const {
    audioThreshold = 0.3,
    visualThreshold = 0.5,
    classChangeThreshold = 0.5,
    requireBoth = false,
    audioFeatureWindow = 1.0,
  } = options;

  if (!Array.isArray(visualBoundaries) || visualBoundaries.length === 0) {
    return { decisions: [], sceneBoundaries: [], shotCuts: [], statistics: { boundaries: 0 } };
  }

  const hasAudio = Array.isArray(audioFeatures?.windows) && audioFeatures.windows.length > 0;
  if (!hasAudio) {
    logger.debug('visualAudioFusion: no audio windows — deciding on visual confidence alone');
  }

  const decisions = visualBoundaries.map((boundary, index) => {
    const timestamp = Number(boundary?.timestamp) || 0;
    const visualChange = Number.isFinite(boundary?.confidence) ? boundary.confidence : 0.5;

    // Compare across the CUT ITSELF: the tail of the outgoing shot against the
    // head of the incoming one. (Passing the previous boundary as `prevEnd`
    // would compare audio from before the previous cut with audio after this
    // one, skipping the entire shot in between.)
    const audio = hasAudio
      ? compareShotAudioFeatures(timestamp, timestamp, audioFeatures, audioFeatureWindow)
      : { distance: 0, classChange: false, classChangeMagnitude: 0, speakerChange: false, hasAudio: false };

    const visualAgrees = visualChange >= visualThreshold;
    const audioAgrees = audio.hasAudio && (
      audio.distance >= audioThreshold ||
      (audio.classChange && audio.classChangeMagnitude >= classChangeThreshold)
    );

    // Without usable audio there is nothing to corroborate, so fall back to the
    // visual signal alone rather than rejecting every boundary (which is what
    // the empty stub effectively did).
    let isSceneBoundary;
    let reason;
    if (!audio.hasAudio) {
      isSceneBoundary = visualAgrees;
      reason = visualAgrees ? 'visual_only' : 'weak_visual_no_audio';
    } else if (requireBoth) {
      isSceneBoundary = visualAgrees && audioAgrees;
      reason = isSceneBoundary ? 'visual_and_audio' : (visualAgrees ? 'audio_disagrees' : 'visual_below_threshold');
    } else {
      isSceneBoundary = visualAgrees || audioAgrees;
      reason = visualAgrees && audioAgrees ? 'visual_and_audio'
        : visualAgrees ? 'visual_only'
          : audioAgrees ? 'audio_only'
            : 'below_thresholds';
    }

    const sources = [];
    if (visualAgrees) sources.push('visual');
    if (audioAgrees) sources.push('audio');

    // Agreement between the two modalities is what makes a boundary trustworthy,
    // so confidence rewards it rather than just averaging.
    const agreement = visualAgrees && audioAgrees ? 0.2 : 0;
    const confidence = Math.max(0, Math.min(1,
      (visualChange * 0.5) + (audio.distance * 0.3) + (audio.classChangeMagnitude * 0.2) + agreement
    ));

    return {
      index,
      timestamp,
      isSceneBoundary,
      confidence,
      visualChange,
      audioDistance: audio.distance,
      audioClassChange: audio.classChange,
      audioClassChangeMagnitude: audio.classChangeMagnitude,
      speakerChange: audio.speakerChange,
      hasAudio: audio.hasAudio,
      sources: sources.length ? sources : ['visual'],
      reason,
    };
  });

  const sceneBoundaries = [];
  const shotCuts = [];
  for (const decision of decisions) {
    const entry = {
      timestamp: decision.timestamp,
      confidence: decision.confidence,
      visualChange: decision.visualChange,
      audioDistance: decision.audioDistance,
      audioClassChange: decision.audioClassChange,
      sources: decision.sources,
      reason: decision.reason,
    };
    if (decision.isSceneBoundary) sceneBoundaries.push(entry);
    else shotCuts.push(entry);
  }

  const statistics = {
    boundaries: decisions.length,
    sceneBoundaries: sceneBoundaries.length,
    shotCuts: shotCuts.length,
    hasAudio,
    meanAudioDistance: mean(decisions.map((d) => d.audioDistance)),
    meanVisualChange: mean(decisions.map((d) => d.visualChange)),
    classChanges: decisions.filter((d) => d.audioClassChange).length,
    thresholds: { audioThreshold, visualThreshold, classChangeThreshold, requireBoth },
  };

  return { decisions, sceneBoundaries, shotCuts, statistics };
}

/**
 * Drop scene boundaries the audio contradicts — a cut whose audio is unchanged
 * AND whose visual evidence is weak is a within-scene shot cut, not a scene
 * change. Boundaries are returned in their original order.
 *
 * @returns {Array} the surviving boundaries
 */
function refineSceneBoundariesWithAudio(visualBoundaries, audioFeatures, options = {}) {
  if (!Array.isArray(visualBoundaries) || visualBoundaries.length === 0) return [];
  if (!Array.isArray(audioFeatures?.windows) || audioFeatures.windows.length === 0) {
    // Nothing to refine with — pass through unchanged.
    return visualBoundaries;
  }

  const {
    audioThreshold = 0.25,
    minVisualConfidence = 0.6,
    audioFeatureWindow = 1.0,
  } = options;

  return visualBoundaries.filter((boundary) => {
    const timestamp = Number(boundary?.timestamp) || 0;
    const visualChange = Number.isFinite(boundary?.confidence) ? boundary.confidence : 0.5;

    // Across the cut itself — same rationale as in fuseVisualAudioBoundaries.
    const audio = compareShotAudioFeatures(timestamp, timestamp, audioFeatures, audioFeatureWindow);
    if (!audio.hasAudio) return true; // no evidence to remove it on

    const audioSupports = audio.distance >= audioThreshold || audio.classChange;
    return audioSupports || visualChange >= minVisualConfidence;
  });
}

module.exports = {
  fuseVisualAudioBoundaries,
  refineSceneBoundariesWithAudio,
  compareShotAudioFeatures,
};
