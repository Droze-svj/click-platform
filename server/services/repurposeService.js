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
const downloadUtils = require('../utils/downloadUtils');
const usageService = require('./usageService');
const logger = require('../utils/logger');
// The canonical niche/platform playbook (18 niches × 7 platforms, hook
// frameworks, niche CTAs/keywords). Repurpose copy is grounded in it so every
// hook/hashtag is niche- and platform-native instead of generic.
const { getKnowledgeSlice } = require('./marketingKnowledge');
// Live, Claude-web-grounded trending sounds/hashtags/topics (cached 8h, tier-
// gated, and HONESTLY returns source:'unavailable' rather than fabricating).
// Used best-effort to make the copy ride what's trending right now.
const liveTrendService = require('./liveTrendService');
// Per-creator personalization (learned style + voice + brand) folded into the
// copy's SYSTEM prompt so output is unique to each creator and improves over time.
const personalizationService = require('./personalizationService');

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

/** Race a promise against a timeout; resolves to `null` if the timer wins. */
function withTimeout(promise, ms) {
  let t;
  const timeout = new Promise((resolve) => { t = setTimeout(() => resolve(null), ms); });
  return Promise.race([
    Promise.resolve(promise).then((v) => { clearTimeout(t); return v; }, () => { clearTimeout(t); return null; }),
    timeout,
  ]);
}

/**
 * Best-effort live trend context for a niche/platform. Never throws and never
 * blocks the request for long — a slow/unavailable trend source just yields an
 * empty context and the copy falls back to the static playbook. Returns the
 * verified trending hashtags + topics (label strings), or empties.
 *
 * @returns {Promise<{ hashtags: string[], topics: string[], source: string }>}
 */
