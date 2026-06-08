// AI intelligence profiles — the per-tier "how hard does the AI think" ladder.
//
// Click runs the SAME top model (claude-opus-4-8) for every tier, so no paying
// user ever gets a weaker/less-accurate model. What scales with the tier is the
// DEPTH of the work, not its correctness:
//   - effort         — how much the model reasons before answering
//   - maxTokens      — how long/complete the output can be
//   - maxWebSearches — how much LIVE web grounding it does (0 = no live web)
//   - depth/label    — honest, human-readable description surfaced to the user
//   - premiumTools   — gate for "new tools land at Agency first"
//
// Agency is deliberately the strongest profile on every axis — that's the
// flagship edge. Lower tiers stay fully accurate (same model), just less
// exhaustive and less live-web-grounded. This is the single source of truth for
// AI quality; anthropicAI + the entitlements API both read from here.
//
// Owner's #1 rule: nothing here fabricates output. A lower maxWebSearches just
// means fewer real searches; free's 0 means the honest non-web path.

const { resolveTier } = require('./entitlements');

// Canonical effort enum for Opus 4.8: 'low' | 'medium' | 'high' | 'xhigh' | 'max'.
// 'xhigh' is Opus-tier (added in Opus 4.7) and is the deepest setting we use for
// the flagship; if a future model rejects it, drop Agency to 'high' — the rest of
// the ladder (tokens + web depth + premium tools) still keeps Agency on top.
const AI_PROFILES = {
  free: {
    model: 'claude-opus-4-8',
    effort: 'medium',
    maxTokens: 4000,
    maxWebSearches: 0,
    depth: 'standard',
    premiumTools: false,
    label: 'Standard AI',
  },
  creator: {
    model: 'claude-opus-4-8',
    effort: 'high',
    maxTokens: 8000,
    maxWebSearches: 3,
    depth: 'advanced',
    premiumTools: false,
    label: 'Advanced AI',
  },
  pro: {
    model: 'claude-opus-4-8',
    effort: 'high',
    maxTokens: 16000,
    maxWebSearches: 5,
    depth: 'deep',
    premiumTools: false,
    label: 'Pro AI',
  },
  agency: {
    model: 'claude-opus-4-8',
    effort: 'xhigh',
    maxTokens: 24000,
    maxWebSearches: 8,
    depth: 'maximum',
    premiumTools: true,
    label: 'Agency Elite AI',
  },
};

// The behavior any caller gets when it passes NO tier/profile — intentionally
// equal to the pre-profiles default (effort 'high', 16000 tokens, 4 searches) so
// existing call sites are byte-identical until they opt in by passing a tier.
const DEFAULT_PROFILE = Object.freeze({
  model: 'claude-opus-4-8',
  effort: 'high',
  maxTokens: 16000,
  maxWebSearches: 4,
  depth: 'deep',
  premiumTools: false,
  label: 'Pro AI',
});

/**
 * Resolve a tier id (or a raw user/plan value) to its AI profile. Unknown,
 * missing, or unrecognized input fails SAFE to the free profile — never throws,
 * never grants the Agency edge by accident.
 *
 * @param {string|Object} tierOrUser - a tier id ('free'|'creator'|'pro'|'agency'),
 *   or a user object (resolved via entitlements.resolveTier).
 * @returns {object} a frozen copy of the matching profile.
 */
function aiProfileForTier(tierOrUser) {
  let tier = tierOrUser;
  if (tierOrUser && typeof tierOrUser === 'object') {
    tier = resolveTier(tierOrUser);
  }
  const profile = AI_PROFILES[tier] || AI_PROFILES.free;
  return Object.freeze({ ...profile });
}

/**
 * Honest, client-safe view of a tier's AI profile for surfacing in the UI.
 * Only describes what the calls ACTUALLY do — no invented benchmarks.
 *
 * @param {string|Object} tierOrUser
 * @returns {{label:string, depth:string, effort:string, maxWebSearches:number,
 *   deepReasoning:boolean, liveWeb:boolean, premiumTools:boolean}}
 */
function publicAiProfile(tierOrUser) {
  const p = aiProfileForTier(tierOrUser);
  return {
    label: p.label,
    depth: p.depth,
    effort: p.effort,
    maxWebSearches: p.maxWebSearches,
    deepReasoning: p.depth === 'deep' || p.depth === 'maximum',
    liveWeb: p.maxWebSearches > 0,
    premiumTools: p.premiumTools,
  };
}

module.exports = {
  AI_PROFILES,
  DEFAULT_PROFILE,
  aiProfileForTier,
  publicAiProfile,
};
