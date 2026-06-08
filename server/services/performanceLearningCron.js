// Performance learning cron
//
// Every 6 hours, look for ScheduledPost rows whose analytics have been
// refreshed by the platform ingestion cron since the last learning pass,
// and drain those metrics into UserStyleProfile via
// creatorPerformanceService.ingestPostPerformance.
//
// Without this, the feedback loop only fires when a creator manually
// publishes something through the UI — which means creators who post
// from scheduler-cron flows (the common case) never have their
// performance feed back into prompt biasing. This service closes that
// gap and makes the "improves over time" promise real.

const cron = require('node-cron');
const mongoose = require('mongoose');
const ScheduledPost = require('../models/ScheduledPost');
const { ingestPostPerformance } = require('./creatorPerformanceService');
const logger = require('../utils/logger');

// Optional Sentry — mirror utils/googleAI.js so a missing @sentry/node in
// local/dev never crashes the loop.
let Sentry = null;
try {
  Sentry = require('@sentry/node');
} catch (_) {
  // Optional dependency in some local environments
}

const LOG_CONTEXT = { service: 'performance-learning' };

let cronTask = null;
// In-memory observability surface for GET /api/health/learning. Pure
// read-only state; never feeds back into loop logic.
let lastRunStats = null;
// (inFlight removed — distributed lock from utils/cronLock handles this now)

// Default cadence: every 6 hours. Override with PERFORMANCE_LEARN_CRON.
const DEFAULT_SCHEDULE = process.env.PERFORMANCE_LEARN_CRON || '0 */6 * * *';
// Batch size per page. The cron paginates through ALL eligible posts so
// large creators can't push the tail of the queue into a 60h wait. Cap
// the per-tick total at MAX_PER_TICK to keep a hung Gemini API from
// stretching the lock TTL.
const PAGE_SIZE = parseInt(process.env.PERFORMANCE_LEARN_PAGE_SIZE || '100', 10);
const MAX_PER_TICK = parseInt(process.env.PERFORMANCE_LEARN_MAX_PER_TICK || '5000', 10);

/**
 * Find a page of posts whose analytics have been updated by the
 * ingestion cron since their last performance-learning pass. We track
 * this via a dedicated `lastLearnedAt` field on the post — if missing
 * or older than `analytics.lastUpdated`, the post is eligible.
 *
 * Skipping by ObjectId avoids the classic offset-pagination drift where
 * already-processed posts get re-pulled because `lastLearnedAt` was
 * stamped mid-tick.
 */
async function findEligiblePostsPage(afterId = null) {
  const filter = {
    status: 'posted',
    contentId: { $exists: true, $ne: null },
    'analytics.lastUpdated': { $exists: true },
    $or: [
      { lastLearnedAt: { $exists: false } },
      // Mongo doesn't expose a "field A > field B" comparator without
      // $expr — using it here so we only pick up posts whose analytics
      // have actually moved since the last learning pass.
      { $expr: { $gt: ['$analytics.lastUpdated', '$lastLearnedAt'] } },
    ],
  };
  if (afterId) filter._id = { $gt: afterId };
  return ScheduledPost.find(filter)
    .sort({ _id: 1 })
    .limit(PAGE_SIZE)
    .lean();
}

/**
 * Drain new analytics into UserStyleProfile.
 */
