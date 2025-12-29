// Video Transcription Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  transcribeVideo,
  transcribeWithTimestamps,
  extractKeywords,
  generateVideoSummary,
} = require('../../services/videoTranscriptionService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/video/transcription:
 *   post:
 *     summary: Transcribe video
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', auth, asyncHandler(async (req, res) => {
  const { videoId, language, audioFile, timestamps, speakerDiarization } = req.body;

  if (!videoId || !audioFile) {
    return sendError(res, 'Video ID and audio file are required', 400);
  }

  try {
    const transcript = await transcribeVideo(videoId, {
      language: language || 'en',
      audioFile,
      timestamps: timestamps !== false,
      speakerDiarization: speakerDiarization || false,
    });
    sendSuccess(res, 'Video transcribed', 200, transcript);
  } catch (error) {
    logger.error('Transcribe video error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/transcription/timestamps:
 *   post:
 *     summary: Transcribe with timestamps
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/timestamps', auth, asyncHandler(async (req, res) => {
  const { videoId, audioFile, language } = req.body;

  if (!videoId || !audioFile) {
    return sendError(res, 'Video ID and audio file are required', 400);
  }

  try {
    const transcript = await transcribeWithTimestamps(videoId, audioFile, language || 'en');
    sendSuccess(res, 'Video transcribed with timestamps', 200, transcript);
  } catch (error) {
    logger.error('Transcribe with timestamps error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/transcription/keywords:
 *   post:
 *     summary: Extract keywords from transcript
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/keywords', auth, asyncHandler(async (req, res) => {
  const { transcript } = req.body;

  if (!transcript) {
    return sendError(res, 'Transcript is required', 400);
  }

  try {
    const keywords = await extractKeywords(transcript);
    sendSuccess(res, 'Keywords extracted', 200, keywords);
  } catch (error) {
    logger.error('Extract keywords error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/transcription/summary:
 *   post:
 *     summary: Generate video summary
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/summary', auth, asyncHandler(async (req, res) => {
  const { transcript } = req.body;

  if (!transcript) {
    return sendError(res, 'Transcript is required', 400);
  }

  try {
    const summary = await generateVideoSummary(transcript);
    sendSuccess(res, 'Video summary generated', 200, summary);
  } catch (error) {
    logger.error('Generate video summary error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;






