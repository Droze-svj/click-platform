'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  TrendingUp, Eye, Heart, Share2, Zap, Brain, Sparkles, 
  RefreshCw, Shield, Fingerprint, ActivitySquare, Terminal, 
  Boxes, Target, Cpu, Monitor, Network, Globe, Activity,
  ArrowUpRight, MessageSquare, Flame, Clock, Waves
} from 'lucide-react'
import { apiGet } from '@/lib/api'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import ToastContainer from '@/components/ToastContainer'
import SpectralLoader from '@/components/SpectralLoader'

// ── Types ─────────────────────────────────────────────────────────────────────
interface AnalyticsOverview {
  total_posts: number
  total_views: number
  total_engagement: number
  avg_engagement_rate: number
  published_posts: number
}

interface NodeRecord {
  id: string
  title: string
  platform: string
  views: number
  engagement: number
  engagement_rate: number
  status: string
  publishedAt?: string
  viralScore?: number
}

const glass = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl transition-all duration-700'

export default function SovereignAnalyticsMatrix() {
  const [data, setData] = useState<AnalyticsOverview | null>(null)
  const [nodes, setNodes] = useState<NodeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchMatrix = async () => {
    setRefreshing(true)
    try {
      const res = await apiGet('/analytics/dashboard')
      setData(res.overview)
      
      const nodeRes = await apiGet('/analytics/creator/stats')
      setNodes(nodeRes.stats || [])
    } catch (err) {
      console.error('Matrix uplink failed', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchMatrix() }, [])

  if (loading) return <SpectralLoader />

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#020205] text-white relative z-10 pb-48 px-10 pt-16 max-w-[1750px] mx-auto space-y-24 overflow-x-hidden">
        <ToastContainer />
        
        {/* Background Ambience */}
        <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
           <Fingerprint size={1000} className="text-white absolute -bottom-40 -left-40 rotate-12" />
           <Network size={800} className="text-white absolute -top-40 -right-40 -rotate-12" />
        </div>

        {/* Matrix Header */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-16 relative z-50">
           <div className="flex items-center gap-12">
              <div className="w-24 h-24 bg-indigo-500/5 border border-indigo-500/20 rounded-[3rem] flex items-center justify-center shadow-2xl relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-100" />
                <Brain size={44} className="text-indigo-400 relative z-10 group-hover:scale-125 transition-transform duration-300" />
              </div>
              <div>
                 <div className="flex items-center gap-6 mb-3">
                   <div className="flex items-center gap-3">
                      <Shield size={16} className="text-indigo-400 animate-pulse" />
                      <span className="text-[12px] font-black uppercase tracking-[0.6em] text-indigo-400 italic leading-none">Diagnostic Matrix v9.4.2</span>
                   </div>
                   <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-black/40 border border-white/5 shadow-inner">
                       <ActivitySquare size={12} className="text-indigo-400 animate-pulse" />
                       <span className="text-[9px] font-black text-slate-400 tracking-widest uppercase italic leading-none">RESONANCE_MONITOR_ACTIVE</span>
                   </div>
                 </div>
                 <h1 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none mb-2">Analytics Matrix</h1>
                 <p className="text-slate-400 text-[14px] uppercase font-black tracking-[0.4em] italic leading-none">Autonomous content DNA analysis and global substrate monitoring.</p>
              </div>
           </div>

           <div className="flex flex-wrap items-center gap-6">
              <button 
                onClick={fetchMatrix}
                disabled={refreshing}
                className="px-12 py-6 bg-white text-black hover:bg-indigo-500 hover:text-white font-black uppercase text-[15px] tracking-[0.6em] italic rounded-[3rem] transition-all shadow-[0_40px_100px_rgba(255,255,255,0.1)] active:scale-95 flex items-center gap-6 group"
              >
                <RefreshCw size={24} className={refreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-300'} />
                {refreshing ? 'SYNCING_NODES...' : 'SYNC_MATRIX'}
              </button>
           </div>
        </header>

        {/* Neural Potency & Master Metrics HUD */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-10 relative z-10 w-full overflow-x-hidden">
          {/* Potency Ring Card */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            className={`xl:col-span-2 ${glass} p-12 rounded-[5rem] flex flex-col lg:flex-row items-center gap-16 bg-gradient-to-br from-indigo-500/5 to-transparent border-white/5 shadow-2xl relative overflow-hidden`}
          >
            <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none" />
            
            {/* Neural Potency Ring */}
            <div className="flex flex-col items-center gap-6 shrink-0 relative z-10">
              <div className={`w-52 h-52 rounded-full border-[10px] border-indigo-500/30 flex flex-col items-center justify-center bg-indigo-500/5 shadow-[inset_0_0_60px_rgba(0,0,0,0.8)] relative group`}>
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <span className={`text-7xl font-black italic tracking-tighter text-white tabular-nums leading-none`}>
                  {data?.avg_engagement_rate || 0}%
                </span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] mt-2">AFFINITY</span>
              </div>
              <div className="px-6 py-2 rounded-full bg-black/40 border border-white/5">
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] italic leading-none">Neural Potency Index</span>
              </div>
            </div>

            {/* Heuristic Inference Feed */}
            <div className="space-y-8 flex-1 relative z-10 text-center lg:text-left">
              <div className="flex items-center justify-center lg:justify-start gap-4">
                <Sparkles size={18} className="text-indigo-400 animate-pulse" />
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.6em] italic">Engine_Heuristic_Link</span>
              </div>
              <h2 className="text-4xl font-black italic text-white leading-tight uppercase tracking-tighter max-w-xl">
                 &ldquo;Spectral signals are {(data?.avg_engagement_rate ?? 0) > 5 ? 'PEAKING' : 'STABLE'}. Kinetic resonance manifests in frames 0-4.&rdquo;
              </h2>
              <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
                 <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black text-emerald-400 uppercase tracking-widest italic">
                    <TrendingUp size={12} /> SIGNAL_POSITIVE
                 </div>
                 <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 text-[10px] font-black text-violet-400 uppercase tracking-widest italic">
                    <Activity size={12} /> RESONANCE_LOCK
                 </div>
              </div>
            </div>
          </motion.div>

          {/* Quick Metrics Grid */}
          <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-10">
             <ScoreCard label="Global Reach" value={fmt(data?.total_views || 0)} icon={Eye} color="text-rose-400" trend="+12.4%" />
             <ScoreCard label="Spectral Gravity" value={fmt(data?.total_engagement || 0)} icon={Waves} color="text-violet-400" trend="+8.2%" />
             <ScoreCard label="Sync Nodes" value={data?.total_posts || 0} icon={Boxes} color="text-indigo-400" trend="Active" />
             <ScoreCard label="Cortex Sync" value="MASTER" icon={Cpu} color="text-emerald-400" trend="VERIFIED" />
          </div>
        </div>

        {/* Global Node Ledger */}
        <div className={`${glass} rounded-[6rem] overflow-hidden flex flex-col bg-black/40 border-white/5 shadow-[inset_0_0_100px_rgba(0,0,0,0.6)] relative`}>
           <div className="absolute top-0 right-0 p-32 opacity-[0.01] pointer-events-none border-none"><Monitor size={500} /></div>
           <div className="flex flex-col md:flex-row items-center justify-between px-16 py-12 border-b border-white/5 bg-white/[0.01] gap-8 relative z-10">
              <div className="flex items-center gap-8 text-white">
                 <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 shadow-2xl shadow-indigo-500/20"><Terminal size={32} className="text-indigo-400" /></div>
                 <div>
                    <h3 className="text-4xl font-black italic uppercase tracking-tighter leading-none mb-1">Spectral Node Repository</h3>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.4em] italic leading-none">Real-time surveillance of manifested content nodes.</p>
                 </div>
              </div>
           </div>

           <div className="divide-y divide-white/[0.02] max-h-[1000px] overflow-y-auto no-scrollbar relative z-10">
             {nodes.map((node, idx) => (
               <motion.div key={node.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                 className={`flex items-center gap-10 px-16 py-10 cursor-pointer group transition-all duration-700 relative hover:bg-white/[0.03] border-l-[12px] border-l-transparent hover:border-l-indigo-500`}
               >
                 <div className="text-[16px] font-black text-slate-500 w-8 tabular-nums italic">{String(idx + 1).padStart(2, '0')}</div>

                 <div className={`w-16 h-16 rounded-[2rem] bg-black/60 border border-white/10 flex items-center justify-center text-white text-3xl shrink-0 shadow-[0_20px_40px_rgba(0,0,0,0.5)] group-hover:rotate-12 transition-transform duration-300 uppercase font-black italic`}>
                   {node.platform === 'tiktok' ? '♪' : node.platform === 'instagram' ? '◈' : '▶'}
                 </div>

                 <div className="flex-1 min-w-0">
                   <p className="text-3xl font-black text-white truncate uppercase italic tracking-tighter group-hover:text-indigo-400 transition-colors duration-700">{node.title}</p>
                   <div className="flex items-center gap-6 mt-3 text-[12px] font-black text-slate-400 uppercase tracking-widest italic leading-none">
                      <div className="flex items-center gap-2"><Cpu size={14} /> <span>{node.platform.toUpperCase()} PHANTOM NODE</span></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />
                      <div className="flex items-center gap-2"><Clock size={14} /> <span>{new Date(node.publishedAt || Date.now()).toLocaleDateString()} CYCLE</span></div>
                   </div>
                 </div>

                 <div className="flex items-center gap-12 shrink-0">
                   <div className="text-right hidden sm:block">
                     <div className="text-4xl font-black text-white italic tracking-tighter tabular-nums leading-none">{fmt(node.views)}</div>
                     <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">SATURATION</div>
                   </div>
                   <div className={`w-16 h-16 rounded-[2rem] flex items-center justify-center text-2xl font-black border-2 shrink-0 shadow-[0_20px_40px_rgba(0,0,0,0.4)] ${(node.viralScore ?? 0) >= 80 ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-indigo-500/30 text-indigo-400 bg-indigo-500/10'}`}>
                     {node.viralScore ?? 0}
                   </div>
                   <div className="flex flex-col items-center gap-1">
                      <ArrowUpRight size={24} className="text-emerald-400 opacity-20 group-hover:opacity-100 transition-opacity" />
                   </div>
                 </div>
               </motion.div>
             ))}

             {nodes.length === 0 && !loading && (
               <div className="py-32 flex flex-col items-center justify-center opacity-20">
                  <Activity size={64} className="animate-pulse mb-8" />
                  <span className="text-[12px] font-black uppercase tracking-[0.5em]">No nodes manifested in current cycle.</span>
               </div>
             )}
           </div>
        </div>

        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { font-family: 'Inter', sans-serif; background: #020205; color: white; overflow-x: hidden; }
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); }
          ::-webkit-scrollbar-thumb { background: rgba(79, 70, 229, 0.2); border-radius: 10px; }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}

function ScoreCard({ label, value, icon: Icon, color, trend }: { label: string; value: string | number; icon: any; color: string; trend: string }) {
  return (
    <motion.div whileHover={{ y: -10, scale: 1.02 }}
      className={`${glass} p-10 rounded-[4rem] flex flex-col items-center text-center group border-white/5 relative overflow-hidden shadow-2xl`}
    >
       <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-10 transition-opacity duration-700 pointer-events-none"><Activity size={100} className="text-white" /></div>
       <div className={`w-20 h-20 rounded-[2rem] bg-black/40 border border-white/10 flex items-center justify-center mb-6 shadow-2xl group-hover:rotate-12 transition-all duration-300`}>
          <Icon size={32} className={color} />
       </div>
       <div className="text-6xl font-black text-white italic tracking-tighter tabular-nums leading-none mb-4">{value}</div>
       <div className="text-[11px] text-slate-400 font-black uppercase tracking-[0.4em] italic mb-6 leading-none group-hover:text-white transition-colors">{label}</div>
       <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest italic bg-white/5 px-6 py-2 rounded-full border border-white/5">
          {trend}
       </div>
    </motion.div>
  )
}

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}

function Lightbulb({ size, className }: { size: number, className: string }) {
  return <Sparkles size={size} className={className} />
}
