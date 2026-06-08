// Unit tests for the Agency-first rollout mechanism in entitlements.js.
// Guarantees: new tools land Agency-first, auto-descend to Pro on descendOn,
// early-access is derived (not a hand-maintained list), legacy earlyAccess:true
// still works, and there is NO behavior change for "now" (no past descend dates).

const {
  effectiveMinTier,
  isEarlyAccess,
  hasFeature,
  earlyAccessFeatures,
  publicCatalog,
} = require('../../../server/config/entitlements');

// A migrated agency-first feature with a 2027-01-01 descend-to-pro date.
const ROLLING = 'generative_dubbing';
const BEFORE_DESCENT = new Date('2026-06-08').getTime(); // today-ish
const AFTER_DESCENT = new Date('2027-06-01').getTime();  // past descendOn

describe('entitlements — Agency-first rollout', () => {
  describe('effectiveMinTier', () => {
    it('keeps an agency-first feature Agency-only before descendOn', () => {
      expect(effectiveMinTier(ROLLING, BEFORE_DESCENT)).toBe('agency');
    });

    it('widens it to descendTo (pro) once descendOn has passed', () => {
      expect(effectiveMinTier(ROLLING, AFTER_DESCENT)).toBe('pro');
    });

    it('returns the plain minTier for features with no rollout', () => {
      expect(effectiveMinTier('export_basic', BEFORE_DESCENT)).toBe('free');
      expect(effectiveMinTier('b_roll_ai', BEFORE_DESCENT)).toBe('pro');
    });

    it('fails closed (agency) for unknown features', () => {
      expect(effectiveMinTier('does_not_exist')).toBe('agency');
    });
  });

  describe('isEarlyAccess (derived)', () => {
    it('is true for an agency-first feature before its descend date', () => {
      expect(isEarlyAccess(ROLLING, BEFORE_DESCENT)).toBe(true);
    });

    it('is false once the feature has descended', () => {
      expect(isEarlyAccess(ROLLING, AFTER_DESCENT)).toBe(false);
    });

    it('still honours the legacy earlyAccess:true boolean', () => {
      // white_label remains on the legacy flag (a permanent Agency exclusive).
      expect(isEarlyAccess('white_label', BEFORE_DESCENT)).toBe(true);
    });

    it('does NOT flag a plain Pro feature (spatial_editing) as early access', () => {
      // spatial_editing ships at Pro; the contradictory minTier:pro+earlyAccess
      // combo was removed so it is no longer mislabeled as Agency-exclusive.
      expect(isEarlyAccess('spatial_editing', BEFORE_DESCENT)).toBe(false);
    });

    it('is false for ordinary features', () => {
      expect(isEarlyAccess('export_basic')).toBe(false);
      expect(isEarlyAccess('b_roll_ai')).toBe(false);
    });
  });

  describe('hasFeature honours the rollout schedule', () => {
    it('locks a rolling feature to Agency before descent', () => {
      expect(hasFeature('agency', ROLLING, BEFORE_DESCENT)).toBe(true);
      expect(hasFeature('pro', ROLLING, BEFORE_DESCENT)).toBe(false);
      expect(hasFeature('free', ROLLING, BEFORE_DESCENT)).toBe(false);
    });

    it('unlocks it for Pro after descent (auto rolldown, no code change)', () => {
      expect(hasFeature('pro', ROLLING, AFTER_DESCENT)).toBe(true);
      expect(hasFeature('agency', ROLLING, AFTER_DESCENT)).toBe(true);
      expect(hasFeature('creator', ROLLING, AFTER_DESCENT)).toBe(false);
    });

    it('no current-behavior change: agency-first features are Agency-only today', () => {
      // Regression guard — the migrated 2026 flagship features must still be
      // Agency-exclusive right now (descend dates are in the future).
      ['generative_dubbing', 'ai_foley', 'retention_heatmap', 'priority_gpu', 'webgpu_rendering']
        .forEach((id) => {
          expect(hasFeature('agency', id)).toBe(true);
          expect(hasFeature('pro', id)).toBe(false);
        });
    });
  });

  describe('earlyAccessFeatures (derived list)', () => {
    it('includes the agency-first 2026 features right now', () => {
      const list = earlyAccessFeatures();
      expect(list).toEqual(expect.arrayContaining(['generative_dubbing', 'ai_foley', 'white_label']));
    });

    it('drops a feature from the list once it descends', () => {
      const future = earlyAccessFeatures(AFTER_DESCENT);
      expect(future).not.toContain('generative_dubbing');
      // legacy-boolean ones (no descend date) remain early access
      expect(future).toContain('white_label');
    });
  });

  describe('publicCatalog exposes effectiveMinTier + derived earlyAccess', () => {
    it('carries effectiveMinTier on every feature and flags early access', () => {
      const cat = publicCatalog();
      const dub = cat.features.find((f) => f.id === ROLLING);
      expect(dub).toBeDefined();
      expect(dub.minTier).toBe('agency');
      expect(dub.effectiveMinTier).toBe('agency'); // future descend date
      expect(dub.earlyAccess).toBe(true);
    });
  });
});
