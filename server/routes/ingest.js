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
 * Dev mode: returns deterministic mock contentIds and stores blob metadata in the
 * shared dev video store so the editor can resolve them without Mongo.
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

const { uploadLimiter } = require('../middleware/enhancedRateLimiter');

const router = express.Router();

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
    const { url, title } = req.body || {};
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
    const filename = `ingest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`;
    const destPath = path.join(UPLOADS_DIR, filename);
    const fileUrl = `/uploads/videos/${filename}`;

    if (classified.kind === 'direct') {
      try {
        await streamDownload(url, destPath);
      } catch (e) {
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
        return res.status(502).json({ success: false, error: `Platform download failed: ${e.message}` });
      }
    } else {
      return res.status(400).json({
        success: false,
        error: 'URL is not a recognised video source. Try a direct .mp4/.mov/.webm link or a YouTube/TikTok/IG/Twitter URL.',
      });
    }

    const stats = await fs.promises.stat(destPath);
    const contentId = (devModeAllowed && (!userId || isDevUser(req.user)))
      ? `dev-content-${Date.now()}`
      : `ingest-${Date.now()}`;
    const record = {
      _id: contentId,
      title: title || `Ingest ${new Date().toISOString().slice(0, 10)}`,
      status: 'completed',
      type: 'video',
      userId: userId || 'dev-user',
      source: { kind: classified.kind, platform: classified.platform || null, originalUrl: url },
      originalFile: { url: fileUrl, filename, size: stats.size },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (devModeAllowed || !userId) {
      devVideoStore.set(contentId, record);
    } else {
      // For real users we'd persist to Mongo here. We mirror to devVideoStore
      // too so the editor can resolve immediately while the Content model
      // catches up async.
      devVideoStore.set(contentId, record);
      try {
        const Content = require('../models/Content');
        await Content.create({
          _id: undefined,
          userId,
          title: record.title,
          type: 'video',
          status: 'completed',
          originalFile: record.originalFile,
          metadata: { ingestSource: record.source },
        });
      } catch (e) {
        logger.warn('[ingest] Mongo persistence failed (kept in dev store):', e.message);
      }
    }

    return res.json({ success: true, data: { contentId, fileUrl, source: classified, size: stats.size } });
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

    const newId = `remix-${Date.now()}`;
    const remix = {
      ...original,
      _id: newId,
      title: `${original.title} (Remix)`,
      remixOf: contentId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    devVideoStore.set(newId, remix);
    return res.json({ success: true, data: { contentId: newId } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Remix failed' });
  }
});

// ── GET /api/ingest/recent ─────────────────────────────────────────────────
// Returns the most recent dev-store ingests so the IngestPanel can show
// "remix from previous project" without needing a separate Mongo round-trip.
router.get('/recent', auth, (req, res) => {
  try {
    const all = Array.from(devVideoStore.entries())
      .map(([id, v]) => ({ id, title: v.title, fileUrl: v.originalFile?.url, createdAt: v.createdAt }))
      .filter(v => v.fileUrl)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 12);
    return res.json({ success: true, data: all });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
