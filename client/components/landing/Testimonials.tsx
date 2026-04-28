'use client';

import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { glass } from './_styles';

const TESTIMONIALS = [
  {
    name: 'Sarah Chen',
    handle: '@sarahcreates',
    quote: 'Click replaced a 3-person editing team. The AI scene detection is literally magic.',
    metric: '+400% Output',
    accent: 'text-fuchsia-400',
  },
  {
    name: 'Marcus Thorne',
    handle: '@marcusthifts',
    quote: 'I connected my YouTube, and Click handles the Shorts distribution on autopilot. My views 10x’d.',
    metric: '1.2M New Views',
    accent: 'text-blue-400',
  },
  {
    name: 'Elena Rodriguez',
    handle: '@elena_tech',
    quote: 'The visual aesthetic out of the box is incredible. The AI knows exactly what retention editing means.',
    metric: '89% Retention',
    accent: 'text-emerald-400',
  },
  {
    name: 'David Park',
    handle: 'StudioForge Agency',
    quote: 'We run 14 client brands through Click. Approval workflows + brand-switching saved us 22 hours a week.',
    metric: '22 hrs / wk saved',
    accent: 'text-amber-400',
  },
];

export function Testimonials() {
  return (
    <section className="py-24 px-6 relative overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-4">
            TRUSTED BY <span className="text-indigo-400">ELITE</span> CREATORS
          </h2>
          <p className="text-slate-500 text-sm md:text-base font-bold uppercase tracking-[0.3em] flex items-center justify-center gap-2">
            <Users className="w-4 h-4" aria-hidden="true" />
            Joining 25,000+ creators worldwide
          </p>
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ delay: i * 0.1 }}
              className={`${glass} p-7 rounded-3xl relative group hover:border-indigo-500/30 hover:-translate-y-1 transition-all duration-300`}
            >
              <div className="text-5xl text-indigo-500/20 absolute top-4 right-6 font-serif select-none" aria-hidden="true">“</div>
              <div className={`text-xs font-black mb-5 uppercase tracking-widest ${t.accent}`}>{t.metric}</div>
              <p className="text-slate-300 font-medium leading-relaxed mb-7 text-[15px]">{t.quote}</p>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500/40 to-fuchsia-500/40 border border-white/10" aria-hidden="true" />
                <div>
                  <div className="font-bold text-sm">{t.name}</div>
                  <div className="text-xs text-slate-500">{t.handle}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
