'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Play, Zap, ShieldCheck, Globe } from 'lucide-react';

const glass = 'backdrop-blur-3xl bg-white/[0.02] border border-white/5 shadow-2xl';

export function Hero() {
  return (
    <section className="relative pt-40 md:pt-56 pb-20 md:pb-40 px-6 flex flex-col items-center overflow-hidden">
      
      {/* Animated Atmosphere */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-5%] w-[60%] h-[60%] bg-indigo-600/20 blur-[140px] rounded-full animate-pulse" />
        <div className="absolute top-[20%] right-[-10%] w-[50%] h-[60%] bg-fuchsia-600/15 blur-[160px] rounded-full animate-pulse [animation-delay:1000ms]" />
        <div className="absolute bottom-[-10%] left-[20%] w-[50%] h-[40%] bg-blue-600/10 blur-[150px] rounded-full" />
      </div>

      <div className="max-w-[1400px] mx-auto text-center space-y-12">
        
        {/* Release Pill */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.4em] shadow-2xl shadow-indigo-500/10 hover:bg-indigo-500/20 transition-all cursor-default group"
        >
          <Sparkles className="w-3 h-3 text-indigo-400 animate-pulse" />
          <span>Click AI v4.0 — Neural Forge is Live</span>
        </motion.div>

        {/* Cinematic Headline */}
        <div className="space-y-4">
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-7xl md:text-[10rem] lg:text-[12rem] font-black tracking-tighter leading-[0.8] text-white"
          >
            CONTENT <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-white to-fuchsia-400 italic">
              INTELLIGENCE
            </span>
          </motion.h1>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="flex items-center justify-center gap-8 pt-4"
          >
            <div className="flex items-center gap-3">
              <ShieldCheck size={14} className="text-emerald-500/60" />
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic opacity-60">Consensus Refined</span>
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
            <div className="flex items-center gap-3">
              <Globe size={14} className="text-indigo-500/60" />
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic opacity-60">Omni-Channel Mesh</span>
            </div>
          </motion.div>
        </div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-slate-400 text-lg md:text-2xl font-medium max-w-3xl mx-auto leading-relaxed opacity-80"
        >
          The premium command center for high-velocity creators. Our niche-aware neural model auto-edits, predicts retention, and lands every clip on every platform — automatically.
        </motion.p>

        {/* Primary Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-10"
        >
          <Link
            href="/register?plan=free"
            className="group w-full sm:w-auto px-12 py-6 rounded-2xl bg-white text-black text-sm font-black uppercase tracking-widest transition-all shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:shadow-[0_0_60px_rgba(255,255,255,0.2)] hover:bg-indigo-500 hover:text-white flex items-center justify-center gap-4 active:scale-95"
          >
            Get Started Free
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <a
            href="#workflow"
            className={`${glass} group w-full sm:w-auto px-12 py-6 rounded-2xl text-white text-sm font-black uppercase tracking-widest hover:bg-white/5 transition-all flex items-center justify-center gap-4 active:scale-95`}
          >
            <Play className="w-5 h-5 fill-white group-hover:scale-110 transition-transform" />
            See Neural Forge
          </a>
        </motion.div>
      </div>

      {/* Decorative Grid */}
      <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-[#050505] to-transparent z-10 pointer-events-none" />
    </section>
  );
}
