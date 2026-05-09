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

const PLAN_LIMITS = {
  free: {
    label: 'Free',
    aiClipCount: 3,
    aiClipsPerDay: 6,
    retentionDays: 14,
    advancedOptions: false,
  },
  creator: {
    label: 'Creator',
    aiClipCount: 10,
    aiClipsPerDay: 50,
    retentionDays: 14,
    advancedOptions: true,
  },
  trial: {
    label: 'Trial',
    aiClipCount: 10,
    aiClipsPerDay: 30,
    retentionDays: 14,
    advancedOptions: true,
  },
  pro: {
    label: 'Pro',
    aiClipCount: 30,
    aiClipsPerDay: 200,
    retentionDays: 14,
    advancedOptions: true,
  },
  agency: {
    label: 'Agency',
    aiClipCount: 100,
    aiClipsPerDay: 1000,
    retentionDays: 14,
    advancedOptions: true,
  },
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
