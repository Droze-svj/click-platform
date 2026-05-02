'use client'

import React, { useEffect, useState } from 'react'
import AutonomousCreator from '../../../components/AutonomousCreator'
import IngestPanel from '../../../components/IngestPanel'
import { motion } from 'framer-motion'
import { Zap, Shield, Sparkles, Binary, Loader2, ArrowLeft, History, Cpu, Network, Gauge, RefreshCw } from 'lucide-react'
import { apiGet } from '../../../lib/api'
import { useRouter } from 'next/navigation'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import ToastContainer from '../../../components/ToastContainer'

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

const glassStyle = 'backdrop-blur-3xl bg-white/[0.02] border border-white/5 shadow-2xl transition-all duration-300'

export default function OneClickForgePage() {
  const router = useRouter()
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
    <ErrorBoundary>
      <div className="min-h-screen p-4 sm:p-6 lg:p-12 relative overflow-hidden bg-[var(--page-bg)] text-[var(--text-main)] transition-colors duration-500 font-inter">
        <ToastContainer />

        {/* Atmosphere */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-[0.05]">
          <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-500 rounded-full blur-[160px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-purple-500 rounded-full blur-[160px]" />
        </div>

        <div className="max-w-[1600px] mx-auto relative z-10 space-y-12">
          
          {/* Header HUD */}
          <header className="flex flex-col lg:flex-row items-center justify-between gap-8 border-b border-white/5 pb-12">
            <div className="flex items-center gap-8">
              <button onClick={() => router.push('/dashboard')} className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all hover:scale-105 active:scale-95 shadow-xl">
                <ArrowLeft size={24} />
              </button>
              <div className="w-16 h-16 bg-indigo-500/10 border-2 border-indigo-500/20 rounded-2xl flex items-center justify-center shadow-2xl relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <Zap size={32} className="text-indigo-400 relative z-10 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <Cpu size={14} className="text-indigo-400/80" />
                  <span className="text-[11px] font-black uppercase tracking-[0.4em] text-indigo-400 italic">Neural Forge v4.2</span>
                </div>
                <h1 className="text-5xl font-black text-[var(--text-main)] tracking-tight leading-none uppercase italic">One-Click Forge</h1>
                <p className="text-slate-400 text-sm mt-2 font-medium max-w-xl opacity-80 leading-relaxed">
                  The ultimate AI content synthesizer. Transform a single prompt into a high-retention, platform-ready video object in seconds.
                </p>
              </div>
            </div>

            <div className="hidden xl:flex items-center gap-12 text-right">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic opacity-40 leading-none">Neural Response</p>
                <div className="flex items-center justify-end gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                  <span className="text-2xl font-black text-white tabular-nums">0.03s</span>
                </div>
              </div>
              <div className="w-px h-12 bg-white/10" />
              <div className="bg-white/[0.02] border border-white/5 px-6 py-3 rounded-2xl shadow-xl">
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest italic leading-none mb-2">Engine State</p>
                <p className="text-xl font-black text-white italic uppercase leading-none tracking-tight">Active_Stable</p>
              </div>
            </div>
          </header>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
            
            {/* Left Content: Ingest & Creator */}
            <div className="xl:col-span-9 space-y-12">
              
              {/* Step 1: Ingest */}
              <section className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center text-slate-400">
                    <History size={20} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-[var(--text-main)] uppercase italic tracking-tight">1. Source Ingest</h2>
                    <p className="text-xs font-medium text-slate-500 tracking-wide uppercase italic leading-none mt-1">Initialize your neural project by uploading or linking a source.</p>
                  </div>
                </div>
                <IngestPanel />
              </section>

              {/* Step 2: Synthesis */}
              <section className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-[var(--text-main)] uppercase italic tracking-tight">2. Neural Synthesis</h2>
                    <p className="text-xs font-medium text-slate-500 tracking-wide uppercase italic leading-none mt-1">Configure your AI parameters and ignite the forge.</p>
                  </div>
                </div>
                <div className={`${glassStyle} rounded-[2.5rem] p-2 bg-black/40`}>
                  <AutonomousCreator />
                </div>
              </section>
            </div>

            {/* Right Sidebar: History & Health */}
            <div className="xl:col-span-3 space-y-8">
              
              {/* History Card */}
              <div className={`${glassStyle} rounded-[2.5rem] p-8 bg-black/40 flex flex-col min-h-[500px]`}>
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                    <Network size={24} className="text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-[var(--text-main)] tracking-tight uppercase leading-none italic">Forge Archive</h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 opacity-60">Past Generations</p>
                  </div>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                  {loadingHistory ? (
                    <div className="py-20 text-center space-y-4 opacity-50">
                      <Loader2 size={32} className="text-indigo-400 animate-spin mx-auto" />
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Scanning Vault...</p>
                    </div>
                  ) : history.length > 0 ? (
                    history.map((item) => (
                      <div key={item._id} className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-indigo-500/30 transition-all cursor-pointer group">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                            {new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                          <div className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-black text-emerald-400 uppercase tracking-widest">SUCCESS</div>
                        </div>
                        <p className="text-sm font-bold text-white tracking-tight group-hover:text-indigo-400 transition-colors line-clamp-1">{item.title}</p>
                      </div>
                    ))
                  ) : (
                    <div className="py-20 text-center space-y-4 opacity-30 border-2 border-dashed border-white/5 rounded-3xl">
                      <Binary size={40} className="text-slate-600 mx-auto" />
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Archive Empty</p>
                    </div>
                  )}
                </div>

                <button
                  onClick={fetchHistory}
                  className="mt-8 w-full py-4 bg-white/[0.03] border border-white/10 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:bg-white/[0.06] hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw size={14} className={loadingHistory ? 'animate-spin' : ''} />
                  REFRESH ARCHIVE
                </button>
              </div>

              {/* Engine Health Card */}
              <div className={`${glassStyle} rounded-[2.5rem] p-8 bg-emerald-500/5 border-emerald-500/10`}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="text-emerald-500" size={16} />
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest italic leading-none">Engine Health</span>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <span className="text-[9px] font-black text-slate-500 uppercase italic leading-none">Fidelity Matrix</span>
                    <span className="text-xl font-black text-white italic tabular-nums leading-none">99.8%</span>
                  </div>
                  <div className="h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/5">
                    <motion.div initial={{ width: 0 }} animate={{ width: '99.8%' }} transition={{ duration: 1, ease: 'easeOut' }} className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400" />
                  </div>
                </div>
              </div>

              {/* Resource Pulse */}
              <div className={`${glassStyle} rounded-[2.5rem] p-8 bg-black/40`}>
                <div className="flex items-center gap-2 mb-6">
                  <Gauge className="text-indigo-400" size={16} />
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest italic leading-none">Resource Pulse</span>
                </div>
                <div className="flex items-end gap-1 h-12">
                  {[...Array(12)].map((_, i) => (
                    <motion.div 
                      key={i} 
                      initial={{ height: '20%' }}
                      animate={{ height: [`${20 + Math.random() * 60}%`, `${30 + Math.random() * 70}%`, `${20 + Math.random() * 60}%`] }}
                      transition={{ repeat: Infinity, duration: 1.5 + Math.random(), ease: 'easeInOut' }}
                      className="flex-1 bg-indigo-500/20 rounded-t-sm"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Global Footer Overlay */}
        <footer className="pt-24 pb-12 text-center opacity-20">
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-[1em] italic">Click Core Neural System // v4.2 // Autonomous Mode Active</p>
        </footer>

        <style jsx global>{`
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { 
            background: rgba(255, 255, 255, 0.1); 
            border-radius: 10px; 
          }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}

const ShieldCheck = ({ className, size }: { className?: string; size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg>
)
