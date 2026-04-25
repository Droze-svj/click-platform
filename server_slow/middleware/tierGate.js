/**
 * CLICK Pricing Tier Middleware
 * Enforces feature gates based on user subscription tier
 *
 * Tiers (ascending):
 *   free     - 3 exports/month, watermark, 2min max, no AI features
 *   starter  - unlimited basic exports, auto-captions ($9/mo)
 *   creator  - starter + analytics, AI analysis, rewrites ($19/mo)
 *   pro      - creator + 4K, b-roll AI, spatial XR, AI agent ($49/mo)
 *   team     - pro + collaboration, client portal, custom bundles ($99/mo)
 *   elite    - team + generative dubbing, foley, retention heatmap, priority GPU ($199/mo)
 *
 * Usage:
 *   router.post('/export', auth, requireTier('creator'), handler)
 *   router.post('/spatial', auth, requireFeature('spatial_editing'), handler)
 *   router.post('/agent/run', auth, requireFeature('ai_agent'), handler)
 */

const TIER_FEATURES = {
  free: new Set([
    'export_basic',      // up to 3/month, 1080p max
    'filters_basic',     // first 5 filters only
    'text_overlays',     // up to 3 text overlays
    'trim_basic',        // basic trim/cut
  ]),
  starter: new Set([
    'export_basic',
    'export_unlimited',
    'filters_basic',
    'text_overlays',
    'text_unlimited',
    'auto_captions',
    'trim_basic',
  ]),
  creator: new Set([
    'export_basic',
    'export_unlimited',  // no monthly cap
    'export_4k',         // up to 4K
    'filters_all',       // all 17 filters
    'text_overlays',
    'text_unlimited',    // unlimited text overlays
    'auto_captions',     // Whisper auto-captions
    'ai_analysis',       // GPT-4o hook analysis
    'ai_rewrites',       // AI script rewrites
    'style_packs',       // all creativity packs
    'motion_templates',  // all motion graphics
    'trim_basic',
    'trim_advanced',     // J-Cut, L-Cut, freeze frame
    'custom_fonts',      // upload custom .ttf/.woff
  ]),
  pro: new Set([
    ...(['export_basic','export_unlimited','export_4k','filters_all',
      'text_overlays','text_unlimited','auto_captions','ai_analysis',
      'ai_rewrites','style_packs','motion_templates','trim_basic',
      'trim_advanced','custom_fonts',
    ]),
    'creator_analytics',  // Creator Analytics dashboard
    'hook_attribution',   // Style attribution data
    'b_roll_ai',          // AI B-roll suggestions
    'template_publish',   // Publish templates to marketplace
    'priority_render',    // Priority export queue
    'white_label',        // Remove CLICK branding from exports
    // 2026 tier features
    'spatial_editing',    // Apple Vision Pro / Meta Quest XR editing
    'ai_agent',           // Autonomous content pipeline agent
  ]),
  team: new Set([
    ...(['export_basic','export_unlimited','export_4k','filters_all',
      'text_overlays','text_unlimited','auto_captions','ai_analysis',
      'ai_rewrites','style_packs','motion_templates','trim_basic',
      'trim_advanced','custom_fonts','creator_analytics','hook_attribution',
      'b_roll_ai','template_publish','priority_render','white_label',
      'spatial_editing','ai_agent',
    ]),
    'collaboration',       // Real-time multi-user editing
    'team_management',     // Add/remove team members
    'shared_library',      // Shared asset library
    'custom_bundles',      // Save & share custom packs
    'client_portal',       // White-label client portal
    'api_access',          // Developer API
  ]),
  elite: new Set([
    ...(['export_basic','export_unlimited','export_4k','filters_all',
      'text_overlays','text_unlimited','auto_captions','ai_analysis',
      'ai_rewrites','style_packs','motion_templates','trim_basic',
      'trim_advanced','custom_fonts','creator_analytics','hook_attribution',
      'b_roll_ai','template_publish','priority_render','white_label',
      'spatial_editing','ai_agent',
      'collaboration','team_management','shared_library','custom_bundles',
      'client_portal','api_access',
    ]),
    // 2026 Elite-exclusive features
    'generative_dubbing',  // AI voice cloning & 10-language dubbing
    'ai_foley',            // Auto sound design from timeline events
    'retention_heatmap',   // Pre-export retention drop prediction
    'client_feedback_ai',  // AI-parsed client comment action engine
    'priority_gpu',        // Dedicated WebGPU rendering queue
    'webgpu_rendering',    // WebGPU-accelerated 4K real-time preview
  ]),
};


// Monthly export caps
const EXPORT_CAPS = {
  free:    3,
  starter: Infinity,
  creator: Infinity,
  pro:     Infinity,
  team:    Infinity,
  elite:   Infinity,
};

// Max video duration (seconds)
const DURATION_CAPS = {
  free:    120,       // 2 min
  starter: 900,       // 15 min
  creator: 1800,      // 30 min
  pro:     7200,      // 2 hours
  team:    Infinity,
  elite:   Infinity,
};

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
 * Get user tier from request (from auth middleware)
 * Falls back to 'free' if not set
 */
function getUserTier(req) {
  return req.user?.tier || req.user?.subscription?.tier || 'free';
}

/** Ordered tier list for comparison */
const TIER_ORDER = ['free', 'starter', 'creator', 'pro', 'team', 'elite'];

/**
 * Returns true if userTier meets or exceeds requiredTier
 */
function tierMeetsRequirement(userTier, requiredTier) {
  return TIER_ORDER.indexOf(userTier) >= TIER_ORDER.indexOf(requiredTier);
}

/**
 * Middleware: require minimum tier
 * @param {string} minTier - 'free' | 'starter' | 'creator' | 'pro' | 'team' | 'elite'
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
    const features = TIER_FEATURES[userTier] || TIER_FEATURES.free

    if (!features.has(feature)) {
      // Find which tier first unlocks this feature (check all tiers in order)
      const unlockTier = ['starter', 'creator', 'pro', 'team', 'elite'].find(t =>
        TIER_FEATURES[t]?.has(feature)
      ) || 'creator'

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
    // Count exports this month for this user
    // In production, query exportCount from DB
    const userId = req.user?.id;
    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);

    // TODO: Replace with real DB query:
    // const count = await Export.countDocuments({ userId, createdAt: { $gte: thisMonthStart } })
    const count = req.user?.monthlyExports || 0;

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
  const tiers = ['free', 'starter', 'creator', 'pro', 'team', 'elite'];
  const prices = { free: 0, starter: 9, creator: 19, pro: 49, team: 99, elite: 199 };
  const labels = {
    free:    'Free',
    starter: 'Starter',
    creator: 'Creator',
    pro:     'Pro',
    team:    'Team',
    elite:   'Elite 2026',
  };

  res.json({
    tiers: tiers.map(tier => ({
      id: tier,
      label: labels[tier],
      price: prices[tier],
      features: [...TIER_FEATURES[tier]],
      exportCap: isFinite(EXPORT_CAPS[tier]) ? EXPORT_CAPS[tier] : 'unlimited',
      maxDuration: isFinite(DURATION_CAPS[tier]) ? DURATION_CAPS[tier] : 'unlimited',
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
  tierMeetsRequirement,
  TIER_FEATURES,
  EXPORT_CAPS,
  DURATION_CAPS,
  FEATURE_RATE_LIMITS,
  TIER_ORDER,
};

