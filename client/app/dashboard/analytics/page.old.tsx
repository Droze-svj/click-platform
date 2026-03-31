'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiGet } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'
import {
  BarChart3, TrendingUp, Eye, Heart, Target, Calendar,
  Award, Zap, RefreshCw, ArrowLeft, ArrowUpRight, ChevronRight,
  MessageSquare, Share2, Clock, Activity, Shield, Cpu, Radio,
  Globe, Hexagon, PieChart, LineChart, BarChart, Terminal,
  Box, Network, ZapOff, ArrowRight, Layers, Fingerprint,
  Monitor, Compass, Boxes
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import ToastContainer from '../../../components/ToastContainer'

// ── Interfaces ──────────────────────────────────────────────────────────────

interface AnalyticsOverview {
  total_posts: number
  published_posts: number
  total_views: number
  total_engagement: number
  avg_engagement_rate: string
}
interface PlatformDistribution {
  [platform: string]: { posts: number; views: number; engagement: number }
}
interface TopPerformingPost {
  id: string; title: string; published_at: string
  total_views: number; total_engagement: number; avg_engagement_rate: string
}
interface DashboardData {
  overview: AnalyticsOverview
  platform_distribution: PlatformDistribution
  recent_posts: any[]
  top_performing_posts: TopPerformingPost[]
  engagement_trends?: any[]
  content_performance?: any
}

const PLATFORM_CFG: Record<string, { gradient: string; icon: string; color: string }> = {
  twitter:   { gradient: 'from-slate-400 to-slate-900',         icon: '𝕏', color: 'text-slate-400'  },
  linkedin:  { gradient: 'from-blue-600 to-blue-900',       icon: 'in', color: 'text-blue-400' },
  instagram: { gradient: 'from-pink-500 to-purple-600',     icon: '◎', color: 'text-pink-400'  },
  facebook:  { gradient: 'from-indigo-600 to-indigo-900',   icon: 'f', color: 'text-indigo-400'  },
  tiktok:    { gradient: 'from-slate-800 to-black',       icon: '♪', color: 'text-white'  },
  youtube:   { gradient: 'from-red-600 to-red-900',         icon: '▶', color: 'text-red-400'  },
}

const glassStyle = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl transition-all duration-500'

const MOCK: DashboardData = {
  overview: { total_posts: 45, published_posts: 38, total_views: 12547, total_engagement: 2341, avg_engagement_rate: '18.6%' },
  platform_distribution: {
    instagram: { posts: 15, views: 5420, engagement: 890 },
    tiktok:    { posts: 12, views: 3890, engagement: 756 },
    youtube:   { posts: 8,  views: 2150, engagement: 423 },
    twitter:   { posts: 10, views: 1087, engagement: 272 },
  },
  recent_posts: [],
  top_performing_posts: [
    { id: '1', title: 'Viral Dance Challenge Tutorial', published_at: new Date(Date.now() - 345600000).toISOString(), total_views: 5420, total_engagement: 1234, avg_engagement_rate: '22.7%' },
    { id: '2', title: 'Morning Routine for Creators',   published_at: new Date(Date.now() - 432000000).toISOString(), total_views: 3890, total_engagement: 890,  avg_engagement_rate: '22.9%' },
  ],
}

export default function SpectralIntelligencePage() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)

  const loadSpectralMatrix = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true)
    setError(null)
    try {
      if (process.env.NODE_ENV === 'development') {
        await new Promise(r => setTimeout(r, 1200)); setData(MOCK)
      } else {
        const res: any = await apiGet('/analytics/dashboard'); setData(res?.data ?? res)
      }
    } catch (err: any) {
      setError(err.message || 'SPECTRAL_SYNC_INTERFACE_OFFLINE')
    } finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { loadSpectralMatrix() }, [loadSpectralMatrix])

  const fmt = (n: number) => n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(n)

  if (loading) return (
     <div className="flex flex-col items-center justify-center py-48 bg-[#020205] min-h-screen">
        <Monitor size={64} className="text-indigo-500 animate-spin mb-8" />
        <span className="text-[12px] font-black text-slate-800 uppercase tracking-[0.6em] animate-pulse italic">Interpreting Spectral Intelligence...</span>
     </div>
  )

  if (error || !data) return (
     <div className="min-h-screen relative z-10 pb-24 px-8 pt-12 max-w-[1700px] mx-auto space-y-16 bg-[#020205]">
        <header className="flex items-center gap-12">
           <button onClick={() => router.push('/dashboard')} className="w-20 h-20 rounded-[2.2rem] bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-800 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-2xl"><ArrowLeft size={36}/></button>
           <h1 className="text-6xl font-black text-white italic uppercase tracking-tighter">Spectral Void</h1>
        </header>
        <div className={`${glassStyle} p-32 rounded-[5rem] text-center border-rose-500/20 max-w-3xl mx-auto shadow-[0_0_200px_rgba(225,29,72,0.1)]`}>
           <ZapOff size={80} className="text-rose-500 mx-auto mb-10 animate-pulse" />
           <h2 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-none mb-8">Signal Diffraction Detected</h2>
           <p className="text-[14px] text-slate-800 font-black uppercase tracking-[0.4em] italic leading-relaxed">{error || 'SPECTRAL_STREAM_DISRUPTED'}</p>
           <button onClick={() => loadSpectralMatrix()} className="mt-16 px-20 py-10 bg-rose-600 text-white rounded-[3rem] text-[15px] font-black uppercase tracking-[0.4em] hover:bg-rose-500 transition-all shadow-2xl shadow-rose-600/40 italic active:scale-95">Initiate Re-Sync</button>
        </div>
     </div>
  )

  const STATS = [
    { label: 'Operational Nodes', value: data.overview.total_posts, sub: `${data.overview.published_posts} ACTIVE_PHANTOMS`, icon: Cpu, color: 'text-indigo-400' },
    { label: 'Spectral Saturation', value: fmt(data.overview.total_views), sub: 'CUMULATIVE_REACH', icon: Eye, color: 'text-emerald-400' },
    { label: 'Resonance Signal', value: fmt(data.overview.total_engagement), sub: 'AFFINITY_PARTICLES', icon: Activity, color: 'text-purple-400' },
    { label: 'Trajectory Kinetic', value: data.overview.avg_engagement_rate, sub: 'PEAK_MOMENTUM_HZ', icon: TrendingUp, color: 'text-amber-400' },
  ]

  const platforms = Object.entries(data.platform_distribution)
  const maxViews = Math.max(...platforms.map(([, s]) => s.views), 1)

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-24 px-10 pt-16 max-w-[1750px] mx-auto space-y-24">
        <ToastContainer />
        <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
           <Monitor size={800} className="text-white absolute -bottom-40 -left-40 rotate-12" />
        </div>
        
        <header className="flex flex-col 2xl:flex-row justify-between items-start 2xl:items-center gap-16 relative z-50">
           <div className="flex items-center gap-12">
              <button onClick={() => router.push('/dashboard')} className="w-20 h-20 rounded-[2.2rem] bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-800 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-2xl"><ArrowLeft size={36}/></button>
              <div className="w-24 h-24 bg-indigo-500/5 border border-indigo-500/20 rounded-[3rem] flex items-center justify-center shadow-2xl relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-100" />
                <BarChart3 size={44} className="text-indigo-400 relative z-10 group-hover:scale-125 transition-transform duration-700" />
              </div>
              <div>
                 <div className="flex items-center gap-6 mb-3">
                   <div className="flex items-center gap-3">
                      <Fingerprint size={16} className="text-indigo-400 animate-pulse" />
                      <span className="text-[12px] font-black uppercase tracking-[0.6em] text-indigo-400 italic leading-none">Intelligence.Ledger.v9.4.2</span>
                   </div>
                   <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-black/40 border border-white/5 shadow-inner">
                       <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
                       <span className="text-[9px] font-black text-slate-800 tracking-widest uppercase italic leading-none">SIGNAL_STABLE</span>
                   </div>
                 </div>
                 <h1 className="text-8xl font-black text-white italic uppercase tracking-tighter leading-none mb-2">Spectral Intel</h1>
                 <p className="text-slate-800 text-[14px] uppercase font-black tracking-[0.4em] italic leading-none">Neural intelligence and cross-node resonance surveillance matrix.</p>
              </div>
           </div>
           <button onClick={() => loadSpectralMatrix(true)} disabled={refreshing} className="px-16 py-8 bg-white text-black rounded-[3.5rem] text-[15px] font-black uppercase tracking-[0.6em] shadow-[0_40px_100px_rgba(255,255,255,0.1)] hover:bg-indigo-500 hover:text-white transition-all flex items-center gap-6 italic active:scale-95">
              <RefreshCw size={28} className={refreshing ? 'animate-spin' : ''} /> {refreshing ? 'INTERPRETING...' : 'SYNC_NEURAL_INTEL'}
           </button>
        </header>

        {/* ── Neural Stats Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 relative z-10">
          {STATS.map((s, i) => (
            <motion.div 
              initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1, duration: 0.8 }}
              key={s.label} 
              className={`${glassStyle} rounded-[5rem] p-16 flex flex-col items-center text-center group hover:bg-white/[0.05] border-white/5 relative overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.5)]`}
            >
              <div className="absolute top-0 right-0 p-12 opacity-0 group-hover:opacity-5 transition-opacity duration-1000"><Compass size={120} className="text-white" /></div>
              <div className={`w-24 h-24 rounded-[2.5rem] bg-white/[0.02] border border-white/10 flex items-center justify-center mb-12 shadow-2xl group-hover:scale-110 group-hover:rotate-12 transition-all duration-700`}>
                <s.icon size={44} className={s.color} />
              </div>
              <div className="text-7xl font-black text-white italic tabular-nums leading-none tracking-tighter mb-8">{s.value}</div>
              <div className="text-[14px] text-slate-800 font-black uppercase tracking-[0.4em] italic leading-none">{s.label}</div>
              <div className="text-[10px] text-slate-950 font-black uppercase tracking-widest mt-6 italic bg-white/5 px-6 py-2 rounded-full border border-white/5">{s.sub}</div>
            </motion.div>
          ))}
        </div>

        {/* ── Node Velocity Lattice ── */}
        <div className={`${glassStyle} rounded-[6rem] overflow-hidden relative z-10 border-white/5 shadow-[0_60px_120px_rgba(0,0,0,0.5)]`}>
          <div className="px-20 py-16 border-b border-white/5 flex flex-col xl:flex-row items-center justify-between gap-12 bg-white/[0.02] relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-[0.02] pointer-events-none"><Network size={500} className="text-white" /></div>
            <div className="flex items-center gap-10 relative z-10">
               <div className="w-18 h-18 bg-indigo-500/5 border border-indigo-500/20 rounded-[2.2rem] flex items-center justify-center animate-pulse shadow-2xl"><Radio size={36} className="text-indigo-400" /></div>
               <div>
                  <h2 className="font-black text-white italic uppercase tracking-tighter text-5xl leading-none">Node Velocity Lattice</h2>
                  <p className="text-[12px] text-slate-800 font-black uppercase tracking-[0.6em] italic mt-3 leading-none">Global spectral signature surveillance and resonance mapping</p>
               </div>
            </div>
            <div className="px-12 py-5 rounded-[2.5rem] bg-indigo-500/5 border border-indigo-500/20 text-[13px] font-black uppercase tracking-[0.5em] text-indigo-400 shadow-[0_0_60px_rgba(99,102,241,0.1)] flex items-center gap-6 relative z-10">
               <div className="w-3 h-3 rounded-full bg-indigo-500 animate-ping shadow-[0_0_15px_rgba(99,102,241,1)]" />
               SURVEILLANCE_ACTIVE_V9
            </div>
          </div>
          
          <div className="p-16">
            {platforms.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-16">
                {platforms.map(([platform, stats]) => {
                  const cfg = PLATFORM_CFG[platform] || { gradient: 'from-slate-600 to-black', icon: '?', color: 'text-white' }
                  const engPct = stats.views > 0 ? Math.min(100, (stats.engagement / stats.views) * 100 * 5) : 0
                  const viewPct = Math.min(100, (stats.views / maxViews) * 100)
                  return (
                    <motion.div whileHover={{ y: -15 }} key={platform} className="bg-black/40 border border-white/5 rounded-[5rem] p-12 hover:border-indigo-500/40 transition-all duration-700 group relative overflow-hidden shadow-2xl">
                      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                      <div className="flex items-center gap-8 mb-20 relative z-10">
                        <div className={`w-24 h-24 rounded-[3rem] bg-gradient-to-br ${cfg.gradient} flex items-center justify-center text-white font-black text-4xl shadow-2xl group-hover:scale-110 group-hover:rotate-12 transition-all duration-1000 border border-white/10`}>{cfg.icon}</div>
                        <div>
                          <p className="text-[28px] font-black text-white uppercase italic tracking-tighter leading-none mb-3">{platform.toUpperCase()}</p>
                          <p className="text-[12px] text-slate-800 font-black uppercase tracking-[0.4em] italic leading-none">{stats.posts} NODES_ACTIVE</p>
                        </div>
                      </div>
                      <div className="space-y-16 relative z-10">
                        <div className="space-y-8">
                          <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-[0.4em]">
                            <span className="text-slate-800 italic">Spectral_Saturation</span>
                            <span className="text-indigo-400 tabular-nums italic bg-indigo-500/10 px-4 py-1.5 rounded-xl border border-indigo-500/10">{fmt(stats.views)}</span>
                          </div>
                          <div className="h-2.5 bg-black/60 rounded-full overflow-hidden shadow-inner border border-white/5">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${viewPct}%` }} className="h-full bg-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.8)]" transition={{ duration: 2.5, ease: "circOut" }} />
                          </div>
                        </div>
                        <div className="space-y-8">
                          <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-[0.4em]">
                            <span className="text-slate-800 italic">Resonance_Signal</span>
                            <span className="text-emerald-400 tabular-nums italic bg-emerald-500/10 px-4 py-1.5 rounded-xl border border-emerald-500/10">{fmt(stats.engagement)}</span>
                          </div>
                          <div className="h-2.5 bg-black/60 rounded-full overflow-hidden shadow-inner border border-white/5">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${engPct}%` }} className="h-full bg-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.8)]" transition={{ duration: 2.5, ease: "circOut", delay: 0.4 }} />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            ) : (
              <div className="py-64 text-center flex flex-col items-center gap-12 opacity-[0.05]">
                <Radio size={120} className="text-white animate-pulse" />
                <p className="text-white text-[24px] font-black uppercase tracking-[1em] italic leading-none">NO_SPECTRAL_SIGNATURES</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Peak Trajectories Array ── */}
        <div className={`${glassStyle} rounded-[6rem] overflow-hidden relative z-10 border-white/5 shadow-[0_60px_120px_rgba(0,0,0,0.5)]`}>
          <div className="px-20 py-16 border-b border-white/5 flex flex-col xl:flex-row items-center justify-between gap-12 bg-white/[0.02] relative overflow-hidden">
            <div className="flex items-center gap-10 relative z-10">
               <div className="w-18 h-18 bg-amber-500/10 border border-amber-500/20 rounded-[2.2rem] flex items-center justify-center animate-bounce shadow-2xl shadow-amber-500/20"><Award size={36} className="text-amber-400" /></div>
               <div>
                  <h2 className="font-black text-white italic uppercase tracking-tighter text-5xl leading-none">Peak Trajectories</h2>
                  <p className="text-[12px] text-slate-800 font-black uppercase tracking-[0.6em] italic mt-3 leading-none">Elite node performance and affinity matrix surveillance</p>
               </div>
            </div>
            <div className="px-12 py-5 rounded-[2.5rem] bg-black/40 border border-white/5 text-[13px] font-black uppercase tracking-[0.5em] text-slate-800 italic relative z-10">
               HEURISTIC_OUTPUT_LEDGER_ALPHA
            </div>
          </div>
          
          <div className="divide-y divide-white/[0.03] bg-black/20">
            {data.top_performing_posts.map((post, idx) => (
              <motion.div 
                whileHover={{ x: 30, backgroundColor: 'rgba(255,255,255,0.04)' }}
                key={post.id} 
                className="flex flex-col xl:flex-row items-center gap-16 px-20 py-14 transition-all duration-700 group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-16 opacity-[0.01] group-hover:opacity-[0.05] transition-opacity duration-1000"><Boxes size={300} /></div>
                <div className={`w-24 h-24 rounded-[3rem] flex items-center justify-center flex-shrink-0 text-white font-black text-5xl shadow-2xl relative z-10 transition-all duration-1000 group-hover:-rotate-12 border border-white/20 ${
                  idx === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-700 shadow-amber-500/40 scale-110'
                  : 'bg-white/[0.03] border-white/10 text-slate-800 group-hover:text-white'}`}>
                  #{idx + 1}
                </div>
                <div className="flex-1 min-w-0 relative z-10">
                  <p className="text-[42px] font-black text-white italic uppercase tracking-tighter truncate group-hover:text-indigo-400 transition-all duration-1000 leading-none mb-6">{post.title?.toUpperCase() || 'UNNAMED_PHANTOM_NODE'}</p>
                  <div className="flex items-center gap-12">
                     <p className="text-[13px] text-slate-800 font-black uppercase tracking-[0.4em] italic flex items-center gap-5">
                        <Clock size={20} className="text-slate-950" /> {new Date(post.published_at).toLocaleDateString().toUpperCase()}
                     </p>
                     <div className="h-2 w-2 rounded-full bg-slate-950" />
                     <p className="text-[13px] text-indigo-500/40 font-black uppercase tracking-[0.4em] italic bg-indigo-500/5 px-6 py-2 rounded-full border border-indigo-500/10 shadow-2xl">PROTOCOL_PAYLOAD_SECURED</p>
                  </div>
                </div>
                <div className="flex items-center gap-24 flex-shrink-0 relative z-10">
                   <div className="text-center group/stat">
                      <p className="text-[12px] font-black text-slate-900 uppercase tracking-widest mb-4 italic group-hover/stat:text-indigo-400 transition-colors">Saturation</p>
                      <p className="text-6xl font-black text-white italic tracking-tighter tabular-nums leading-none drop-shadow-2xl">{fmt(post.total_views)}</p>
                   </div>
                   <div className="text-center group/stat">
                      <p className="text-[12px] font-black text-slate-900 uppercase tracking-widest mb-4 italic group-hover/stat:text-emerald-400 transition-colors">Resonance</p>
                      <p className="text-6xl font-black text-emerald-400 italic tracking-tighter tabular-nums leading-none drop-shadow-2xl">{fmt(post.total_engagement)}</p>
                   </div>
                   <div className="text-center group/stat">
                      <p className="text-[12px] font-black text-slate-900 uppercase tracking-widest mb-4 italic group-hover/stat:text-purple-400 transition-colors">Affinity</p>
                      <p className="text-6xl font-black text-purple-400 italic tracking-tighter tabular-nums leading-none drop-shadow-2xl">{post.avg_engagement_rate}</p>
                   </div>
                </div>
                <button 
                  onClick={() => router.push(`/dashboard/analytics/posts/${post.id}`)}
                  className="xl:opacity-0 group-hover:opacity-100 flex items-center gap-8 px-16 py-8 bg-white text-black rounded-[3rem] text-[16px] font-black uppercase tracking-[0.5em] hover:bg-indigo-500 hover:text-white transition-all duration-700 shadow-[0_40px_100px_rgba(255,255,255,0.1)] italic relative z-10 shrink-0 active:scale-95"
                >
                  DEEP_HEURISTICS <ArrowUpRight size={24} />
                </button>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Intelligence Uplink Array ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-16 relative z-10">
          {[
            { label: 'Spectral Log', desc: 'Cross-platform node historical records and terminal archives.', icon: Globe, href: '/dashboard/posts', gradient: 'from-blue-500/10 to-transparent', color: 'text-indigo-400' },
            { label: 'Flux Forecasting', desc: 'Deep resonance trajectory modeling and predictive analysis cluster.', icon: LineChart, href: '/dashboard/analytics/performance', gradient: 'from-emerald-500/10 to-transparent', color: 'text-emerald-400' },
            { label: 'Heuristic Node', desc: 'AI-infused content optimization logic and pattern recognition.', icon: Zap, href: '/dashboard/insights', gradient: 'from-violet-500/10 to-transparent', color: 'text-purple-400' },
          ].map((a, i) => (
            <motion.button 
              whileHover={{ y: -20, backgroundColor: 'rgba(255,255,255,0.06)' }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 + i * 0.1, duration: 1 }}
              key={a.label} 
              onClick={() => router.push(a.href)}
              className={`${glassStyle} group flex flex-col gap-12 p-20 rounded-[6rem] transition-all duration-1000 text-left relative overflow-hidden border-white/5 hover:border-indigo-500/50 shadow-[0_60px_120px_rgba(0,0,0,0.5)]`}
            >
              <div className="absolute top-0 right-0 p-16 opacity-0 group-hover:opacity-[0.05] transition-opacity duration-1000"><Network size={180} className="text-white" /></div>
              <div className={`w-24 h-24 rounded-[3rem] flex items-center justify-center bg-white/[0.02] border border-white/10 flex-shrink-0 group-hover:scale-110 group-hover:rotate-12 transition-all duration-1000 bg-gradient-to-br ${a.gradient} shadow-2xl`}>
                <a.icon size={44} className={a.color} />
              </div>
              <div className="space-y-6">
                <p className="text-5xl font-black text-white uppercase italic tracking-tighter leading-none">{a.label}</p>
                <p className="text-[14px] text-slate-800 font-black uppercase tracking-[0.4em] italic leading-relaxed">{a.desc}</p>
              </div>
              <div className="flex items-center gap-8 text-[16px] font-black text-indigo-400 uppercase tracking-[0.6em] mt-auto group-hover:gap-10 transition-all duration-700 italic border-t border-white/5 pt-12">
                 INITIATE_UPLINK <ArrowRight size={28} />
              </div>
            </motion.button>
          ))}
        </div>
        
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { font-family: 'Inter', sans-serif; background: #020205; color: white; overflow-x: hidden; }
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); }
          ::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.2); border-radius: 10px; }
          ::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.4); }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}
