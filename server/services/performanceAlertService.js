/**
 * performanceAlertService — the "you're slipping" early-warning.
 *
 * Compares each creator's rolling RECENT_DAYS engagement rate against their own
 * BASELINE_DAYS baseline (their REAL ScheduledPost analytics — never a fabricated
 * number) and, on a drop past DROP_THRESHOLD, raises ONE honest notification so the
 * creator can course-correct before the slide compounds.
 *
 * Mirrors performanceLearningCron exactly: gated by the autonomousModeEnabled()
 * kill-switch + a distributed cronLock + a mongo-connected check, and never throws
 * into the scheduler. Single-purpose (it only READS analytics + writes a
 * notification — it does NOT touch UserStyleProfile, so the 6h cron stays the only
 * EMA writer). Per-user cooldown so it never spams.
 */

'use strict';

const cron = require('node-cron');
const mongoose = require('mongoose');
const ScheduledPost = require('../models/ScheduledPost');
const logger = require('../utils/logger');

let Sentry = null;
try {
  Sentry = require('@sentry/node');
} catch (_) {
  // Optional in local/dev — mirror performanceLearningCron.
}

const LOG_CONTEXT = { service: 'performance-alert' };
// Default cadence: once a day at 13:00 UTC. Override with PERFORMANCE_ALERT_CRON.
const DEFAULT_SCHEDULE = process.env.PERFORMANCE_ALERT_CRON || '0 13 * * *';
const RECENT_DAYS = parseInt(process.env.PERF_ALERT_RECENT_DAYS || '7', 10);
const BASELINE_DAYS = parseInt(process.env.PERF_ALERT_BASELINE_DAYS || '90', 10);
// A drop of ≥20% vs baseline trips the alert (clamped to a sane band).
const DROP_THRESHOLD = Math.min(0.9, Math.max(0.05, Number(process.env.PERF_ALERT_DROP_THRESHOLD || '0.2')));
// Need at least this many COMPARABLE posts (ones with a real engagement RATE) in
// BOTH windows or we stay silent — 3 is statistical noise, 5 is the floor.
const MIN_SAMPLE = parseInt(process.env.PERF_ALERT_MIN_SAMPLE || '5', 10);
// Below this baseline rate the signal is too weak to call a "drop" off of (guards
// the degenerate tiny-positive baseline that would saturate dropPct → false alert).
const MIN_MEANINGFUL_RATE = Number(process.env.PERF_ALERT_MIN_RATE || '0.001');
const ALERT_COOLDOWN_DAYS = parseInt(process.env.PERF_ALERT_COOLDOWN_DAYS || '7', 10);
const MAX_USERS_PER_TICK = parseInt(process.env.PERF_ALERT_MAX_USERS || '2000', 10);
// Stable marker on the Notification so we can dedupe without a new model field.
const ALERT_MARKER = 'performance-slip';

let cronTask = null;
let lastRunStats = null;

const DAY_MS = 86400000;

// Engagement RATE in [0,1]. REQUIRES a denominator (reach, else impressions) so we
// never blend a raw count with a ratio — mixing the two units across the recent vs
// baseline windows produced false "you're slipping" alerts. A post whose analytics
// haven't settled a denominator yet is EXCLUDED (returns null), not counted raw.
function engagementRate(post) {
  const a = post.analytics || {};
  const denom = a.reach || a.impressions || 0;
  if (denom > 0) return (a.engagement || 0) / denom;
  return null;
}

function mean(arr) {
  return arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0;
}

/**
 * Pure: split posts into the recent vs baseline windows and measure the drop.
 * Stays silent (slipping:false) unless BOTH windows clear MIN_SAMPLE — we never
 * cry wolf off one or two posts.
 */
function evaluateSlip(posts, now = Date.now()) {
  const recentCut = now - RECENT_DAYS * DAY_MS;
  const baselineCut = now - BASELINE_DAYS * DAY_MS;
  const recent = [];
  const baseline = [];
  for (const p of posts || []) {
    const t = p.postedAt ? new Date(p.postedAt).getTime() : NaN;
    if (isNaN(t)) continue;
    const er = engagementRate(p);
    if (er == null) continue;   // no comparable rate yet — skip, don't blend units
    if (t >= recentCut) recent.push({ er, platform: p.platform });
    else if (t >= baselineCut) baseline.push({ er, platform: p.platform });
  }
  if (recent.length < MIN_SAMPLE || baseline.length < MIN_SAMPLE) {
    return { slipping: false, reason: 'insufficient-data', recentSample: recent.length, baselineSample: baseline.length };
  }
  const recentRate = mean(recent.map((r) => r.er));
  const baselineRate = mean(baseline.map((r) => r.er));
  if (baselineRate < MIN_MEANINGFUL_RATE) return { slipping: false, reason: 'baseline-too-weak' };
  const dropPct = (baselineRate - recentRate) / baselineRate;
  const platforms = [...new Set(recent.map((r) => r.platform).filter(Boolean))];
  return {
    slipping: dropPct >= DROP_THRESHOLD,
    reason: dropPct >= DROP_THRESHOLD ? 'drop' : 'stable',
    recentRate,
    baselineRate,
    dropPct,
    recentSample: recent.length,
    baselineSample: baseline.length,
    platforms,
  };
}

