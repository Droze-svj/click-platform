// Voice Memo → Script route
// POST /api/memo-script/transcribe — upload a short voice memo, get the transcript back.
// POST /api/memo-script            — turn a memo transcript (or typed raw thoughts)
//                                    into a # Hook / # Body / # CTA script + QA report.
// Transcription is a separate step on purpose: the creator reviews/edits the
// transcript before any script tokens are spent, and a failed script call never
// re-pays for transcription.

const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const validator = require('validator');
const router = express.Router();
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { aiLimiter } = require('../middleware/enhancedRateLimiter');
const { costGuard } = require('../middleware/costGuard');
const { capForPrompt } = require('../utils/promptSafe');
const logger = require('../utils/logger');
const googleAI = require('../utils/googleAI');
const personalizationService = require('../services/personalizationService');
const {
  generateMemoScript, normalizeFormat, shapeScript, toScriptDoc, MAX_MEMO_CHARS,
} = require('../services/memoScriptService');

// Whisper's upload cap is 25MB; a 2-minute memo is ~1-4MB in any browser codec.
const MAX_MEMO_BYTES = 25 * 1024 * 1024;
// Whisper picks the decoder from the file extension, so the temp file must keep
// one. Keyed by mimetype (codec params stripped) — only these are accepted.
const AUDIO_EXT_BY_MIME = {
  'audio/webm': '.webm',
  'audio/ogg': '.ogg',
  'audio/mp4': '.m4a',
  'audio/m4a': '.m4a',
  'audio/x-m4a': '.m4a',
  'audio/aac': '.m4a',
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/wave': '.wav',
  'audio/flac': '.flac',
};
const baseMime = (m) => String(m || '').split(';')[0].trim().toLowerCase();

const MEMO_TMP_DIR = path.join(os.tmpdir(), 'click-memos');

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdir(MEMO_TMP_DIR, { recursive: true }, (err) => cb(err, MEMO_TMP_DIR));
    },
    filename: (req, file, cb) => {
      cb(null, `memo-${crypto.randomUUID()}${AUDIO_EXT_BY_MIME[baseMime(file.mimetype)]}`);
    },
  }),
  limits: { fileSize: MAX_MEMO_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (AUDIO_EXT_BY_MIME[baseMime(file.mimetype)]) return cb(null, true);
    const e = new Error('Unsupported audio type. Upload webm, ogg, m4a, mp3, wav or flac.');
    e.statusCode = 400;
    return cb(e);
  },
});

// multer reports bad type/size via next(err) → turn those into 400s, not 500s.
function receiveMemo(req, res, next) {
  upload.single('audio')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Memo is too large (max 25MB).' : err.message;
      return sendError(res, msg, 400);
    }
    return sendError(res, err.message, err.statusCode || 400);
  });
}

/**
 * POST /api/memo-script/transcribe
 * multipart: audio (file), language? (ISO-639-1, default auto-detect)
 */
router.post('/transcribe', auth, aiLimiter, receiveMemo, asyncHandler(async (req, res) => {
  const file = req.file;
  try {
    if (!file) return sendError(res, 'audio file is required', 400);
    if (!process.env.OPENAI_API_KEY) {
      return sendError(res, 'Transcription is not configured on this server. Type your raw thoughts instead.', 503);
    }
    const lang = typeof req.body?.language === 'string' && /^[a-z]{2}$/i.test(req.body.language)
      ? req.body.language.toLowerCase()
      : 'auto';
    const { generateTranscriptFromAudio } = require('../services/whisperService');
    const transcript = await generateTranscriptFromAudio(file.path, { responseFormat: 'json', language: lang });
    const text = typeof transcript === 'string' ? transcript.trim() : '';
    if (!text) return sendError(res, 'Could not transcribe that memo. Try again or type your raw thoughts.', 502);
    return sendSuccess(res, 'Memo transcribed', 200, { transcript: text.slice(0, MAX_MEMO_CHARS) });
  } finally {
    if (file && file.path) {
      fs.promises.unlink(file.path).catch((err) => {
        logger.warn('[memo-script] failed to remove temp memo', { path: file.path, error: err.message });
      });
    }
  }
}));

