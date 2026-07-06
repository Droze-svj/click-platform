// FFmpeg capability probe — discovers which encoders the ACTUAL ffmpeg binary
// (the same one fluent-ffmpeg drives) supports, so hardware-accelerated encoding
// is only ever selected when it genuinely exists on the render host. Cached: the
// encoder list can't change without a process restart, and the probe spawns
// ffmpeg, so we do it at most once.

const ffmpeg = require('fluent-ffmpeg');
const logger = require('./logger');

let _cache = null;

/**
 * Resolve the set of available encoders as the object fluent-ffmpeg returns
 * (keys are encoder names, e.g. `h264_nvenc`, `h264_videotoolbox`, `libx264`).
 * Never throws and never rejects — on any failure it resolves to `{}` so callers
 * cleanly fall back to software encoding.
 */
function getAvailableEncoders() {
  if (_cache) return Promise.resolve(_cache);
  return new Promise((resolve) => {
    try {
      ffmpeg.getAvailableEncoders((err, encoders) => {
        if (err || !encoders) {
          logger.warn('[ffmpeg] could not probe encoders — assuming software only', { error: err?.message });
          _cache = {};
        } else {
          _cache = encoders;
        }
        resolve(_cache);
      });
    } catch (e) {
      logger.warn('[ffmpeg] encoder probe threw — assuming software only', { error: e.message });
      _cache = {};
      resolve(_cache);
    }
  });
}

/** Test-only: clear the cached probe result. */
function _resetCache() { _cache = null; }

module.exports = { getAvailableEncoders, _resetCache };
