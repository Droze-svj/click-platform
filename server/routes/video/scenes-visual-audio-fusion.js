// Visual-Audio Fusion Routes

const express = require('express');
const auth = require('../../middleware/auth');
const { fuseVisualAudioBoundaries } = require('../../services/visualAudioFusion');
const { fuseVisualAudioBoundariesAdvanced, refineBoundariesMultiPass } = require('../../services/visualAudioFusionAdvanced');
const { extractAudioFeatures } = require('../../services/advancedAudioFeatureExtraction');
const { detectVisualScenes } = require('../../services/multiModalSceneDetection');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @route POST /api/video/scenes/visual-audio-fusion
 * @desc Fuse visual shot boundaries with audio features
 * @access Private
 */
router.post('/visual-audio-fusion', auth, asyncHandler(async (req, res) => {
  const { 
    videoUrl, 
    videoId,
    fps = 3,
    sensitivity = 0.3,
    audioThreshold = null, // Auto-tune if null
    visualThreshold = null, // Auto-tune if null
    classChangeThreshold = 0.5,
    requireBoth = false,
    refineWithAudio = true,
    useML = true,
    temporalConsistency = true,
    adaptiveThresholds = true,
    confidenceCalibration = true,
    useAdvanced = true // Use advanced fusion by default
  } = req.body;

  if (!videoUrl && !videoId) {
    return sendError(res, 'Either videoUrl or videoId is required', 400);
  }

  try {
    const { getVideoFilePath } = require('../../services/sceneDetectionService');
    const videoPath = await getVideoFilePath(videoId || videoUrl);

    // Get video duration
    const ffmpeg = require('fluent-ffmpeg');
    const duration = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata.format.duration || 0);
      });
    });

    // Step 1: Detect visual shot boundaries
    logger.info('Detecting visual shot boundaries', { videoPath });
    const visualShotBoundaries = await detectVisualScenes(videoPath, fps, sensitivity, duration);
    const visualBoundaries = visualShotBoundaries.map(scene => ({
      timestamp: scene.timestamp,
      confidence: scene.confidence || 0.5,
      cues: scene.cues || {}
    }));

    // Step 2: Extract audio features
    logger.info('Extracting audio features for fusion', { videoPath });
    const audioFeatures = await extractAudioFeatures(videoPath, {
      windowSize: 0.5,
      hopSize: 0.25,
      aggregateByShots: false
    });

    // Step 3: Fuse visual and audio boundaries (advanced or standard)
    logger.info('Fusing visual and audio boundaries', { videoPath, useAdvanced });
    
    let fusionResult;
    if (useAdvanced) {
      fusionResult = fuseVisualAudioBoundariesAdvanced(
        visualBoundaries,
        audioFeatures,
        {
          audioThreshold,
          visualThreshold,
          classChangeThreshold,
          requireBoth,
          useML,
          temporalConsistency,
          adaptiveThresholds,
          confidenceCalibration
        }
      );
    } else {
      fusionResult = fuseVisualAudioBoundaries(
        visualBoundaries,
        audioFeatures,
        {
          audioThreshold: audioThreshold || 0.3,
          visualThreshold: visualThreshold || 0.5,
          classChangeThreshold,
          requireBoth,
          audioFeatureWindow: 1.0
        }
      );
    }

    // Step 4: Multi-pass refinement if enabled
    let refinedBoundaries = fusionResult.sceneBoundaries;
    if (refineWithAudio && useAdvanced) {
      refinedBoundaries = refineBoundariesMultiPass(
        fusionResult.sceneBoundaries,
        audioFeatures,
        {
          maxPasses: 3,
          minConfidenceGain: 0.05
        }
      );
    } else if (refineWithAudio) {
      const { refineSceneBoundariesWithAudio } = require('../../services/visualAudioFusion');
      refinedBoundaries = refineSceneBoundariesWithAudio(
        fusionResult.sceneBoundaries,
        audioFeatures,
        {
          audioRefinementThreshold: 0.2,
          mergeNearbyBoundaries: true,
          mergeDistance: 1.0
        }
      );
    }

    sendSuccess(res, 'Visual-audio fusion completed', 200, {
      sceneBoundaries: refinedBoundaries,
      shotCuts: fusionResult.shotCuts,
      statistics: fusionResult.statistics,
      visualBoundaries: visualBoundaries.length,
      finalSceneBoundaries: refinedBoundaries.length,
      promotionRate: refinedBoundaries.length / visualBoundaries.length
    });
  } catch (error) {
    logger.error('Error in visual-audio fusion', { error: error.message });
    sendError(res, error.message || 'Failed to perform visual-audio fusion', 500);
  }
}));

module.exports = router;

