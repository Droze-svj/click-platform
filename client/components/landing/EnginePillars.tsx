'use client';

import { motion } from 'framer-motion';
import { type LucideIcon, Zap, Network, BrainCircuit, Activity, Terminal, Fingerprint } from 'lucide-react';
import { useLandingTheme } from './LandingThemeContext';

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
    title: 'Cuts like you would',
    desc: "Click watches your raw footage, finds the moment your audience leans in, and trims everything that loses them. Then it writes the hook, paces the captions to your voice, and ships a clip you'd be proud to own.",
    color: 'text-primary-400',
    bg: 'bg-primary-500/10',
    bullets: ['Hook-first cuts (the first 1.5s decide everything)', 'Captions that breathe with your speech', 'Niche-aware retention rewrites'],
  },
  {
    icon: Network,
    title: 'Posts to every feed',
    desc: 'Edit once. Land everywhere. Click reframes your clip for vertical, square, and wide, picks the post window your audience is actually scrolling, and pushes it live across five platforms from one screen.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    bullets: ['9:16 · 1:1 · 16:9 reformats — no re-export', 'Per-platform timing tuned to your audience', 'Native publishing to TikTok, Reels, Shorts, X, LinkedIn'],
  },
  {
    icon: Zap,
    title: 'Learns from every post',
    desc: "Every publish becomes a lesson. The hook that landed, the time slot that popped, the caption style your audience kept watching for — Click remembers it all and tilts tomorrow's suggestions toward what's already working for you.",
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    bullets: ['Pre-publish retention forecast — see the score before you ship', 'Performance loop: what hit yesterday shapes today', 'Cross-niche trend radar refreshed every 6 hours'],
  },
];

export function EnginePillars() {
  const { niche, accent } = useLandingTheme();
  const accentText = niche ? accent.textAccent : 'text-primary-500';
  const headingGradient = niche
    ? `bg-gradient-to-r ${accent.gradient}`
    : 'bg-gradient-to-r from-primary-400 via-surface-900 dark:via-white to-primary-600';
  return (
    <section id="features" className="py-48 px-6 bg-surface-page relative overflow-hidden font-inter border-y-2 border-surface-100 dark:border-white/5">
      
      {/* Background Decor - Spectral Lattice */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03] dark:opacity-[0.05] pointer-events-none group">
        <Network size={1400} className="w-full h-full text-primary-500 animate-pulse group-hover:rotate-12 transition-transform duration-[10s]" />
      </div>

      <div className="max-w-[1900px] mx-auto relative z-10">
        <div className="text-center mb-32 space-y-8">
          <div className="flex items-center justify-center gap-4">
             <div className="w-2 h-2 rounded-full bg-primary-500 shadow-[0_0_10px_rgba(99,102,241,1)] animate-pulse" />
             <span className={`text-[11px] font-black uppercase tracking-[0.6em] ${accentText} italic transition-colors duration-500`}>What Click actually does</span>
          </div>

          <h2 className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter leading-none text-surface-900 dark:text-white uppercase italic">
            THREE JOBS. <span className={`text-transparent bg-clip-text ${headingGradient} transition-all duration-500`}>ZERO EXCUSES.</span>
          </h2>

          <p className="text-surface-500 dark:text-slate-500 max-w-4xl mx-auto text-xl md:text-2xl font-medium italic uppercase tracking-tight opacity-70 leading-relaxed">
            Editing. Publishing. Learning. The three things that drain your evenings — Click handles them all and gets better at YOUR voice every single time.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-16">
          {PILLARS.map((p, i) => {
            const Icon = p.icon;
            return (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                transition={{ delay: i * 0.1, duration: 1, ease: [0.16, 1, 0.3, 1] }}
                className="bg-surface-card backdrop-blur-[40px] p-12 rounded-[4rem] border-2 border-surface-100 dark:border-white/5 group hover:border-primary-500/30 hover:shadow-[0_80px_150px_rgba(0,0,0,0.5)] transition-all duration-700 relative overflow-hidden"
              >
                {/* Internal HUD Aesthetics */}
                <div className="absolute top-0 right-0 p-12 opacity-[0.02] pointer-events-none group-hover:opacity-[0.08] transition-opacity duration-1000">
                   <Icon size={200} className={p.color} />
                </div>
                
                <div
                  className={`w-20 h-20 rounded-2xl ${p.bg} border-2 border-current/20 flex items-center justify-center mb-10 group-hover:rotate-12 transition-transform duration-500 ${p.color}`}
                >
                  <Icon className="w-10 h-10" aria-hidden="true" />
                </div>
                
                <h3 className="text-3xl font-black mb-6 text-surface-900 dark:text-white tracking-tighter uppercase italic leading-none">{p.title}</h3>
                <p className="text-surface-500 dark:text-slate-500 font-medium leading-relaxed mb-12 italic uppercase tracking-tight opacity-80">{p.desc}</p>
                
                <ul className="space-y-6 border-t-2 border-surface-100 dark:border-white/5 pt-10">
                  {p.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-5 text-[11px] text-surface-900 dark:text-slate-300 font-black uppercase tracking-widest italic group/li">
                      <div className={`mt-1.5 w-2 h-2 rounded-full ${p.color.replace('text-', 'bg-')} shadow-[0_0_10px_currentColor] group-hover/li:scale-150 transition-transform`} />
                      <span className="opacity-60 group-hover:opacity-100 transition-opacity duration-500">{b}</span>
                    </li>
                  ))}
                </ul>

                {/* Tactical Footer ID */}
                <div className="mt-12 flex items-center gap-4 opacity-0 group-hover:opacity-20 transition-opacity duration-1000">
                   <Terminal size={14} className="text-primary-500" />
                   <span className="text-[9px] font-black uppercase tracking-[0.5em] italic text-primary-500">Step {i + 1}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Decorative Floor Telemetry */}
      <div className="max-w-7xl mx-auto mt-32 flex justify-between items-center px-12 opacity-[0.03] dark:opacity-[0.07] pointer-events-none">
         <div className="flex items-center gap-6">
            <Fingerprint size={24} className="text-primary-500" />
            <div className="h-px w-64 bg-primary-500/50" />
            <span className="text-[10px] font-black uppercase tracking-widest italic text-primary-500">Active</span>
         </div>
         <Activity size={24} className="text-primary-500 animate-pulse" />
      </div>
    </section>
  );
}
