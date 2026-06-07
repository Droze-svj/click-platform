// Platform analytics ingestion cron
// Periodically refreshes per-post metrics for every user with at least one
// connected social account, so downstream consumers (videoMetricsService,
// optimalPostingTimeService, audience insights) read live data.

const cron = require('node-cron');
const mongoose = require('mongoose');
const ScheduledPost = require('../models/ScheduledPost');
const SocialConnection = require('../models/SocialConnection');
const { syncAllUserAnalytics } = require('./platformAnalyticsService');
const { syncAccountInsights } = require('./accountInsightsService');
const logger = require('../utils/logger');

const LOG_CONTEXT = { service: 'platform-ingestion' };

let cronTask = null;
let inFlight = false;

const DEFAULT_PER_USER_LIMIT = parseInt(process.env.ANALYTICS_SYNC_PER_USER_LIMIT || '25', 10);
const DEFAULT_SCHEDULE = process.env.ANALYTICS_SYNC_CRON || '*/15 * * * *'; // every 15 min
const STALE_AFTER_MS = parseInt(process.env.ANALYTICS_RESYNC_STALE_MS || (15 * 60 * 1000).toString(), 10);
// Account-level insights (follower counts / audience) change slowly, so we
// refresh them at most once every few hours per account rather than every tick
// — keeps platform API usage low while still keeping the brain's data fresh.
const ACCOUNT_INSIGHTS_STALE_MS = parseInt(
  process.env.ACCOUNT_INSIGHTS_STALE_MS || (6 * 60 * 60 * 1000).toString(), 10
);

/**
 * Find userIds that have at least one published post needing a refresh.
 * A post needs a refresh if it was never synced or was synced > STALE_AFTER_MS ago.
 */
async function findUsersDuringTick() {
  const staleBefore = new Date(Date.now() - STALE_AFTER_MS);

  const postUserIds = await ScheduledPost.distinct('userId', {
    status: 'posted',
    platformPostId: { $exists: true, $ne: null, $not: /^mock-/ },
    $or: [
      { lastAnalyticsSync: { $exists: false } },
      { lastAnalyticsSync: { $lte: staleBefore } },
    ],
  });

  // Also include users whose connected accounts are due for an account-level
  // insights refresh (follower counts / audience), even if they have no stale
  // posts — so we collect account insights for newly-connected accounts.
  let accountUserIds = [];
  try {
    const insightsStaleBefore = new Date(Date.now() - ACCOUNT_INSIGHTS_STALE_MS);
    accountUserIds = await SocialConnection.distinct('userId', {
      isActive: true,
      $or: [
        { lastInsightsSync: { $exists: false } },
        { lastInsightsSync: null },
        { lastInsightsSync: { $lte: insightsStaleBefore } },
      ],
    });
  } catch (err) {
    logger.debug('account-insights user discovery failed', { ...LOG_CONTEXT, error: err.message });
  }

  // De-dupe across both sources (ObjectIds → string keys).
  const seen = new Map();
  for (const id of [...postUserIds, ...accountUserIds]) {
    seen.set(String(id), id);
  }
  return Array.from(seen.values());
}

/**
 * Has this user's account insights gone stale enough to re-sync this tick?
 * Returns true when at least one active connection is never-synced or older
 * than ACCOUNT_INSIGHTS_STALE_MS, so we don't hit platform APIs every 15 min.
 */
async function accountInsightsDue(userId) {
  try {
    const insightsStaleBefore = new Date(Date.now() - ACCOUNT_INSIGHTS_STALE_MS);
    const due = await SocialConnection.exists({
      userId,
      isActive: true,
      $or: [
        { lastInsightsSync: { $exists: false } },
        { lastInsightsSync: null },
        { lastInsightsSync: { $lte: insightsStaleBefore } },
      ],
    });
    return !!due;
  } catch {
    return false;
  }
}

/**
 * Run a single ingestion tick. Iterates eligible users serially to avoid
 * spiking platform rate limits; per-user errors are isolated.
 */
async function runIngestionTick() {
  if (inFlight) {
    logger.debug('Skipping ingestion tick - previous tick still running', LOG_CONTEXT);
    return { skipped: true };
  }
  if (mongoose.connection.readyState !== 1) {
    return { skipped: true, reason: 'mongo-disconnected' };
  }

  inFlight = true;
  const startedAt = Date.now();
  const summary = { users: 0, synced: 0, failed: 0, accountInsights: 0 };

  try {
    const userIds = await findUsersDuringTick();
    summary.users = userIds.length;

    for (const userId of userIds) {
      try {
        const result = await syncAllUserAnalytics(userId, DEFAULT_PER_USER_LIMIT);
        summary.synced += result.synced || 0;
        summary.failed += result.failed || 0;

        // Account-level insights (follower counts / audience). Isolated so a
        // platform/API failure here can never break per-post analytics or the
        // tick. Gated to the slower cadence so we don't hammer platform APIs.
        try {
          if (await accountInsightsDue(userId)) {
            const ai = await syncAccountInsights(userId);
            summary.accountInsights += ai.synced || 0;
          }
        } catch (aiErr) {
          logger.debug('Account insights sync failed for user', {
            ...LOG_CONTEXT, userId: String(userId), error: aiErr.message,
          });
        }

        // Push a live update to every dashboard tab open for this user so
        // headline stats refresh without polling. Best-effort: socket
        // service may not be initialised yet (cron starts at boot).
        if ((result.synced || 0) > 0) {
          try {
            const { emitToUser } = require('./socketService');
            emitToUser(String(userId), 'analytics:updated', {
              synced: result.synced,
              failed: result.failed,
              at: new Date().toISOString(),
            });
          } catch { /* socket optional */ }
        }
      } catch (err) {
        summary.failed += 1;
        logger.warn('Per-user ingestion failed', { ...LOG_CONTEXT, userId: String(userId), error: err.message });
      }
    }

    logger.info('Platform ingestion tick complete', {
      ...LOG_CONTEXT,
      ...summary,
      durationMs: Date.now() - startedAt,
    });
    return summary;
  } finally {
    inFlight = false;
  }
}

function startIngestionCron() {
  if (cronTask) {
    logger.debug('Ingestion cron already started', LOG_CONTEXT);
    return cronTask;
  }
  cronTask = cron.schedule(DEFAULT_SCHEDULE, () => {
    runIngestionTick().catch(err => {
      logger.error('Ingestion tick threw', { ...LOG_CONTEXT, error: err.message, stack: err.stack });
    });
  });
  logger.info('Platform ingestion cron started', { ...LOG_CONTEXT, schedule: DEFAULT_SCHEDULE });
  return cronTask;
}

function stopIngestionCron() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }
}

module.exports = {
  startIngestionCron,
  stopIngestionCron,
  runIngestionTick,
};
