// Manual Video Editing Routes - All 8 Advanced Features
// 1. Advanced Color Grading, 2. Professional Audio Mixing, 3. Advanced Typography
// 4. Motion Graphics, 5. AI-Assisted Editing, 6. Advanced Transitions
// 7. Speed Control, 8. Professional Export

const express = require('express');
const auth = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const { guardOwnership } = require('../../utils/ownership');
const { assertPublicUrl } = require('../../utils/urlGuard');
const logger = require('../../utils/logger');
const multer = require('multer');

// Resolve a media source for the read-only waveform/filmstrip/beats tools while
// enforcing ownership on a contentId (was a bare Content.findById → leaked another
// user's video frames/audio) and SSRF-guarding an attacker-supplied external
// videoUrl before it reaches ffmpeg's `-i`. Returns the source string, or null
// after the helper has already sent the error response.
async function resolveToolSource(req, res, { contentId, videoUrl }) {
  if (videoUrl) {
    const u = String(videoUrl);
    if (/^https?:\/\//i.test(u)) {
      try {
        await assertPublicUrl(u);
      } catch (_) {
        res.status(400).json({ success: false, error: 'Invalid or disallowed videoUrl' });
        return null;
      }
    }
    return u;
  }
  if (contentId) {
    const owned = await guardOwnership(req, res, contentId);
    if (!owned) return null;
    const src = owned.originalFile?.url || null;
    if (!src) {
      res.status(404).json({ success: false, error: 'No source found for contentId' });
      return null;
    }
    return src;
  }
  res.status(400).json({ success: false, error: 'contentId or videoUrl is required' });
  return null;
}
const path = require('path');
const fs = require('fs');

// Import all services
const colorGradingService = require('../../services/advancedColorGradingService');
const audioMixingService = require('../../services/professionalAudioMixingService');
const typographyService = require('../../services/advancedTypographyService');
const motionGraphicsService = require('../../services/motionGraphicsService');
const aiAssistedService = require('../../services/aiAssistedEditingService');
const transitionsService = require('../../services/advancedTransitionsService');
const speedControlService = require('../../services/speedControlService');
const exportService = require('../../services/professionalExportService');
const editHistoryService = require('../../services/manualEditHistoryService');
const presetService = require('../../services/manualEditPresetService');
const previewService = require('../../services/manualEditPreviewService');
const batchService = require('../../services/manualEditBatchService');
const keyboardShortcutsService = require('../../services/videoEditorKeyboardShortcutsService');
const waveformService = require('../../services/audioWaveformService');
const colorScopesService = require('../../services/colorScopesService');
const templateMarketplaceService = require('../../services/templateMarketplaceService');
const keyframeService = require('../../services/keyframeAnimationService');
const multiTrackService = require('../../services/multiTrackTimelineService');
const maskingService = require('../../services/advancedMaskingService');
const trackingService = require('../../services/motionTrackingService');
const proxyService = require('../../services/proxyEditingService');
const tutorialsService = require('../../services/learningTutorialsService');
const advancedExportService = require('../../services/advancedExportOptionsService');
const videoRenderService = require('../../services/videoRenderService');
const multiCamService = require('../../services/multiCamEditingService');
const savedExportService = require('../../services/savedExportService');
const voiceCommandsService = require('../../services/voiceCommandsService');
const cloudSyncService = require('../../services/cloudSyncService');
const performanceService = require('../../services/performanceOptimizationService');
const analyticsService = require('../../services/editAnalyticsService');
const pluginService = require('../../services/pluginSystemService');

const router = express.Router();

/**
 * Parse a JSON string from the request body, surfacing malformed input as a
 * 400 (bad request) instead of a misleading 500. Throws a tagged error whose
 * `statusCode` the route's catch block honors (see `error.statusCode || 500`).
 */
