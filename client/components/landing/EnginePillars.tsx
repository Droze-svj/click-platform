'use client';

import { motion } from 'framer-motion';
import { Wand2, Globe2, Cpu, type LucideIcon, Zap, Network, BrainCircuit } from 'lucide-react';

const glass = 'backdrop-blur-3xl bg-white/[0.02] border border-white/5 shadow-2xl';

interface Pillar {
  icon: LucideIcon;
  title: string;
  desc: string;
  color: string;
  bg: string;
  bullets: string[];
}

const PILLARS: Pillar[] = [
  {
    icon: BrainCircuit,
    title: 'Neural Video Studio',
    desc: 'Footage in, viral objects out. Our engine learns your niche, your voice, and precisely what keeps your specific audience watching until the last frame.',
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    bullets: ['Niche-aware retention rewrites', 'Autonomous cut-point detection', 'High-fidelity dynamic captions'],
  },
  {
    icon: Network,
    title: 'Omni-Channel Mesh',
    desc: 'Publish once. Dominate everywhere. Click reformats every clip per platform specification and schedules deliveries to optimal engagement windows.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    bullets: ['9:16 / 1:1 / 16:9 auto-conforming', 'Optimal-time AI scheduling', 'Native OAuth for all platforms'],
  },
  {
    icon: Zap,
    title: 'Consensus Analytics',
    desc: 'Predict virality before you hit post. Performance data flows back into the forge — what worked yesterday shapes tomorrow’s neural suggestions.',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    bullets: ['Pre-publish retention forecasting', 'Performance learning feedback loops', 'Cross-niche trend radar (6h refresh)'],
  },
];

export function EnginePillars() {
  return (
    <section id="features" className="py-32 md:py-48 px-6 bg-[#020202] relative overflow-hidden">
      <div aria-hidden="true" className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      
      {/* Background Decor */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.02] pointer-events-none">
        <Network size={1200} className="w-full h-full" />
      </div>

      <div className="max-w-[1400px] mx-auto relative z-10">
        <div className="text-center mb-24 space-y-6">
          <div className="flex items-center justify-center gap-3">
             <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
             <span className="text-[10px] font-black uppercase tracking-[0.5em] text-indigo-400/80 italic">The Engine Core</span>
          </div>
          <h2 className="text-6xl md:text-8xl font-black tracking-tighter leading-none text-[var(--text-main)]">
            NEURAL <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/40 italic">ARCHITECTURES</span>
          </h2>
          <p className="text-slate-400 max-w-3xl mx-auto text-lg md:text-xl font-medium opacity-80 leading-relaxed">
            Three tightly-integrated neural systems. One professional-grade intelligence. Every output is shaped by your niche, your platform, and your audience.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {PILLARS.map((p, i) => {
            const Icon = p.icon;
            return (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                transition={{ delay: i * 0.1, duration: 0.8 }}
                whileHover={{ y: -10 }}
                className={`${glass} p-10 rounded-[3rem] group hover:bg-white/[0.04] hover:border-indigo-500/20 transition-all duration-500`}
              >
                <div
                  className={`w-16 h-16 rounded-[1.4rem] ${p.bg} border border-white/10 flex items-center justify-center mb-8 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 ${p.color}`}
                >
                  <Icon className="w-8 h-8" aria-hidden="true" />
                </div>
                <h3 className="text-2xl font-black mb-4 text-[var(--text-main)] tracking-tight uppercase italic">{p.title}</h3>
                <p className="text-slate-400 font-medium leading-relaxed mb-8 opacity-80">{p.desc}</p>
                <ul className="space-y-4 border-t border-white/5 pt-8">
                  {p.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-4 text-[13px] text-slate-300 font-bold uppercase tracking-wide italic">
                      <div className={`mt-1.5 w-1.5 h-1.5 rounded-full ${p.color.replace('text-', 'bg-')} shadow-lg shadow-current`} />
                      <span className="opacity-80 group-hover:opacity-100 transition-opacity">{b}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
