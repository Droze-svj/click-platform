/**
 * saliencyService.js
 * Simulated Eye-Tracking (Saliency) Model.
 * Predicts "Center of Visual Mass" to avoid covering critical subjects with UI/Captions.
 */

/**
 * Returns a heatmap of visual importance for a given frame image (mocked).
 * In production, this would use a model like DeepGaze II or MSINET via WebNN/WASM.
 */
async function getFrameSaliency() {
  // Simulated Saliency: high importance usually at center or where faces are.
  return {
    points: [
      { x: 0.5, y: 0.4, weight: 0.9, label: 'Primary Subject' },
      { x: 0.2, y: 0.8, weight: 0.3, label: 'Secondary Motion' }
    ],
    centerOfMass: { x: 0.5, y: 0.45 },
    recommendedUIDeadzones: [
      { x: 0.4, y: 0.3, width: 0.2, height: 0.3 } // Subject Box
    ]
  };
}

/**
 * Suggests an optimal Y-position for captions based on saliency deadzones.
 * @param {Object} saliency - Output from getFrameSaliency
 * @returns {string} 'top' | 'bottom' | 'middle'
 */
function getOptimalCaptionPosition(saliency) {
  const { centerOfMass } = saliency;

  // If center of mass is too low, move captions to top
  if (centerOfMass.y > 0.7) return 'top';

  // If center of mass is too high, move captions to bottom (default)
  if (centerOfMass.y < 0.3) return 'bottom';

  // If it's dead center, we usually prefer bottom but might need a slight offset
  return 'bottom';
}

module.exports = {
  getFrameSaliency,
  getOptimalCaptionPosition
};
