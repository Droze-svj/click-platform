// Brand Voice Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  analyzeBrandVoice,
  checkContentConsistency,
  getToneSuggestions,
} = require('../../services/brandVoiceService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/creative/brand-voice/analyze:
 *   post:
 *     summary: Analyze brand voice
 *     tags: [Creative]
 *     security:
 *       - bearerAuth: []
 */
router.post('/analyze', auth, asyncHandler(async (req, res) => {
  const { sampleContent } = req.body;

  try {
    const analysis = await analyzeBrandVoice(req.user._id, sampleContent);
    sendSuccess(res, 'Brand voice analyzed', 200, analysis);
  } catch (error) {
    logger.error('Analyze brand voice error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/creative/brand-voice/check:
 *   post:
 *     summary: Check content consistency
 *     tags: [Creative]
 *     security:
 *       - bearerAuth: []
 */
router.post('/check', auth, asyncHandler(async (req, res) => {
  const { contentText, brandVoiceProfile } = req.body;

  if (!contentText) {
    return sendError(res, 'Content text is required', 400);
  }

  try {
    const check = await checkContentConsistency(req.user._id, contentText, brandVoiceProfile);
    sendSuccess(res, 'Consistency checked', 200, check);
  } catch (error) {
    logger.error('Check consistency error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/creative/brand-voice/tone:
 *   post:
 *     summary: Get tone suggestions
 *     tags: [Creative]
 *     security:
 *       - bearerAuth: []
 */
router.post('/tone', auth, asyncHandler(async (req, res) => {
  const { contentText, targetTone } = req.body;

  if (!contentText || !targetTone) {
    return sendError(res, 'Content text and target tone are required', 400);
  }

  try {
    const suggestions = await getToneSuggestions(contentText, targetTone);
    sendSuccess(res, 'Tone suggestions generated', 200, suggestions);
  } catch (error) {
    logger.error('Get tone suggestions error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

// Import brand voice library routes
const {
  createBrandVoiceProfile,
  generateStyleGuide,
  analyzeMultiLanguageContent,
} = require('../../services/brandVoiceLibraryService');

/**
 * @swagger
 * /api/creative/brand-voice/profile:
 *   post:
 *     summary: Create brand voice profile
 *     tags: [Creative]
 *     security:
 *       - bearerAuth: []
 */
router.post('/profile', auth, asyncHandler(async (req, res) => {
  const profileData = req.body;

  try {
    const profile = await createBrandVoiceProfile(req.user._id, profileData);
    sendSuccess(res, 'Brand voice profile created', 200, profile);
  } catch (error) {
    logger.error('Create brand voice profile error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/creative/brand-voice/style-guide:
 *   post:
 *     summary: Generate style guide
 *     tags: [Creative]
 *     security:
 *       - bearerAuth: []
 */
router.post('/style-guide', auth, asyncHandler(async (req, res) => {
  const { brandVoiceProfile } = req.body;

  if (!brandVoiceProfile) {
    return sendError(res, 'Brand voice profile is required', 400);
  }

  try {
    const guide = await generateStyleGuide(brandVoiceProfile);
    sendSuccess(res, 'Style guide generated', 200, guide);
  } catch (error) {
    logger.error('Generate style guide error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/creative/brand-voice/multi-language:
 *   post:
 *     summary: Analyze multi-language content
 *     tags: [Creative]
 *     security:
 *       - bearerAuth: []
 */
router.post('/multi-language', auth, asyncHandler(async (req, res) => {
  const { contentText, targetLanguage } = req.body;

  if (!contentText || !targetLanguage) {
    return sendError(res, 'Content text and target language are required', 400);
  }

  try {
    const analysis = await analyzeMultiLanguageContent(contentText, targetLanguage);
    sendSuccess(res, 'Multi-language content analyzed', 200, analysis);
  } catch (error) {
    logger.error('Analyze multi-language content error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;

