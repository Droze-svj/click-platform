/**
 * CLICK Pricing Tier Middleware
 * Enforces feature gates based on user subscription tier.
 *
 * As of the canonical-entitlements refactor this file no longer owns any plan
 * data — it READS everything from server/config/entitlements.js (the single
 * source of truth). The exported middleware names/signatures are unchanged so
 * existing route imports keep working; they just resolve against the canonical
 * config now.
 *
 * Canonical tiers (ascending): free < creator < pro < agency.
 *
 * Usage:
 *   router.post('/export', auth, requireTier('creator'), handler)
 *   router.post('/spatial', auth, requireFeature('spatial_editing'), handler)
 *   router.post('/agent/run', auth, requireFeature('ai_agent'), handler)
 */

const entitlements = require('../config/entitlements');

// ── Canonical-config-derived views (kept as the historical export shapes) ──────
// TIER_FEATURES: { tierId: Set<featureId> } — derived from entitlements so the
// shape downstream code expects (a Set per tier) is preserved.
const TIER_FEATURES = entitlements.TIER_IDS.reduce((acc, tierId) => {
  acc[tierId] = new Set(entitlements.featuresForTier(tierId));
  return acc;
}, {});

// Monthly export caps (derived from LIMITS.exportsPerMonth).
const EXPORT_CAPS = entitlements.TIER_IDS.reduce((acc, tierId) => {
  acc[tierId] = entitlements.limitFor(tierId, 'exportsPerMonth');
  return acc;
}, {});

// Max video duration in seconds (derived from LIMITS.videoDurationSec).
const DURATION_CAPS = entitlements.TIER_IDS.reduce((acc, tierId) => {
  acc[tierId] = entitlements.limitFor(tierId, 'videoDurationSec');
  return acc;
}, {});

// Per-feature rate limits (requests/hour) — future enforcement via Redis
const FEATURE_RATE_LIMITS = {
  ai_agent:          { rpm: 10,  rph: 50  },
  generative_dubbing:{ rpm: 5,   rph: 20  },
  ai_foley:          { rpm: 20,  rph: 100 },
  retention_heatmap: { rpm: 30,  rph: 200 },
  b_roll_ai:         { rpm: 30,  rph: 200 },
  ai_analysis:       { rpm: 60,  rph: 500 },
};


/**
 * Get user tier from request (from auth middleware). Delegates to the canonical
 * resolveTier() so legacy plan values, trials, and explicit plans all resolve
 * identically everywhere. Honours a pre-resolved `req.user.tier` if present.
 */
function getUserTier(req) {
  if (req.user?.tier && entitlements.TIER_IDS.includes(req.user.tier)) {
    return req.user.tier;
  }
  return entitlements.resolveTier(req.user || {});
}

/** Ordered canonical tier list for comparison (free < creator < pro < agency). */
const TIER_ORDER = [...entitlements.TIER_IDS];

/**
 * Returns true if userTier meets or exceeds requiredTier (by canonical order).
 */
function tierMeetsRequirement(userTier, requiredTier) {
  return entitlements.tierOrder(userTier) >= entitlements.tierOrder(requiredTier);
}

/**
 * Middleware: require minimum tier
 * @param {string} minTier - 'free' | 'creator' | 'pro' | 'agency'
 */
function requireTier(minTier) {
  return (req, res, next) => {
    const userTier = getUserTier(req);
    if (!tierMeetsRequirement(userTier, minTier)) {
      return res.status(403).json({
        error: 'upgrade_required',
        message: `This feature requires the ${minTier} plan or higher`,
        requiredTier: minTier,
        currentTier: userTier,
        upgradeUrl: '/dashboard/settings/billing',
      });
    }
    next();
  };
}


/**
 * Redis client — lazy so server still boots without Redis configured.
 * Set REDIS_URL env var to enable rate limiting (e.g. redis://localhost:6379)
 */
let _redisClient = null
function getRedis() {
  if (_redisClient) return _redisClient
  const url = process.env.REDIS_URL
  if (!url) return null
  try {
    const { createClient } = require('redis')
    _redisClient = createClient({ url })
    _redisClient.on('error', (e) => {
      
      _redisClient = null // reset so we retry next time
    })
    _redisClient.connect().catch(() => { _redisClient = null })
    return _redisClient
  } catch {
    return null
  }
}

/**
 * Enforce Redis sliding-window rate limit for a feature.
 * Returns { allowed: true } or { allowed: false, retryAfter }
 */
