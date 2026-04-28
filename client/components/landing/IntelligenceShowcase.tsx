'use client';

import { motion } from 'framer-motion';
import { Brain, Radar, RefreshCw, Clock, Sparkles, ArrowUpRight } from 'lucide-react';
import { glass } from './_styles';

/**
 * Bento-grid showcase of the four "intelligence" surfaces — niche-aware AI,
 * 2026 trend radar, performance learning loop, posting-window predictor.
 * Irregular cell sizes follow the dominant 2025–2026 layout pattern.
 */
export function IntelligenceShowcase() {
  return (
    <section id="intelligence" className="py-24 px-6 bg-[#020202] relative">
      <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-violet-600/10 blur-[140px] rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-300 text-[10px] font-bold uppercase tracking-widest mb-6">
            INTELLIGENCE LAYER
          </span>
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-6">
            EVERY OUTPUT, <span className="text-fuchsia-400">SHAPED.</span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg md:text-xl font-medium">
            Four AI systems quietly shape every clip you ship. None of them are toys you click — they’re the editor’s default.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 grid-rows-[auto_auto] gap-5 md:gap-6">
          {/* Niche-aware AI — large left cell */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            className={`${glass} rounded-3xl p-8 md:row-span-2 md:col-span-2 group hover:border-fuchsia-500/30 transition-colors relative overflow-hidden`}
          >
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-fuchsia-500/20 blur-3xl rounded-full opacity-60 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="flex items-center justify-between mb-6">
                <div className="w-14 h-14 rounded-2xl bg-fuchsia-500/15 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-300">
                  <Brain className="w-7 h-7" aria-hidden="true" />
                </div>
                <ArrowUpRight className="w-5 h-5 text-slate-500 group-hover:text-white group-hover:rotate-12 transition-all" aria-hidden="true" />
              </div>
              <h3 className="text-3xl font-black mb-4 tracking-tight">Niche-aware AI</h3>
              <p className="text-slate-400 text-base font-medium leading-relaxed mb-6 max-w-lg">
                Every prompt — captions, hooks, edit suggestions, posting copy — is built from a niche playbook. A finance creator gets dollar-anchored hooks; a fitness creator gets transformation framing. No generic outputs.
              </p>
              <div className="flex flex-wrap gap-2">
                {['finance', 'fitness', 'lifestyle', 'tech', 'beauty', 'gaming', 'business', 'food'].map((n) => (
                  <span
                    key={n}
                    className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-widest text-slate-300"
                  >
                    {n}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Trend radar — top right */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ delay: 0.1 }}
            className={`${glass} rounded-3xl p-7 group hover:border-blue-500/30 transition-colors relative overflow-hidden`}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/15 blur-3xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-300">
                  <Radar className="w-6 h-6" aria-hidden="true" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-blue-300">6h refresh</span>
              </div>
              <h3 className="text-xl font-black mb-2 tracking-tight">2026 Trend Radar</h3>
              <p className="text-slate-400 text-sm font-medium leading-relaxed">
                Hooks, sounds, formats, hashtags — composed live for your niche × platform. Refreshed every 6 hours. Cached so it’s instant.
              </p>
            </div>
          </motion.div>

          {/* Learning loop — bottom right */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ delay: 0.2 }}
            className={`${glass} rounded-3xl p-7 group hover:border-emerald-500/30 transition-colors relative overflow-hidden`}
          >
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-emerald-500/15 blur-3xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
                  <RefreshCw className="w-6 h-6" aria-hidden="true" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">Always-on</span>
              </div>
              <h3 className="text-xl font-black mb-2 tracking-tight">Learning Loop</h3>
              <p className="text-slate-400 text-sm font-medium leading-relaxed">
                Post-publish retention flows back into the editor. Yesterday’s top-performing font biases tomorrow’s suggestions. Without you lifting a finger.
              </p>
            </div>
          </motion.div>

          {/* Posting window predictor — full width bottom */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ delay: 0.3 }}
            className={`${glass} rounded-3xl p-7 md:col-span-3 group hover:border-amber-500/30 transition-colors relative overflow-hidden`}
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-fuchsia-500/10 blur-3xl opacity-30 group-hover:opacity-60 transition-opacity" aria-hidden="true" />
            <div className="relative flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex items-center gap-4 md:flex-1">
                <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300 flex-shrink-0">
                  <Clock className="w-6 h-6" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-xl font-black tracking-tight">Predictive Posting Windows</h3>
                  <p className="text-slate-400 text-sm font-medium leading-relaxed mt-1">
                    Picks the slot your audience is actually online. Layered: platform peaks · niche windows · your historical engagement-by-hour.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {[
                  { label: 'TikTok', time: '7:42 PM', conf: '94%' },
                  { label: 'Reels', time: '8:15 PM', conf: '91%' },
                  { label: 'Shorts', time: '6:30 PM', conf: '88%' },
                ].map((s) => (
                  <div key={s.label} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                    <div>
                      <div className="text-xs font-bold uppercase tracking-widest text-slate-400">{s.label}</div>
                      <div className="text-sm font-black tabular-nums">{s.time} <span className="text-amber-300 font-mono text-xs">· {s.conf}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
