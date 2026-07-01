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
const { guardOwnership } = require('../../utils/ownership');
const logger = require('../../utils/logger');
const router = express.Router();

// AI/render cost guard: transcription triggers paid renders + Gemini calls —
// rate-limit POST/PUT per user + attach the per-tier budget guard.
const { aiLimiter } = require('../../middleware/enhancedRateLimiter');
const { costGuard } = require('../../middleware/costGuard');
router.use((req, res, next) => (['POST', 'PUT'].includes(req.method) ? aiLimiter(req, res, next) : next()));
router.use(costGuard());

// `audioFile` is handed to the transcriber/ffmpeg as an input path. Constrain it
// to a non-traversal /uploads reference so a caller can't point transcription at
// an arbitrary server file (or a remote SSRF target).
function isSafeAudioRef(audioFile) {
  const s = String(audioFile || '');
  if (!s || s.includes('..') || s.includes('\0')) return false;
  const p = s.startsWith('/') ? s : `/${s}`;
  return p.startsWith('/uploads/');
}

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
  if (!isSafeAudioRef(audioFile)) {
    return sendError(res, 'Invalid audio file reference', 400);
  }
  const owned = await guardOwnership(req, res, videoId);
  if (!owned) return;

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
  if (!isSafeAudioRef(audioFile)) {
    return sendError(res, 'Invalid audio file reference', 400);
  }
  const owned = await guardOwnership(req, res, videoId);
  if (!owned) return;

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






