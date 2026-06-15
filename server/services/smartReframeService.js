/**
 * smartReframeService.js — subject-aware aspect-ratio reframing.
 *
 * The render engine (videoRenderService) scales every source to the exact target
 * W:H up front, which DISTORTS a source whose aspect differs from the target
 * (e.g. a 16:9 talking-head squished into 9:16). For the Repurpose Studio we
 * instead run a dedicated PRE-PASS that:
 *   1. cover-scales the source preserving aspect (so it overflows the target),
 *   2. crops the exact target window positioned on the detected subject.
 * The reframed intermediate is then handed to renderFromEditorState with
 * exportOptions.smartReframe=true (which skips the engine's legacy center crop),
 * so captions / watermark / tier clamp / C2PA all still apply on top — undistorted.
 *
 * Subject detection reuses saliencyService.detectActiveRegion (real ffmpeg
 * cropdetect). When detection or ffprobe fails we fall back to a centered cover
 * crop — never a distorted scale, and never a hard failure.
 *
 * computeReframe() is a pure function (no I/O) so the aspect-ratio math is
 * unit-testable in isolation.
 */

'use strict';

const ffmpegRunner = require('../utils/ffmpegRunner');
const saliency = require('./saliencyService');
const logger = require('../utils/logger');

// Canonical platform target sizes — kept in sync with routes/video/render.js
// RATIO_TO_SIZE so a reframed variant matches what the renderer expects.
const RATIO_DIMS = {
  '16:9': { w: 1920, h: 1080 },
  '9:16': { w: 1080, h: 1920 },
  '1:1': { w: 1080, h: 1080 },
  '4:5': { w: 1080, h: 1350 },
};

/** Round to the nearest even integer, min 2 (h264 yuv420p needs even, non-zero dims). */
function even(n) {
  return Math.max(2, Math.round(n / 2) * 2);
}

/** Round to the nearest even integer with NO minimum — for crop offsets, which
 *  can legitimately be 0 (subject hard against an edge). */
function evenOffset(n) {
  return Math.round(n / 2) * 2;
}

