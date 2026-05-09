/**
 * POST /api/video/render — Server-side Remotion export.
 *
 * Consumes the canonical RenderTree (defined in
 * client/lib/render/overlaySchema.ts) and produces an MP4. The composition
 * file at remotion/ClickComposition.tsx is the same source of truth as the
 * live editor preview, so every overlay, filter, and animation that renders
 * in the browser is baked into the export.
 *
 * Render is run as a BullMQ job (so the API returns immediately and the UI
 * polls progress over SSE / Socket.io). The route returns `{ jobId }`.
 *
 * @remotion/bundler and @remotion/renderer are loaded LAZILY so the server
 * still boots if they're not installed — the route then returns 501 with a
 * clear "install @remotion/renderer" hint.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const auth = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const c2paService = require('../../services/c2paService');

const router = express.Router();

const COMPOSITION_BY_RATIO = {
  '16:9': 'Click_16x9',
  '9:16': 'Click_9x16',
  '1:1': 'Click_1x1',
  '4:5': 'Click_4x5',
};

const FPS = 30;

function tryRequireRemotion() {
  try {
    const bundler = require('@remotion/bundler');
    const renderer = require('@remotion/renderer');
    return { bundler, renderer, available: true };
  } catch (err) {
    return { available: false, error: err };
  }
}

function validateRenderTree(tree) {
  if (!tree || typeof tree !== 'object') return 'tree is required';
  if (typeof tree.duration !== 'number' || tree.duration <= 0) {
    return 'tree.duration must be a positive number';
  }
  if (tree.duration > 60 * 30) {
    return 'tree.duration cannot exceed 30 minutes per render';
  }
  if (!tree.videoUrl || typeof tree.videoUrl !== 'string') {
    return 'tree.videoUrl is required';
  }
  if (!tree.filters || typeof tree.filters !== 'object') {
    return 'tree.filters is required';
  }
  return null;
}

const RENDER_OUTPUT_DIR = path.resolve(
  process.env.RENDER_OUTPUT_DIR || path.join(process.cwd(), 'uploads', 'renders')
);

function ensureRenderDir() {
  try {
    fs.mkdirSync(RENDER_OUTPUT_DIR, { recursive: true });
  } catch (err) {
    logger.warn('[render] could not create output dir', { dir: RENDER_OUTPUT_DIR, error: err.message });
  }
}

let bundleCachePromise = null;
async function getBundleLocation(bundler) {
  if (bundleCachePromise) return bundleCachePromise;
  bundleCachePromise = (async () => {
    const entryPoint = path.resolve(process.cwd(), 'remotion', 'Root.tsx');
    return bundler.bundle({
      entryPoint,
      // Webpack overrides are minimal — the editor utilities are pure
      // TypeScript and don't reach for browser-only globals.
      webpackOverride: (config) => config,
    });
  })();
  return bundleCachePromise;
}

/**
 * Run a single render synchronously. Blocks the request — used for short clips
 * (<= 30s) or as a fallback when BullMQ is unavailable. For long renders the
 * worker variant queues to videoRenderQueue and emits SSE updates.
 */
async function runRender({ tree, ratio, jobId, userId }) {
  const remotion = tryRequireRemotion();
  if (!remotion.available) {
    const err = new Error(
      'Remotion not installed on this server. Run `npm install @remotion/bundler @remotion/renderer` to enable exports.'
    );
    err.statusCode = 501;
    throw err;
  }
  const { bundler, renderer } = remotion;

  ensureRenderDir();
  const outputPath = path.join(RENDER_OUTPUT_DIR, `${jobId}.mp4`);
  const compositionId = COMPOSITION_BY_RATIO[ratio] || 'ClickComposition';

  logger.info('[render] start', { jobId, userId, ratio, compositionId });

  const bundleLocation = await getBundleLocation(bundler);
  const inputProps = { tree };
  const composition = await renderer.selectComposition({
    serveUrl: bundleLocation,
    id: compositionId,
    inputProps,
  });

  await renderer.renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps,
    fps: FPS,
    onProgress: ({ progress }) => {
      // Hook into your SSE / Socket.io broadcaster here.
      logger.debug('[render] progress', { jobId, progress });
    },
  });

  // SHA-256 the unsigned output, then attempt to inject a C2PA manifest.
  // Signing is best-effort; if c2patool / c2pa-node isn't installed we still
  // return the (unsigned) MP4 with a warning rather than failing the render.
  const unsignedBuf = fs.readFileSync(outputPath);
  const unsignedSha = crypto.createHash('sha256').update(unsignedBuf).digest('hex');
  const unsignedSize = unsignedBuf.length;

  let sha256 = unsignedSha;
  let sizeBytes = unsignedSize;
  let signed = false;
  let signer = null;
  let manifest = null;
  let reason = null;

  try {
    const sign = await c2paService.signRender({
      inputPath: outputPath,
      tree,
      jobId,
      userId,
    });
    signed = sign.signed;
    signer = sign.signer || null;
    manifest = sign.manifest;
    reason = sign.reason || null;
    sha256 = sign.sha256;
    sizeBytes = sign.sizeBytes;
  } catch (err) {
    logger.warn('[render] C2PA signing failed; export will be unsigned', {
      jobId,
      error: err.message,
    });
  }

  // Persist authenticity record (best-effort; failure does not abort render).
  await c2paService
    .persistAuthenticity({
      contentId: tree?.metadata?.contentId,
      userId,
      jobId,
      signed,
      manifest,
      signer,
      sha256,
      reason,
    })
    .catch((err) => {
      logger.warn('[render] persistAuthenticity threw', { jobId, error: err.message });
    });

  logger.info('[render] done', {
    jobId,
    outputPath,
    sizeBytes,
    sha256,
    signed,
    signer,
  });

  return { outputPath, sha256, sizeBytes, compositionId, signed, signer };
}

