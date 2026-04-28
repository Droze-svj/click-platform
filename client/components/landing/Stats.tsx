'use client';

import { motion } from 'framer-motion';
import { Users, Layers, TrendingUp, ShieldCheck } from 'lucide-react';

const STATS = [
  { label: 'Active Creators', value: '25K+', Icon: Users, color: 'text-indigo-400' },
  { label: 'Clips Generated', value: '145M', Icon: Layers, color: 'text-fuchsia-400' },
  { label: 'Avg. Brand Lift', value: '312%', Icon: TrendingUp, color: 'text-blue-400' },
  { label: 'System Uptime', value: '99.9%', Icon: ShieldCheck, color: 'text-emerald-400' },
];

export function Stats() {
  return (
    <section id="results" className="py-32 px-6 relative overflow-hidden">
      <div aria-hidden="true" className="absolute inset-0 bg-indigo-900/10 blur-[100px] -z-10" />
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {STATS.map((s, i) => {
            const { Icon } = s;
            return (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ delay: i * 0.1, type: 'spring' }}
                className="text-center group flex flex-col items-center"
              >
                <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6 group-hover:-translate-y-2 transition-transform shadow-xl">
                  <Icon className={`w-8 h-8 ${s.color}`} aria-hidden="true" />
                </div>
                <div className="text-4xl md:text-5xl font-black tracking-tighter mb-3 tabular-nums">{s.value}</div>
                <div className="text-xs font-bold uppercase tracking-widest text-slate-500">{s.label}</div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
