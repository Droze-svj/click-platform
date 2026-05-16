'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Play, Zap, ShieldCheck, Globe, Cpu, Terminal, Activity } from 'lucide-react';

export function Hero() {
  return (
    <section className="relative pt-56 md:pt-72 pb-24 md:pb-56 px-6 flex flex-col items-center overflow-hidden font-inter">
      
      {/* High-Fidelity Spectral Atmosphere */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-[-5%] left-[-10%] w-[60%] h-[60%] bg-primary-600/15 blur-[160px] rounded-full mix-blend-screen opacity-60 animate-[pulse_8s_infinite]" />
        <div className="absolute top-[20%] right-[-10%] w-[50%] h-[60%] bg-fuchsia-600/10 blur-[180px] rounded-full mix-blend-screen opacity-40" />
        <div className="absolute bottom-[-10%] left-[20%] w-[50%] h-[40%] bg-blue-600/10 blur-[160px] rounded-full mix-blend-screen opacity-40" />
      </div>

      <div className="max-w-[1900px] mx-auto text-center space-y-16 relative z-10">
        
        {/* Release Protocol Pill */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-4 px-6 md:px-8 py-3 rounded-full bg-primary-500/10 border-2 border-primary-500/20 text-primary-500 text-[9px] md:text-[11px] font-black uppercase tracking-[0.3em] md:tracking-[0.5em] italic shadow-[0_0_40px_rgba(99,102,241,0.2)] hover:bg-primary-500/20 transition-all cursor-default group magnetic-hover max-w-full"
        >
          <Sparkles className="w-3 h-3 md:w-4 md:h-4 animate-pulse text-spectral-glow shrink-0" />
          <span className="truncate md:whitespace-normal">Meet Click — the editor that ships while you sleep</span>
        </motion.div>

        {/* Cinematic Headline Matrix */}
        <div className="space-y-4 md:space-y-8">
          <motion.h1
            initial={{ opacity: 0, y: 80 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-6xl sm:text-7xl md:text-[10rem] lg:text-[12rem] font-black tracking-tighter leading-[0.8] text-surface-900 dark:text-white uppercase italic group text-spectral-glow flex flex-col items-center"
          >
            <span className="block relative">
              CLICK EDITS.
              <motion.span
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ delay: 0.8, duration: 1.5, ease: "easeInOut" }}
                className="absolute -bottom-4 left-0 h-1 bg-gradient-to-r from-transparent via-primary-500 to-transparent opacity-50"
              />
            </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-surface-900 dark:via-white to-fuchsia-400 drop-shadow-[0_0_30px_rgba(99,102,241,0.3)]">
              YOU SHOW UP.
            </span>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex flex-wrap items-center justify-center gap-4 md:gap-10 pt-4 md:pt-8"
          >
            <div className="flex items-center gap-3 md:gap-4 group/h magnetic-hover">
              <Cpu size={16} className="text-primary-500 group-hover:rotate-12 transition-transform shrink-0" />
              <span className="text-[8px] md:text-[10px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-[0.2em] md:tracking-[0.6em] italic break-words">Edits like you</span>
            </div>
            <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-primary-500/20 shadow-inner animate-pulse" />
            <div className="flex items-center gap-3 md:gap-4 group/h magnetic-hover">
              <Globe size={16} className="text-fuchsia-500 group-hover:rotate-12 transition-transform shrink-0" />
              <span className="text-[8px] md:text-[10px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-[0.2em] md:tracking-[0.6em] italic break-words">Posts everywhere</span>
            </div>
            <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-primary-500/20 shadow-inner animate-pulse [animation-delay:1s]" />
            <div className="flex items-center gap-3 md:gap-4 group/h magnetic-hover">
              <ShieldCheck size={16} className="text-emerald-500 group-hover:rotate-12 transition-transform shrink-0" />
              <span className="text-[8px] md:text-[10px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-[0.2em] md:tracking-[0.6em] italic break-words">Learns every post</span>
            </div>
          </motion.div>
        </div>

        <motion.p
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 1 }}
          className="text-surface-600 dark:text-slate-400 text-xl md:text-3xl font-medium max-w-4xl mx-auto leading-relaxed italic uppercase tracking-tight opacity-80"
        >
          Drop one raw video. Click cuts the dead air, writes the hooks, picks the post time, and ships it to TikTok, Reels, Shorts, X, and LinkedIn — then watches what works and gets sharper for tomorrow. You stay creative. Click stays awake.
        </motion.p>

        {/* Tactical Actions HUD */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 1 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-8 pt-12"
        >
          <Link
            href="/register?plan=free"
            className="group w-full sm:w-auto px-16 py-7 rounded-[2.5rem] bg-surface-900 dark:bg-white text-white dark:text-black text-[12px] font-black uppercase tracking-[0.6em] italic transition-all shadow-[0_40px_80px_rgba(0,0,0,0.5)] hover:shadow-[0_60px_120px_rgba(0,0,0,0.7)] hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white flex items-center justify-center gap-6 active:scale-95 border-none btn-shimmer magnetic-hover"
          >
            Let Click cook
            <ArrowRight className="w-6 h-6 group-hover:translate-x-4 transition-transform duration-500" />
          </Link>
          <a
            href="#workflow"
            className="group w-full sm:w-auto px-16 py-7 rounded-[2.5rem] bg-surface-card dark:bg-black/40 backdrop-blur-[40px] border-2 border-surface-100 dark:border-white/10 text-surface-900 dark:text-white text-[12px] font-black uppercase tracking-[0.6em] italic hover:bg-surface-card hover:border-primary-500/40 transition-all flex items-center justify-center gap-6 active:scale-95 shadow-2xl magnetic-hover"
          >
            <Play className="w-6 h-6 fill-current group-hover:scale-125 transition-transform duration-500" />
            See it in 60 seconds
          </a>
        </motion.div>

        {/* Trust micro-line under the CTAs */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 1 }}
          className="text-[10px] md:text-xs text-surface-400 dark:text-slate-600 font-bold uppercase tracking-[0.4em] italic pt-2"
        >
          Free forever. No card. First clip out in 90 seconds.
        </motion.p>
      </div>

      {/* High-Fidelity HUD Decorations — ambient signals of Click being alive.
          Left rail: a "Click is thinking" pulse. Right rail: an honest 5-platform
          ping array (no fabricated uptime number — we don't have a real one to
          quote yet, and the platform-ping pattern reads as "the editor is
          watching the feeds" which is more on-brand anyway). */}
      <div className="absolute bottom-24 left-12 hidden xl:flex flex-col gap-6 opacity-20 pointer-events-none">
         <div className="flex items-center gap-4">
            <Activity size={24} className="text-primary-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.8em] italic text-primary-500">Click is cooking</span>
         </div>
         <div className="h-[2px] w-64 bg-surface-100 dark:bg-white/5 rounded-full overflow-hidden border border-white/5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '92%' }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="h-full bg-gradient-to-r from-primary-500 to-fuchsia-500 shadow-[0_0_15px_rgba(99,102,241,0.8)]"
            />
         </div>
      </div>

      <div className="absolute bottom-24 right-12 hidden xl:flex flex-col gap-6 opacity-20 pointer-events-none items-end text-right">
         <div className="flex items-center gap-4 justify-end">
            <span className="text-[10px] font-black uppercase tracking-[0.8em] italic text-primary-500">Listening to five feeds</span>
            <Terminal size={24} className="text-primary-500" />
         </div>
         <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic leading-none max-w-[180px]">TikTok · Reels · Shorts · X · LinkedIn</p>
         <div className="flex gap-1">
            {[1,2,3,4,5].map(i => (
              <motion.div
                key={i}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 2, delay: i * 0.2, repeat: Infinity }}
                className="w-4 h-1 bg-primary-500/40 rounded-full"
              />
            ))}
         </div>
      </div>

      {/* Cinematic Gradient Fade */}
      <div className="absolute bottom-0 left-0 right-0 h-96 bg-gradient-to-t from-surface-page via-surface-page/50 to-transparent z-10 pointer-events-none" />

    </section>
  );
}
