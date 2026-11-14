'use client';

import { ArrowRight, Check } from 'lucide-react';
import type { Plan, BillingPeriod } from '../../lib/plans';
import { formatPrice, formatPriceCadence, freeMonthsYearly } from '../../lib/plans';
import { PLAN_HIGHLIGHTS } from './planCompare';

interface Props {
  plan: Plan;
  period: BillingPeriod;
  onSelect: (plan: Plan) => void;
}

export function PricingCard({ plan, period, onSelect }: Props) {
  const Icon = plan.icon;
  const featured = plan.featured;
  const freeMonths = freeMonthsYearly(plan);
  const highlights = PLAN_HIGHLIGHTS[plan.id] ?? [];

  return (
    <div
      className={`relative flex flex-col h-full rounded-[2rem] p-7 md:p-8 bg-surface-card border-2 transition-colors ${
        featured
          ? 'border-primary-500/60 shadow-[0_40px_90px_rgba(79,70,229,0.25)]'
          : 'border-surface-100 dark:border-white/5 hover:border-primary-500/30'
      }`}
    >
      {featured && (
        <p className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-primary-500 text-white text-[11px] font-bold uppercase tracking-wider px-4 py-1 rounded-full shadow-lg">
          Most popular
        </p>
      )}

      <div className="flex items-center gap-4 mb-6">
        <span className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center shrink-0`}>
          <Icon className="w-5 h-5 text-white" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="text-xl font-black tracking-tight text-surface-900 dark:text-white leading-none mb-1.5">{plan.name}</h3>
          <p className="text-xs font-medium text-surface-500 dark:text-slate-400 leading-none">{plan.tagline}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-5xl font-black tabular-nums tracking-tighter text-surface-900 dark:text-white leading-none">
          {plan.priceMonthly === 0 ? '$0' : formatPrice(plan, period)}
        </span>
        {plan.priceMonthly > 0 && (
          <span className="text-xs font-semibold text-surface-500 dark:text-slate-400 whitespace-nowrap">{formatPriceCadence('monthly')}</span>
        )}
      </div>
      <p className="mt-2 min-h-[1.25rem] text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        {period === 'yearly' && plan.priceYearly > 0
          ? `$${plan.priceYearly.toLocaleString('en-US')} billed yearly, ${freeMonths} months free`
          : plan.id === 'free'
            ? 'Free for as long as you like'
            : ''}
      </p>

      <ul className="mt-6 mb-8 space-y-3 flex-1">
        {highlights.map((h) => (
          <li key={h} className="flex items-start gap-3 text-sm text-surface-700 dark:text-slate-200">
            <Check className={`w-4 h-4 mt-0.5 shrink-0 ${featured ? 'text-fuchsia-400' : 'text-primary-400'}`} aria-hidden="true" />
            <span className="leading-snug">{h}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => onSelect(plan)}
        className={`w-full py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/50 ${
          featured
            ? 'bg-primary-500 hover:bg-primary-600 text-white'
            : plan.id === 'free'
              ? 'bg-transparent border-2 border-surface-200 dark:border-white/15 text-surface-900 dark:text-white hover:border-primary-500/50'
              : 'bg-surface-900 dark:bg-white text-white dark:text-black hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white dark:hover:text-white'
        }`}
      >
        {plan.cta.label}
        <ArrowRight className="w-4 h-4" aria-hidden="true" />
      </button>

      {plan.cta.subLabel && (
        <a
          href="/contact?topic=sales"
          className="mt-3 block text-center text-xs font-semibold text-surface-500 dark:text-slate-400 hover:text-primary-500 transition-colors"
        >
          {plan.cta.subLabel}
        </a>
      )}
    </div>
  );
}
