// Video Caption Routes

const express = require('express');
const router = express.Router();

// AI cost/fan-out guard: translate-overlays fans out to per-segment LLM calls —
// rate-limit POST/PUT per user + attach the per-tier budget guard.
const { aiLimiter } = require('../../middleware/enhancedRateLimiter');
const { costGuard } = require('../../middleware/costGuard');
router.use((req, res, next) => (['POST', 'PUT'].includes(req.method) ? aiLimiter(req, res, next) : next()));
router.use(costGuard());

const { authenticate } = require('../../middleware/auth');
const { sendSuccess, sendError } = require('../../utils/response');
const videoCaptionService = require('../../services/videoCaptionService');
const Content = require('../../models/Content');
const { getUserIdFromReq } = require('../../utils/userId');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { toAbsolutePath } = require('../../utils/pathUtils');

// Configure multer for video uploads
const upload = multer({
  dest: 'uploads/videos/',
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed: ${allowedTypes.join(', ')}`));
    }
  },
});

/**
 * POST /api/video/captions/generate
 * Generate captions for a video content
 */
router.post('/generate', authenticate, upload.single('video'), async (req, res) => {
  try {
    const { contentId, language } = req.body;
    const userId = getUserIdFromReq(req); // canonical hex — matches stored Content.userId (flip-set)

    if (!contentId) {
      return sendError(res, 'Content ID is required', 400);
    }

    // Verify content belongs to user
    const content = await Content.findOne({ _id: contentId, userId });
    if (!content) {
      return sendError(res, 'Content not found', 404);
    }

    // Get video file path
    let videoFilePath;
    if (req.file) {
      videoFilePath = req.file.path;
    } else if (content.originalFile?.url) {
      // Use existing video file
      videoFilePath = toAbsolutePath(content.originalFile.url);
    } else {
      return sendError(res, 'Video file is required', 400);
    }

    // Generate captions in the source language (Whisper transcribes the
    // detected language). If the user's preferred language differs, we then
    // automatically run a per-segment translation so captions are usable
    // immediately in their chosen language without a second API trip.
    const result = await videoCaptionService.generateCaptionsForContent(
      contentId,
      videoFilePath,
      { language }
    );

    // Auto-translate to the user's preferred language when the source video
    // came back in a different language. Best-effort: a translation failure
    // never blocks the original caption generation succeeding.
    const userLang = (req.language || 'en').toLowerCase();
    let translated = null;
    if (result.language && userLang && result.language.toLowerCase() !== userLang) {
      try {
        translated = await videoCaptionService.ensureCaptionsInLanguage(contentId, userLang, 'srt');
      } catch (err) {
        logger.warn('[captions/generate] auto-translate failed', { error: err.message, userLang });
      }
    }

    // Clean up uploaded file if it was just uploaded
    if (req.file) {
      await fs.unlink(videoFilePath).catch(() => {});
    }

    return sendSuccess(res, { ...result, translated }, 'Captions generated successfully');
  } catch (error) {
    logger.error('Error generating captions', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * GET /api/video/captions/:contentId
 * Get captions for content
 */
router.get('/:contentId', authenticate, async (req, res) => {
  try {
    const { contentId } = req.params;
    const { format = 'srt' } = req.query;
    const userId = getUserIdFromReq(req); // canonical hex — matches stored Content.userId (flip-set)

    // Verify content belongs to user
    const content = await Content.findOne({ _id: contentId, userId });
    if (!content) {
      return sendError(res, 'Content not found', 404);
    }

    // Get captions
    const captions = await videoCaptionService.getCaptions(contentId, format);

    return sendSuccess(res, captions);
  } catch (error) {
    logger.error('Error getting captions', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * POST /api/video/captions/:contentId/translate
 * Translate captions to another language
 */
router.post('/:contentId/translate', authenticate, async (req, res) => {
  try {
    const { contentId } = req.params;
    const { targetLanguage } = req.body;
    const userId = getUserIdFromReq(req); // canonical hex — matches stored Content.userId (flip-set)

    if (!targetLanguage) {
      return sendError(res, 'Target language is required', 400);
    }

    // Verify content belongs to user
    const content = await Content.findOne({ _id: contentId, userId });
    if (!content) {
      return sendError(res, 'Content not found', 404);
    }

    if (!content.captions || !content.captions.text) {
      return sendError(res, 'Captions not found. Generate captions first.', 400);
    }

    // Translate captions
    const translatedText = await videoCaptionService.translateCaptions(
      content.captions.text,
      targetLanguage
    );

    // Update content with translated captions
    content.captions.translations = content.captions.translations || {};
    content.captions.translations[targetLanguage] = translatedText;
    await content.save();

    return sendSuccess(res, {
      originalLanguage: content.captions.language,
      targetLanguage,
      translatedText,
    }, 'Captions translated successfully');
  } catch (error) {
    logger.error('Error translating captions', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * GET /api/video/captions/:contentId/in-language
 * Returns captions in the requested language. If no `?language=xx` is
 * provided, falls back to the user's preferred language (req.language,
 * populated by middleware/language.js from X-Click-Language / Accept-Language).
 *
 * Idempotent: if captions are already in the target language, returns the
 * source. If a translation is cached, returns it. Otherwise generates the
 * translation on-the-fly (per-segment, preserving timing) and persists it
 * for future requests. This is what the user means by "translations work
 * even at video caption" — front-end never has to know whether to call the
 * generate-then-translate flow; it just asks for captions in its language.
 */
router.get('/:contentId/in-language', authenticate, async (req, res) => {
  try {
    const { contentId } = req.params;
    const userId = getUserIdFromReq(req); // canonical hex — matches stored Content.userId (flip-set)
    const requested = (req.query.language || req.language || 'en').toString().toLowerCase();
    const format = (req.query.format || 'srt').toString();

    // Ownership gate so a user can't pull captions for someone else's video.
    const content = await Content.findOne({ _id: contentId, userId }).select('_id');
    if (!content) return sendError(res, 'Content not found', 404);

    const result = await videoCaptionService.ensureCaptionsInLanguage(contentId, requested, format);
    return sendSuccess(res, {
      contentId,
      requestedLanguage: requested,
      ...result,
    }, result.cached ? 'Captions returned from cache' : 'Captions translated and cached');
  } catch (error) {
    logger.error('Error fetching captions in language', { error: error.message, contentId: req.params.contentId });
    return sendError(res, error.message, 500);
  }
});

/**
 * POST /api/video/captions/translate-overlays
 * Translate an arbitrary array of text overlays in a single timing-safe batch call
 */
router.post('/translate-overlays', authenticate, async (req, res) => {
  try {
    const { overlays, targetLanguage } = req.body;

    if (!Array.isArray(overlays) || !targetLanguage) {
      return sendError(res, 'overlays (array) and targetLanguage are required', 400);
    }

    if (overlays.length === 0) {
      return sendSuccess(res, [], 'Empty overlays array');
    }

    // Bound the fan-out: an unbounded overlays array drives thousands of
    // sequential translation calls. Cap at a sane caption count.
    if (overlays.length > 200) {
      return sendError(res, 'Too many overlays (max 200 per request)', 400);
    }

    // Map overlays to standard segments { text }
    const segments = overlays.map(o => ({ text: o.text || '' }));

    // Perform timing-safe batch translation
    const translatedSegments = await videoCaptionService.translateSegments(
      segments,
      targetLanguage
    );

    // Map translated text back to overlays, preserving styling, IDs, and timing
    const result = overlays.map((o, idx) => ({
      ...o,
      text: translatedSegments[idx]?.text || o.text
    }));

    return sendSuccess(res, result, 'Overlays translated successfully');
  } catch (error) {
    logger.error('Error translating overlays', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

const logger = require('../../utils/logger');

module.exports = router;
