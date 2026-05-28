/**
 * /api/video/tools — thin wrappers around existing services that surface
 * the most-asked creator features as one-call endpoints.
 *
 *   POST /api/video/tools/remove-silence    Auto-cut silent gaps
 *   POST /api/video/tools/remove-fillers    Strip "um/uh/like" + silences
 *   POST /api/video/tools/edit-by-text      Descript-style: keep selected ranges
 *
 * Each endpoint validates ownership, runs the underlying pipeline, and
 * returns the new video URL. They reuse `autoJumpcut`, `autoEditVideo`,
 * and a small ffmpeg concat helper instead of duplicating logic.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

const auth = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const { guardOwnership } = require('../../utils/ownership');
const { autoJumpcut, autoEditVideo } = require('../../services/aiVideoEditingService');
const { uploadFile } = require('../../services/storageService');
const { toAbsolutePath } = require('../../utils/pathUtils');
const logger = require('../../utils/logger');

// ── 1. Remove silences ──────────────────────────────────────────────────────
// Body: { videoId, threshold?: dB (default -30), minDuration?: seconds (0.5) }
// Returns: { url } of the silence-cut video.
router.post('/remove-silence', auth, asyncHandler(async (req, res) => {
  const { videoId, threshold, minDuration } = req.body || {};
  if (!videoId) return sendError(res, 'videoId is required', 400);

  const owned = await guardOwnership(req, res, videoId);
  if (!owned) return;

  try {
    const out = await autoJumpcut(
      videoId,
      Number.isFinite(+threshold) ? +threshold : -30,
      Number.isFinite(+minDuration) ? +minDuration : 0.5
    );
    return sendSuccess(res, 'Silences removed', 200, out);
  } catch (e) {
    logger.error('remove-silence failed', { videoId, error: e.message });
    return sendError(res, `Failed to remove silences: ${e.message}`, 500);
  }
}));

// ── 2. Remove filler words ("um", "uh", etc.) + silences ────────────────────
// Body: { videoId, intensity?: 'gentle' | 'medium' | 'aggressive' }
// Reuses the auto-edit pipeline because filler removal is bundled there.
// Defaults to aggressive so the deltas are obvious to the user.
router.post('/remove-fillers', auth, asyncHandler(async (req, res) => {
  const { videoId, intensity } = req.body || {};
  if (!videoId) return sendError(res, 'videoId is required', 400);

  const owned = await guardOwnership(req, res, videoId);
  if (!owned) return;

  const userId = req.user?._id || req.user?.id;
  const options = {
    pacingIntensity: ['gentle', 'medium', 'aggressive'].includes(intensity) ? intensity : 'aggressive',
    optimizePacing: true,
    removeFillerWords: true,
    enableTextOverlays: false,
    enableCaptions: false,
    clipCount: 1,
    _multiClipMode: false,
  };

  try {
    const result = await autoEditVideo(videoId, options, userId);
    return sendSuccess(res, 'Recording mistakes / fillers removed', 200, {
      url: result?.editedVideoUrl || null,
      editsApplied: result?.editsApplied || [],
    });
  } catch (e) {
    logger.error('remove-fillers failed', { videoId, error: e.message });
    return sendError(res, `Failed to remove fillers: ${e.message}`, 500);
  }
}));

// ── 3. Edit-by-text (Descript-style) ────────────────────────────────────────
// The frontend renders the video's transcript with word-level timestamps,
// the user marks ranges to KEEP (or equivalently, deletes ranges to drop),
// and submits the union of keep-ranges as `[[start_s, end_s], ...]`.
// We concatenate those windows of the source video into the output.
//
// Body: { videoId, keepRanges: [[start, end], ...] }
// Returns: { url } of the assembled video.
router.post('/edit-by-text', auth, asyncHandler(async (req, res) => {
  const { videoId, keepRanges } = req.body || {};
  if (!videoId) return sendError(res, 'videoId is required', 400);
  if (!Array.isArray(keepRanges) || keepRanges.length === 0) {
    return sendError(res, 'keepRanges must be a non-empty array of [start, end] pairs', 400);
  }

  const owned = await guardOwnership(req, res, videoId);
  if (!owned) return;

  // Sanitize + sort + merge overlapping ranges so ffmpeg's select filter
  // gets a clean monotonic input.
  const cleaned = keepRanges
    .map((r) => Array.isArray(r) && r.length === 2 ? [Number(r[0]), Number(r[1])] : null)
    .filter((r) => r && Number.isFinite(r[0]) && Number.isFinite(r[1]) && r[1] > r[0])
    .sort((a, b) => a[0] - b[0]);

  if (cleaned.length === 0) {
    return sendError(res, 'No valid keep ranges supplied', 400);
  }
  // Merge overlaps
  const merged = [cleaned[0]];
  for (let i = 1; i < cleaned.length; i++) {
    const tail = merged[merged.length - 1];
    if (cleaned[i][0] <= tail[1]) {
      tail[1] = Math.max(tail[1], cleaned[i][1]);
    } else {
      merged.push(cleaned[i]);
    }
  }

  const inputPath = toAbsolutePath(owned.originalFile?.url);

  if (!inputPath || !fs.existsSync(inputPath)) {
    return sendError(res, 'Source video file not found on disk', 404);
  }

  const outputFilename = `text-edit-${videoId}-${Date.now()}.mp4`;
  const outputPath = toAbsolutePath(`uploads/videos/${outputFilename}`);

  // Build a select filter that keeps the union of ranges. setpts/asetpts
  // re-pack the timeline so the output plays without gaps. This is the same
  // approach the auto-edit pipeline uses for clip extraction.
  const between = merged.map(([s, e]) => `between(t,${s.toFixed(3)},${e.toFixed(3)})`).join('+');
  const videoFilter = `select='${between}',setpts=N/FRAME_RATE/TB`;
  const audioFilter = `aselect='${between}',asetpts=N/SR/TB`;

  try {
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters(videoFilter)
        .audioFilters(audioFilter)
        .outputOptions(['-c:v libx264', '-preset medium', '-crf 23', '-c:a aac', '-b:a 192k'])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    const upload = await uploadFile(outputPath, `videos/${outputFilename}`, 'video/mp4', { videoId, type: 'edit-by-text' });
    return sendSuccess(res, 'Video re-cut from text edits', 200, {
      url: upload.url,
      keptRanges: merged,
      keptDuration: merged.reduce((sum, [s, e]) => sum + (e - s), 0),
    });
  } catch (e) {
    logger.error('edit-by-text failed', { videoId, error: e.message });
    return sendError(res, `Edit-by-text failed: ${e.message}`, 500);
  }
}));

module.exports = router;
