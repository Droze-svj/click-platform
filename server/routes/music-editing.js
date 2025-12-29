// Music Editing Routes
// Timeline controls and audio processing

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const MusicTrack = require('../models/MusicTrack');
const SFXTrack = require('../models/SFXTrack');
const {
  processAudioTrack,
  applyAutoDucking,
  fitTrackToVideoLength,
  renderAudioMix
} = require('../services/musicEditingService');
const {
  alignToSceneBoundary,
  alignBeatToKeyMoment,
  snapToNearestSceneBoundary,
  alignChorusToScene
} = require('../services/musicAlignmentService');
const {
  applyPresetToTrack,
  getAvailablePresets
} = require('../services/musicPresetService');
const { generatePreviewUrl, generateMixPreview } = require('../services/musicPreviewService');
const { generateTrackWaveform } = require('../services/waveformService');
const { applyAdvancedDucking, previewDuckingEffect } = require('../services/advancedDuckingService');
const { processTrackWithEffects, getEffectPresets } = require('../services/audioEffectsService');
const { copyTrackSettings, getCommonTemplates } = require('../services/musicTrackTemplateService');
const router = express.Router();

/**
 * @route POST /api/music-editing/tracks
 * @desc Add music track to timeline
 * @access Private
 */
router.post('/tracks', auth, asyncHandler(async (req, res) => {
  const {
    projectId,
    sourceTrackId,
    source,
    startTime = 0,
    duration,
    volume = 0
  } = req.body;

  if (!projectId || !sourceTrackId || !source || !duration) {
    return sendError(res, 'projectId, sourceTrackId, source, and duration are required', 400);
  }

  try {
    // Get highest layer to place on top
    const maxLayer = await MusicTrack.findOne({ projectId })
      .sort({ layer: -1 })
      .select('layer')
      .lean();

    const track = new MusicTrack({
      projectId,
      userId: req.user._id,
      sourceTrackId,
      source,
      startTime,
      duration,
      volume,
      layer: (maxLayer?.layer || 0) + 1
    });

    await track.save();

    sendSuccess(res, 'Track added to timeline', 200, { track });
  } catch (error) {
    logger.error('Error adding track to timeline', { error: error.message, userId: req.user._id });
    sendError(res, error.message || 'Failed to add track', 500);
  }
}));

/**
 * @route GET /api/music-editing/tracks
 * @desc Get all tracks for project
 * @access Private
 */
router.get('/tracks', auth, asyncHandler(async (req, res) => {
  const { projectId } = req.query;

  if (!projectId) {
    return sendError(res, 'projectId is required', 400);
  }

  try {
    const tracks = await MusicTrack.find({
      projectId,
      userId: req.user._id
    }).sort({ layer: 1, startTime: 1 }).lean();

    const sfxTracks = await SFXTrack.find({
      projectId,
      userId: req.user._id
    }).sort({ layer: 1, startTime: 1 }).lean();

    sendSuccess(res, 'Tracks retrieved', 200, {
      musicTracks: tracks,
      sfxTracks
    });
  } catch (error) {
    logger.error('Error getting tracks', { error: error.message });
    sendError(res, error.message || 'Failed to get tracks', 500);
  }
}));

/**
 * @route PUT /api/music-editing/tracks/:trackId
 * @desc Update track properties
 * @access Private
 */
router.put('/tracks/:trackId', auth, asyncHandler(async (req, res) => {
  const { trackId } = req.params;
  const updates = req.body;

  try {
    const track = await MusicTrack.findOne({
      _id: trackId,
      userId: req.user._id
    });

    if (!track) {
      return sendError(res, 'Track not found', 404);
    }

    // Update allowed fields
    const allowedUpdates = [
      'startTime', 'duration', 'sourceStartTime', 'sourceEndTime',
      'volume', 'fadeIn', 'fadeOut', 'volumeAutomation', 'loop',
      'fitToVideoLength', 'autoDucking', 'alignment', 'layer', 'muted', 'solo'
    ];

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        track[field] = updates[field];
      }
    });

    await track.save();

    sendSuccess(res, 'Track updated', 200, { track });
  } catch (error) {
    logger.error('Error updating track', { error: error.message, trackId });
    sendError(res, error.message || 'Failed to update track', 500);
  }
}));

