'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp, Eye, Heart, Share2, Zap, Target, Award,
  ChevronRight, Clock, Play, RefreshCw, Flame,
  ArrowUp, ArrowDown, Minus, Brain, Sparkles, Video,
  Calendar, BarChart3, Lightbulb, AlertTriangle, CheckCircle2,
  MessageSquare, Users, TrendingDown, Activity, ArrowRight, Shield, Radio, Cpu,
  Monitor, Network, Fingerprint, Terminal, Boxes, Lock, X, Globe, ActivitySquare
} from 'lucide-react'
import { ErrorBoundary } from '../../../../components/ErrorBoundary'
import ToastContainer from '../../../../components/ToastContainer'

// ── Types ─────────────────────────────────────────────────────────────────────
interface VideoStat {
  id: string; title: string; platform: 'tiktok' | 'instagram' | 'youtube' | 'other';
  views: number; likes: number; shares: number; comments: number; completionRate: number;
  hookDropOff: number; editStyle: string; filterUsed?: string; hookType: string;
  publishedAt: string; viralScore: number; trend: 'up' | 'down' | 'flat';
  engagementRate: number;
}

const PLATFORM_COLORS: Record<string, string> = {
  tiktok: 'from-slate-800 to-black', instagram: 'from-pink-500 to-purple-600', youtube: 'from-red-600 to-red-900', other: 'from-slate-600 to-slate-900'
}

const PLATFORM_ICON: Record<string, string> = {
  tiktok: '♪', instagram: '◈', youtube: '▶', other: '○'
}

const CONTENT_DNA = [
  { trait: 'Neural Hook Strength',    score: 88 },
  { trait: 'Kinetic Rhythm',    score: 76 },
  { trait: 'Inference Precision',      score: 62 },
  { trait: 'Sonic Saturation',      score: 91 },
  { trait: 'Trend Divergence',  score: 84 },
  { trait: 'Signal Retention',   score: 73 },
]

const FORECAST_SLOTS = [
  { day: 'MON_CYCLE', time: '22:00', platform: 'tiktok',    score: 94, hot: true  },
  { day: 'WED_CYCLE', time: '19:00',  platform: 'instagram', score: 82, hot: false },
  { day: 'THU_CYCLE', time: '20:00',  platform: 'tiktok',    score: 91, hot: true  },
  { day: 'SAT_CYCLE', time: '09:00',  platform: 'youtube',   score: 76, hot: false },
]

