'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Check, Minus, ChevronDown } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { PLANS, buildCheckoutTarget, type BillingPeriod, type Plan } from '../../lib/plans';
import { accountCheckoutUrl } from '../../lib/checkout';
import { PricingCard } from './PricingCard';
import { PricingToggle } from './PricingToggle';
import { COMPARE_ROWS, type CompareCell } from './planCompare';

function Cell({ value }: { value: CompareCell }) {
  if (value === true) {
    return (
      <>
        <Check className="w-4 h-4 text-emerald-500 mx-auto" aria-hidden="true" />
        <span className="sr-only">Included</span>
      </>
    );
  }
  if (value === false) {
    return (
      <>
        <Minus className="w-4 h-4 text-surface-300 dark:text-slate-600 mx-auto" aria-hidden="true" />
        <span className="sr-only">Not included</span>
      </>
    );
  }
  return <>{value}</>;
}

export function Pricing() {
  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const router = useRouter();
  const auth = useAuth() as { user: { _id?: string; id?: string; email?: string } | null };
  const user = auth?.user || null;

  const handleSelect = (plan: Plan) => {
    const target = buildCheckoutTarget(plan, period, user);

    if (target.kind === 'register') {
      router.push(target.href);
      return;
    }

    if (target.kind === 'whop') {
      try {
        sessionStorage.setItem('click.last_plan_select', JSON.stringify({ id: plan.id, period, ts: Date.now() }));
      } catch { }
      void accountCheckoutUrl(plan.id, period, target.href).then((url) => { window.location.href = url; });
      return;
    }

    if (target.kind === 'noop') {
      router.push('/dashboard');
    }
  };

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="py-16 md:py-24 px-4 sm:px-6 border-y-2 border-surface-100 dark:border-white/5 font-inter scroll-mt-20"
    >
      <div className="max-w-6xl mx-auto">
        <div className="max-w-3xl mx-auto text-center mb-10 md:mb-12">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-500 mb-4">Pricing</p>
          <h2 id="pricing-heading" className="text-3xl md:text-5xl font-black tracking-tighter leading-tight text-balance text-surface-900 dark:text-white mb-4">
            Start free, upgrade when you need more
          </h2>
          <p className="text-surface-600 dark:text-slate-300 text-base md:text-lg leading-relaxed">
            Every new account gets 14 days of Pro, free and without a card. After that you are on the Free plan unless you pick a paid one. Pay yearly and get 2 months free.
          </p>
          <div className="pt-7">
            <PricingToggle period={period} onChange={setPeriod} freeMonths={2} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-5 items-stretch pt-2">
          {PLANS.map((plan) => (
            <PricingCard key={plan.id} plan={plan} period={period} onSelect={handleSelect} />
          ))}
        </div>

        <details className="group mt-8 ds-surface-card overflow-hidden">
          <summary className="cursor-pointer list-none flex items-center justify-center gap-2 px-6 py-4 text-sm font-bold text-surface-900 dark:text-white hover:text-primary-500 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-primary-500/50 [&::-webkit-details-marker]:hidden">
            Compare plans in detail
            <ChevronDown className="w-4 h-4 motion-safe:transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="overflow-x-auto px-2 pb-4 md:px-6 md:pb-6">
            <table className="w-full min-w-[560px] text-sm">
              <caption className="sr-only">Plan comparison</caption>
              <thead>
                <tr className="border-b border-surface-100 dark:border-white/10">
                  <th scope="col" className="text-left font-semibold text-surface-500 dark:text-slate-400 py-3 pr-4">Feature</th>
                  {PLANS.map((p) => (
                    <th key={p.id} scope="col" className="font-black text-surface-900 dark:text-white py-3 px-2 text-center">{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((r) => (
                  <tr key={r.label} className="border-b border-surface-100 dark:border-white/5 last:border-0">
                    <th scope="row" className="text-left font-medium text-surface-700 dark:text-slate-300 py-3 pr-4">{r.label}</th>
                    {PLANS.map((p) => (
                      <td key={p.id} className="py-3 px-2 text-center text-surface-700 dark:text-slate-300 tabular-nums">
                        <Cell value={r.values[p.id]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        <p className="mt-8 text-center text-sm text-surface-500 dark:text-slate-400">
          Full refund within 14 days of your first payment. Cancel any time from Billing. Payments are handled by Whop.
        </p>
      </div>
    </section>
  );
}
