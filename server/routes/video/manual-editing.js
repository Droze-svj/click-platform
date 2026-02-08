// Manual Video Editing Routes - All 8 Advanced Features
// 1. Advanced Color Grading, 2. Professional Audio Mixing, 3. Advanced Typography
// 4. Motion Graphics, 5. AI-Assisted Editing, 6. Advanced Transitions
// 7. Speed Control, 8. Professional Export

const express = require('express');
const auth = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const multer = require('multer');
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
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 * 1024 } }); // 2GB

// ==================== 1. ADVANCED COLOR GRADING ====================

router.post('/color-grading/curves', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { curves } = req.body;
  if (!req.file) {
    return sendError(res, 'Video file is required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `color-curves-${Date.now()}.mp4`);
    await colorGradingService.applyColorCurves(req.file.path, outputPath, JSON.parse(curves));
    sendSuccess(res, 'Color curves applied', 200, { outputPath });
  } catch (error) {
    logger.error('Color curves error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.post('/color-grading/wheels', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { colorWheels } = req.body;
  if (!req.file) {
    return sendError(res, 'Video file is required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `color-wheels-${Date.now()}.mp4`);
    await colorGradingService.applyColorWheels(req.file.path, outputPath, JSON.parse(colorWheels));
    sendSuccess(res, 'Color wheels applied', 200, { outputPath });
  } catch (error) {
    logger.error('Color wheels error', { error: error.message });
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
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
    const tracks = JSON.parse(audioTracks).map((track, index) => ({
      ...track,
      filePath: req.files.audio[index]?.path
    }));

    const outputPath = path.join(path.dirname(req.files.video[0].path), `audio-mixed-${Date.now()}.mp4`);
    await audioMixingService.mixAudioTracks(req.files.video[0].path, tracks, outputPath);
    sendSuccess(res, 'Audio tracks mixed', 200, { outputPath });
  } catch (error) {
    logger.error('Audio mixing error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.post('/audio/ducking', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { duckingOptions } = req.body;
  if (!req.file) {
    return sendError(res, 'Video file is required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `audio-ducking-${Date.now()}.mp4`);
    await audioMixingService.applyAudioDucking(req.file.path, outputPath, JSON.parse(duckingOptions));
    sendSuccess(res, 'Audio ducking applied', 200, { outputPath });
  } catch (error) {
    logger.error('Audio ducking error', { error: error.message });
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
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
    await typographyService.applyAnimatedText(req.file.path, outputPath, JSON.parse(textOverlay));
    sendSuccess(res, 'Animated text applied', 200, { outputPath });
  } catch (error) {
    logger.error('Animated text error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.post('/typography/template', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { template } = req.body;
  if (!req.file || !template) {
    return sendError(res, 'Video file and template are required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `text-template-${Date.now()}.mp4`);
    await typographyService.applyTextTemplate(req.file.path, outputPath, JSON.parse(template));
    sendSuccess(res, 'Text template applied', 200, { outputPath });
  } catch (error) {
    logger.error('Text template error', { error: error.message });
    sendError(res, error.message, 500);
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
    await motionGraphicsService.addShapeOverlay(req.file.path, outputPath, JSON.parse(shape));
    sendSuccess(res, 'Shape overlay added', 200, { outputPath });
  } catch (error) {
    logger.error('Shape overlay error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.post('/motion-graphics/chroma-key', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { chromaKeyOptions } = req.body;
  if (!req.file) {
    return sendError(res, 'Video file is required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `chroma-key-${Date.now()}.mp4`);
    await motionGraphicsService.applyChromaKey(req.file.path, outputPath, JSON.parse(chromaKeyOptions));
    sendSuccess(res, 'Chroma key applied', 200, { outputPath });
  } catch (error) {
    logger.error('Chroma key error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.post('/motion-graphics/pip', auth, upload.fields([{ name: 'video', maxCount: 1 }, { name: 'pip', maxCount: 1 }]), asyncHandler(async (req, res) => {
  const { pipOptions } = req.body;
  if (!req.files.video || !req.files.pip) {
    return sendError(res, 'Video and PIP video are required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.files.video[0].path), `pip-${Date.now()}.mp4`);
    await motionGraphicsService.addPictureInPicture(req.files.video[0].path, req.files.pip[0].path, outputPath, JSON.parse(pipOptions));
    sendSuccess(res, 'Picture-in-picture added', 200, { outputPath });
  } catch (error) {
    logger.error('PIP error', { error: error.message });
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
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
    await transitionsService.applyTransition(req.files.clip1[0].path, req.files.clip2[0].path, outputPath, JSON.parse(transition));
    sendSuccess(res, 'Transition applied', 200, { outputPath });
  } catch (error) {
    logger.error('Transition error', { error: error.message });
    sendError(res, error.message, 500);
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
    await speedControlService.applyVariableSpeed(req.file.path, outputPath, JSON.parse(speedOptions));
    sendSuccess(res, 'Variable speed applied', 200, { outputPath });
  } catch (error) {
    logger.error('Variable speed error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.post('/speed/ramp', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { rampOptions } = req.body;
  if (!req.file) {
    return sendError(res, 'Video file is required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `speed-ramp-${Date.now()}.mp4`);
    await speedControlService.applySpeedRamp(req.file.path, outputPath, JSON.parse(rampOptions));
    sendSuccess(res, 'Speed ramp applied', 200, { outputPath });
  } catch (error) {
    logger.error('Speed ramp error', { error: error.message });
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
  }
}));

router.post('/speed/freeze', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { freezeOptions } = req.body;
  if (!req.file) {
    return sendError(res, 'Video file is required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `freeze-${Date.now()}.mp4`);
    await speedControlService.freezeFrame(req.file.path, outputPath, JSON.parse(freezeOptions));
    sendSuccess(res, 'Freeze frame applied', 200, { outputPath });
  } catch (error) {
    logger.error('Freeze frame error', { error: error.message });
    sendError(res, error.message, 500);
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
    await exportService.exportWithPreset(req.file.path, outputPath, platform, JSON.parse(options || '{}'));
    sendSuccess(res, 'Export completed', 200, { outputPath, platform });
  } catch (error) {
    logger.error('Export error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.post('/export/custom', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { settings } = req.body;
  if (!req.file || !settings) {
    return sendError(res, 'Video file and settings are required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `export-custom-${Date.now()}.mp4`);
    await exportService.exportCustom(req.file.path, outputPath, JSON.parse(settings));
    sendSuccess(res, 'Custom export completed', 200, { outputPath });
  } catch (error) {
    logger.error('Custom export error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.post('/export/batch', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { exports } = req.body;
  if (!req.file || !exports) {
    return sendError(res, 'Video file and export configs are required', 400);
  }

  try {
    const results = await exportService.batchExport(req.file.path, JSON.parse(exports));
    sendSuccess(res, 'Batch export completed', 200, { results });
  } catch (error) {
    logger.error('Batch export error', { error: error.message });
    sendError(res, error.message, 500);
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
  const { videoId, videoUrl, videoFilters, textOverlays, shapeOverlays, exportOptions, timelineSegments } = req.body;

  if (!videoId && !videoUrl) {
    return sendError(res, 'videoId or videoUrl is required', 400);
  }

  try {
    const result = await videoRenderService.renderFromEditorState({
      videoId: videoId || null,
      videoUrl: videoUrl || null,
      videoFilters: videoFilters || {},
      textOverlays: Array.isArray(textOverlays) ? textOverlays : [],
      shapeOverlays: Array.isArray(shapeOverlays) ? shapeOverlays : [],
      exportOptions: exportOptions || {},
      timelineSegments: Array.isArray(timelineSegments) ? timelineSegments : [],
    });

    sendSuccess(res, 'Render completed', 200, {
      outputPath: result.outputPath,
      url: result.url,
      downloadUrl: result.url ? `${req.protocol}://${req.get('host')}${result.url}` : null,
    });
  } catch (error) {
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
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
  }
}));

// ==================== ENHANCED FEATURES ====================

// Edit History (Undo/Redo)
router.post('/history/save', auth, asyncHandler(async (req, res) => {
  const { videoId, editState } = req.body;
  if (!videoId || !editState) {
    return sendError(res, 'Video ID and edit state are required', 400);
  }

  try {
    const result = await editHistoryService.saveEditState(videoId, editState);
    sendSuccess(res, 'Edit state saved', 200, result);
  } catch (error) {
    logger.error('Save edit state error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.post('/history/undo', auth, asyncHandler(async (req, res) => {
  const { videoId } = req.body;
  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }

  try {
    const result = await editHistoryService.undoEdit(videoId);
    sendSuccess(res, 'Edit undone', 200, result);
  } catch (error) {
    logger.error('Undo edit error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.post('/history/redo', auth, asyncHandler(async (req, res) => {
  const { videoId } = req.body;
  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }

  try {
    const result = await editHistoryService.redoEdit(videoId);
    sendSuccess(res, 'Edit redone', 200, result);
  } catch (error) {
    logger.error('Redo edit error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.get('/history/:videoId', auth, asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  try {
    const history = await editHistoryService.getEditHistory(videoId);
    sendSuccess(res, 'Edit history retrieved', 200, history);
  } catch (error) {
    logger.error('Get edit history error', { error: error.message });
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
  }
}));

router.get('/presets/community', auth, asyncHandler(async (req, res) => {
  const { category, limit } = req.query;

  try {
    const result = await presetService.getCommunityPresets(category || null, parseInt(limit) || 20);
    sendSuccess(res, 'Community presets retrieved', 200, result);
  } catch (error) {
    logger.error('Get community presets error', { error: error.message });
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
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
    const validation = batchService.validateBatchOperations(JSON.parse(operations));
    if (!validation.valid) {
      return sendError(res, `Invalid operations: ${validation.errors.join(', ')}`, 400);
    }

    const outputPath = path.join(path.dirname(req.file.path), `batch-${Date.now()}.mp4`);
    const result = await batchService.applyBatchOperationsSequential(
      req.file.path,
      JSON.parse(operations),
      outputPath
    );
    sendSuccess(res, 'Batch operations completed', 200, result);
  } catch (error) {
    logger.error('Batch operations error', { error: error.message });
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
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
      limit: parseInt(limit) || 20,
      skip: parseInt(skip) || 0
    });
    sendSuccess(res, 'Templates retrieved', 200, result);
  } catch (error) {
    logger.error('Browse templates error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.get('/marketplace/featured', auth, asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;

  try {
    const templates = await templateMarketplaceService.getFeaturedTemplates(parseInt(limit));
    sendSuccess(res, 'Featured templates retrieved', 200, { templates });
  } catch (error) {
    logger.error('Get featured templates error', { error: error.message });
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
  }
}));

// ==================== KEYFRAME ANIMATION ====================

router.post('/keyframes/save', auth, asyncHandler(async (req, res) => {
  const { videoId, animationData } = req.body;
  if (!videoId || !animationData) {
    return sendError(res, 'Video ID and animation data are required', 400);
  }

  try {
    const result = await keyframeService.saveKeyframeAnimation(videoId, animationData);
    sendSuccess(res, 'Keyframe animation saved', 200, result);
  } catch (error) {
    logger.error('Save keyframe animation error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.post('/keyframes/apply', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { keyframes, property } = req.body;
  if (!req.file || !keyframes || !property) {
    return sendError(res, 'Video file, keyframes, and property are required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `keyframe-${Date.now()}.mp4`);
    await keyframeService.applyKeyframeAnimation(req.file.path, outputPath, JSON.parse(keyframes), property);
    sendSuccess(res, 'Keyframe animation applied', 200, { outputPath });
  } catch (error) {
    logger.error('Apply keyframe animation error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.get('/keyframes/presets', auth, asyncHandler(async (req, res) => {
  const presets = keyframeService.getAnimationPresets();
  sendSuccess(res, 'Animation presets retrieved', 200, { presets });
}));

// ==================== MULTI-TRACK TIMELINE ====================

router.get('/timeline/:videoId', auth, asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  try {
    const timeline = await multiTrackService.getTimelineConfig(videoId);
    sendSuccess(res, 'Timeline config retrieved', 200, timeline);
  } catch (error) {
    logger.error('Get timeline config error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.post('/timeline/:videoId/track', auth, asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { trackData } = req.body;

  try {
    const result = await multiTrackService.addTrack(videoId, trackData);
    sendSuccess(res, 'Track added', 200, result);
  } catch (error) {
    logger.error('Add track error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.delete('/timeline/:videoId/track/:trackId', auth, asyncHandler(async (req, res) => {
  const { videoId, trackId } = req.params;

  try {
    await multiTrackService.removeTrack(videoId, trackId);
    sendSuccess(res, 'Track removed', 200);
  } catch (error) {
    logger.error('Remove track error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.post('/timeline/:videoId/track/:trackId/clip', auth, asyncHandler(async (req, res) => {
  const { videoId, trackId } = req.params;
  const { clipData } = req.body;

  try {
    const result = await multiTrackService.addClipToTrack(videoId, trackId, clipData);
    sendSuccess(res, 'Clip added to track', 200, result);
  } catch (error) {
    logger.error('Add clip to track error', { error: error.message });
    sendError(res, error.message, 500);
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
    await maskingService.applyBezierMask(req.file.path, outputPath, JSON.parse(maskData));
    sendSuccess(res, 'Bezier mask applied', 200, { outputPath });
  } catch (error) {
    logger.error('Bezier mask error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.post('/masking/track', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { trackingData } = req.body;
  if (!req.file || !trackingData) {
    return sendError(res, 'Video file and tracking data are required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `tracked-mask-${Date.now()}.mp4`);
    await maskingService.trackMask(req.file.path, outputPath, JSON.parse(trackingData));
    sendSuccess(res, 'Mask tracking completed', 200, { outputPath });
  } catch (error) {
    logger.error('Mask tracking error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.post('/masking/chroma-refine', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { chromaKeyOptions } = req.body;
  if (!req.file) {
    return sendError(res, 'Video file is required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `chroma-refined-${Date.now()}.mp4`);
    await maskingService.refineChromaKey(req.file.path, outputPath, JSON.parse(chromaKeyOptions));
    sendSuccess(res, 'Chroma key refined', 200, { outputPath });
  } catch (error) {
    logger.error('Chroma key refine error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

// ==================== MOTION TRACKING ====================

router.post('/tracking/point', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { trackingData } = req.body;
  if (!req.file || !trackingData) {
    return sendError(res, 'Video file and tracking data are required', 400);
  }

  try {
    const tracking = await trackingService.trackPoint(req.file.path, JSON.parse(trackingData));
    sendSuccess(res, 'Point tracking completed', 200, tracking);
  } catch (error) {
    logger.error('Point tracking error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.post('/tracking/face', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { trackingData } = req.body;
  if (!req.file) {
    return sendError(res, 'Video file is required', 400);
  }

  try {
    const tracking = await trackingService.trackFace(req.file.path, JSON.parse(trackingData || '{}'));
    sendSuccess(res, 'Face tracking completed', 200, tracking);
  } catch (error) {
    logger.error('Face tracking error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.post('/tracking/object', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { trackingData } = req.body;
  if (!req.file || !trackingData) {
    return sendError(res, 'Video file and tracking data are required', 400);
  }

  try {
    const tracking = await trackingService.trackObject(req.file.path, JSON.parse(trackingData));
    sendSuccess(res, 'Object tracking completed', 200, tracking);
  } catch (error) {
    logger.error('Object tracking error', { error: error.message });
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
  }
}));

router.get('/tutorials/:feature/tooltips', auth, asyncHandler(async (req, res) => {
  const { feature } = req.params;

  try {
    const tooltips = tutorialsService.getTooltips(feature);
    sendSuccess(res, 'Tooltips retrieved', 200, { tooltips });
  } catch (error) {
    logger.error('Get tooltips error', { error: error.message });
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
  }
}));

router.get('/tutorials/progress', auth, asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;

  try {
    const progress = await tutorialsService.getUserProgress(userId);
    sendSuccess(res, 'Progress retrieved', 200, progress);
  } catch (error) {
    logger.error('Get progress error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.get('/tutorials/tips/:feature?', auth, asyncHandler(async (req, res) => {
  const { feature } = req.params;

  try {
    const tips = tutorialsService.getTipsAndTricks(feature || null);
    sendSuccess(res, 'Tips retrieved', 200, { tips });
  } catch (error) {
    logger.error('Get tips error', { error: error.message });
    sendError(res, error.message, 500);
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
    await advancedExportService.exportHDR(req.file.path, outputPath, JSON.parse(hdrOptions || '{}'));
    sendSuccess(res, 'HDR export completed', 200, { outputPath });
  } catch (error) {
    logger.error('HDR export error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.post('/export/codec', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { codecOptions } = req.body;
  if (!req.file || !codecOptions) {
    return sendError(res, 'Video file and codec options are required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `export-codec-${Date.now()}.mp4`);
    await advancedExportService.exportWithCodec(req.file.path, outputPath, JSON.parse(codecOptions));
    sendSuccess(res, 'Export with codec completed', 200, { outputPath });
  } catch (error) {
    logger.error('Codec export error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.post('/export/color-space', auth, upload.single('video'), asyncHandler(async (req, res) => {
  const { colorSpaceOptions } = req.body;
  if (!req.file || !colorSpaceOptions) {
    return sendError(res, 'Video file and color space options are required', 400);
  }

  try {
    const outputPath = path.join(path.dirname(req.file.path), `export-colorspace-${Date.now()}.mp4`);
    await advancedExportService.exportWithColorSpace(req.file.path, outputPath, JSON.parse(colorSpaceOptions));
    sendSuccess(res, 'Export with color space completed', 200, { outputPath });
  } catch (error) {
    logger.error('Color space export error', { error: error.message });
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
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
    await multiCamService.createMultiCamSequence(cameraPaths, outputPath, JSON.parse(sequence));
    sendSuccess(res, 'Multi-cam sequence created', 200, { outputPath });
  } catch (error) {
    logger.error('Multi-cam create error', { error: error.message });
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
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

  try {
    const result = await cloudSyncService.saveProjectToCloud(videoId, projectData);
    sendSuccess(res, 'Project saved to cloud', 200, result);
  } catch (error) {
    logger.error('Cloud save error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.get('/cloud/:videoId', auth, asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { version } = req.query;

  try {
    const project = await cloudSyncService.getProjectFromCloud(videoId, version ? parseInt(version) : null);
    sendSuccess(res, 'Project retrieved from cloud', 200, project);
  } catch (error) {
    logger.error('Cloud get error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.get('/cloud/:videoId/history', auth, asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  try {
    const history = await cloudSyncService.getVersionHistory(videoId);
    sendSuccess(res, 'Version history retrieved', 200, history);
  } catch (error) {
    logger.error('Version history error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.post('/cloud/:videoId/restore', auth, asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { version } = req.body;

  try {
    const result = await cloudSyncService.restoreProjectVersion(videoId, version);
    sendSuccess(res, 'Version restored', 200, result);
  } catch (error) {
    logger.error('Restore version error', { error: error.message });
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
  }
}));

router.get('/analytics/performance', auth, asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;

  try {
    const metrics = await analyticsService.getPerformanceMetrics(userId);
    sendSuccess(res, 'Performance metrics retrieved', 200, metrics);
  } catch (error) {
    logger.error('Get performance metrics error', { error: error.message });
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
  }
}));

router.get('/plugins', auth, asyncHandler(async (req, res) => {
  const { category } = req.query;

  try {
    const plugins = pluginService.getAllPlugins(category || null);
    sendSuccess(res, 'Plugins retrieved', 200, { plugins });
  } catch (error) {
    logger.error('Get plugins error', { error: error.message });
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
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
    sendError(res, error.message, 500);
  }
}));

module.exports = router;

