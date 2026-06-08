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
      // The tier that ACTUALLY unlocks this feature right now — honours the
      // Agency-first rollout schedule so a descended feature upsells the cheaper
      // tier, not the original Agency one. Fallback 'creator' if unknown.
      const unlockTier = entitlements.effectiveMinTier(feature)
        || entitlements.FEATURES[feature]?.minTier || 'creator'

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
  const enforcement = require('../services/entitlementEnforcement');
  const cap = EXPORT_CAPS[userTier] ?? 3;

  if (!isFinite(cap)) {
    req.exportQuota = { cap: Infinity, used: 0, remaining: Infinity };
    return next(); // unlimited tier (pro / agency / trial⇒pro)
  }

  try {
    const userId = req.user?.id || req.user?._id;
    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);

    // Prefer the real metered counter (User.usage.exports, lazily monthly-reset);
    // fall back to counting ExportJob docs this month if the counter is absent
    // (e.g. legacy users who haven't exported since the counter was added).
    const usageService = require('../services/usageService');
    let count = 0;
    try {
      count = await usageService.getUsage(userId, 'exports');
    } catch (_) {
      count = 0;
    }
    if (!count) {
      try {
        const ExportJob = require('../models/ExportJob');
        count = await ExportJob.countDocuments({
          userId,
          createdAt: { $gte: thisMonthStart },
          status: { $in: ['completed', 'processing', 'pending'] },
        });
      } catch (_) {
        count = 0;
      }
    }

    if (count >= cap) {
      const body = enforcement.limitReachedBody({
        limitKey: 'exportsPerMonth',
        limit: cap,
        used: count,
        currentTier: userTier,
        noun: 'monthly export',
      });
      body.resetDate = new Date(thisMonthStart.getFullYear(), thisMonthStart.getMonth() + 1, 1);
      return res.status(403).json(body);
    }

    req.exportQuota = { cap, used: count, remaining: cap - count };
    next();
  } catch (error) {
    // Quota check infra error: this is a metered limit (not a security gate),
    // so fail OPEN rather than 500 the export. Free users are still watermarked
    // + resolution-capped by the render path regardless.
    next();
  }
}

/**
 * Middleware: enforce the monthly AI-generation cap
 * (LIMITS.aiGenerationsPerMonth — Free 50, Creator 300, Pro/Agency unlimited).
 *
 * Reads the real metered counter (User.usage.contentGenerated, lazily
 * monthly-reset) and blocks with the structured `limit_reached` shape once the
 * cap is hit. costGuard still enforces the $ ceiling independently (402).
 *
 * On a counter-lookup failure this fails OPEN (it's a metered limit, not a
 * security gate, and costGuard remains as the $ backstop) rather than 500.
 * Pair with usageService.incrementUsage(userId, 'contentGenerated') on success.
 */
async function checkGenerationQuota(req, res, next) {
  const userTier = getUserTier(req);
  const cap = entitlements.limitFor(userTier, 'aiGenerationsPerMonth');
  if (!Number.isFinite(cap)) return next(); // unlimited (pro / agency / trial⇒pro)

  try {
    const userId = req.user?.id || req.user?._id;
    const usageService = require('../services/usageService');
    const enforcement = require('../services/entitlementEnforcement');
    const used = await usageService.getUsage(userId, 'contentGenerated');
    if (used >= cap) {
      return res.status(403).json(enforcement.limitReachedBody({
        limitKey: 'aiGenerationsPerMonth',
        limit: cap,
        used,
        currentTier: userTier,
        noun: 'monthly AI generation',
      }));
    }
    req.generationQuota = { cap, used, remaining: cap - used };
    next();
  } catch (error) {
    next(); // fail open — costGuard $ ceiling is the backstop
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
  checkGenerationQuota,
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

