// Video Captions Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  generateAutoCaptions,
  translateCaptions,
  styleCaptions,
  generateSRTFile,
  generateVTTFile,
} = require('../../services/videoCaptionService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/video/captions/generate:
 *   post:
 *     summary: Generate auto-captions
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/generate', auth, asyncHandler(async (req, res) => {
  const { videoId, language, transcript, timestamps, style, position } = req.body;

  if (!videoId || !transcript) {
    return sendError(res, 'Video ID and transcript are required', 400);
  }

  try {
    const captions = await generateAutoCaptions(videoId, {
      language: language || 'en',
      transcript,
      timestamps,
      style: style || 'default',
      position: position || 'bottom',
    });
    sendSuccess(res, 'Auto-captions generated', 200, captions);
  } catch (error) {
    logger.error('Generate auto-captions error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/captions/translate:
 *   post:
 *     summary: Translate captions
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/translate', auth, asyncHandler(async (req, res) => {
  const { captions, targetLanguage } = req.body;

  if (!captions || !Array.isArray(captions) || !targetLanguage) {
    return sendError(res, 'Captions array and target language are required', 400);
  }

  try {
    const translated = await translateCaptions(captions, targetLanguage);
    sendSuccess(res, 'Captions translated', 200, translated);
  } catch (error) {
    logger.error('Translate captions error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/captions/style:
 *   post:
 *     summary: Style captions
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/style', auth, asyncHandler(async (req, res) => {
  const { captions, styleOptions } = req.body;

  if (!captions || !Array.isArray(captions)) {
    return sendError(res, 'Captions array is required', 400);
  }

  try {
    const styled = styleCaptions(captions, styleOptions || {});
    sendSuccess(res, 'Captions styled', 200, styled);
  } catch (error) {
    logger.error('Style captions error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/captions/srt:
 *   post:
 *     summary: Generate SRT file
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/srt', auth, asyncHandler(async (req, res) => {
  const { captions } = req.body;

  if (!captions || !Array.isArray(captions)) {
    return sendError(res, 'Captions array is required', 400);
  }

  try {
    const srt = generateSRTFile(captions);
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename="captions.srt"');
    res.send(srt);
  } catch (error) {
    logger.error('Generate SRT file error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/captions/vtt:
 *   post:
 *     summary: Generate VTT file
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/vtt', auth, asyncHandler(async (req, res) => {
  const { captions } = req.body;

  if (!captions || !Array.isArray(captions)) {
    return sendError(res, 'Captions array is required', 400);
  }

  try {
    const vtt = generateVTTFile(captions);
    res.setHeader('Content-Type', 'text/vtt');
    res.setHeader('Content-Disposition', 'attachment; filename="captions.vtt"');
    res.send(vtt);
  } catch (error) {
    logger.error('Generate VTT file error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;






