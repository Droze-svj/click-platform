'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../hooks/useAuth'
import { apiGet } from '../../lib/api'
import {
  Video, Sparkles, Send, Brain, RefreshCw,
  ArrowRight, Zap, Flame, FileText,
  Wifi, Globe, Settings,
  Shield, Cpu, Radio, Terminal, Monitor,
  Box, ActivitySquare, ActivityIcon, Fingerprint, Gauge, Signal, ShieldCheck,
  Sparkle, Command, Hammer, Plug
} from 'lucide-react'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import ToastContainer from '../../components/ToastContainer'
import SubscriptionBanner from '../../components/SubscriptionBanner'
import { useDebug } from '../../hooks/useDebug'
import { validateFile } from '../../utils/fileValidator'
import LiveActivityFeed from '../../components/LiveActivityFeed'
import { useTheme } from '../../components/ThemeProvider'

const glassStyle = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl transition-all duration-700'

const MISSION_ACTIONS = [
  { label: 'One-Click Forge', desc: 'Generate a full short-form pack',  icon: Hammer,   href: '/dashboard/forge',         badge: 'AI' },
  { label: 'Video Studio',    desc: 'Edit clips with AI-assist',        icon: Video,    href: '/dashboard/video',         badge: null },
  { label: 'Scripts',         desc: 'AI scripts for every platform',    icon: FileText, href: '/dashboard/scripts',       badge: 'AI' },
  { label: 'Scheduler',       desc: 'Plan posts across platforms',      icon: Send,     href: '/dashboard/scheduler',     badge: null },
  { label: 'Discover',        desc: 'Trending hooks, sounds, formats',  icon: Flame,    href: '/dashboard/trends',        badge: 'NEW' },
  { label: 'Integrations',    desc: 'Connect TikTok, IG, YT, X & more', icon: Plug,     href: '/dashboard/integrations',  badge: null },
]


interface NexusStat { label: string; value: string | number; icon: React.ElementType; color: string; bg: string; trend?: string }

