/**
 * DEPRECATED / NEUTRALIZED — do not add new usages.
 *
 * This middleware previously owned its own legacy tier vocabulary
 * (pro/elite/team) and its own status logic, which conflicted with the
 * canonical entitlements config (server/config/entitlements.js). It was
 * unreferenced at the time of the entitlements-enforcement refactor.
 *
 * To avoid a second, drifting source of truth we keep the export name for
 * backwards compatibility but delegate entirely to the canonical tierGate.
 * `requireSubscription([...])` now maps to `requireTier(<lowest canonical tier
 * in the list>)`, so it enforces against resolveTier() (trial⇒pro honoured)
 * and returns the canonical upgrade response. Prefer importing tierGate
 * directly (requireTier / requireFeature) in new code.
 */

'use strict';

const { requireTier } = require('./tierGate');
const entitlements = require('../config/entitlements');

const requireSubscription = (allowedTiers = ['creator']) => {
  // Pick the LOWEST canonical tier referenced, so the gate is "this tier or
  // higher" — matching the historical "allowedTiers.some(...)" intent without
  // the legacy substring matching. Unknown legacy names fold to 'creator'.
  const canonical = (Array.isArray(allowedTiers) ? allowedTiers : [allowedTiers])
    .map((t) => {
      const id = String(t || '').toLowerCase();
      if (entitlements.TIER_IDS.includes(id)) return id;
      // Legacy aliases → canonical.
      if (id === 'elite' || id === 'team') return 'agency';
      if (id === 'starter') return 'creator';
      return 'creator';
    });
  const lowest = canonical.sort(
    (a, b) => entitlements.tierOrder(a) - entitlements.tierOrder(b)
  )[0] || 'creator';
  return requireTier(lowest);
};

module.exports = { requireSubscription };
