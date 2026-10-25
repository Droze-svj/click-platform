/**
 * Ingest routes — bring video into Click from non-file sources.
 *
 * Endpoints
 *   POST /api/ingest/url        Pull a remote video by URL (direct mp4/mov/webm or
 *                               platform link via yt-dlp when installed).
 *   POST /api/ingest/clipboard  Same payload shape as /url but triggered by paste
 *                               from clipboard. Kept separate for telemetry only.
 *   POST /api/ingest/remix      Clone an existing project (by contentId) into a
 *                               fresh content record so the user can start a new
 *                               edit without touching the original.
 *
 * Real users get a saved Content document (its _id is the contentId the editor
 * opens). Dev sessions without a Mongo user use the in-memory dev store
 * (`dev-content-*` ids, which resolveContent knows).
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');
const { devVideoStore } = require('../utils/devStore');
const { isDevUser, allowDevMode: checkAllowDevMode } = require('../utils/devUser');
// classifyUrl + streamDownload live in utils/downloadUtils (single source of
// truth — this route used to carry a byte-identical copy). streamDownload is
// SSRF-guarded per redirect hop via utils/urlGuard.
const { classifyUrl, streamDownload } = require('../utils/downloadUtils');
const urlGuard = require('../utils/urlGuard');
const validator = require('validator');

const { uploadLimiter } = require('../middleware/enhancedRateLimiter');

const router = express.Router();
const mongoose = require('mongoose');

const RECENT_LIMIT = 12;
// Fields a remix must not inherit from the original: identity, timestamps,
// engagement/analytics, sharing and processing state.
const REMIX_EXCLUDED_FIELDS = ['_id', 'id', '__v', 'createdAt', 'updatedAt', 'analytics', 'abTest', 'sharedWith', 'isPublic', 'isTemplate', 'pipeline', 'syncVersion', 'errorMessage'];

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'videos');
try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch { /* dir exists */ }

// In-process cap on simultaneous ingest jobs. Each /url or /clipboard request
// can stream up to 500MB or spawn a yt-dlp transcode, so without this an authed
// user firing many concurrent requests exhausts disk + process slots. The
// per-user uploadLimiter throttles request RATE; this bounds CONCURRENCY.
const MAX_CONCURRENT_INGEST = parseInt(process.env.MAX_CONCURRENT_INGEST || '4', 10);
let activeIngest = 0;
function ingestConcurrencyGate(req, res, next) {
  if (activeIngest >= MAX_CONCURRENT_INGEST) {
    return res.status(429).json({ success: false, error: 'Server is busy ingesting media; please retry shortly.' });
  }
  activeIngest += 1;
  let released = false;
  const release = () => { if (!released) { released = true; activeIngest = Math.max(0, activeIngest - 1); } };
  res.on('finish', release);
  res.on('close', release);
  next();
}

// ── Helpers ────────────────────────────────────────────────────────────────
// classifyUrl + streamDownload are imported from utils/downloadUtils (above).
// The yt-dlp helpers below stay local: ingest shells out to the system `yt-dlp`
// binary directly, which is a deliberately different strategy from
// downloadUtils' optional yt-dlp-wrap path.

function ytDlpAvailable() {
  return new Promise((resolve) => {
    execFile('yt-dlp', ['--version'], { timeout: 4_000 }, (err) => resolve(!err));
  });
}

function ytDlpDownload(url, destPath) {
  return new Promise((resolve, reject) => {
    // Limit to <= 1080p so we don't pull 4K masters from creators' channels.
    const args = [
      '-f', 'bv*[height<=1080]+ba/b[height<=1080]',
      '--merge-output-format', 'mp4',
      '--max-filesize', '500M',
      '--no-playlist',
      '-o', destPath,
      url,
    ];
    execFile('yt-dlp', args, { timeout: 180_000 }, (err, _stdout, stderr) => {
      if (err) return reject(new Error(stderr?.split('\n')?.find(Boolean) || err.message));
      try { resolve({ bytes: fs.statSync(destPath).size }); } catch (e) { reject(e); }
    });
  });
}

