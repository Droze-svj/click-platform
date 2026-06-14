/**
 * repurposeService.js — the Multi-Format Repurpose Studio orchestrator.
 *
 * One source video → N platform-native variants. For each target aspect it:
 *   1. smart-reframes the source (cover-scale + subject crop) to an intermediate,
 *   2. renders that intermediate through the EXISTING render pipeline
 *      (render.runRender → watermark + tier resolution clamp + C2PA signing,
 *      written to RENDER_OUTPUT_DIR/<jobId>.mp4 so the existing
 *      /api/video/render/:jobId/status + /download endpoints work unchanged).
 *
 * It also generates per-platform copy (hook / title / description / hashtags) in
 * ONE aiRouter call, with a deterministic fallback so variants always carry copy
 * even when no AI provider is configured.
 *
 * Everything here delegates: reframe → smartReframeService, render → render.js,
 * AI → aiRouter, tiering → entitlementEnforcement. No new render/queue/C2PA code.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

const smartReframe = require('./smartReframeService');
const aiRouter = require('../utils/aiRouter');
const aiProfiles = require('../config/aiProfiles');
const enforcement = require('./entitlementEnforcement');
const urlGuard = require('../utils/urlGuard');
const logger = require('../utils/logger');

// Default platform per aspect (used when the caller passes bare ratio strings).
// The platform drives the per-platform copy tone, not the geometry.
const RATIO_DEFAULT_PLATFORM = {
  '9:16': 'tiktok',
  '1:1': 'instagram',
  '16:9': 'youtube',
  '4:5': 'linkedin',
};

const PLATFORM_LABEL = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  shorts: 'YouTube Shorts',
  reels: 'Instagram Reels',
  x: 'X (Twitter)',
};

const SUPPORTED_RATIOS = Object.keys(smartReframe.RATIO_DIMS);

/**
 * Normalise a caller target (a ratio string OR { ratio, platform }) into a full
 * descriptor. Unknown ratios are dropped by the caller before this runs.
 */
function normaliseTarget(t) {
  if (typeof t === 'string') {
    return { ratio: t, platform: RATIO_DEFAULT_PLATFORM[t] || 'tiktok' };
  }
  const ratio = t && t.ratio;
  return { ratio, platform: (t && t.platform) || RATIO_DEFAULT_PLATFORM[ratio] || 'tiktok' };
}

/** Deterministic, provider-free copy so a variant always has something usable. */
function deterministicCopy(platform, baseTitle) {
  const label = PLATFORM_LABEL[platform] || platform;
  const title = (baseTitle && String(baseTitle).trim()) || 'Your video';
  return {
    hook: `Wait for it… ${title}`,
    title: `${title} (${label})`,
    description: `Made with Click — optimised for ${label}.`,
    hashtags: ['#fyp', '#viral', `#${platform}`],
  };
}

/**
 * Generate per-platform copy for all targets in a single AI call (with a
 * deterministic fallback). Never throws.
 *
 * @param {object} opts
 * @param {string} opts.baseTitle
 * @param {string} [opts.transcript]  optional context (first ~1k chars used)
 * @param {string[]} opts.platforms   distinct platform ids to write for
 * @param {string} opts.tier
 * @returns {Promise<Object<string, {hook,title,description,hashtags}>>}
 */
