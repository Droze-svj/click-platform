'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  PLANS,
  buildCheckoutTarget,
  type BillingPeriod,
  type Plan,
} from '../../lib/plans';
import { PricingCard } from './PricingCard';
import { PricingToggle } from './PricingToggle';

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
      // Persist the chosen plan so we can confirm post-redirect.
      try {
        sessionStorage.setItem('click.last_plan_select', JSON.stringify({ id: plan.id, period, ts: Date.now() }));
      } catch {
        /* sessionStorage may be blocked */
      }
      window.location.href = target.href;
      return;
    }

    if (target.kind === 'noop') {
      // Logged-in user clicked Free — already on Free, just route to dashboard.
      router.push('/dashboard');
    }
  };

  return (
    <section id="pricing" className="py-24 px-6 bg-[#020202] relative border-y border-white/5">
      <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-1/2 h-1/2 bg-fuchsia-600/8 blur-[160px] rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-6">
            UNLOCK <span className="text-fuchsia-400">MULTIPLIER</span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg font-medium mb-8">
            Designed for creators who value time above all. Switch tiers any time.
          </p>
          <PricingToggle period={period} onChange={setPeriod} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {PLANS.map((plan, i) => (
            <PricingCard key={plan.id} plan={plan} period={period} onSelect={handleSelect} index={i} />
          ))}
        </div>

        <p className="text-center text-xs text-slate-600 font-bold uppercase tracking-widest mt-10">
          14-day refund · cancel any time · no setup fees
        </p>
      </div>
    </section>
  );
}
