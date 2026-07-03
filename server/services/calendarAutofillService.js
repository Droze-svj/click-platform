// Content Calendar Autofill
// Turns AI-generated content ideas into DRAFT ScheduledPosts (status
// 'pending_approval') spread across future time slots, so a creator can fill a
// week/month of the calendar in one click and then review + confirm. Nothing
// goes live until approved — the scheduler cron only fires 'scheduled' posts.

const crypto = require('crypto');
const ScheduledPost = require('../models/ScheduledPost');
const logger = require('../utils/logger');

// Platforms the ScheduledPost schema accepts (mirror of its enum). Used to
// validate the requested set and to sanitise an idea's suggested platform.
const VALID_PLATFORMS = [
  'instagram', 'tiktok', 'youtube', 'twitter',
  'linkedin', 'facebook', 'pinterest', 'threads',
];

const HOUR_MS = 3600 * 1000;

/** A stable, source-tagged grouping id so a plan's drafts can be listed/approved together. */
function newPlanId() {
  return `cal_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Map AI ideas → draft ScheduledPost rows, one per idea, spread across future
 * slots starting at `startAt` every `cadenceHours`. Pure (no I/O) so it is
 * unit-testable without a DB or the AI.
 *
 * @param {string} userId  canonical Mongo user id (req.user._id)
 * @param {Array}  ideas   [{ title, description, hook, platform, potential }]
 * @param {object} opts    { platforms, niche, startAt(ms), cadenceHours, planId, dryRun }
 */
function buildDraftRows(userId, ideas, opts = {}) {
  const requested = (Array.isArray(opts.platforms) ? opts.platforms : [])
    .filter((p) => VALID_PLATFORMS.includes(p));
  const platforms = requested.length ? requested : ['tiktok'];
  const cadenceHours = Number.isFinite(opts.cadenceHours) && opts.cadenceHours > 0
    ? opts.cadenceHours : 24;
  const startAt = Number.isFinite(opts.startAt) ? opts.startAt : Date.now() + 24 * HOUR_MS;
  const planId = opts.planId || newPlanId();

  return (Array.isArray(ideas) ? ideas : []).map((idea, i) => {
    // Honour the idea's suggested platform only if the caller asked for it;
    // otherwise round-robin through the requested set so the week is balanced.
    const suggested = idea && idea.platform;
    const platform = requested.includes(suggested) ? suggested : platforms[i % platforms.length];

    const title = (idea && idea.title) ? String(idea.title).trim() : '';
    const hook = (idea && idea.hook) ? String(idea.hook).trim() : '';
    const description = (idea && idea.description) ? String(idea.description).trim() : '';
    // The draft caption seeds the editor — hook first (the first 3 seconds),
    // then the execution note. Falls back to the title so text is never empty.
    const text = [hook, description].filter(Boolean).join('\n\n') || title;

    return {
      userId: String(userId),
      autopilotPlanId: planId, // reuse the indexed grouping field (cal_-prefixed)
      platform,
      content: { text, hashtags: [] },
      niche: opts.niche || undefined,
      scheduledTime: new Date(startAt + i * cadenceHours * HOUR_MS),
      status: 'pending_approval', // held for human review; cron won't fire it
      dryRun: !!opts.dryRun,
    };
  });
}

/**
 * Build the drafts and persist them (unless dryRun). Returns the plan id, the
 * created (or previewed) rows, and the resolved count.
 */
async function createCalendarDrafts(userId, ideas, opts = {}) {
  const planId = opts.planId || newPlanId();
  const rows = buildDraftRows(userId, ideas, { ...opts, planId });
  if (!rows.length) return { planId, count: 0, posts: [] };
  if (opts.dryRun) return { planId, count: rows.length, posts: rows, dryRun: true };
  const posts = await ScheduledPost.insertMany(rows);
  logger.info('[calendarAutofill] drafts created', { userId: String(userId), planId, count: posts.length });
  return { planId, count: posts.length, posts };
}

/** List the caller's autofill drafts (pending_approval, cal_-grouped), paginated. */
async function listCalendarDrafts(userId, { limit = 50, skip = 0 } = {}) {
  return ScheduledPost.find({
    userId: String(userId),
    status: 'pending_approval',
    autopilotPlanId: { $regex: '^cal_' },
  })
    .sort({ scheduledTime: 1 })
    .skip(skip)
    .limit(limit)
    .lean();
}

/**
 * Approve a plan: flip its still-pending drafts to 'scheduled' so the cron will
 * publish them at their slot. Scoped to the caller and to cal_-prefixed plans so
 * one user can't approve another's (or a non-calendar autopilot) plan.
 */
async function approveCalendarPlan(userId, planId) {
  if (!/^cal_[a-f0-9]+$/.test(String(planId || ''))) {
    const err = new Error('Invalid plan id'); err.statusCode = 400; throw err;
  }
  const r = await ScheduledPost.updateMany(
    { userId: String(userId), autopilotPlanId: String(planId), status: 'pending_approval' },
    { $set: { status: 'scheduled' } },
  );
  return { planId, approved: r.modifiedCount || 0 };
}

/** Cancel a plan: mark its still-pending drafts 'cancelled'. Same scoping rules. */
async function cancelCalendarPlan(userId, planId) {
  if (!/^cal_[a-f0-9]+$/.test(String(planId || ''))) {
    const err = new Error('Invalid plan id'); err.statusCode = 400; throw err;
  }
  const r = await ScheduledPost.updateMany(
    { userId: String(userId), autopilotPlanId: String(planId), status: 'pending_approval' },
    { $set: { status: 'cancelled' } },
  );
  return { planId, cancelled: r.modifiedCount || 0 };
}

module.exports = {
  VALID_PLATFORMS,
  newPlanId,
  buildDraftRows,
  createCalendarDrafts,
  listCalendarDrafts,
  approveCalendarPlan,
  cancelCalendarPlan,
};