function safeParse(value, fieldName) {
  try {
    return JSON.parse(value);
  } catch (e) {
    const err = new Error(`Invalid ${fieldName} JSON`);
    err.statusCode = 400;
    throw err;
  }
}

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../../uploads/manual-editing');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // SECURITY: never write the client-supplied originalname into the path — it
    // can contain `../` and escape the upload dir (path traversal). Take only the
    // basename, strip anything but safe chars, and keep just the extension.
    const ext = path.extname(path.basename(file.originalname || '')).replace(/[^.\w]/g, '').slice(0, 12);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`);
  }
});

const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 * 1024 } }); // 2GB

/**
 * Auto-cleanup middleware — installed router-wide. By the time `finish`
 * fires, multer has already populated `req.file` (it runs as per-route
 * middleware before the handler). When the response closes — success or
 * error — we delete the multer temp upload at /uploads/manual-editing so
 * the source video doesn't pile up forever. The actual processed output
 * (sibling file in the same dir) is preserved for the frontend to fetch;
 * only the raw input is removed.
 *
 * Idempotent and silent: a missing file is fine, since either the request
 * never received one or we already cleaned it.
 */
router.use((req, res, next) => {
  const cleanup = () => {
    if (req.file?.path) {
      fs.promises.unlink(req.file.path).catch(() => { /* gone or never created */ });
    }
    if (Array.isArray(req.files)) {
      for (const f of req.files) {
        if (f?.path) fs.promises.unlink(f.path).catch(() => {});
      }
    }
  };
  res.on('finish', cleanup);
  res.on('close', cleanup);
  next();
});

// ==================== 1. ADVANCED COLOR GRADING ====================

router.post('/color-grading/curves', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { curves } = req.body;
  if (!req.file) {
    return sendError(res, 'Video file is required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `color-curves-${Date.now()}.mp4`);
    await colorGradingService.applyColorCurves(req.file.path, outputPath, safeParse(curves, 'curves'));
    sendSuccess(res, 'Color curves applied', 200, { outputPath });
  } catch (error) {
    logger.error('Color curves error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/color-grading/wheels', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { colorWheels } = req.body;
  if (!req.file) {
    return sendError(res, 'Video file is required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `color-wheels-${Date.now()}.mp4`);
    await colorGradingService.applyColorWheels(req.file.path, outputPath, safeParse(colorWheels, 'colorWheels'));
    sendSuccess(res, 'Color wheels applied', 200, { outputPath });
  } catch (error) {
    logger.error('Color wheels error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/color-grading/preset', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { presetName } = req.body;
  if (!req.file || !presetName) {
    return sendError(res, 'Video file and preset name are required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `color-preset-${Date.now()}.mp4`);
    await colorGradingService.applyColorPreset(req.file.path, outputPath, presetName);
    sendSuccess(res, 'Color preset applied', 200, { outputPath, preset: presetName });
  } catch (error) {
    logger.error('Color preset error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.get('/color-grading/presets', auth, asyncHandler(async (req, res) => {
  const presets = colorGradingService.getColorGradingPresets();
  sendSuccess(res, 'Color grading presets retrieved', 200, { presets });
}));

// ==================== 2. PROFESSIONAL AUDIO MIXING ====================

router.post('/audio/mix-tracks', auth, upload.fields([{ name: 'video', maxCount: 1 }, { name: 'audio', maxCount: 10 }]), asyncHandler(async (req, res) => {
  const { audioTracks } = req.body;
  if (!req.files.video || !req.files.audio) {
    return sendError(res, 'Video and audio files are required', 400);
  }

  try {
    const tracks = safeParse(audioTracks, 'audioTracks').map((track, index) => ({
      ...track,
      filePath: req.files.audio[index]?.path
    }));

    const outputPath = path.join(path.dirname(req.files.video[0].path), `audio-mixed-${Date.now()}.mp4`);
    await audioMixingService.mixAudioTracks(req.files.video[0].path, tracks, outputPath);
    sendSuccess(res, 'Audio tracks mixed', 200, { outputPath });
  } catch (error) {
    logger.error('Audio mixing error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/audio/ducking', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { duckingOptions } = req.body;
  if (!req.file) {
    return sendError(res, 'Video file is required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `audio-ducking-${Date.now()}.mp4`);
    await audioMixingService.applyAudioDucking(req.file.path, outputPath, safeParse(duckingOptions, 'duckingOptions'));
    sendSuccess(res, 'Audio ducking applied', 200, { outputPath });
  } catch (error) {
    logger.error('Audio ducking error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/audio/eq-preset', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { preset } = req.body;
  if (!req.file || !preset) {
    return sendError(res, 'Video file and EQ preset are required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `audio-eq-${Date.now()}.mp4`);
    await audioMixingService.applyEQPreset(req.file.path, outputPath, preset);
    sendSuccess(res, 'EQ preset applied', 200, { outputPath, preset });
  } catch (error) {
    logger.error('EQ preset error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/audio/noise-reduction', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { strength = 10 } = req.body;
  if (!req.file) {
    return sendError(res, 'Video file is required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `noise-reduced-${Date.now()}.mp4`);
    await audioMixingService.applyNoiseReduction(req.file.path, outputPath, strength);
    sendSuccess(res, 'Noise reduction applied', 200, { outputPath });
  } catch (error) {
    logger.error('Noise reduction error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

// ==================== 3. ADVANCED TYPOGRAPHY ====================

router.post('/typography/animated-text', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { textOverlay } = req.body;
  if (!req.file || !textOverlay) {
    return sendError(res, 'Video file and text overlay are required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `animated-text-${Date.now()}.mp4`);
    await typographyService.applyAnimatedText(req.file.path, outputPath, safeParse(textOverlay, 'textOverlay'));
    sendSuccess(res, 'Animated text applied', 200, { outputPath });
  } catch (error) {
    logger.error('Animated text error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/typography/template', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { template } = req.body;
  if (!req.file || !template) {
    return sendError(res, 'Video file and template are required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `text-template-${Date.now()}.mp4`);
    await typographyService.applyTextTemplate(req.file.path, outputPath, safeParse(template, 'template'));
    sendSuccess(res, 'Text template applied', 200, { outputPath });
  } catch (error) {
    logger.error('Text template error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.get('/typography/templates', auth, asyncHandler(async (req, res) => {
  const templates = typographyService.getTextTemplates();
  sendSuccess(res, 'Text templates retrieved', 200, { templates });
}));

// ==================== 4. MOTION GRAPHICS ====================

router.post('/motion-graphics/shape', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { shape } = req.body;
  if (!req.file || !shape) {
    return sendError(res, 'Video file and shape are required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `shape-overlay-${Date.now()}.mp4`);
    await motionGraphicsService.addShapeOverlay(req.file.path, outputPath, safeParse(shape, 'shape'));
    sendSuccess(res, 'Shape overlay added', 200, { outputPath });
  } catch (error) {
    logger.error('Shape overlay error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/motion-graphics/chroma-key', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { chromaKeyOptions } = req.body;
  if (!req.file) {
    return sendError(res, 'Video file is required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `chroma-key-${Date.now()}.mp4`);
    await motionGraphicsService.applyChromaKey(req.file.path, outputPath, safeParse(chromaKeyOptions, 'chromaKeyOptions'));
    sendSuccess(res, 'Chroma key applied', 200, { outputPath });
  } catch (error) {
    logger.error('Chroma key error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/motion-graphics/pip', auth, upload.fields([{ name: 'video', maxCount: 1 }, { name: 'pip', maxCount: 1 }]), asyncHandler(async (req, res) => {
  const { pipOptions } = req.body;
  if (!req.files.video || !req.files.pip) {
    return sendError(res, 'Video and PIP video are required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.files.video[0].path), `pip-${Date.now()}.mp4`);
    await motionGraphicsService.addPictureInPicture(req.files.video[0].path, req.files.pip[0].path, outputPath, safeParse(pipOptions, 'pipOptions'));
    sendSuccess(res, 'Picture-in-picture added', 200, { outputPath });
  } catch (error) {
    logger.error('PIP error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/motion-graphics/stabilize', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { strength = 0.5 } = req.body;
  if (!req.file) {
    return sendError(res, 'Video file is required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `stabilized-${Date.now()}.mp4`);
    await motionGraphicsService.applyStabilization(req.file.path, outputPath, strength);
    sendSuccess(res, 'Video stabilized', 200, { outputPath });
  } catch (error) {
    logger.error('Stabilization error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

// ==================== 5. AI-ASSISTED EDITING ====================

router.post('/ai-assist/smart-cuts', auth, asyncHandler(async (req, res) => {
  const { videoId, transcript, metadata } = req.body;
  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }

  try {
    const suggestions = await aiAssistedService.getSmartCutSuggestions(videoId, transcript, metadata);
    sendSuccess(res, 'Smart cut suggestions retrieved', 200, suggestions);
  } catch (error) {
    logger.error('Smart cuts error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/ai-assist/best-moments', auth, asyncHandler(async (req, res) => {
  const { videoId, transcript, metadata } = req.body;
  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }

  try {
    const moments = await aiAssistedService.findBestMoments(videoId, transcript, metadata);
    sendSuccess(res, 'Best moments found', 200, moments);
  } catch (error) {
    logger.error('Best moments error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/ai-assist/pacing', auth, asyncHandler(async (req, res) => {
  const { videoId, transcript, metadata } = req.body;
  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }

  try {
    const analysis = await aiAssistedService.analyzePacing(videoId, transcript, metadata);
    sendSuccess(res, 'Pacing analysis complete', 200, analysis);
  } catch (error) {
    logger.error('Pacing analysis error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/ai-assist/quality-check', auth, asyncHandler(async (req, res) => {
  const { videoId, metadata, transcript } = req.body;
  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }

  try {
    const check = await aiAssistedService.qualityCheck(videoId, metadata, transcript);
    sendSuccess(res, 'Quality check complete', 200, check);
  } catch (error) {
    logger.error('Quality check error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

// ==================== 5B. AI-ASSISTED EDITING — 2026 PREMIUM ====================

router.post('/ai-assist/creative-director', auth, asyncHandler(async (req, res) => {
  const { videoId, transcript, metadata } = req.body;
  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }
  // IDOR guard: this route persists to Content by videoId — verify ownership.
  const owned = await guardOwnership(req, res, videoId);
  if (!owned) return;

  try {
    const brief = await aiAssistedService.generateCreativeDirectorBrief(videoId, transcript, metadata);

    // Persist the brief for session consistency
    const Content = require('../../models/Content');
    await Content.findByIdAndUpdate(videoId, {
      $set: { 'generatedContent.creativeBrief': brief }
    });

    sendSuccess(res, 'Creative Director brief generated', 200, brief);
  } catch (error) {
    logger.error('Creative Director error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/ai-assist/generate-captions', auth, asyncHandler(async (req, res) => {
  const { videoId, transcript, metadata, style, targetLanguage, language } = req.body;
  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }

  try {
    const result = await aiAssistedService.generateAICaptions(videoId, transcript, metadata, style, targetLanguage || language || 'English');
    sendSuccess(res, 'AI captions generated', 200, result);
  } catch (error) {
    logger.error('AI captions error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/ai-assist/suggest-grade', auth, asyncHandler(async (req, res) => {
  const { videoId, transcript, metadata } = req.body;
  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }

  try {
    const grade = await aiAssistedService.suggestColorGrade(videoId, transcript, metadata);
    sendSuccess(res, 'Color grade suggestion generated', 200, grade);
  } catch (error) {
    logger.error('Color grade suggestion error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/ai-assist/suggest-transitions', auth, asyncHandler(async (req, res) => {
  const { videoId, transcript, metadata } = req.body;
  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }

  try {
    const transitions = await aiAssistedService.suggestTransitions(videoId, transcript, metadata);
    sendSuccess(res, 'Transition suggestions generated', 200, transitions);
  } catch (error) {
    logger.error('Transition suggestions error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/ai-assist/auto-edit-sequence', auth, asyncHandler(async (req, res) => {
  const { videoId, transcript, metadata } = req.body;
  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }
  // IDOR guard: this route reads Content by videoId — verify ownership.
  const owned = await guardOwnership(req, res, videoId);
  if (!owned) return;

  try {
    // Reuse the ownership-verified content for the existing brief.
    const brief = owned?.generatedContent?.creativeBrief || null;

    const sequence = await aiAssistedService.autoEditSequence(videoId, transcript, metadata, req.user._id, brief);
    sendSuccess(res, 'Auto-edit sequence generated', 200, sequence);
  } catch (error) {
    logger.error('Auto-edit sequence error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/ai-assist/engagement-prediction', auth, asyncHandler(async (req, res) => {
  const { videoId, transcript, metadata, editState } = req.body;
  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }

  try {
    const prediction = await aiAssistedService.generateEngagementPrediction(videoId, transcript, metadata, editState);
    sendSuccess(res, 'Engagement prediction generated', 200, prediction);
  } catch (error) {
    logger.error('Engagement prediction error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

// V5 Upgrade: Viral Snapshots
router.post('/ai-assist/viral-snapshots', auth, asyncHandler(async (req, res) => {
  const { videoId, transcript, metadata } = req.body;
  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }

  try {
    const snapshots = await aiAssistedService.generateViralSnapshots(videoId, transcript, metadata);
    sendSuccess(res, 'Viral snapshots generated', 200, snapshots);
  } catch (error) {
    logger.error('Viral snapshots error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

// V5 Upgrade: Marketing Strategy
router.post('/ai-assist/marketing-strategy', auth, asyncHandler(async (req, res) => {
  const { videoId, transcript, metadata, niche } = req.body;
  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }

  try {
    const strategy = await aiAssistedService.generateMarketingStrategy(videoId, transcript, metadata, niche);
    sendSuccess(res, 'Marketing strategy generated', 200, strategy);
  } catch (error) {
    logger.error('Marketing strategy error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

// ==================== 6. ADVANCED TRANSITIONS ====================

router.post('/transitions/apply', auth, upload.fields([{ name: 'clip1', maxCount: 1 }, { name: 'clip2', maxCount: 1 }]), asyncHandler(async (req, res) => {
  const { transition } = req.body;
  if (!req.files.clip1 || !req.files.clip2) {
    return sendError(res, 'Two video clips are required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.files.clip1[0].path), `transition-${Date.now()}.mp4`);
    await transitionsService.applyTransition(req.files.clip1[0].path, req.files.clip2[0].path, outputPath, safeParse(transition, 'transition'));
    sendSuccess(res, 'Transition applied', 200, { outputPath });
  } catch (error) {
    logger.error('Transition error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.get('/transitions/available', auth, asyncHandler(async (req, res) => {
  const transitions = transitionsService.getAvailableTransitions();
  sendSuccess(res, 'Available transitions retrieved', 200, { transitions });
}));

// ==================== 7. SPEED CONTROL ====================

router.post('/speed/variable', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { speedOptions } = req.body;
  if (!req.file) {
    return sendError(res, 'Video file is required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `speed-${Date.now()}.mp4`);
    await speedControlService.applyVariableSpeed(req.file.path, outputPath, safeParse(speedOptions, 'speedOptions'));
    sendSuccess(res, 'Variable speed applied', 200, { outputPath });
  } catch (error) {
    logger.error('Variable speed error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/speed/ramp', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { rampOptions } = req.body;
  if (!req.file) {
    return sendError(res, 'Video file is required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `speed-ramp-${Date.now()}.mp4`);
    await speedControlService.applySpeedRamp(req.file.path, outputPath, safeParse(rampOptions, 'rampOptions'));
    sendSuccess(res, 'Speed ramp applied', 200, { outputPath });
  } catch (error) {
    logger.error('Speed ramp error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/speed/reverse', auth, upload.single('video'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return sendError(res, 'Video file is required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `reversed-${Date.now()}.mp4`);
    await speedControlService.reverseVideo(req.file.path, outputPath);
    sendSuccess(res, 'Video reversed', 200, { outputPath });
  } catch (error) {
    logger.error('Reverse video error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/speed/freeze', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { freezeOptions } = req.body;
  if (!req.file) {
    return sendError(res, 'Video file is required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `freeze-${Date.now()}.mp4`);
    await speedControlService.freezeFrame(req.file.path, outputPath, safeParse(freezeOptions, 'freezeOptions'));
    sendSuccess(res, 'Freeze frame applied', 200, { outputPath });
  } catch (error) {
    logger.error('Freeze frame error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.get('/speed/presets', auth, asyncHandler(async (req, res) => {
  const presets = speedControlService.getSpeedPresets();
  sendSuccess(res, 'Speed presets retrieved', 200, { presets });
}));

// ==================== 8. PROFESSIONAL EXPORT ====================

router.post('/export/preset', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { platform, options } = req.body;
  if (!req.file || !platform) {
    return sendError(res, 'Video file and platform are required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `export-${platform}-${Date.now()}.mp4`);
    await exportService.exportWithPreset(req.file.path, outputPath, platform, safeParse(options || '{}', 'options'));
    sendSuccess(res, 'Export completed', 200, { outputPath, platform });
  } catch (error) {
    logger.error('Export error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/export/custom', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { settings } = req.body;
  if (!req.file || !settings) {
    return sendError(res, 'Video file and settings are required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `export-custom-${Date.now()}.mp4`);
    await exportService.exportCustom(req.file.path, outputPath, safeParse(settings, 'settings'));
    sendSuccess(res, 'Custom export completed', 200, { outputPath });
  } catch (error) {
    logger.error('Custom export error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/export/batch', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { exports } = req.body;
  if (!req.file || !exports) {
    return sendError(res, 'Video file and export configs are required', 400);
  }

  try {
    const results = await exportService.batchExport(req.file.path, safeParse(exports, 'exports'));
    sendSuccess(res, 'Batch export completed', 200, { results });
  } catch (error) {
    logger.error('Batch export error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.get('/export/presets', auth, asyncHandler(async (req, res) => {
  const presets = exportService.getPlatformPresets();
  sendSuccess(res, 'Export presets retrieved', 200, { presets });
}));

/**
 * POST /api/video/manual-editing/render
 * Render video from editor state (filters, text overlays, shapes, export options)
 */
router.post('/render', auth, asyncHandler(async (req, res) => {
  const {
    videoId, videoUrl, videoFilters, textOverlays, shapeOverlays, exportOptions, timelineSegments,
    imageOverlays, svgOverlays, gradientOverlays, videoTransform, videoTransformKeyframes, videoCrop,
    chromaKey, playbackSpeed, timelineEffects, audio, colorGrade,
  } = req.body;

  if (!videoId && !videoUrl) {
    return sendError(res, 'videoId or videoUrl is required', 400);
  }

  // A videoId must belong to the caller — resolveInputPath does a bare
  // Content.findById, so without this any user could render another user's source
  // video. (A remote videoUrl is SSRF-checked inside videoRenderService.)
  if (videoId) {
    const owned = await guardOwnership(req, res, videoId);
    if (!owned) return;
  }

  // ── Multi-clip TIMELINE STITCHING pre-pass ──
  // When the timeline has multiple primary-video segments (or any segment with
  // reverse / per-segment speed / a transition / a source-trim window), stitch
  // them into ONE intermediate MP4 first, then run the normal render on top of
  // it (so overlays/filters/global-speed/chroma still apply). On any stitch
  // failure we fall back to the original source — export must never hard-fail.
  // The intermediate is cleaned up after the render completes.
  const segsForStitch = Array.isArray(timelineSegments) ? timelineSegments : [];
  let stitchedPath = null;
  let effectiveVideoUrl = videoUrl || null;
  let effectiveVideoId = videoId || null;
  if (videoRenderService.needsStitch && videoRenderService.needsStitch(segsForStitch)) {
    try {
      const ex = exportOptions || {};
      const inputForStitch = await videoRenderService.resolveInputPath(videoId || null, videoUrl || null);
      stitchedPath = await videoRenderService.stitchSegments(
        inputForStitch,
        segsForStitch,
        { width: ex.width ?? 1920, height: ex.height ?? 1080, fps: ex.fps ?? 30 }
      );
      if (stitchedPath) {
        effectiveVideoUrl = stitchedPath;
        effectiveVideoId = null;
        logger.info('Timeline stitch pre-pass complete', { stitchedPath, segments: segsForStitch.length });
      }
    } catch (stitchErr) {
      logger.warn('Timeline stitch failed; falling back to original source', { error: stitchErr.message });
      stitchedPath = null;
      effectiveVideoUrl = videoUrl || null;
      effectiveVideoId = videoId || null;
    }
  }

  try {
    const result = await videoRenderService.renderFromEditorState({
      videoId: effectiveVideoId,
      videoUrl: effectiveVideoUrl,
      videoFilters: videoFilters || {},
      colorGrade: (typeof colorGrade === 'string' && colorGrade.trim()) ? colorGrade.trim() : null,
      audio: (audio && typeof audio === 'object') ? audio : null,
      textOverlays: Array.isArray(textOverlays) ? textOverlays : [],
      shapeOverlays: Array.isArray(shapeOverlays) ? shapeOverlays : [],
      // Full editor→export parity: forward every overlay/transform type so no
      // edit silently disappears in the exported video.
      imageOverlays: Array.isArray(imageOverlays) ? imageOverlays : [],
      svgOverlays: Array.isArray(svgOverlays) ? svgOverlays : [],
      gradientOverlays: Array.isArray(gradientOverlays) ? gradientOverlays : [],
      videoTransform: videoTransform || {},
      videoTransformKeyframes: Array.isArray(videoTransformKeyframes) ? videoTransformKeyframes : [],
      videoCrop: videoCrop || null,
      // Chroma key + playback speed (whole-clip) parity.
      chromaKey: chromaKey || null,
      exportOptions: { ...(exportOptions || {}), playbackSpeed: playbackSpeed ?? (exportOptions && exportOptions.playbackSpeed) ?? 1 },
      timelineSegments: Array.isArray(timelineSegments) ? timelineSegments : [],
      timelineEffects: Array.isArray(timelineEffects) ? timelineEffects : [],
      userId: req.user?._id || req.user?.id || null,
    });

    // Clean up the stitched intermediate now that the final render is done.
    if (stitchedPath) {
      fs.promises.unlink(stitchedPath).catch(() => { /* already gone */ });
    }

    // result.url may be a durable absolute URL (cloud storage) or a relative
    // "/uploads/..." path (local disk). Only prefix the host for relative paths;
    // an absolute http(s) URL is already directly downloadable.
    const isAbsoluteUrl = typeof result.url === 'string' && /^https?:\/\//i.test(result.url);
    const downloadUrl = result.url
      ? (isAbsoluteUrl ? result.url : `${req.protocol}://${req.get('host')}${result.url}`)
      : null;

    sendSuccess(res, 'Render completed', 200, {
      outputPath: result.outputPath,
      url: result.url,
      downloadUrl,
    });
  } catch (error) {
    if (stitchedPath) {
      fs.promises.unlink(stitchedPath).catch(() => { /* already gone */ });
    }
    logger.error('Render error', { error: error.message, videoId });
    sendError(res, error.message || 'Render failed', 500);
  }
}));