/**
 * @route DELETE /api/music-editing/tracks/:trackId
 * @desc Remove track from timeline
 * @access Private
 */
router.delete('/tracks/:trackId', auth, asyncHandler(async (req, res) => {
  const { trackId } = req.params;

  try {
    const track = await MusicTrack.findOne({
      _id: trackId,
      userId: req.user._id
    });

    if (!track) {
      return sendError(res, 'Track not found', 404);
    }

    await track.deleteOne();

    sendSuccess(res, 'Track removed', 200);
  } catch (error) {
    logger.error('Error removing track', { error: error.message, trackId });
    sendError(res, error.message || 'Failed to remove track', 500);
  }
}));

/**
 * @route POST /api/music-editing/tracks/:trackId/fit-to-video
 * @desc Fit track to video length
 * @access Private
 */
router.post('/tracks/:trackId/fit-to-video', auth, asyncHandler(async (req, res) => {
  const { trackId } = req.params;
  const { videoDuration } = req.body;

  if (!videoDuration) {
    return sendError(res, 'videoDuration is required', 400);
  }

  try {
    const result = await fitTrackToVideoLength(trackId, videoDuration, req.user._id);

    sendSuccess(res, 'Track fitted to video length', 200, result);
  } catch (error) {
    logger.error('Error fitting track to video', { error: error.message, trackId });
    sendError(res, error.message || 'Failed to fit track', 500);
  }
}));

/**
 * @route POST /api/music-editing/tracks/:trackId/auto-ducking
 * @desc Apply automatic ducking under speech
 * @access Private
 */
router.post('/tracks/:trackId/auto-ducking', auth, asyncHandler(async (req, res) => {
  const { trackId } = req.params;
  const { videoContentId, enabled, sensitivity, duckAmount } = req.body;

  if (!videoContentId) {
    return sendError(res, 'videoContentId is required', 400);
  }

  try {
    const track = await MusicTrack.findOne({
      _id: trackId,
      userId: req.user._id
    });

    if (!track) {
      return sendError(res, 'Track not found', 404);
    }

    // Update auto-ducking settings
    if (enabled !== undefined) track.autoDucking.enabled = enabled;
    if (sensitivity !== undefined) track.autoDucking.sensitivity = sensitivity;
    if (duckAmount !== undefined) track.autoDucking.duckAmount = duckAmount;

    await track.save();

    // Apply ducking if enabled
    if (track.autoDucking.enabled) {
      const result = await applyAutoDucking(trackId, videoContentId, req.user._id);
      sendSuccess(res, 'Auto-ducking applied', 200, result);
    } else {
      sendSuccess(res, 'Auto-ducking disabled', 200, { track });
    }
  } catch (error) {
    logger.error('Error applying auto-ducking', { error: error.message, trackId });
    sendError(res, error.message || 'Failed to apply auto-ducking', 500);
  }
}));

/**
 * @route POST /api/music-editing/tracks/:trackId/align
 * @desc Align track to scene boundary or key moment
 * @access Private
 */
router.post('/tracks/:trackId/align', auth, asyncHandler(async (req, res) => {
  const { trackId } = req.params;
  const { alignmentType, sceneId, contentId } = req.body;

  if (!alignmentType) {
    return sendError(res, 'alignmentType is required', 400);
  }

  try {
    let result;

    switch (alignmentType) {
      case 'scene_boundary':
        if (!sceneId) {
          return sendError(res, 'sceneId is required for scene_boundary alignment', 400);
        }
        const { alignTo } = req.body;
        result = await alignToSceneBoundary(trackId, sceneId, alignTo || 'start', req.user._id);
        break;

      case 'key_moment':
        if (!contentId) {
          return sendError(res, 'contentId is required for key_moment alignment', 400);
        }
        result = await alignBeatToKeyMoment(trackId, contentId, req.user._id);
        break;

      case 'snap':
        if (!contentId) {
          return sendError(res, 'contentId is required for snap alignment', 400);
        }
        result = await snapToNearestSceneBoundary(trackId, contentId, req.user._id);
        break;

      case 'chorus':
        if (!sceneId) {
          return sendError(res, 'sceneId is required for chorus alignment', 400);
        }
        result = await alignChorusToScene(trackId, sceneId, req.user._id);
        break;

      default:
        return sendError(res, 'Invalid alignmentType', 400);
    }

    sendSuccess(res, 'Track aligned', 200, result);
  } catch (error) {
    logger.error('Error aligning track', { error: error.message, trackId });
    sendError(res, error.message || 'Failed to align track', 500);
  }
}));

