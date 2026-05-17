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
import { Sparkles, Zap, Target } from 'lucide-react';
import { motion } from 'framer-motion';

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
      window.location.href = target.href;
      return;
    }

    if (target.kind === 'noop') {
      router.push('/dashboard');
    }
  };

  return (
    <section id="pricing" className="py-48 px-6 bg-surface-page relative border-y-2 border-surface-100 dark:border-white/5 overflow-hidden font-inter">
      <div aria-hidden="true" className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[60%] h-[60%] bg-primary-600/10 blur-[180px] rounded-full opacity-40 animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[40%] h-[40%] bg-fuchsia-600/10 blur-[160px] rounded-full opacity-30" />
      </div>

      <div className="max-w-[1900px] mx-auto relative z-10">
        <div className="text-center mb-24 space-y-8">
           <motion.div
             initial={{ opacity: 0, y: 20 }}
             whileInView={{ opacity: 1, y: 0 }}
             viewport={{ once: true }}
             className="inline-flex items-center gap-4 px-6 py-2 rounded-full bg-primary-500/10 border-2 border-primary-500/20 text-primary-500 text-[10px] font-black uppercase tracking-[0.5em] italic shadow-xl"
           >
             <Zap size={14} className="animate-pulse" />
             Simple, scale-as-you-grow pricing
           </motion.div>

          <h2 className="text-6xl md:text-8xl font-black tracking-tighter uppercase italic text-surface-900 dark:text-white leading-none">
            PRICED <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-fuchsia-400">FOR CREATORS.</span>
          </h2>

          <p className="text-surface-500 dark:text-slate-500 max-w-3xl mx-auto text-xl font-medium italic uppercase tracking-tight opacity-70">
            Start free. Upgrade when you outgrow it. Cancel any time — no contracts, no salesperson.
          </p>
          
          <div className="pt-8">
             <PricingToggle period={period} onChange={setPeriod} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 lg:gap-12 max-w-[1800px] mx-auto items-stretch">
          {PLANS.map((plan, i) => (
            <div key={plan.id} className="h-full">
              <PricingCard plan={plan} period={period} onSelect={handleSelect} index={i} />
            </div>
          ))}
        </div>

        <div className="mt-24 flex flex-col items-center gap-6 opacity-40">
           <div className="flex items-center gap-6">
              <div className="h-px w-32 bg-surface-100 dark:bg-white/5" />
              <div className="flex items-center gap-3">
                 <Target size={16} className="text-primary-500" />
                 <p className="text-[10px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-[0.6em] italic">14-day refund guarantee</p>
              </div>
              <div className="h-px w-32 bg-surface-100 dark:bg-white/5" />
           </div>
           <p className="text-[9px] font-black text-slate-800 dark:text-slate-900 uppercase tracking-[0.4em] italic">Secure payments — cancel anytime</p>
        </div>
      </div>
    </section>
  );
}
