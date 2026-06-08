/**
 * CANONICAL SUBSCRIPTION ENTITLEMENTS — single source of truth for Click.
 *
 * This file replaces the four conflicting plan definitions that previously
 * existed (client/lib/plans.ts, server/middleware/tierGate.js TIER_FEATURES,
 * server/models/MembershipPackage seed, server/services/planLimitsService.js).
 *
 * Everything tier/feature/limit related should READ from here:
 *   - tierGate.js middleware derives its gates from FEATURES + LIMITS
 *   - planLimitsService.js derives PLAN_LIMITS from LIMITS
 *   - GET /api/plans serves publicCatalog() to the client (landing/billing)
 *   - GET /api/me/entitlements serves the per-user view
 *
 * Canonical tiers (ascending order): free < creator < pro < agency.
 * The legacy vocabulary (starter/team/elite, monthly/annual/trial) is folded
 * into these four via resolveTier(). NO new hard enforcement is added here —
 * this is foundation only; existing gates keep their current effect, just
 * sourced from this config.
 *
 * Purity: this module performs NO database access and has no side effects.
 */

'use strict';

// ─── TIERS ───────────────────────────────────────────────────────────────────
// Ordered, canonical. `order` is the comparison key used everywhere.
// Prices are the strategic 2026 pricing (Pro = most popular, Agency = flagship).
const TIERS = [
  {
    id: 'free',
    name: 'Free',
    order: 0,
    tagline: 'Try Click. No card.',
    price: { monthlyUsd: 0, yearlyUsd: 0 },
  },
  {
    id: 'creator',
    name: 'Creator',
    order: 1,
    tagline: 'For rising channels',
    price: { monthlyUsd: 39, yearlyUsd: 390 },
  },
  {
    id: 'pro',
    name: 'Pro',
    order: 2,
    tagline: 'The AI command center',
    price: { monthlyUsd: 119, yearlyUsd: 1190 },
  },
  {
    id: 'agency',
    name: 'Agency',
    order: 3,
    tagline: 'For volume operations',
    price: { monthlyUsd: 349, yearlyUsd: 3490 },
  },
];

const TIER_IDS = TIERS.map((t) => t.id);
const TIER_BY_ID = TIERS.reduce((acc, t) => {
  acc[t.id] = t;
  return acc;
}, {});

/** Numeric order for a tier id (unknown → free's order). */
function tierOrder(tierId) {
  return TIER_BY_ID[tierId] ? TIER_BY_ID[tierId].order : 0;
}

