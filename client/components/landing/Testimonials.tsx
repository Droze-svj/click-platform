'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Sparkles, Rocket, GraduationCap, Layers, ArrowRight } from 'lucide-react';
import { glass } from './_styles';

/**
 * Honest social-proof section.
 *
 * No fabricated names or quotes — these are scenario cards describing
 * the *type* of creator who wins with Click and the metric they care
 * about. Above the grid, a banner invites real customers to share
 * their stories. When real testimonials land, swap this for them.
 */

const SCENARIOS = [
  {
    Icon: Rocket,
    role: 'Rising channel',
    setup: 'Posting daily, hitting 10k followers, watch-time stuck at 35%.',
    win: 'Niche-aware retention rewrites + auto-cuts.',
    metric: 'Watch-time → 60%+',
    accent: 'text-fuchsia-400',
  },
  {
    Icon: Layers,
    role: 'Multi-brand agency',
    setup: '8 client channels. Editor backlog grew faster than the roster.',
    win: 'Workspace switching + approval workflows.',
    metric: 'Per-client edit time ÷ 5',
    accent: 'text-amber-400',
  },
  {
    Icon: GraduationCap,
    role: 'Educator / explainer',
    setup: 'Long-form lectures. Shorts felt impossible without re-shooting.',
    win: 'Smart highlight detection + multi-platform reformat.',
    metric: '1 lecture → 6 platform-native clips',
    accent: 'text-blue-400',
  },
  {
    Icon: Sparkles,
    role: 'Niche specialist',
    setup: 'Finance creator. Generic AI captions kept missing the dollar anchor.',
    win: 'Niche playbook bakes the voice into every prompt.',
    metric: 'CTR on hook frames ↑ 2.4×',
    accent: 'text-emerald-400',
  },
];

export function Testimonials() {
  return (
    <section className="py-24 px-6 relative overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-6">
            Scenarios · Real customer stories landing soon
          </span>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-4">
            BUILT FOR THE WAY <span className="text-indigo-400">CREATORS WIN</span>
          </h2>
          <p className="text-slate-400 text-base md:text-lg font-medium max-w-2xl mx-auto">
            Click optimises for the metrics you actually care about — by creator type, not by buzzword.
          </p>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
          {SCENARIOS.map((s, i) => {
            const { Icon } = s;
            return (
              <motion.div
                key={s.role}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ delay: i * 0.1 }}
                className={`${glass} p-7 rounded-3xl group hover:border-indigo-500/30 hover:-translate-y-1 transition-all duration-300 flex flex-col`}
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className={`w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center ${s.accent}`}>
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-400">{s.role}</div>
                </div>
                <p className="text-sm text-slate-400 font-medium leading-relaxed mb-3">
                  <span className="text-slate-500">Where they were —</span> {s.setup}
                </p>
                <p className="text-sm text-slate-300 font-medium leading-relaxed mb-5">
                  <span className="text-slate-500">What unblocked it —</span> {s.win}
                </p>
                <div className={`mt-auto text-xs font-black uppercase tracking-widest ${s.accent}`}>{s.metric}</div>
              </motion.div>
            );
          })}
        </div>

        {/* Be-the-first banner */}
        <div className="mt-12 text-center">
          <Link
            href="/contact?subject=case-study"
            className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white text-xs font-bold uppercase tracking-widest transition-all group"
          >
            Got a story? Be one of our first case studies
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
