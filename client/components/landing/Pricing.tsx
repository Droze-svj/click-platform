'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  PLANS,
  buildCheckoutTarget,
  fetchPublicCatalog,
  earlyAccessFeatures,
  getPlan,
  type BillingPeriod,
  type Plan,
  type CatalogFeature,
} from '../../lib/plans';
import { PricingCard } from './PricingCard';
import { PricingToggle } from './PricingToggle';
import { Brain, Gauge, Globe, Crown, Zap, Target, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

// What makes Click different — only REAL, shipped capabilities. Each maps to a
// real product surface (performance learning loop, trends, Labs early-access).
const DIFFERENTIATORS = [
  {
    icon: Brain,
    title: 'A self-improving marketing brain',
    body: 'Click learns which of your hooks and styles actually retain viewers and adapts the editor to your channel.',
  },
  {
    icon: Gauge,
    title: 'A real performance-learning loop',
    body: 'Creator analytics + hook/style attribution feed back into every edit — not vanity metrics, real retention signal.',
  },
  {
    icon: Globe,
    title: 'Live web trends, built in',
    body: 'Niche-aware trend discovery keeps your content riding what is working right now, not last quarter.',
  },
  {
    icon: Crown,
    title: 'Agency early access (Labs)',
    body: 'Agency teams get hands-on early access to flagship 2026 capabilities before anyone else.',
  },
];

export function Pricing() {
  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const [earlyAccess, setEarlyAccess] = useState<CatalogFeature[]>([]);
  const router = useRouter();
  const auth = useAuth() as { user: { _id?: string; id?: string; email?: string } | null };
  const user = auth?.user || null;

  // Pull the REAL early-access feature list from the live canonical catalog so
  // the Agency callout never lists anything that isn't actually flagged.
  useEffect(() => {
    let alive = true;
    fetchPublicCatalog().then((cat) => {
      if (alive && cat) setEarlyAccess(earlyAccessFeatures(cat));
    });
    return () => {
      alive = false;
    };
  }, []);

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

  const agencyPlan = getPlan('agency');

  return (
    <section id="pricing" className="py-48 px-6 bg-surface-page relative border-y-2 border-surface-100 dark:border-white/5 overflow-hidden font-inter">
      <div aria-hidden="true" className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[60%] h-[60%] bg-primary-600/10 blur-[180px] rounded-full opacity-40 motion-safe:animate-pulse" />
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
             <Zap size={14} className="motion-safe:animate-pulse" />
             Simple, scale-as-you-grow pricing
           </motion.div>

          <h2 className="text-6xl md:text-8xl font-black tracking-tighter uppercase italic text-surface-900 dark:text-white leading-none">
            PRICED <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-fuchsia-400">FOR CREATORS.</span>
          </h2>

          <p className="text-surface-500 dark:text-slate-500 max-w-3xl mx-auto text-xl font-medium italic uppercase tracking-tight opacity-70">
            Start free. Upgrade when you outgrow it. Cancel any time — no contracts, no salesperson. Pay yearly and get 2 months free.
          </p>

          <div className="pt-8">
             <PricingToggle period={period} onChange={setPeriod} freeMonths={2} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 lg:gap-12 max-w-[1800px] mx-auto items-stretch">
          {PLANS.map((plan, i) => (
            <div key={plan.id} className="h-full">
              <PricingCard plan={plan} period={period} onSelect={handleSelect} index={i} />
            </div>
          ))}
        </div>

        {/* ── Differentiation strip — what makes Click different (real, shipped) ── */}
        <div className="mt-32">
          <div className="text-center mb-12 space-y-4">
            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-primary-500 italic">Why Click</p>
            <h3 className="text-4xl md:text-5xl font-black tracking-tighter uppercase italic text-surface-900 dark:text-white leading-none">
              Not another editor. A <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-fuchsia-400">growth engine.</span>
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-[1700px] mx-auto">
            {DIFFERENTIATORS.map((d, i) => {
              const DIcon = d.icon;
              return (
                <motion.div
                  key={d.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ delay: i * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="ds-surface-card p-7 rounded-3xl border-2 border-surface-100 dark:border-white/5 flex flex-col gap-4"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-600 to-fuchsia-600 text-white shadow-lg">
                    <DIcon size={22} aria-hidden="true" />
                  </span>
                  <h4 className="text-lg font-black tracking-tight text-surface-900 dark:text-white leading-snug">{d.title}</h4>
                  <p className="text-sm leading-relaxed text-surface-500 dark:text-slate-400">{d.body}</p>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ── Agency exclusive early-access callout (real earlyAccess catalog) ── */}
        {earlyAccess.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="mt-24 max-w-[1500px] mx-auto rounded-[2.5rem] border-2 border-amber-500/20 bg-gradient-to-br from-amber-500/[0.06] via-rose-500/[0.04] to-fuchsia-600/[0.06] p-10 md:p-14 relative overflow-hidden"
          >
            <div aria-hidden="true" className="absolute top-0 right-0 p-10 opacity-[0.06] pointer-events-none">
              <Crown size={220} className="text-amber-500" />
            </div>
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-10">
                <div className="space-y-3">
                  <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 text-[10px] font-black uppercase tracking-[0.4em] italic">
                    <Crown size={13} /> Agency exclusive
                  </span>
                  <h3 className="text-3xl md:text-4xl font-black tracking-tighter text-surface-900 dark:text-white leading-none">
                    Early access to the future of Click
                  </h3>
                  <p className="text-surface-500 dark:text-slate-400 text-base max-w-2xl">
                    Agency teams get hands-on access to our flagship 2026 capabilities the moment they ship — explore them in Labs inside your dashboard.
                  </p>
                </div>
                {agencyPlan && (
                  <button
                    type="button"
                    onClick={() => handleSelect(agencyPlan)}
                    className="shrink-0 inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-rose-500 to-fuchsia-600 text-white font-black uppercase tracking-[0.3em] text-[11px] shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-transform motion-reduce:hover:scale-100"
                  >
                    <Sparkles size={15} /> Get Agency
                  </button>
                )}
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {earlyAccess.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-center gap-3 rounded-2xl bg-surface-card/60 border border-amber-500/10 px-4 py-3.5"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500">
                      <Sparkles size={15} aria-hidden="true" />
                    </span>
                    <span className="text-sm font-semibold text-surface-800 dark:text-slate-200 leading-tight">{f.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}

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
