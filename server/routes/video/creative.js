// Creative AI Video Tools — real service delegation (no mocks).
//
// Mounted at /api/video/creative (see server/index.js). Every handler below
// delegates to a real backend service:
//   /transcribe       → videoTranscriptionService.transcribeVideo (JSON2VIDEO → Gemini)
//   /auto-reframe      → creativeToolsService.autoReframe        (deterministic crop plan)
//   /magic-broll       → creativeToolsService.magicBRoll         (Pexels-backed overlays)
//   /thumbnail         → aiThumbnailService.autoGenerateViralThumbnails (FFmpeg frame+overlay)
//   /speed-ramp        → creativeToolsService.applySpeedRamp     (beat-synced ramp plan)
//   /eye-contact       → creativeToolsService.fixEyeContact      (honest not-implemented)
//   /background-swap   → creativeToolsService.swapBackground     (honest not-implemented)
//
// Responses are intentionally FLAT (`{ success, ... }`) rather than wrapped in
// the sendSuccess `{ data }` envelope, because the editor's CreativeAIView and
// ThumbnailGeneratorView read fields at the top level (res.overlays,
// res.rampCount, res.thumbnailUrl). asyncHandler is still used so any thrown
// error is caught by the global error handler instead of hanging the request.

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { guardOwnership } = require('../../utils/ownership');
const { assertPublicUrl } = require('../../utils/urlGuard');
const logger = require('../../utils/logger');

const creativeTools = require('../../services/creativeToolsService');
const videoTranscriptionService = require('../../services/videoTranscriptionService');
const aiThumbnailService = require('../../services/aiThumbnailService');
const aiLocalizationService = require('../../services/aiLocalizationService');
const aiOutpaintingService = require('../../services/aiOutpaintingService');

// Configure multer for temp uploads
const uploadDir = path.join(__dirname, '../../../uploads/creative');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Separate folder for fonts to easily serve them
const fontDir = path.join(__dirname, '../../../uploads/fonts');
if (!fs.existsSync(fontDir)) {
  fs.mkdirSync(fontDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB max
});

const fontUpload = multer({
  dest: fontDir,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB max for fonts
});

const getUserId = (req) => req.user?._id || req.user?.id || null;

/**
 * POST /transcribe
 * Transcribe an uploaded video (or a known videoId) via the unified
 * transcription service (JSON2VIDEO primary, Gemini fallback). Returns the
 * Whisper-style { text, segments, words } the editor expects.
 */
router.post('/transcribe', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const file = req.file;
  const { videoId, language } = req.body;
  if (!file && !videoId) {
    return res.status(400).json({ success: false, error: 'A video file or videoId is required' });
  }

  try {
    const transcript = await videoTranscriptionService.transcribeVideo(
      videoId || `upload-${Date.now()}`,
      {
        videoPath: file?.path || null,
        userId: String(getUserId(req) || 'system'),
        language: language || 'en',
      }
    );

    res.json({
      success: true,
      transcript: {
        text: transcript.fullText,
        segments: transcript.segments,
        words: transcript.words,
        language: transcript.language,
        duration: transcript.duration,
        provider: transcript.provider,
      },
    });
  } catch (error) {
    logger.error('[creative/transcribe] failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  } finally {
    // Always clean up the multer temp upload — success or failure.
    if (file?.path) fs.promises.unlink(file.path).catch(() => {});
  }
}));

/**
 * POST /auto-reframe
 * Returns a deterministic center-crop plan for the requested aspect ratio.
 * The editor's renderer applies the FFmpeg crop at export time.
 */
router.post('/auto-reframe', auth, express.json(), asyncHandler(async (req, res) => {
  const { videoId, aspectRatio } = req.body;
  if (!videoId) {
    return res.status(400).json({ success: false, error: 'No videoId provided' });
  }

  const result = await creativeTools.autoReframe(videoId, aspectRatio || '9:16', getUserId(req));
  res.json(result);
}));

/**
 * POST /magic-broll
 * Context-aware B-roll: extracts visualisable keywords from the transcript and
 * matches Pexels stock footage. The client sends `transcript` as either a
 * words array ([{ word, start }]) or segments ([{ text, startTime }]); we
 * normalise both into the segment shape the service expects.
 */
