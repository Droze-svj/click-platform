'use client'

import React, { useEffect, useState } from 'react'
import AutonomousCreator from '../../../components/AutonomousCreator'
import IngestPanel from '../../../components/IngestPanel'
import { motion } from 'framer-motion'
import { Zap, Shield, Orbit, Binary, Loader2 } from 'lucide-react'
import { apiGet } from '../../../lib/api'

interface ManifestHistory {
  _id: string;
  title: string;
  topic: string;
  createdAt: string;
  metadata: {
    hooks: any[];
    hashtags: string[];
  };
}

const glassStyle = 'backdrop-blur-3xl bg-white/[0.02] border-2 border-white/10 shadow-[0_50px_150px_rgba(0,0,0,0.8)]'

export default function OneClickForgePage() {
  const [history, setHistory] = useState<ManifestHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true)
      const res = await apiGet('/intelligence/factory/history')
      if (res.success) {
        setHistory(res.data)
      }
    } catch (err) {
      console.error('Failed to fetch history:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    document.title = 'One-Click Forge | CLICK'
    fetchHistory()
  }, [])

  return (
    <div className="min-h-screen p-8 lg:p-12 relative overflow-hidden bg-[#020205]">
      {/* Dynamic Background */}
      <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-indigo-600/10 blur-[200px] rounded-full pointer-events-none animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[70%] bg-purple-600/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E')] opacity-[0.03] mix-blend-overlay pointer-events-none" />

      <div className="max-w-[1400px] mx-auto relative z-10 space-y-20">
        <header className="flex flex-col lg:flex-row items-center justify-between gap-12 border-b-2 border-white/5 pb-16">
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-10"
          >
            <div className="w-24 h-24 rounded-[2.5rem] bg-indigo-600/10 border-2 border-indigo-500/20 flex items-center justify-center shadow-[0_40px_100px_rgba(99,102,241,0.2)] group hover:scale-110 transition-transform duration-300">
               <Zap size={48} className="text-indigo-400 animate-pulse group-hover:rotate-180 transition-transform duration-300" />
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
              <h1 className="text-6xl md:text-6xl font-black text-white italic tracking-tighter uppercase leading-none mb-4 drop-shadow-2xl">
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
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic opacity-40">Operational Pulse</p>
                <div className="flex items-center justify-end gap-3">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)]" />
                   <span className="text-2xl font-black text-white italic tabular-nums">0.038<span className="text-xs text-slate-500 ml-1">ms</span></span>
                </div>
             </div>
             <div className="w-px h-16 bg-white/5" />
             <div className="space-y-2 text-center bg-white/[0.03] border-2 border-white/10 px-8 py-4 rounded-[2rem] shadow-xl">
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest italic">Matrix_Load</p>
                <p className="text-2xl font-black text-white italic tabular-nums uppercase">Stable</p>
             </div>
          </motion.div>
        </header>

        {/* ── Multi-source Ingest ── */}
        <section className="relative z-10">
          <div className="flex items-baseline justify-between mb-6">
            <div>
              <h2 className="text-2xl font-black text-white italic uppercase tracking-tight">Ingest</h2>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-[0.3em] mt-1">Drop a file, paste a link, record live, or remix a previous project.</p>
            </div>
          </div>
          <IngestPanel />
        </section>

        <section className="relative z-10 grid grid-cols-1 xl:grid-cols-12 gap-12">
           <div className="xl:col-span-9">
              <AutonomousCreator />
           </div>
           
           {/* Neural Recall Sidebar */}
           <div className="xl:col-span-3 space-y-8">
              <div className={`${glassStyle} p-10 rounded-[4rem] border-white/5 bg-black/40 min-h-[600px] flex flex-col`}>
                 <div className="flex items-center gap-5 mb-10">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                       <Orbit size={24} className="text-indigo-400" />
                    </div>
                    <div>
                       <h3 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none">Neural Recall</h3>
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic mt-1 leading-none">VIRTUAL_MANIFEST_ARCHIVE</p>
                    </div>
                 </div>

                 <div className="flex-1 space-y-4 overflow-y-auto max-h-[700px] pr-2 scrollbar-hide">
                    {loadingHistory ? (
                      <div className="p-12 flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                        <Loader2 size={32} className="text-indigo-400 animate-spin" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Decrypting_Vault...</p>
                      </div>
                    ) : history.length > 0 ? (
                      history.map((item) => (
                        <div key={item._id} className="p-6 rounded-[2.5rem] bg-white/[0.03] border border-white/5 hover:border-indigo-500/30 transition-all cursor-pointer group">
                           <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest italic mb-2">
                             {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()} {' // '} {new Date(item.createdAt).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
                           </p>
                           <p className="text-sm font-black text-white italic uppercase tracking-tight group-hover:text-indigo-400 transition-colors">{item.title}</p>
                           <div className="flex gap-2 mt-3">
                              <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[8px] font-black text-indigo-400 uppercase">ARCHIVED</span>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-black text-emerald-400 uppercase">STABLE</span>
                           </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-12 flex flex-col items-center justify-center text-center space-y-4 opacity-20 border-2 border-dashed border-white/5 rounded-[3rem]">
                         <Binary size={48} className="text-slate-400" />
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Vault_Empty</p>
                      </div>
                    )}
                 </div>

                 <button
                  type="button"
                  onClick={fetchHistory}
                  className="w-full py-5 rounded-[2.5rem] bg-white/5 border-2 border-white/10 text-slate-500 text-[10px] font-black uppercase tracking-widest italic hover:bg-white/10 hover:text-white transition-all mt-8"
                 >
                    Sync Archive
                 </button>
              </div>

              {/* Matrix Calibration Card */}
              <div className={`${glassStyle} p-8 rounded-[4rem] border-emerald-500/20 bg-emerald-500/5`}>
                 <div className="flex items-center justify-between mb-6">
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest italic">Matrix_Calibration</p>
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                 </div>
                 <div className="space-y-4">
                    <div className="flex justify-between items-end">
                       <span className="text-[9px] font-black text-slate-600 uppercase italic">Signal_Fidelity</span>
                       <span className="text-xl font-black text-white italic tabular-nums">99.9%</span>
                    </div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                       <motion.div initial={{ width: 0 }} animate={{ width: '99.9%' }} className="h-full bg-emerald-500" />
                    </div>
                 </div>
              </div>
           </div>
        </section>

        <footer className="pt-24 pb-12 text-center opacity-30">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[1em] italic">Click Core Neural Vector // v4.26 // One-Click Forge Active</p>
        </footer>
      </div>
    </div>
  )
}
