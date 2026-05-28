const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const spatialService = require('../services/spatialService');
const logger = require('../utils/logger');

/**
 * @route   POST /api/captions-spatial/detect
 * @desc    Detect faces and objects in a frame for smart caption dodging
 * @access  Private
 */
router.post('/detect', auth, asyncHandler(async (req, res) => {
  const { frameBase64, videoWidth, videoHeight } = req.body;

  if (!frameBase64) {
    return sendError(res, 'frameBase64 is required', 400);
  }

  logger.info('[Spatial] Detecting zones for frame', { 
    size: Math.round(frameBase64.length / 1024) + 'KB',
    videoWidth,
    videoHeight 
  });

  const detections = await spatialService.detectSpatialZones(frameBase64);

  // Convert normalized 0-1000 to pixels if dimensions provided
  const processedDetections = detections.map(d => {
    if (videoWidth && videoHeight) {
      return {
        ...d,
        x: (d.x / 1000) * videoWidth,
        y: (d.y / 1000) * videoHeight,
        w: (d.w / 1000) * videoWidth,
        h: (d.h / 1000) * videoHeight
      };
    }
    return d;
  });

  sendSuccess(res, 'Spatial zones detected', 200, {
    detections: processedDetections,
    count: processedDetections.length
  });
}));

/**
 * @route   POST /api/phase8/spatial
 * @desc    Advanced spatial analysis for creative scene understanding
 * @access  Private
 */
router.post('/phase8/spatial', auth, asyncHandler(async (req, res) => {
  const { frameBase64 } = req.body;
  
  if (!frameBase64) {
    return sendError(res, 'frameBase64 is required', 400);
  }

  // Placeholder for Phase 8 advanced creative spatial logic
  const detections = await spatialService.detectSpatialZones(frameBase64);
  
  sendSuccess(res, 'Phase 8 spatial analysis complete', 200, {
    detections,
    creativeInsights: [
      "Scene lighting is optimal for product placement",
      "Dynamic movement detected in left quadrant",
      "Text safe-zone: upper-right"
    ]
  });
}));

module.exports = router;
