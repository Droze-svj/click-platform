/**
 * Single source of truth for Click subscription plans.
 *
 * Read by:
 *   - the public landing page pricing section (client/components/landing/Pricing.tsx)
 *   - the in-app billing page (client/app/dashboard/billing/page.tsx)
 *   - the registration redirect logic (client/app/register/page.tsx)
 *
 * Whop hosted-checkout URLs live in NEXT_PUBLIC_WHOP_URL_* env vars (one per
 * paid plan × period). They're public on purpose — Whop's checkout page does
 * the auth on its end. Empty values fall back to /register?plan=<id>.
 *
 * The serverTier field maps each plan to the canonical tier id used by
 * server/config/entitlements.js (free/creator/pro/agency) so the gating and
 * pricing stay consistent across every surface.
 *
 * CANONICAL PRICING (mirrors GET /api/plans → server/config/entitlements.js):
 *   free $0 · creator $39/mo ($390/yr) · pro $119/mo ($1190/yr, MOST POPULAR)
 *   · agency $349/mo ($3490/yr, FLAGSHIP). Yearly === 10× monthly (2 months
 *   free). If these ever drift from the server, the server wins — prefer the
 *   live catalog (fetchPublicCatalog) and treat this static set as the typed
 *   fallback that MUST match it.
 */

import type { LucideIcon } from 'lucide-react';
import { Sparkles, Rocket, Crown, Zap } from 'lucide-react';
import { apiGet } from './api';

export type PlanId = 'free' | 'creator' | 'pro' | 'agency';
export type BillingPeriod = 'monthly' | 'yearly';
// Canonical server tier ids (server/config/entitlements.js): free/creator/pro/agency.
export type ServerTier = 'free' | 'creator' | 'pro' | 'agency';

export interface PlanFeature {
  label: string;
  included: boolean;
  tooltip?: string;
}

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;

  priceMonthly: number; // 0 for Free
  priceYearly: number;  // 0 for Free; ~20% off vs 12 × monthly

  featured: boolean;

  features: PlanFeature[];

  // Whop hosted checkout URLs. Empty for Free. The user pastes these
  // from their Whop dashboard into NEXT_PUBLIC_WHOP_URL_*_(MONTHLY|YEARLY).
  checkoutUrl: { monthly: string; yearly: string };

  cta: { label: string; subLabel?: string };

  // Maps to server/config/entitlements.js canonical tier ids
  // (free/creator/pro/agency). Same id as `id` for every canonical tier.
  serverTier: ServerTier;

  // Visuals — shared between landing and dashboard.
  icon: LucideIcon;
  gradient: string; // tailwind from-x to-y
  accent: string;   // tailwind text-x-400 used for highlights
}

