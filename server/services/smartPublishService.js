/**
 * smartPublishService — composes the per-clip publish suggestion that the
 * Schedule & Publish drawer surfaces in the UI.
 *
 * Reuses three things that already existed but were never wired to the
 * clip lifecycle:
 *   - reformatService.reformatForPlatform → 3 distinct caption variants
 *     per platform (curiosity-gap / value / contrarian angles).
 *   - smartScheduleOptimizationService.predictOptimalTime → top-N best
 *     publish slots per platform with a score + factors.
 *   - styleLearningService.getResolvedStyleInsight → user's current taste
 *     profile (top preset, top hour, top day) for biasing.
 *
 * The output shape is stable: the auto-edit pipeline writes it onto the
 * clip in Mongo, the clip-hub mapper passes it to the client, and the
 * SchedulePublishDrawer renders it as defaults the user can edit.
 */

const logger = require('../utils/logger');

const PLATFORM_DEFAULTS = ['tiktok', 'shorts', 'reels'];

/**
 * Compose a publish suggestion for ONE clip across multiple platforms.
 *
 * @param {Object} args
 * @param {string} args.userId
 * @param {string} args.contentId — parent video Content _id
 * @param {Object} args.clip — the freshly-rendered clip object (caption,
 *   hookText, stylePresetId, etc.)
 * @param {string[]} [args.platforms] — defaults to tiktok/shorts/reels
 * @param {string} [args.niche]
 * @param {string} [args.language]
 *
 * @returns {Promise<{captions, hashtags, recommendedSlots, rationale, perPlatform}>}
 */
