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
 * The serverTier field maps each plan to the tier name used by
 * server/middleware/tierGate.js so the gating stays consistent.
 */

import type { LucideIcon } from 'lucide-react';
import { Sparkles, Rocket, Crown, Zap } from 'lucide-react';

export type PlanId = 'free' | 'creator' | 'pro' | 'agency';
export type BillingPeriod = 'monthly' | 'yearly';
export type ServerTier = 'free' | 'creator' | 'pro' | 'team';

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

  // Maps to server/middleware/tierGate.js tier names (free/creator/pro/team).
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
      { label: 'Clips up to 30 seconds', included: true },
      { label: '50 AI generations / month', included: true },
      { label: 'Click watermark on exports', included: true },
      { label: 'AI auto-edit (Make it great)', included: false },
      { label: 'Niche-aware trend reports', included: false },
      { label: 'Multi-platform scheduling', included: false },
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
    priceMonthly: 49,
    priceYearly: 470, // 49 × 12 × 0.8 ≈ 470
    featured: false,
    features: [
      { label: '100 AI generations / month', included: true },
      { label: 'Unlimited 30-min clips', included: true },
      { label: 'Basic transcripts + captions', included: true },
      { label: 'AI auto-edit (Make it great)', included: true },
      { label: 'Niche-aware trend reports', included: true },
      { label: '3 social accounts', included: true },
      { label: 'Multi-platform scheduling', included: true, tooltip: 'TikTok, Reels, Shorts in one click' },
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
    priceMonthly: 149,
    priceYearly: 1430, // 149 × 12 × 0.8 ≈ 1430
    featured: true,
    features: [
      { label: 'Unlimited AI generations', included: true },
      { label: 'Unlimited 2-hour clips', included: true },
      { label: 'Advanced transcripts (90+ languages)', included: true },
      { label: 'AI auto-edit + retention rewrites', included: true },
      { label: 'Niche-aware trend reports + 6h refresh', included: true },
      { label: '10 social accounts', included: true },
      { label: 'Performance learning loop', included: true, tooltip: 'Editor adapts to which of your posts retain viewers' },
      { label: 'Predictive posting windows', included: true },
      { label: 'Brand kit + template library', included: true },
      { label: 'Priority AI compute', included: true, tooltip: 'Skips queue during peak load' },
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
    priceMonthly: 399,
    priceYearly: 3830, // 399 × 12 × 0.8 ≈ 3830
    featured: false,
    features: [
      { label: 'Everything in Pro', included: true },
      { label: 'Unlimited team seats', included: true },
      { label: 'Workspaces + brand switching', included: true },
      { label: 'Approval workflows', included: true },
      { label: '50 social accounts', included: true },
      { label: 'White-label exports', included: true, tooltip: 'No Click branding on shared previews' },
      { label: 'Custom AI playbooks', included: true, tooltip: 'Tune the niche knowledge base for your client roster' },
      { label: 'SOC2-ready audit logs', included: true },
      { label: 'Dedicated GPU pods', included: true },
      { label: 'Priority human support', included: true },
    ],
    checkoutUrl: {
      monthly: env('NEXT_PUBLIC_WHOP_URL_AGENCY_MONTHLY'),
      yearly: env('NEXT_PUBLIC_WHOP_URL_AGENCY_YEARLY'),
    },
    cta: { label: 'Get Agency', subLabel: 'or talk to sales' },
    serverTier: 'team',
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
