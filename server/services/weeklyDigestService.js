// Weekly Performance Digest
// Aggregates each user's last-7-days performance into a stored PerformanceDigest
// (wins, week-over-week trend, platform breakdown, next-best actions) served via
// /api/digest. Generation runs on an OPT-IN, cronLock-guarded weekly cron
// (mirrors alertSweepCronService): OFF unless ENABLE_DIGEST_CRONS=true AND the
// master autonomousMode kill-switch allows it.

const cron = require('node-cron');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { acquire, autonomousModeEnabled } = require('../utils/cronLock');
const PerformanceDigest = require('../models/PerformanceDigest');

const DAY_MS = 24 * 3600 * 1000;
const SWEEP_BATCH = 500;
const MAX_USERS_PER_RUN = 5000;
const LOCK_TTL_MS = 30 * 60 * 1000;

let tasks = [];

/** Floor a timestamp (ms) to UTC midnight so the weekly period is stable. */
function floorToDay(ms) {
  return Math.floor(ms / DAY_MS) * DAY_MS;
}

const round = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Pure: turn gathered analytics into a digest document body. No I/O — unit-tested
 * directly. `thisWeek` / `priorWeek` are getEngagementMetrics-shaped
 * ({ totalEngagement, totalReach, averageEngagementRate, topPerformingContent }).
 */
function buildDigest({ periodStart, periodEnd, thisWeek = {}, priorWeek = {}, nextBest = {} }) {
  const top = Array.isArray(thisWeek.topPerformingContent) ? thisWeek.topPerformingContent : [];

  const wins = top.slice(0, 5).map((p) => ({
    id: p.id != null ? String(p.id) : undefined,
    platform: p.platform,
    engagement: Number(p.engagement) || 0,
    reach: Number(p.reach) || 0,
    postedAt: p.postedAt || undefined,
  }));

  // Group the window's top posts by platform.
  const byPlatform = new Map();
  for (const p of wins) {
    const k = p.platform || 'unknown';
    const cur = byPlatform.get(k) || { platform: k, posts: 0, engagement: 0 };
    cur.posts += 1;
    cur.engagement += p.engagement;
    byPlatform.set(k, cur);
  }
  const platformTrends = [...byPlatform.values()].sort((a, b) => b.engagement - a.engagement);

  // Week-over-week engagement-rate trend.
  const thisRate = Number(thisWeek.averageEngagementRate) || 0;
  const priorRate = Number(priorWeek.averageEngagementRate) || 0;
  let trend;
  let changePct = null;
  if (priorRate <= 0) {
    trend = 'new';
  } else {
    changePct = round(((thisRate - priorRate) / priorRate) * 100);
    trend = thisRate >= priorRate * 1.1 ? 'up' : thisRate <= priorRate * 0.8 ? 'down' : 'stable';
  }

  // Next-best actions — only real ones from the learning loop; otherwise a small
  // honest baseline (advice, never fabricated metrics).
  let nextActions;
  if (nextBest && nextBest.hasRealData && Array.isArray(nextBest.ideas) && nextBest.ideas.length) {
    nextActions = nextBest.ideas.slice(0, 3).map((i) => ({
      source: 'next-best',
      title: i.title || 'Make this next',
      detail: i.why || i.hook || '',
    }));
  } else {
    nextActions = [
      { source: 'baseline', title: 'Keep a steady cadence', detail: 'Publish consistently this week so the engine has enough signal to personalise recommendations.' },
    ];
  }

  const hasData = wins.length > 0 || (Number(thisWeek.totalEngagement) || 0) > 0;

  return {
    periodStart: new Date(periodStart),
    periodEnd: new Date(periodEnd),
    summary: {
      trend,
      changePct,
      totalEngagement: Number(thisWeek.totalEngagement) || 0,
      totalReach: Number(thisWeek.totalReach) || 0,
      avgEngagementRate: round(thisRate),
      postCount: wins.length,
    },
    wins,
    platformTrends,
    nextActions,
    hasData,
  };
}

/**
 * Gather analytics for one user and upsert their digest for the current week.
 * `deps` injects the analytics functions so this is testable without the real
 * services. `now` (ms) is the reference time (the cron passes one).
 */
