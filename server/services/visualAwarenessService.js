// Visual Awareness Service
// Identifies objects in video to suggest safe zones for captions/graphics

const motionTrackingService = require('./motionTrackingService');
const logger = require('../utils/logger');

/**
 * Get areas to avoid in the video
 * @param {string} videoPath - Path to video file
 * @returns {Promise<Array>} List of avoidance zones { x, y, width, height }
 */
async function getAvoidanceZones(videoPath) {
  try {
    // In a real implementation, we would run face/object detection across the video
    // For Phase 11, we integrate with motionTrackingService
    const faceData = await motionTrackingService.trackFace(videoPath, { startTime: 0, endTime: 10 });
    const objectData = await motionTrackingService.trackObject(videoPath, {
      boundingBox: { x: 860, y: 440, width: 200, height: 200 },
      startTime: 0,
      endTime: 10
    });

    const avoidanceZones = [
      ...(faceData.faces || []).map(f => ({ x: f.x, y: f.y, width: f.width, height: f.height, type: 'face' })),
      ...(objectData.object?.path || []).map(o => ({ x: o.x, y: o.y, width: o.width, height: o.height, type: 'object' }))
    ];

    logger.info('Avoidance zones identified', { zoneCount: avoidanceZones.length });
    return avoidanceZones;
  } catch (error) {
    logger.error('Error getting avoidance zones', { error: error.message });
    return [];
  }
}

/**
 * Suggest a safe caption position based on avoidance zones
 * @param {Array} zones - Avoidance zones
 * @param {number} width - Video width
 * @param {number} height - Video height
 * @returns {string} Suggested position: 'bottom', 'top', 'middle-left', 'middle-right'
 */
function calculateSafeCaptionPosition(zones, width = 1920, height = 1080) {
  if (!zones || zones.length === 0) return 'bottom';

  // Check bottom third (traditional caption spot)
  const bottomThird = { x: 0, y: (height * 2) / 3, width, height: height / 3 };
  const topThird = { x: 0, y: 0, width, height: height / 3 };

  const overlapsBottom = zones.some(z => checkOverlap(z, bottomThird));
  const overlapsTop = zones.some(z => checkOverlap(z, topThird));

  if (!overlapsBottom) return 'bottom';
  if (!overlapsTop) return 'top';

  // If both are obscured, try to find a side path or stick to bottom as fallback
  return 'middle-right';
}

function checkOverlap(rect1, rect2) {
  return (
    rect1.x < rect2.x + rect2.width &&
    rect1.x + rect1.width > rect2.x &&
    rect1.y < rect2.y + rect2.height &&
    rect1.y + rect1.height > rect2.y
  );
}

module.exports = {
  getAvoidanceZones,
  calculateSafeCaptionPosition
};
