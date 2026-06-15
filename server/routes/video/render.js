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
const { renderLimiter } = require('../../middleware/enhancedRateLimiter');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const c2paService = require('../../services/c2paService');
const entitlements = require('../../config/entitlements');
const enforcement = require('../../services/entitlementEnforcement');
const usageService = require('../../services/usageService');
const { checkExportQuota } = require('../../middleware/tierGate');

const router = express.Router();

const COMPOSITION_BY_RATIO = {
  '16:9': 'Click_16x9',
  '9:16': 'Click_9x16',
  '1:1': 'Click_1x1',
  '4:5': 'Click_4x5',
};

const FPS = 30;

const RATIO_TO_SIZE = {
  '16:9': [1920, 1080],
  '9:16': [1080, 1920],
  '1:1': [1080, 1080],
  '4:5': [1080, 1350],
};

/**
 * Render using the same proven ffmpeg engine the manual editor already uses
 * (videoRenderService.renderFromEditorState). This is the real export path —
 * it bakes filters, text/shape overlays, trims and music into an MP4 with no
 * Remotion/Chromium dependency. Output is normalized to RENDER_OUTPUT_DIR/<jobId>.mp4
 * so the existing status/download endpoints work unchanged.
 */
/**
 * The mandatory Click watermark overlay for Free-tier exports. Bottom-right,
 * spans the whole clip. Uses the same drawtext overlay schema the editor uses
 * so it's baked into the ffmpeg render with no extra pipeline. Duration is the
 * tree duration (capped) so it persists across the entire export.
 */
function buildWatermarkOverlay(durationSec) {
  const dur = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 36000;
  return {
    text: 'Made with Click',
    x: 78,            // ~bottom-right (percent of frame)
    y: 92,
    fontSize: 28,
    color: 'white@0.85',
    startTime: 0,
    endTime: dur,
    style: 'default',
    _watermark: true,
  };
}

async function runFfmpegRender({ tree, ratio, jobId, userId, tier = 'pro' }) {
  ensureRenderDir();
  const outputPath = path.join(RENDER_OUTPUT_DIR, `${jobId}.mp4`);
  const [baseW, baseH] = RATIO_TO_SIZE[ratio] || RATIO_TO_SIZE['16:9'];

  // Resolution cap: clamp (don't error) the export dimensions to the tier's
  // maxResolution (Free 720, Creator 1080, Pro/Agency 2160).
  const { width, height, clamped } = enforcement.clampDimensions(tier, baseW, baseH);
  if (clamped) logger.info('[render] resolution clamped for tier', { jobId, tier, from: [baseW, baseH], to: [width, height] });

  // Watermark: Free tier always exports with the Click watermark baked in.
  const textOverlays = Array.isArray(tree.textOverlays) ? tree.textOverlays.slice() : [];
  if (enforcement.mustWatermark(tier)) {
    textOverlays.push(buildWatermarkOverlay(tree.duration));
  }

  const videoRenderService = require('../../services/videoRenderService');
  const result = await videoRenderService.renderFromEditorState({
    videoId: tree?.metadata?.contentId || null,
    videoUrl: tree.videoUrl,
    videoFilters: tree.filters || tree.videoFilters || {},
    textOverlays,
    shapeOverlays: Array.isArray(tree.shapeOverlays) ? tree.shapeOverlays : [],
    timelineSegments: Array.isArray(tree.timelineSegments) ? tree.timelineSegments : (tree.segments || []),
    // smartReframe (set by the Repurpose Studio) tells the engine the source was
    // already cover-scaled + subject-cropped to this aspect, so it must skip its
    // legacy forced center crop. Defaults false → existing renders unchanged.
    exportOptions: { width, height, duration: tree.duration, quality: tree.quality || 'high', codec: 'h264', smartReframe: tree.smartReframe === true },
    userId,
  });

  if (!result || !result.outputPath) throw new Error('Render produced no output');
  if (path.resolve(result.outputPath) !== path.resolve(outputPath)) {
    await fs.promises.copyFile(result.outputPath, outputPath);
    fs.promises.unlink(result.outputPath).catch(() => {});
  }
  writeRenderOwner(jobId, userId); // IDOR guard: stamp the owner
  const buf = await fs.promises.readFile(outputPath);
  const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
  logger.info('[render] ffmpeg render done', { jobId, sizeBytes: buf.length, ratio });
  return { outputPath, sha256, sizeBytes: buf.length, compositionId: `ffmpeg-${ratio}`, signed: false, signer: null };
}

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

// Renders live OUTSIDE the public `uploads/` static mount so they can ONLY be
// reached through the authed, ownership-checked endpoints below — not by anyone
// who guesses a jobId. (Was uploads/renders, which `express.static` served to
// any caller.) Ops can still override via RENDER_OUTPUT_DIR, but it should stay
// out of any statically-served path.
const RENDER_OUTPUT_DIR = path.resolve(
  process.env.RENDER_OUTPUT_DIR || path.join(process.cwd(), 'render-outputs')
);

