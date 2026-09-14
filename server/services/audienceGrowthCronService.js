// Audience Growth Cron Service
// Automatic daily audience growth syncing.
//
// This file existed and exported startAudienceGrowthCron(), but nothing ever
// called it — the daily sync had never run. Follower/subscriber trends on
// GET /api/audience-growth/:platform/trends only moved when a user happened to
// hit the manual POST /api/audience-growth/sync-all, so for almost everyone the
// growth charts were flat by construction rather than by fact.
//
// Wiring it up as-written would have reintroduced a problem this codebase has
// already fixed elsewhere: the original loaded EVERY active SocialConnection
// into memory in one query, deduped in JS, then synced every user serially with
// no cap and no distributed lock — so every replica would run the whole fan-out
// simultaneously. It now follows the same shape as performanceLearningCron:
// cursor pagination, a per-tick ceiling, the shared cron lock, and the
// autonomous-mode kill switch.

const cron = require('node-cron');
const mongoose = require('mongoose');
const { syncAllPlatformsAudienceGrowth } = require('./audienceGrowthSyncService');
const SocialConnection = require('../models/SocialConnection');
const logger = require('../utils/logger');

const LOG_CONTEXT = { service: 'audience-growth-cron' };

let audienceGrowthJob = null;
// Read-only observability surface; never feeds back into loop logic.
let lastRunStats = null;

// Daily at 03:00. Override for staggering across environments.
const DEFAULT_SCHEDULE = process.env.AUDIENCE_GROWTH_CRON || '0 3 * * *';
// Connections fetched per page. Users are deduped ACROSS pages, so a creator
// with several connected accounts is still synced once.
const PAGE_SIZE = parseInt(process.env.AUDIENCE_GROWTH_PAGE_SIZE || '200', 10);
// Ceiling on users synced per tick. Each sync makes live platform API calls, so
// an unbounded loop would stretch the lock TTL and burn rate limit.
const MAX_USERS_PER_TICK = parseInt(process.env.AUDIENCE_GROWTH_MAX_USERS_PER_TICK || '2000', 10);

/**
 * One page of active connections, ordered by _id so the cursor cannot drift.
 */
async function findConnectionsPage(afterId = null) {
  const filter = { isActive: true };
  if (afterId) filter._id = { $gt: afterId };
  return SocialConnection.find(filter)
    .select('_id userId')
    .sort({ _id: 1 })
    .limit(PAGE_SIZE)
    .lean();
}

/**
 * One tick. Exported so it can be tested and triggered without waiting a day.
 */
async function runAudienceGrowthTick() {
  const { acquire, autonomousModeEnabled } = require('../utils/cronLock');
  if (!autonomousModeEnabled()) return { skipped: true, reason: 'autonomous-disabled' };
  if (mongoose.connection.readyState !== 1) {
    return { skipped: true, reason: 'mongo-disconnected' };
  }

  // 2h TTL — well under the 24h schedule, so a hung tick cannot block tomorrow's.
  const release = await acquire('audienceGrowthSync', 2 * 60 * 60 * 1000);
  if (!release) return { skipped: true, reason: 'lock-held' };

  const startedAt = Date.now();
  const summary = { users: 0, successful: 0, failed: 0, pages: 0, cappedOut: false };
  const seen = new Set();

  try {
    logger.info('Audience growth sync tick start', LOG_CONTEXT);

    let cursor = null;
    while (summary.users < MAX_USERS_PER_TICK) {
      const page = await findConnectionsPage(cursor);
      if (page.length === 0) break;
      summary.pages += 1;
      cursor = page[page.length - 1]._id;

      for (const conn of page) {
        const userId = conn.userId ? String(conn.userId) : null;
        if (!userId || seen.has(userId)) continue;
        seen.add(userId);

        if (summary.users >= MAX_USERS_PER_TICK) {
          summary.cappedOut = true;
          break;
        }
        summary.users += 1;

        try {
          const result = await syncAllPlatformsAudienceGrowth(userId);
          summary.successful += result?.successful || 0;
          summary.failed += result?.failed || 0;
        } catch (error) {
          summary.failed += 1;
          logger.warn('Audience growth sync failed for user', {
            ...LOG_CONTEXT,
            userId,
            error: error.message,
          });
        }
      }

      if (page.length < PAGE_SIZE) break;
    }

    lastRunStats = { ...summary, durationMs: Date.now() - startedAt, at: new Date().toISOString() };
    logger.info('Audience growth sync tick complete', { ...LOG_CONTEXT, ...lastRunStats });
    return lastRunStats;
  } catch (error) {
    logger.error('Audience growth cron error', { ...LOG_CONTEXT, error: error.message });
    return { error: error.message, ...summary };
  } finally {
    try { await release(); } catch { /* lock expiry is the backstop */ }
  }
}

function startAudienceGrowthCron() {
  if (audienceGrowthJob) {
    logger.warn('Audience growth cron already started', LOG_CONTEXT);
    return audienceGrowthJob;
  }

  audienceGrowthJob = cron.schedule(DEFAULT_SCHEDULE, () => {
    runAudienceGrowthTick().catch((error) => {
      logger.error('Audience growth tick threw', { ...LOG_CONTEXT, error: error.message });
    });
  }, { timezone: process.env.TZ || 'UTC' });

  logger.info('Audience growth cron started', { ...LOG_CONTEXT, schedule: DEFAULT_SCHEDULE });
  return audienceGrowthJob;
}

function stopAudienceGrowthCron() {
  if (audienceGrowthJob) {
    audienceGrowthJob.stop();
    audienceGrowthJob = null;
    logger.info('Audience growth cron stopped', LOG_CONTEXT);
  }
}

function getLastRunStats() {
  return lastRunStats;
}

module.exports = {
  startAudienceGrowthCron,
  stopAudienceGrowthCron,
  runAudienceGrowthTick,
  getLastRunStats,
};