// ─── FEATURES ────────────────────────────────────────────────────────────────
// Registry of every gated feature. `minTier` is the lowest canonical tier that
// unlocks it. `earlyAccess: true` flags Agency-exclusive flagship / brand-new
// 2026 capabilities surfaced as "early access" in the UI.
//
// ── Agency-first rollout convention (the flagship's "constant growth" edge) ──
// Every NEW AI feature / tool lands at AGENCY FIRST, then automatically rolls
// down to lower tiers on a schedule — no code change to release a rolldown, just
// a date. Register a new feature like:
//
//   my_new_tool: {
//     label: 'My new tool', category: 'ai', minTier: 'agency',
//     rollout: { stage: 'agency-first', addedAt: '2026-06-08',
//                descendTo: 'pro', descendOn: '2026-09-01' },
//   }
//
// `effectiveMinTier()` returns `descendTo` once `descendOn` has passed (so the
// tool widens to Pro on that date by itself); until then it stays Agency-only.
// `earlyAccess` is DERIVED from rollout (agency-first + a future descendOn) OR
// the legacy `earlyAccess: true` boolean — both keep working. Stages:
//   'agency-first' — Agency-exclusive now (shows as early access)
//   'descending'   — past descendOn, available to descendTo and up
//   'ga'           — fully rolled out (no early-access flag)
//
// Every key from the old tierGate.TIER_FEATURES is folded in below, mapped to a
// canonical tier that preserves the behavior the existing routes already expect:
//   - ai_analysis / auto_captions: creator (hook-analysis, captions routes)
//   - b_roll_ai / creator_analytics: pro (creative, agentic, competitive routes)
//   - ai_agent: pro (agentic route)
//   - generative_dubbing / ai_foley: agency (dubbing, creative/ai-avatar routes)
// The previously-orphaned `creative_tools` key (creative/thumbnail route, which
// 403'd for everyone because it was defined in no tier) is added at `creator`.
const FEATURES = {
  // ── Core editing (free baseline) ──
  export_basic:     { label: 'Basic exports',            category: 'editing', minTier: 'free' },
  filters_basic:    { label: 'Basic filters',            category: 'editing', minTier: 'free' },
  text_overlays:    { label: 'Text overlays',            category: 'editing', minTier: 'free' },
  trim_basic:       { label: 'Basic trim & cut',         category: 'editing', minTier: 'free' },

  // ── Creator ──
  export_unlimited: { label: 'Unlimited exports',        category: 'editing', minTier: 'creator' },
  text_unlimited:   { label: 'Unlimited text overlays',  category: 'editing', minTier: 'creator' },
  filters_all:      { label: 'All filters',              category: 'editing', minTier: 'creator' },
  trim_advanced:    { label: 'J-Cut / L-Cut / freeze',   category: 'editing', minTier: 'creator' },
  custom_fonts:     { label: 'Custom fonts',             category: 'branding', minTier: 'creator' },
  auto_captions:    { label: 'Auto captions (Whisper)',  category: 'ai',      minTier: 'creator' },
  ai_analysis:      { label: 'AI hook analysis',         category: 'ai',      minTier: 'creator' },
  ai_rewrites:      { label: 'AI script rewrites',       category: 'ai',      minTier: 'creator' },
  style_packs:      { label: 'Creativity style packs',   category: 'creative', minTier: 'creator' },
  motion_templates: { label: 'Motion graphics templates', category: 'creative', minTier: 'creator' },
  creative_tools:   { label: 'AI creative tools (thumbnails)', category: 'creative', minTier: 'creator' },

  // ── Pro ──
  export_4k:        { label: '4K exports',               category: 'editing', minTier: 'pro' },
  creator_analytics:{ label: 'Creator analytics',        category: 'analytics', minTier: 'pro' },
  hook_attribution: { label: 'Hook / style attribution', category: 'analytics', minTier: 'pro' },
  b_roll_ai:        { label: 'AI B-roll',                category: 'ai',      minTier: 'pro' },
  template_publish: { label: 'Publish templates',        category: 'creative', minTier: 'pro' },
  priority_render:  { label: 'Priority render queue',    category: 'compute', minTier: 'pro' },
  spatial_editing:  { label: 'Spatial / XR editing',     category: 'editing', minTier: 'pro' },
  ai_agent:         { label: 'Autonomous AI agent',      category: 'ai',      minTier: 'pro' },

  // ── Agency (team + collaboration) ──
  collaboration:    { label: 'Real-time collaboration',  category: 'team',    minTier: 'agency' },
  team_management:  { label: 'Team management',          category: 'team',    minTier: 'agency' },
  shared_library:   { label: 'Shared asset library',     category: 'team',    minTier: 'agency' },
  custom_bundles:   { label: 'Custom shareable bundles', category: 'creative', minTier: 'agency' },
  white_label:      { label: 'White-label exports',      category: 'branding', minTier: 'agency', earlyAccess: true },
  client_portal:    { label: 'White-label client portal', category: 'team',   minTier: 'agency', earlyAccess: true },
  api_access:       { label: 'Developer API access',     category: 'platform', minTier: 'agency', earlyAccess: true },
  client_feedback_ai:{ label: 'AI client-feedback engine', category: 'ai',    minTier: 'agency' },

  // ── Agency flagship / 2026 early-access (Agency-first rollout) ──
  // These ship to Agency first and auto-widen to Pro on `descendOn` (the owner
  // adjusts the date when a tool is ready to roll down). Until then they stay
  // Agency-exclusive and show as "early access". This is the systematic
  // "new tools land at Agency first, then roll down" growth mechanism.
  generative_dubbing:{ label: 'Generative dubbing (10 langs)', category: 'ai', minTier: 'agency',
    rollout: { stage: 'agency-first', addedAt: '2026-06-01', descendTo: 'pro', descendOn: '2027-01-01' } },
  ai_foley:         { label: 'AI foley / sound design',  category: 'ai',      minTier: 'agency',
    rollout: { stage: 'agency-first', addedAt: '2026-06-01', descendTo: 'pro', descendOn: '2027-01-01' } },
  retention_heatmap:{ label: 'Retention heatmap',        category: 'analytics', minTier: 'agency',
    rollout: { stage: 'agency-first', addedAt: '2026-06-01', descendTo: 'pro', descendOn: '2027-01-01' } },
  priority_gpu:     { label: 'Dedicated GPU pods',       category: 'compute', minTier: 'agency',
    rollout: { stage: 'agency-first', addedAt: '2026-06-01', descendTo: 'pro', descendOn: '2027-01-01' } },
  webgpu_rendering: { label: 'WebGPU real-time preview', category: 'compute', minTier: 'agency',
    rollout: { stage: 'agency-first', addedAt: '2026-06-01', descendTo: 'pro', descendOn: '2027-01-01' } },
};