// ── POST /api/ingest/url ───────────────────────────────────────────────────
async function ingestUrlHandler(req, res) {
  try {
    // The input sanitizer HTML-escapes body strings (`/` → `&#x2F;`), which
    // turned every pasted link into `https:&#x2F;&#x2F;…` and failed
    // classification. Undo it: the URL goes to the SSRF guard and a download,
    // the title is stored and rendered by React — neither is an HTML sink.
    const body = req.body || {};
    const url = typeof body.url === 'string' ? validator.unescape(body.url).trim() : body.url;
    const title = typeof body.title === 'string' ? validator.unescape(body.title) : body.title;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing url' });
    }

    const classified = classifyUrl(url);
    if (classified.kind === 'invalid') {
      return res.status(400).json({ success: false, error: 'Invalid URL' });
    }

    // SSRF guard on the user-supplied entry URL (covers both the direct-download
    // and yt-dlp paths). streamDownload additionally re-validates each redirect
    // hop; yt-dlp's internal redirects are outside our control, so guarding the
    // entry URL is the meaningful check for the platform path.
    try {
      await urlGuard.assertPublicUrl(url);
    } catch (e) {
      return res.status(400).json({ success: false, error: e.message || 'Blocked URL' });
    }

    const userId = req.user?._id || req.user?.id;
    const devModeAllowed = checkAllowDevMode(req);
    const filename = require('../utils/mediaName').randomMediaName('.mp4'); // crypto-random, unguessable
    const destPath = path.join(UPLOADS_DIR, filename);
    const fileUrl = `/uploads/videos/${filename}`;

    if (classified.kind === 'direct') {
      try {
        await streamDownload(url, destPath);
      } catch (e) {
        // Remove the partial .mp4 so a failed download doesn't leak onto the
        // (ephemeral) disk and accumulate over time.
        try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath); } catch (_) { /* best effort */ }
        return res.status(502).json({ success: false, error: `Direct download failed: ${e.message}` });
      }
    } else if (classified.kind === 'platform') {
      const have = await ytDlpAvailable();
      if (!have) {
        return res.status(501).json({
          success: false,
          error: 'Platform downloads require yt-dlp. Install it on the server (`brew install yt-dlp` / `pip install yt-dlp`) or upload the file directly.',
          fallback: 'file-upload',
          platform: classified.platform,
        });
      }
      try {
        await ytDlpDownload(url, destPath);
      } catch (e) {
        // Remove any partial download so a failed platform ingest doesn't leak.
        try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath); } catch (_) { /* best effort */ }
        return res.status(502).json({ success: false, error: `Platform download failed: ${e.message}` });
      }
    } else {
      return res.status(400).json({
        success: false,
        error: 'URL is not a recognised video source. Try a direct .mp4/.mov/.webm link or a YouTube/TikTok/IG/Twitter URL.',
      });
    }

    const stats = await fs.promises.stat(destPath);
    const recordTitle = (typeof title === 'string' && title.trim()) || `Ingest ${new Date().toISOString().slice(0, 10)}`;
    const source = { kind: classified.kind, platform: classified.platform || null, originalUrl: url };
    const originalFile = { url: fileUrl, filename, size: stats.size };

    // Dev sessions (no Mongo user) live in the in-memory dev store; ids must
    // start with "dev-" for resolveContent to find them.
    if (!userId || (devModeAllowed && isDevUser(req.user))) {
      const contentId = `dev-content-${Date.now()}`;
      devVideoStore.set(contentId, {
        _id: contentId,
        title: recordTitle,
        status: 'completed',
        type: 'video',
        userId: userId ? String(userId) : 'dev-user',
        source,
        originalFile,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return res.json({ success: true, data: { contentId, fileUrl, source: classified, size: stats.size } });
    }

    // Real users: the editor loads the project from Mongo by its _id. This
    // used to answer a made-up `ingest-<timestamp>` id (kept only in the
    // in-memory dev store), discard Content.create's _id and swallow its
    // errors, so the editor opened on a project that could not be loaded.
    let saved;
    try {
      const Content = require('../models/Content');
      saved = await Content.create({
        userId: String(userId),
        title: recordTitle,
        type: 'video',
        status: 'completed',
        originalFile,
        metadata: { ingestSource: source },
      });
    } catch (e) {
      logger.error('[ingest] could not save the imported video', { error: e.message, userId: String(userId) });
      try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath); } catch (_) { /* best effort */ }
      return res.status(500).json({ success: false, error: 'The video downloaded but could not be saved. Please try again.' });
    }

    return res.json({ success: true, data: { contentId: String(saved._id), fileUrl, source: classified, size: stats.size } });
  } catch (err) {
    logger.error('[ingest/url] failed:', err);
    return res.status(500).json({ success: false, error: err.message || 'Ingest failed' });
  }
}