/**
 * @route POST /api/music-editing/tracks/:trackId/preset
 * @desc Apply preset to track
 * @access Private
 */
router.post('/tracks/:trackId/preset', auth, asyncHandler(async (req, res) => {
  const { trackId } = req.params;
  const { presetId } = req.body;

  if (!presetId) {
    return sendError(res, 'presetId is required', 400);
  }

  try {
    const result = await applyPresetToTrack(trackId, presetId, req.user._id);

    sendSuccess(res, 'Preset applied to track', 200, result);
  } catch (error) {
    logger.error('Error applying preset', { error: error.message, trackId });
    sendError(res, error.message || 'Failed to apply preset', 500);
  }
}));

/**
 * @route GET /api/music-editing/presets
 * @desc Get available presets
 * @access Private
 */
router.get('/presets', auth, asyncHandler(async (req, res) => {
  const { useCase, includeSystem = true } = req.query;

  try {
    const presets = await getAvailablePresets(req.user._id, {
      useCase,
      includeSystem: includeSystem === 'true'
    });

    sendSuccess(res, 'Presets retrieved', 200, { presets });
  } catch (error) {
    logger.error('Error getting presets', { error: error.message });
    sendError(res, error.message || 'Failed to get presets', 500);
  }
}));

/**
 * @route POST /api/music-editing/sfx
 * @desc Add SFX track to timeline
 * @access Private
 */
router.post('/sfx', auth, asyncHandler(async (req, res) => {
  const {
    projectId,
    sfxType,
    fileUrl,
    startTime,
    duration,
    volume = 0
  } = req.body;

  if (!projectId || !sfxType || !fileUrl || !startTime || !duration) {
    return sendError(res, 'projectId, sfxType, fileUrl, startTime, and duration are required', 400);
  }

  try {
    // Get highest layer
    const maxLayer = await SFXTrack.findOne({ projectId })
      .sort({ layer: -1 })
      .select('layer')
      .lean();

    const sfxTrack = new SFXTrack({
      projectId,
      userId: req.user._id,
      sfxType,
      fileUrl,
      startTime,
      duration,
      volume,
      layer: (maxLayer?.layer || 0) + 1
    });

    await sfxTrack.save();

    sendSuccess(res, 'SFX track added', 200, { sfxTrack });
  } catch (error) {
    logger.error('Error adding SFX track', { error: error.message });
    sendError(res, error.message || 'Failed to add SFX track', 500);
  }
}));

/**
 * @route POST /api/music-editing/render
 * @desc Render final audio mix
 * @access Private
 */
