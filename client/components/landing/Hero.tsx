'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Play } from 'lucide-react';
import { glass } from './_styles';

export function Hero() {
  return (
    <section className="relative pt-40 md:pt-48 pb-20 md:pb-32 px-6 flex flex-col items-center">
      {/* Animated mesh-gradient background — purely decorative */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-5%] w-[55%] h-[55%] bg-indigo-600/25 blur-[140px] rounded-full motion-safe:animate-pulse" />
        <div className="absolute top-[20%] right-[-10%] w-[45%] h-[55%] bg-fuchsia-600/20 blur-[160px] rounded-full motion-safe:animate-pulse motion-safe:[animation-delay:700ms]" />
        <div className="absolute bottom-[-15%] left-[25%] w-[55%] h-[45%] bg-blue-600/15 blur-[150px] rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto text-center space-y-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-500/5 hover:bg-indigo-500/20 transition-colors cursor-default"
        >
          <Sparkles className="w-3 h-3 text-indigo-400" />
          Click AI 3.0 — niche-aware editor is live
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter leading-[0.9] text-white"
        >
          CONTENT <br />
          <span className="font-[var(--font-playfair)] bg-gradient-to-r from-indigo-400 via-white to-fuchsia-400 bg-clip-text text-transparent italic">
            INTELLIGENCE
          </span>
          .
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-slate-400 text-base md:text-2xl font-medium max-w-2xl mx-auto leading-relaxed"
        >
          The premium command center for high-velocity creators. Niche-aware AI auto-edits, predicts retention, and lands every clip on every platform — automatically.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 pt-6"
        >
          <Link
            href="/register?plan=free"
            className="group w-full sm:w-auto px-10 py-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-base font-black uppercase tracking-widest transition-all shadow-[0_0_40px_rgba(79,70,229,0.3)] hover:shadow-[0_0_60px_rgba(79,70,229,0.5)] flex items-center justify-center gap-3 active:scale-95"
          >
            Start Free
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
          </Link>
          <a
            href="#workflow"
            className={`${glass} group w-full sm:w-auto px-10 py-5 rounded-2xl text-white text-base font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-3 active:scale-95`}
          >
            <Play className="w-5 h-5 fill-white" aria-hidden="true" />
            See It Work
          </a>
        </motion.div>
      </div>
    </section>
  );
}