/**
 * POST /api/memo-script
 * Body: { memo, platform?, format?: 'short' | 'long' }
 */
router.post('/', auth, aiLimiter, costGuard(), asyncHandler(async (req, res) => {
  const body = req.body || {};
  // The global sanitizer HTML-escapes body strings; this text only feeds the
  // prompt (never rendered server-side), so restore apostrophes/quotes first or
  // the model echoes "&#x27;" back into the script.
  const memo = typeof body.memo === 'string' ? validator.unescape(body.memo) : '';
  if (!memo.trim()) return sendError(res, 'Provide your memo transcript or raw thoughts', 400);
  const platform = body.platform ? String(body.platform) : 'tiktok';
  const format = normalizeFormat(body.format);

  const deps = {
    sanitize: capForPrompt,
    generate: (prompt, opts) => googleAI.generateContent(prompt, opts),
    assertBudget: (args) => req.assertBudget(args),
    recordUsage: (args) => req.recordAiUsage(args),
    buildSystemPrompt: (args) => personalizationService.buildPersonalizedSystemPrompt(args),
    getBannedWords: async (userId) => (await personalizationService.getPersona(userId, { platform })).voice.banned,
  };

  let result;
  try {
    result = await generateMemoScript({ memo, platform, format, userId: req.user._id }, deps);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
  if (!result) {
    return sendError(res, 'Script writing is temporarily unavailable. Your memo was not lost; try again shortly.', 503);
  }
  return sendSuccess(res, 'Script written', 200, result);
}));

// Unescape (see the note on POST /) and bound a client-sent script before it is
// stored: strings capped, arrays capped, anything else dropped.
function cleanScriptInput(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const str = (v) => (typeof v === 'string' ? validator.unescape(v).slice(0, 2000) : '');
  const list = (v) => (Array.isArray(v) ? v.slice(0, 30).map(str) : []);
  return {
    title: str(raw.title).slice(0, 200),
    hook: str(raw.hook),
    body: list(raw.body),
    cta: str(raw.cta),
    brollCues: list(raw.brollCues),
    claims: list(raw.claims),
  };
}

/**
 * POST /api/memo-script/save
 * Body: { script: { title, hook, body[], cta, brollCues[], claims[] }, format?, requestApproval? }
 * Saves the script to the Scripts library and, when requestApproval is true,
 * opens a sign-off in Approvals (approver = the creator).
 */
router.post('/save', auth, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const script = shapeScript(JSON.stringify(cleanScriptInput(body.script)));
  if (!script) return sendError(res, 'Provide a script with a hook, body and CTA', 400);

  const Script = require('../models/Script');
  const doc = await Script.create(toScriptDoc(script, { format: body.format, userId: req.user._id }));

  if (body.requestApproval !== true) {
    return sendSuccess(res, 'Script saved', 201, { scriptId: doc._id, approvalId: null });
  }
  try {
    const { createApprovalRequest } = require('../services/approvalService');
    const approval = await createApprovalRequest({
      entityType: 'script',
      entityId: doc._id,
      requestedBy: req.user._id,
      requestedFrom: req.user._id,
      message: `Script: ${script.title}`.slice(0, 500),
    });
    return sendSuccess(res, 'Script saved and sent for approval', 201, { scriptId: doc._id, approvalId: approval._id });
  } catch (err) {
    // The script is saved; say plainly that only the approval step failed.
    logger.warn('[memo-script] approval request failed', { scriptId: doc._id, error: err.message });
    return sendSuccess(res, 'Script saved, but the approval request failed', 201, {
      scriptId: doc._id, approvalId: null, approvalError: 'Could not create the approval request. Try again from Approvals.',
    });
  }
}));

module.exports = router;