// ==================== SAVED EXPORTS (folder, 10-day default expiry, extend) ====================

router.post('/saved-exports', auth, asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const { videoId: contentId, exportPath, title, quality, expiresInDays } = req.body;

  if (!contentId || !exportPath) {
    return sendError(res, 'videoId and exportPath (from last render URL) are required', 400);
  }

  try {
    const saved = await savedExportService.saveExport({
      userId,
      contentId,
      exportPathOrUrl: exportPath,
      title,
      quality: quality || '1080p',
      expiresInDays: expiresInDays ?? savedExportService.DEFAULT_EXPIRES_DAYS,
      workspaceId: req.user?.workspaceId,
    });
    sendSuccess(res, 'Export saved to folder (default 10 days; you can extend)', 200, saved);
  } catch (error) {
    logger.error('Save export error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.get('/saved-exports', auth, asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const { contentId } = req.query;
  const baseUrl = req.protocol && req.get('host') ? `${req.protocol}://${req.get('host')}` : '';

  try {
    const list = await savedExportService.listSavedExports(userId, contentId || null, baseUrl);
    sendSuccess(res, 'Saved exports retrieved', 200, { list });
  } catch (error) {
    logger.error('List saved exports error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.patch('/saved-exports/:id/extend', auth, asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const { id } = req.params;
  const { extendByDays } = req.body;

  try {
    const updated = await savedExportService.extendExpiration(id, userId, extendByDays ?? 10);
    sendSuccess(res, 'Expiration extended', 200, updated);
  } catch (error) {
    logger.error('Extend export error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

// ==================== ENHANCED FEATURES ====================

// Edit History (Undo/Redo)
router.post('/history/save', auth, asyncHandler(async (req, res) => {
  const { videoId, editState } = req.body;
  if (!videoId || !editState) {
    return sendError(res, 'Video ID and edit state are required', 400);
  }

  const owned = await guardOwnership(req, res, videoId);
  if (!owned) return;

  try {
    const result = await editHistoryService.saveEditState(videoId, editState);
    sendSuccess(res, 'Edit state saved', 200, result);
  } catch (error) {
    logger.error('Save edit state error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/history/undo', auth, asyncHandler(async (req, res) => {
  const { videoId } = req.body;
  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }

  const owned = await guardOwnership(req, res, videoId);
  if (!owned) return;

  try {
    const result = await editHistoryService.undoEdit(videoId);
    sendSuccess(res, 'Edit undone', 200, result);
  } catch (error) {
    logger.error('Undo edit error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/history/redo', auth, asyncHandler(async (req, res) => {
  const { videoId } = req.body;
  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }

  const owned = await guardOwnership(req, res, videoId);
  if (!owned) return;

  try {
    const result = await editHistoryService.redoEdit(videoId);
    sendSuccess(res, 'Edit redone', 200, result);
  } catch (error) {
    logger.error('Redo edit error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.get('/history/:videoId', auth, asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  const owned = await guardOwnership(req, res, videoId);
  if (!owned) return;

  try {
    const history = await editHistoryService.getEditHistory(videoId);
    sendSuccess(res, 'Edit history retrieved', 200, history);
  } catch (error) {
    logger.error('Get edit history error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

// Preset Management
router.post('/presets/save', auth, asyncHandler(async (req, res) => {
  const { presetData } = req.body;
  const userId = req.user?.id || req.user?._id;

  if (!presetData) {
    return sendError(res, 'Preset data is required', 400);
  }

  try {
    const result = await presetService.savePreset(userId, presetData);
    sendSuccess(res, 'Preset saved', 200, result);
  } catch (error) {
    logger.error('Save preset error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.get('/presets', auth, asyncHandler(async (req, res) => {
  const { category } = req.query;
  const userId = req.user?.id || req.user?._id;

  try {
    const result = await presetService.getUserPresets(userId, category || null);
    sendSuccess(res, 'Presets retrieved', 200, result);
  } catch (error) {
    logger.error('Get presets error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.get('/presets/community', auth, asyncHandler(async (req, res) => {
  const { category, limit } = req.query;

  try {
    const result = await presetService.getCommunityPresets(category || null, parseInt(limit, 10) || 20);
    sendSuccess(res, 'Community presets retrieved', 200, result);
  } catch (error) {
    logger.error('Get community presets error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.get('/presets/:presetId', auth, asyncHandler(async (req, res) => {
  const { presetId } = req.params;
  const userId = req.user?.id || req.user?._id;

  try {
    const result = await presetService.getPreset(userId, presetId);
    sendSuccess(res, 'Preset retrieved', 200, result);
  } catch (error) {
    logger.error('Get preset error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.delete('/presets/:presetId', auth, asyncHandler(async (req, res) => {
  const { presetId } = req.params;
  const userId = req.user?.id || req.user?._id;

  try {
    await presetService.deletePreset(userId, presetId);
    sendSuccess(res, 'Preset deleted', 200);
  } catch (error) {
    logger.error('Delete preset error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

// Preview Generation
router.post('/preview/frame', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { time = 5 } = req.body;
  if (!req.file) {
    return sendError(res, 'Video file is required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `preview-${Date.now()}.jpg`);
    await previewService.generatePreviewFrame(req.file.path, parseFloat(time), outputPath);
    sendSuccess(res, 'Preview frame generated', 200, { outputPath });
  } catch (error) {
    logger.error('Preview frame error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/preview/comparison', auth, upload.fields([{ name: 'original', maxCount: 1 }, { name: 'edited', maxCount: 1 }]), asyncHandler(async (req, res) => {
  const { frameTime = 5 } = req.body;
  if (!req.files.original || !req.files.edited) {
    return sendError(res, 'Original and edited videos are required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.files.original[0].path), `comparison-${Date.now()}.jpg`);
    await previewService.generateBeforeAfterComparison(
      req.files.original[0].path,
      req.files.edited[0].path,
      outputPath,
      { frameTime: parseFloat(frameTime) }
    );
    sendSuccess(res, 'Comparison generated', 200, { outputPath });
  } catch (error) {
    logger.error('Comparison error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

// Batch Operations
router.post('/batch/apply', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { operations } = req.body;
  if (!req.file || !operations) {
    return sendError(res, 'Video file and operations are required', 400);
  }

  try {
    // Validate operations
    const validation = batchService.validateBatchOperations(safeParse(operations, 'operations'));
    if (!validation.valid) {
      return sendError(res, `Invalid operations: ${validation.errors.join(', ')}`, 400);
    }

    const outputPath = path.join(path.dirname(req.file.path), `batch-${Date.now()}.mp4`);
    const result = await batchService.applyBatchOperationsSequential(
      req.file.path,
      safeParse(operations, 'operations'),
      outputPath
    );
    sendSuccess(res, 'Batch operations completed', 200, result);
  } catch (error) {
    logger.error('Batch operations error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

// ==================== KEYBOARD SHORTCUTS ====================

router.get('/shortcuts', auth, asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;

  try {
    const shortcuts = await keyboardShortcutsService.getVideoEditorShortcuts(userId);
    sendSuccess(res, 'Shortcuts retrieved', 200, shortcuts);
  } catch (error) {
    logger.error('Get shortcuts error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/shortcuts/save', auth, asyncHandler(async (req, res) => {
  const { shortcut } = req.body;
  const userId = req.user?.id || req.user?._id;

  try {
    await keyboardShortcutsService.saveCustomShortcut(userId, shortcut);
    sendSuccess(res, 'Shortcut saved', 200);
  } catch (error) {
    logger.error('Save shortcut error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.get('/shortcuts/presets', auth, asyncHandler(async (req, res) => {
  const presets = keyboardShortcutsService.getShortcutPresets();
  sendSuccess(res, 'Shortcut presets retrieved', 200, { presets });
}));

router.post('/shortcuts/preset', auth, asyncHandler(async (req, res) => {
  const { presetName } = req.body;
  const userId = req.user?.id || req.user?._id;

  try {
    await keyboardShortcutsService.applyShortcutPreset(userId, presetName);
    sendSuccess(res, 'Preset applied', 200, { preset: presetName });
  } catch (error) {
    logger.error('Apply preset error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

// ==================== AUDIO WAVEFORM ====================

router.post('/waveform/generate', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { width = 800, height = 200 } = req.body;
  if (!req.file) {
    return sendError(res, 'Video file is required', 400);
  }

  try {
    const waveformData = await waveformService.generateWaveformData(req.file.path, { width, height });
    sendSuccess(res, 'Waveform data generated', 200, waveformData);
  } catch (error) {
    logger.error('Waveform generation error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/waveform/image', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { width = 800, height = 200, color = '#000000' } = req.body;
  if (!req.file) {
    return sendError(res, 'Video file is required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `waveform-${Date.now()}.png`);
    await waveformService.generateWaveformImage(req.file.path, outputPath, { width, height, color });
    sendSuccess(res, 'Waveform image generated', 200, { outputPath });
  } catch (error) {
    logger.error('Waveform image error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

/**
 * GET /api/video/manual-editing/waveform-peaks
 * Return REAL decoded audio peaks for the timeline waveform — no fabricated
 * data. The client passes the source it already has (videoUrl) or a contentId;
 * we decode the audio with ffmpeg and downsample to `buckets` normalized peaks.
 *
 * Query: contentId? , videoUrl? , buckets? (default 400)
 * Response data: { peaks: number[], duration, sampleRate, hasAudio }
 *   - hasAudio:false (with peaks:[]) when the source has no audio stream.
 */
router.get('/waveform-peaks', auth, asyncHandler(async (req, res) => {
  const { contentId, videoUrl, buckets } = req.query;

  const source = await resolveToolSource(req, res, { contentId, videoUrl });
  if (source === null) return;

  try {
    const result = await waveformService.extractWaveformPeaks(source, {
      buckets: parseInt(buckets, 10) || 400,
    });

    sendSuccess(res, 'Waveform peaks generated', 200, result);
  } catch (error) {
    logger.error('Waveform peaks error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

/**
 * GET /api/video/manual-editing/filmstrip
 * Return REAL clip thumbnails (a filmstrip) for a video/image source — no
 * fabricated data. Mirrors /waveform-peaks: the client passes the source it
 * already has (videoUrl) or a contentId; we grab `count` frames evenly across
 * the duration with ffmpeg and return them as small JPEG data-URLs.
 *
 * Query: contentId? , videoUrl? , count? (default 8, max 24)
 * Response data: { frames: string[], duration, count }
 *   - frames is an array of `data:image/jpeg;base64,...` strings.
 */
router.get('/filmstrip', auth, asyncHandler(async (req, res) => {
  const { contentId, videoUrl, count } = req.query;

  const source = await resolveToolSource(req, res, { contentId, videoUrl });
  if (source === null) return;

  try {
    const result = await waveformService.extractFilmstrip(source, {
      count: parseInt(count, 10) || 8,
    });

    sendSuccess(res, 'Filmstrip generated', 200, result);
  } catch (error) {
    logger.error('Filmstrip error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

/**
 * GET /api/video/manual-editing/beats
 * Return REAL detected onsets/beats (seconds) for the timeline beat-sync tool
 * — no fabricated data. Mirrors /waveform-peaks: the client passes the source
 * it already has (videoUrl) or a contentId; we decode the audio with ffmpeg
 * and detect energy-flux onsets above an adaptive threshold.
 *
 * Query: contentId? , videoUrl?
 * Response data: { beats: number[], duration, hasAudio }
 *   - hasAudio:false (with beats:[]) when the source has no audio stream.
 */
router.get('/beats', auth, asyncHandler(async (req, res) => {
  const { contentId, videoUrl } = req.query;

  const source = await resolveToolSource(req, res, { contentId, videoUrl });
  if (source === null) return;

  try {
    const result = await waveformService.detectOnsets(source);
    sendSuccess(res, 'Beats detected', 200, result);
  } catch (error) {
    logger.error('Beat detection error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/waveform/beats', auth, upload.single('video'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return sendError(res, 'Video file is required', 400);
  }

  try {
    const beats = await waveformService.detectBeats(req.file.path);
    sendSuccess(res, 'Beats detected', 200, { beats });
  } catch (error) {
    logger.error('Beat detection error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

// ==================== COLOR SCOPES ====================

router.post('/scopes/all', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { frameTime = 0 } = req.body;
  if (!req.file) {
    return sendError(res, 'Video file is required', 400);
  }

  try {
    const scopes = await colorScopesService.getAllScopes(req.file.path, parseFloat(frameTime));
    sendSuccess(res, 'All scopes generated', 200, scopes);
  } catch (error) {
    logger.error('Scopes generation error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/scopes/waveform', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { frameTime = 0 } = req.body;
  if (!req.file) {
    return sendError(res, 'Video file is required', 400);
  }

  try {
    const waveform = await colorScopesService.generateWaveformMonitor(req.file.path, parseFloat(frameTime));
    sendSuccess(res, 'Waveform monitor generated', 200, waveform);
  } catch (error) {
    logger.error('Waveform monitor error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/scopes/vectorscope', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { frameTime = 0 } = req.body;
  if (!req.file) {
    return sendError(res, 'Video file is required', 400);
  }

  try {
    const vectorscope = await colorScopesService.generateVectorscope(req.file.path, parseFloat(frameTime));
    sendSuccess(res, 'Vectorscope generated', 200, vectorscope);
  } catch (error) {
    logger.error('Vectorscope error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/scopes/histogram', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { frameTime = 0 } = req.body;
  if (!req.file) {
    return sendError(res, 'Video file is required', 400);
  }

  try {
    const histogram = await colorScopesService.generateHistogram(req.file.path, parseFloat(frameTime));
    sendSuccess(res, 'Histogram generated', 200, histogram);
  } catch (error) {
    logger.error('Histogram error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

// ==================== TEMPLATE MARKETPLACE ====================

router.get('/marketplace/browse', auth, asyncHandler(async (req, res) => {
  const { category, type, search, sortBy, limit, skip } = req.query;

  try {
    const result = await templateMarketplaceService.browseTemplates({
      category,
      type,
      search,
      sortBy,
      limit: parseInt(limit, 10) || 20,
      skip: parseInt(skip, 10) || 0
    });
    sendSuccess(res, 'Templates retrieved', 200, result);
  } catch (error) {
    logger.error('Browse templates error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.get('/marketplace/featured', auth, asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;

  try {
    const templates = await templateMarketplaceService.getFeaturedTemplates(parseInt(limit, 10));
    sendSuccess(res, 'Featured templates retrieved', 200, { templates });
  } catch (error) {
    logger.error('Get featured templates error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.get('/marketplace/categories', auth, asyncHandler(async (req, res) => {
  const categories = templateMarketplaceService.getTemplateCategories();
  sendSuccess(res, 'Categories retrieved', 200, { categories });
}));

router.get('/marketplace/:templateId', auth, asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const userId = req.user?.id || req.user?._id;

  try {
    const template = await templateMarketplaceService.getTemplateDetails(templateId, userId);
    sendSuccess(res, 'Template details retrieved', 200, { template });
  } catch (error) {
    logger.error('Get template details error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/marketplace/create', auth, asyncHandler(async (req, res) => {
  const { templateData } = req.body;
  const userId = req.user?.id || req.user?._id;

  try {
    const template = await templateMarketplaceService.createTemplate(userId, templateData);
    sendSuccess(res, 'Template created', 200, { template });
  } catch (error) {
    logger.error('Create template error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/marketplace/:templateId/download', auth, asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const userId = req.user?.id || req.user?._id;

  try {
    const result = await templateMarketplaceService.downloadTemplate(templateId, userId);
    sendSuccess(res, 'Template downloaded', 200, result);
  } catch (error) {
    logger.error('Download template error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/marketplace/:templateId/rate', auth, asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const { rating, comment } = req.body;
  const userId = req.user?.id || req.user?._id;

  try {
    const result = await templateMarketplaceService.rateTemplate(templateId, userId, rating, comment);
    sendSuccess(res, 'Template rated', 200, result);
  } catch (error) {
    logger.error('Rate template error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

// ==================== KEYFRAME ANIMATION ====================

router.post('/keyframes/save', auth, asyncHandler(async (req, res) => {
  const { videoId, animationData } = req.body;
  if (!videoId || !animationData) {
    return sendError(res, 'Video ID and animation data are required', 400);
  }

  const owned = await guardOwnership(req, res, videoId);
  if (!owned) return;

  try {
    const result = await keyframeService.saveKeyframeAnimation(videoId, animationData);
    sendSuccess(res, 'Keyframe animation saved', 200, result);
  } catch (error) {
    logger.error('Save keyframe animation error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/keyframes/apply', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { keyframes, property } = req.body;
  if (!req.file || !keyframes || !property) {
    return sendError(res, 'Video file, keyframes, and property are required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `keyframe-${Date.now()}.mp4`);
    await keyframeService.applyKeyframeAnimation(req.file.path, outputPath, safeParse(keyframes, 'keyframes'), property);
    sendSuccess(res, 'Keyframe animation applied', 200, { outputPath });
  } catch (error) {
    logger.error('Apply keyframe animation error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.get('/keyframes/presets', auth, asyncHandler(async (req, res) => {
  const presets = keyframeService.getAnimationPresets();
  sendSuccess(res, 'Animation presets retrieved', 200, { presets });
}));

// ==================== MULTI-TRACK TIMELINE ====================

router.get('/timeline/:videoId', auth, asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  const owned = await guardOwnership(req, res, videoId);
  if (!owned) return;

  try {
    const timeline = await multiTrackService.getTimelineConfig(videoId);
    sendSuccess(res, 'Timeline config retrieved', 200, timeline);
  } catch (error) {
    logger.error('Get timeline config error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/timeline/:videoId/track', auth, asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { trackData } = req.body;

  const owned = await guardOwnership(req, res, videoId);
  if (!owned) return;

  try {
    const result = await multiTrackService.addTrack(videoId, trackData);
    sendSuccess(res, 'Track added', 200, result);
  } catch (error) {
    logger.error('Add track error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.delete('/timeline/:videoId/track/:trackId', auth, asyncHandler(async (req, res) => {
  const { videoId, trackId } = req.params;

  const owned = await guardOwnership(req, res, videoId);
  if (!owned) return;

  try {
    await multiTrackService.removeTrack(videoId, trackId);
    sendSuccess(res, 'Track removed', 200);
  } catch (error) {
    logger.error('Remove track error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/timeline/:videoId/track/:trackId/clip', auth, asyncHandler(async (req, res) => {
  const { videoId, trackId } = req.params;
  const { clipData } = req.body;

  const owned = await guardOwnership(req, res, videoId);
  if (!owned) return;

  try {
    const result = await multiTrackService.addClipToTrack(videoId, trackId, clipData);
    sendSuccess(res, 'Clip added to track', 200, result);
  } catch (error) {
    logger.error('Add clip to track error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

// ==================== ADVANCED MASKING ====================

router.post('/masking/bezier', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { maskData } = req.body;
  if (!req.file || !maskData) {
    return sendError(res, 'Video file and mask data are required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `masked-${Date.now()}.mp4`);
    await maskingService.applyBezierMask(req.file.path, outputPath, safeParse(maskData, 'maskData'));
    sendSuccess(res, 'Bezier mask applied', 200, { outputPath });
  } catch (error) {
    logger.error('Bezier mask error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/masking/track', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { trackingData } = req.body;
  if (!req.file || !trackingData) {
    return sendError(res, 'Video file and tracking data are required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `tracked-mask-${Date.now()}.mp4`);
    await maskingService.trackMask(req.file.path, outputPath, safeParse(trackingData, 'trackingData'));
    sendSuccess(res, 'Mask tracking completed', 200, { outputPath });
  } catch (error) {
    logger.error('Mask tracking error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/masking/chroma-refine', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { chromaKeyOptions } = req.body;
  if (!req.file) {
    return sendError(res, 'Video file is required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `chroma-refined-${Date.now()}.mp4`);
    await maskingService.refineChromaKey(req.file.path, outputPath, safeParse(chromaKeyOptions, 'chromaKeyOptions'));
    sendSuccess(res, 'Chroma key refined', 200, { outputPath });
  } catch (error) {
    logger.error('Chroma key refine error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

// ==================== MOTION TRACKING ====================

router.post('/tracking/point', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { trackingData } = req.body;
  if (!req.file || !trackingData) {
    return sendError(res, 'Video file and tracking data are required', 400);
  }

  try {
    const tracking = await trackingService.trackPoint(req.file.path, safeParse(trackingData, 'trackingData'));
    sendSuccess(res, 'Point tracking completed', 200, tracking);
  } catch (error) {
    logger.error('Point tracking error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/tracking/face', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { trackingData } = req.body;
  if (!req.file) {
    return sendError(res, 'Video file is required', 400);
  }

  try {
    const tracking = await trackingService.trackFace(req.file.path, safeParse(trackingData || '{}', 'trackingData'));
    sendSuccess(res, 'Face tracking completed', 200, tracking);
  } catch (error) {
    logger.error('Face tracking error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/tracking/object', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { trackingData } = req.body;
  if (!req.file || !trackingData) {
    return sendError(res, 'Video file and tracking data are required', 400);
  }

  try {
    const tracking = await trackingService.trackObject(req.file.path, safeParse(trackingData, 'trackingData'));
    sendSuccess(res, 'Object tracking completed', 200, tracking);
  } catch (error) {
    logger.error('Object tracking error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

// ==================== PROXY EDITING ====================

router.post('/proxy/generate', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { quality = 'medium' } = req.body;
  if (!req.file) {
    return sendError(res, 'Video file is required', 400);
  }

  try {
    const proxyPath = proxyService.getProxyPath(req.file.path, quality);
    await proxyService.generateProxy(req.file.path, proxyPath, quality);
    sendSuccess(res, 'Proxy generated', 200, { proxyPath, quality });
  } catch (error) {
    logger.error('Proxy generation error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.get('/proxy/check', auth, asyncHandler(async (req, res) => {
  const { videoPath, quality = 'medium' } = req.query;
  if (!videoPath) {
    return sendError(res, 'Video path is required', 400);
  }

  try {
    const exists = await proxyService.proxyExists(videoPath, quality);
    sendSuccess(res, 'Proxy check completed', 200, { exists, quality });
  } catch (error) {
    logger.error('Proxy check error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

// ==================== LEARNING & TUTORIALS ====================

router.get('/tutorials/:feature', auth, asyncHandler(async (req, res) => {
  const { feature } = req.params;
  const userId = req.user?.id || req.user?._id;

  try {
    const tutorials = await tutorialsService.getTutorials(feature, userId);
    sendSuccess(res, 'Tutorials retrieved', 200, { tutorials });
  } catch (error) {
    logger.error('Get tutorials error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.get('/tutorials/:feature/tooltips', auth, asyncHandler(async (req, res) => {
  const { feature } = req.params;

  try {
    const tooltips = tutorialsService.getTooltips(feature);
    sendSuccess(res, 'Tooltips retrieved', 200, { tooltips });
  } catch (error) {
    logger.error('Get tooltips error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/tutorials/complete', auth, asyncHandler(async (req, res) => {
  const { tutorialId } = req.body;
  const userId = req.user?.id || req.user?._id;

  try {
    await tutorialsService.completeTutorial(userId, tutorialId);
    sendSuccess(res, 'Tutorial completed', 200);
  } catch (error) {
    logger.error('Complete tutorial error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.get('/tutorials/progress', auth, asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;

  try {
    const progress = await tutorialsService.getUserProgress(userId);
    sendSuccess(res, 'Progress retrieved', 200, progress);
  } catch (error) {
    logger.error('Get progress error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.get('/tutorials/tips/:feature?', auth, asyncHandler(async (req, res) => {
  const { feature } = req.params;

  try {
    const tips = tutorialsService.getTipsAndTricks(feature || null);
    sendSuccess(res, 'Tips retrieved', 200, { tips });
  } catch (error) {
    logger.error('Get tips error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

// ==================== ADVANCED EXPORT ====================

router.post('/export/hdr', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { hdrOptions } = req.body;
  if (!req.file) {
    return sendError(res, 'Video file is required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `hdr-${Date.now()}.mp4`);
    await advancedExportService.exportHDR(req.file.path, outputPath, safeParse(hdrOptions || '{}', 'hdrOptions'));
    sendSuccess(res, 'HDR export completed', 200, { outputPath });
  } catch (error) {
    logger.error('HDR export error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/export/codec', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { codecOptions } = req.body;
  if (!req.file || !codecOptions) {
    return sendError(res, 'Video file and codec options are required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `export-codec-${Date.now()}.mp4`);
    await advancedExportService.exportWithCodec(req.file.path, outputPath, safeParse(codecOptions, 'codecOptions'));
    sendSuccess(res, 'Export with codec completed', 200, { outputPath });
  } catch (error) {
    logger.error('Codec export error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/export/color-space', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { colorSpaceOptions } = req.body;
  if (!req.file || !colorSpaceOptions) {
    return sendError(res, 'Video file and color space options are required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `export-colorspace-${Date.now()}.mp4`);
    await advancedExportService.exportWithColorSpace(req.file.path, outputPath, safeParse(colorSpaceOptions, 'colorSpaceOptions'));
    sendSuccess(res, 'Export with color space completed', 200, { outputPath });
  } catch (error) {
    logger.error('Color space export error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.get('/export/formats', auth, asyncHandler(async (req, res) => {
  const formats = advancedExportService.getAvailableExportFormats();
  sendSuccess(res, 'Export formats retrieved', 200, { formats });
}));

// ==================== MULTI-CAM EDITING ====================

router.post('/multicam/sync', auth, upload.array('cameras', 10), asyncHandler(async (req, res) => {
  if (!req.files || req.files.length < 2) {
    return sendError(res, 'At least 2 camera files are required', 400);
  }

  try {
    const cameraPaths = req.files.map(f => f.path);
    const syncData = await multiCamService.syncCamerasByAudio(cameraPaths);
    sendSuccess(res, 'Cameras synced', 200, syncData);
  } catch (error) {
    logger.error('Multi-cam sync error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/multicam/create', auth, upload.array('cameras', 10), asyncHandler(async (req, res) => {
  const { sequence } = req.body;
  if (!req.files || req.files.length < 2 || !sequence) {
    return sendError(res, 'Camera files and sequence are required', 400);
  }

  try {
    const cameraPaths = req.files.map(f => f.path);
    const outputPath = path.join(path.dirname(cameraPaths[0]), `multicam-${Date.now()}.mp4`);
    await multiCamService.createMultiCamSequence(cameraPaths, outputPath, safeParse(sequence, 'sequence'));
    sendSuccess(res, 'Multi-cam sequence created', 200, { outputPath });
  } catch (error) {
    logger.error('Multi-cam create error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

// ==================== VOICE COMMANDS ====================

router.post('/voice/command', auth, asyncHandler(async (req, res) => {
  const { command, context } = req.body;
  if (!command) {
    return sendError(res, 'Command is required', 400);
  }

  try {
    const result = await voiceCommandsService.processVoiceCommand(command, context || {});
    sendSuccess(res, 'Voice command processed', 200, result);
  } catch (error) {
    logger.error('Voice command error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.get('/voice/commands', auth, asyncHandler(async (req, res) => {
  const commands = voiceCommandsService.getAvailableCommands();
  sendSuccess(res, 'Available commands retrieved', 200, { commands });
}));

// ==================== CLOUD SYNC ====================

router.post('/cloud/save', auth, asyncHandler(async (req, res) => {
  const { videoId, projectData } = req.body;
  if (!videoId || !projectData) {
    return sendError(res, 'Video ID and project data are required', 400);
  }

  const owned = await guardOwnership(req, res, videoId);
  if (!owned) return;

  try {
    const result = await cloudSyncService.saveProjectToCloud(videoId, projectData);
    sendSuccess(res, 'Project saved to cloud', 200, result);
  } catch (error) {
    logger.error('Cloud save error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.get('/cloud/:videoId', auth, asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { version } = req.query;

  const owned = await guardOwnership(req, res, videoId);
  if (!owned) return;

  try {
    const project = await cloudSyncService.getProjectFromCloud(videoId, version ? parseInt(version, 10) : null);
    sendSuccess(res, 'Project retrieved from cloud', 200, project);
  } catch (error) {
    logger.error('Cloud get error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.get('/cloud/:videoId/history', auth, asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  const owned = await guardOwnership(req, res, videoId);
  if (!owned) return;

  try {
    const history = await cloudSyncService.getVersionHistory(videoId);
    sendSuccess(res, 'Version history retrieved', 200, history);
  } catch (error) {
    logger.error('Version history error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/cloud/:videoId/restore', auth, asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { version } = req.body;

  const owned = await guardOwnership(req, res, videoId);
  if (!owned) return;

  try {
    const result = await cloudSyncService.restoreProjectVersion(videoId, version);
    sendSuccess(res, 'Version restored', 200, result);
  } catch (error) {
    logger.error('Restore version error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

// ==================== PERFORMANCE ====================

router.get('/performance/capabilities', auth, asyncHandler(async (req, res) => {
  const capabilities = performanceService.getSystemCapabilities();
  sendSuccess(res, 'System capabilities retrieved', 200, capabilities);
}));

router.get('/performance/settings', auth, asyncHandler(async (req, res) => {
  const settings = performanceService.getOptimalSettings();
  sendSuccess(res, 'Optimal settings retrieved', 200, settings);
}));

router.get('/performance/queue', auth, asyncHandler(async (req, res) => {
  const status = performanceService.renderQueue.getStatus();
  sendSuccess(res, 'Render queue status retrieved', 200, status);
}));

// ==================== ANALYTICS ====================

router.post('/analytics/track', auth, asyncHandler(async (req, res) => {
  const { sessionData, feature, usageData } = req.body;
  const userId = req.user?.id || req.user?._id;

  try {
    if (sessionData) {
      await analyticsService.trackEditSession(userId, sessionData);
    }
    if (feature && usageData) {
      await analyticsService.trackFeatureUsage(userId, feature, usageData);
    }
    sendSuccess(res, 'Analytics tracked', 200);
  } catch (error) {
    logger.error('Track analytics error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.get('/analytics', auth, asyncHandler(async (req, res) => {
  const { period = '30d' } = req.query;
  const userId = req.user?.id || req.user?._id;

  try {
    const analytics = await analyticsService.getEditAnalytics(userId, period);
    sendSuccess(res, 'Analytics retrieved', 200, analytics);
  } catch (error) {
    logger.error('Get analytics error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.get('/analytics/performance', auth, asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;

  try {
    const metrics = await analyticsService.getPerformanceMetrics(userId);
    sendSuccess(res, 'Performance metrics retrieved', 200, metrics);
  } catch (error) {
    logger.error('Get performance metrics error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

// ==================== PLUGIN SYSTEM ====================

router.post('/plugins/register', auth, asyncHandler(async (req, res) => {
  const { plugin } = req.body;

  try {
    const validation = pluginService.validatePlugin(plugin);
    if (!validation.valid) {
      return sendError(res, `Invalid plugin: ${validation.errors.join(', ')}`, 400);
    }

    const result = pluginService.registerPlugin(plugin);
    sendSuccess(res, 'Plugin registered', 200, result);
  } catch (error) {
    logger.error('Register plugin error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.get('/plugins', auth, asyncHandler(async (req, res) => {
  const { category } = req.query;

  try {
    const plugins = pluginService.getAllPlugins(category || null);
    sendSuccess(res, 'Plugins retrieved', 200, { plugins });
  } catch (error) {
    logger.error('Get plugins error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.get('/plugins/categories', auth, asyncHandler(async (req, res) => {
  const categories = pluginService.getPluginCategories();
  sendSuccess(res, 'Plugin categories retrieved', 200, { categories });
}));

router.post('/plugins/:pluginId/execute', auth, asyncHandler(async (req, res) => {
  const { pluginId } = req.params;
  const { input, options } = req.body;

  try {
    const result = await pluginService.executePlugin(pluginId, input, options || {});
    sendSuccess(res, 'Plugin executed', 200, result);
  } catch (error) {
    logger.error('Execute plugin error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

router.post('/plugins/:pluginId/enable', auth, asyncHandler(async (req, res) => {
  const { pluginId } = req.params;
  const { enabled = true } = req.body;

  try {
    pluginService.setPluginEnabled(pluginId, enabled);
    sendSuccess(res, 'Plugin enabled/disabled', 200, { enabled });
  } catch (error) {
    logger.error('Set plugin enabled error', { error: error.message });
    sendError(res, error.message, error.statusCode || 500);
  }
}));

module.exports = router;

