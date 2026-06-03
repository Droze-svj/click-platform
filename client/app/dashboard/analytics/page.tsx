'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp, Eye, Heart, Share2, Zap, Brain, Sparkles,
  RefreshCw, Shield, Fingerprint, ActivitySquare, Terminal,
  Boxes, Target, Cpu, Monitor, Network, Globe, Activity,
  ArrowUpRight, MessageSquare, Flame, Clock, Waves, ChevronDown,
  ArrowLeft, Search, Filter, MoreHorizontal, BarChart3, CheckCircle2
} from 'lucide-react'
import { apiGet } from '@/lib/api'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import ToastContainer from '@/components/ToastContainer'
import SpectralLoader from '@/components/SpectralLoader'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────
interface AnalyticsOverview {
  total_posts: number
  total_views: number
  total_engagement: number
  avg_engagement_rate: number
  published_posts: number
  isFallback?: boolean
  ai_summary?: {
    headline: string
    recommendation: string
    intensity: number
  }
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

export default function SovereignAnalyticsMatrix() {
  const router = useRouter()
  const [data, setData] = useState<AnalyticsOverview | null>(null)
  const [nodes, setNodes] = useState<NodeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [fetchError, setFetchError] = useState(false)
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [showFilterMenu, setShowFilterMenu] = useState(false)

  const fetchMatrix = useCallback(async () => {
    setRefreshing(true)
    setFetchError(false)
    try {
      const res: any = await apiGet('/analytics/dashboard')
      const overview = res?.overview ? { ...res.overview, isFallback: !!(res.isFallback || res.overview.isFallback) } : null
      setData(overview)

      const nodeRes: any = await apiGet('/analytics/creator/stats')
      setNodes(Array.isArray(nodeRes?.stats) ? nodeRes.stats : [])
    } catch (err) {
      console.error('Analytics fetch failed', err)
      setFetchError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchMatrix() }, [fetchMatrix])

  const availablePlatforms = Array.from(new Set(nodes.map(n => n.platform).filter(Boolean)))

  const filteredNodes = nodes.filter(node => {
    const matchesSearch =
      node.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.platform.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesPlatform = platformFilter === 'all' || node.platform === platformFilter
    return matchesSearch && matchesPlatform
  })

  if (loading) return (
     <div className="flex flex-col items-center justify-center py-48 bg-surface-page dark:bg-black min-h-screen transition-colors duration-500">
        <ActivitySquare size={80} className="text-primary-500 animate-spin mb-12" />
        <p className="text-sm font-black text-surface-500 dark:text-slate-500 uppercase tracking-widest animate-pulse italic leading-none">Syncing Diagnostics...</p>
     </div>
  )

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-4 sm:px-6 lg:px-12 pt-8 max-w-[1900px] mx-auto space-y-12 bg-transparent text-white transition-colors duration-500 font-inter">
        <ToastContainer />
        
        {/* Matrix Header */}
        <header className="flex flex-col lg:flex-row justify-between items-center gap-12 pb-10 border-b-2 border-white/5 relative z-50">
           <div className="flex items-center gap-6 w-full lg:w-auto min-w-0">
              <button type="button" onClick={() => router.push('/dashboard')} title="Back to Dashboard" aria-label="Back to Dashboard" className="w-14 h-14 rounded-2xl bg-black/40 border-2 border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-sm active:scale-90 group">
                <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
              </button>
              <div className="w-20 h-20 rounded-[2.5rem] bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.4)] flex-shrink-0 group hover:rotate-12 transition-transform duration-500">
                <BarChart3 size={40} className="text-primary-500" />
              </div>
              <div className="flex-1 min-w-0">
                 <div className="flex items-center gap-4 mb-2 flex-wrap">
                    <span className="px-3 py-1 rounded-lg text-[10px] font-black bg-primary-900/30 text-primary-400 uppercase tracking-[0.1em] sm:tracking-[0.2em] border border-primary-500/20 italic leading-none">
                      Diagnostics
                    </span>
                    <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-black/40 text-slate-500 border border-white/10 text-[10px] font-black italic shadow-inner">
                        <ActivitySquare size={12} className="text-primary-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                        Live
                    </div>
                 </div>
                 <h1 className="text-3xl sm:text-5xl font-black tracking-tighter leading-none mt-3 truncate uppercase italic text-white">Analytics</h1>
              </div>
           </div>

           <div className="flex flex-wrap items-center gap-6 justify-end w-full lg:w-auto">
              <button
                type="button"
                onClick={() => router.push('/dashboard/analytics/creator')}
                className="px-10 py-5 bg-black/40 border-2 border-primary-500/20 text-primary-400 font-black uppercase text-[11px] tracking-[0.6em] italic rounded-2xl hover:bg-primary-500 hover:text-white transition-all shadow-2xl active:scale-95 flex items-center gap-4 group"
                title="Open Heuristic Diagnostics"
                aria-label="Open Heuristic Diagnostics"
              >
                <Brain size={22} className="group-hover:scale-125 transition-transform" />
                AI insights
              </button>
              <button
                type="button"
                onClick={fetchMatrix}
                disabled={refreshing}
                title="Synchronize Diagnostics"
                aria-label="Synchronize Diagnostics"
                className="px-10 py-5 bg-white text-black font-black uppercase text-[11px] tracking-[0.6em] italic rounded-2xl hover:bg-primary-500 hover:text-white transition-all shadow-2xl active:scale-95 flex items-center gap-4 group border-none"
              >
                <RefreshCw size={22} className={refreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'} />
                {refreshing ? 'SYNCING_NODES...' : 'Refresh'}
              </button>
           </div>
        </header>

        {/* API error banner */}
        {fetchError && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-[3rem] border-2 border-rose-500/30 bg-black/40 p-10 flex flex-col md:flex-row items-center gap-10 relative z-10 shadow-2xl backdrop-blur-3xl"
          >
            <div className="w-20 h-20 rounded-[2rem] bg-rose-500/10 border-2 border-rose-500/20 flex items-center justify-center flex-shrink-0">
              <ActivitySquare size={40} className="text-rose-500" />
            </div>
            <div className="flex-1 min-w-0 text-center md:text-left">
              <p className="text-[11px] font-black uppercase tracking-[0.5em] text-rose-500 italic mb-3">Couldn't load analytics</p>
              <h3 className="text-2xl font-black text-white tracking-tighter leading-tight mb-2 uppercase italic">Analytics service unreachable — data shown may be stale.</h3>
              <p className="text-sm font-bold text-slate-500 italic">Check that the backend is running, then retry.</p>
            </div>
            <button type="button" onClick={fetchMatrix} title="Retry" aria-label="Retry analytics fetch"
              className="px-8 py-4 bg-white text-black rounded-2xl text-[11px] font-black uppercase tracking-[0.4em] italic shadow-2xl active:scale-95 border-none hover:bg-rose-500 hover:text-white transition-all">
              Retry
            </button>
          </motion.div>
        )}

        {/* Empty-state banner */}
        {data?.isFallback && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-[3rem] border-2 border-amber-500/20 bg-black/40 p-10 flex flex-col md:flex-row items-center gap-10 relative z-10 shadow-2xl backdrop-blur-3xl"
          >
            <div className="w-20 h-20 rounded-[2rem] bg-amber-500/10 border-2 border-amber-500/20 flex items-center justify-center flex-shrink-0 shadow-inner group hover:rotate-12 transition-transform duration-500">
              <Shield size={40} className="text-amber-500 drop-shadow-[0_0_15px_rgba(245,158,11,0.4)]" />
            </div>
            <div className="flex-1 min-w-0 text-center md:text-left">
              <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.5em] text-amber-500 italic mb-3">No data yet</p>
              <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tighter leading-tight mb-3 uppercase italic group-hover:text-amber-500 transition-colors">Connect a social account to see your real numbers here.</h3>
               <p className="text-sm font-bold text-slate-500 italic leading-relaxed uppercase tracking-tight">
                Link any platform under{' '}
                <Link href="/dashboard/social" className="text-amber-500 underline hover:no-underline font-black hover:text-white transition-colors">Connect Accounts</Link>{' '}
                — analytics start populating within a few minutes of your first sync.
              </p>
            </div>
            <button type="button" onClick={() => router.push('/dashboard/social')} title="Connect a platform" aria-label="Connect a platform" className="px-8 py-4 bg-white text-black rounded-2xl text-[11px] font-black uppercase tracking-[0.4em] italic shadow-2xl active:scale-95 border-none hover:bg-amber-500 hover:text-white transition-all">Connect</button>
          </motion.div>
        )}