async function checkFeatureRateLimit(userId, feature) {
  const limits = FEATURE_RATE_LIMITS[feature]
  if (!limits) return { allowed: true }

  const redis = getRedis()
  if (!redis) return { allowed: true } // no Redis → open gate

  try {
    const key = `rl:${feature}:${userId}:hour`
    const now = Math.floor(Date.now() / 1000)
    const windowStart = now - 3600

    const pipeline = redis.multi()
    pipeline.zRemRangeByScore(key, '-inf', windowStart) // prune old requests
    pipeline.zCard(key)                                  // count in window
    pipeline.zAdd(key, { score: now, value: `${now}-${Math.random()}` }) // add current
    pipeline.expire(key, 3600)                           // TTL = 1 hour

    const results = await pipeline.exec()
    const count = results[1] ?? 0

    if (count >= limits.rph) {
      return { allowed: false, retryAfter: 3600, limit: limits.rph, used: count }
    }
    return { allowed: true, limit: limits.rph, used: count }
  } catch (err) {
    
    return { allowed: true } // fail open — don't block users on Redis errors
  }
}

/**
 * Middleware: require specific feature flag + enforce per-feature rate limit
 * @param {string} feature - Feature key from TIER_FEATURES
 */
function requireFeature(feature) {
  return async (req, res, next) => {
    const userTier = getUserTier(req)

    if (!entitlements.hasFeature(userTier, feature)) {
      // The canonical minTier for this feature (fallback 'creator' if unknown).
      const unlockTier = entitlements.FEATURES[feature]?.minTier || 'creator'

      return res.status(403).json({
        error: 'feature_gated',
        message: `${feature.replace(/_/g, ' ')} is available on the ${unlockTier} plan`,
        feature,
        requiredTier: unlockTier,
        currentTier: userTier,
        upgradeUrl: '/dashboard/settings/billing',
      })
    }

    // ── Redis rate limiting ──────────────────────────────────────────────────
    const userId = req.user?.id || req.user?._id || 'anonymous'
    const rateCheck = await checkFeatureRateLimit(String(userId), feature)

    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: 'rate_limit_exceeded',
        message: `You've hit the hourly limit for ${feature.replace(/_/g, ' ')} (${rateCheck.limit} req/hr). Try again shortly.`,
        feature,
        retryAfter: rateCheck.retryAfter,
        limit: rateCheck.limit,
        used: rateCheck.used,
      })
    }

    // Attach rate limit info to request for downstream logging
    req.rateLimit = rateCheck
    next()
  }
}


/**
 * Middleware: check export quota
 * Call this before any export endpoint
 */
async function checkExportQuota(req, res, next) {
  const userTier = getUserTier(req);
  const cap = EXPORT_CAPS[userTier] ?? 3;

  if (!isFinite(cap)) {
    return next(); // unlimited tier
  }

  try {
    const userId = req.user?.id || req.user?._id;
    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);

    const ExportJob = require('../models/ExportJob');
    const count = await ExportJob.countDocuments({
      userId,
      createdAt: { $gte: thisMonthStart },
      status: { $in: ['completed', 'processing', 'pending'] },
    });

    if (count >= cap) {
      return res.status(429).json({
        error: 'export_quota_exceeded',
        message: `You've used all ${cap} exports for this month. Upgrade to Creator for unlimited.`,
        quota: cap,
        used: count,
        resetDate: new Date(thisMonthStart.getFullYear(), thisMonthStart.getMonth() + 1, 1),
        upgradeUrl: '/dashboard/settings/billing',
      });
    }

    req.exportQuota = { cap, used: count, remaining: cap - count };
    next();
  } catch (error) {
    // Don't block if quota check fails
    next();
  }
}

/**
 * Middleware: add watermark flag for free tier
 */
function addTierContext(req, res, next) {
  const userTier = getUserTier(req);
  req.tierContext = {
    tier: userTier,
    features: TIER_FEATURES[userTier] || TIER_FEATURES.free,
    addWatermark: userTier === 'free',
    maxDuration: DURATION_CAPS[userTier] || 120,
    exportCap: EXPORT_CAPS[userTier] || 3,
  };
  next();
}

/**
 * Get feature list for a tier (for frontend feature disclosure)
 * GET /api/tiers
 */
function getTierInfo(req, res) {
  res.json({
    tiers: entitlements.TIERS.map(tier => ({
      id: tier.id,
      label: tier.name,
      price: tier.price.monthlyUsd,
      features: [...TIER_FEATURES[tier.id]],
      exportCap: isFinite(EXPORT_CAPS[tier.id]) ? EXPORT_CAPS[tier.id] : 'unlimited',
      maxDuration: isFinite(DURATION_CAPS[tier.id]) ? DURATION_CAPS[tier.id] : 'unlimited',
    })),
    userTier: getUserTier(req),
  });
}


module.exports = {
  requireTier,
  requireFeature,
  checkExportQuota,
  addTierContext,
  getTierInfo,
  getUserTier,
  tierMeetsRequirement,
  TIER_FEATURES,
  EXPORT_CAPS,
  DURATION_CAPS,
  FEATURE_RATE_LIMITS,
  TIER_ORDER,
};

