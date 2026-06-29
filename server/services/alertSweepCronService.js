// alertSweepCronService — restores the scheduled automation that used to live in
// jobScheduler.initializeScheduler() (which was never called, so these never ran).
//
// The underlying features still work ON-DEMAND via their routes; this puts their
// periodic sweeps back on a timer — but SAFELY:
//   • OFF BY DEFAULT. These are OUTWARD-FACING (they raise user notifications) and
//     do all-user scans, so they only run when ENABLE_ALERT_SWEEPS=true is set
//     explicitly — turning them on in prod is a deliberate decision, not a silent
//     side-effect of a deploy.
//   • Multi-instance-safe: each sweep takes a distributed cronLock so two
//     instances can't double-run it.
//   • Gated by the master autonomousModeEnabled() kill-switch and a
//     mongo-connected check, and every sweep is wrapped so one failure can't
//     break the others or throw out of the tick.
//   • Bounded: per-user sweeps cap the scan (MAX_USERS_PER_SWEEP).
//
// NOTE: processRecurringSchedules (advancedSchedulingService) is intentionally NOT
// included — recurring posts are already handled by the live recurringPostCron;
// running both would risk double-posting.

const cron = require('node-cron');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { acquire, autonomousModeEnabled } = require('../utils/cronLock');

const MAX_USERS_PER_SWEEP = 5000;
const LOCK_TTL_MS = 30 * 60 * 1000;

let tasks = [];

/** True only when the opt-in flag is set AND the master kill-switch allows crons. */
function sweepsEnabled() {
  return String(process.env.ENABLE_ALERT_SWEEPS || '').toLowerCase() === 'true' && autonomousModeEnabled();
}

/** Run a single named sweep under a cronLock; never throws. */
async function guarded(name, fn) {
  if (!sweepsEnabled()) return;
  if (mongoose.connection.readyState !== 1) return;
  const release = await acquire(`alertSweep:${name}`, LOCK_TTL_MS);
  if (!release) return; // another instance holds it
  try {
    await fn();
  } catch (err) {
    logger.warn(`[alertSweep] ${name} failed`, { error: err.message });
  } finally {
    await release();
  }
}

/** Iterate every user's _id (bounded), invoking fn(userId); accumulates failures. */
async function forEachUser(label, fn) {
  const User = require('../models/User');
  const users = await User.find({}).select('_id').limit(MAX_USERS_PER_SWEEP).lean();
  let ok = 0;
  let failed = 0;
  for (const u of users) {
    try { await fn(u._id); ok += 1; } catch (e) {
      failed += 1;
      logger.debug(`[alertSweep] ${label} user failed`, { userId: String(u._id), error: e.message });
    }
  }
  if (users.length >= MAX_USERS_PER_SWEEP) {
    logger.warn(`[alertSweep] ${label}: hit MAX_USERS_PER_SWEEP cap — some users not swept`, { cap: MAX_USERS_PER_SWEEP });
  }
  logger.info(`[alertSweep] ${label} complete`, { users: users.length, ok, failed });
}

// ── Sweep implementations (lazy-require the services so a missing one can't
// break boot) ───────────────────────────────────────────────────────────────
async function sweepSearchAlerts() {
  const { checkSearchAlerts } = require('./searchAlertService');
  const r = await checkSearchAlerts();
  logger.info('[alertSweep] search alerts checked', r || {});
}
async function sweepAutoReposts() {
  const { processPendingReposts } = require('./autoRepostScheduler');
  const r = await processPendingReposts();
  logger.info('[alertSweep] auto-reposts processed', r || {});
}
async function sweepActiveLibraries() {
  const { processActiveLibraries } = require('./alwaysOnLibraryService');
  const r = await processActiveLibraries();
  logger.info('[alertSweep] always-on libraries processed', { count: Array.isArray(r) ? r.length : undefined });
}
async function sweepBenchmarkAlerts() {
  const { checkBenchmarkAlerts } = require('./contentBenchmarkingService');
  await forEachUser('benchmark-alerts', (uid) => checkBenchmarkAlerts(uid));
}
async function sweepAudienceAlerts() {
  const { checkAudienceAlerts } = require('./audienceAlertService');
  await forEachUser('audience-alerts', (uid) => checkAudienceAlerts(uid));
}
async function sweepRepostAlerts() {
  const { checkRepostAlerts } = require('./repostAlertService');
  await forEachUser('repost-alerts', (uid) => checkRepostAlerts(uid));
}
async function sweepGoalProgress() {
  const { updateGoalProgress } = require('./benchmarkGoalService');
  await forEachUser('goal-progress', (uid) => updateGoalProgress(uid));
}
async function sweepCurationRules() {
  const { executeAllActiveRules } = require('./curationRuleService');
  await forEachUser('curation-rules', (uid) => executeAllActiveRules(uid));
}

function startAlertSweepCron() {
  if (tasks.length) return tasks;
  if (!sweepsEnabled()) {
    logger.info('[alertSweep] disabled (set ENABLE_ALERT_SWEEPS=true to activate the orphaned alert/curation automation).');
    // Still register the tasks so a later env flip works without a redeploy? No —
    // keep it explicit: not enabled at boot ⇒ not scheduled.
    return tasks;
  }
  // Hourly: cheap global sweeps.
  tasks.push(cron.schedule('0 * * * *', () => { guarded('search', sweepSearchAlerts); guarded('reposts', sweepAutoReposts); guarded('libraries', sweepActiveLibraries); }));
  // Every 6h: per-user alert sweeps.
  tasks.push(cron.schedule('0 */6 * * *', () => { guarded('benchmark', sweepBenchmarkAlerts); guarded('audience', sweepAudienceAlerts); guarded('repost', sweepRepostAlerts); }));
  // Daily: per-user progress + curation.
  tasks.push(cron.schedule('0 3 * * *', () => { guarded('goal', sweepGoalProgress); guarded('curation', sweepCurationRules); }));
  logger.info('[alertSweep] started (ENABLE_ALERT_SWEEPS=true): hourly global + 6h per-user alerts + daily progress/curation.');
  return tasks;
}

function stopAlertSweepCron() {
  for (const t of tasks) { try { t.stop(); } catch (_) { /* ignore */ } }
  tasks = [];
}

module.exports = {
  startAlertSweepCron,
  stopAlertSweepCron,
  sweepsEnabled,
  // exported for tests
  guarded,
  forEachUser,
};
