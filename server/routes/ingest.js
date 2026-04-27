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
const https = require('https');
const http = require('http');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');
const { devVideoStore } = require('../utils/devStore');
const { isDevUser, allowDevMode: checkAllowDevMode } = require('../utils/devUser');

const router = express.Router();

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'videos');
try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch { /* dir exists */ }

// ── Helpers ────────────────────────────────────────────────────────────────

const PLATFORM_PATTERNS = [
  { name: 'youtube',   re: /(?:youtube\.com|youtu\.be)/i },
  { name: 'tiktok',    re: /tiktok\.com/i },
  { name: 'instagram', re: /instagram\.com/i },
  { name: 'twitter',   re: /(?:twitter\.com|x\.com)/i },
  { name: 'facebook',  re: /facebook\.com/i },
  { name: 'vimeo',     re: /vimeo\.com/i },
];

const DIRECT_VIDEO_EXTS = ['.mp4', '.mov', '.webm', '.m4v', '.mkv'];

function classifyUrl(rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch { return { kind: 'invalid' }; }
  if (!/^https?:$/.test(u.protocol)) return { kind: 'invalid' };

  const ext = path.extname(u.pathname).toLowerCase();
  if (DIRECT_VIDEO_EXTS.includes(ext)) return { kind: 'direct', ext };

  for (const p of PLATFORM_PATTERNS) {
    if (p.re.test(u.host)) return { kind: 'platform', platform: p.name };
  }
  return { kind: 'unknown' };
}

function streamDownload(url, destPath, { maxBytes = 500 * 1024 * 1024, redirects = 3 } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => { try { fs.unlinkSync(destPath); } catch { /* file already gone */ } };
    const fail = (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };
    const succeed = (val) => {
      if (settled) return;
      settled = true;
      resolve(val);
    };

    const get = (currentUrl, hopsLeft) => {
      const lib = currentUrl.startsWith('https:') ? https : http;
      const request = lib.get(currentUrl, (res) => {
        // Follow redirects
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && hopsLeft > 0) {
          res.resume();
          const next = new URL(res.headers.location, currentUrl).toString();
          return get(next, hopsLeft - 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return fail(new Error(`Source returned HTTP ${res.statusCode}`));
        }
        const ct = (res.headers['content-type'] || '').toLowerCase();
        if (ct && !ct.startsWith('video/') && !ct.startsWith('application/octet-stream')) {
          res.resume();
          return fail(new Error(`Source is not a video (content-type: ${ct})`));
        }
        const cl = parseInt(res.headers['content-length'] || '0', 10);
        if (cl && cl > maxBytes) {
          res.resume();
          return fail(new Error(`File exceeds ${Math.round(maxBytes / 1024 / 1024)}MB cap`));
        }
        let received = 0;
        const file = fs.createWriteStream(destPath);
        res.on('data', (chunk) => {
          received += chunk.length;
          if (received > maxBytes) {
            res.destroy();
            file.destroy();
            return fail(new Error(`Stream exceeded ${Math.round(maxBytes / 1024 / 1024)}MB cap`));
          }
        });
        res.on('error', fail);
        res.pipe(file);
        file.on('finish', () => file.close(() => succeed({ bytes: received })));
        file.on('error', fail);
      });
      request.on('error', fail);
      request.setTimeout(45_000, () => {
        // setTimeout's callback fires BEFORE 'error' — make sure we both kill
        // the request and clean up any partial file the response may have written.
        request.destroy(new Error('Download timed out'));
      });
    };
    get(url, redirects);
  });
}

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

    const stats = fs.statSync(destPath);
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

router.post('/url', auth, ingestUrlHandler);

// ── POST /api/ingest/clipboard ─────────────────────────────────────────────
// Same shape as /url; kept as a separate route so we can attach paste-only
// rate limits or audit logs later without forking the handler.
router.post('/clipboard', auth, ingestUrlHandler);

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
