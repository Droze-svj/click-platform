'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, Zap, ShieldCheck, Cpu } from 'lucide-react';
import type { Plan, BillingPeriod } from '../../lib/plans';
import { formatPrice, formatPriceCadence, yearlySavingsPct } from '../../lib/plans';
import { PlanFeatureList } from './PlanFeatureList';

interface Props {
  plan: Plan;
  period: BillingPeriod;
  onSelect: (plan: Plan) => void;
  index: number;
}

export function PricingCard({ plan, period, onSelect, index }: Props) {
  const Icon = plan.icon;
  const featured = plan.featured;
  const yearlySavings = yearlySavingsPct(plan);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ delay: index * 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className={`relative flex flex-col h-full rounded-[3rem] p-10 transition-all duration-500 group overflow-hidden animate-cinematic-reveal ${
        featured
          ? 'bg-surface-card backdrop-blur-[60px] border-2 border-primary-500/40 shadow-[0_60px_120px_rgba(0,0,0,0.5)] ring-4 ring-primary-500/5'
          : 'bg-surface-card backdrop-blur-[40px] border-2 border-surface-100 dark:border-white/5 hover:border-primary-500/30 hover:shadow-[0_40px_80px_rgba(0,0,0,0.4)]'
      }`}
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      {featured && (
        <>
          <div
            aria-hidden="true"
            className="absolute -inset-px rounded-[3rem] bg-[conic-gradient(from_0deg,transparent,rgba(99,102,241,0.2),transparent_30%,transparent_60%,rgba(217,70,239,0.2),transparent)] opacity-100 motion-safe:animate-[spin_10s_linear_infinite] pointer-events-none -z-10"
          />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-primary-500 text-white text-[10px] font-black uppercase tracking-[0.5em] px-6 py-2 rounded-b-2xl shadow-2xl shadow-primary-500/50 italic z-20">
            MOST_POPULAR
          </div>
          <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
             <Sparkles size={180} className="text-primary-500" />
          </div>
        </>
      )}

      {/* Internal Glow */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />

      {/* Header HUD */}
      <div className="flex items-center gap-6 mb-10 relative z-10">
        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center shadow-2xl group-hover:rotate-12 transition-transform duration-500 magnetic-hover`}>
          <Icon className="w-7 h-7 text-white" aria-hidden="true" />
        </div>
        <div>
          <h4 className="text-2xl font-black uppercase tracking-tighter italic text-surface-900 dark:text-white leading-none mb-2">{plan.name}</h4>
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-surface-400 dark:text-slate-600 italic leading-none opacity-60 group-hover:opacity-100 transition-opacity">{plan.tagline}</div>
        </div>
      </div>

      {/* Pricing Matrix */}
      <div className="mt-4 flex items-baseline gap-3 relative z-10">
        <div className="text-6xl font-black tabular-nums tracking-tighter text-surface-900 dark:text-white italic leading-none">
          {formatPrice(plan, period)}
        </div>
        {plan.priceMonthly > 0 && (
          <div className="text-[11px] font-black uppercase tracking-[0.3em] text-surface-400 dark:text-slate-600 italic">{formatPriceCadence(period)}</div>
        )}
      </div>
      
      {period === 'yearly' && plan.priceYearly > 0 && (
        <motion.div 
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="mt-4 inline-flex items-center gap-3 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-black uppercase tracking-widest italic"
        >
          <Zap size={12} />
          UPLINK_BONUS: SAVE {yearlySavings}%
        </motion.div>
      )}

      <div className="my-10 h-[2px] bg-gradient-to-r from-transparent via-surface-100 dark:via-white/5 to-transparent relative z-10" />

      {/* Feature Lattice */}
      <div className="flex-1 relative z-10">
         <PlanFeatureList features={plan.features} featured={featured} />
      </div>

      {/* Tactical CTA */}
      <div className="mt-12 relative z-10">
        <motion.button
          whileHover={{ y: -5, scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={() => onSelect(plan)}
          className={`w-full py-6 rounded-2xl font-black uppercase tracking-[0.5em] italic text-[11px] transition-all flex items-center justify-center gap-4 active:scale-[0.98] shadow-2xl border-none btn-shimmer magnetic-hover ${
            featured
              ? 'bg-primary-500 hover:bg-primary-600 text-white shadow-primary-500/40'
              : plan.id === 'free'
                ? 'bg-surface-page dark:bg-black/40 hover:bg-surface-page/80 text-surface-900 dark:text-white border-2 border-surface-100 dark:border-white/10'
                : 'bg-surface-900 dark:bg-white text-white dark:text-black hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white'
          }`}
        >
          {plan.cta.label.toUpperCase()}
          <ArrowRight className="w-5 h-5 group-hover:translate-x-3 transition-transform duration-500" aria-hidden="true" />
        </motion.button>

        {plan.cta.subLabel && (
          <a
            href="mailto:sales@click.example?subject=Agency%20Plan%20Inquiry"
            className="mt-6 block text-center text-[9px] font-black uppercase tracking-[0.6em] text-surface-400 dark:text-slate-700 hover:text-primary-500 transition-all italic leading-none magnetic-hover"
          >
            {plan.cta.subLabel.toUpperCase()}
          </a>
        )}
      </div>

      {/* Decorative HUD Elements */}
      <div className="absolute bottom-4 left-6 opacity-0 group-hover:opacity-10 transition-opacity duration-1000">
         <div className="flex items-center gap-3">
            <Cpu size={12} className="text-surface-900 dark:text-white" />
            <span className="text-[8px] font-black uppercase tracking-widest text-surface-900 dark:text-white">NODE_{index + 1}</span>
         </div>
      </div>
    </motion.div>
  );
}
