import type { PlanId } from '../../lib/plans';

/**
 * Landing-page plan comparison. The numbers mirror the enforced limits in
 * server/config/entitlements.js (LIMITS + FEATURES minTier); the
 * planCompare.test.ts guard fails if they drift, so the landing never promises
 * more than the server allows.
 */
export const PLAN_LIMITS: Record<PlanId, {
  exportsPerMonth: number;
  maxResolution: number;
  videoDurationSec: number;
  aiGenerationsPerMonth: number;
  socialAccounts: number;
}> = {
  free: { exportsPerMonth: 3, maxResolution: 720, videoDurationSec: 120, aiGenerationsPerMonth: 50, socialAccounts: 1 },
  creator: { exportsPerMonth: 30, maxResolution: 1080, videoDurationSec: 1800, aiGenerationsPerMonth: 300, socialAccounts: 3 },
  pro: { exportsPerMonth: Infinity, maxResolution: 2160, videoDurationSec: 7200, aiGenerationsPerMonth: Infinity, socialAccounts: 10 },
  agency: { exportsPerMonth: Infinity, maxResolution: 2160, videoDurationSec: Infinity, aiGenerationsPerMonth: Infinity, socialAccounts: 50 },
};

/** Lowest plan that unlocks each compared feature (server FEATURES.minTier). */
export const FEATURE_MIN_PLAN = {
  auto_captions: 'creator',
  ai_analysis: 'creator',
  creator_analytics: 'pro',
  hook_attribution: 'pro',
  collaboration: 'agency',
  shared_library: 'agency',
} as const satisfies Record<string, PlanId>;

const ORDER: PlanId[] = ['free', 'creator', 'pro', 'agency'];
const has = (plan: PlanId, min: PlanId) => ORDER.indexOf(plan) >= ORDER.indexOf(min);

const count = (n: number) => (Number.isFinite(n) ? n.toLocaleString('en-US') : 'Unlimited');
const resolution = (n: number) => (n >= 2160 ? '4K' : `${n}p`);
const duration = (sec: number) => {
  if (!Number.isFinite(sec)) return 'No limit';
  if (sec < 3600) return `${Math.round(sec / 60)} min`;
  const h = sec / 3600;
  return `${h} hour${h === 1 ? '' : 's'}`;
};

export type CompareCell = string | boolean;

export interface CompareRow {
  label: string;
  values: Record<PlanId, CompareCell>;
}

function row(label: string, fn: (plan: PlanId) => CompareCell): CompareRow {
  return { label, values: Object.fromEntries(ORDER.map((p) => [p, fn(p)])) as Record<PlanId, CompareCell> };
}

export const COMPARE_ROWS: CompareRow[] = [
  row('Exports per month', (p) => count(PLAN_LIMITS[p].exportsPerMonth)),
  row('Longest video', (p) => duration(PLAN_LIMITS[p].videoDurationSec)),
  row('Export quality', (p) => (p === 'free' ? `${resolution(PLAN_LIMITS[p].maxResolution)}, watermark` : resolution(PLAN_LIMITS[p].maxResolution))),
  row('AI generations per month', (p) => count(PLAN_LIMITS[p].aiGenerationsPerMonth)),
  row('Auto captions', (p) => has(p, FEATURE_MIN_PLAN.auto_captions)),
  row('Hook analysis and rewrites', (p) => has(p, FEATURE_MIN_PLAN.ai_analysis)),
  row('Analytics: which hooks and styles worked', (p) => has(p, FEATURE_MIN_PLAN.hook_attribution)),
  row('Connected social accounts', (p) => count(PLAN_LIMITS[p].socialAccounts)),
  row('Team collaboration and shared library', (p) => has(p, FEATURE_MIN_PLAN.collaboration)),
];

/** Short card bullets. Same sources as COMPARE_ROWS. */
export const PLAN_HIGHLIGHTS: Record<PlanId, string[]> = {
  free: [
    '3 exports a month, 720p with watermark',
    'Videos up to 2 minutes',
    '50 AI generations a month',
    'Trim, filters and text',
  ],
  creator: [
    '30 exports a month, 1080p, no watermark',
    'Auto captions',
    'Hook analysis and script rewrites',
    '300 AI generations a month',
  ],
  pro: [
    'Unlimited exports, up to 4K',
    'Analytics: which hooks and styles worked',
    'Unlimited AI generations',
    '10 social accounts',
  ],
  agency: [
    'Everything in Pro',
    'Unlimited team seats, brands and workspaces',
    'Real-time collaboration and shared library',
    '50 social accounts',
  ],
};
