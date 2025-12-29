// Scene Quality Scoring Service
// Ranks and scores scenes based on multiple quality metrics

const logger = require('../utils/logger');

/**
 * Score scene quality based on multiple factors
 */
function scoreSceneQuality(scene, options = {}) {
  const {
    weightMetadata = 0.3,
    weightDuration = 0.2,
    weightConfidence = 0.2,
    weightAudio = 0.15,
    weightVisual = 0.15
  } = options;

  let score = 0;
  const factors = {};

  // Metadata quality (0-1)
  const metadataScore = scoreMetadata(scene.metadata || {});
  factors.metadata = metadataScore;
  score += metadataScore * weightMetadata;

  // Duration quality (prefer scenes within optimal range)
  const durationScore = scoreDuration(scene.duration, options.optimalDuration);
  factors.duration = durationScore;
  score += durationScore * weightDuration;

  // Detection confidence
  const confidenceScore = scene.confidence || 0.5;
  factors.confidence = confidenceScore;
  score += confidenceScore * weightConfidence;

  // Audio quality (has speech, no long silence)
  const audioScore = scoreAudio(scene.audioCues || [], scene.metadata || {});
  factors.audio = audioScore;
  score += audioScore * weightAudio;

  // Visual quality (good composition, not too dark/bright)
  const visualScore = scoreVisual(scene.metadata || {});
  factors.visual = visualScore;
  score += visualScore * weightVisual;

  return {
    overall: Math.min(1.0, Math.max(0.0, score)),
    factors,
    grade: getQualityGrade(score)
  };
}

/**
 * Score metadata quality
 */
function scoreMetadata(metadata) {
  let score = 0.5; // Base score

  // Bonus for having faces
  if (metadata.hasFaces) {
    score += 0.15;
  }

  // Bonus for having speech
  if (metadata.hasSpeech && metadata.speechConfidence > 0.5) {
    score += 0.2;
  }

  // Bonus for meaningful labels
  const meaningfulLabels = ['talking head', 'screen share', 'B-roll'];
  if (meaningfulLabels.includes(metadata.label)) {
    score += 0.15;
  }

  return Math.min(1.0, score);
}

/**
 * Score duration quality
 */
function scoreDuration(duration, optimalDuration = null) {
  if (!optimalDuration) {
    // General quality curve: prefer 5-60 seconds
    if (duration >= 5 && duration <= 60) {
      return 1.0;
    } else if (duration >= 2 && duration < 5) {
      return 0.7;
    } else if (duration > 60 && duration <= 120) {
      return 0.8;
    } else {
      return 0.5;
    }
  }

  // Score based on distance from optimal
  const distance = Math.abs(duration - optimalDuration);
  const maxDistance = optimalDuration * 0.5;
  const score = Math.max(0, 1 - (distance / maxDistance));
  return score;
}

/**
 * Score audio quality
 */
function scoreAudio(audioCues, metadata) {
  let score = 0.5;

  // Penalty for long silence
  const silenceCues = audioCues.filter(cue => cue.type === 'silence' && cue.duration > 2);
  if (silenceCues.length > 0) {
    score -= 0.2;
  }

  // Bonus for music changes (indicates scene transitions)
  const musicChanges = audioCues.filter(cue => cue.type === 'music_change');
  if (musicChanges.length > 0) {
    score += 0.15;
  }

  // Bonus for applause (indicates important moments)
  const applause = audioCues.filter(cue => cue.type === 'applause');
  if (applause.length > 0) {
    score += 0.15;
  }

  // Bonus for speech
  if (metadata.hasSpeech) {
    score += 0.2;
  }

  return Math.max(0, Math.min(1.0, score));
}

/**
 * Score visual quality
 */
function scoreVisual(metadata) {
  let score = 0.5;

  // Check brightness (prefer well-lit scenes)
  if (metadata.brightness) {
    if (metadata.brightness > 50 && metadata.brightness < 200) {
      score += 0.2; // Well-lit
    } else if (metadata.brightness < 30 || metadata.brightness > 220) {
      score -= 0.2; // Too dark or too bright
    }
  }

  // Bonus for faces (better engagement)
  if (metadata.hasFaces) {
    score += 0.15;
  }

  // Bonus for good composition (has dominant colors)
  if (metadata.dominantColors && metadata.dominantColors.length > 0) {
    score += 0.15;
  }

  return Math.max(0, Math.min(1.0, score));
}

/**
 * Get quality grade
 */
function getQualityGrade(score) {
  if (score >= 0.8) return 'A';
  if (score >= 0.7) return 'B';
  if (score >= 0.6) return 'C';
  if (score >= 0.5) return 'D';
  return 'F';
}

/**
 * Rank scenes by quality
 */
function rankScenesByQuality(scenes, options = {}) {
  const scored = scenes.map(scene => ({
    ...scene,
    quality: scoreSceneQuality(scene, options)
  }));

  // Sort by overall quality score (descending)
  scored.sort((a, b) => b.quality.overall - a.quality.overall);

  return scored;
}

/**
 * Filter scenes by minimum quality threshold
 */
function filterScenesByQuality(scenes, minScore = 0.5) {
  return scenes.filter(scene => {
    const quality = scoreSceneQuality(scene);
    return quality.overall >= minScore;
  });
}

module.exports = {
  scoreSceneQuality,
  rankScenesByQuality,
  filterScenesByQuality
};