async function buildPublishSuggestion(args = {}) {
  const {
    userId,
    contentId,
    clip = {},
    platforms = PLATFORM_DEFAULTS,
    niche = 'general',
    language = 'en',
  } = args;

  if (!Array.isArray(platforms) || platforms.length === 0) {
    return emptySuggestion();
  }

  const { reformatForPlatform } = safeRequire('./reformatService') || {};
  const { predictOptimalTime } = safeRequire('./smartScheduleOptimizationService') || {};
  const { getResolvedStyleInsight } = safeRequire('./styleLearningService') || {};

  // Style insight runs once and is shared across all platforms — it's
  // cheap (single Mongo lookup) and used to bias caption + slot picks.
  let insight = null;
  try {
    insight = userId && getResolvedStyleInsight ? await getResolvedStyleInsight(userId, null) : null;
  } catch (e) {
    logger.warn('smartPublish: style insight unavailable', { error: e.message });
  }

  // Fetch the user's last-N published captions so we can both prompt
  // against reuse AND post-filter near-duplicate variants. This is the
  // "non-repetitive output" guarantee — without it the LLM happily ships
  // the same curiosity-gap angle every time.
  const recentCaptions = await fetchRecentCaptions(userId);
  const recentByPlatform = groupByPlatform(recentCaptions);

  // Build a base content payload. The platform-specific avoidance hint
  // is added inside the per-platform loop below — using only the user's
  // recent captions on THAT platform. Previously the hint was built
  // once from the global recent list, which meant a LinkedIn variant
  // request shipped with a "don't sound like these TikTok captions"
  // nudge — wrong audience, wrong voice, wrong tone. The post-filter
  // step at line 105 was already platform-scoped; this aligns the
  // pre-filter hint with it.
  const buildBody = (platform) => {
    const platformRecent = (recentByPlatform[platform] || []).slice(0, 5);
    const hint = platformRecent.length > 0
      ? `\n\n[Recent shipped captions on ${platform} — produce a meaningfully different angle]:\n${platformRecent.map((c) => `- ${c.caption}`).join('\n')}`
      : '';
    return [clip.hookText, clip.caption, ...(clip.editsApplied || [])].filter(Boolean).join('\n') + hint;
  };

  // Run all platforms in parallel. Each call is independent and one
  // platform's failure should not block the others.
  const perPlatform = await Promise.all(platforms.map(async (platform) => {
    const contentPayload = {
      _id: contentId,
      userId,
      title: clip.caption || clip.hookText || 'Untitled clip',
      body: buildBody(platform),
    };
    let captions = [];
    let hashtags = [];
    let cta = null;
    let hook = null;
    let topSlot = null;
    let predictions = [];

    if (reformatForPlatform) {
      try {
        const r = await reformatForPlatform(contentPayload, platform, niche, language);
        const variants = Array.isArray(r?.variants) ? r.variants : [];
        const rawCaptions = variants.map((v) => v.caption).filter(Boolean);
        // Drop variants that are too similar to anything the user has
        // recently shipped on this platform OR cross-platform. Falls back
        // to the raw list if everything would be filtered (better some
        // suggestion than none).
        const recent = [
          ...(recentByPlatform[platform] || []),
          ...(recentByPlatform.__all__ || []),
        ].map(c => c.caption);
        const filtered = rawCaptions.filter(c => !isNearDuplicate(c, recent));
        captions = filtered.length > 0 ? filtered : rawCaptions;
        hashtags = variants.flatMap((v) => Array.isArray(v.hashtags) ? v.hashtags : []);
        cta = variants[0]?.cta || null;
        hook = variants[0]?.hook || null;
      } catch (e) {
        logger.warn('smartPublish: reformat failed for platform', { platform, error: e.message });
      }
    }

    if (predictOptimalTime) {
      try {
        const r = await predictOptimalTime(userId, contentId, platform, { dateRange: 7 });
        predictions = Array.isArray(r?.predictions) ? r.predictions : [];
        topSlot = r?.bestTime || predictions[0] || null;
      } catch (e) {
        logger.warn('smartPublish: schedule prediction failed for platform', { platform, error: e.message });
      }
    }

    return {
      platform,
      captions,
      hashtags: dedupeKeepCase(hashtags).slice(0, 12),
      cta,
      hook,
      topSlot,
      predictions: predictions.slice(0, 5),
    };
  }));

  // Roll up the per-platform results into the flat shape the clip stores.
  // We surface BOTH:
  //   - captions[platform]          (top-1 string, back-compat for the
  //                                  existing drawer default)
  //   - captionVariants[platform]   (up to 3 distinct angles —
  //                                  curiosity-gap / value / contrarian
  //                                  — so the UI can offer A/B/C picks
  //                                  instead of locking the user into
  //                                  the first variant)
  // reformatService already produces 3 variants; we used to throw two of
  // them away. Keeping all three lets the picker surface the user's real
  // choice and the delta-capture loop learn which angle they actually
  // ship per platform.
  const captions = {};
  const captionVariants = {};
  const hashtags = {};
  const recommendedSlots = [];

  for (const p of perPlatform) {
    captions[p.platform] = p.captions[0] || null;
    captionVariants[p.platform] = (p.captions || []).slice(0, 3);
    hashtags[p.platform] = p.hashtags;
    if (p.topSlot?.scheduledTime) {
      recommendedSlots.push({
        platform: p.platform,
        isoTime: new Date(p.topSlot.scheduledTime).toISOString(),
        score: p.topSlot.score,
        confidence: p.topSlot.confidence,
        reason: scheduleReason(p.topSlot, insight),
      });
    }
  }

  // Rationale is a single human-readable line for the UI's "Why this
  // time?" disclosure. Picks the highest-scoring slot across all
  // platforms and explains which signal drove it.
  recommendedSlots.sort((a, b) => (b.score || 0) - (a.score || 0));
  const top = recommendedSlots[0];
  const rationale = top
    ? `${top.reason} (score ${top.score}/100, ${top.confidence} confidence)`
    : 'No historical data yet — using platform-defaults best practices.';

  return {
    captions,
    captionVariants, // up to 3 distinct angles per platform — drawer A/B/C picker
    hashtags,
    recommendedSlots,
    rationale,
    perPlatform, // full detail for the drawer (3 caption variants, all slots)
    insight,     // surfaced so the drawer can show "Click learned: ..."
  };
}

// ── helpers ─────────────────────────────────────────────────────────────────

function safeRequire(modulePath) {
  try { return require(modulePath); } catch (_) { return null; }
}