// ── Utils ──────────────────────────────────────────────────────────────────────
const fmt = (n: number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n/1000).toFixed(0)}K` : n.toString()
const glassStyle = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl transition-all duration-500'
const scoreColor = (s: number) => s >= 85 ? 'text-emerald-400' : s >= 65 ? 'text-amber-400' : 'text-rose-400'
const scoreBorder = (s: number) => s >= 85 ? 'border-emerald-500/30' : s >= 65 ? 'border-amber-500/30' : 'border-rose-500/30'
const scoreBg = (s: number) => s >= 85 ? 'bg-emerald-500/10' : s >= 65 ? 'bg-amber-500/10' : 'bg-rose-500/10'

import { apiGet, apiPost } from '../../../../lib/api'
import SpectralLoader from '../../../../components/SpectralLoader'

export default function HeuristicMatrixPage() {
  const [videos, setVideos] = useState<VideoStat[]>([])
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'views' | 'viralScore' | 'completionRate' | 'engagementRate'>('views')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState<VideoStat | null>(null)
  const [insightTab, setInsightTab] = useState<'ai' | 'hooks' | 'forecast'>('ai')

  const fetchStats = async () => {
    setRefreshing(true)
    try {
      const res = await apiGet('/analytics/creator/stats')
      const list: VideoStat[] = res.stats || []
      setVideos(list)
      // Auto-ingest each unique post into the editor's learning brain. We
      // mark seen ids in localStorage so we don't double-count when the
      // analytics page re-renders. The endpoint itself is idempotent on
      // dev users; in prod it weighted-averages so re-ingestion would
      // gradually re-weight rather than corrupt.
      try {
        const seenKey = 'click.style-profile.ingested'
        const seen = new Set<string>(JSON.parse(localStorage.getItem(seenKey) || '[]'))
        const fresh = list.filter(v => v?.id && !seen.has(v.id))
        if (fresh.length) {
          await Promise.allSettled(fresh.map(v => apiPost('/style-profile/ingest-post', {
            contentId: v.id,
            metrics: {
              completionRate: (v.completionRate ?? 55) / 100,
              retentionRate:  (v.completionRate ?? 55) / 100,
              viewCount: v.views,
              likes: v.likes,
              shares: v.shares,
              comments: v.comments,
              benchmarkRetention: 0.55,
            },
          })))
          fresh.forEach(v => seen.add(v.id))
          localStorage.setItem(seenKey, JSON.stringify(Array.from(seen).slice(-200)))
        }
      } catch { /* ingestion is best-effort — analytics view still renders */ }
    } catch (err) {
      console.error('Failed to fetch creator stats', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchStats() }, [])

  const filtered = useMemo(() =>
    videos
      .filter(v => selectedPlatform === 'all' || v.platform === selectedPlatform)
      .sort((a, b) => b[sortBy] - a[sortBy]),
    [videos, selectedPlatform, sortBy]
  )

  const totals = useMemo(() => {
    // Guard against empty arrays — divisions would otherwise produce NaN and
    // React's "Received NaN for the children attribute" warning fires for
    // every renderer that displays these values.
    const n = videos.length || 1
    const empty = videos.length === 0
    return {
      views: videos.reduce((s, v) => s + v.views, 0),
      likes: videos.reduce((s, v) => s + v.likes, 0),
      shares: videos.reduce((s, v) => s + v.shares, 0),
      comments: videos.reduce((s, v) => s + v.comments, 0),
      avgCompletion: empty ? 0 : Math.round(videos.reduce((s, v) => s + v.completionRate, 0) / n),
      avgViralScore: empty ? 0 : Math.round(videos.reduce((s, v) => s + v.viralScore, 0) / n),
      avgEngagement: empty ? 0 : parseFloat((videos.reduce((s, v) => s + v.engagementRate, 0) / n).toFixed(1)),
    }
  }, [videos])

  const styleAttribution = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {}
    videos.forEach(v => {
      if (!map[v.editStyle]) map[v.editStyle] = { total: 0, count: 0 }
      map[v.editStyle].total += v.completionRate
      map[v.editStyle].count += 1
    })
    return Object.entries(map)
      .map(([style, { total, count }]) => ({ style, avg: Math.round(total / count) }))
      .sort((a, b) => b.avg - a.avg)
  }, [videos])

  const bestEditStyle = styleAttribution[0]?.style || '—'

  const aiSummary = useMemo(() => {
    const worstVideo = [...videos].sort((a, b) => a.hookDropOff - b.hookDropOff).reverse()[0]
    const bestVideo = [...videos].sort((a, b) => b.viralScore - a.viralScore)[0]
    return {
      headline: `Your ${bestVideo?.hookType.toUpperCase()} nodes are refracting 2.3× more signal resonance.`,
      action: `Terminate hook diffraction on "${worstVideo?.title.substring(0, 35)}…" — ${worstVideo?.hookDropOff}% signal loss detected.`,
      opportunity: `Deploy 2 additional "${bestEditStyle.toUpperCase()}" nodes to pulse +${Math.round(totals.views * 0.18 / 1000)}K spectral views.`,
    }
  }, [videos, bestEditStyle, totals.views])

  if (loading) return <SpectralLoader message="Unplinking Operational Nodes..." />

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-10 pt-16 max-w-[1750px] mx-auto space-y-24">
        <ToastContainer />
        <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
           <Fingerprint size={800} className="text-white absolute -bottom-40 -left-40 rotate-12" />
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
                      <span className="text-[12px] font-black uppercase tracking-[0.6em] text-indigo-400 italic leading-none">Heuristic Logic v9.2.0</span>
                   </div>
                   <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-black/40 border border-white/5 shadow-inner">
                       <ActivitySquare size={12} className="text-indigo-400 animate-pulse" />
                       <span className="text-[9px] font-black text-slate-400 tracking-widest uppercase italic leading-none">NODE_DIAGNOSTIC_READY</span>
                   </div>
                 </div>
                 <h1 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none mb-2">Heuristic Matrix</h1>
                 <p className="text-slate-400 text-[14px] uppercase font-black tracking-[0.4em] italic leading-none">Autonomous content DNA analysis and temporal resonance forecasting.</p>
              </div>
           </div>

           <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center p-2 rounded-[2.5rem] bg-black/40 border border-white/10 shadow-inner">
                {['all', 'tiktok', 'instagram', 'youtube'].map(p => (
                  <button key={p} onClick={() => setSelectedPlatform(p)}
                    className={`px-8 py-3 rounded-[2rem] text-[12px] font-black uppercase tracking-widest italic transition-all duration-700 ${
                      selectedPlatform === p ? 'bg-white text-black shadow-2xl scale-105' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {p === 'all' ? 'CLUSTER' : p.toUpperCase()}
                  </button>
                ))}
              </div>
              <button 
                onClick={fetchStats}
                disabled={refreshing}
                title="Refresh Operational Nodes"
                aria-label="Refresh Matrix Stats"
                className="p-6 rounded-[2.5rem] bg-white text-black hover:bg-indigo-500 hover:text-white transition-all shadow-2xl active:scale-95 flex items-center justify-center"
              >
                <RefreshCw size={24} className={refreshing ? 'animate-spin' : ''} />
              </button>
           </div>
        </header>

        {/* Neural Potency & Heuristic Inference HUD */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          className={`${glassStyle} p-20 rounded-[6rem] relative overflow-hidden bg-gradient-to-br from-indigo-500/5 via-transparent to-rose-500/5 border-white/5 shadow-[0_60px_150px_rgba(0,0,0,0.6)]`}
        >
          <div className="absolute right-0 top-0 w-[500px] h-[500px] bg-indigo-600/10 blur-[150px] rounded-full pointer-events-none" />
          <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] gap-24 items-center relative z-10">

            {/* Neural Potency Ring */}
            <div className="flex flex-col items-center gap-8">
              <div className={`w-56 h-56 rounded-full border-[12px] ${scoreBorder(totals.avgViralScore)} flex flex-col items-center justify-center ${scoreBg(totals.avgViralScore)} shadow-[inset_0_0_80px_rgba(0,0,0,0.8)] relative group`}>
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <span className={`text-6xl font-black italic tracking-tighter ${scoreColor(totals.avgViralScore)} tabular-nums leading-none`}>{totals.avgViralScore}</span>
                <span className="text-[12px] font-black text-slate-400 uppercase tracking-[0.5em] mt-2">POTENCY</span>
              </div>
              <div className="px-6 py-2 rounded-full bg-black/40 border border-white/5">
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] italic leading-none">Neural Affinity Master</span>
              </div>
            </div>

            {/* Heuristic Inference Data */}
            <div className="space-y-12">
              <div className="flex items-center gap-6">
                <Sparkles className="text-indigo-400 animate-pulse" size={24} />
                <span className="text-[12px] font-black text-indigo-400 uppercase tracking-[0.6em] italic">Automatic Engine Synthesis</span>
              </div>
              <h2 className="text-6xl font-black italic text-white leading-[1.1] uppercase tracking-tighter max-w-3xl">
                &ldquo;{aiSummary.headline}&rdquo;
              </h2>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                <div className="flex items-start gap-8 p-10 rounded-[4rem] bg-rose-500/5 border border-rose-500/20 shadow-2xl group transition-all duration-700 hover:bg-rose-500/10">
                  <div className="w-16 h-16 rounded-[2rem] bg-rose-500/10 flex items-center justify-center shrink-0 border border-rose-500/20 shadow-inner group-hover:rotate-12 transition-all">
                    <AlertTriangle size={32} className="text-rose-400" />
                  </div>
                  <div className="space-y-2">
                    <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest italic">PROTOCOL_TERMINATION:</div>
                    <p className="text-[16px] text-white font-black leading-relaxed uppercase tracking-tight italic opacity-80 group-hover:opacity-100 transition-opacity">{aiSummary.action}</p>
                  </div>
                </div>
                <div className="flex items-start gap-8 p-10 rounded-[4rem] bg-emerald-500/5 border border-emerald-500/20 shadow-2xl group transition-all duration-700 hover:bg-emerald-500/10">
                  <div className="w-16 h-16 rounded-[2rem] bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20 shadow-inner group-hover:rotate-[-12deg] transition-all">
                    <Lightbulb size={32} className="text-emerald-400" />
                  </div>
                  <div className="space-y-2">
                    <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest italic">HEURISTIC_EXPANSION:</div>
                    <p className="text-[16px] text-white font-black leading-relaxed uppercase tracking-tight italic opacity-80 group-hover:opacity-100 transition-opacity">{aiSummary.opportunity}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Logic Snapshots */}
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-6 min-w-[240px]">
              {[
                { label: 'Spectral Sync', value: `${totals.avgCompletion}%`, color: 'text-amber-400', icon: ActivitySquare },
                { label: 'Signal Gain', value: `${totals.avgEngagement}%`, color: 'text-rose-400', icon: Zap },
                { label: 'Peak Logic', value: 'PATTERN_INT', color: 'text-indigo-400', icon: Target },
                { label: 'Best Topology', value: bestEditStyle.split(' ')[0], color: 'text-emerald-400', icon: Cpu },
              ].map(k => (
                <div key={k.label} className="bg-black/40 rounded-[2.5rem] p-6 border border-white/5 flex items-center justify-between group hover:bg-white/5 transition-all shadow-inner border-l-4 border-l-white/10 hover:border-l-indigo-500">
                  <k.icon size={24} className={`${k.color} opacity-60 group-hover:scale-110 transition-transform`} />
                  <div className="text-right">
                    <div className={`text-2xl font-black italic uppercase ${k.color} tracking-tighter leading-none`}>{k.value}</div>
                    <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-1 italic">{k.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Global Resonance Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-10">
          {[
            { label: 'Spectral Views', value: fmt(totals.views), icon: Eye, color: 'text-indigo-400' },
            { label: 'Affinity Likes', value: fmt(totals.likes), icon: Heart, color: 'text-rose-400' },
            { label: 'Signal Shares', value: fmt(totals.shares), icon: Share2, color: 'text-emerald-400' },
            { label: 'Resonance Comms', value: fmt(totals.comments), icon: MessageSquare, color: 'text-amber-400' },
            { label: 'Logic Sync', value: `${totals.avgCompletion}%`, icon: Play, color: 'text-violet-400' },
          ].map(({ label, value, icon: Icon, color }, i) => (
            <motion.div key={label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}
              whileHover={{ y: -10, backgroundColor: 'rgba(255,255,255,0.06)' }}
              className={`${glassStyle} rounded-[4rem] p-12 flex flex-col items-center text-center group cursor-default border-white/5`}
            >
              <div className={`w-14 h-14 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center mb-6 group-hover:rotate-12 transition-transform shadow-2xl shadow-black/80`}>
                <Icon size={24} className={color} />
              </div>
              <div className={`text-5xl font-black italic tracking-tighter tabular-nums leading-none mb-3 ${color} drop-shadow-2xl`}>{value}</div>
              <div className="text-[12px] font-black uppercase tracking-[0.3em] text-slate-400 italic">{label}</div>
            </motion.div>
          ))}
        </div>

        {/* Operational Node Repository & Heuristic Auditor */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_500px] gap-16">

          {/* Operational Clusters */}
          <div className={`${glassStyle} rounded-[6rem] overflow-hidden flex flex-col bg-black/40 border-white/5 shadow-[inset_0_0_100px_rgba(0,0,0,0.6)] relative`}>
             <div className="absolute top-0 right-0 p-32 opacity-[0.01] pointer-events-none"><Monitor size={500} /></div>
             <div className="flex flex-col md:flex-row items-center justify-between px-16 py-12 border-b border-white/5 bg-white/[0.01] gap-8 relative z-10">
                <div className="flex items-center gap-8 text-white">
                   <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20"><Boxes size={32} className="text-indigo-400" /></div>
                   <div>
                      <h3 className="text-4xl font-black italic uppercase tracking-tighter leading-none mb-1">Operational Nodes</h3>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.4em] italic leading-none">Cluster repository of manifested content nodes.</p>
                   </div>
                </div>
                <div className="flex gap-3 bg-black/60 p-2 rounded-[2.5rem] border border-white/5">
                  {(['views', 'viralScore', 'completionRate', 'engagementRate'] as const).map(s => (
                    <button key={s} onClick={() => setSortBy(s)}
                      className={`px-6 py-3 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all duration-700 ${sortBy === s ? 'bg-white text-black shadow-2xl scale-105' : 'text-slate-700 hover:text-white'}`}
                    >
                      {s === 'views' ? 'VE' : s === 'viralScore' ? 'POTENCY' : s === 'completionRate' ? 'SYNC' : 'SIGNAL'}
                    </button>
                  ))}
                </div>
             </div>

             <div className="divide-y divide-white/[0.02] max-h-[1000px] overflow-y-auto no-scrollbar relative z-10">
               {filtered.map((video, idx) => (
                 <motion.div key={video.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                   onClick={() => setSelectedVideo(video === selectedVideo ? null : video)}
                   className={`flex items-center gap-10 px-16 py-10 cursor-pointer group transition-all duration-700 relative ${selectedVideo?.id === video.id ? 'bg-indigo-500/10 border-l-[12px] border-l-indigo-500' : 'hover:bg-white/[0.03] border-l-[12px] border-l-transparent'}`}
                 >
                   <div className="text-[16px] font-black text-slate-500 w-8 tabular-nums italic">{String(idx + 1).padStart(2, '0')}</div>

                   <div className={`w-16 h-16 rounded-[2rem] bg-gradient-to-br ${PLATFORM_COLORS[video.platform]} flex items-center justify-center text-white text-3xl shrink-0 shadow-[0_20px_40px_rgba(0,0,0,0.5)] group-hover:rotate-12 transition-transform duration-300 border border-white/10`}>
                     {PLATFORM_ICON[video.platform]}
                   </div>

                   <div className="flex-1 min-w-0">
                     <p className="text-3xl font-black text-white truncate uppercase italic tracking-tighter group-hover:text-indigo-400 transition-colors duration-700">{video.title}</p>
                     <div className="flex items-center gap-6 mt-3 text-[12px] font-black text-slate-400 uppercase tracking-widest italic leading-none">
                        <div className="flex items-center gap-2"><Cpu size={14} /> <span>{video.editStyle} SUBSTRATE</span></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />
                        <div className="flex items-center gap-2"><Target size={14} /> <span>{video.hookType.replace(/-/g, '_')} SIGNAL</span></div>
                     </div>
                   </div>

                   <div className="flex items-center gap-12 shrink-0">
                     <div className="text-right hidden sm:block">
                       <div className="text-4xl font-black text-white italic tracking-tighter tabular-nums leading-none">{fmt(video.views)}</div>
                       <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">VE_SATURATION</div>
                     </div>
                     <div className={`w-16 h-16 rounded-[2rem] flex items-center justify-center text-2xl font-black border-2 shrink-0 shadow-[0_20px_40px_rgba(0,0,0,0.4)] ${scoreBorder(video.viralScore)} ${scoreColor(video.viralScore)} ${scoreBg(video.viralScore)}`}>
                       {video.viralScore}
                     </div>
                     <div className="flex flex-col items-center gap-1">
                        {video.trend === 'up'   && <ArrowUp   size={24} className="text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" />}
                        {video.trend === 'down' && <ArrowDown  size={24} className="text-rose-400 drop-shadow-[0_0_10px_rgba(225,29,72,0.5)]" />}
                        {video.trend === 'flat' && <Minus      size={24} className="text-slate-400" />}
                     </div>
                   </div>

                   {video.hookDropOff > 30 && (
                     <div className="px-6 py-2 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-black uppercase tracking-widest rounded-full ml-6 shrink-0 shadow-[0_0_30px_rgba(225,29,72,0.2)] animate-pulse">
                       ⚠ DIFFRACTION
                     </div>
                   )}
                 </motion.div>
               ))}
             </div>
          </div>

          {/* Right Pillar: Matrix Auditors */}
          <div className="space-y-12">
            <div className="flex gap-3 p-2 rounded-[3rem] bg-black/40 border border-white/10 shadow-inner">
              {(['ai', 'hooks', 'forecast'] as const).map(t => (
                <button key={t} onClick={() => setInsightTab(t)}
                  className={`flex-1 py-5 rounded-[2.5rem] text-[12px] font-black uppercase tracking-[0.4em] italic transition-all duration-700 ${insightTab === t ? 'bg-white text-black shadow-2xl scale-105' : 'text-slate-400 hover:text-white'}`}
                >
                  {t === 'ai' ? 'NEURAL' : t === 'hooks' ? 'PULSE' : 'CYCLE'}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {insightTab === 'ai' && (
                <motion.div key="ai" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
                  className={`${glassStyle} rounded-[6rem] p-16 space-y-12 border-white/5 shadow-[0_60px_150px_rgba(0,0,0,0.6)] relative overflow-hidden`}
                >
                  <div className="absolute top-0 right-0 p-16 opacity-[0.02] pointer-events-none border-none"><Terminal size={300} /></div>
                  <div className="flex items-center gap-6 relative z-10">
                    <Brain className="text-indigo-400" size={32} />
                    <h4 className="text-3xl font-black uppercase tracking-tighter text-white italic leading-none">Genetic Content DNA</h4>
                  </div>
                  <div className="space-y-10 relative z-10">
                    {CONTENT_DNA.map(({ trait, score }, i) => (
                      <div key={trait}>
                        <div className="flex items-center justify-between mb-3 border-l-2 border-indigo-500/20 pl-4">
                          <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest italic">{trait}</span>
                          <span className={`text-[16px] font-black italic tabular-nums ${scoreColor(score)}`}>{score}_POTENCY</span>
                        </div>
                        <div className="h-3 bg-black/40 rounded-full overflow-hidden shadow-inner border border-white/5">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ delay: i * 0.1, duration: 1 }}
                            className={`h-full rounded-full bg-gradient-to-r from-indigo-600 to-indigo-400 shadow-[0_0_20px_rgba(79,70,229,0.4)]`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-12 border-t border-white/5 space-y-8 relative z-10">
                    <div className="flex items-center gap-4">
                       <Target className="text-indigo-400" size={24} />
                       <span className="text-[12px] font-black uppercase text-slate-400 italic tracking-[0.4em]">Substrate Sync Velocity</span>
                    </div>
                    {styleAttribution.map(({ style, avg }, i) => (
                      <div key={style} className="flex items-center gap-6 group">
                        <span className="text-[11px] font-bold text-white w-32 truncate uppercase italic tracking-tighter opacity-60 group-hover:opacity-100 transition-opacity">{style}</span>
                        <div className="flex-1 h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${avg}%` }} transition={{ delay: i * 0.1, duration: 1 }}
                            className="h-full bg-indigo-500/40 rounded-full shadow-[0_0_10px_rgba(79,70,229,0.2)]"
                          />
                        </div>
                        <span className="text-[12px] font-black text-indigo-400 tabular-nums italic">{avg}%</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {insightTab === 'hooks' && (
                <motion.div key="hooks" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
                  className={`${glassStyle} rounded-[6rem] p-16 space-y-10 border-white/5 shadow-[0_60px_150px_rgba(0,0,0,0.6)] relative overflow-hidden`}
                >
                  <div className="absolute top-0 right-0 p-16 opacity-[0.02] pointer-events-none"><Fingerprint size={300} /></div>
                  <div className="flex items-center gap-6 relative z-10">
                    <Flame className="text-rose-400 animate-pulse" size={32} />
                    <h4 className="text-3xl font-black uppercase tracking-tighter text-white italic leading-none">Signal Pulse Auditor</h4>
                  </div>
                  <div className="space-y-6 relative z-10">
                    {[
                      { type: 'pattern_interrupt', score: 97, label: 'Optimal Resonance', emoji: '🎯' },
                      { type: 'question',          score: 84, label: 'High Induction',       emoji: '❓' },
                      { type: 'curiosity_gap',     score: 81, label: 'Signal Trap',           emoji: '🧲' },
                      { type: 'stat',              score: 72, label: 'Logical Anchor',        emoji: '📊' },
                      { type: 'story',             score: 58, label: 'Slow Induction',     emoji: '📖' },
                    ].map(({ type, score, label, emoji }) => (
                      <div key={type} className={`flex items-center justify-between p-8 rounded-[3rem] border shadow-2xl transition-all duration-700 hover:scale-105 ${scoreBg(score)} ${scoreBorder(score)} bg-gradient-to-br from-white/[0.05] to-transparent`}>
                        <div className="flex items-center gap-6">
                          <span className="text-4xl opacity-40 grayscale">{emoji}</span>
                          <div>
                            <div className="text-[16px] font-black text-white uppercase tracking-tighter italic">{type}</div>
                            <div className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1 italic">{label}</div>
                          </div>
                        </div>
                        <div className={`text-4xl font-black italic ${scoreColor(score)} tabular-nums drop-shadow-2xl`}>{score}</div>
                      </div>
                    ))}
                  </div>
                  <div className="p-10 rounded-[3rem] bg-indigo-500/10 border border-indigo-500/20 shadow-2xl relative z-10 pointer-events-none">
                    <p className="text-[14px] text-indigo-300 font-black leading-relaxed uppercase italic tracking-tight">
                       &ldquo;Pattern-interrupt nodes drive 2.3× more sync velocity. Prioritize kinetic visual cues in frame-nodes 0-2 of any operational payload.&rdquo;
                    </p>
                  </div>
                </motion.div>
              )}

              {insightTab === 'forecast' && (
                <motion.div key="forecast" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
                  className={`${glassStyle} rounded-[6rem] p-16 space-y-10 border-white/5 shadow-[0_60px_150px_rgba(0,0,0,0.6)] relative overflow-hidden`}
                >
                  <div className="absolute top-0 right-0 p-16 opacity-[0.02] pointer-events-none"><Globe size={300} /></div>
                  <div className="flex items-center gap-6 relative z-10">
                    <Calendar className="text-emerald-400" size={32} />
                    <h4 className="text-3xl font-black uppercase tracking-tighter text-white italic leading-none">Temporal Matrix Projections</h4>
                  </div>
                  <div className="space-y-6 relative z-10">
                    {FORECAST_SLOTS.map(slot => (
                      <div key={`${slot.day}-${slot.time}`}
                        className={`flex items-center gap-10 p-8 rounded-[3.5rem] border transition-all duration-300 group ${slot.hot ? 'bg-indigo-500/10 border-indigo-500/30 shadow-[0_30px_60px_rgba(79,70,229,0.2)]' : 'bg-black/40 border-white/5 shadow-inner'}`}
                      >
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-2xl transition-all duration-300 group-hover:rotate-12 ${slot.hot ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-400'}`}>
                           {slot.hot ? <ActivitySquare size={24} /> : <Clock size={24} />}
                        </div>
                        <div className="flex-1">
                          <div className="text-[18px] font-black text-white italic uppercase tracking-tighter leading-none mb-1">{slot.day} · {slot.time}</div>
                          <div className={`text-[11px] font-black uppercase tracking-[0.4em] italic text-slate-400`}>
                             NODE_{slot.platform.toUpperCase()}_SLOT
                          </div>
                        </div>
                        <div className={`text-5xl font-black italic tracking-tighter tabular-nums ${scoreColor(slot.score)} drop-shadow-2xl`}>{slot.score}</div>
                      </div>
                    ))}
                  </div>
                  <button className="w-full py-8 rounded-[3.5rem] bg-white text-black text-[14px] font-black uppercase tracking-[0.4em] italic hover:bg-emerald-500 hover:text-white transition-all duration-300 border-none shadow-[0_50px_100px_rgba(255,255,255,0.1)] active:scale-95 flex items-center justify-center gap-6 group">
                    Sync Temporal Nodes <ArrowRight size={24} className="group-hover:translate-x-4 transition-transform duration-700" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Selected Node Deep Diagnostic */}
            <AnimatePresence>
              {selectedVideo && (
                <motion.div initial={{ opacity: 0, scale: 0.9, y: 50 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 50 }}
                  className={`${glassStyle} rounded-[6rem] p-16 bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent border-indigo-500/30 shadow-[0_100px_200px_rgba(0,0,0,0.8)] relative overflow-hidden`}
                >
                  <div className="absolute top-0 right-0 p-16 opacity-[0.05] pointer-events-none"><Lock size={200} /></div>
                  <div className="flex items-center gap-6 mb-12">
                    <Target className="text-indigo-400" size={32} />
                    <span className="text-[14px] font-black uppercase tracking-[0.6em] text-indigo-400 italic">Node Spectrum Detail</span>
                  </div>
                  <h4 className="text-4xl font-black text-white mb-12 leading-none uppercase italic tracking-tighter drop-shadow-2xl">{selectedVideo.title}</h4>

                  <div className="grid grid-cols-2 gap-8 mb-12">
                    {[
                      { label: 'Signal Loss', value: `${selectedVideo.hookDropOff}%`, bad: selectedVideo.hookDropOff > 20, icon: TrendingDown },
                      { label: 'Sync Rate',    value: `${selectedVideo.completionRate}%`, good: selectedVideo.completionRate > 65, icon: Radio },
                      { label: 'Signal Affinity', value: `${selectedVideo.engagementRate}%`, good: selectedVideo.engagementRate > 8, icon: Network },
                      { label: 'Neural Potency',  value: `${selectedVideo.viralScore}`, good: selectedVideo.viralScore >= 75, icon: Fingerprint },
                    ].map(m => (
                      <div key={m.label} className={`rounded-[3.5rem] p-8 border-2 flex flex-col justify-between min-h-[160px] transition-all duration-700 shadow-2xl ${m.good ? 'bg-emerald-500/5 border-emerald-500/20' : m.bad ? 'bg-rose-500/5 border-rose-500/20' : 'bg-white/5 border-white/10'}`}>
                        <div className="flex items-center justify-between">
                           <div className="text-[10px] text-slate-400 font-black uppercase tracking-[0.4em] italic">{m.label}</div>
                           <m.icon size={20} className={m.good ? 'text-emerald-400' : m.bad ? 'text-rose-400' : 'text-slate-400'} />
                        </div>
                        <div className={`text-6xl font-black italic tracking-tighter tabular-nums leading-none ${(m.good || (!m.bad && !m.good)) ? 'text-white' : 'text-rose-500'} drop-shadow-2xl`}>{m.value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="p-10 rounded-[3rem] bg-black/60 border border-white/5 shadow-inner mb-12 border-l-8 border-l-indigo-500/40">
                     <p className="text-[14px] text-slate-400 font-black leading-relaxed uppercase italic tracking-wide">
                        Audit Result: Manifest kinetic visual spikes in frames 0-4 to counteract {selectedVideo.hookDropOff}% diffraction pulse. Logic injection recommended.
                     </p>
                  </div>

                  <button 
                    onClick={() => setSelectedVideo(null)}
                    className="w-full py-8 rounded-[3.5rem] bg-indigo-600 text-white text-[15px] font-black uppercase tracking-[0.4em] italic hover:bg-rose-600 transition-all duration-300 flex items-center justify-center gap-6 shadow-[0_40px_80px_rgba(79,70,229,0.3)] border-none active:scale-95"
                  >
                    DISMISS_DIAGNOSTIC <X size={24} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
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
