/**
 * entitlementEnforcement — pure, DB-free helpers that turn the canonical
 * entitlements config (server/config/entitlements.js) into the STRUCTURED
 * block responses the client consumes for upgrade prompts.
 *
 * Hard enforcement, but honest:
 *   - trial ⇒ pro (via resolveTier) keeps full access
 *   - free stays usable, just limited
 *   - paid tiers unaffected
 *
 * Every block is shaped identically so the client has one branch to handle:
 *   403 {
 *     success: false,
 *     error: 'feature_gated' | 'limit_reached',
 *     feature?, limit?, used?, requiredTier, currentTier,
 *     upgradeUrl: '/dashboard/billing',
 *     message
 *   }
 *
 * This module performs NO database access. Callers pass the already-known
 * tier and current usage count; these functions decide allow/deny and build
 * the response body. That keeps them unit-testable without Mongo.
 */

'use strict';

const entitlements = require('../config/entitlements');
const logger = require('../utils/logger');

const UPGRADE_URL = '/dashboard/billing';

/** The next tier up from `tier` (for upgrade messaging). Caps at 'agency'. */
function nextTierUp(tier) {
  const order = entitlements.tierOrder(tier);
  const higher = entitlements.TIERS.find((t) => t.order > order);
  return higher ? higher.id : 'agency';
}

/**
 * Build a `feature_gated` block body. Used when a tier lacks a feature flag.
 * @param {string} feature   - canonical feature id
 * @param {string} currentTier
 */
function featureGatedBody(feature, currentTier) {
  // effectiveMinTier honours the Agency-first rollout schedule, so once a
  // feature descends the upsell points at the cheaper tier that now unlocks it.
  const requiredTier = entitlements.effectiveMinTier(feature)
    || entitlements.FEATURES[feature]?.minTier || nextTierUp(currentTier);
  const label = entitlements.FEATURES[feature]?.label || feature.replace(/_/g, ' ');
  return {
    success: false,
    error: 'feature_gated',
    feature,
    requiredTier,
    currentTier,
    upgradeUrl: UPGRADE_URL,
    message: `${label} is available on the ${requiredTier} plan. Upgrade to unlock it.`,
  };
}

/**
 * Build a `limit_reached` block body for a numeric cap.
 * @param {object} opts
 * @param {string} opts.limitKey   - canonical LIMITS key (e.g. 'exportsPerMonth')
 * @param {number} opts.limit      - the resolved cap for the current tier
 * @param {number} opts.used       - current usage count
 * @param {string} opts.currentTier
 * @param {string} [opts.noun]     - human noun for the message ("exports", "social accounts")
 */
function limitReachedBody({ limitKey, limit, used, currentTier, noun }) {
  // Find the lowest tier that raises this limit above the current one (or
  // grants unlimited), for honest upgrade targeting.
  let requiredTier = nextTierUp(currentTier);
  for (const t of entitlements.TIERS) {
    if (entitlements.tierOrder(t.id) <= entitlements.tierOrder(currentTier)) continue;
    const cap = entitlements.limitFor(t.id, limitKey);
    if (cap === Infinity || (typeof cap === 'number' && cap > limit)) {
      requiredTier = t.id;
      break;
    }
  }
  const thing = noun || String(limitKey);
  return {
    success: false,
    error: 'limit_reached',
    limit,
    used,
    requiredTier,
    currentTier,
    upgradeUrl: UPGRADE_URL,
    message: `You've reached your ${thing} limit (${limit}) on the ${currentTier} plan. Upgrade to ${requiredTier} for more.`,
  };
}

/**
 * Decide whether a metered action is allowed under a per-tier cap.
 * @param {string} tier
 * @param {string} limitKey  - canonical LIMITS key
 * @param {number} used      - current usage count
 * @returns {{ allowed: boolean, limit: number, used: number }}
 *          `limit` is Infinity for unlimited tiers.
 */
function checkLimit(tier, limitKey, used) {
  const limit = entitlements.limitFor(tier, limitKey);
  // Fail CLOSED on an unknown limit key (typo / removed key). This is a hard
  // enforcement path — silently granting Infinity would bypass the cap entirely,
  // the opposite of the fail-closed posture used elsewhere. Surface it loudly.
  if (limit === undefined) {
    logger.error('[entitlements] checkLimit called with unknown limit key', { tier, limitKey });
    return { allowed: false, limit: 0, used };
  }
  if (!Number.isFinite(limit)) return { allowed: true, limit, used };
  return { allowed: used < limit, limit, used };
}

/**
 * Clamp a requested export resolution (max dimension, e.g. 1080) down to the
 * tier's maxResolution. Never errors — clamps. Returns the resolved height
 * plus whether it was clamped (for client messaging).
 * @param {string} tier
 * @param {number} requested  - requested max dimension (e.g. 2160)
 */
function clampResolution(tier, requested) {
  const max = entitlements.limitFor(tier, 'maxResolution');
  const cap = Number.isFinite(max) ? max : Infinity;
  const req = Number(requested);
  if (!Number.isFinite(req) || req <= 0) {
    // No/invalid request → give the tier's max (finite) or a safe 1080 default.
    const resolved = Number.isFinite(cap) ? cap : 2160;
    return { resolved, clamped: false, max: cap };
  }
  if (req > cap) return { resolved: cap, clamped: true, max: cap };
  return { resolved: req, clamped: false, max: cap };
}

/**
 * Clamp a [width,height] pair so the larger dimension does not exceed the
 * tier's maxResolution, preserving aspect ratio. Even dimensions (h264-safe).
 * @param {string} tier
 * @param {number} width
 * @param {number} height
 */
function clampDimensions(tier, width, height) {
  const max = entitlements.limitFor(tier, 'maxResolution');
  const cap = Number.isFinite(max) ? max : Infinity;
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  const longSide = Math.max(w, h);
  if (!Number.isFinite(cap) || longSide <= cap || longSide <= 0) {
    return { width: w, height: h, clamped: false, max: cap };
  }
  const scale = cap / longSide;
  const cw = Math.max(2, Math.round((w * scale) / 2) * 2);
  const ch = Math.max(2, Math.round((h * scale) / 2) * 2);
  return { width: cw, height: ch, clamped: true, max: cap };
}

/** Whether the Click watermark must be forced for this tier (Free only). */
function mustWatermark(tier) {
  return !entitlements.hasFeature(tier, 'export_unlimited') && tier === 'free';
}

/**
 * Clamp the number of requested repurpose variants down to the tier's
 * repurposeVariantsMax (Free 1, Creator 2, Pro/Agency 4). Never errors —
 * clamps. Always returns at least 1 so a repurpose request can never resolve to
 * zero work. Returns the allowed count + whether it was clamped (for client
 * upsell messaging).
 * @param {string} tier
 * @param {number} requested - how many variants the caller asked for
 */
function clampVariants(tier, requested) {
  const max = entitlements.limitFor(tier, 'repurposeVariantsMax');
  const cap = Number.isFinite(max) ? max : Infinity;
  const req = Math.floor(Number(requested));
  const want = Number.isFinite(req) && req > 0 ? req : 1;
  if (want > cap) return { allowed: Math.max(1, cap), clamped: true, max: cap };
  return { allowed: want, clamped: false, max: cap };
}

module.exports = {
  UPGRADE_URL,
  nextTierUp,
  featureGatedBody,
  limitReachedBody,
  checkLimit,
  clampResolution,
  clampDimensions,
  clampVariants,
  mustWatermark,
};
