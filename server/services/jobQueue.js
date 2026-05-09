/**
 * jobQueue.js — per-user concurrency cap for long-running jobs.
 *
 * Without this, /auto-edit's setImmediate loop could spawn N FFmpeg child
 * processes for a single user (the route accepts up to 100 plans on Agency
 * tier). Each FFmpeg job is CPU/IO heavy, so 100 in flight starves the
 * server and makes every other request slow. We cap by tier: free=1,
 * creator=2, pro=4, agency=8 — high enough that paying users feel
 * parallelism, low enough that one user can't monopolize the box.
 *
 * Usage:
 *   const { runForUser, dispose } = require('./jobQueue');
 *   await runForUser(userId, () => doFFmpegWork(), { tier: 'pro' });
 *
 * The wrapped fn() resolves with whatever the inner work resolves to. Errors
 * propagate up so the caller can decide whether to log/retry.
 */

const pLimit = require('p-limit');
const logger = require('../utils/logger');

// Tier → concurrency. Tweak in env if production load suggests different
// numbers (e.g. CONCURRENCY_PRO=6).
const TIER_CONCURRENCY = {
  free: parseInt(process.env.CONCURRENCY_FREE, 10) || 1,
  trial: parseInt(process.env.CONCURRENCY_TRIAL, 10) || 2,
  creator: parseInt(process.env.CONCURRENCY_CREATOR, 10) || 2,
  pro: parseInt(process.env.CONCURRENCY_PRO, 10) || 4,
  agency: parseInt(process.env.CONCURRENCY_AGENCY, 10) || 8,
};

// userId → { limiter, tier, lastUsed }. The lastUsed timestamp lets us
// garbage-collect idle limiters so the Map doesn't grow unboundedly.
const limiters = new Map();
const IDLE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function tierConcurrency(tier) {
  if (!tier) return TIER_CONCURRENCY.free;
  return TIER_CONCURRENCY[String(tier).toLowerCase()] || TIER_CONCURRENCY.free;
}

function getLimiter(userId, tier) {
  const key = String(userId);
  const existing = limiters.get(key);
  const concurrency = tierConcurrency(tier);

  // If the tier changed (user upgraded mid-session) we rebuild the limiter
  // so subsequent jobs respect the new cap. Pending jobs in the old
  // limiter still finish under the old cap — fine, they're already queued.
  if (existing && existing.concurrency === concurrency) {
    existing.lastUsed = Date.now();
    return existing.limiter;
  }

  const limiter = pLimit(concurrency);
  limiters.set(key, { limiter, concurrency, tier, lastUsed: Date.now() });
  return limiter;
}

/**
 * Schedule fn() for a specific user, respecting that user's concurrency cap.
 * Returns a promise that resolves with fn's return value.
 *
 * @param {string} userId
 * @param {() => Promise<any>} fn
 * @param {{ tier?: string, label?: string }} [opts]
 */
function runForUser(userId, fn, opts = {}) {
  const tier = opts.tier || 'free';
  const limiter = getLimiter(userId, tier);
  const queueDepth = limiter.pendingCount + limiter.activeCount;
  if (queueDepth > 0) {
    logger.debug('jobQueue.queueDepth', { userId, tier, queueDepth, label: opts.label });
  }
  return limiter(fn);
}

/**
 * Inspect current queue stats for a user — useful for socket-pushed UI like
 * "you have 3 clips ahead of yours".
 */
function statsForUser(userId) {
  const entry = limiters.get(String(userId));
  if (!entry) return { active: 0, pending: 0, concurrency: 0 };
  return {
    active: entry.limiter.activeCount,
    pending: entry.limiter.pendingCount,
    concurrency: entry.concurrency,
    tier: entry.tier,
  };
}

// Periodic GC. Drop limiters whose user hasn't queued anything in 30 min
// AND have nothing pending. Cheap; runs every 10 min.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of limiters) {
    const idle = now - entry.lastUsed > IDLE_TTL_MS;
    const empty = entry.limiter.activeCount === 0 && entry.limiter.pendingCount === 0;
    if (idle && empty) limiters.delete(key);
  }
}, 10 * 60 * 1000).unref();

module.exports = { runForUser, statsForUser, tierConcurrency };
