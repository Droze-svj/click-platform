'use client';

import { motion } from 'framer-motion';
import { Activity, ShieldCheck, TrendingUp, Sparkles, Cpu, Users, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { glass } from './_styles';

const NICHES = [
  {
    id: 'finance',
    label: 'Finance',
    accent: 'from-emerald-500/30 to-emerald-500/0',
    pillBg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    metrics: [
      { label: 'Hook strength', value: '94/100', tone: 'from-emerald-500/20' },
      { label: 'Predicted reach', value: '+312K', tone: 'from-blue-500/20' },
      { label: 'Retention', value: '78%', tone: 'from-fuchsia-500/20' },
    ],
    bars: [40, 55, 80, 95, 70, 90, 100, 88, 92, 78],
  },
  {
    id: 'fitness',
    label: 'Fitness',
    accent: 'from-rose-500/30 to-rose-500/0',
    pillBg: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
    metrics: [
      { label: 'Hook strength', value: '91/100', tone: 'from-rose-500/20' },
      { label: 'Predicted reach', value: '+184K', tone: 'from-amber-500/20' },
      { label: 'Retention', value: '83%', tone: 'from-blue-500/20' },
    ],
    bars: [25, 45, 60, 88, 95, 70, 82, 100, 75, 90],
  },
  {
    id: 'lifestyle',
    label: 'Lifestyle',
    accent: 'from-violet-500/30 to-violet-500/0',
    pillBg: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
    metrics: [
      { label: 'Hook strength', value: '88/100', tone: 'from-violet-500/20' },
      { label: 'Predicted reach', value: '+221K', tone: 'from-fuchsia-500/20' },
      { label: 'Retention', value: '72%', tone: 'from-emerald-500/20' },
    ],
    bars: [50, 70, 65, 80, 95, 100, 85, 78, 92, 70],
  },
];

export function LiveDemo() {
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActiveIdx((i) => (i + 1) % NICHES.length);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  const niche = NICHES[activeIdx];

  return (
    <section className="px-4 md:px-6 pb-32">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="max-w-6xl mx-auto relative group"
      >
        <div className="absolute inset-0 bg-gradient-to-t from-indigo-600/30 via-blue-600/10 to-transparent blur-[80px] -z-10 transition-opacity opacity-50 group-hover:opacity-100" />
        <div className={`${glass} rounded-[2rem] md:rounded-[3rem] p-2 md:p-6 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]`}>
          <div className="w-full aspect-[16/10] md:aspect-video bg-[#0a0a0a] rounded-[1.5rem] md:rounded-[2rem] border border-white/10 flex flex-col overflow-hidden relative">
            {/* Mockup toolbar */}
            <div className="h-12 border-b border-white/5 bg-white/[0.02] flex items-center px-4 gap-2">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <div className="mx-auto px-4 py-1.5 rounded-md bg-white/5 text-[10px] text-white/40 font-mono tracking-widest flex items-center gap-2">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                CLICK · {niche.label.toUpperCase()} · LIVE
              </div>
              <div className="hidden md:flex items-center gap-2 ml-auto">
                <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  AI ACTIVE
                </span>
              </div>
            </div>

            {/* Inner layout */}
            <div className="flex flex-1 overflow-hidden relative">
              {/* Sidebar */}
              <div className="hidden md:flex w-20 border-r border-white/5 p-4 flex-col gap-6 items-center bg-black/20">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4">
                  <Zap className="w-5 h-5" />
                </div>
                {[Users, Sparkles, Cpu, TrendingUp].map((Icon, i) => (
                  <div key={i} className="w-10 h-10 rounded-xl hover:bg-white/10 text-white/30 hover:text-white transition-colors flex items-center justify-center cursor-pointer">
                    <Icon className="w-5 h-5" />
                  </div>
                ))}
              </div>

              {/* Content */}
              <div className={`flex-1 p-6 md:p-8 space-y-8 bg-gradient-to-br to-transparent ${niche.accent}`}>
                <div className="flex justify-between items-center">
                  <div className="space-y-2">
                    <span
                      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${niche.pillBg}`}
                    >
                      <Activity className="w-3 h-3" />
                      Niche · {niche.label}
                    </span>
                    <div className="h-3 w-48 bg-white/10 rounded-full" />
                  </div>
                  <div className="w-10 h-10 md:w-32 md:h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white/90 font-black text-xs uppercase tracking-widest">
                    <span className="hidden md:block">Generate</span>
                    <span className="md:hidden">+</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 md:gap-6">
                  {niche.metrics.map((m) => (
                    <motion.div
                      key={m.label + niche.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4 }}
                      className={`h-24 md:h-32 rounded-[1.5rem] md:rounded-[2rem] border border-white/10 p-4 md:p-6 bg-gradient-to-br ${m.tone} to-transparent flex flex-col justify-between`}
                    >
                      <div className="text-[10px] md:text-xs text-white/40 uppercase tracking-widest font-bold">{m.label}</div>
                      <div className="text-xl md:text-3xl font-black text-white tabular-nums">{m.value}</div>
                    </motion.div>
                  ))}
                </div>

                <div className="flex-1 min-h-[150px] bg-white/[0.03] rounded-[1.5rem] md:rounded-[2rem] border border-white/10 p-4 md:p-8 relative overflow-hidden">
                  <div className="absolute bottom-0 left-0 right-0 h-full flex items-end justify-between px-6 pb-6 gap-2 opacity-70">
                    {niche.bars.map((h, i) => (
                      <motion.div
                        key={`${niche.id}-bar-${i}`}
                        initial={{ height: '0%' }}
                        animate={{ height: `${h}%` }}
                        transition={{ duration: 0.8, delay: i * 0.04, type: 'spring' }}
                        className="w-full bg-gradient-to-t from-indigo-600/60 via-violet-500/70 to-fuchsia-400 rounded-t-sm md:rounded-t-md"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Niche switcher dots */}
        <div className="flex items-center justify-center gap-3 mt-8" role="tablist" aria-label="Niche preview">
          {NICHES.map((n, i) => (
            <button
              key={n.id}
              type="button"
              role="tab"
              aria-selected={i === activeIdx}
              aria-label={`Switch to ${n.label} niche preview`}
              onClick={() => setActiveIdx(i)}
              className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all ${
                i === activeIdx
                  ? 'bg-white text-black border-white'
                  : 'bg-white/5 text-slate-400 border-white/10 hover:text-white hover:border-white/30'
              }`}
            >
              {n.label}
            </button>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
