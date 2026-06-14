// Unit tests for entitlementEnforcement — focused on the PR C correctness fixes:
// checkLimit fails CLOSED on unknown keys, and featureGatedBody honours the
// Agency-first rollout (effectiveMinTier) for upgrade targeting.

const enforcement = require('../../../server/services/entitlementEnforcement');

describe('entitlementEnforcement', () => {
  describe('checkLimit', () => {
    it('allows usage under a real cap and blocks at/over it', () => {
      // free exportsPerMonth = 3
      expect(enforcement.checkLimit('free', 'exportsPerMonth', 2).allowed).toBe(true);
      expect(enforcement.checkLimit('free', 'exportsPerMonth', 3).allowed).toBe(false);
    });

    it('treats unlimited tiers (Infinity) as always allowed', () => {
      const r = enforcement.checkLimit('pro', 'exportsPerMonth', 99999);
      expect(r.allowed).toBe(true);
    });

    it('FAILS CLOSED on an unknown limit key (no accidental unlimited)', () => {
      const r = enforcement.checkLimit('free', 'totallyMadeUpKey', 0);
      expect(r.allowed).toBe(false);
      expect(r.limit).toBe(0);
    });
  });

  describe('featureGatedBody', () => {
    it('targets the effective unlock tier (Agency-first feature → agency today)', () => {
      const body = enforcement.featureGatedBody('generative_dubbing', 'free');
      expect(body.error).toBe('feature_gated');
      expect(body.requiredTier).toBe('agency'); // descend date is in the future
      expect(body.currentTier).toBe('free');
    });

    it('uses the feature minTier for a normal feature', () => {
      const body = enforcement.featureGatedBody('b_roll_ai', 'free');
      expect(body.requiredTier).toBe('pro');
    });
  });

  describe('clampVariants (Repurpose Studio per-tier variant cap)', () => {
    it('clamps the request down to the tier max (free 1, creator 2, pro/agency 4)', () => {
      expect(enforcement.clampVariants('free', 4)).toMatchObject({ allowed: 1, clamped: true });
      expect(enforcement.clampVariants('creator', 4)).toMatchObject({ allowed: 2, clamped: true });
      expect(enforcement.clampVariants('pro', 4)).toMatchObject({ allowed: 4, clamped: false });
      expect(enforcement.clampVariants('agency', 10)).toMatchObject({ allowed: 4, clamped: true });
    });

    it('never resolves below 1 variant, even for bad/zero/negative input', () => {
      expect(enforcement.clampVariants('pro', 0).allowed).toBe(1);
      expect(enforcement.clampVariants('pro', -3).allowed).toBe(1);
      expect(enforcement.clampVariants('pro', NaN).allowed).toBe(1);
    });

    it('passes a within-cap request through unclamped', () => {
      expect(enforcement.clampVariants('pro', 2)).toMatchObject({ allowed: 2, clamped: false });
    });
  });
});
