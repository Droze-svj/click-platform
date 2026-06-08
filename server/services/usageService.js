/**
 * usageService — real, metered usage counters for entitlement enforcement.
 *
 * The canonical caps live in server/config/entitlements.js (LIMITS). The
 * counters they're checked against live on User.usage.* . This service:
 *   - lazily resets the monthly counters when the billing month rolls over
 *     (driven off User.usage.periodStart), so we don't need a cron job;
 *   - atomically increments a counter (and returns the new value);
 *   - reads the current usage for a metered key.
 *
 * "Month" = calendar month in server time. periodStart is normalised to the
 * 1st of the month at 00:00. Counters that reset monthly: exports,
 * contentGenerated (AI generations). videosProcessed etc. are lifetime stats
 * left untouched here.
 */

'use strict';

const logger = require('../utils/logger');

// Counters that are zeroed on each monthly rollover.
const MONTHLY_KEYS = ['exports', 'contentGenerated'];

/** First day of the month containing `d`, at local 00:00. */
function monthStart(d = new Date()) {
  const s = new Date(d);
  s.setDate(1);
  s.setHours(0, 0, 0, 0);
  return s;
}

/**
 * Pure rollover decision: given the stored periodStart, should we reset?
 * Exported for unit testing without a DB.
 * @param {Date|string|null} periodStart
 * @param {Date} [now]
 * @returns {boolean}
 */
function shouldReset(periodStart, now = new Date()) {
  if (!periodStart) return true;
  const ps = monthStart(new Date(periodStart));
  const cur = monthStart(now);
  return ps.getTime() < cur.getTime();
}

/**
 * Lazily reset the monthly counters on a loaded user document if the month
 * has rolled over. Mutates + (optionally) saves the doc. Safe to call on every
 * metered action. No-op for docs without a usable usage object.
 * @param {object} userDoc - a Mongoose User document
 * @param {object} [opts]   - { save = true }
 * @returns {Promise<boolean>} whether a reset happened
 */
async function maybeResetUsage(userDoc, opts = {}) {
  const { save = true } = opts;
  if (!userDoc || typeof userDoc !== 'object') return false;
  userDoc.usage = userDoc.usage || {};
  if (!shouldReset(userDoc.usage.periodStart, new Date())) return false;

  for (const key of MONTHLY_KEYS) userDoc.usage[key] = 0;
  userDoc.usage.periodStart = monthStart(new Date());
  if (save && typeof userDoc.save === 'function') {
    try {
      await userDoc.save();
    } catch (err) {
      logger.warn('[usage] periodStart reset save failed', { error: err.message });
    }
  }
  return true;
}

/**
 * Read a metered counter for a userId, applying a lazy monthly reset first so
 * the returned value reflects the CURRENT period. Returns 0 on any failure
 * (callers decide whether that fails open or closed for their gate).
 * @param {string} userId
 * @param {string} key
 * @returns {Promise<number>}
 */
async function getUsage(userId, key) {
  const User = require('../models/User');
  const user = await User.findById(userId).select('usage');
  if (!user) return 0;
  await maybeResetUsage(user);
  return Number(user.usage?.[key] || 0);
}

/**
 * Atomically increment a metered counter (after a lazy monthly reset) and
 * return the new value. Used to record a completed metered action.
 * @param {string} userId
 * @param {string} key
 * @param {number} [by]
 * @returns {Promise<number>} the new counter value (0 if user/DB unavailable)
 */
async function incrementUsage(userId, key, by = 1) {
  const User = require('../models/User');
  const user = await User.findById(userId);
  if (!user) return 0;
  await maybeResetUsage(user, { save: false });
  user.usage = user.usage || {};
  user.usage[key] = Number(user.usage[key] || 0) + by;
  if (!user.usage.periodStart) user.usage.periodStart = monthStart(new Date());
  await user.save();
  return Number(user.usage[key]);
}

module.exports = {
  MONTHLY_KEYS,
  monthStart,
  shouldReset,
  maybeResetUsage,
  getUsage,
  incrementUsage,
};
