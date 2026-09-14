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
const captionStore = require('../../services/captionStore');
const Content = require('../../models/Content');
const { getUserIdFromReq } = require('../../utils/userId');
// A malformed :contentId used to flow straight into Content.findOne, throw a
// CastError, and surface as a 500 — a caller's typo reported as a server fault.
// This answers 400 instead, and lets dev-mode ids ('dev-…') through.
const { validateObjectId } = require('../../middleware/validateObjectId');
const mongoose = require('mongoose');
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
    // Same guard as the :contentId routes, for the id that arrives in the body.
    if (!String(contentId).startsWith('dev-') && !mongoose.Types.ObjectId.isValid(String(contentId))) {
      return sendError(res, 'Invalid contentId', 400);
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
    // userId is passed so the service can default the caption STYLE to the one
    // this creator actually keeps choosing. It was resolved above for the
    // ownership check and then thrown away, which is why burned-in captions
    // ignored every style preference the profile had learned.
    const result = await videoCaptionService.generateCaptionsForContent(
      contentId,
      videoFilePath,
      { language, userId }
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
router.get('/:contentId', authenticate, validateObjectId('contentId'), async (req, res) => {
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
    // "Captions not generated yet" is a normal not-found state (the video simply
    // hasn't been captioned), not a server error — surface it as 404.
    const notReady = /not generated|no captions|have not been generated|not found/i.test(error.message || '');
    return sendError(res, error.message, notReady ? 404 : 500);
  }
});

/**
 * PUT /api/video/captions/:contentId
 * Persist hand-edited caption segments.
 *
 * VideoCaptionEditor (mounted on /dashboard/content/[id]) has always sent this
 * request when the user hits Save, but no PUT handler existed — every save 404'd
 * and the edits were silently lost. The source comment there even flagged the
 * uncertainty ("If your server uses a different verb/path, adjust here").
 */
router.put('/:contentId', authenticate, validateObjectId('contentId'), async (req, res) => {
  try {
    const { contentId } = req.params;
    const { segments, language } = req.body;
    const userId = getUserIdFromReq(req); // canonical hex — matches stored Content.userId

    if (!Array.isArray(segments) || segments.length === 0) {
      return sendError(res, 'segments must be a non-empty array', 400);
    }
    // Reject malformed timings rather than persisting captions that cannot render.
    const bad = segments.findIndex(
      (seg) => !seg || typeof seg.text !== 'string'
        || !Number.isFinite(Number(seg.start)) || !Number.isFinite(Number(seg.end))
        || Number(seg.end) < Number(seg.start)
    );
    if (bad !== -1) {
      return sendError(res, `segments[${bad}] needs a text string and numeric start/end with end >= start`, 400);
    }

    // Ownership scope, same as the GET handler — never a bare findById.
    const content = await Content.findOne({ _id: contentId, userId });
    if (!content) {
      return sendError(res, 'Content not found', 404);
    }

    const existing = await captionStore.getSource(contentId, { content });
    const lang = language || existing?.language || 'en';
    const format = existing?.format || 'srt';

    const normalized = segments.map((seg) => ({
      ...seg,
      start: Number(seg.start),
      end: Number(seg.end),
      text: seg.text,
    }));
    const text = normalized.map((seg) => seg.text).join(' ').trim();
    const formatted = videoCaptionService.formatCaptions({ text, segments: normalized }, format);

    // Word timings are ABSOLUTE — they record when each word was spoken, which an
    // edit to segment text or boundaries does not change. The previous rule
    // ("keep them only if the segment COUNT is unchanged") wiped the entire array
    // whenever a user split or merged a single caption, silently downgrading
    // karaoke to static blocks with no way back short of re-transcribing.
    const { realignWordsToSegments } = require('../../utils/subtitleUtils');

    await captionStore.saveSource(contentId, {
      language: lang,
      text,
      format,
      segments: normalized,
      words: realignWordsToSegments(existing?.words, normalized),
      formatted,
    });

    // Same shape the GET returns, which is what the editor re-renders from.
    return sendSuccess(res, {
      text,
      language: lang,
      format,
      captions: formatted,
      segments: normalized,
    });
  } catch (error) {
    logger.error('Error saving captions', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * POST /api/video/captions/:contentId/translate
 * Translate captions to another language
 */
router.post('/:contentId/translate', authenticate, validateObjectId('contentId'), async (req, res) => {
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
router.get('/:contentId/in-language', authenticate, validateObjectId('contentId'), async (req, res) => {
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
    // Base captions not generated yet = a normal not-found state, not a 5xx.
    const notReady = /not generated|no captions|have not been generated|not found/i.test(error.message || '');
    return sendError(res, error.message, notReady ? 404 : 500);
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

    // Be honest when AI translation isn't available. translateSegments returns
    // the SOURCE text unchanged if Gemini isn't configured; surfacing that as a
    // success made the UI claim "Translated!" while the captions were untouched.
    const { isConfigured } = require('../../utils/googleAI');
    if (!isConfigured) {
      return sendError(res, 'AI translation is not configured on this server (set GOOGLE_AI_API_KEY). Your captions were left unchanged.', 503);
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

    // If nothing actually changed, the model returned the original text — tell the
    // truth rather than a false success.
    const changed = result.reduce((n, r, i) => n + (r.text !== (overlays[i].text || '') ? 1 : 0), 0);
    if (changed === 0) {
      return sendError(res, `Translation to ${targetLanguage} produced no changes — the captions were left unchanged.`, 502);
    }

    return sendSuccess(res, result, `Translated ${changed} caption${changed === 1 ? '' : 's'} to ${targetLanguage}`);
  } catch (error) {
    logger.error('Error translating overlays', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

const logger = require('../../utils/logger');

module.exports = router;
