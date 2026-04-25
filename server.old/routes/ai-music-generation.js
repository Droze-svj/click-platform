// AI Music Generation Routes

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const {
  generateMusicTrack,
  checkGenerationStatus,
  downloadAndStoreTrack,
  getAvailableStyles
} = require('../services/aiMusicGenerationService');
const AIMusicProviderConfig = require('../models/AIMusicProviderConfig');
const MusicGeneration = require('../models/MusicGeneration');
const router = express.Router();

/**
 * @route GET /api/ai-music/providers
 * @desc Get available AI music providers
 * @access Private
 */
router.get('/providers', auth, asyncHandler(async (req, res) => {
  try {
    const providers = await AIMusicProviderConfig.find({
      enabled: true
    }).select('-apiKey -apiSecret');

    sendSuccess(res, 'AI music providers retrieved', 200, {
      providers: providers.map(p => ({
        provider: p.provider,
        licenseType: p.licenseType,
        allowsCommercialUse: p.allowsCommercialUse,
        allowsSocialPlatforms: p.allowsSocialPlatforms,
        supportedPlatforms: p.supportedPlatforms,
        allowsMonetization: p.allowsMonetization,
        allowsSaaSIntegration: p.allowsSaaSIntegration,
        requiresAttribution: p.requiresAttribution
      }))
    });
  } catch (error) {
    logger.error('Error getting AI music providers', { error: error.message });
    sendError(res, error.message || 'Failed to get providers', 500);
  }
}));

/**
 * @route GET /api/ai-music/providers/:provider/styles
 * @desc Get available styles for a provider
 * @access Private
 */
router.get('/providers/:provider/styles', auth, asyncHandler(async (req, res) => {
  const { provider } = req.params;

  try {
    const styles = await getAvailableStyles(provider);

    sendSuccess(res, 'Styles retrieved', 200, { styles });
  } catch (error) {
    logger.error('Error getting styles', { error: error.message, provider });
    sendError(res, error.message || 'Failed to get styles', 500);
  }
}));

/**
 * @route POST /api/ai-music/generate
 * @desc Generate AI music track
 * @access Private
 */
router.post('/generate', auth, asyncHandler(async (req, res) => {
  const {
    provider,
    mood,
    genre,
    duration = 60,
    bpm,
    intensity,
    tempo
  } = req.body;

  if (!provider) {
    return sendError(res, 'Provider is required', 400);
  }

  try {
    // Validate provider license coverage
    const providerConfig = await AIMusicProviderConfig.findOne({ 
      provider, 
      enabled: true 
    });

    if (!providerConfig) {
      return sendError(res, 'Provider not configured or disabled', 400);
    }

    // Validate license covers requirements
    const licenseValidation = providerConfig.validateLicenseCoverage({
      commercialUse: true,
      socialPlatforms: true,
      monetization: true,
      saasIntegration: true
    });

    if (!licenseValidation.valid) {
      return sendError(res, `License validation failed: ${licenseValidation.reason}`, 403);
    }

    const generation = await generateMusicTrack(
      provider,
      { mood, genre, duration, bpm, intensity, tempo },
      req.user._id
    );

    sendSuccess(res, 'Music generation started', 200, generation);
  } catch (error) {
    logger.error('Error generating music', {
      error: error.message,
      provider,
      userId: req.user._id
    });
    sendError(res, error.message || 'Failed to generate music', 500);
  }
}));

/**
 * @route GET /api/ai-music/generations/:generationId/status
 * @desc Check generation status
 * @access Private
 */
router.get('/generations/:generationId/status', auth, asyncHandler(async (req, res) => {
  const { generationId } = req.params;

  try {
    const generation = await MusicGeneration.findById(generationId);

    if (!generation) {
      return sendError(res, 'Generation not found', 404);
    }

    if (generation.userId.toString() !== req.user._id.toString()) {
      return sendError(res, 'Unauthorized', 403);
    }

    // Check status if still processing
    if (generation.status === 'processing') {
      const status = await checkGenerationStatus(generationId);
      sendSuccess(res, 'Generation status retrieved', 200, status);
    } else {
      sendSuccess(res, 'Generation status retrieved', 200, {
        status: generation.status,
        progress: generation.progress,
        trackId: generation.trackId,
        downloadUrl: generation.downloadUrl,
        error: generation.error,
        musicId: generation.musicId
      });
    }
  } catch (error) {
    logger.error('Error checking generation status', {
      error: error.message,
      generationId,
      userId: req.user._id
    });
    sendError(res, error.message || 'Failed to check status', 500);
  }
}));

/**
 * @route POST /api/ai-music/generations/:generationId/download
 * @desc Download and store generated track
 * @access Private
 */
router.post('/generations/:generationId/download', auth, asyncHandler(async (req, res) => {
  const { generationId } = req.params;

  try {
    const music = await downloadAndStoreTrack(generationId, req.user._id);

    sendSuccess(res, 'Track downloaded and stored', 200, {
      music: {
        id: music._id,
        title: music.title,
        artist: music.artist,
        genre: music.genre,
        mood: music.mood,
        file: music.file,
        license: music.license
      }
    });
  } catch (error) {
    logger.error('Error downloading track', {
      error: error.message,
      generationId,
      userId: req.user._id
    });
    sendError(res, error.message || 'Failed to download track', 500);
  }
}));

/**
 * @route GET /api/ai-music/generations
 * @desc Get user's music generations
 * @access Private
 */
router.get('/generations', auth, asyncHandler(async (req, res) => {
  const { status, provider, page = 1, limit = 20 } = req.query;

  try {
    const query = { userId: req.user._id };
    if (status) query.status = status;
    if (provider) query.provider = provider;

    const skip = (page - 1) * limit;

    const [generations, total] = await Promise.all([
      MusicGeneration.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('musicId')
        .lean(),
      MusicGeneration.countDocuments(query)
    ]);

    sendSuccess(res, 'Generations retrieved', 200, {
      generations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error getting generations', {
      error: error.message,
      userId: req.user._id
    });
    sendError(res, error.message || 'Failed to get generations', 500);
  }
}));

/**
 * @route POST /api/ai-music/validate-license
 * @desc Validate license coverage for requirements
 * @access Private
 */
router.post('/validate-license', auth, asyncHandler(async (req, res) => {
  const {
    provider,
    commercialUse = true,
    socialPlatforms = true,
    monetization = true,
    saasIntegration = true,
    platform = null
  } = req.body;

  if (!provider) {
    return sendError(res, 'Provider is required', 400);
  }

  try {
    const providerConfig = await AIMusicProviderConfig.findOne({
      provider,
      enabled: true
    });

    if (!providerConfig) {
      return sendError(res, 'Provider not found', 404);
    }

    const validation = providerConfig.validateLicenseCoverage({
      commercialUse,
      socialPlatforms,
      monetization,
      saasIntegration,
      platform
    });

    sendSuccess(res, 'License validated', 200, {
      valid: validation.valid,
      reason: validation.reason,
      licenseInfo: {
        allowsCommercialUse: providerConfig.allowsCommercialUse,
        allowsSocialPlatforms: providerConfig.allowsSocialPlatforms,
        supportedPlatforms: providerConfig.supportedPlatforms,
        allowsMonetization: providerConfig.allowsMonetization,
        allowsSaaSIntegration: providerConfig.allowsSaaSIntegration,
        requiresAttribution: providerConfig.requiresAttribution,
        licenseType: providerConfig.licenseType
      }
    });
  } catch (error) {
    logger.error('Error validating license', { error: error.message });
    sendError(res, error.message || 'Failed to validate license', 500);
  }
}));

module.exports = router;