async function getLiveTrendContext({ platform, niche, tier, timeoutMs = 7000 }) {
  const empty = { hashtags: [], topics: [], source: 'none' };
  try {
    const r = await withTimeout(
      liveTrendService.getLatestTrends(platform || 'tiktok', { niche, tier }),
      timeoutMs
    );
    if (!r || r.source === 'unavailable') return empty;
    const labels = (arr) => (Array.isArray(arr) ? arr : []).map((x) => x && x.label).filter(Boolean);
    const hashtags = labels(r.hashtags).slice(0, 5);
    const topics = labels(r.topics).slice(0, 5);
    if (!hashtags.length && !topics.length) return empty;
    return { hashtags, topics, source: r.source || 'live' };
  } catch (e) {
    logger.warn('[repurpose] live trend fetch failed; proceeding without', { error: e.message });
    return empty;
  }
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
async function generatePlatformCopy({ baseTitle, transcript, platforms, tier, niche, userId, personalization }) {
  const distinct = [...new Set(platforms)];
  const fallback = {};
  for (const p of distinct) fallback[p] = deterministicCopy(p, baseTitle, niche);

  // Live trending context (best-effort; bellwether = first platform). Empty when
  // unavailable / free-tier, in which case copy rests on the static playbook.
  const trends = await getLiveTrendContext({ platform: distinct[0], niche, tier });

  // Append the single strongest trending hashtag to each variant (deduped,
  // capped) so even the deterministic fallback rides the moment when we have one.
  const applyTrends = (copyMap) => {
    const topTag = trends.hashtags[0];
    if (!topTag) return copyMap;
    const enriched = {};
    for (const p of Object.keys(copyMap)) {
      const c = copyMap[p];
      const tags = Array.isArray(c.hashtags) ? c.hashtags.slice() : [];
      if (!tags.some((t) => String(t).toLowerCase() === topTag.toLowerCase())) tags.push(topTag);
      enriched[p] = { ...c, hashtags: tags.slice(0, 8) };
    }
    return enriched;
  };

  const profile = (() => {
    try { return aiProfiles.aiProfileForTier(tier); } catch (_) { return null; }
  })();
  const maxTokens = profile?.maxTokens ? Math.min(profile.maxTokens, 1400) : 1000;

  // Ground the prompt in the per-platform niche playbook so the AI uses real
  // hook frameworks, niche keywords, and platform hashtag rules.
  const guidance = distinct.map((p) => platformGuidanceBlock(p, niche)).filter(Boolean).join('\n\n');
  const trendBlock = (trends.topics.length || trends.hashtags.length)
    ? `\n\nCURRENTLY TRENDING right now (ride these where they fit naturally — do not force):` +
      (trends.topics.length ? `\n- Topics: ${trends.topics.join('; ')}` : '') +
      (trends.hashtags.length ? `\n- Hashtags: ${trends.hashtags.join(' ')}` : '')
    : '';
  const ctx = transcript ? `\n\nTranscript excerpt:\n"""${String(transcript).slice(0, 1000)}"""` : '';
  const prompt =
    `You are an expert short-form social copywriter. Write platform-native copy for a video ` +
    `titled "${baseTitle || 'Untitled'}"${niche ? ` in the "${niche}" niche` : ''}.${ctx}${trendBlock}\n\n` +
    `Follow this per-platform playbook exactly — match each platform's voice, hook frameworks, and hashtag rule:\n${guidance}\n\n` +
    `Return ONLY a JSON object keyed by lowercase platform id (${distinct.join(', ')}). ` +
    `Each value: { "hook": string (<=12 words, scroll-stopping, built on one of the hook frameworks), ` +
    `"title": string, "description": string (1-2 sentences), ` +
    `"hashtags": string[] (follow that platform's hashtag rule, each starting with #) }.`;

  // Per-creator personalization: the SYSTEM prompt carries the creator's learned
  // style, what's worked for them, their saved voice (tone/vocab/banned) and brand
  // — so two creators get distinctly different copy from the same clip. Best-effort:
  // never blocks copy gen (cold-start / no userId → undefined → base behaviour).
  let systemPrompt;
  try {
    // 'caption-writer' persona — aligned with producing structured copy. (The
    // 'creative-director' persona asks for 3-5 free-form options, which fights
    // this task's "return ONLY a JSON object keyed by platform" instruction.)
    systemPrompt = await personalizationService.buildPersonalizedSystemPrompt({
      userId, niche, platform: distinct[0], role: 'caption-writer', stage: 'script', override: personalization,
    });
  } catch (_) { systemPrompt = undefined; }
  // Per-request creativity (0..1) → sampling temperature (clamped sane range).
  const creativity = personalization && typeof personalization.creativity === 'number' ? personalization.creativity : null;
  const temperature = creativity != null ? Math.max(0.4, Math.min(1.0, creativity)) : 0.8;

  let raw;
  try {
    raw = await aiRouter.aiCallJsonValidated(prompt, {
      fallback: null,
      taskKind: 'creative',
      taskType: 'repurpose-copy',
      maxTokens,
      temperature,
      systemPrompt,
    });
  } catch (e) {
    logger.warn('[repurpose] copy generation threw; using deterministic copy', { error: e.message });
    return applyTrends(fallback);
  }
  if (!raw || typeof raw !== 'object') return applyTrends(fallback);

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
  return applyTrends(out);
}

/**
 * Resolve a source videoUrl/path to a LOCAL file path ffmpeg can safely read,
 * plus a cleanup() to call when done.
 *
 * Remote URLs are downloaded via the per-hop SSRF-guarded streamer to a temp
 * file — we must NOT hand ffmpeg a URL it can follow, because ffmpeg re-resolves
 * DNS and follows redirects itself (a one-time URL check is defeated by a
 * redirect-to-private-IP or a DNS-rebind). Local paths are jailed to uploads/.
 *
 * @returns {Promise<{ path: string, cleanup: () => void }>}
 */
async function resolveSource(videoUrl) {
  if (!videoUrl || typeof videoUrl !== 'string') throw new Error('A source videoUrl is required');
  const trimmed = videoUrl.trim();
  const noop = () => {};

  if (/^https?:\/\//i.test(trimmed)) {
    await urlGuard.assertPublicUrl(trimmed); // initial check; streamDownload re-guards EVERY hop
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repurpose-src-'));
    const dest = path.join(tmpDir, 'source.mp4');
    const cleanup = () => { fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {}); };
    try {
      // streamDownload calls urlGuard.assertPublicUrl on the initial URL AND on
      // every redirect hop, so ffmpeg only ever sees the validated local file.
      await downloadUtils.streamDownload(trimmed, dest);
    } catch (e) {
      cleanup();
      const err = new Error(`Could not fetch source video: ${e.message}`);
      err.statusCode = e.statusCode || 400;
      throw err;
    }
    return { path: dest, cleanup };
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
  return { path: resolved, cleanup: noop };
}

/**
 * Plan the variant jobs for a request: clamp the target count to the tier, mint
 * a jobId per variant, and attach copy. This is the SYNCHRONOUS part the route
 * returns immediately; the actual rendering runs in runVariants() afterwards.
 *
 * @returns {Promise<{ variants: Array, copyByPlatform: object, clampedFrom?: number }>}
 */
async function planRepurpose({ baseTree, targets, tier, transcript, niche, userId, personalization }) {
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
    userId,
    personalization,
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
 * @param {string} opts.sourcePath  resolved LOCAL source file path
 * @param {object} opts.baseTree    the editor RenderTree (filters/overlays/etc.)
 * @param {Array}  opts.variants    output of planRepurpose().variants
 * @param {string} opts.tier
 * @param {string} opts.userId
 * @param {function} [opts.cleanup] removes the resolved source (e.g. a downloaded temp)
 */
async function runVariants({ sourcePath, baseTree, variants, tier, userId, cleanup }) {
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

  // Remove the (now-empty) temp dir, then the source (no-op for user uploads;
  // removes the downloaded temp file for remote sources).
  fs.promises.rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
  if (typeof cleanup === 'function') { try { cleanup(); } catch (_) { /* best-effort */ } }
}

/**
 * Run a complete repurpose: resolve + SSRF-guard the source, plan the variants
 * (tier clamp + per-platform copy), meter the export, and fire the background
 * renders. Shared by the /repurpose route and the recipe "apply" (remix) route
 * so both go through the exact same guards and pipeline.
 *
 * Field validation of `tree` (videoUrl/duration/targets) is the caller's job;
 * this performs the SOURCE guard and orchestration. Never throws.
 *
 * @returns {Promise<{ok:true, variants:Array, clampedFrom?:number}
 *                  | {ok:false, status:number, error:string}>}
 */
async function orchestrate({ tree, targets, tier, niche, transcript, userId, personalization }) {
  let src;
  try {
    src = await resolveSource(tree.videoUrl); // { path, cleanup }
  } catch (e) {
    return { ok: false, status: e.statusCode || 400, error: e.message || 'Invalid source video' };
  }

  let plan;
  try {
    plan = await planRepurpose({ baseTree: tree, targets, tier, niche, transcript, userId, personalization });
  } catch (e) {
    src.cleanup(); // don't leak a downloaded temp source on early failure
    logger.error('[repurpose] planning failed', { error: e.message });
    return { ok: false, status: 500, error: 'Could not plan repurpose job' };
  }
  if (!plan.variants.length) {
    src.cleanup();
    return { ok: false, status: 400, error: 'No valid target aspect ratios. Allowed: ' + SUPPORTED_RATIOS.join(', ') };
  }

  // Count the whole repurpose as ONE metered export (best-effort).
  if (userId) {
    usageService.incrementUsage(userId, 'exports').catch((e) => {
      logger.warn('[repurpose] export usage increment failed', { userId, error: e.message });
    });
  }

  // Fire the renders in the background; the caller responds immediately.
  // runVariants owns the source cleanup once it starts (runs after all variants).
  runVariants({ sourcePath: src.path, baseTree: tree, variants: plan.variants, tier, userId, cleanup: src.cleanup })
    .catch((e) => { src.cleanup(); logger.error('[repurpose] runVariants crashed', { error: e.message }); });

  const variants = plan.variants.map((v) => ({
    jobId: v.jobId,
    ratio: v.ratio,
    platform: v.platform,
    platformLabel: v.platformLabel,
    status: 'queued',
    hook: v.hook,
    title: v.title,
    description: v.description,
    hashtags: v.hashtags,
    statusUrl: `/api/video/render/${v.jobId}/status`,
    downloadUrl: `/api/video/render/${v.jobId}/download`,
  }));

  return { ok: true, variants, clampedFrom: plan.clampedFrom };
}

module.exports = {
  planRepurpose,
  runVariants,
  orchestrate,
  resolveSource,
  generatePlatformCopy,
  deterministicCopy,
  RATIO_DEFAULT_PLATFORM,
  SUPPORTED_RATIOS,
};
