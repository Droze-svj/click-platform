// Job Scheduler Service
//
// SINGLE SOURCE OF TRUTH for the scheduled-post cron is now routes/scheduler.js
// (it runs every minute, processes due posts, and calls resetStuckPublishing
// every ~5 min). This module previously also defined `initializeScheduler()` — a
// SECOND, fuller cron set — but nothing ever called it, so it was dead: a
// confusing duplicate of the live post-cron PLUS the only (never-started) wiring
// for several alert automations.
//
// `initializeScheduler()` and its dead helpers (scheduleJob / processScheduledPosts
// / cleanupOldJobs / cleanupDeadLetterJobs — all confirmed to have zero external
// callers) were removed. Only `resetStuckPublishing` is kept, because the live
// routes/scheduler.js cron calls it.
//
// NOTE (surfaced, not silently dropped): the removed initializeScheduler() was
// also the ONLY place that SCHEDULED these alert automations —
//   search alerts, benchmark alerts, audience alerts, repost alerts,
//   curation rules, goal progress, always-on libraries, recurring schedules,
//   auto-reposts.
// Those features still work ON-DEMAND via their routes (audience.js, benchmarking.js,
// recycling.js, curation.js, …); only their automatic/scheduled execution was dead.
// If that automation is wanted, wire the relevant service calls into the live
// routes/scheduler.js cron (with a cronLock for multi-instance safety).

const logger = require('../utils/logger');
const ScheduledPost = require('../models/ScheduledPost');

/**
 * Reset posts stuck in `publishing` state. If the worker crashes between
 * flipping a post to `publishing` and writing its final status, the row
 * parks forever — the scheduler cron won't pick it up (it only scans
 * `scheduled` + `failed_retryable`) and the dashboard shows "still
 * publishing" indefinitely. We sweep anything stuck >10 minutes back to
 * `scheduled` so the next cron tick re-queues it. attemptCount goes up
 * so a permanently bad post eventually flips to `failed_permanent`.
 */
async function resetStuckPublishing() {
  try {
    const cutoff = new Date(Date.now() - 10 * 60 * 1000);
    const result = await ScheduledPost.updateMany(
      {
        status: 'publishing',
        // Use `updatedAt` if the schema has it; otherwise fall back to
        // `scheduledTime` which is always set. Either way, only sweep
        // rows that have been in `publishing` long enough that we're
        // confident the worker is gone, not just slow.
        $or: [
          { updatedAt: { $lt: cutoff } },
          { updatedAt: { $exists: false }, scheduledTime: { $lt: cutoff } },
        ],
      },
      {
        $set: { status: 'scheduled' },
        $inc: { attemptCount: 1 },
      },
    );
    if (result?.modifiedCount > 0) {
      logger.info('Reset stuck-publishing posts', { count: result.modifiedCount });
    }
  } catch (error) {
    logger.error('Failed to reset stuck-publishing posts', { error: error.message });
  }
}

module.exports = {
  // Called by the LIVE scheduler cron (routes/scheduler.js) to recover posts
  // stranded in 'publishing' by a crashed worker.
  resetStuckPublishing,
};
