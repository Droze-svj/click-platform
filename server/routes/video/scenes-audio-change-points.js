// Audio Change Point Detection Routes

const express = require('express');
const auth = require('../../middleware/auth');
const { extractAudioFeatures } = require('../../services/advancedAudioFeatureExtraction');
const { detectChangePointsFromAudio } = require('../../services/audioChangePointDetection');
const { detectAudioChangePointsAdvanced, autoTuneParameters } = require('../../services/audioChangePointDetectionAdvanced');
const { computeFeatureDistances } = require('../../services/audioChangePointDetection');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @route POST /api/video/scenes/audio-change-points
 * @desc Detect audio change points from video
 * @access Private
 */
router.post('/audio-change-points', auth, asyncHandler(async (req, res) => {
  const { 
    videoUrl, 
    videoId, 
    windowSize = 0.5,
    hopSize = 0.25,
    distanceMetric = 'weighted',
    threshold = null, // Auto-tune if not provided
    minDistance = null, // Auto-tune if not provided
    detectClassTransitions = true,
    peakDetectionMethod = 'adaptive',
    smoothing = true,
    smoothingWindow = 3,
    multiScale = false,
    validateChangePoints = true,
    hierarchical = false,
    autoTune = true
  } = req.body;

  if (!videoUrl && !videoId) {
    return sendError(res, 'Either videoUrl or videoId is required', 400);
  }

  try {
    const { getVideoFilePath } = require('../../services/sceneDetectionService');
    const videoPath = await getVideoFilePath(videoId || videoUrl);

    // Extract audio features
    const audioFeatures = await extractAudioFeatures(videoPath, {
      windowSize,
      hopSize,
      aggregateByShots: false
    });

    // Auto-tune parameters if enabled
    let detectionParams = {
      distanceMetric,
      threshold: threshold || 0.3,
      minDistance: minDistance || 0.5,
      detectClassTransitions,
      peakDetectionMethod,
      smoothing,
      smoothingWindow,
      multiScale,
      validateChangePoints,
      hierarchical
    };

    if (autoTune && (!threshold || !minDistance)) {
      const rawDistances = computeFeatureDistances(audioFeatures.windows, distanceMetric);
      const tunedParams = autoTuneParameters(rawDistances, audioFeatures.windows);
      detectionParams = {
        ...detectionParams,
        threshold: threshold || tunedParams.threshold,
        minDistance: minDistance || tunedParams.minDistance,
        multiScale: multiScale || tunedParams.multiScale,
        smoothing: smoothing !== false ? tunedParams.smoothing : smoothing,
        smoothingWindow: tunedParams.smoothingWindow
      };
    }

    // Detect change points using advanced method
    const changePoints = detectAudioChangePointsAdvanced(
      audioFeatures.windows,
      detectionParams
    );

    sendSuccess(res, 'Audio change points detected successfully', 200, {
      changePoints: changePoints.changePoints,
      distances: changePoints.distances,
      segments: changePoints.segments,
      hierarchy: changePoints.hierarchy,
      statistics: changePoints.statistics,
      parameters: detectionParams
    });
  } catch (error) {
    logger.error('Error detecting audio change points', { error: error.message });
    sendError(res, error.message || 'Failed to detect audio change points', 500);
  }
}));

module.exports = router;

