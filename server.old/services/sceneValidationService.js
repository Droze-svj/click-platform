// Scene Validation Service
// Validates scene boundaries and quality before saving

const logger = require('../utils/logger');

/**
 * Validate scene boundaries
 */
function validateScenes(scenes, options = {}) {
  const {
    minLength = 0.5,
    maxLength = null,
    minGap = 0.1, // Minimum gap between scenes
    maxOverlap = 0.0 // Maximum allowed overlap
  } = options;

  const errors = [];
  const warnings = [];

  if (!scenes || scenes.length === 0) {
    errors.push('No scenes provided');
    return { valid: false, errors, warnings };
  }

  // Check each scene
  scenes.forEach((scene, index) => {
    const start = scene.start || 0;
    const end = scene.end || 0;
    const duration = end - start;

    // Check minimum length
    if (duration < minLength) {
      errors.push(`Scene ${index} is too short: ${duration.toFixed(2)}s (minimum: ${minLength}s)`);
    }

    // Check maximum length
    if (maxLength && duration > maxLength) {
      warnings.push(`Scene ${index} is very long: ${duration.toFixed(2)}s (maximum recommended: ${maxLength}s)`);
    }

    // Check boundaries are valid
    if (start < 0) {
      errors.push(`Scene ${index} has negative start time: ${start}`);
    }

    if (end <= start) {
      errors.push(`Scene ${index} has invalid boundaries: end (${end}) <= start (${start})`);
    }

    // Check for overlaps with previous scene
    if (index > 0) {
      const prevScene = scenes[index - 1];
      const prevEnd = prevScene.end || 0;
      const gap = start - prevEnd;

      if (gap < -maxOverlap) {
        errors.push(`Scene ${index} overlaps with previous scene by ${Math.abs(gap).toFixed(2)}s`);
      } else if (gap < minGap && gap >= 0) {
        warnings.push(`Scene ${index} is very close to previous scene: ${gap.toFixed(2)}s gap`);
      }
    }
  });

  // Check scene ordering
  for (let i = 1; i < scenes.length; i++) {
    const prevEnd = scenes[i - 1].end || 0;
    const currentStart = scenes[i].start || 0;

    if (currentStart < prevEnd) {
      errors.push(`Scene ${i} starts before previous scene ends`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Deduplicate similar scenes
 */
function deduplicateScenes(scenes, threshold = 0.5) {
  if (scenes.length < 2) {
    return scenes;
  }

  const deduplicated = [scenes[0]];
  
  for (let i = 1; i < scenes.length; i++) {
    const current = scenes[i];
    let isDuplicate = false;

    for (const existing of deduplicated) {
      // Check if scenes are very similar (same boundaries or very close)
      const startDiff = Math.abs(current.start - existing.start);
      const endDiff = Math.abs(current.end - existing.end);
      const durationDiff = Math.abs(
        (current.end - current.start) - (existing.end - existing.start)
      );

      const similarity = 1 - Math.max(startDiff, endDiff, durationDiff) / Math.max(
        current.end - current.start,
        existing.end - existing.start
      );

      if (similarity > threshold) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      deduplicated.push(current);
    }
  }

  return deduplicated;
}

/**
 * Validate scene quality
 */
function validateSceneQuality(scene, options = {}) {
  const {
    minConfidence = 0.3,
    requireMetadata = false
  } = options;

  const errors = [];
  const warnings = [];

  // Check confidence
  if (scene.confidence !== undefined && scene.confidence < minConfidence) {
    warnings.push(`Low confidence: ${scene.confidence.toFixed(2)} (minimum: ${minConfidence})`);
  }

  // Check metadata if required
  if (requireMetadata) {
    if (!scene.metadata) {
      errors.push('Missing metadata');
    } else {
      if (!scene.metadata.label && requireMetadata) {
        warnings.push('Missing scene label');
      }
    }
  }

  // Check duration is reasonable
  const duration = scene.duration || (scene.end - scene.start);
  if (duration < 0.5) {
    errors.push('Scene duration is too short');
  }

  if (duration > 600) { // 10 minutes
    warnings.push('Scene duration is very long (may need splitting)');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate all scenes
 */
function validateAllScenes(scenes, options = {}) {
  const boundaryValidation = validateScenes(scenes, options);
  
  const qualityValidations = scenes.map((scene, index) => ({
    index,
    ...validateSceneQuality(scene, options)
  }));

  const allErrors = [...boundaryValidation.errors];
  const allWarnings = [...boundaryValidation.warnings];

  qualityValidations.forEach(validation => {
    allErrors.push(...validation.errors.map(e => `Scene ${validation.index}: ${e}`));
    allWarnings.push(...validation.warnings.map(w => `Scene ${validation.index}: ${w}`));
  });

  // Deduplicate scenes if requested
  let deduplicatedScenes = scenes;
  if (options.deduplicate !== false) {
    deduplicatedScenes = deduplicateScenes(scenes, options.duplicateThreshold || 0.5);
    if (deduplicatedScenes.length < scenes.length) {
      allWarnings.push(`Removed ${scenes.length - deduplicatedScenes.length} duplicate scenes`);
    }
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    scenes: deduplicatedScenes,
    originalCount: scenes.length,
    finalCount: deduplicatedScenes.length
  };
}

module.exports = {
  validateScenes,
  validateSceneQuality,
  validateAllScenes,
  deduplicateScenes
};