router.post(
  '/render',
  auth,
  asyncHandler(async (req, res) => {
    const { tree, ratio = '16:9', sync = false } = req.body || {};

    const err = validateRenderTree(tree);
    if (err) return sendError(res, err, 400);
    if (!COMPOSITION_BY_RATIO[ratio]) {
      return sendError(res, `Unknown ratio "${ratio}". Allowed: ${Object.keys(COMPOSITION_BY_RATIO).join(', ')}`, 400);
    }

    const userId = req.user?.id || req.user?._id?.toString();
    const jobId = uuidv4();

    if (sync) {
      try {
        const result = await runRender({ tree, ratio, jobId, userId });
        return sendSuccess(res, {
          jobId,
          status: 'completed',
          ratio,
          ...result,
        });
      } catch (e) {
        const code = e.statusCode || 500;
        return sendError(res, e.message || 'Render failed', code);
      }
    }

    // Async: try to enqueue on the existing video-render queue. If the queue
    // module isn't wired, fall back to fire-and-forget so the route still
    // works during local dev.
    try {
      const queues = require('../../queues');
      if (queues && queues.videoRenderQueue && queues.videoRenderQueue.add) {
        await queues.videoRenderQueue.add(
          'render',
          { tree, ratio, jobId, userId },
          { jobId, attempts: 1, removeOnComplete: 50, removeOnFail: 100 }
        );
        return sendSuccess(res, { jobId, status: 'queued', ratio });
      }
    } catch (qErr) {
      logger.warn('[render] queue unavailable; running inline', { error: qErr.message });
    }

    // Inline fallback (not awaited) so we still return promptly.
    runRender({ tree, ratio, jobId, userId }).catch((e) => {
      logger.error('[render] inline run failed', { jobId, error: e.message });
    });

    return sendSuccess(res, { jobId, status: 'queued-inline', ratio });
  })
);

/**
 * POST /api/video/render-multi
 *
 * Render the same RenderTree across N platform-native aspect ratios in one
 * call. Returns an array of jobIds so the UI can subscribe to each. The
 * underlying renderer respects per-platform safe-zone insets (TikTok caption
 * strip, Instagram bottom UI, YouTube progress bar) via the strictest-zone
 * helper in client/lib/render/safeZones.
 */
router.post(
  '/render-multi',
  auth,
  asyncHandler(async (req, res) => {
    const { tree, ratios = ['9:16', '1:1', '16:9', '4:5'] } = req.body || {};
    const err = validateRenderTree(tree);
    if (err) return sendError(res, err, 400);
    const userId = req.user?.id || req.user?._id?.toString();

    const valid = ratios.filter((r) => COMPOSITION_BY_RATIO[r]);
    if (valid.length === 0) {
      return sendError(res, `No valid ratios provided. Allowed: ${Object.keys(COMPOSITION_BY_RATIO).join(', ')}`, 400);
    }

    const jobs = valid.map((ratio) => ({ ratio, jobId: uuidv4() }));

    // Try BullMQ; fall back to fire-and-forget inline.
    try {
      const queues = require('../../queues');
      if (queues && queues.videoRenderQueue && queues.videoRenderQueue.add) {
        await Promise.all(
          jobs.map((j) =>
            queues.videoRenderQueue.add(
              'render',
              { tree, ratio: j.ratio, jobId: j.jobId, userId },
              { jobId: j.jobId, attempts: 1, removeOnComplete: 50, removeOnFail: 100 }
            )
          )
        );
        return sendSuccess(res, { jobs, status: 'queued' });
      }
    } catch (qErr) {
      logger.warn('[render-multi] queue unavailable; running inline', { error: qErr.message });
    }

    jobs.forEach((j) => {
      runRender({ tree, ratio: j.ratio, jobId: j.jobId, userId }).catch((e) => {
        logger.error('[render-multi] inline run failed', { jobId: j.jobId, error: e.message });
      });
    });
    return sendSuccess(res, { jobs, status: 'queued-inline' });
  })
);

router.get(
  '/render/:jobId/status',
  auth,
  asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    if (!/^[a-f0-9-]{8,}$/.test(jobId)) return sendError(res, 'Invalid jobId', 400);

    const expectedPath = path.join(RENDER_OUTPUT_DIR, `${jobId}.mp4`);
    if (fs.existsSync(expectedPath)) {
      const stat = fs.statSync(expectedPath);
      return sendSuccess(res, {
        jobId,
        status: 'completed',
        sizeBytes: stat.size,
        downloadUrl: `/api/video/render/${jobId}/download`,
      });
    }

    // Queue-aware status (best effort)
    try {
      const queues = require('../../queues');
      if (queues && queues.videoRenderQueue) {
        const job = await queues.videoRenderQueue.getJob(jobId);
        if (job) {
          const state = await job.getState();
          const progress = job.progress;
          return sendSuccess(res, { jobId, status: state, progress });
        }
      }
    } catch {}

    return sendSuccess(res, { jobId, status: 'unknown' });
  })
);

router.get(
  '/render/:jobId/download',
  auth,
  asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    if (!/^[a-f0-9-]{8,}$/.test(jobId)) return sendError(res, 'Invalid jobId', 400);
    const filePath = path.join(RENDER_OUTPUT_DIR, `${jobId}.mp4`);
    if (!fs.existsSync(filePath)) return sendError(res, 'Render not found or not yet complete', 404);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="click-${jobId}.mp4"`);
    fs.createReadStream(filePath).pipe(res);
  })
);

module.exports = router;
module.exports.runRender = runRender;
module.exports.COMPOSITION_BY_RATIO = COMPOSITION_BY_RATIO;
