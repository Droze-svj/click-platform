'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Layers, TrendingUp, ShieldCheck } from 'lucide-react';
import { apiGet } from '../../lib/api';

interface GlobalMetrics {
  creators: number;
  clipsGenerated: number;
  brandLiftPct: number;
  uptimePct: number;
  source?: 'live' | 'cache' | 'fallback';
}

// Fallback values shown if /api/analytics/global is unreachable. Same as
// the server's FALLBACK so the landing never shows blank stats.
const FALLBACK: GlobalMetrics = {
  creators: 25_000,
  clipsGenerated: 145_000_000,
  brandLiftPct: 312,
  uptimePct: 99.9,
  source: 'fallback',
};

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K+`;
  return String(n);
}

export function Stats() {
  const [metrics, setMetrics] = useState<GlobalMetrics>(FALLBACK);

  useEffect(() => {
    let cancelled = false;
    apiGet<GlobalMetrics>('/analytics/global')
      .then((data) => {
        if (!cancelled && data) setMetrics(data);
      })
      .catch(() => {
        // Keep fallback. No console noise.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const STATS = [
    { label: 'Active Creators', value: formatCount(metrics.creators), Icon: Users, color: 'text-indigo-400' },
    { label: 'Clips Generated', value: formatCount(metrics.clipsGenerated), Icon: Layers, color: 'text-fuchsia-400' },
    { label: 'Avg. Brand Lift', value: `${metrics.brandLiftPct}%`, Icon: TrendingUp, color: 'text-blue-400' },
    { label: 'System Uptime', value: `${metrics.uptimePct}%`, Icon: ShieldCheck, color: 'text-emerald-400' },
  ];

  return (
    <section id="results" className="py-32 px-6 relative overflow-hidden">
      <div aria-hidden="true" className="absolute inset-0 bg-indigo-900/10 blur-[100px] -z-10" />
      <div className="max-w-7xl mx-auto">
        {metrics.source && metrics.source !== 'fallback' && (
          <div className="flex justify-center mb-10">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 motion-safe:animate-pulse" aria-hidden="true" />
              Live · updated every 5 min
            </span>
          </div>
        )}
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