router.post('/url', auth, uploadLimiter, ingestConcurrencyGate, ingestUrlHandler);

// ── POST /api/ingest/clipboard ─────────────────────────────────────────────
// Same shape as /url; kept as a separate route so we can attach paste-only
// rate limits or audit logs later without forking the handler.
router.post('/clipboard', auth, uploadLimiter, ingestConcurrencyGate, ingestUrlHandler);

// ── POST /api/ingest/remix ─────────────────────────────────────────────────
router.post('/remix', auth, async (req, res) => {
  try {
    const { contentId } = req.body || {};
    // Ownership gate — without this any authed user can clone any other
    // user's content if they know its id (IDOR). guardOwnership handles 400
    // / 404 / 403 itself and returns the resolved content on success.
    const { guardOwnership } = require('../utils/ownership');
    const original = await guardOwnership(req, res, contentId);
    if (!original) return;

    // Dev-store originals stay in the dev store (ids must start with "dev-"
    // to resolve). The old `remix-<ts>` id lived only there, so for every
    // real user the editor opened a remix that could not be loaded.
    if (String(contentId).startsWith('dev-')) {
      const newId = `dev-content-remix-${Date.now()}`;
      devVideoStore.set(newId, {
        ...original,
        _id: newId,
        title: `${original.title || 'Untitled'} (Remix)`,
        remixOf: contentId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return res.json({ success: true, data: { contentId: newId } });
    }

    // Mongo content: save the copy as a new Content owned by the caller.
    const src = typeof original.toObject === 'function' ? original.toObject() : { ...original };
    for (const key of REMIX_EXCLUDED_FIELDS) delete src[key];
    const Content = require('../models/Content');
    let saved;
    try {
      saved = await Content.create({
        ...src,
        userId: String(req.user._id || req.user.id),
        title: `${src.title || 'Untitled'} (Remix)`,
        isFavorite: false,
        isArchived: false,
        metadata: { ...(src.metadata || {}), remixOf: String(contentId) },
      });
    } catch (e) {
      logger.error('[ingest/remix] could not save the remix', { error: e.message, contentId: String(contentId) });
      return res.status(500).json({ success: false, error: 'Could not create the remix. Please try again.' });
    }
    return res.json({ success: true, data: { contentId: String(saved._id) } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Remix failed' });
  }
});

// ── GET /api/ingest/recent ─────────────────────────────────────────────────
// The caller's most recent videos, for "remix from a previous project".
// SECURITY: this used to list every entry in the shared dev store — every
// user's imports, titles and file URLs. It is now scoped to req.user.
router.get('/recent', auth, async (req, res) => {
  try {
    const uid = String(req.user?._id || req.user?.id || '');
    const devItems = Array.from(devVideoStore.entries())
      .filter(([, v]) => v && String(v.userId) === uid)
      .map(([id, v]) => ({ id, title: v.title, fileUrl: v.originalFile?.url, createdAt: v.createdAt }));

    let mongoItems = [];
    if (mongoose.Types.ObjectId.isValid(uid)) {
      const Content = require('../models/Content');
      const docs = await Content.find({ userId: uid, type: 'video', 'originalFile.url': { $exists: true, $nin: [null, ''] } })
        .sort({ createdAt: -1 })
        .limit(RECENT_LIMIT)
        .select('title originalFile.url createdAt')
        .lean();
      mongoItems = docs.map((d) => ({
        id: String(d._id),
        title: d.title,
        fileUrl: d.originalFile?.url,
        createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
      }));
    }

    const all = devItems.concat(mongoItems)
      .filter(v => v.fileUrl)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, RECENT_LIMIT);
    return res.json({ success: true, data: all });
  } catch (err) {
    logger.error('[ingest/recent] failed', { error: err.message });
    return res.status(500).json({ success: false, error: 'Could not load your recent videos' });
  }
});

module.exports = router;
