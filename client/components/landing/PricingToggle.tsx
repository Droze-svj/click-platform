'use client';

import type { BillingPeriod } from '../../lib/plans';

interface Props {
  period: BillingPeriod;
  onChange: (p: BillingPeriod) => void;
  /** The "free months" hook on the yearly option (canonical model = 2). */
  freeMonths?: number;
}

export function PricingToggle({ period, onChange, freeMonths = 2 }: Props) {
  return (
    <div
      className="inline-flex items-center gap-1 p-1.5 rounded-full bg-surface-card border-2 border-surface-100 dark:border-white/10"
      role="group"
      aria-label="Billing period"
    >
      {(['monthly', 'yearly'] as BillingPeriod[]).map((p) => {
        const active = p === period;
        return (
          <button
            type="button"
            key={p}
            aria-pressed={active}
            onClick={() => onChange(p)}
            className={`px-5 py-2 rounded-full text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/50 ${
              active
                ? 'bg-surface-900 dark:bg-white text-white dark:text-black'
                : 'text-surface-600 dark:text-slate-300 hover:text-surface-900 dark:hover:text-white'
            }`}
          >
            {p === 'monthly' ? 'Monthly' : 'Yearly'}
            {p === 'yearly' && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 text-[10px] font-bold">
                {freeMonths} months free
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