async function generatePlatformCopy({ baseTitle, transcript, platforms, tier }) {
  const distinct = [...new Set(platforms)];
  const fallback = {};
  for (const p of distinct) fallback[p] = deterministicCopy(p, baseTitle);

  const profile = (() => {
    try { return aiProfiles.aiProfileForTier(tier); } catch (_) { return null; }
  })();
  const maxTokens = profile?.maxTokens ? Math.min(profile.maxTokens, 1200) : 800;

  const ctx = transcript ? `\n\nTranscript excerpt:\n"""${String(transcript).slice(0, 1000)}"""` : '';
  const prompt =
    `You are a short-form social copywriter. For a video titled "${baseTitle || 'Untitled'}", ` +
    `write platform-native copy for each of these platforms: ${distinct.map((p) => PLATFORM_LABEL[p] || p).join(', ')}.${ctx}\n\n` +
    `Return ONLY a JSON object keyed by lowercase platform id (${distinct.join(', ')}). ` +
    `Each value: { "hook": string (<=12 words, scroll-stopping), "title": string, ` +
    `"description": string (1-2 sentences), "hashtags": string[] (3-6 items, each starting with #) }. ` +
    `Match each platform's voice (TikTok punchy, LinkedIn professional, YouTube searchable).`;

  let raw;
  try {
    raw = await aiRouter.aiCallJsonValidated(prompt, {
      fallback: null,
      taskKind: 'creative',
      taskType: 'repurpose-copy',
      maxTokens,
      temperature: 0.8,
    });
  } catch (e) {
    logger.warn('[repurpose] copy generation threw; using deterministic copy', { error: e.message });
    return fallback;
  }
  if (!raw || typeof raw !== 'object') return fallback;

  // Merge AI output over the deterministic baseline so any missing/partial
  // platform still has complete copy.
  const out = {};
  for (const p of distinct) {
    const base = fallback[p];
    const got = raw[p] && typeof raw[p] === 'object' ? raw[p] : {};
    out[p] = {
      hook: typeof got.hook === 'string' && got.hook.trim() ? got.hook.trim() : base.hook,
      title: typeof got.title === 'string' && got.title.trim() ? got.title.trim() : base.title,
      description: typeof got.description === 'string' && got.description.trim() ? got.description.trim() : base.description,
      hashtags: Array.isArray(got.hashtags) && got.hashtags.length
        ? got.hashtags.filter((h) => typeof h === 'string').slice(0, 6)
        : base.hashtags,
    };
  }
  return out;
}

/**
 * Resolve a source videoUrl/path to something ffmpeg can read. Remote URLs are
 * SSRF-guarded; local paths are made absolute and existence-checked.
 * @returns {Promise<string>}
 */
async function resolveSource(videoUrl) {
  if (!videoUrl || typeof videoUrl !== 'string') throw new Error('A source videoUrl is required');
  const trimmed = videoUrl.trim();

  // Remote: SSRF-guard then let ffmpeg read it directly.
  if (/^https?:\/\//i.test(trimmed)) {
    await urlGuard.assertPublicUrl(trimmed); // throws BlockedUrlError on SSRF
    return trimmed;
  }

  // Local: the platform serves user media from <cwd>/uploads via `/uploads/...`
  // URLs, so a leading slash is a STATIC-MOUNT path, not a filesystem root.
  // Resolve relative to cwd and JAIL the result inside uploads/ (path-traversal
  // and arbitrary-file-read protection — stricter than the legacy render path).
  const uploadsRoot = path.resolve(process.cwd(), 'uploads');
  const resolved = path.resolve(uploadsRoot, trimmed.replace(/^\/+/, '').replace(/^uploads[/\\]/, ''));
  if (resolved !== uploadsRoot && !resolved.startsWith(uploadsRoot + path.sep)) {
    throw new Error('Source video must be an uploaded file');
  }
  if (!fs.existsSync(resolved)) throw new Error(`Source video not found: ${videoUrl}`);
  return resolved;
}

/**
 * Plan the variant jobs for a request: clamp the target count to the tier, mint
 * a jobId per variant, and attach copy. This is the SYNCHRONOUS part the route
 * returns immediately; the actual rendering runs in runVariants() afterwards.
 *
 * @returns {Promise<{ variants: Array, copyByPlatform: object, clampedFrom?: number }>}
 */
