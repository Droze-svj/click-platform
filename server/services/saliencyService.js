/**
 * saliencyService.js
 * Heuristic saliency estimation for short-form vertical video.
 *
 * NOTE: A true per-frame model (DeepGaze II, MSINET) requires a GPU inference
 * pipeline that is not yet deployed.  This implementation returns a biologically
 * plausible prior: human subjects in vertical video are normally slightly above
 * the vertical centre (y ≈ 0.4) and centred horizontally.  Callers that have
 * real face-detection data should override centerOfMass before calling
 * getOptimalCaptionPosition().
 */

/**
 * Returns a heuristic saliency map for a video frame.
 * @param {Object} [frameHints] - Optional face/subject hints from metadata.
 * @param {number} [frameHints.faceY] - Normalised Y coordinate of detected face centre (0–1).
 * @param {number} [frameHints.faceX] - Normalised X coordinate of detected face centre (0–1).
 */
async function getFrameSaliency(frameHints = {}) {
  const cx = frameHints.faceX ?? 0.5;
  // Place center of mass slightly above true centre – matches empirical priors for
  // talking-head / lifestyle short-form content where the face is in the upper half.
  const cy = frameHints.faceY ?? 0.40;

  return {
    points: [
      { x: cx, y: cy, weight: 0.9, label: 'Primary Subject' },
      { x: 1 - cx, y: Math.min(cy + 0.4, 0.9), weight: 0.25, label: 'Secondary Region' },
    ],
    centerOfMass: { x: cx, y: cy },
    // Dead zone: 40 % wide, 30 % tall box around the subject – captions must not overlap
    recommendedUIDeadzones: [
      { x: cx - 0.20, y: cy - 0.15, width: 0.40, height: 0.30 },
    ],
    isHeuristic: true,
  };
}

/**
 * Suggests an optimal Y-position for captions based on saliency deadzones.
 * @param {Object} saliency - Output from getFrameSaliency
 * @returns {'top' | 'bottom' | 'middle'}
 */
function getOptimalCaptionPosition(saliency) {
  const { centerOfMass } = saliency;

  // Subject in bottom third → place captions at top to avoid overlap
  if (centerOfMass.y > 0.65) return 'top';

  // Subject in top quarter → standard bottom placement is safe
  if (centerOfMass.y < 0.25) return 'bottom';

  // Subject in centre band → prefer bottom (most viewer expectation for captions)
  return 'bottom';
}

/**
 * Uses FFmpeg cropdetect to find the most active (non-black) region of a video
 * and return a normalised { x, y } centre of mass for smart framing.
 * Samples 10 frames spread evenly through the video, takes the median crop rectangle,
 * then normalises to [0,1]. Falls back to the heuristic prior on any failure.
 *
 * @param {string} inputPath - Local file path to the video.
 * @returns {Promise<{ x: number, y: number, method: string, cropSample?: object }>}
 */
async function detectActiveRegion(inputPath) {
  return new Promise((resolve) => {
    if (!inputPath || typeof inputPath !== 'string') {
      return resolve({ x: 0.5, y: 0.4, method: 'fallback-no-path' });
    }

    const { spawn } = require('child_process');
    const proc = spawn('ffmpeg', [
      '-i', inputPath,
      '-vf', "select='not(mod(n,30))',cropdetect=24:16:0",
      '-frames:v', '10',
      '-f', 'null', '-',
    ], { stdio: ['ignore', 'ignore', 'pipe'] });

    const crops = [];
    let buffer = '';

    proc.stderr.on('data', chunk => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();
      lines.forEach(line => {
        const m = line.match(/crop=(\d+):(\d+):(\d+):(\d+)/);
        if (m) crops.push({ w: +m[1], h: +m[2], x: +m[3], y: +m[4] });
      });
    });

    const timeout = setTimeout(() => {
      proc.kill();
      resolve({ x: 0.5, y: 0.4, method: 'timeout' });
    }, 8000);

    proc.on('close', () => {
      clearTimeout(timeout);
      if (crops.length === 0) return resolve({ x: 0.5, y: 0.4, method: 'fallback-no-crops' });

      const sorted = [...crops].sort((a, b) => a.x - b.x);
      const mid = sorted[Math.floor(sorted.length / 2)];

      // Normalise against standard vertical frame (1080×1920).
      // For landscape source with blurred bg the active box is usually centred.
      const sourceW = 1080;
      const sourceH = 1920;
      const cx = Math.max(0.1, Math.min(0.9, (mid.x + mid.w / 2) / sourceW));
      const cy = Math.max(0.1, Math.min(0.9, (mid.y + mid.h / 2) / sourceH));

      resolve({ x: cx, y: cy, method: 'cropdetect', cropSample: mid });
    });

    proc.on('error', () => {
      clearTimeout(timeout);
      resolve({ x: 0.5, y: 0.4, method: 'fallback-error' });
    });
  });
}

module.exports = {
  getFrameSaliency,
  getOptimalCaptionPosition,
  detectActiveRegion,
};