/** Round UP to an even integer (guarantees the cover-scaled frame covers target). */
function evenCeil(n) {
  const c = Math.ceil(n);
  return c % 2 === 0 ? c : c + 1;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Pure geometry: given a source size, a target size and a normalised subject
 * centre, return the cover-scaled dimensions and the integer crop window (even
 * dimensions, clamped in-frame). No ffmpeg, no I/O.
 *
 * @param {number} sourceW
 * @param {number} sourceH
 * @param {number} targetW
 * @param {number} targetH
 * @param {number} [subjectX=0.5] normalised 0..1 horizontal subject centre
 * @param {number} [subjectY=0.5] normalised 0..1 vertical subject centre
 * @returns {{ scaleW:number, scaleH:number, cropX:number, cropY:number, cropW:number, cropH:number }}
 */
function computeReframe(sourceW, sourceH, targetW, targetH, subjectX = 0.5, subjectY = 0.5) {
  const sw = Math.max(1, Number(sourceW) || 0);
  const sh = Math.max(1, Number(sourceH) || 0);
  const tw = even(targetW);
  const th = even(targetH);
  const sx = clamp(Number.isFinite(subjectX) ? subjectX : 0.5, 0, 1);
  const sy = clamp(Number.isFinite(subjectY) ? subjectY : 0.5, 0, 1);

  // Cover-scale factor: the larger ratio so the source fully covers the target.
  const coverScale = Math.max(tw / sw, th / sh);
  // Guarantee the scaled frame is at least the target size on both axes.
  const scaleW = Math.max(tw, evenCeil(sw * coverScale));
  const scaleH = Math.max(th, evenCeil(sh * coverScale));

  // Centre the crop window on the subject (in scaled-pixel space), then clamp so
  // the window stays fully inside the scaled frame.
  const cropX = clamp(evenOffset(sx * scaleW - tw / 2), 0, scaleW - tw);
  const cropY = clamp(evenOffset(sy * scaleH - th / 2), 0, scaleH - th);

  return { scaleW, scaleH, cropX, cropY, cropW: tw, cropH: th };
}

/** Resolve a ratio key (e.g. '9:16') or explicit {w,h} to target dims. */
function resolveTarget(ratioOrDims) {
  if (ratioOrDims && typeof ratioOrDims === 'object' && ratioOrDims.w && ratioOrDims.h) {
    return { w: even(ratioOrDims.w), h: even(ratioOrDims.h) };
  }
  const dims = RATIO_DIMS[ratioOrDims];
  return dims ? { ...dims } : { ...RATIO_DIMS['9:16'] };
}

/** Probe the displayed (rotation-aware) dimensions of a video, or null. */
async function probeDimensions(inputPath) {
  try {
    const meta = await ffmpegRunner.ffprobe(inputPath, { label: 'reframe.probe' });
    const v = (meta.streams || []).find((s) => s.codec_type === 'video');
    if (!v || !v.width || !v.height) return null;
    let w = Number(v.width);
    let h = Number(v.height);
    // Honour rotation metadata (portrait phone video stores landscape coded dims).
    const rotate = Number(v.tags?.rotate) || Number(v.rotation) || 0;
    if (Math.abs(rotate) === 90 || Math.abs(rotate) === 270) {
      const tmp = w; w = h; h = tmp;
    }
    return { w, h };
  } catch (e) {
    logger.warn('[reframe] ffprobe failed; using centered cover-crop', { error: e.message });
    return null;
  }
}

/**
 * Reframe `inputPath` to the target aspect and write it to `outputPath`.
 * Returns metadata describing what was done (for telemetry / reasoning logs).
 *
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {string|{w:number,h:number}} ratioOrDims  e.g. '9:16'
 * @param {object} [opts]
 * @param {{x:number,y:number,method?:string}} [opts.subject] pre-detected subject (skips detection)
 * @param {number} [opts.timeoutMs]
 * @returns {Promise<{ outputPath:string, targetW:number, targetH:number, method:string, subject:object }>}
 */
async function reframe(inputPath, outputPath, ratioOrDims, opts = {}) {
  const { w: targetW, h: targetH } = resolveTarget(ratioOrDims);

  // 1. Subject centre — reuse the caller's detection if provided, else detect.
  let subject = opts.subject;
  if (!subject) {
    try {
      subject = await saliency.detectActiveRegion(inputPath);
    } catch (e) {
      subject = { x: 0.5, y: 0.5, method: 'detect-error' };
    }
  }

  // 2. Source dimensions (rotation-aware). Null → centered cover-crop fallback.
  const dims = await probeDimensions(inputPath);

  let videoFilters;
  let method;
  if (dims) {
    const geom = computeReframe(dims.w, dims.h, targetW, targetH, subject.x, subject.y);
    videoFilters = [
      `scale=${geom.scaleW}:${geom.scaleH}`,
      `crop=${geom.cropW}:${geom.cropH}:${geom.cropX}:${geom.cropY}`,
    ];
    method = `subject:${subject.method || 'unknown'}`;
  } else {
    // No source dims → correct, undistorted centered cover-crop (crop with no
    // x/y centres by default). Never a distorting scale=W:H.
    videoFilters = [
      `scale=${targetW}:${targetH}:force_original_aspect_ratio=increase`,
      `crop=${targetW}:${targetH}`,
    ];
    method = 'centered-cover';
  }

  await ffmpegRunner.run(
    (ffmpeg) =>
      ffmpeg(inputPath)
        .videoFilters(videoFilters)
        .videoCodec('libx264')
        .outputOptions([
          '-preset', 'veryfast',
          '-crf', '18',
          '-pix_fmt', 'yuv420p',
          '-c:a', 'copy',     // preserve source audio untouched for the caption pass
          '-movflags', '+faststart',
        ]),
    { label: `reframe.${String(ratioOrDims).replace(/[^0-9a-z]/gi, '_')}`, output: outputPath, timeoutMs: opts.timeoutMs }
  );

  return { outputPath, targetW, targetH, method, subject };
}

module.exports = {
  computeReframe,
  reframe,
  resolveTarget,
  RATIO_DIMS,
};