async function generateDigestForUser(userId, deps, now) {
  const getEngagement = deps.getEngagementMetrics;
  const getNextBest = deps.getNextBest;

  const periodEnd = floorToDay(now);
  const periodStart = periodEnd - 7 * DAY_MS;

  const thisWeek = (await getEngagement(userId, new Date(periodStart))) || {};
  // Prior week ≈ (last 14d) minus (last 7d).
  const twoWeek = (await getEngagement(userId, new Date(periodEnd - 14 * DAY_MS))) || {};
  const priorEngagement = (Number(twoWeek.totalEngagement) || 0) - (Number(thisWeek.totalEngagement) || 0);
  const priorReach = (Number(twoWeek.totalReach) || 0) - (Number(thisWeek.totalReach) || 0);
  const priorWeek = {
    averageEngagementRate: priorReach > 0 ? (priorEngagement / priorReach) * 100 : 0,
  };

  let nextBest = { hasRealData: false, ideas: [] };
  try { nextBest = (await getNextBest(userId, { count: 3 })) || nextBest; } catch (_) { /* honest fallback */ }

  const body = buildDigest({ periodStart, periodEnd, thisWeek, priorWeek, nextBest });

  return PerformanceDigest.findOneAndUpdate(
    { userId: String(userId), periodStart: body.periodStart },
    { $set: { ...body, userId: String(userId) } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

/** Generate digests for all users this run, in memory-bounded keyset pages. */
async function generateWeeklyDigests(now = Date.now()) {
  const User = require('../models/User');
  const bi = require('./businessIntelligenceService');
  const { getNextBest } = require('./nextBestContentService');
  const deps = { getEngagementMetrics: bi.getEngagementMetrics, getNextBest };

  let ok = 0; let failed = 0; let processed = 0; let after = null;
  while (processed < MAX_USERS_PER_RUN) {
    const filter = after ? { _id: { $gt: after } } : {};
    const batch = await User.find(filter).select('_id').sort({ _id: 1 }).limit(SWEEP_BATCH).lean();
    if (!batch.length) break;
    for (const u of batch) {
      try { await generateDigestForUser(u._id, deps, now); ok += 1; } catch (e) {
        failed += 1;
        logger.debug('[digest] user failed', { userId: String(u._id), error: e.message });
      }
    }
    processed += batch.length;
    after = batch[batch.length - 1]._id;
    if (batch.length < SWEEP_BATCH) break;
  }
  logger.info('[digest] weekly generation complete', { processed, ok, failed });
  return { processed, ok, failed };
}

// ── Opt-in cron ──────────────────────────────────────────────────────────────

function digestEnabled() {
  return String(process.env.ENABLE_DIGEST_CRONS || '').toLowerCase() === 'true' && autonomousModeEnabled();
}

async function guarded(name, fn) {
  if (!digestEnabled()) return;
  if (mongoose.connection.readyState !== 1) return;
  const release = await acquire(`digestCron:${name}`, LOCK_TTL_MS);
  if (!release) return; // another instance holds it
  try { await fn(); } catch (err) {
    logger.warn(`[digest] ${name} failed`, { error: err.message });
  } finally { await release(); }
}

function startDigestCron() {
  if (tasks.length) return tasks;
  if (!digestEnabled()) {
    logger.info('[digest] disabled (set ENABLE_DIGEST_CRONS=true to activate).');
    return tasks;
  }
  // Every Monday 08:00 — generate last week's digest for each user.
  tasks.push(cron.schedule('0 8 * * 1', () => { guarded('weekly-digest', () => generateWeeklyDigests()); }));
  logger.info('[digest] started (ENABLE_DIGEST_CRONS=true): weekly generation Mondays 08:00.');
  return tasks;
}

function stopDigestCron() {
  for (const t of tasks) { try { t.stop(); } catch (_) { /* ignore */ } }
  tasks = [];
}

module.exports = {
  buildDigest,
  floorToDay,
  generateDigestForUser,
  generateWeeklyDigests,
  startDigestCron,
  stopDigestCron,
  digestEnabled,
};
