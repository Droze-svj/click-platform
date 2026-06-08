// Unit tests for the per-tier AI intelligence ladder (server/config/aiProfiles.js)
// and the anthropicAI resolution that consumes it. Guarantees:
//   - Agency is the strongest profile on every axis (the flagship edge).
//   - The ladder is monotonic and accuracy-preserving (same model everywhere).
//   - Unknown/missing tiers fail SAFE to the free profile.
//   - Callers that pass no tier/profile behave exactly as before profiles existed.

const {
  AI_PROFILES,
  DEFAULT_PROFILE,
  aiProfileForTier,
  publicAiProfile,
} = require('../../../server/config/aiProfiles');

const TIERS = ['free', 'creator', 'pro', 'agency'];

describe('aiProfiles — per-tier intelligence ladder', () => {
  it('defines a profile for every canonical tier', () => {
    TIERS.forEach((t) => expect(AI_PROFILES[t]).toBeDefined());
  });

  it('uses the SAME top model for every tier (accuracy preserved, never downgraded)', () => {
    TIERS.forEach((t) => expect(AI_PROFILES[t].model).toBe('claude-opus-4-8'));
  });

  it('makes Agency the strongest profile on every axis', () => {
    const agency = AI_PROFILES.agency;
    TIERS.filter((t) => t !== 'agency').forEach((t) => {
      expect(agency.maxTokens).toBeGreaterThanOrEqual(AI_PROFILES[t].maxTokens);
      expect(agency.maxWebSearches).toBeGreaterThanOrEqual(AI_PROFILES[t].maxWebSearches);
    });
    expect(agency.maxTokens).toBeGreaterThan(AI_PROFILES.pro.maxTokens);
    expect(agency.maxWebSearches).toBeGreaterThan(AI_PROFILES.pro.maxWebSearches);
    expect(agency.premiumTools).toBe(true);
  });

  it('is a monotonic non-decreasing ladder for tokens and web depth', () => {
    for (let i = 1; i < TIERS.length; i++) {
      const lo = AI_PROFILES[TIERS[i - 1]];
      const hi = AI_PROFILES[TIERS[i]];
      expect(hi.maxTokens).toBeGreaterThanOrEqual(lo.maxTokens);
      expect(hi.maxWebSearches).toBeGreaterThanOrEqual(lo.maxWebSearches);
    }
  });

  it('only Agency unlocks premium tools (new-tools-first hook)', () => {
    expect(AI_PROFILES.free.premiumTools).toBe(false);
    expect(AI_PROFILES.creator.premiumTools).toBe(false);
    expect(AI_PROFILES.pro.premiumTools).toBe(false);
    expect(AI_PROFILES.agency.premiumTools).toBe(true);
  });

  it('keeps free off the live web (honest non-web path), Agency deepest', () => {
    expect(AI_PROFILES.free.maxWebSearches).toBe(0);
    expect(AI_PROFILES.agency.maxWebSearches).toBe(8);
  });

  describe('aiProfileForTier', () => {
    it('maps each tier to its profile', () => {
      TIERS.forEach((t) => expect(aiProfileForTier(t).label).toBe(AI_PROFILES[t].label));
    });

    it('fails SAFE to the free profile for unknown/missing input', () => {
      expect(aiProfileForTier('enterprise').label).toBe(AI_PROFILES.free.label);
      expect(aiProfileForTier(undefined).label).toBe(AI_PROFILES.free.label);
      expect(aiProfileForTier(null).label).toBe(AI_PROFILES.free.label);
      expect(aiProfileForTier('').label).toBe(AI_PROFILES.free.label);
    });

    it('resolves a user object through entitlements.resolveTier', () => {
      // explicit agency plan
      expect(aiProfileForTier({ subscription: { plan: 'agency' } }).label).toBe('Agency Elite AI');
      // unknown/no plan -> free (fail safe)
      expect(aiProfileForTier({}).label).toBe('Standard AI');
    });

    it('returns a frozen copy (callers cannot mutate the shared config)', () => {
      const p = aiProfileForTier('agency');
      expect(Object.isFrozen(p)).toBe(true);
    });
  });

  describe('publicAiProfile — honest client view', () => {
    it('derives deepReasoning/liveWeb truthfully from the real params', () => {
      const free = publicAiProfile('free');
      expect(free.liveWeb).toBe(false);
      expect(free.deepReasoning).toBe(false);

      const agency = publicAiProfile('agency');
      expect(agency.liveWeb).toBe(true);
      expect(agency.deepReasoning).toBe(true);
      expect(agency.label).toBe('Agency Elite AI');
      expect(agency.maxWebSearches).toBe(8);
    });
  });

  describe('DEFAULT_PROFILE — backward-compat guard', () => {
    it('matches the pre-profiles default behavior (effort high, 16000 tokens, 4 searches)', () => {
      expect(DEFAULT_PROFILE.effort).toBe('high');
      expect(DEFAULT_PROFILE.maxTokens).toBe(16000);
      expect(DEFAULT_PROFILE.maxWebSearches).toBe(4);
      expect(DEFAULT_PROFILE.model).toBe('claude-opus-4-8');
    });
  });
});
