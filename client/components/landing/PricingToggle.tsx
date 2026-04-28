'use client';

import type { BillingPeriod } from '../../lib/plans';

interface Props {
  period: BillingPeriod;
  onChange: (p: BillingPeriod) => void;
  yearlyDiscount?: number; // percent — to advertise the saving
}

export function PricingToggle({ period, onChange, yearlyDiscount = 20 }: Props) {
  return (
    <div className="inline-flex items-center gap-2 p-1.5 rounded-full bg-white/5 border border-white/10" role="tablist" aria-label="Billing period">
      {(['monthly', 'yearly'] as BillingPeriod[]).map((p) => {
        const active = p === period;
        return (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(p)}
            className={`relative px-5 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
              active ? 'bg-white text-black shadow-lg' : 'text-slate-400 hover:text-white'
            }`}
          >
            {p === 'monthly' ? 'Monthly' : 'Yearly'}
            {p === 'yearly' && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-bold">
                −{yearlyDiscount}%
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