function dedupeKeepCase(tags) {
  const seen = new Set();
  const out = [];
  for (const t of tags) {
    if (typeof t !== 'string') continue;
    const norm = t.trim().replace(/^#+/, '');
    if (!norm) continue;
    const key = norm.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(`#${norm}`);
  }
  return out;
}

function scheduleReason(slot, insight) {
  if (!slot?.scheduledTime) return 'No data — using platform defaults.';
  const t = new Date(slot.scheduledTime);
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][t.getDay()];
  const hour = t.getHours();
  const ap = hour < 12 ? 'am' : 'pm';
  const h12 = ((hour + 11) % 12) + 1;
  const userTopHour = insight?.topPicks?.publishHour;
  if (userTopHour && Number(userTopHour) === hour) {
    return `Picked ${day} ${h12}${ap} — your historical sweet spot.`;
  }
  if (slot.factors?.audienceMatch) {
    return `Picked ${day} ${h12}${ap} — your audience peaks then.`;
  }
  if (slot.factors?.optimalTime) {
    return `Picked ${day} ${h12}${ap} — platform-wide best time.`;
  }
  return `Picked ${day} ${h12}${ap}.`;
}

function emptySuggestion() {
  return {
    captions: {},
    captionVariants: {},
    hashtags: {},
    recommendedSlots: [],
    rationale: 'No platforms requested.',
    perPlatform: [],
    insight: null,
  };
}

// ── Caption dedupe helpers ──────────────────────────────────────────────────

/**
 * Pull the user's last N published captions from the Content collection.
 * Used to (a) prompt the LLM to avoid mimicry and (b) post-filter
 * generated variants that are too similar to what already shipped.
 * Best-effort — returns [] on any failure so we never block suggestion
 * building over a stale captions index.
 */
async function fetchRecentCaptions(userId, limit = 20) {
  if (!userId) return [];
  try {
    const Content = require('../models/Content');
    const { ensureObjectId } = require('../utils/devUser');
    const uid = ensureObjectId(userId);
    const rows = await Content.aggregate([
      { $match: { userId: uid } },
      { $project: { clips: { $ifNull: ['$generatedContent.shortVideos', []] } } },
      { $unwind: '$clips' },
      { $match: {
        'clips.published': true,
        // $ne can't appear twice in one object (the second silently wins, so
        // the $ne:null check was being dropped). $nin excludes both null and
        // empty-string, which is the real intent.
        'clips.publishedCaption': { $exists: true, $nin: [null, ''] },
      } },
      { $sort: { 'clips.publishedAt': -1 } },
      { $limit: limit },
      { $project: {
        _id: 0,
        caption:   '$clips.publishedCaption',
        platform:  '$clips.publishedPlatform',
        publishedAt: '$clips.publishedAt',
      } },
    ]);
    return Array.isArray(rows) ? rows : [];
  } catch (e) {
    logger.warn('smartPublish: fetchRecentCaptions failed', { error: e.message });
    return [];
  }
}

function groupByPlatform(rows) {
  const out = { __all__: [] };
  for (const r of rows) {
    out.__all__.push(r);
    const p = (r.platform || '').toLowerCase();
    if (!p) continue;
    if (!out[p]) out[p] = [];
    out[p].push(r);
  }
  return out;
}

function tokenize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3);
}

/**
 * Token-set Jaccard similarity. >0.85 means "essentially the same
 * caption." Cheap to compute and more forgiving of word-order variation
 * than Levenshtein. Empty inputs return 0 (treated as not-similar so we
 * never accidentally drop a perfectly fine suggestion against an empty
 * recent list).
 */
function jaccardSimilarity(a, b) {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  ta.forEach(t => { if (tb.has(t)) inter++; });
  return inter / (ta.size + tb.size - inter);
}

const NEAR_DUPLICATE_THRESHOLD = 0.85;
function isNearDuplicate(candidate, recents) {
  if (!candidate || !Array.isArray(recents) || recents.length === 0) return false;
  for (const r of recents) {
    if (jaccardSimilarity(candidate, r) >= NEAR_DUPLICATE_THRESHOLD) return true;
  }
  return false;
}

module.exports = { buildPublishSuggestion };