// ─── LIMITS ──────────────────────────────────────────────────────────────────
// Per-tier numeric caps. Infinity means unlimited; convert to null at the JSON
// boundary (see publicCatalog / serializeLimits). aiBudgetUsd aligns with
// costGuard DEFAULT_TIER_BUDGETS_USD (free 0.5 / creator→pro 50 / agency 500;
// creator gets a meaningful-but-bounded 5). clipCountPerDay & retentionDays
// fold the old planLimitsService values.
const LIMITS = {
  free: {
    exportsPerMonth: 3,
    maxResolution: 720,
    aiGenerationsPerMonth: 50,
    socialAccounts: 1,
    teamSeats: 1,
    brands: 1,
    workspaces: 1,
    aiBudgetUsd: 0.5,
    videoDurationSec: 120,
    retentionDays: 14,
    clipCountPerDay: 6,
  },
  creator: {
    exportsPerMonth: 30,
    maxResolution: 1080,
    aiGenerationsPerMonth: 300,
    socialAccounts: 3,
    teamSeats: 1,
    brands: 1,
    workspaces: 1,
    aiBudgetUsd: 5,
    videoDurationSec: 1800,
    retentionDays: 14,
    clipCountPerDay: 50,
  },
  pro: {
    exportsPerMonth: Infinity,
    maxResolution: 2160,
    aiGenerationsPerMonth: Infinity,
    socialAccounts: 10,
    teamSeats: 3,
    brands: 3,
    workspaces: 3,
    aiBudgetUsd: 50,
    videoDurationSec: 7200,
    retentionDays: 14,
    clipCountPerDay: 200,
  },
  agency: {
    exportsPerMonth: Infinity,
    maxResolution: 2160,
    aiGenerationsPerMonth: Infinity,
    socialAccounts: 50,
    teamSeats: Infinity,
    brands: Infinity,
    workspaces: Infinity,
    aiBudgetUsd: 500,
    videoDurationSec: Infinity,
    retentionDays: 14,
    clipCountPerDay: 1000,
  },
};

// ─── RESOLUTION ──────────────────────────────────────────────────────────────
// Maps any legacy plan value onto a canonical tier id.
const PLAN_ALIASES = {
  free: 'free',
  creator: 'creator',
  pro: 'pro',
  agency: 'agency',
  // Legacy billing-period values from older records → pro-level access:
  monthly: 'pro',
  annual: 'pro',
};

/**
 * Canonical tier resolution for a user document.
 * Order:
 *   1. explicit subscription.plan in {creator,pro,agency} → that
 *   2. active trial (status==='trial', not expired) → 'pro'
 *   3. legacy plan {monthly,annual} → 'pro'
 *   4. else 'free'
 */
function resolveTier(user) {
  const sub = user && user.subscription;
  const plan = sub && sub.plan;

  // 1. Explicit paid canonical plan wins.
  if (plan === 'creator' || plan === 'pro' || plan === 'agency') return plan;

  // 2. Live trial → pro-level so users can genuinely evaluate Click.
  //    Honour endDate when present; a trial with a past endDate falls through.
  if (sub && sub.status === 'trial') {
    const end = sub.endDate ? new Date(sub.endDate).getTime() : null;
    if (end === null || end > Date.now()) return 'pro';
  }

  // 3. Legacy billing-period values.
  if (plan && PLAN_ALIASES[plan]) return PLAN_ALIASES[plan];

  // 4. Default.
  return 'free';
}

/**
 * The tier that ACTUALLY unlocks a feature right now, honouring the Agency-first
 * rollout schedule. Before `rollout.descendOn`, this is the feature's `minTier`
 * (Agency-only for agency-first features); once that date has passed it widens to
 * `rollout.descendTo`. No rollout / no descend date → just `minTier`.
 *
 * Parsing `descendOn` defensively: an invalid/missing date never descends.
 *
 * @param {string} featureId
 * @param {number} [now=Date.now()] - injectable clock for testing.
 * @returns {string} canonical tier id (defaults to the feature's minTier).
 */
