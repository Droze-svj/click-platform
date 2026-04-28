'use client';

import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import type { Plan, BillingPeriod } from '../../lib/plans';
import { formatPrice, formatPriceCadence, yearlySavingsPct } from '../../lib/plans';
import { PlanFeatureList } from './PlanFeatureList';
import { glass } from './_styles';

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
      initial={{ opacity: 0, scale: 0.96, y: 24 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ delay: index * 0.1 }}
      className={`relative flex flex-col rounded-3xl p-8 transition-all duration-300 hover:-translate-y-1 ${
        featured
          ? 'bg-gradient-to-b from-indigo-500/15 to-fuchsia-500/5 border-2 border-indigo-500/40 shadow-[0_0_60px_rgba(99,102,241,0.25)]'
          : `${glass} hover:border-white/20`
      }`}
    >
      {featured && (
        <>
          <div
            aria-hidden="true"
            className="absolute -inset-px rounded-3xl bg-[conic-gradient(from_0deg,transparent,rgba(99,102,241,0.4),transparent_30%,transparent_60%,rgba(217,70,239,0.4),transparent)] opacity-50 motion-safe:animate-[spin_8s_linear_infinite] pointer-events-none -z-10"
          />
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg shadow-indigo-500/30 motion-safe:animate-pulse">
            Most Popular
          </div>
        </>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center shadow-lg`}>
          <Icon className="w-5 h-5 text-white" aria-hidden="true" />
        </div>
        <div>
          <div className={`text-xl font-black uppercase tracking-tight ${featured ? 'text-white' : 'text-white'}`}>{plan.name}</div>
          <div className="text-xs text-slate-500 font-medium">{plan.tagline}</div>
        </div>
      </div>

      {/* Price */}
      <div className="mt-6 flex items-baseline gap-2">
        <div className="text-5xl font-black tabular-nums tracking-tighter">
          {formatPrice(plan, period)}
        </div>
        {plan.priceMonthly > 0 && (
          <div className="text-sm text-slate-500 font-medium">{formatPriceCadence(period)}</div>
        )}
      </div>
      {period === 'yearly' && plan.priceYearly > 0 && (
        <div className="mt-1 text-[11px] text-emerald-300 font-bold uppercase tracking-widest">
          Save {yearlySavings}% billed yearly
        </div>
      )}

      <div className="my-6 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Features */}
      <PlanFeatureList features={plan.features} featured={featured} />

      {/* CTA */}
      <button
        type="button"
        onClick={() => onSelect(plan)}
        className={`mt-8 w-full py-4 rounded-xl font-black uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-3 active:scale-[0.98] ${
          featured
            ? 'bg-gradient-to-r from-indigo-500 to-fuchsia-500 hover:from-indigo-400 hover:to-fuchsia-400 text-white shadow-lg shadow-fuchsia-500/30 hover:shadow-fuchsia-500/50'
            : plan.id === 'free'
              ? 'bg-white/10 hover:bg-white/15 text-white border border-white/15'
              : 'bg-white text-black hover:bg-slate-100'
        }`}
      >
        {plan.cta.label}
        <ArrowRight className="w-4 h-4" aria-hidden="true" />
      </button>

      {plan.cta.subLabel && (
        <a
          href="mailto:sales@click.example?subject=Agency%20Plan%20Inquiry"
          className="mt-3 text-center text-xs text-slate-500 hover:text-white transition-colors uppercase tracking-widest font-bold"
        >
          {plan.cta.subLabel}
        </a>
      )}
    </motion.div>
  );
}