function GlobalPayloadDropZone() {
  const [dragging, setDragging] = useState(false)
  
  useEffect(() => {
    const onDragOver = (e: DragEvent) => { e.preventDefault(); setDragging(true) }
    const onDragLeave = (e: DragEvent) => { if (!e.relatedTarget) setDragging(false) }
    const onDrop = async (e: DragEvent) => {
      e.preventDefault(); setDragging(false)
      const files = Array.from(e.dataTransfer?.files ?? [])
      if (!files.length) return
      const f = files[0]
      const result = await validateFile(f, { allowedTypes: ['video/', 'image/', 'audio/'], maxSizeMB: 500 })
      if (result.valid) window.location.href = '/dashboard/video'
    }
    document.addEventListener('dragover', onDragOver)
    document.addEventListener('dragleave', onDragLeave)
    document.addEventListener('drop', onDrop)
    return () => {
      document.removeEventListener('dragover', onDragOver)
      document.removeEventListener('dragleave', onDragLeave)
      document.removeEventListener('drop', onDrop)
    }
  }, [])

  return (
    <AnimatePresence>
      {dragging && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-indigo-500/20 backdrop-blur-3xl border-8 border-dashed border-indigo-500/40 flex items-center justify-center pointer-events-none"
        >
          <div className="text-center">
            <div className={`w-64 h-64 rounded-[5rem] ${glassStyle} flex items-center justify-center mx-auto mb-16 shadow-[0_0_200px_rgba(99,102,241,0.6)] bg-indigo-500/30 scale-110 border-indigo-500/50`}>
              <Box className="w-24 h-24 text-white animate-bounce" />
            </div>
            <p className="text-6xl font-black text-white tracking-tighter leading-none mb-8 drop-shadow-[0_0_40px_rgba(255,255,255,0.4)]">Drop to upload</p>
            <p className="text-[18px] text-indigo-400 font-bold uppercase tracking-[0.4em] animate-pulse">Release to process · video · audio · image</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function fmtCompact(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return n.toLocaleString()
}

const PLACEHOLDER_STATS: NexusStat[] = [
  { label: 'Posts',              value: '—', icon: Video,       color: 'text-rose-400',    bg: 'bg-rose-500/10',    trend: 'LOADING' },
  { label: 'Total Reach',        value: '—', icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10', trend: 'LOADING' },
  { label: 'Total Engagement',   value: '—', icon: Zap,        color: 'text-amber-400',   bg: 'bg-amber-500/10',   trend: 'LOADING' },
  { label: 'Connected Accounts', value: '—', icon: Signal,     color: 'text-indigo-400',  bg: 'bg-indigo-500/10',  trend: 'LOADING' },
]

interface RecentManifest { text: string; time: string; icon: any; color: string; bg: string }

export default function DashboardHomePage() {
  const { user } = useAuth() as any
  const [stats, setStats] = useState<NexusStat[]>(PLACEHOLDER_STATS)
  const [recentManifests, setRecentManifests] = useState<RecentManifest[]>([])
  const [apiStatus, setApiStatus] = useState<'ok' | 'down' | 'checking'>('checking')

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.name?.split(' ')[0] || 'Creator'

  useEffect(() => {
    fetch('/api/health').then(res => setApiStatus(res.ok ? 'ok' : 'down')).catch(() => setApiStatus('down'))
  }, [])

  const loadStats = useCallback(async () => {
    if (!user) return
    const [analyticsRes, integrationsRes] = await Promise.allSettled([
      apiGet<any>('/analytics/dashboard'),
      apiGet<any>('/integrations'),
    ])

    const analytics = analyticsRes.status === 'fulfilled' ? (analyticsRes.value?.data ?? analyticsRes.value) : null
    const integrationsBody = integrationsRes.status === 'fulfilled' ? (integrationsRes.value?.data ?? integrationsRes.value) : null
    const integrationCount = Array.isArray(integrationsBody?.integrations) ? integrationsBody.integrations.length
      : Array.isArray(integrationsBody) ? integrationsBody.length : 0

    const totalPosts     = analytics?.totalPosts      ?? null
    const publishedPosts = analytics?.publishedPosts  ?? null
    const totalViews     = analytics?.totalViews      ?? null
    const totalEng       = analytics?.totalEngagement ?? null
    const engRate        = totalViews && totalViews > 0 && totalEng != null
      ? `${((totalEng / totalViews) * 100).toFixed(1)}%`
      : '—'

    setStats([
      {
        label: 'Posts',
        value: totalPosts != null ? `${publishedPosts ?? 0}/${totalPosts}` : '—',
        icon: Video, color: 'text-rose-400', bg: 'bg-rose-500/10',
        trend: publishedPosts != null && totalPosts ? `${Math.round((publishedPosts / Math.max(totalPosts, 1)) * 100)}% Published` : 'No posts yet',
      },
      {
        label: 'Total Reach',
        value: fmtCompact(totalViews),
        icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10',
        trend: engRate === '—' ? 'No views yet' : `${engRate} engagement`,
      },
      {
        label: 'Total Engagement',
        value: fmtCompact(totalEng),
        icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/10',
        trend: totalEng != null ? 'Likes · shares · comments' : 'No engagement yet',
      },
      {
        label: 'Connected Accounts',
        value: integrationCount,
        icon: Signal, color: 'text-indigo-400', bg: 'bg-indigo-500/10',
        trend: integrationCount > 0 ? 'Active' : 'Connect a platform',
      },
    ])
  }, [user])

  const loadRecent = useCallback(async () => {
    if (!user) return
    const usage = user?.usage
    const built: RecentManifest[] = []
    if (usage) {
      if (usage.videosProcessed)  built.push({ text: `${fmtCompact(usage.videosProcessed)} Videos Processed`,  time: 'TOTAL', icon: Video,    color: 'text-rose-400',     bg: 'bg-rose-500/10' })
      if (usage.contentGenerated) built.push({ text: `${fmtCompact(usage.contentGenerated)} AI Generations`,    time: 'TOTAL', icon: Sparkles, color: 'text-indigo-400',   bg: 'bg-indigo-500/10' })
      if (usage.quotesCreated)    built.push({ text: `${fmtCompact(usage.quotesCreated)} Quote Cards`,          time: 'TOTAL', icon: FileText, color: 'text-amber-400',    bg: 'bg-amber-500/10' })
      if (usage.postsScheduled)   built.push({ text: `${fmtCompact(usage.postsScheduled)} Posts Scheduled`,     time: 'TOTAL', icon: Send,     color: 'text-emerald-400',  bg: 'bg-emerald-500/10' })
    }
    if (built.length < 4) {
      try {
        const a: any = await apiGet('/analytics/user?timeRange=30d')
        const b = a?.data ?? a
        const c = b?.content
        if (c) {
          if (built.length < 4 && c.created)   built.push({ text: `${c.created} Created (30d)`,     time: '30D', icon: Cpu,    color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10' })
          if (built.length < 4 && c.scheduled) built.push({ text: `${c.scheduled} Scheduled (30d)`, time: '30D', icon: Radio,  color: 'text-cyan-400',    bg: 'bg-cyan-500/10' })
          if (built.length < 4 && c.published) built.push({ text: `${c.published} Published (30d)`, time: '30D', icon: Globe,  color: 'text-emerald-400', bg: 'bg-emerald-500/10' })
        }
      } catch { /* analytics endpoint optional */ }
    }
    setRecentManifests(built)
  }, [user])

  useEffect(() => {
    loadStats().catch(() => {})
    loadRecent().catch(() => {})
  }, [loadStats, loadRecent])

  return (
    <ErrorBoundary>
      <GlobalPayloadDropZone />
      <SubscriptionBanner />
      <ToastContainer />

      <div className="min-h-screen relative z-10 pb-48 px-10 pt-16 max-w-[1850px] mx-auto space-y-24">
        {/* Persistent Background Layer (constrained to main column so it doesn't overlap sidebar) */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none overflow-hidden">
           <Shield size={1000} className="text-white absolute -top-40 -right-40 rotate-12 blur-[2px]" />
           <Command size={1200} className="text-white absolute -bottom-80 -left-60 rotate-[32deg] blur-[1px]" />
        </div>

        {/* Command Header Hub */}
        <header className="flex flex-col xl:flex-row items-center justify-between gap-12 relative z-[100]">
           <div className="flex items-center gap-12">
              <div className="w-24 h-24 bg-indigo-500/5 border-2 border-indigo-500/20 rounded-[3rem] flex items-center justify-center shadow-[0_40px_150px_rgba(99,102,241,0.3)] relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-100" />
                <Shield size={48} className="text-indigo-400 relative z-10 group-hover:scale-125 transition-transform duration-300 animate-pulse" />
              </div>
              <div>
                 <div className="flex items-center gap-8 mb-4">
                   <div className="flex items-center gap-4">
                      <Fingerprint size={16} className="text-indigo-400 animate-pulse" />
                      <span className="text-[12px] font-black uppercase tracking-[0.4em] text-indigo-400 leading-none">Click Dashboard</span>
                   </div>
                   <div className="flex items-center gap-4 px-6 py-2 rounded-full bg-black/60 border-2 border-white/5 shadow-inner">
                       <div className={`w-3 h-3 rounded-full ${apiStatus === 'ok' ? 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,1)]' : 'bg-rose-500 animate-pulse shadow-[0_0_20px_rgba(244,63,94,1)]'} `} />
                       <span className="text-[10px] font-black text-slate-400 tracking-[0.3em] uppercase leading-none">{apiStatus === 'ok' ? 'All systems operational' : 'API offline'}</span>
                   </div>
                 </div>
                 <h1 className="text-6xl font-black text-white tracking-tighter leading-none drop-shadow-[0_0_40px_rgba(255,255,255,0.2)]">
                   {greeting}, {firstName}
                 </h1>
                 <p className="text-slate-400 text-[14px] font-medium tracking-wide mt-4 leading-relaxed">Your content command center — generate scripts, edit videos, schedule posts, and grow your audience.</p>
              </div>
           </div>

           <div className="flex items-center gap-3">
              <Link href="/dashboard/settings" title="Settings" className="w-11 h-11 rounded-[1rem] bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-300 hover:text-white hover:border-white/30 transition-colors group">
                <Settings size={18} className="group-hover:rotate-90 transition-transform duration-300" />
              </Link>
              <Link href="/dashboard/notifications" title="Notifications" className="w-11 h-11 rounded-[1rem] bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-300 hover:text-white hover:border-white/30 transition-colors">
                <Monitor size={18} />
              </Link>
           </div>
        </header>

        {/* Dashboard overview */}
        <section className="relative z-10">
          <div className="space-y-24">
                {/* Neural Flux Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16">
                  {stats.map((s, idx) => (
                    <motion.div key={idx} whileHover={{ y: -15, scale: 1.02 }} className={`${glassStyle} p-16 rounded-[5.5rem] group bg-black/40 relative overflow-hidden flex flex-col items-center text-center hover:border-indigo-500/40 shadow-[0_60px_150px_rgba(0,0,0,0.8)] border-white/5`}>
                      <div className="absolute top-0 right-0 p-16 opacity-[0.03] group-hover:opacity-[0.1] transition-opacity duration-300 pointer-events-none group-hover:rotate-12 group-hover:scale-150"><s.icon size={250} /></div>
                      <div className="flex items-center justify-center mb-12 w-full">
                        <div className={`w-28 h-28 rounded-[3.5rem] ${s.bg} border-2 border-white/5 flex items-center justify-center shadow-2xl group-hover:rotate-12 transition-all duration-300 scale-110`}>
                          <s.icon className={`w-14 h-14 ${s.color} drop-shadow-[0_0_20px_rgba(0,0,0,0.5)]`} />
                        </div>
                      </div>
                      <p className="text-[14px] font-black text-slate-500 uppercase tracking-[0.8em] mb-6 italic leading-none opacity-60 group-hover:text-white transition-colors">{s.label}</p>
                      <h3 className="text-6xl font-black text-white italic tracking-tighter tabular-nums leading-none mb-10 drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)] group-hover:text-indigo-400 transition-colors duration-300">{s.value}</h3>
                      {s.trend && (
                        <div className="px-8 py-3 rounded-full bg-black/60 border-2 border-white/5 text-indigo-400 text-[11px] font-black uppercase tracking-[0.5em] italic flex items-center gap-4 shadow-inner group-hover:border-indigo-500/30 transition-all">
                          <ActivityIcon size={16} className="animate-pulse" /> {s.trend}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
                   {/* Main monitor */}
                   <div className="xl:col-span-2 space-y-10">
                      <div className={`${glassStyle} rounded-[2.5rem] p-8 overflow-hidden relative flex flex-col border-indigo-500/20 hover:border-indigo-500/40 shadow-lg bg-black/40`}>
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-6 relative z-50">
                          <div>
                            <div className="flex items-center gap-6 mb-4">
                               <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border-2 border-indigo-500/40 flex items-center justify-center shadow-2xl"><Fingerprint size={28} className="text-indigo-400 animate-pulse" /></div>
                               <h2 className="text-5xl font-black text-white tracking-tighter leading-none">Performance Monitor</h2>
                            </div>
                            <p className="text-[13px] font-medium text-slate-400 tracking-wide pl-16 border-l-4 border-indigo-500/20 ml-6">Live engagement signals across your connected accounts.</p>
                          </div>
                          <div className="flex items-center gap-10">
                             <div className="flex items-center gap-6 px-8 py-3 rounded-[2rem] bg-indigo-500/5 border-2 border-indigo-500/30 shadow-[0_0_60px_rgba(99,102,241,0.15)]">
                                <div className="w-3 h-3 rounded-full bg-indigo-500 animate-ping" />
                                <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-[0.3em]">Live · 98.2% uptime</span>
                             </div>
                             <button type="button" title="Refresh surveillance" aria-label="Refresh surveillance" onClick={() => { loadStats().catch(() => {}); loadRecent().catch(() => {}) }} className="w-20 h-20 rounded-[2.24rem] bg-white/[0.03] border-2 border-white/5 flex items-center justify-center text-slate-500 hover:text-white transition-all shadow-2xl hover:bg-black/80 hover:scale-110 active:scale-75 group/refresh"><RefreshCw size={36} className="group-hover/refresh:rotate-180 transition-transform duration-300" /></button>
                          </div>
                        </div>

                        <div className="flex-1 rounded-[2.5rem] bg-[#020205] border border-white/5 p-8 flex flex-col gap-6 hover:border-indigo-500/20 transition-colors">
                           <div className="flex items-start gap-5">
                              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                                <Brain size={22} className="text-indigo-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-2xl font-black text-white tracking-tight leading-tight mb-2">Trending opportunity</h3>
                                <p className="text-[13px] text-slate-400 leading-relaxed">Your niche shows a 92% retention spike on short-form vertical content this week. Spin up a clip with One-Click Forge to ride the wave.</p>
                              </div>
                           </div>
                           <Link href="/dashboard/forge" className="self-start px-7 py-3 bg-white text-black rounded-full text-[12px] font-bold uppercase tracking-[0.2em] hover:bg-indigo-500 hover:text-white transition-colors active:scale-95 inline-flex items-center gap-3">
                              <Zap size={14} /> Open One-Click Forge
                           </Link>

                           {/* Compact HUD bar */}
                           <div className="mt-2 flex items-center justify-between gap-4 px-4 py-3 rounded-2xl bg-black/40 border border-white/5">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <Gauge size={16} className="text-indigo-400 flex-shrink-0" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex-shrink-0">Pipeline · 84%</span>
                                <div className="flex-1 h-1.5 bg-black/80 rounded-full overflow-hidden ml-2">
                                  <motion.div initial={{ width: 0 }} animate={{ width: '84%' }} transition={{ duration: 1.5, ease: 'circOut' }} className="h-full bg-gradient-to-r from-indigo-700 to-indigo-400 rounded-full" />
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <Wifi size={14} className="text-emerald-400" />
                                <span className="text-[11px] font-bold text-emerald-400 tabular-nums">32 ms</span>
                              </div>
                           </div>
                        </div>
                      </div>
                   </div>

                   {/* Today's tip + recommended action */}
                   <div className="space-y-10">
                      <div className={`${glassStyle} rounded-[2.5rem] p-8 relative overflow-hidden border-white/5 group flex flex-col bg-black/60`}>
                         <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mb-5">
                            <Sparkle className="text-indigo-400" size={22} />
                         </div>
                         <h3 className="text-2xl font-black text-white tracking-tight mb-3 leading-tight border-l-4 border-indigo-500/40 pl-4">Today&apos;s tip</h3>
                         <p className="text-[14px] text-slate-300 leading-relaxed mb-6">
                           &quot;Pattern-interrupt hooks drive 3.2× more retention than polished intros. Lead with the surprise, not the setup.&quot;
                         </p>
                         <div className="p-5 rounded-2xl bg-[#020205] border border-white/5">
                            <div className="flex items-center gap-2.5 mb-2">
                               <Terminal size={14} className="text-indigo-400" />
                               <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em] leading-none">Recommended action</p>
                            </div>
                            <p className="text-[12px] text-slate-300 leading-relaxed">
                              Open <strong className="text-white">Scripts</strong> for a viral-hook template, or run <strong className="text-white">One-Click Forge</strong> to generate a full short-form pack.
                            </p>
                         </div>
                      </div>

                      {/* Quick actions */}
                      <div className="grid grid-cols-2 gap-4">
                         {MISSION_ACTIONS.slice(0, 4).map((act, i) => (
                           <Link key={i} href={act.href} className={`${glassStyle} group relative p-5 rounded-2xl bg-black/40 hover:bg-black/80 transition-colors overflow-hidden border-white/5 hover:border-indigo-500/40 flex flex-col gap-4`}>
                              <div className="flex justify-between items-start">
                                 <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-white/10 flex items-center justify-center group-hover:bg-indigo-500/20 group-hover:text-indigo-400 transition-colors text-slate-300">
                                    <act.icon size={20} />
                                 </div>
                                 {act.badge && (
                                   <span className={`text-[9px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-full border leading-none ${
                                     act.badge === 'AI'   ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30' :
                                     act.badge === 'NEW'  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' :
                                     'bg-white/5 text-slate-300 border-white/10'
                                   }`}>{act.badge}</span>
                                 )}
                              </div>
                              <div>
                                <p className="text-base font-bold text-white tracking-tight group-hover:translate-x-1 transition-transform duration-200 leading-tight mb-1">{act.label}</p>
                                <p className="text-[12px] font-medium text-slate-400 leading-relaxed">{act.desc}</p>
                              </div>
                           </Link>
                         ))}
                      </div>
                   </div>
                </div>

                {/* Recent activity */}
                <footer className={`${glassStyle} rounded-[3rem] p-12 border-emerald-500/10 hover:border-emerald-500/40 group shadow-[0_100px_300px_rgba(0,0,0,1)] bg-black/40 transition-all duration-300`}>
                   <div className="flex flex-col xl:flex-row items-center justify-between gap-8 mb-12 px-2">
                      <div className="flex items-center gap-6">
                        <div className="w-14 h-14 rounded-[1.6rem] bg-emerald-500/5 border-2 border-emerald-500/20 flex items-center justify-center shadow-[0_0_80px_rgba(16,185,129,0.1)] group-hover:rotate-[10deg] transition-transform duration-300">
                          <ActivitySquare className="text-emerald-500" size={26} />
                        </div>
                        <div>
                           <h2 className="text-3xl font-black text-white tracking-tighter leading-none mb-2">Recent Activity</h2>
                           <p className="text-[12px] font-medium text-slate-400 tracking-wide leading-none">Your usage totals across all Click features.</p>
                        </div>
                      </div>
                      <Link href="/dashboard/analytics" className="px-8 py-3.5 rounded-[2rem] bg-white text-black text-[13px] font-bold uppercase tracking-[0.2em] shadow-[0_20px_60px_rgba(0,0,0,0.4)] hover:bg-emerald-600 hover:text-white transition-colors active:scale-95 flex items-center gap-3 group">
                        View full analytics <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                      </Link>
                   </div>
                   {recentManifests.length === 0 ? (
                      <div className="px-4 pb-4 flex flex-col items-center text-center gap-6 py-16">
                        <div className="w-16 h-16 rounded-[1.4rem] bg-white/5 border-2 border-white/10 flex items-center justify-center">
                          <ActivitySquare size={28} className="text-slate-500" />
                        </div>
                        <div className="space-y-2">
                          <p className="text-2xl font-black text-white tracking-tight leading-tight">No activity yet</p>
                          <p className="text-[13px] font-medium text-slate-400 max-w-md leading-relaxed">Generate content, schedule a post, or process a video to start tracking your usage.</p>
                        </div>
                        <Link href="/dashboard/forge" className="px-7 py-3 bg-white text-black rounded-full text-[12px] font-bold uppercase tracking-[0.2em] hover:bg-emerald-500 hover:text-white transition-colors flex items-center gap-2.5">
                          <Zap size={14} /> Create your first clip
                        </Link>
                      </div>
                   ) : (
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 px-4 pb-4">
                      {recentManifests.map((item, i) => (
                        <motion.div key={i} whileHover={{ scale: 1.05, y: -10 }} className="p-16 rounded-[4.5rem] bg-black/80 border-2 border-white/5 hover:border-emerald-500/50 transition-all duration-300 group/item flex flex-col justify-between min-h-[280px] shadow-[inset_0_0_100px_rgba(255,255,255,0.02)] relative overflow-hidden">
                           <div className="absolute inset-0 bg-emerald-500/[0.04] opacity-0 group-hover/item:opacity-100 transition-opacity duration-300" />
                           <div className="flex items-center justify-between mb-12 w-full relative z-10">
                              <div className={`p-6 rounded-[2.5rem] ${item.bg} border-2 border-white/10 shadow-3xl transition-all duration-300 group-hover/item:scale-125 group-hover:rotate-12`}>
                                 <item.icon className={`${item.color} drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]`} size={40} />
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                 <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest italic opacity-40">{item.time.toUpperCase()}</span>
                                 <div className="w-12 h-1 bg-white/5 rounded-full" />
                              </div>
                           </div>
                           <p className="text-[18px] font-black text-slate-400 uppercase tracking-[0.2em] italic group-hover/item:text-white transition-colors duration-300 leading-relaxed mb-12 relative z-10 drop-shadow-2xl">{item.text.toUpperCase()}</p>
                           <div className="flex justify-end relative z-10">
                              <div className="w-16 h-16 rounded-[2rem] bg-white/[0.02] border-2 border-white/5 flex items-center justify-center group-hover/item:bg-emerald-500/20 group-hover/item:border-emerald-500/50 transition-all duration-300 shadow-3xl hover:scale-110 active:scale-75 cursor-pointer">
                                <ArrowUpRight size={32} className="text-slate-500 group-hover/item:text-emerald-400 group-hover/item:translate-x-2 group-hover/item:-translate-y-2 transition-all duration-300" />
                              </div>
                           </div>
                        </motion.div>
                      ))}
                   </div>
                   )}
                </footer>
          </div>
        </section>

        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          
          body { font-family: 'Inter', sans-serif; background: #020205; color: white; overflow-x: hidden; }
          .glow-text { text-shadow: 0 0 40px rgba(16, 185, 129, 0.6); }
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.3); border-radius: 10px; }
          @keyframes shimmer-fast { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
          .animate-shimmer { animation: shimmer-fast 2s infinite linear; }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}

const ArrowUpRight = (props: any) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="7" y1="17" x2="17" y2="7" />
    <polyline points="7 7 17 7 17 17" />
  </svg>
)
