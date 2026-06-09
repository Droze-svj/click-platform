'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Wand2 } from 'lucide-react';
import { useLandingTheme } from './LandingThemeContext';

export function FinalCTA() {
  const { niche, accent } = useLandingTheme();
  const accentText = niche ? accent.textAccent : 'text-indigo-500';
  return (
    <section className="py-32 px-6 relative flex flex-col items-center justify-center min-h-[60vh]">
      <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#050505]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-indigo-600/15 blur-[160px] rounded-full" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        className="max-w-4xl w-full mx-auto text-center"
      >
        {/* Small invitation pill — Click speaking directly to the visitor. */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase tracking-widest mb-8">
          <Wand2 className="w-3 h-3" aria-hidden="true" />
          Click is ready when you are
        </div>

        <h2 className="text-5xl md:text-7xl font-black tracking-tighter mb-8">
          STOP EDITING. <span className={`${accentText} transition-colors duration-500`}>START SHIPPING.</span>
        </h2>
        <p className="text-slate-400 text-xl md:text-2xl font-medium mb-12 max-w-2xl mx-auto">
          You bring the idea. Click handles the cuts, the captions, the schedule, the five platforms. Then it remembers what worked and gets sharper for tomorrow.
        </p>

        <Link
          href="/register?plan=free"
          className="inline-flex group px-12 py-6 rounded-full bg-white text-black text-lg font-black uppercase tracking-widest hover:bg-slate-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:shadow-[0_0_50px_rgba(255,255,255,0.4)] items-center justify-center gap-4 active:scale-95"
        >
          Try Click free
          <Wand2 className="w-6 h-6 group-hover:rotate-12 transition-transform" aria-hidden="true" />
        </Link>

        <p className="mt-6 text-xs text-slate-600 font-bold uppercase tracking-widest">
          Free forever · No card · First clip in 90 seconds · Cancel anytime
        </p>
      </motion.div>
    </section>
  );
}
