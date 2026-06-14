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
// The canonical niche/platform playbook (18 niches × 7 platforms, hook
// frameworks, niche CTAs/keywords). Repurpose copy is grounded in it so every
// hook/hashtag is niche- and platform-native instead of generic.
const { getKnowledgeSlice } = require('./marketingKnowledge');

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

/** Small deterministic string→index hash (stable across runs; no Math.random). */
function hashIndex(str, mod) {
  if (!mod || mod < 1) return 0;
  let h = 0;
  for (let i = 0; i < String(str).length; i++) h = (h * 31 + String(str).charCodeAt(i)) >>> 0;
  return h % mod;
}

/** Turn a keyword/phrase into a clean hashtag, or null if it has no letters. */
function hashtagify(s) {
  const cleaned = String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  return cleaned ? `#${cleaned}` : null;
}

// Title-aware hook templates. Chosen deterministically by platform so the same
// video gets a DIFFERENT hook angle per platform (real per-platform diversity).
const HOOK_TEMPLATES = [
  (t) => `Most people get ${t} wrong. Here's the fix.`,
  (t) => `The truth about ${t} nobody tells you.`,
  (t) => `I tried ${t} so you don't have to.`,
  (t, angle) => (angle ? `${t}: ${String(angle).toLowerCase()}.` : `Watch this before you try ${t}.`),
];

/** Broad/discovery tag + per-platform hashtag count cap (follows the playbook). */
const PLATFORM_BROAD_TAG = { tiktok: '#fyp', instagram: '#reels', youtube: '#shorts', linkedin: null, twitter: null };
const PLATFORM_TAG_CAP = { tiktok: 5, instagram: 6, youtube: 3, linkedin: 4, twitter: 1 };

/** Build niche-native hashtags from the playbook keywords + a broad tag. */
function nicheHashtags(slice, platform) {
  const out = [];
  const push = (t) => { if (t && !out.includes(t)) out.push(t); };
  if (slice.niche && slice.niche !== 'other') push(`#${slice.niche}`);
  for (const kw of (slice.nichePlaybook?.keywords || [])) {
    if (out.length >= 4) break;
    push(hashtagify(kw));
  }
  push(PLATFORM_BROAD_TAG[platform]);
  const cap = PLATFORM_TAG_CAP[platform] ?? 5;
  const capped = out.slice(0, cap);
  return capped.length ? capped : ['#fyp'];
}

/**
 * Deterministic, provider-free copy so a variant always has something usable —
 * now grounded in the niche/platform playbook (real hook angle, niche hashtags,
 * a niche-appropriate CTA) rather than a generic "Wait for it…".
 */
function deterministicCopy(platform, baseTitle, niche) {
  const label = PLATFORM_LABEL[platform] || platform;
  const title = (baseTitle && String(baseTitle).trim()) || 'this';

  let slice = null;
  try { slice = getKnowledgeSlice({ niche, platform }); } catch (_) { slice = null; }
  if (!slice) {
    return {
      hook: `Wait for it… ${title}`,
      title,
      description: `Made with Click — optimised for ${label}.`,
      hashtags: ['#fyp', '#viral', `#${platform}`],
    };
  }

  const angle = slice.nichePlaybook?.angles?.[0];
  const hook = HOOK_TEMPLATES[hashIndex(platform, HOOK_TEMPLATES.length)](title, angle);
  // A concrete, niche-merged CTA from the playbook (save/follow pools).
  const ctaPool = (slice.ctas?.save || []).concat(slice.ctas?.follow || []);
  const cta = ctaPool.length ? ctaPool[hashIndex(platform + title, ctaPool.length)] : 'Follow for more.';
  const description = [angle ? `${angle}.` : '', cta].filter(Boolean).join(' ').trim();

  return { hook, title, description, hashtags: nicheHashtags(slice, platform) };
}

/** A compact, per-platform playbook block injected into the AI copy prompt. */
function platformGuidanceBlock(platform, niche) {
  let slice;
  try { slice = getKnowledgeSlice({ niche, platform }); } catch (_) { return ''; }
  const np = slice.nichePlaybook || {};
  const pp = slice.platformPlaybook || {};
  const hookIds = (slice.hooks || []).slice(0, 4).map((h) => h.id).join(', ');
  return [
    `### ${PLATFORM_LABEL[platform] || platform} — niche: ${slice.niche}`,
    np.voice ? `- Voice: ${np.voice}` : null,
    np.angles?.length ? `- Proven angles: ${np.angles.slice(0, 4).join('; ')}` : null,
    hookIds ? `- Hook frameworks to draw from: ${hookIds}` : null,
    pp.captionStyle ? `- Caption style: ${pp.captionStyle}` : null,
    pp.cta ? `- CTA approach: ${pp.cta}` : null,
    pp.hashtags ? `- Hashtag rule: ${pp.hashtags}` : null,
    np.keywords?.length ? `- Weave in niche keywords where natural: ${np.keywords.slice(0, 5).join(', ')}` : null,
    np.avoid?.length ? `- Avoid: ${np.avoid.slice(0, 3).join('; ')}` : null,
  ].filter(Boolean).join('\n');
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
 * @param {string} [opts.niche]       creator niche — grounds copy in the playbook
 * @returns {Promise<Object<string, {hook,title,description,hashtags}>>}
 */
async function generatePlatformCopy({ baseTitle, transcript, platforms, tier, niche }) {
  const distinct = [...new Set(platforms)];
  const fallback = {};
  for (const p of distinct) fallback[p] = deterministicCopy(p, baseTitle, niche);

  const profile = (() => {
    try { return aiProfiles.aiProfileForTier(tier); } catch (_) { return null; }
  })();
  const maxTokens = profile?.maxTokens ? Math.min(profile.maxTokens, 1400) : 1000;

  // Ground the prompt in the per-platform niche playbook so the AI uses real
  // hook frameworks, niche keywords, and platform hashtag rules.
  const guidance = distinct.map((p) => platformGuidanceBlock(p, niche)).filter(Boolean).join('\n\n');
  const ctx = transcript ? `\n\nTranscript excerpt:\n"""${String(transcript).slice(0, 1000)}"""` : '';
  const prompt =
    `You are an expert short-form social copywriter. Write platform-native copy for a video ` +
    `titled "${baseTitle || 'Untitled'}"${niche ? ` in the "${niche}" niche` : ''}.${ctx}\n\n` +
    `Follow this per-platform playbook exactly — match each platform's voice, hook frameworks, and hashtag rule:\n${guidance}\n\n` +
    `Return ONLY a JSON object keyed by lowercase platform id (${distinct.join(', ')}). ` +
    `Each value: { "hook": string (<=12 words, scroll-stopping, built on one of the hook frameworks), ` +
    `"title": string, "description": string (1-2 sentences), ` +
    `"hashtags": string[] (follow that platform's hashtag rule, each starting with #) }.`;

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
async function planRepurpose({ baseTree, targets, tier, transcript, niche }) {
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
    niche,
  });

  const variants = chosen.map((t) => {
    const copy = copyByPlatform[t.platform] || deterministicCopy(t.platform, baseTitle, niche);
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
