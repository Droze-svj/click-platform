'use client';

import { motion } from 'framer-motion';
import { Upload, Wand2, Calendar, Send, type LucideIcon, Activity, Terminal, Fingerprint, Sparkles } from 'lucide-react';

interface Step {
  num: string;
  icon: LucideIcon;
  title: string;
  desc: string;
  color: string;
}

const STEPS: Step[] = [
  {
    num: '01',
    icon: Upload,
    title: 'Drop your footage',
    desc: "Drag a file. Paste a YouTube link. Record straight from your camera. Any format, any length — Click never asks you to re-export from another tool first.",
    color: 'from-primary-500/20 to-primary-600/0',
  },
  {
    num: '02',
    icon: Wand2,
    title: 'Click cooks the edit',
    desc: "Hit the button, walk away. Click finds your strongest hook, cuts the dead air, writes the captions, paces the cuts — and does it all in YOUR niche's voice, not generic AI mush.",
    color: 'from-fuchsia-500/20 to-fuchsia-600/0',
  },
  {
    num: '03',
    icon: Calendar,
    title: 'Five formats, one tap',
    desc: 'Click reframes vertical, square, and wide. Picks the posting slot YOUR audience is actually scrolling — not the generic "best time to post" nobody reads. Reviews queued in one tab.',
    color: 'from-blue-500/20 to-blue-600/0',
  },
  {
    num: '04',
    icon: Send,
    title: 'Ship. Then get sharper.',
    desc: "One tap pushes to TikTok, Reels, Shorts, X, and LinkedIn. The hooks that land, the slots that pop — Click logs them and tilts tomorrow's edit toward what's already working for you.",
    color: 'from-emerald-500/20 to-emerald-600/0',
  },
];

export function Workflow() {
  return (
    <section id="workflow" className="py-48 px-6 bg-surface-page relative overflow-hidden font-inter border-y-2 border-surface-100 dark:border-white/5">
      <div aria-hidden="true" className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary-500/20 to-transparent" />
      
      <div className="max-w-[1900px] mx-auto relative z-10">
        <div className="text-center mb-32 space-y-8">
           <motion.div
             initial={{ opacity: 0, y: 20 }}
             whileInView={{ opacity: 1, y: 0 }}
             viewport={{ once: true }}
             className="inline-flex items-center gap-4 px-6 py-2 rounded-full bg-primary-500/10 border-2 border-primary-500/20 text-primary-500 text-[10px] font-black uppercase tracking-[0.5em] italic shadow-xl"
           >
             <Sparkles size={14} className="animate-pulse" />
             How it works
           </motion.div>

          <h2 className="text-4xl sm:text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter leading-none text-surface-900 dark:text-white uppercase italic px-4">
            ONE VIDEO IN. <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-fuchsia-400">A WEEK OF POSTS OUT.</span>
          </h2>

          <p className="text-surface-500 dark:text-slate-500 max-w-4xl mx-auto text-lg sm:text-xl md:text-2xl font-medium italic uppercase tracking-tight opacity-70 leading-relaxed px-4">
            Four steps. About 90 seconds of your time. Click handles the rest — every clip, every platform, every day you ship.
          </p>
        </div>

        {/* Connection line behind the steps (desktop only) */}
        <div className="relative max-w-[1800px] mx-auto">
          <div
            aria-hidden="true"
            className="hidden md:block absolute left-0 right-0 top-[100px] h-[2px] bg-gradient-to-r from-transparent via-surface-100 dark:via-white/10 to-transparent"
          />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 lg:gap-12">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.div
                  key={s.num}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-100px' }}
                  transition={{ delay: i * 0.1, duration: 1, ease: [0.16, 1, 0.3, 1] }}
                  className="relative group animate-cinematic-reveal"
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  <div
                    className="relative bg-surface-card backdrop-blur-[60px] rounded-[3.5rem] p-10 h-full flex flex-col gap-8 border-2 border-surface-100 dark:border-white/5 group hover:border-primary-500/30 hover:shadow-[0_60px_120px_rgba(0,0,0,0.5)] transition-all duration-700 overflow-hidden"
                  >
                    <div
                      className={`absolute inset-0 rounded-[3.5rem] opacity-[0.03] group-hover:opacity-10 transition-opacity bg-gradient-to-b ${s.color} pointer-events-none`}
                      aria-hidden="true"
                    />
                    
                    <div className="relative flex items-center justify-between">
                      <div className="w-16 h-16 rounded-2xl bg-surface-page dark:bg-black/40 border-2 border-surface-100 dark:border-white/10 flex items-center justify-center shadow-2xl group-hover:rotate-12 transition-transform duration-500">
                        <Icon className="w-8 h-8 text-primary-500" aria-hidden="true" />
                      </div>
                      <span className="text-7xl font-black text-surface-100 dark:text-white/5 tabular-nums tracking-tighter italic leading-none group-hover:text-primary-500/10 transition-colors">{s.num}</span>
                    </div>
                    
                    <div className="space-y-4">
                       <h3 className="relative text-3xl font-black tracking-tighter uppercase italic text-surface-900 dark:text-white leading-none">{s.title}</h3>
                       <p className="relative text-base text-surface-500 dark:text-slate-500 font-medium leading-relaxed italic uppercase tracking-tight opacity-80">{s.desc}</p>
                    </div>

                    {/* Step HUD Telemetry */}
                    <div className="mt-auto pt-8 border-t-2 border-surface-100 dark:border-white/5 flex items-center justify-between opacity-0 group-hover:opacity-40 transition-opacity duration-1000">
                       <div className="flex items-center gap-3 min-w-0">
                          <Activity size={14} className="text-primary-500 shrink-0" />
                          <span className="text-[9px] font-black uppercase tracking-[0.2em] md:tracking-[0.4em] italic text-primary-500 truncate">Phase {i + 1} active</span>
                       </div>
                       <Terminal size={14} className="text-primary-500 shrink-0" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Decorative Floor Telemetry */}
      <div className="max-w-7xl mx-auto mt-32 flex justify-between items-center px-12 opacity-[0.03] dark:opacity-[0.07] pointer-events-none">
         <div className="flex items-center gap-6">
            <Fingerprint size={24} className="text-primary-500" />
            <div className="h-px w-64 bg-primary-500/50" />
            <span className="text-[10px] font-black uppercase tracking-widest italic text-primary-500">Workflow active</span>
         </div>
         <Activity size={24} className="text-primary-500 animate-pulse" />
      </div>
    </section>
  );
}