async function planRepurpose({ baseTree, targets, tier, transcript }) {
  const requested = (Array.isArray(targets) && targets.length ? targets : SUPPORTED_RATIOS)
    .map(normaliseTarget)
    .filter((t) => SUPPORTED_RATIOS.includes(t.ratio));

  // De-dupe by ratio+platform, preserving order.
  const seen = new Set();
  const unique = [];
  for (const t of requested) {
    const key = `${t.ratio}|${t.platform}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(t);
  }

  const { allowed, clamped } = enforcement.clampVariants(tier, unique.length);
  const chosen = unique.slice(0, allowed);

  const baseTitle = baseTree?.metadata?.title || baseTree?.title || '';
  const copyByPlatform = await generatePlatformCopy({
    baseTitle,
    transcript,
    platforms: chosen.map((t) => t.platform),
    tier,
  });

  const variants = chosen.map((t) => {
    const copy = copyByPlatform[t.platform] || deterministicCopy(t.platform, baseTitle);
    return {
      jobId: uuidv4(),
      ratio: t.ratio,
      platform: t.platform,
      platformLabel: PLATFORM_LABEL[t.platform] || t.platform,
      status: 'queued',
      hook: copy.hook,
      title: copy.title,
      description: copy.description,
      hashtags: copy.hashtags,
    };
  });

  return { variants, copyByPlatform, clampedFrom: clamped ? unique.length : undefined };
}

/**
 * Render every planned variant SEQUENTIALLY (one ffmpeg job at a time to avoid
 * CPU starvation). For each: reframe the source to the target aspect, then run
 * it through render.runRender so watermark / clamp / C2PA all apply. Intermediate
 * reframe files are always cleaned up (CLAUDE.md temp-file policy).
 *
 * Designed to be called fire-and-forget by the route; it never throws (per-
 * variant failures are logged and recorded on the variant object).
 *
 * @param {object} opts
 * @param {string} opts.sourcePath  resolved source (local abs path or guarded URL)
 * @param {object} opts.baseTree    the editor RenderTree (filters/overlays/etc.)
 * @param {Array}  opts.variants    output of planRepurpose().variants
 * @param {string} opts.tier
 * @param {string} opts.userId
 */
async function runVariants({ sourcePath, baseTree, variants, tier, userId }) {
  const renderRoute = require('../routes/video/render');
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'repurpose-'));

  for (const variant of variants) {
    const intermediate = path.join(tmpRoot, `${variant.jobId}-${variant.ratio.replace(':', 'x')}.mp4`);
    try {
      // 1. Smart reframe → intermediate at the target aspect.
      const framed = await smartReframe.reframe(sourcePath, intermediate, variant.ratio);
      logger.info('[repurpose] reframed', { jobId: variant.jobId, ratio: variant.ratio, method: framed.method });

      // 2. Render the intermediate through the existing pipeline. smartReframe:true
      //    tells the engine not to re-crop (the frame is already target-aspect).
      const tree = {
        ...baseTree,
        videoUrl: intermediate,
        smartReframe: true,
        filters: baseTree?.filters || baseTree?.videoFilters || {},
        duration: baseTree?.duration,
        quality: baseTree?.quality || 'high',
      };
      await renderRoute.runRender({ tree, ratio: variant.ratio, jobId: variant.jobId, userId, tier });
      variant.status = 'completed';
      logger.info('[repurpose] variant rendered', { jobId: variant.jobId, ratio: variant.ratio });
    } catch (e) {
      variant.status = 'failed';
      variant.error = e.message;
      logger.error('[repurpose] variant failed', { jobId: variant.jobId, ratio: variant.ratio, error: e.message });
    } finally {
      // Always remove the intermediate reframe file.
      fs.promises.unlink(intermediate).catch(() => {});
    }
  }

  // Remove the (now-empty) temp dir.
  fs.promises.rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
}

module.exports = {
  planRepurpose,
  runVariants,
  resolveSource,
  generatePlatformCopy,
  deterministicCopy,
  RATIO_DEFAULT_PLATFORM,
  SUPPORTED_RATIOS,
};