function effectiveMinTier(featureId, now = Date.now()) {
  const feat = FEATURES[featureId];
  if (!feat) return 'agency'; // unknown → most restrictive (fail closed)
  const r = feat.rollout;
  if (r && r.descendTo && r.descendOn) {
    const when = new Date(r.descendOn).getTime();
    if (Number.isFinite(when) && now >= when && TIER_BY_ID[r.descendTo]) {
      return r.descendTo;
    }
  }
  return feat.minTier;
}

/**
 * Whether a feature is currently "early access" (Agency-exclusive flagship).
 * DERIVED: an agency-first rollout whose descendOn is still in the future, OR
 * the legacy `earlyAccess: true` boolean. Once a feature has descended it is no
 * longer early access.
 *
 * @param {string} featureId
 * @param {number} [now=Date.now()]
 */
function isEarlyAccess(featureId, now = Date.now()) {
  const feat = FEATURES[featureId];
  if (!feat) return false;
  const r = feat.rollout;
  if (r && r.stage === 'agency-first') {
    if (!r.descendOn) return true; // agency-first with no descend date = early access
    const when = new Date(r.descendOn).getTime();
    if (!Number.isFinite(when) || now < when) return true;
    return false; // descend date passed → rolled down, no longer early access
  }
  return feat.earlyAccess === true;
}

/**
 * True if `tier` unlocks `featureId` right now. Unknown feature → false (fail
 * closed). Honours the Agency-first rollout schedule via effectiveMinTier.
 */
function hasFeature(tier, featureId, now = Date.now()) {
  const feat = FEATURES[featureId];
  if (!feat) return false;
  return tierOrder(tier) >= tierOrder(effectiveMinTier(featureId, now));
}

/** Limit value for a tier+key (undefined if unknown). May be Infinity. */
function limitFor(tier, key) {
  const table = LIMITS[tier] || LIMITS.free;
  return table[key];
}

/** List of feature ids unlocked for a tier. */
function featuresForTier(tier) {
  return Object.keys(FEATURES).filter((id) => hasFeature(tier, id));
}

/** List of feature ids currently early access (derived; honours rollout dates). */
function earlyAccessFeatures(now = Date.now()) {
  return Object.keys(FEATURES).filter((id) => isEarlyAccess(id, now));
}

// ─── JSON BOUNDARY ───────────────────────────────────────────────────────────
// Infinity is not valid JSON (serializes to null silently / NaN-prone). Convert
// any non-finite numeric limit to null explicitly at the boundary.
function jsonSafeNumber(n) {
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function serializeLimits(tier) {
  const table = LIMITS[tier] || {};
  const out = {};
  for (const key of Object.keys(table)) {
    out[key] = jsonSafeNumber(table[key]);
  }
  return out;
}

/**
 * JSON-safe catalog for the client (landing / billing / membership). No
 * Infinity anywhere. Each tier carries its unlocked feature list + limits.
 */
function publicCatalog() {
  return {
    tiers: TIERS.map((t) => ({
      id: t.id,
      name: t.name,
      order: t.order,
      tagline: t.tagline,
      price: {
        monthlyUsd: jsonSafeNumber(t.price.monthlyUsd),
        yearlyUsd: jsonSafeNumber(t.price.yearlyUsd),
      },
      featured: t.id === 'pro',
      flagship: t.id === 'agency',
      features: featuresForTier(t.id).map((id) => ({
        id,
        label: FEATURES[id].label,
        category: FEATURES[id].category,
        earlyAccess: isEarlyAccess(id),
      })),
      limits: serializeLimits(t.id),
    })),
    features: Object.keys(FEATURES).map((id) => ({
      id,
      label: FEATURES[id].label,
      category: FEATURES[id].category,
      minTier: FEATURES[id].minTier,
      // Effective unlock tier right now (honours Agency-first rollout schedule).
      effectiveMinTier: effectiveMinTier(id),
      earlyAccess: isEarlyAccess(id),
    })),
  };
}

module.exports = {
  TIERS,
  TIER_IDS,
  FEATURES,
  LIMITS,
  tierOrder,
  resolveTier,
  hasFeature,
  effectiveMinTier,
  isEarlyAccess,
  limitFor,
  featuresForTier,
  earlyAccessFeatures,
  serializeLimits,
  publicCatalog,
};
