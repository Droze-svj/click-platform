/**
 * planLimitsService — single source of truth for per-tier feature caps.
 *
 * Read by anywhere we enforce a quota (AI auto-edit clip count, retention,
 * etc.) so the limit table is one file rather than scattered constants.
 *
 * Resolution order:
 *   1. user.subscription.plan (User model field)
 *   2. fallback to 'free'
 *
 * Trial users inherit Creator caps so the trial is meaningful but capped.
 */

const entitlements = require('../config/entitlements');

/**
 * Build a PLAN_LIMITS row from the canonical entitlements config so this
 * service no longer owns its own numbers. `aiClipCount` is the per-request clip
 * cap (we keep the historical creator=10 / pro=30 / agency=100 values, derived
 * here as a fraction of the canonical clipCountPerDay so they stay in sync).
 * `aiClipsPerDay` and `retentionDays` come straight from LIMITS.
 */
function rowFromTier(tierId, label) {
  const perDay = entitlements.limitFor(tierId, 'clipCountPerDay');
  // Historical per-request caps preserved: free 3, creator 10, pro 30, agency 100.
  const perRequest = { free: 3, creator: 10, pro: 30, agency: 100 }[tierId] ?? 3;
  return {
    label,
    aiClipCount: perRequest,
    aiClipsPerDay: Number.isFinite(perDay) ? perDay : perRequest,
    retentionDays: entitlements.limitFor(tierId, 'retentionDays'),
    advancedOptions: tierId !== 'free',
  };
}

const PLAN_LIMITS = {
  free: rowFromTier('free', 'Free'),
  creator: rowFromTier('creator', 'Creator'),
  // Legacy 'trial' key kept so callers passing a literal 'trial' plan still
  // resolve a row. Trial maps to pro-level access per canonical resolveTier,
  // but its clip caps stay at the historically gentler values.
  trial: { label: 'Trial', aiClipCount: 10, aiClipsPerDay: 30, retentionDays: 14, advancedOptions: true },
  pro: rowFromTier('pro', 'Pro'),
  agency: rowFromTier('agency', 'Agency'),
};

function planForUser(user) {
  const raw = user?.subscription?.plan || user?.plan || 'free';
  return PLAN_LIMITS[raw] ? raw : 'free';
}

function getLimits(user) {
  return PLAN_LIMITS[planForUser(user)];
}

/**
 * Clamp a requested clip count to the user's tier cap. Returns the resolved
 * value plus diagnostics so callers can surface "you asked for 50 but your
 * Creator plan caps at 10 — generated 10. Upgrade for more."
 */
function resolveClipCount(user, requested) {
  const limits = getLimits(user);
  const planKey = planForUser(user);
  const requestedNum = Math.max(1, Math.min(500, parseInt(requested, 10) || 1));
  const allowed = Math.min(requestedNum, limits.aiClipCount);
  return {
    plan: planKey,
    planLabel: limits.label,
    requested: requestedNum,
    allowed,
    capped: allowed < requestedNum,
    cap: limits.aiClipCount,
  };
}

module.exports = {
  PLAN_LIMITS,
  planForUser,
  getLimits,
  resolveClipCount,
};
