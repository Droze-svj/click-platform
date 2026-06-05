/**
 * Resumable video uploads via the tus protocol (@tus/server v1).
 *
 * Why: the plain multipart POST /api/video/upload restarts from zero if the
 * connection drops mid-transfer — painful for multi-GB videos on flaky mobile
 * networks. tus uploads in chunks and resumes from the last acknowledged offset.
 *
 * Integration notes:
 *  - Mounted in server/index.js via `app.all('/api/upload/tus{,/*}')` BEFORE the
 *    global express.json() so tus receives the raw chunk stream, and so req.url
 *    keeps its full path (a sub-router would strip the prefix and break tus's
 *    id parsing).
 *  - `auth` runs first so req.user is set for the completion hook.
 *  - On completion we create the Content doc + enqueue processing, mirroring
 *    routes/video.js. The whole hook is defensive: if anything fails the chunk
 *    data is still safely stored and the client can fall back to the classic
 *    upload — uploads never hard-fail because of this hook.
 */

const path = require('path');
const fs = require('fs');
const { Server } = require('@tus/server');
const { FileStore } = require('@tus/file-store');
const logger = require('../utils/logger');

const TUS_DIR = path.join(process.cwd(), 'uploads', 'temp', 'tus');
try { fs.mkdirSync(TUS_DIR, { recursive: true }); } catch { /* exists */ }

const ALLOWED_EXT = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.mpg', '.mpeg', '.3gp'];
const MAX_SIZE = parseInt(process.env.MAX_FILE_SIZE || '5368709120', 10); // 5GB

// How long a partial/abandoned upload stays resumable before it can be swept.
// This is the practical "resume window" — a user can close the tab and finish a
// big upload within this period. Defaults to 24h. The generic temp sweep skips
// the tus dir (see server/index.js) so only tus's own expiration governs it,
// which removes by per-upload age and never touches an active/recent upload.
const TUS_EXPIRY_MS = parseInt(process.env.TUS_EXPIRY_MS || '86400000', 10); // 24h

const tusServer = new Server({
  path: '/api/upload/tus',
  datastore: new FileStore({ directory: TUS_DIR, expirationPeriodInMilliseconds: TUS_EXPIRY_MS }),
  maxSize: MAX_SIZE,
  respectForwardedHeaders: true,

  // Reject obviously-wrong file types up front (best-effort: metadata.filename).
  async onUploadCreate(req, res, upload) {
    const fname = upload?.metadata?.filename || '';
    const ext = path.extname(fname).toLowerCase();
    if (fname && ext && !ALLOWED_EXT.includes(ext)) {
      throw { status_code: 415, body: `Unsupported file type: ${ext}` };
    }
    return res;
  },

  // On completion, register the Content + enqueue processing (mirrors video.js).
  async onUploadFinish(req, res, upload) {
    try {
      const userId = req.user?._id?.toString?.() || req.user?.id;
      if (!userId) {
        logger.warn('[tus] upload finished without an authenticated user; skipping Content creation', { id: upload?.id });
        return res;
      }
      const filePath = path.join(TUS_DIR, upload.id);
      const Content = require('../models/Content');
      const content = new Content({
        userId,
        type: 'video',
        originalFile: {
          url: `/uploads/temp/tus/${upload.id}`,
          filename: upload?.metadata?.filename || upload.id,
          size: upload?.size || 0,
          storageKey: `tus/${upload.id}`,
          storage: 'local',
        },
        title: upload?.metadata?.title || upload?.metadata?.filename || 'Uploaded Video',
        status: 'processing',
      });
      await content.save();

      try {
        const { addVideoProcessingJob } = require('../queues');
        await addVideoProcessingJob({
          contentId: content._id.toString(),
          videoPath: filePath,
          user: { _id: userId, email: req.user?.email, name: req.user?.name },
        });
      } catch (queueErr) {
        logger.warn('[tus] processing queue unavailable; content saved as processing', { error: queueErr.message });
      }

      // Surface the new contentId to the client (exposed CORS header below).
      try { res.setHeader('X-Content-Id', content._id.toString()); } catch { /* header set best-effort */ }
      logger.info('[tus] resumable upload finished', { contentId: content._id.toString(), userId });
    } catch (err) {
      logger.error('[tus] onUploadFinish failed (chunk data is safe; client can fall back)', { error: err.message });
    }
    return res;
  },
});

/**
 * Remove expired (abandoned) resumable uploads using tus's own per-upload
 * expiration. Unlike a blunt directory sweep this only deletes uploads whose
 * own age exceeds TUS_EXPIRY_MS, so active and recently-touched uploads — and
 * anything still inside the resume window — are preserved. Safe to call on a
 * timer; returns the number of uploads removed (0 if the store is empty or the
 * datastore doesn't support expiration).
 */
async function cleanupExpiredTusUploads() {
  try {
    if (typeof tusServer.cleanUpExpiredUploads !== 'function') return 0;
    const removed = await tusServer.cleanUpExpiredUploads();
    if (removed > 0) logger.info('[tus] swept expired resumable uploads', { removed });
    return removed || 0;
  } catch (err) {
    logger.warn('[tus] expired-upload sweep failed', { error: err.message });
    return 0;
  }
}

module.exports = { tusServer, TUS_DIR, cleanupExpiredTusUploads };