router.post('/magic-broll', auth, express.json(), asyncHandler(async (req, res) => {
  const { videoId, transcript } = req.body;
  if (!videoId) {
    return res.status(400).json({ success: false, error: 'Requires videoId' });
  }

  const raw = Array.isArray(transcript) ? transcript : [];
  const segments = raw
    .map((e) => ({
      text: e.text || e.word || '',
      startTime: e.startTime ?? e.start ?? 0,
    }))
    .filter((s) => s.text);

  const result = await creativeTools.magicBRoll(videoId, segments, getUserId(req), {});

  // The editor timeline (ModernVideoEditor onUpdateBroll) reads `b.url`, while
  // the service returns `clipUrl`. Expose both so the splice works.
  const overlays = (result.overlays || []).map((o) => ({
    ...o,
    url: o.clipUrl || o.url || null,
  }));

  res.json({
    success: result.success !== false,
    videoId,
    overlays,
    message: result.message,
  });
}));

/**
 * POST /thumbnail
 * Real thumbnail generation. Primary path renders an AI overlay thumbnail from
 * the source video on disk (FFmpeg frame extract + drawtext). When the source
 * isn't resolvable (e.g. client-only / dev content), we persist the
 * client-captured frame as a real file so it's servable and downloadable.
 */
router.post('/thumbnail', auth, express.json({ limit: '15mb' }), asyncHandler(async (req, res) => {
  const { videoId, frameDataUrl, style, title } = req.body;
  if (!videoId && !frameDataUrl) {
    return res.status(400).json({ success: false, error: 'videoId or frameDataUrl is required' });
  }

  // Primary: render from the source video.
  if (videoId) {
    // IDOR guard: only render a thumbnail from a source video the caller owns.
    const owned = await guardOwnership(req, res, videoId);
    if (!owned) return;
    try {
      const result = await aiThumbnailService.autoGenerateViralThumbnails(
        videoId,
        {},
        { clipText: title || '', count: 1 }
      );
      if (result?.success && result.bestThumbnail) {
        return res.json({
          success: true,
          thumbnailUrl: result.bestThumbnail,
          variants: result.variants,
          styleApplied: style || 'viral',
          message: 'AI thumbnail rendered from source video.',
        });
      }
    } catch (err) {
      logger.warn('[creative/thumbnail] source render failed; falling back to captured frame', {
        videoId,
        error: err.message,
      });
    }
  }

  // Fallback: persist the client-captured frame as a real file.
  if (frameDataUrl && /^data:image\/(png|jpe?g);base64,/i.test(frameDataUrl)) {
    const outDir = path.join(__dirname, '../../../uploads/thumbnails');
    await fs.promises.mkdir(outDir, { recursive: true });
    const ext = /image\/png/i.test(frameDataUrl) ? 'png' : 'jpg';
    const base64 = frameDataUrl.replace(/^data:image\/[a-z+]+;base64,/i, '');
    const filename = `${videoId || 'frame'}_${Date.now()}.${ext}`;
    await fs.promises.writeFile(path.join(outDir, filename), Buffer.from(base64, 'base64'));
    return res.json({
      success: true,
      thumbnailUrl: `/uploads/thumbnails/${filename}`,
      styleApplied: style || 'viral',
      message: 'Thumbnail saved from captured frame.',
    });
  }

  return res.status(422).json({
    success: false,
    error: 'Could not render from source video and no valid frame was provided.',
  });
}));

/**
 * POST /speed-ramp
 * Beat-synced speed ramp plan. The editor's renderer applies setpts ramps at
 * the returned beat markers.
 */
router.post('/speed-ramp', auth, express.json(), asyncHandler(async (req, res) => {
  const { videoId, intensity, preserveAudio, trackId, trackSource } = req.body;
  if (!videoId) {
    return res.status(400).json({ success: false, error: 'No videoId provided' });
  }

  const result = await creativeTools.applySpeedRamp(
    videoId,
    { intensity, preserveAudio, trackId, trackSource },
    getUserId(req)
  );
  res.json(result);
}));

/**
 * POST /eye-contact
 * Honest not-implemented response (returns { success: false, notImplemented: true })
 * — no fake success. Frontend surfaces this as a "coming soon" state.
 */
router.post('/eye-contact', auth, express.json(), asyncHandler(async (req, res) => {
  const { videoId } = req.body;
  if (!videoId) {
    return res.status(400).json({ success: false, error: 'No videoId provided' });
  }

  const result = await creativeTools.fixEyeContact(videoId, getUserId(req));
  res.json(result);
}));

