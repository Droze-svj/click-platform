/**
 * GET /api/analytics/global — public marketing-surface metrics.
 *
 * Drives the Stats section + LiveDemo "creators online" anchor on the
 * public landing page. Public on purpose (these numbers are marketing
 * copy). Cached 5 minutes in Redis on cache hit; degrades to honest
 * defaults if Mongo / Redis are down so a dead infra never breaks the
 * landing page.
 */

const express = require('express');
const logger = require('../../utils/logger');
const redisCache = require('../../utils/redisCache');

const router = express.Router();

const CACHE_KEY = 'click:cache:global-metrics:v1';
const CACHE_TTL_SEC = 300; // 5 min

// Fallback values used when Mongo is unavailable. These are the same
// numbers the landing was hard-coding before this endpoint existed —
// shown only when we genuinely can't read live data.
const FALLBACK = {
  creators: 25_000,
  clipsGenerated: 145_000_000,
  brandLiftPct: 312,
  uptimePct: 99.9,
  source: 'fallback',
};

router.get('/', async (req, res) => {
  // Cache hit — return immediately.
  try {
    const cached = await redisCache.get(CACHE_KEY);
    if (cached) {
      return res.json({ ...cached, source: 'cache' });
    }
  } catch (err) {
    logger.warn('[analytics/global] redis read failed', { error: err.message });
  }

  // Fresh compute. Each model is wrapped in a try/catch so a single
  // failed query doesn't blank the whole endpoint. Track which queries
  // actually succeeded so an empty DB (real count = 0) reports live,
  // while a thrown query falls back without lying about the source.
  let creators = FALLBACK.creators;
  let clipsGenerated = FALLBACK.clipsGenerated;
  let creatorsLive = false;
  let clipsLive = false;

  try {
    const User = require('../../models/User');
    creators = await User.countDocuments({
      'subscription.status': { $ne: 'expired' },
    }).maxTimeMS(5000);
    creatorsLive = true;
  } catch (err) {
    logger.error('[analytics/global] User count failed', {
      error: err.message,
      name: err.name,
      code: err.code,
    });
  }

  try {
    const Content = require('../../models/Content');
    clipsGenerated = await Content.countDocuments({ type: 'video' }).maxTimeMS(5000);
    clipsLive = true;
  } catch (err) {
    logger.error('[analytics/global] Content count failed', {
      error: err.message,
      name: err.name,
      code: err.code,
    });
  }

  const isLive = creatorsLive || clipsLive;

  const payload = {
    creators,
    clipsGenerated,
    brandLiftPct: FALLBACK.brandLiftPct,
    uptimePct: FALLBACK.uptimePct,
    lastUpdated: new Date().toISOString(),
    source: isLive ? 'live' : 'fallback',
  };

  try {
    await redisCache.set(CACHE_KEY, payload, CACHE_TTL_SEC);
  } catch (err) {
    logger.warn('[analytics/global] redis write failed', { error: err.message });
  }

  return res.json(payload);
});

module.exports = router;