/** Load one user's posted analytics over the baseline window and evaluate. */
async function computeUserSlip(userId, { now = Date.now() } = {}) {
  const since = new Date(now - BASELINE_DAYS * DAY_MS);
  const posts = await ScheduledPost.find({
    userId,
    status: 'posted',
    postedAt: { $gte: since },
    'analytics.engagement': { $gt: 0 },
  })
    .select('platform postedAt analytics')
    .lean();
  return evaluateSlip(posts, now);
}

async function alreadyAlertedRecently(userId, now) {
  try {
    const Notification = require('../models/Notification');
    const since = new Date(now - ALERT_COOLDOWN_DAYS * DAY_MS);
    const existing = await Notification.findOne({
      userId,
      'context.entityType': ALERT_MARKER,
      createdAt: { $gte: since },
    })
      .select('_id')
      .lean();
    return !!existing;
  } catch (_) {
    return false;
  }
}

function buildMessage(slip) {
  const pct = Math.round(slip.dropPct * 100);
  const plats = slip.platforms && slip.platforms.length ? ` on ${slip.platforms.slice(0, 3).join(', ')}` : '';
  return `Your last ${RECENT_DAYS} days are averaging about ${pct}% below your usual engagement${plats}. `
    + 'A recent change in style or format is the likely cause — review what you changed and lean back into the hooks that have worked for you.';
}

/**
 * Evaluate one user and, if slipping (and not in cooldown), raise the notification.
 * @returns {Promise<{alerted:boolean, slip:object, reason?:string}>}
 */
async function evaluateAndAlert(userId, { now = Date.now(), force = false } = {}) {
  const slip = await computeUserSlip(userId, { now });
  if (!slip.slipping) return { alerted: false, slip };
  if (!force && (await alreadyAlertedRecently(userId, now))) return { alerted: false, slip, reason: 'cooldown' };
  try {
    const notificationService = require('./notificationService');
    await notificationService.createNotification(
      userId,
      'Your engagement is slipping',
      buildMessage(slip),
      'warning',
      '/dashboard/analytics',
      {
        category: 'system',
        priority: 'high',
        // entityType is our dedupe marker; the numbers are the REAL measured drop.
        context: { entityType: ALERT_MARKER },
        data: {
          dropPct: slip.dropPct,
          recentRate: slip.recentRate,
          baselineRate: slip.baselineRate,
          platforms: slip.platforms,
          recentSample: slip.recentSample,
          baselineSample: slip.baselineSample,
        },
      },
    );
    return { alerted: true, slip };
  } catch (e) {
    logger.warn('[perf-alert] notify failed', { ...LOG_CONTEXT, userId: String(userId), error: e.message });
    return { alerted: false, slip, reason: 'notify-failed' };
  }
}

/** The cron tick — guarded exactly like performanceLearningCron. */
async function runAlertTick({ now = Date.now() } = {}) {
  const { acquire, autonomousModeEnabled } = require('../utils/cronLock');
  if (!autonomousModeEnabled()) return { skipped: true, reason: 'autonomous-disabled' };
  if (mongoose.connection.readyState !== 1) return { skipped: true, reason: 'mongo-disconnected' };
  const release = await acquire('performanceAlert', 60 * 60 * 1000);
  if (!release) return { skipped: true, reason: 'lock-held' };

  const summary = { usersChecked: 0, alerted: 0, failed: 0 };
  const startedAt = Date.now();
  try {
    const since = new Date(now - RECENT_DAYS * DAY_MS);
    // Only creators who actually posted in the recent window are candidates.
    const userIds = await ScheduledPost.distinct('userId', {
      status: 'posted',
      postedAt: { $gte: since },
      'analytics.engagement': { $gt: 0 },
    });
    for (const userId of userIds.slice(0, MAX_USERS_PER_TICK)) {
      summary.usersChecked += 1;
      try {
        const r = await evaluateAndAlert(userId, { now });
        if (r.alerted) summary.alerted += 1;
      } catch (e) {
        summary.failed += 1;
        logger.warn('[perf-alert] user eval failed', { ...LOG_CONTEXT, userId: String(userId), error: e.message });
      }
    }
    lastRunStats = { at: new Date().toISOString(), ok: true, durationMs: Date.now() - startedAt, ...summary };
    try { logger.info('Performance-alert tick complete', { ...LOG_CONTEXT, ...summary }); } catch { /* logger optional */ }
    return summary;
  } catch (err) {
    lastRunStats = { at: new Date().toISOString(), ok: false, error: err && err.message, ...summary };
    if (Sentry && typeof Sentry.captureException === 'function') {
      try { Sentry.captureException(err); } catch (_) { /* sentry optional */ }
    }
    throw err;
  } finally {
    await release();
  }
}

function getLastRunStats() {
  return lastRunStats;
}

function startAlertCron() {
  if (cronTask) {
    logger.debug('Performance-alert cron already started', LOG_CONTEXT);
    return cronTask;
  }
  cronTask = cron.schedule(DEFAULT_SCHEDULE, () => {
    runAlertTick().catch((err) => {
      logger.error('Performance-alert tick threw', { ...LOG_CONTEXT, error: err.message, stack: err.stack });
    });
  });
  logger.info('Performance-alert cron started', { ...LOG_CONTEXT, schedule: DEFAULT_SCHEDULE });
  return cronTask;
}

function stopAlertCron() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }
}

module.exports = {
  evaluateSlip,
  computeUserSlip,
  evaluateAndAlert,
  runAlertTick,
  getLastRunStats,
  startAlertCron,
  stopAlertCron,
  // exported for tests / tuning
  DROP_THRESHOLD,
  RECENT_DAYS,
  BASELINE_DAYS,
  MIN_SAMPLE,
};