router.post('/render', auth, asyncHandler(async (req, res) => {
  const {
    projectId,
    contentId,
    exportFormat = 'mp4',
    exportResolution = '1080p',
    exportPlatform
  } = req.body;

  if (!projectId) {
    return sendError(res, 'projectId is required', 400);
  }

  try {
    // Get all tracks for logging
    const tracks = await MusicTrack.find({
      projectId,
      userId: req.user._id,
      muted: false
    }).lean();

    // Generate render ID
    const renderId = `render_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Log usage for all tracks
    const { logRenderUsage } = require('../services/musicLicenseLoggingService');
    const { registerLicenseUsage } = require('../services/musicLicenseRegistrationService');

    const usageLogs = await logRenderUsage(
      tracks.map(track => ({
        trackId: track.sourceTrackId,
        source: track.source
      })),
      {
        userId: req.user._id,
        workspaceId: req.user.workspaceId,
        projectId,
        contentId,
        renderId,
        exportFormat,
        exportResolution,
        exportPlatform
      }
    );

    // Register licenses if required
    for (const usageLog of usageLogs.usageLogs) {
      if (usageLog.licenseType === 'per_export' || usageLog.licenseType === 'per_end_user') {
        try {
          await registerLicenseUsage(usageLog._id.toString());
        } catch (error) {
          logger.warn('Failed to register license', {
            usageLogId: usageLog._id,
            error: error.message
          });
        }
      }
    }

    // Render audio mix
    const result = await renderAudioMix(projectId, req.user._id);

    // Get attributions
    const { getRenderAttributions } = require('../services/musicAttributionService');
    const attributions = await getRenderAttributions(renderId, req.user._id);

    sendSuccess(res, 'Audio mix rendered', 200, {
      ...result,
      renderId,
      usageLogged: true,
      tracksLogged: usageLogs.tracksLogged,
      attributions: attributions.combinedAttribution
    });
  } catch (error) {
    logger.error('Error rendering audio mix', { error: error.message, projectId });
    sendError(res, error.message || 'Failed to render audio mix', 500);
  }
}));

/**
 * @route GET /api/music-editing/tracks/:trackId/preview
 * @desc Generate preview URL for track
 * @access Private
 */
router.get('/tracks/:trackId/preview', auth, asyncHandler(async (req, res) => {
  const { trackId } = req.params;
  const { startTime = 0, duration = 30, quality = 'medium' } = req.query;

  try {
    const result = await generatePreviewUrl(trackId, req.user._id, {
      startTime: parseFloat(startTime),
      duration: parseFloat(duration),
      quality
    });

    sendSuccess(res, 'Preview URL generated', 200, result);
  } catch (error) {
    logger.error('Error generating preview', { error: error.message, trackId });
    sendError(res, error.message || 'Failed to generate preview', 500);
  }
}));

/**
 * @route GET /api/music-editing/preview/mix
 * @desc Generate preview for mix (all tracks)
 * @access Private
 */
router.get('/preview/mix', auth, asyncHandler(async (req, res) => {
  const { projectId, startTime = 0, duration = 30, quality = 'medium' } = req.query;

  if (!projectId) {
    return sendError(res, 'projectId is required', 400);
  }

  try {
    const result = await generateMixPreview(projectId, req.user._id, {
      startTime: parseFloat(startTime),
      duration: parseFloat(duration),
      quality
    });

    sendSuccess(res, 'Mix preview generated', 200, result);
  } catch (error) {
    logger.error('Error generating mix preview', { error: error.message, projectId });
    sendError(res, error.message || 'Failed to generate mix preview', 500);
  }
}));

/**
 * @route GET /api/music-editing/tracks/:trackId/waveform
 * @desc Generate waveform data for track
 * @access Private
 */
router.get('/tracks/:trackId/waveform', auth, asyncHandler(async (req, res) => {
  const { trackId } = req.params;
  const { width = 800, precision = 1 } = req.query;

  try {
    const waveform = await generateTrackWaveform(trackId, req.user._id, {
      width: parseInt(width),
      precision: parseFloat(precision),
      format: 'json'
    });

    sendSuccess(res, 'Waveform generated', 200, waveform);
  } catch (error) {
    logger.error('Error generating waveform', { error: error.message, trackId });
    sendError(res, error.message || 'Failed to generate waveform', 500);
  }
}));

/**
 * @route POST /api/music-editing/tracks/:trackId/advanced-ducking
 * @desc Apply advanced ducking with attack/release
 * @access Private
 */
router.post('/tracks/:trackId/advanced-ducking', auth, asyncHandler(async (req, res) => {
  const { trackId } = req.params;
  const {
    videoContentId,
    threshold = 0.7,
    duckAmount = -18,
    attackTime = 0.1,
    releaseTime = 0.3,
    holdTime = 0.0,
    minDuckDuration = 0.5
  } = req.body;

  if (!videoContentId) {
    return sendError(res, 'videoContentId is required', 400);
  }

  try {
    const result = await applyAdvancedDucking(
      trackId,
      videoContentId,
      req.user._id,
      {
        threshold,
        duckAmount,
        attackTime,
        releaseTime,
        holdTime,
        minDuckDuration
      }
    );

    sendSuccess(res, 'Advanced ducking applied', 200, result);
  } catch (error) {
    logger.error('Error applying advanced ducking', { error: error.message, trackId });
    sendError(res, error.message || 'Failed to apply advanced ducking', 500);
  }
}));

/**
 * @route POST /api/music-editing/tracks/:trackId/preview-ducking
 * @desc Preview ducking effect without applying
 * @access Private
 */
router.post('/tracks/:trackId/preview-ducking', auth, asyncHandler(async (req, res) => {
  const { trackId } = req.params;
  const {
    videoContentId,
    threshold = 0.7,
    duckAmount = -18,
    attackTime = 0.1,
    releaseTime = 0.3
  } = req.body;

  if (!videoContentId) {
    return sendError(res, 'videoContentId is required', 400);
  }

  try {
    const result = await previewDuckingEffect(
      trackId,
      videoContentId,
      req.user._id,
      {
        threshold,
        duckAmount,
        attackTime,
        releaseTime
      }
    );

    sendSuccess(res, 'Ducking preview generated', 200, result);
  } catch (error) {
    logger.error('Error previewing ducking', { error: error.message, trackId });
    sendError(res, error.message || 'Failed to preview ducking', 500);
  }
}));

/**
 * @route POST /api/music-editing/tracks/:trackId/effects
 * @desc Apply audio effects to track
 * @access Private
 */
router.post('/tracks/:trackId/effects', auth, asyncHandler(async (req, res) => {
  const { trackId } = req.params;
  const { effects } = req.body;

  if (!effects) {
    return sendError(res, 'effects are required', 400);
  }

  try {
    const result = await processTrackWithEffects(trackId, req.user._id, effects);

    sendSuccess(res, 'Audio effects applied', 200, result);
  } catch (error) {
    logger.error('Error applying audio effects', { error: error.message, trackId });
    sendError(res, error.message || 'Failed to apply audio effects', 500);
  }
}));

/**
 * @route GET /api/music-editing/effects/presets
 * @desc Get audio effect presets
 * @access Private
 */
router.get('/effects/presets', auth, asyncHandler(async (req, res) => {
  try {
    const presets = getEffectPresets();

    sendSuccess(res, 'Effect presets retrieved', 200, { presets });
  } catch (error) {
    logger.error('Error getting effect presets', { error: error.message });
    sendError(res, error.message || 'Failed to get effect presets', 500);
  }
}));

/**
 * @route POST /api/music-editing/tracks/copy-settings
 * @desc Copy settings from one track to another
 * @access Private
 */
router.post('/tracks/copy-settings', auth, asyncHandler(async (req, res) => {
  const {
    sourceTrackId,
    targetTrackId,
    copyVolume = true,
    copyFade = true,
    copyAutomation = true,
    copyDucking = true,
    copyAlignment = false
  } = req.body;

  if (!sourceTrackId || !targetTrackId) {
    return sendError(res, 'sourceTrackId and targetTrackId are required', 400);
  }

  try {
    const result = await copyTrackSettings(
      sourceTrackId,
      targetTrackId,
      req.user._id,
      {
        copyVolume,
        copyFade,
        copyAutomation,
        copyDucking,
        copyAlignment
      }
    );

    sendSuccess(res, 'Track settings copied', 200, result);
  } catch (error) {
    logger.error('Error copying track settings', { error: error.message });
    sendError(res, error.message || 'Failed to copy track settings', 500);
  }
}));

/**
 * @route GET /api/music-editing/templates
 * @desc Get common track templates
 * @access Private
 */
router.get('/templates', auth, asyncHandler(async (req, res) => {
  try {
    const templates = getCommonTemplates();

    sendSuccess(res, 'Templates retrieved', 200, { templates });
  } catch (error) {
    logger.error('Error getting templates', { error: error.message });
    sendError(res, error.message || 'Failed to get templates', 500);
  }
}));

module.exports = router;