        {/* Neural Potency & Master Metrics HUD */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-12 relative z-10">
          {/* Potency Ring Card */}
          <motion.section initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
            className="xl:col-span-7 bg-black/40 backdrop-blur-3xl border-2 border-white/5 p-8 sm:p-14 rounded-[3rem] sm:rounded-[4rem] flex flex-col lg:flex-row items-center gap-12 sm:gap-16 shadow-2xl relative overflow-hidden transition-all duration-500 hover:shadow-[0_80px_150px_rgba(0,0,0,0.5)] group"
          >
            <div className="absolute top-0 right-0 p-20 opacity-[0.02] pointer-events-none group-hover:opacity-[0.05] transition-opacity duration-1000"><Monitor size={450} className="text-white" /></div>
            
            {/* Neural Potency Ring */}
            <div className="flex flex-col items-center gap-10 shrink-0 relative z-10">
              <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-full border-[10px] sm:border-[14px] border-primary-500/10 flex flex-col items-center justify-center bg-black/40 shadow-[inset_0_0_80px_rgba(0,0,0,0.8)] relative group/ring"
                aria-label={`Average Affinity Rate: ${data?.avg_engagement_rate || 0}%`}
              >
                <motion.div initial={{ rotate: 0 }} animate={{ rotate: 360 }} transition={{ duration: 15, repeat: Infinity, ease: 'linear' }} className="absolute inset-[-10px] sm:inset-[-14px] rounded-full border-[10px] sm:border-[14px] border-primary-500 border-t-transparent border-l-transparent shadow-[0_0_100px_rgba(99,102,241,0.8)]" aria-hidden="true" />
                <span className="text-6xl sm:text-8xl font-black italic tracking-tighter text-white tabular-nums leading-none">
                  {data?.avg_engagement_rate || 0}%
                </span>
                <span className="text-[10px] sm:text-[12px] font-black text-primary-500 uppercase tracking-[0.4em] sm:tracking-[0.6em] mt-3 sm:mt-4 italic drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]">Engagement</span>
              </div>
               <div className="px-8 py-3 rounded-2xl bg-black/40 border-2 border-white/10 shadow-2xl transition-all group-hover:border-primary-500/30">
                  <span className="text-[11px] font-black text-slate-700 uppercase tracking-[0.5em] italic leading-none">Engagement score</span>
               </div>
            </div>

            {/* Heuristic Inference Feed */}
            <div className="space-y-10 flex-1 relative z-10 text-center lg:text-left">
              <div className="flex items-center gap-4 justify-center lg:justify-start flex-wrap">
                 <Sparkles className="text-primary-500 animate-pulse" size={24} />
                  <span className="text-[12px] font-black text-primary-500 uppercase tracking-[0.4em] italic drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" title="AI insight" aria-label="AI insight">AI insight</span>
                  {/* Refresh button — lets the user replace the cached
                      headline on demand. The previous version had no
                      affordance, so old AI text (e.g. the legacy
                      "spectral resonance" copy) would persist forever
                      until the worker happened to regenerate. */}
                  <button
                    type="button"
                    onClick={() => fetchMatrix()}
                    disabled={refreshing}
                    title="Refresh insight"
                    aria-label="Refresh insight"
                    className="ml-1 px-3 py-1 rounded-lg bg-primary-500/10 border border-primary-500/20 text-[10px] font-black uppercase tracking-widest italic text-primary-400 hover:bg-primary-500/20 disabled:opacity-40 transition-colors flex items-center gap-2"
                  >
                    <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                    {refreshing ? 'Refreshing…' : 'Refresh'}
                  </button>
              </div>
              {/* AI quote autofit. Previously `max-w-2xl` + the inherited
                  flex container kept this clipped at "YOUR SPECTRAL RESONA…".
                  `min-w-0` + `[overflow-wrap:anywhere]` lets the headline
                  wrap inside whatever space the parent gives it. */}
              <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black italic text-white leading-tight uppercase tracking-tight max-w-3xl min-w-0 [overflow-wrap:anywhere]">
                  &ldquo;{data?.ai_summary?.headline || 'Once you publish your first post, your AI insight shows up here.'}&rdquo;
              </h2>
               <div className="flex flex-wrap gap-6 justify-center lg:justify-start">
                  <div className="flex items-center gap-4 px-6 py-3 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/20 text-[10px] font-black text-emerald-400 uppercase tracking-widest italic shadow-xl backdrop-blur-xl">
                     <CheckCircle2 size={16} /> Healthy
                  </div>
                  <div className="flex items-center gap-4 px-6 py-3 rounded-2xl bg-primary-500/10 border-2 border-primary-500/20 text-[10px] font-black text-primary-400 uppercase tracking-widest italic shadow-xl backdrop-blur-xl">
                     <ActivitySquare size={16} /> Engaged
                  </div>
               </div>
            </div>
          </motion.section>

          {/* Quick Metrics Grid */}
          <div className="xl:col-span-5 grid grid-cols-1 md:grid-cols-2 gap-10">
             <ScoreCard label="Reach" value={fmt(data?.total_views || 0)} icon={Eye} color="text-rose-500" trend="+12.4%" />
             <ScoreCard label="Engagement" value={fmt(data?.total_engagement || 0)} icon={Waves} color="text-violet-500" trend="+8.2%" />
             <ScoreCard label="Posts" value={data?.total_posts || 0} icon={Boxes} color="text-primary-500" trend="Live" />
             <ScoreCard label="Status" value="Healthy" icon={Cpu} color="text-emerald-500" trend="Synced" />
          </div>
        </div>

        {/* Global Node Ledger */}
        <section className="bg-black/40 backdrop-blur-3xl border-2 border-white/5 rounded-[4rem] overflow-hidden flex flex-col shadow-2xl transition-all duration-500 group/ledger hover:shadow-[0_80px_150px_rgba(0,0,0,0.5)]">
            <div className="flex flex-col md:flex-row items-center justify-between px-6 sm:px-14 py-12 border-b-2 border-white/5 bg-white/5 gap-10 relative z-10">
               <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8 text-white">
                   <div className="p-4 rounded-2xl bg-primary-500/10 border-2 border-primary-500/20 shadow-[0_10px_30px_rgba(0,0,0,0.4)] group-hover/ledger:rotate-12 transition-transform duration-500"><Boxes size={32} className="text-primary-500" /></div>
                  <div className="text-center sm:text-left">
                     <h3 className="text-3xl sm:text-4xl font-black italic uppercase tracking-tighter leading-none mb-2">Recent posts</h3>
                     <p className="text-[9px] sm:text-[11px] text-slate-500 font-black uppercase tracking-[0.3em] sm:tracking-[0.5em] italic leading-none">Live performance for everything you've published.</p>
                  </div>
               </div>
              <div className="flex items-center gap-6 w-full md:w-auto">
                 <div className="relative flex-1 min-w-0 md:w-80 group/search">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-800 group-focus-within/search:text-primary-500 transition-colors" size={20} />
                    <input 
                       type="text" 
                       value={searchQuery}
                       onChange={(e) => setSearchQuery(e.target.value)}
                       placeholder="Search posts…"
                       title="Search posts"
                       aria-label="Search posts"
                       className="w-full pl-16 pr-8 py-5 bg-black/40 border-2 border-white/10 rounded-2xl text-[11px] font-black uppercase tracking-widest italic placeholder:text-slate-800 focus:outline-none focus:border-primary-500 transition-all shadow-inner"
                    />
                 </div>
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowFilterMenu(v => !v)}
                      title="Filter posts by platform"
                      aria-label="Filter posts by platform"
                      aria-haspopup="menu"
                      aria-expanded={showFilterMenu ? 'true' : 'false'}
                      className={`w-16 h-16 rounded-2xl bg-black/40 border-2 flex items-center justify-center transition-all shadow-2xl active:scale-90 ${platformFilter !== 'all' ? 'border-primary-500/50 text-primary-400' : 'border-white/5 text-slate-400 hover:text-white'}`}
                    >
                      <Filter size={24} />
                    </button>
                    {showFilterMenu && (
                      <div role="menu" className="absolute right-0 mt-3 w-56 bg-black/90 border-2 border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden backdrop-blur-xl">
                        {['all', ...availablePlatforms].map(platform => (
                          <button
                            key={platform}
                            type="button"
                            role="menuitemradio"
                            aria-checked={platformFilter === platform ? 'true' : 'false'}
                            onClick={() => { setPlatformFilter(platform); setShowFilterMenu(false); }}
                            className={`w-full text-left px-6 py-4 text-[11px] font-black uppercase tracking-widest italic transition-colors ${platformFilter === platform ? 'bg-primary-500/20 text-primary-400' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                          >
                            {platform === 'all' ? 'All platforms' : platform}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
              </div>
           </div>

            <div className="divide-y-2 divide-white/5 max-h-[60vh] overflow-y-auto custom-scrollbar relative z-10">
             <AnimatePresence>
               {filteredNodes.map((node, idx) => (
                 <motion.div key={node.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ delay: idx * 0.05 }}
                    title={`View details for ${node.title}`}
                    aria-label={`View details for ${node.title}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/dashboard/video/edit/${node.id}`)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push(`/dashboard/video/edit/${node.id}`); }}
                    className="flex items-center gap-10 px-10 sm:px-14 py-10 hover:bg-white/5 transition-all duration-700 cursor-pointer group border-l-[12px] border-l-transparent hover:border-l-primary-500 relative overflow-hidden"
                 >
                    <div className="text-2xl font-black text-slate-900 w-12 tabular-nums italic group-hover:text-primary-500/20 transition-colors">{String(idx + 1).padStart(2, '0')}</div>

                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-black/40 border-2 border-white/5 flex items-center justify-center text-white text-xl sm:text-3xl shrink-0 shadow-inner group-hover:rotate-12 group-hover:scale-110 transition-all duration-500 uppercase font-black italic">
                     {node.platform === 'tiktok' ? '♪' : node.platform === 'instagram' ? '◈' : '▶'}
                   </div>

                   <div className="flex-1 min-w-0">
                     <p className="text-3xl font-black text-white truncate uppercase italic tracking-tighter group-hover:text-primary-500 transition-colors duration-500">{node.title}</p>
                     <div className="flex items-center gap-8 mt-3 text-[11px] font-black text-slate-700 uppercase tracking-widest italic leading-none">
                        <div className="flex items-center gap-3"><Cpu size={16} className="text-primary-500" /> <span>{node.platform.toUpperCase()}</span></div>
                        <div className="w-2 h-2 rounded-full bg-white/5" />
                        <div className="flex items-center gap-3"><Clock size={16} /> <span>{new Date(node.publishedAt || Date.now()).toLocaleDateString()}</span></div>
                        <div className="w-2 h-2 rounded-full bg-white/5" />
                        <div className="flex items-center gap-3"><Shield size={16} className="text-emerald-500" /> <span className="text-emerald-500">Live</span></div>
                     </div>
                   </div>

                   <div className="flex items-center gap-6 sm:gap-12 shrink-0">
                     <div className="text-right hidden sm:block">
                       <div className="text-2xl sm:text-4xl font-black text-white italic tracking-tighter tabular-nums leading-none mb-1 group-hover:text-primary-500 transition-colors">{fmt(node.views)}</div>
                        <div className="text-[8px] sm:text-[10px] text-slate-700 font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] italic">Views</div>
                     </div>
                      <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-xl flex flex-col items-center justify-center border-2 shrink-0 shadow-xl transition-all group-hover:scale-110 ${(node.viralScore ?? 0) >= 80 ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10' : 'border-primary-500/30 text-primary-500 bg-primary-500/10'}`}>
                       <span className="text-xl sm:text-2xl font-black italic leading-none">{node.viralScore ?? 0}</span>
                       <span className="text-[6px] sm:text-[8px] font-black mt-0.5 sm:mt-1 uppercase tracking-widest">Score</span>
                     </div>
                     <button type="button" onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/analytics/posts/${node.id}`); }} title="View post analytics" aria-label="View post analytics" className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-slate-800 hover:text-primary-500 hover:border-primary-500/30 transition-all active:scale-90">
                        <MoreHorizontal size={20} />
                     </button>
                   </div>
                 </motion.div>
               ))}
             </AnimatePresence>

              {(filteredNodes.length === 0 && !loading) && (
                <div className="py-48 flex flex-col items-center justify-center opacity-10 group-hover:opacity-20 transition-opacity duration-1000">
                   <ActivitySquare size={120} className="animate-pulse mb-10 text-primary-500" />
                   <span className="text-3xl font-black uppercase tracking-[0.8em] italic text-slate-900">No posts yet</span>
                </div>
              )}
           </div>
           <div className="px-10 py-8 bg-black/40 border-t-2 border-white/5 flex items-center justify-between">
              <p className="text-[10px] font-black text-slate-900 uppercase tracking-[0.5em] italic">Secure connection</p>
              <span className="text-[10px] font-black text-primary-500 uppercase tracking-widest italic">
                {filteredNodes.length === nodes.length
                  ? `${nodes.length} ${nodes.length === 1 ? 'post' : 'posts'} tracked`
                  : `${filteredNodes.length} of ${nodes.length} posts`}
              </span>
           </div>
        </section>

        <style jsx global>{`
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(var(--color-primary-500), 0.1); border-radius: 10px; }
          .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}

function ScoreCard({ label, value, icon: Icon, color, trend }: { label: string; value: string | number; icon: any; color: string; trend: string }) {
  return (
    <motion.div whileHover={{ y: -10, scale: 1.02 }}
      role="status" aria-label={`${label}: ${value}, Trend: ${trend}`}
      className="bg-black/40 backdrop-blur-3xl border-2 border-white/5 p-10 rounded-[3.5rem] flex flex-col items-center text-center group relative overflow-hidden shadow-2xl transition-all duration-500 hover:shadow-[0_40px_100px_rgba(0,0,0,0.4)]"
    >
       <div className="absolute top-0 right-0 p-10 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity duration-1000 pointer-events-none" aria-hidden="true"><Monitor size={200} className="text-white" /></div>
       <div className="w-20 h-20 rounded-[2rem] bg-black/40 border-2 border-white/5 flex items-center justify-center mb-10 shadow-inner group-hover:rotate-12 transition-all duration-700" aria-hidden="true">
          <Icon size={36} className={color} />
       </div>
       <div className="text-4xl sm:text-6xl font-black text-white italic tracking-tighter tabular-nums leading-none mb-5 group-hover:text-primary-500 transition-colors duration-500">{value}</div>
       <div className="text-[10px] sm:text-[12px] text-slate-700 font-black uppercase tracking-[0.3em] sm:tracking-[0.5em] italic mb-8 leading-none group-hover:text-white transition-colors">{label}</div>
       <div className="text-[10px] text-slate-800 font-black uppercase tracking-[1em] italic bg-black/20 px-8 py-3 rounded-2xl border-2 border-white/5 shadow-inner group-hover:border-primary-500/30 group-hover:text-primary-500 transition-all">
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
