// Shot Clustering Routes

const express = require('express');
const auth = require('../../middleware/auth');
const { clusterShotsIntoScenes } = require('../../services/shotClusteringService');
const { clusterShotsIntoScenesAdvanced } = require('../../services/shotClusteringAdvanced');
const { extractAudioFeatures } = require('../../services/advancedAudioFeatureExtraction');
const { detectVisualScenes } = require('../../services/multiModalSceneDetection');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @route POST /api/video/scenes/cluster
 * @desc Cluster shots into scenes using visual+audio features
 * @access Private
 */
router.post('/cluster', auth, asyncHandler(async (req, res) => {
  const {
    videoUrl,
    videoId,
    fps = 3,
    sensitivity = 0.3,
    visualWeight = null, // Auto-tune if null
    audioWeight = null, // Auto-tune if null
    similarityThreshold = null, // Auto-tune if null
    minSceneLength = 2.0,
    maxSceneLength = 60.0,
    method = 'similarity', // 'similarity', 'hierarchical', 'kmeans'
    linkage = 'average', // For hierarchical: 'single', 'average', 'complete'
    useAdvanced = true, // Use advanced clustering
    optimizeCoherence = true,
    dynamicThresholds = true,
    multiResolution = false,
    refineBoundaries = true,
    classifySceneTypes = true
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
    logger.info('Detecting visual shot boundaries for clustering', { videoPath });
    const visualShotBoundaries = await detectVisualScenes(videoPath, fps, sensitivity, duration);
    
    // Convert to shot format
    const shots = visualShotBoundaries.map((boundary, index) => ({
      start: index > 0 ? visualShotBoundaries[index - 1].timestamp : 0,
      end: boundary.timestamp,
      timestamp: boundary.timestamp,
      confidence: boundary.confidence || 0.5,
      cues: boundary.cues || {}
    }));

    // Add final shot
    if (shots.length > 0) {
      shots.push({
        start: shots[shots.length - 1].end,
        end: duration,
        timestamp: duration,
        confidence: 0.5,
        cues: {}
      });
    }

    // Step 2: Extract audio features
    logger.info('Extracting audio features for clustering', { videoPath });
    const audioFeatures = await extractAudioFeatures(videoPath, {
      windowSize: 0.5,
      hopSize: 0.25,
      aggregateByShots: false
    });

    // Step 3: Cluster shots into scenes (advanced or standard)
    logger.info('Clustering shots into scenes', { videoPath, shotCount: shots.length, useAdvanced });
    
    let clusteringResult;
    if (useAdvanced) {
      clusteringResult = clusterShotsIntoScenesAdvanced(shots, audioFeatures, {
        visualWeight,
        audioWeight,
        similarityThreshold,
        minSceneLength,
        maxSceneLength,
        method,
        linkage,
        optimizeCoherence,
        dynamicThresholds,
        multiResolution,
        refineBoundaries,
        classifySceneTypes
      });
    } else {
      clusteringResult = clusterShotsIntoScenes(shots, audioFeatures, {
        visualWeight: visualWeight || 0.5,
        audioWeight: audioWeight || 0.5,
        similarityThreshold: similarityThreshold || 0.3,
        minSceneLength,
        maxSceneLength,
        method,
        linkage
      });
    }

    sendSuccess(res, 'Shot clustering completed', 200, {
      scenes: clusteringResult.scenes,
      clusters: clusteringResult.clusters.length,
      statistics: clusteringResult.statistics,
      shotCount: shots.length,
      sceneCount: clusteringResult.scenes.length
    });
  } catch (error) {
    logger.error('Error in shot clustering', { error: error.message });
    sendError(res, error.message || 'Failed to cluster shots', 500);
  }
}));

module.exports = router;