function ensureRenderDir() {
  try {
    fs.mkdirSync(RENDER_OUTPUT_DIR, { recursive: true });
  } catch (err) {
    logger.warn('[render] could not create output dir', { dir: RENDER_OUTPUT_DIR, error: err.message });
  }
}

// ── Render ownership (IDOR guard) ────────────────────────────────────────────
// A render is keyed only by jobId, so we stamp a `.owner` sidecar next to each
// output (BEFORE the render starts, see runRender) and check it on
// status/download. The dir is NOT publicly served. The owner is stamped before
// the output exists, so a `.mp4` with no `.owner` means an unowned render — we
// fail CLOSED on it. We only fail OPEN when neither the sidecar nor the output
// exists yet (a freshly-submitted job the owner is polling → the route 404s on
// the missing file anyway).
function ownerSidecarPath(jobId) {
  return path.join(RENDER_OUTPUT_DIR, `${jobId}.owner`);
}
function renderOutputPath(jobId) {
  return path.join(RENDER_OUTPUT_DIR, `${jobId}.mp4`);
}
function writeRenderOwner(jobId, userId) {
  if (!userId) return;
  try { fs.writeFileSync(ownerSidecarPath(jobId), String(userId), 'utf8'); } catch (_) { /* best-effort */ }
}
function mayAccessRender(jobId, req) {
  let owner;
  try {
    owner = fs.readFileSync(ownerSidecarPath(jobId), 'utf8').trim();
  } catch (_) {
    // No sidecar. If an output file exists it's an unowned render → deny.
    // If nothing exists yet, allow (the download/status route 404s on the
    // missing file; this avoids 404-ing an owner polling their own new job).
    let outputExists = false;
    try { outputExists = fs.existsSync(renderOutputPath(jobId)); } catch (_) { /* ignore */ }
    return !outputExists;
  }
  if (!owner) return false; // present-but-empty sidecar → deny
  const ids = [req.user?._id, req.user?.id].filter(Boolean).map(String);
  if (!ids.length) return false; // can't identify the requester → deny
  return ids.includes(owner);
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
async function runRender({ tree, ratio, jobId, userId, tier = 'pro' }) {
  // Stamp the owner BEFORE any output file lands in RENDER_OUTPUT_DIR. Stamping
  // only after the render (as before) left a window where the .mp4 existed with
  // no .owner sidecar, and mayAccessRender failed OPEN on a missing sidecar — so
  // a stranger polling the jobId could download it. Stamping first closes that.
  ensureRenderDir();
  writeRenderOwner(jobId, userId);
  const remotion = tryRequireRemotion();
  if (!remotion.available) {
    // No Remotion → render with the real ffmpeg engine (same one the manual
    // editor uses). Produces a genuine export without Remotion/Chromium.
    return runFfmpegRender({ tree, ratio, jobId, userId, tier });
  }
  const { bundler, renderer } = remotion;

  ensureRenderDir();
  const outputPath = path.join(RENDER_OUTPUT_DIR, `${jobId}.mp4`);
  const compositionId = COMPOSITION_BY_RATIO[ratio] || 'ClickComposition';

  logger.info('[render] start', { jobId, userId, ratio, compositionId });

  // Apply tier policy to the Remotion tree too: bake the Free watermark overlay
  // and signal the resolution cap to the composition so the browser-rendered
  // export matches the ffmpeg path's enforcement.
  let policyTree = tree;
  const resCap = enforcement.clampResolution(tier, RATIO_TO_SIZE[ratio]?.[1]);
  if (enforcement.mustWatermark(tier) || resCap.clamped) {
    const overlays = Array.isArray(tree.textOverlays) ? tree.textOverlays.slice() : [];
    if (enforcement.mustWatermark(tier)) overlays.push(buildWatermarkOverlay(tree.duration));
    policyTree = { ...tree, textOverlays: overlays, _tierPolicy: { tier, maxResolution: resCap.max === Infinity ? null : resCap.max } };
  }

  const bundleLocation = await getBundleLocation(bundler);
  const inputProps = { tree: policyTree };
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

  writeRenderOwner(jobId, userId); // IDOR guard: stamp the owner

  // SHA-256 the unsigned output, then attempt to inject a C2PA manifest.
  // Signing is best-effort; if c2patool / c2pa-node isn't installed we still
  // return the (unsigned) MP4 with a warning rather than failing the render.
  const unsignedBuf = await fs.promises.readFile(outputPath);
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
  renderLimiter,
  checkExportQuota,
  asyncHandler(async (req, res) => {
    const { tree, ratio = '16:9', sync = false } = req.body || {};

    const err = validateRenderTree(tree);
    if (err) return sendError(res, err, 400);
    if (!COMPOSITION_BY_RATIO[ratio]) {
      return sendError(res, `Unknown ratio "${ratio}". Allowed: ${Object.keys(COMPOSITION_BY_RATIO).join(', ')}`, 400);
    }

    const userId = req.user?.id || req.user?._id?.toString();
    const tier = entitlements.resolveTier(req.user || {});
    const jobId = uuidv4();

    // Record the metered export against the monthly quota (best-effort).
    usageService.incrementUsage(userId, 'exports').catch((e) => {
      logger.warn('[render] export usage increment failed', { userId, error: e.message });
    });

    if (sync) {
      try {
        const result = await runRender({ tree, ratio, jobId, userId, tier });
        return sendSuccess(res, {
          jobId,
          status: 'completed',
          ratio,
          tier,
          watermarked: enforcement.mustWatermark(tier),
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
          { tree, ratio, jobId, userId, tier },
          { jobId, attempts: 1, removeOnComplete: 50, removeOnFail: 100 }
        );
        return sendSuccess(res, { jobId, status: 'queued', ratio, tier, watermarked: enforcement.mustWatermark(tier) });
      }
    } catch (qErr) {
      logger.warn('[render] queue unavailable; running inline', { error: qErr.message });
    }

    // Inline fallback (not awaited) so we still return promptly.
    runRender({ tree, ratio, jobId, userId, tier }).catch((e) => {
      logger.error('[render] inline run failed', { jobId, error: e.message });
    });

    return sendSuccess(res, { jobId, status: 'queued-inline', ratio, tier, watermarked: enforcement.mustWatermark(tier) });
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
  checkExportQuota,
  asyncHandler(async (req, res) => {
    const { tree, ratios = ['9:16', '1:1', '16:9', '4:5'] } = req.body || {};
    const err = validateRenderTree(tree);
    if (err) return sendError(res, err, 400);
    const userId = req.user?.id || req.user?._id?.toString();
    const tier = entitlements.resolveTier(req.user || {});

    const valid = ratios.filter((r) => COMPOSITION_BY_RATIO[r]);
    if (valid.length === 0) {
      return sendError(res, `No valid ratios provided. Allowed: ${Object.keys(COMPOSITION_BY_RATIO).join(', ')}`, 400);
    }

    // A multi-render is one logical export (the same tree in N ratios) — count it
    // once against the monthly quota.
    usageService.incrementUsage(userId, 'exports').catch((e) => {
      logger.warn('[render-multi] export usage increment failed', { userId, error: e.message });
    });

    const jobs = valid.map((ratio) => ({ ratio, jobId: uuidv4() }));

    // Try BullMQ; fall back to fire-and-forget inline.
    try {
      const queues = require('../../queues');
      if (queues && queues.videoRenderQueue && queues.videoRenderQueue.add) {
        await Promise.all(
          jobs.map((j) =>
            queues.videoRenderQueue.add(
              'render',
              { tree, ratio: j.ratio, jobId: j.jobId, userId, tier },
              { jobId: j.jobId, attempts: 1, removeOnComplete: 50, removeOnFail: 100 }
            )
          )
        );
        return sendSuccess(res, { jobs, status: 'queued', tier, watermarked: enforcement.mustWatermark(tier) });
      }
    } catch (qErr) {
      logger.warn('[render-multi] queue unavailable; running inline', { error: qErr.message });
    }

    jobs.forEach((j) => {
      runRender({ tree, ratio: j.ratio, jobId: j.jobId, userId, tier }).catch((e) => {
        logger.error('[render-multi] inline run failed', { jobId: j.jobId, error: e.message });
      });
    });
    return sendSuccess(res, { jobs, status: 'queued-inline', tier, watermarked: enforcement.mustWatermark(tier) });
  })
);

router.get(
  '/render/:jobId/status',
  auth,
  asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    if (!/^[a-f0-9-]{8,}$/.test(jobId)) return sendError(res, 'Invalid jobId', 400);
    if (!mayAccessRender(jobId, req)) return sendError(res, 'Render not found', 404);

    const expectedPath = path.join(RENDER_OUTPUT_DIR, `${jobId}.mp4`);
    try {
      const stat = await fs.promises.stat(expectedPath);
      return sendSuccess(res, {
        jobId,
        status: 'completed',
        sizeBytes: stat.size,
        downloadUrl: `/api/video/render/${jobId}/download`,
      });
    } catch (_) {
      // Output not present yet — fall through to queue-aware status.
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
    } catch (err) {
      // Ignore queue inspection error and fallback
    }

    return sendSuccess(res, { jobId, status: 'unknown' });
  })
);

router.get(
  '/render/:jobId/download',
  auth,
  asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    if (!/^[a-f0-9-]{8,}$/.test(jobId)) return sendError(res, 'Invalid jobId', 400);
    if (!mayAccessRender(jobId, req)) return sendError(res, 'Render not found', 404);
    const filePath = path.join(RENDER_OUTPUT_DIR, `${jobId}.mp4`);
    try {
      await fs.promises.access(filePath);
    } catch (_) {
      return sendError(res, 'Render not found or not yet complete', 404);
    }
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="click-${jobId}.mp4"`);
    fs.createReadStream(filePath).pipe(res);
  })
);

module.exports = router;
module.exports.runRender = runRender;
module.exports.COMPOSITION_BY_RATIO = COMPOSITION_BY_RATIO;
module.exports.RENDER_OUTPUT_DIR = RENDER_OUTPUT_DIR;
// Exposed for unit tests of the ownership ACL.
module.exports._writeRenderOwner = writeRenderOwner;
module.exports._mayAccessRender = mayAccessRender;