const env = (key: string): string =>
  (typeof process !== 'undefined' && process.env?.[key]) || '';

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Try Click. No card.',
    priceMonthly: 0,
    priceYearly: 0,
    featured: false,
    features: [
      { label: '3 video exports / month', included: true },
      { label: 'Exports up to 720p', included: true },
      { label: '50 AI generations / month', included: true },
      { label: 'Basic trim, filters & text overlays', included: true },
      { label: 'Auto captions (Whisper)', included: false },
      { label: 'AI hook analysis & script rewrites', included: false },
      { label: 'Creator analytics', included: false },
      { label: 'Performance learning loop', included: false },
    ],
    checkoutUrl: { monthly: '', yearly: '' },
    cta: { label: 'Start Free' },
    serverTier: 'free',
    icon: Sparkles,
    gradient: 'from-slate-700 to-slate-900',
    accent: 'text-slate-300',
  },

  {
    id: 'creator',
    name: 'Creator',
    tagline: 'For rising channels',
    priceMonthly: 39,
    priceYearly: 390, // 10 × monthly — 2 months free
    featured: false,
    features: [
      { label: '300 AI generations / month', included: true },
      { label: 'Unlimited 30-min exports', included: true },
      { label: 'Auto captions (Whisper)', included: true },
      { label: 'AI hook analysis + script rewrites', included: true },
      { label: 'Creativity style packs & motion templates', included: true },
      { label: '3 social accounts', included: true },
      { label: 'AI creative tools (thumbnails)', included: true, tooltip: 'AI-generated thumbnails & creative assets' },
      { label: 'Performance learning loop', included: false },
      { label: 'Workspaces & approvals', included: false },
    ],
    checkoutUrl: {
      monthly: env('NEXT_PUBLIC_WHOP_URL_CREATOR_MONTHLY'),
      yearly: env('NEXT_PUBLIC_WHOP_URL_CREATOR_YEARLY'),
    },
    cta: { label: 'Get Creator' },
    serverTier: 'creator',
    icon: Zap,
    gradient: 'from-indigo-600 to-blue-700',
    accent: 'text-indigo-300',
  },

  {
    id: 'pro',
    name: 'Pro',
    tagline: 'The AI command center',
    priceMonthly: 119,
    priceYearly: 1190, // 10 × monthly — 2 months free
    featured: true,
    features: [
      { label: 'Everything in Creator', included: true },
      { label: 'Unlimited AI generations', included: true },
      { label: 'Unlimited 2-hour exports', included: true },
      { label: '4K exports', included: true },
      { label: 'AI B-roll + autonomous AI agent', included: true },
      { label: 'Creator analytics + hook/style attribution', included: true, tooltip: 'See which hooks and styles actually retain viewers' },
      { label: 'Publish your own templates', included: true },
      { label: '10 social accounts', included: true },
      { label: 'Priority render queue', included: true, tooltip: 'Skips queue during peak load' },
      { label: 'Workspaces & approvals', included: false },
    ],
    checkoutUrl: {
      monthly: env('NEXT_PUBLIC_WHOP_URL_PRO_MONTHLY'),
      yearly: env('NEXT_PUBLIC_WHOP_URL_PRO_YEARLY'),
    },
    cta: { label: 'Get Pro' },
    serverTier: 'pro',
    icon: Rocket,
    gradient: 'from-indigo-600 via-violet-600 to-fuchsia-600',
    accent: 'text-violet-300',
  },

  {
    id: 'agency',
    name: 'Agency',
    tagline: 'For volume operations',
    priceMonthly: 349,
    priceYearly: 3490, // 10 × monthly — 2 months free
    featured: false,
    features: [
      { label: 'Everything in Pro', included: true },
      { label: 'Unlimited team seats, brands & workspaces', included: true },
      { label: 'Real-time collaboration + team management', included: true },
      { label: 'Shared asset library', included: true },
      { label: '50 social accounts', included: true },
      { label: 'AI client-feedback engine', included: true },
      { label: 'Early access: white-label exports & client portal', included: true, tooltip: 'Agency-exclusive early access — explore in Labs' },
      { label: 'Early access: generative dubbing + AI foley', included: true, tooltip: 'Agency-exclusive early access — explore in Labs' },
      { label: 'Early access: retention heatmap + WebGPU preview', included: true, tooltip: 'Agency-exclusive early access — explore in Labs' },
      { label: 'Early access: developer API + dedicated GPU pods', included: true, tooltip: 'Agency-exclusive early access — explore in Labs' },
    ],
    checkoutUrl: {
      monthly: env('NEXT_PUBLIC_WHOP_URL_AGENCY_MONTHLY'),
      yearly: env('NEXT_PUBLIC_WHOP_URL_AGENCY_YEARLY'),
    },
    cta: { label: 'Get Agency', subLabel: 'or talk to sales' },
    serverTier: 'agency',
    icon: Crown,
    gradient: 'from-amber-500 via-rose-500 to-fuchsia-600',
    accent: 'text-amber-300',
  },
];

export const PUBLIC_PLANS: Plan[] = PLANS;

export function getPlan(id: PlanId | string | null | undefined): Plan | null {
  if (!id) return null;
  return PLANS.find((p) => p.id === id) ?? null;
}

export function getFeaturedPlan(): Plan {
  return PLANS.find((p) => p.featured) ?? PLANS[2];
}

/**
 * Build the URL to send the user to when they click a plan's CTA.
 * Logged out → /register?plan=<id>&period=<m|y> (registration handles the
 * post-signup redirect to checkout).
 * Logged in → the Whop checkout URL with passthrough fields appended, so
 * Whop can echo them back via webhook (we use them to mark the user's plan
 * as upgraded).
 */
