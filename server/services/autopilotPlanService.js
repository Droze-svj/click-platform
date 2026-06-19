// Autonomous publishing engine — builds a multi-platform publish PLAN from a
// content item / clips and (by default) holds it for HUMAN APPROVAL before
// anything goes live. The intelligence (which platform, which optimal slot,
// staggered cadence) is a pure function; the orchestrator persists the plan as
// ScheduledPost rows in `pending_approval` (the scheduler cron only fires
// `scheduled`, so nothing publishes until a human approves → flips to scheduled).

const crypto = require('crypto');
const logger = require('../utils/logger');

const DEFAULT_OPTIMAL_HOUR = {
  tiktok: 18, instagram: 12, youtube: 15, twitter: 9, linkedin: 8,
  facebook: 11, threads: 12, pinterest: 14, snapchat: 17, reddit: 10,
};
const DEFAULT_CADENCE_HOURS = {
  tiktok: 12, instagram: 24, youtube: 24, twitter: 6, linkedin: 24,
  facebook: 24, threads: 12, pinterest: 24, snapchat: 24, reddit: 24,
};

/**
 * PURE: turn N content items into a staggered, optimal-time, multi-platform
 * schedule. Each platform posts its items spaced by the platform's cadence,
 * snapped to its best hour-of-day. status defaults to `pending_approval` (the
 * human-approve gate); pass `scheduled` for full-auto. No I/O → unit-testable.
 * @returns {Array<{contentId,platform,scheduledTime,hook,caption,status,slot}>}
 */
function buildAutopilotPlan(items = [], options = {}) {
  const {
    platforms = ['tiktok'],
    baseTime = null,
    optimalHourByPlatform = {},
    cadenceHoursByPlatform = {},
    status = 'pending_approval',
    hookByPlatform = null,
  } = options;
  const list = (Array.isArray(items) ? items : []).filter(Boolean);
  const base = baseTime != null ? new Date(baseTime) : null;
  const posts = [];
  for (const platform of (Array.isArray(platforms) ? platforms : [])) {
    const hour = Number.isFinite(Number(optimalHourByPlatform[platform]))
      ? Number(optimalHourByPlatform[platform]) : (DEFAULT_OPTIMAL_HOUR[platform] ?? 12);
    const cadence = Number(cadenceHoursByPlatform[platform]) || DEFAULT_CADENCE_HOURS[platform] || 24;
    // First slot = the next optimal hour-of-day at/after base; subsequent slots
    // are spaced by the platform cadence (so same-day posts don't collapse to
    // one time). Each slot is therefore strictly later than the previous.
    let first = null;
    if (base && !Number.isNaN(base.getTime())) {
      first = new Date(base.getTime());
      first.setHours(hour, 0, 0, 0);
      if (first.getTime() <= base.getTime()) first.setDate(first.getDate() + 1);
    }
    list.forEach((item, slot) => {
      const scheduledTime = first
        ? new Date(first.getTime() + slot * cadence * 3600 * 1000).toISOString()
        : null;
      posts.push({
        contentId: item.contentId || item.id || null,
        platform,
        scheduledTime,
        hook: typeof hookByPlatform === 'function' ? hookByPlatform(item, platform) : (item.hook || ''),
        caption: item.caption || item.text || item.hook || '',
        status,
        slot: slot + 1,
      });
    });
  }
  return posts;
}

/**
 * Orchestrate: list the user's connected platforms, build the plan, and persist
 * each post as a ScheduledPost in `pending_approval` (human-approve default) or
 * `scheduled` (full-auto). Returns the plan for review.
 */
async function createAutopilotPlan(userId, opts = {}) {
  const SocialConnection = require('../models/SocialConnection');
  const ScheduledPost = require('../models/ScheduledPost');
  const { items = [], platforms = null, autonomyMode = 'human_approve', niche = null, dryRun = false } = opts;

  if (!Array.isArray(items) || items.length === 0) {
    const e = new Error('No content items to schedule'); e.statusCode = 400; throw e;
  }

  // Only schedule to CONNECTED platforms (never invent a connection).
  const conns = await SocialConnection.find({ userId: String(userId), isActive: true }).select('platform').lean().catch(() => []);
  const connected = [...new Set((conns || []).map((c) => c.platform).filter(Boolean))];
  const targetPlatforms = (platforms && platforms.length ? platforms.filter((p) => connected.includes(p)) : connected);
  if (!targetPlatforms.length) {
    return { planId: null, posts: [], autonomyMode, message: 'No connected platforms — connect an account first.' };
  }

  const status = autonomyMode === 'full_auto' ? 'scheduled' : 'pending_approval';
  const planId = `ap_${crypto.randomBytes(6).toString('hex')}`;
  const plan = buildAutopilotPlan(items, { platforms: targetPlatforms, baseTime: Date.now(), status });

  const rows = plan.map((p) => ({
    userId: String(userId),
    autopilotPlanId: planId,
    contentId: p.contentId || undefined,
    platform: p.platform,
    content: { text: p.caption || p.hook || '', hashtags: [] },
    niche: niche || undefined,
    scheduledTime: p.scheduledTime ? new Date(p.scheduledTime) : new Date(Date.now() + 3600 * 1000),
    status: p.status,
    dryRun: !!dryRun,
  }));
  const created = await ScheduledPost.insertMany(rows);
  logger.info('[autopilot] plan created', { planId, posts: created.length, autonomyMode, status });
  return { planId, autonomyMode, status, posts: plan, count: created.length };
}

/** Human-approve gate: flip a plan's pending_approval posts to scheduled so the
 *  scheduler cron will publish them. */
async function approveAutopilotPlan(userId, planId) {
  const ScheduledPost = require('../models/ScheduledPost');
  const r = await ScheduledPost.updateMany(
    { autopilotPlanId: planId, userId: String(userId), status: 'pending_approval' },
    { $set: { status: 'scheduled' } },
  );
  const approved = r.modifiedCount != null ? r.modifiedCount : r.nModified;
  if (!approved) { const e = new Error('No pending posts found for this plan'); e.statusCode = 404; throw e; }
  logger.info('[autopilot] plan approved', { planId, approved });
  return { planId, approved };
}

/** Cancel a plan (any not-yet-published posts). */
async function cancelAutopilotPlan(userId, planId) {
  const ScheduledPost = require('../models/ScheduledPost');
  const r = await ScheduledPost.updateMany(
    { autopilotPlanId: planId, userId: String(userId), status: { $in: ['pending_approval', 'scheduled'] } },
    { $set: { status: 'cancelled' } },
  );
  return { planId, cancelled: r.modifiedCount != null ? r.modifiedCount : r.nModified };
}

module.exports = { buildAutopilotPlan, createAutopilotPlan, approveAutopilotPlan, cancelAutopilotPlan };
