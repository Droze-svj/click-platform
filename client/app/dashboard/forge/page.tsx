'use client'

import React, { useEffect } from 'react'
import AutonomousCreator from '../../../components/AutonomousCreator'
import { motion } from 'framer-motion'
import { Zap, Command, Shield, Sparkles, Orbit, Binary } from 'lucide-react'

const glassStyle = 'backdrop-blur-3xl bg-white/[0.02] border-2 border-white/10 shadow-[0_50px_150px_rgba(0,0,0,0.8)]'

export default function OneClickForgePage() {
  useEffect(() => {
    document.title = 'One-Click Forge | CLICK'
  }, [])

  return (
    <div className="min-h-screen p-8 lg:p-12 relative overflow-hidden bg-[#020205]">
      {/* Dynamic Background */}
      <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-indigo-600/10 blur-[200px] rounded-full pointer-events-none animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[70%] bg-purple-600/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none" />

      <div className="max-w-[1400px] mx-auto relative z-10 space-y-20">
        <header className="flex flex-col lg:flex-row items-center justify-between gap-12 border-b-2 border-white/5 pb-16">
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-10"
          >
            <div className="w-24 h-24 rounded-[2.5rem] bg-indigo-600/10 border-2 border-indigo-500/20 flex items-center justify-center shadow-[0_40px_100px_rgba(99,102,241,0.2)] group hover:scale-110 transition-transform duration-1000">
               <Zap size={48} className="text-indigo-400 animate-pulse group-hover:rotate-180 transition-transform duration-1000" />
            </div>
            <div>
              <div className="flex items-center gap-4 mb-3">
                 <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <Shield size={12} className="text-emerald-500" />
                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Autonomous_Lattice_v4.2</span>
                 </div>
                 <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                    <Binary size={12} className="text-indigo-400" />
                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Consensus_Refined</span>
                 </div>
              </div>
              <h1 className="text-6xl md:text-8xl font-black text-white italic tracking-tighter uppercase leading-none mb-4 drop-shadow-2xl">
                One-Click Forge
              </h1>
              <p className="text-slate-500 text-[14px] font-black uppercase tracking-[0.6em] italic leading-none max-w-2xl border-l-2 border-white/10 pl-6 ml-1">
                Synthesize publish-ready cinematic objects from a single neural prompt.
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            className="hidden xl:flex items-center gap-12 text-right"
          >
             <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-1000 uppercase tracking-widest italic opacity-40">Operational Pulse</p>
                <div className="flex items-center justify-end gap-3">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)]" />
                   <span className="text-2xl font-black text-white italic tabular-nums">0.038<span className="text-xs text-slate-900 ml-1">ms</span></span>
                </div>
             </div>
             <div className="w-px h-16 bg-white/5" />
             <div className="space-y-2 text-center bg-white/[0.03] border-2 border-white/10 px-8 py-4 rounded-[2rem] shadow-xl">
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest italic">Matrix_Load</p>
                <p className="text-2xl font-black text-white italic tabular-nums uppercase">Stable</p>
             </div>
          </motion.div>
        </header>

        <section className="relative z-10">
           <AutonomousCreator />
        </section>

        <footer className="pt-24 pb-12 text-center opacity-30">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[1em] italic">Click Core Neural Vector // v4.26 // One-Click Forge Active</p>
        </footer>
      </div>
    </div>
  )
}
