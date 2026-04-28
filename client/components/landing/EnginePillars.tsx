'use client';

import { motion } from 'framer-motion';
import { Wand2, Globe2, Cpu, type LucideIcon } from 'lucide-react';
import { glass } from './_styles';

interface Pillar {
  icon: LucideIcon;
  title: string;
  desc: string;
  color: string;
  bullets: string[];
}

const PILLARS: Pillar[] = [
  {
    icon: Wand2,
    title: 'AI Editor Pro',
    desc: 'One click. Footage in, viral cuts out. The editor learns your niche, your voice, and what your audience actually finishes watching.',
    color: 'text-fuchsia-400',
    bullets: ['Niche-aware retention rewrites', 'Auto-cuts silence + ums', 'Hook + caption suggestions per platform'],
  },
  {
    icon: Globe2,
    title: 'Omni-Channel Auto-Post',
    desc: 'Publish once. Land everywhere. Click reformats clips per platform spec and schedules to the optimal posting window for your audience.',
    color: 'text-blue-400',
    bullets: ['9:16 / 1:1 / 16:9 reformat per channel', 'Optimal-time scheduler per niche', 'OAuth for TikTok / YouTube / IG / X / LinkedIn'],
  },
  {
    icon: Cpu,
    title: 'Neural Analytics',
    desc: 'Predict viral potential before you post. Performance flows back into the editor — what worked yesterday biases tomorrow’s suggestions.',
    color: 'text-emerald-400',
    bullets: ['Pre-publish retention forecast', 'Performance learning loop', 'Cross-niche trend radar (6h refresh)'],
  },
];

export function EnginePillars() {
  return (
    <section id="features" className="py-24 px-6 bg-[#020202] relative">
      <div aria-hidden="true" className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-6">
            THE <span className="text-indigo-400">ENGINE</span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg md:text-xl font-medium">
            Three tightly-integrated systems. One creator-grade brain. Every output is shaped by your niche, your platform, and your audience’s last 30 days.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          {PILLARS.map((p, i) => {
            const Icon = p.icon;
            return (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ delay: i * 0.15 }}
                className={`${glass} p-8 rounded-3xl group hover:border-indigo-500/30 transition-all duration-300 hover:-translate-y-1`}
              >
                <div
                  className={`w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform ${p.color}`}
                >
                  <Icon className="w-7 h-7" aria-hidden="true" />
                </div>
                <h3 className="text-2xl font-black mb-4">{p.title}</h3>
                <p className="text-slate-400 font-medium leading-relaxed mb-6">{p.desc}</p>
                <ul className="space-y-2.5 border-t border-white/5 pt-5">
                  {p.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2.5 text-[13px] text-slate-300 font-medium">
                      <span className={`mt-1.5 w-1 h-1 rounded-full ${p.color.replace('text-', 'bg-')} flex-shrink-0`} />
                      <span>{b}</span>
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
