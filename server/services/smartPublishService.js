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

  // Build a content-shaped payload for reformatForPlatform — it expects
  // { _id, title, body, transcript, userId } and we feed it the clip's
  // caption + hook + parent contentId so the LLM has enough context.
  const contentPayload = {
    _id: contentId,
    userId,
    title: clip.caption || clip.hookText || 'Untitled clip',
    body: [clip.hookText, clip.caption, ...(clip.editsApplied || [])].filter(Boolean).join('\n'),
  };

  // Run all platforms in parallel. Each call is independent and one
  // platform's failure should not block the others.
  const perPlatform = await Promise.all(platforms.map(async (platform) => {
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
        captions = variants.map((v) => v.caption).filter(Boolean);
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
  const captions = {};
  const hashtags = {};
  const recommendedSlots = [];

  for (const p of perPlatform) {
    captions[p.platform] = p.captions[0] || null;
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
    hashtags: {},
    recommendedSlots: [],
    rationale: 'No platforms requested.',
    perPlatform: [],
    insight: null,
  };
}

module.exports = { buildPublishSuggestion };