/**
 * POST /background-swap
 * Honest not-implemented response. General background removal needs a
 * segmentation model (rembg); true green-screen is handled by the chroma-key
 * route in manual-editing.js.
 */
router.post('/background-swap', auth, express.json(), asyncHandler(async (req, res) => {
  const { videoId, bgMode, backgroundUrl, blurAmount, greenScreen, keyColor } = req.body;
  if (!videoId) {
    return res.status(400).json({ success: false, error: 'No videoId provided' });
  }

  // IDOR: the service does a bare Content.findById(videoId) → gate ownership.
  const owned = await guardOwnership(req, res, videoId);
  if (!owned) return;

  // SSRF: an external backgroundUrl is handed straight to FFmpeg as an input.
  if (backgroundUrl && /^https?:\/\//i.test(String(backgroundUrl))) {
    try {
      await assertPublicUrl(String(backgroundUrl));
    } catch (_) {
      return res.status(400).json({ success: false, error: 'Invalid or disallowed backgroundUrl' });
    }
  }

  const result = await creativeTools.swapBackground(
    videoId,
    backgroundUrl || bgMode || null,
    blurAmount,
    getUserId(req),
    { greenScreen: greenScreen === true || greenScreen === 'true', keyColor }
  );
  res.json(result);
}));

/**
 * POST /localize
 * Voice localization / dubbing. Real ElevenLabs dub when a key is configured;
 * otherwise an honest not-implemented response (visual lip-sync is roadmap).
 */
router.post('/localize', auth, express.json(), asyncHandler(async (req, res) => {
  const { videoId, targetLanguage } = req.body;
  if (!videoId) {
    return res.status(400).json({ success: false, error: 'No videoId provided' });
  }

  const owned = await guardOwnership(req, res, videoId);
  if (!owned) return;

  const result = await aiLocalizationService.localizeVideo(videoId, targetLanguage || 'Spanish');
  res.json(result);
}));

/**
 * POST /outpaint
 * Convert a horizontal video to 9:16 vertical via real FFmpeg blur-pad
 * (centered source over a zoomed, blurred fill).
 */
router.post('/outpaint', auth, express.json(), asyncHandler(async (req, res) => {
  const { videoId } = req.body;
  if (!videoId) {
    return res.status(400).json({ success: false, error: 'No videoId provided' });
  }

  const owned = await guardOwnership(req, res, videoId);
  if (!owned) return;

  const result = await aiOutpaintingService.outpaintToVertical(videoId);
  res.json(result);
}));

/**
 * POST /object-removal
 * Video object removal (inpainting) using OpenCV fallback or ProPainter deep learning.
 */
router.post('/object-removal', auth, express.json(), asyncHandler(async (req, res) => {
  const { videoId, maskPoints } = req.body;
  if (!videoId) {
    return res.status(400).json({ success: false, error: 'No videoId provided' });
  }
  if (!maskPoints || !Array.isArray(maskPoints) || maskPoints.length === 0) {
    return res.status(400).json({ success: false, error: 'No maskPoints provided' });
  }

  // IDOR guard: only allow users to edit videos they own
  const owned = await guardOwnership(req, res, videoId);
  if (!owned) return;

  const result = await creativeTools.removeObject(videoId, maskPoints, getUserId(req));
  res.json(result);
}));

/**
 * POST /fonts
 * Upload a custom font (OTF/TTF/WOFF) and serve it from /uploads/fonts.
 */
router.post('/fonts', auth, fontUpload.single('font'), asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ success: false, error: 'No font file provided' });

  // Validate ext
  const originalExt = path.extname(file.originalname).toLowerCase();
  if (!['.ttf', '.otf', '.woff', '.woff2'].includes(originalExt)) {
    fs.promises.unlink(file.path).catch(() => {});
    return res.status(400).json({ success: false, error: 'Invalid font format. Use TTF, OTF, or WOFF.' });
  }

  // Rename file to proper extension (async to avoid blocking the event loop).
  const newFileName = `${file.filename}${originalExt}`;
  const newPath = path.join(fontDir, newFileName);
  await fs.promises.rename(file.path, newPath);

  res.json({
    success: true,
    fontFamily: path.basename(file.originalname, originalExt),
    url: `/uploads/fonts/${newFileName}`,
  });
}));

module.exports = router;
