// Manual Edit Batch Operations Service
// Apply multiple effects/operations in sequence or parallel

const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');

// Import all editing services
const colorGradingService = require('./advancedColorGradingService');
const audioMixingService = require('./professionalAudioMixingService');
const typographyService = require('./advancedTypographyService');
const motionGraphicsService = require('./motionGraphicsService');
const transitionsService = require('./advancedTransitionsService');
const speedControlService = require('./speedControlService');

/**
 * Apply batch operations sequentially
 */
async function applyBatchOperationsSequential(videoPath, operations, outputPath) {
  let currentPath = videoPath;
  const tempFiles = [];

  try {
    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];
      const isLast = i === operations.length - 1;
      const tempPath = isLast 
        ? outputPath 
        : path.join(path.dirname(outputPath), `batch-temp-${i}-${Date.now()}.mp4`);

      if (i > 0) {
        tempFiles.push(currentPath);
      }

      logger.info('Applying batch operation', { 
        index: i + 1, 
        total: operations.length, 
        type: operation.type 
      });

      switch (operation.type) {
        case 'color-grading':
          if (operation.preset) {
            await colorGradingService.applyColorPreset(currentPath, tempPath, operation.preset);
          } else if (operation.curves) {
            await colorGradingService.applyColorCurves(currentPath, tempPath, operation.curves);
          } else if (operation.colorWheels) {
            await colorGradingService.applyColorWheels(currentPath, tempPath, operation.colorWheels);
          }
          break;

        case 'audio-mixing':
          if (operation.eqPreset) {
            await audioMixingService.applyEQPreset(currentPath, tempPath, operation.eqPreset);
          } else if (operation.noiseReduction) {
            await audioMixingService.applyNoiseReduction(
              currentPath, 
              tempPath, 
              operation.strength || 10
            );
          } else if (operation.normalize) {
            await audioMixingService.normalizeAudio(
              currentPath, 
              tempPath, 
              operation.normalizeType || 'lufs',
              operation.target || -16
            );
          }
          break;

        case 'typography':
          if (operation.template) {
            await typographyService.applyTextTemplate(currentPath, tempPath, operation.template);
          } else if (operation.textOverlay) {
            await typographyService.applyAnimatedText(
              currentPath, 
              tempPath, 
              operation.textOverlay
            );
          }
          break;

        case 'motion-graphics':
          if (operation.stabilize) {
            await motionGraphicsService.applyStabilization(
              currentPath, 
              tempPath, 
              operation.strength || 0.5
            );
          } else if (operation.shape) {
            await motionGraphicsService.addShapeOverlay(
              currentPath, 
              tempPath, 
              operation.shape
            );
          }
          break;

        case 'speed-control':
          if (operation.speed) {
            await speedControlService.applyVariableSpeed(
              currentPath, 
              tempPath, 
              operation.speed
            );
          } else if (operation.reverse) {
            await speedControlService.reverseVideo(currentPath, tempPath);
          } else if (operation.freeze) {
            await speedControlService.freezeFrame(currentPath, tempPath, operation.freeze);
          }
          break;

        default:
          logger.warn('Unknown operation type', { type: operation.type });
          // Skip unknown operations
          if (!isLast) {
            tempFiles.push(currentPath);
          }
          continue;
      }

      currentPath = tempPath;
    }

    // Clean up temp files
    tempFiles.forEach(file => {
      if (fs.existsSync(file) && file !== outputPath) {
        try {
          fs.unlinkSync(file);
        } catch (err) {
          logger.warn('Failed to delete temp file', { file, error: err.message });
        }
      }
    });

    logger.info('Batch operations completed', { 
      operationsCount: operations.length, 
      outputPath 
    });

    return {
      success: true,
      outputPath,
      operationsApplied: operations.length
    };
  } catch (error) {
    // Clean up temp files on error
    tempFiles.forEach(file => {
      if (fs.existsSync(file) && file !== outputPath) {
        try {
          fs.unlinkSync(file);
        } catch (err) {
          // Ignore cleanup errors
        }
      }
    });

    logger.error('Batch operations error', { error: error.message });
    throw error;
  }
}

/**
 * Apply batch operations in parallel (for independent operations)
 */
async function applyBatchOperationsParallel(videoPath, operations, outputPath) {
  // For now, sequential is safer for video operations
  // Parallel would require more complex merging logic
  return applyBatchOperationsSequential(videoPath, operations, outputPath);
}

/**
 * Validate batch operations
 */
function validateBatchOperations(operations) {
  const validTypes = [
    'color-grading',
    'audio-mixing',
    'typography',
    'motion-graphics',
    'speed-control',
    'transitions'
  ];

  const errors = [];

  operations.forEach((op, index) => {
    if (!op.type) {
      errors.push(`Operation ${index + 1}: Missing type`);
    } else if (!validTypes.includes(op.type)) {
      errors.push(`Operation ${index + 1}: Invalid type "${op.type}"`);
    }

    // Type-specific validation
    switch (op.type) {
      case 'color-grading':
        if (!op.preset && !op.curves && !op.colorWheels) {
          errors.push(`Operation ${index + 1}: Color grading requires preset, curves, or colorWheels`);
        }
        break;
      case 'audio-mixing':
        if (!op.eqPreset && !op.noiseReduction && !op.normalize) {
          errors.push(`Operation ${index + 1}: Audio mixing requires eqPreset, noiseReduction, or normalize`);
        }
        break;
      case 'typography':
        if (!op.template && !op.textOverlay) {
          errors.push(`Operation ${index + 1}: Typography requires template or textOverlay`);
        }
        break;
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  applyBatchOperationsSequential,
  applyBatchOperationsParallel,
  validateBatchOperations,
};
