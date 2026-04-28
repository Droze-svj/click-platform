'use client';

import { motion } from 'framer-motion';
import { Upload, Wand2, Calendar, Send, type LucideIcon } from 'lucide-react';
import { glass } from './_styles';

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
    title: 'Upload',
    desc: 'Drop in raw footage, paste a YouTube URL, or screen-record straight into Click. No transcoding. No format gymnastics.',
    color: 'from-indigo-500/40 to-indigo-600/0',
  },
  {
    num: '02',
    icon: Wand2,
    title: 'AI Auto-Edit',
    desc: '“Make it great” cuts dead air, finds your hooks, generates captions, and rewrites pacing for retention — niche-aware.',
    color: 'from-fuchsia-500/40 to-fuchsia-600/0',
  },
  {
    num: '03',
    icon: Calendar,
    title: 'Schedule',
    desc: 'Click reformats per platform and picks the posting window your audience is actually online — not yesterday’s "best practices".',
    color: 'from-blue-500/40 to-blue-600/0',
  },
  {
    num: '04',
    icon: Send,
    title: 'Publish',
    desc: 'Lands on TikTok, Reels, Shorts, X, LinkedIn. Performance flows back in — tomorrow’s edit knows what your audience finished watching.',
    color: 'from-emerald-500/40 to-emerald-600/0',
  },
];

export function Workflow() {
  return (
    <section id="workflow" className="py-32 px-6 relative">
      <div aria-hidden="true" className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-6">
            FROM CLIP TO <span className="text-fuchsia-400">CASCADE</span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg md:text-xl font-medium">
            Four steps. Roughly 90 seconds of your time. The rest is Click.
          </p>
        </div>

        {/* Connection line behind the steps (desktop only) */}
        <div className="relative">
          <div
            aria-hidden="true"
            className="hidden md:block absolute left-0 right-0 top-[88px] h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
          />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.div
                  key={s.num}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ delay: i * 0.1 }}
                  className="relative"
                >
                  <div
                    className={`relative ${glass} rounded-3xl p-7 h-full flex flex-col gap-4 hover:border-white/20 transition-colors`}
                  >
                    <div
                      className={`absolute inset-0 rounded-3xl opacity-30 bg-gradient-to-b ${s.color} pointer-events-none`}
                      aria-hidden="true"
                    />
                    <div className="relative flex items-center justify-between">
                      <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                        <Icon className="w-7 h-7 text-white" aria-hidden="true" />
                      </div>
                      <span className="text-5xl font-black text-white/10 tabular-nums tracking-tighter">{s.num}</span>
                    </div>
                    <h3 className="relative text-2xl font-black tracking-tight">{s.title}</h3>
                    <p className="relative text-sm text-slate-400 font-medium leading-relaxed">{s.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
