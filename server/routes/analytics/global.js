/**
 * GET /api/analytics/global — public, aggregate platform counts.
 *
 * Public on purpose (no per-user data, only totals). Cached 5 minutes.
 *
 * Only measured numbers are returned. This endpoint used to substitute
 * hard-coded marketing figures (25,000 creators, 145M clips) whenever a count
 * failed while still labelling the response "live", and it always returned a
 * made-up 312% "brand lift" and 99.9% uptime. A count that can't be read is
 * now `null`, and `source` is "live" only when every count was measured.
 */

const express = require('express');
const logger = require('../../utils/logger');
const redisCache = require('../../utils/redisCache');

const router = express.Router();

const CACHE_KEY = 'click:cache:global-metrics:v2';
const CACHE_TTL_SEC = 300; // 5 min

async function safeCount(modelPath, filter, label) {
  try {
    const Model = require(modelPath);
    return await Model.countDocuments(filter);
  } catch (err) {
    logger.warn(`[analytics/global] ${label} count failed`, { error: err.message });
    return null;
  }
}

router.get('/', async (req, res) => {
  try {
    const cached = await redisCache.get(CACHE_KEY);
    if (cached) return res.json({ ...cached, cached: true });
  } catch (err) {
    logger.warn('[analytics/global] redis read failed', { error: err.message });
  }

  // "Accounts", not "active creators": this counts every account that has not
  // expired, which is all it can honestly claim.
  const [accounts, videos] = await Promise.all([
    safeCount('../../models/User', { 'subscription.status': { $ne: 'expired' } }, 'User'),
    safeCount('../../models/Content', { type: 'video' }, 'Content'),
  ]);

  const measured = accounts !== null && videos !== null;
  const payload = {
    accounts,
    videos,
    lastUpdated: new Date().toISOString(),
    source: measured ? 'live' : 'unavailable',
  };

  // Don't cache a partial/failed read — the next request should try again.
  if (measured) {
    try {
      await redisCache.set(CACHE_KEY, payload, CACHE_TTL_SEC);
    } catch (err) {
      logger.warn('[analytics/global] redis write failed', { error: err.message });
    }
  }

  return res.json(payload);
});

module.exports = router;