async function runLearningTick() {
  const { acquire, autonomousModeEnabled } = require('../utils/cronLock');
  if (!autonomousModeEnabled()) return { skipped: true, reason: 'autonomous-disabled' };
  if (mongoose.connection.readyState !== 1) {
    return { skipped: true, reason: 'mongo-disconnected' };
  }
  // 5h lock TTL — comfortably below the 6h schedule so a hung tick
  // doesn't block the next replica's run indefinitely. Replaces the
  // in-process `inFlight` flag, which only guarded single-process
  // deployments.
  const release = await acquire('performanceLearning', 5 * 60 * 60 * 1000);
  if (!release) return { skipped: true, reason: 'lock-held' };
  const startedAt = Date.now();
  const summary = { eligible: 0, processed: 0, failed: 0, picksUpdated: 0, pages: 0 };
  // Distinct users whose posts we drained this run — for the observability
  // summary only; not used by loop logic.
  const usersSeen = new Set();
  try {
    try { logger.info('Performance-learn tick start', LOG_CONTEXT); } catch { /* logger optional */ }
    // Paginate through the eligible-posts queue. Previously the cron
    // ran a single `.limit(100)` per tick, so at 1000 eligible posts
    // the tail waited 60h. Cursor on `_id` so we don't re-pull posts
    // we just stamped `lastLearnedAt` on.
    let cursor = null;
    while (summary.processed + summary.failed < MAX_PER_TICK) {
      const page = await findEligiblePostsPage(cursor);
      if (page.length === 0) break;
      summary.pages += 1;
      summary.eligible += page.length;
      for (const p of page) {
        try {
          const r = await ingestPostPerformance({
            userId: p.userId,
            contentId: p.contentId,
            metrics: p.analytics || {},
          });
          summary.processed += 1;
          summary.picksUpdated += r?.updated || 0;
          if (p.userId != null) usersSeen.add(String(p.userId));
          await ScheduledPost.updateOne({ _id: p._id }, { $set: { lastLearnedAt: new Date() } });
        } catch (err) {
          summary.failed += 1;
          logger.warn('Per-post learning failed', { ...LOG_CONTEXT, postId: String(p._id), error: err.message });
        }
      }
      cursor = page[page.length - 1]._id;
      // Safety: if a page returned fewer than PAGE_SIZE we're at the
      // tail of the queue — stop instead of looping forever.
      if (page.length < PAGE_SIZE) break;
    }
    const durationMs = Date.now() - startedAt;
    const usersProcessed = usersSeen.size;
    const postsDrained = summary.processed;
    // Structured END summary requested for prod observability.
    try {
      logger.info('Performance-learn tick complete', {
        ...LOG_CONTEXT,
        ...summary,
        usersProcessed,
        postsDrained,
        durationMs,
      });
    } catch { /* logger optional */ }
    lastRunStats = {
      at: new Date().toISOString(),
      ok: true,
      usersProcessed,
      postsDrained,
      failed: summary.failed,
      picksUpdated: summary.picksUpdated,
      durationMs,
    };
    return summary;
  } catch (err) {
    // Record + report the failure without re-throwing into the loop wrapper's
    // own error path differently — runLearningCron still catches, but we want
    // the Sentry signal close to the failing run.
    const durationMs = Date.now() - startedAt;
    lastRunStats = {
      at: new Date().toISOString(),
      ok: false,
      error: err && err.message,
      usersProcessed: usersSeen.size,
      postsDrained: summary.processed,
      durationMs,
    };
    if (Sentry && typeof Sentry.captureException === 'function') {
      try { Sentry.captureException(err); } catch (_) { /* sentry optional */ }
    }
    throw err;
  } finally {
    await release();
  }
}

/**
 * Read-only snapshot of the last learning tick for the health surface.
 * Never mutates loop state.
 */
function getLastRunStats() {
  return lastRunStats;
}

function startLearningCron() {
  if (cronTask) {
    logger.debug('Performance-learn cron already started', LOG_CONTEXT);
    return cronTask;
  }
  cronTask = cron.schedule(DEFAULT_SCHEDULE, () => {
    runLearningTick().catch((err) => {
      logger.error('Performance-learn tick threw', { ...LOG_CONTEXT, error: err.message, stack: err.stack });
    });
  });
  logger.info('Performance-learn cron started', { ...LOG_CONTEXT, schedule: DEFAULT_SCHEDULE });
  return cronTask;
}

function stopLearningCron() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }
}

module.exports = {
  startLearningCron,
  stopLearningCron,
  runLearningTick,
  getLastRunStats,
};