export function buildCheckoutTarget(
  plan: Plan,
  period: BillingPeriod,
  user: { _id?: string; id?: string; email?: string } | null,
): { kind: 'register' | 'whop' | 'mailto' | 'noop'; href: string } {
  if (plan.id === 'free') {
    return user
      ? { kind: 'noop', href: '#' }
      : { kind: 'register', href: `/register?plan=free` };
  }

  const baseUrl = plan.checkoutUrl[period];

  if (!user) {
    // Sign up first; register page reads ?plan/?period and redirects after.
    return { kind: 'register', href: `/register?plan=${plan.id}&period=${period}` };
  }

  if (!baseUrl) {
    // Whop URL not configured for this plan/period yet. Fall back to register
    // (which itself will land on /dashboard if no checkout URL is set).
    return { kind: 'register', href: `/register?plan=${plan.id}&period=${period}` };
  }

  const userId = user._id || user.id || '';
  const params = new URLSearchParams();
  if (userId) params.set('passthrough', userId);
  if (user.email) params.set('email', user.email);
  const sep = baseUrl.includes('?') ? '&' : '?';
  return { kind: 'whop', href: `${baseUrl}${params.toString() ? sep + params.toString() : ''}` };
}

export function formatPrice(plan: Plan, period: BillingPeriod): string {
  const price = period === 'monthly' ? plan.priceMonthly : plan.priceYearly;
  if (price === 0) return 'Free';
  if (period === 'monthly') return `$${price}`;
  // For yearly we show effective per-month value to anchor against the
  // monthly price.
  const effectiveMonthly = Math.round(price / 12);
  return `$${effectiveMonthly}`;
}

export function formatPriceCadence(period: BillingPeriod): string {
  return period === 'monthly' ? '/mo' : '/mo, billed yearly';
}

export function yearlySavingsPct(plan: Plan): number {
  if (plan.priceMonthly === 0 || plan.priceYearly === 0) return 0;
  const yearlyAtMonthlyRate = plan.priceMonthly * 12;
  return Math.round(((yearlyAtMonthlyRate - plan.priceYearly) / yearlyAtMonthlyRate) * 100);
}

/**
 * How many months are effectively free on the yearly plan
 * (e.g. 12 × monthly − yearly, expressed in months). Our canonical model is
 * yearly === 10 × monthly, i.e. 2 months free.
 */
export function freeMonthsYearly(plan: Plan): number {
  if (plan.priceMonthly === 0 || plan.priceYearly === 0) return 0;
  return Math.round((plan.priceMonthly * 12 - plan.priceYearly) / plan.priceMonthly);
}

// ─── LIVE CANONICAL CATALOG (GET /api/plans) ────────────────────────────────
// The static PLANS above are a typed fallback that MUST match the server. When
// a surface can do an async read, prefer the live catalog so prices/features
// are never stale. The shape mirrors server/config/entitlements.js publicCatalog().

export interface CatalogFeature {
  id: string;
  label: string;
  category: string;
  earlyAccess?: boolean;
}

export interface CatalogTier {
  id: PlanId | string;
  name: string;
  order: number;
  tagline: string;
  price: { monthlyUsd: number | null; yearlyUsd: number | null };
  featured?: boolean;
  flagship?: boolean;
  features: CatalogFeature[];
  limits: Record<string, number | null>;
}

export interface PublicCatalog {
  tiers: CatalogTier[];
  /** Every gated feature with its unlock tier + early-access flag. */
  features: Array<CatalogFeature & { minTier: string }>;
}

let catalogCache: PublicCatalog | null = null;
let catalogInFlight: Promise<PublicCatalog | null> | null = null;

/**
 * Fetch the live public catalog from GET /api/plans (cached for the session).
 * Returns null on any failure — callers should fall back to the static PLANS,
 * which match the server. Never throws.
 */
export async function fetchPublicCatalog(): Promise<PublicCatalog | null> {
  if (catalogCache) return catalogCache;
  if (catalogInFlight) return catalogInFlight;
  catalogInFlight = (async () => {
    try {
      const raw = await apiGet<any>('/plans');
      const body = raw?.tiers ? raw : raw?.data ?? raw;
      if (body && Array.isArray(body.tiers)) {
        catalogCache = body as PublicCatalog;
        return catalogCache;
      }
      return null;
    } catch {
      return null;
    } finally {
      catalogInFlight = null;
    }
  })();
  return catalogInFlight;
}

/** The full list of early-access-flagged features from a catalog. */
export function earlyAccessFeatures(catalog: PublicCatalog): Array<CatalogFeature & { minTier: string }> {
  return catalog.features.filter((f) => f.earlyAccess === true);
}
