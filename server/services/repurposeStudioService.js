// Smart Repurpose Studio
// One source (a Content doc or raw text) → N platform-native variants (adapted
// copy + hashtags + per-platform aspect/format guidance) returned as a PREVIEW
// (nothing persisted), which the creator reviews/edits and then schedules in one
// click. Reuses contentAdaptationService.adaptForPlatform for the AI adaptation
// so there is no duplicate generation logic.

const crypto = require('crypto');
const ScheduledPost = require('../models/ScheduledPost');
const logger = require('../utils/logger');

const HOUR_MS = 3600 * 1000;
const MAX_VARIANTS = 10;

// Per-platform delivery guidance (aspect ratio + native format). Pure lookup.
const PLATFORM_ASPECT = {
  tiktok: { aspectRatio: '9:16', format: 'vertical short-form video' },
  instagram: { aspectRatio: '9:16', format: 'Reel / vertical' },
  youtube: { aspectRatio: '16:9', format: 'landscape (9:16 for Shorts)' },
  twitter: { aspectRatio: '16:9', format: 'landscape or square' },
  linkedin: { aspectRatio: '1:1', format: 'square / document' },
  facebook: { aspectRatio: '1:1', format: 'square / vertical' },
  pinterest: { aspectRatio: '2:3', format: 'tall pin' },
  threads: { aspectRatio: '1:1', format: 'square / vertical' },
};

const VALID_PLATFORMS = Object.keys(PLATFORM_ASPECT);

function aspectFor(platform) {
  return PLATFORM_ASPECT[platform] || { aspectRatio: '9:16', format: 'vertical' };
}

/** Sanitise + cap the requested platform set (de-duped, known-only, ≤ MAX). */
function normalizePlatforms(platforms) {
  const list = [...new Set((Array.isArray(platforms) ? platforms : []).filter((p) => PLATFORM_ASPECT[p]))]
    .slice(0, MAX_VARIANTS);
  return list.length ? list : ['tiktok'];
}

/**
 * Generate preview variants — one per platform — WITHOUT persisting anything.
 * `adaptFn` is contentAdaptationService.adaptForPlatform (injected so this is
 * unit-testable without the AI). Runs the per-platform adaptations in parallel.
 */
async function buildVariantPreviews({ text, title, userId, platforms }, adaptFn) {
  const list = normalizePlatforms(platforms);
  return Promise.all(list.map(async (platform) => {
    let adapted;
    try {
      adapted = await adaptFn(platform, text, title, userId);
    } catch (e) {
      logger.debug('[repurposeStudio] adapt failed', { platform, error: e.message });
      adapted = { content: text, hashtags: [], score: 70, suggestions: [] };
    }
    return {
      platform,
      content: adapted.content || text || '',
      hashtags: Array.isArray(adapted.hashtags) ? adapted.hashtags : [],
      score: Number.isFinite(adapted.score) ? adapted.score : 85,
      suggestions: Array.isArray(adapted.suggestions) ? adapted.suggestions : [],
      ...aspectFor(platform),
    };
  }));
}

/** A source-tagged grouping id so a batch of scheduled variants stays together. */
function newPlanId() {
  return `rep_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Pure: map reviewed variants → ScheduledPost rows, one per variant on ITS
 * platform, spread across future slots. Drops variants with an unknown platform.
 */
function buildScheduleRows(userId, variants, opts = {}) {
  const cadenceHours = Number.isFinite(opts.cadenceHours) && opts.cadenceHours > 0 ? opts.cadenceHours : 24;
  const startAt = Number.isFinite(opts.startAt) ? opts.startAt : Date.now() + 24 * HOUR_MS;
  const planId = opts.planId || newPlanId();
  const status = opts.status === 'scheduled' ? 'scheduled' : 'pending_approval';

  return (Array.isArray(variants) ? variants : [])
    .filter((v) => v && VALID_PLATFORMS.includes(v.platform))
    .map((v, i) => ({
      userId: String(userId),
      autopilotPlanId: planId,
      platform: v.platform,
      content: {
        text: v.content ? String(v.content) : '',
        hashtags: Array.isArray(v.hashtags) ? v.hashtags : [],
      },
      scheduledTime: new Date(startAt + i * cadenceHours * HOUR_MS),
      status,
      dryRun: !!opts.dryRun,
    }));
}

/** Persist reviewed variants as ScheduledPosts (unless dryRun). */
async function scheduleVariants(userId, variants, opts = {}) {
  const planId = opts.planId || newPlanId();
  const rows = buildScheduleRows(userId, variants, { ...opts, planId });
  if (!rows.length) return { planId, count: 0, posts: [] };
  if (opts.dryRun) return { planId, count: rows.length, posts: rows, dryRun: true };
  const posts = await ScheduledPost.insertMany(rows);
  logger.info('[repurposeStudio] variants scheduled', { userId: String(userId), planId, count: posts.length, status: rows[0].status });
  return { planId, count: posts.length, posts };
}

module.exports = {
  PLATFORM_ASPECT,
  VALID_PLATFORMS,
  MAX_VARIANTS,
  aspectFor,
  normalizePlatforms,
  buildVariantPreviews,
  buildScheduleRows,
  scheduleVariants,
  newPlanId,
};
