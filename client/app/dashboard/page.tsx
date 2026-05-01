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
  Sparkle, Command, Hammer, Plug, LayoutGrid, BarChart3, Users, Clock, Moon, Sun
} from 'lucide-react'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import ToastContainer from '../../components/ToastContainer'
import SubscriptionBanner from '../../components/SubscriptionBanner'
import { validateFile } from '../../utils/fileValidator'
import { useTheme } from '../../components/ThemeProvider'

const glassStyle = 'backdrop-blur-[var(--glass-blur)] bg-[var(--glass-surface)] border border-[var(--glass-border)] shadow-[var(--glass-glow)] transition-all duration-500'

const DASHBOARD_NAV = [
  {
    label: 'One-Click Forge',
    desc: 'Instantly transform raw footage into viral short-form packs with AI.',
    icon: Hammer,
    href: '/dashboard/forge',
    badge: 'AI ENGINE',
    color: 'text-[var(--tint-indigo-fg)]',
    bg: 'bg-[var(--tint-indigo-bg)]',
    edge: 'border-[var(--tint-indigo-edge)]',
  },
  {
    label: 'Neural Video Studio',
    desc: 'Advanced timeline editor with AI-powered cuts, captions, and b-roll.',
    icon: Video,
    href: '/dashboard/video',
    badge: 'ADVANCED',
    color: 'text-[var(--tint-rose-fg)]',
    bg: 'bg-[var(--tint-rose-bg)]',
    edge: 'border-[var(--tint-rose-edge)]',
  },
  {
    label: 'Script Architect',
    desc: 'Generate high-retention scripts for TikTok, Reels, and YouTube Shorts.',
    icon: FileText,
    href: '/dashboard/scripts',
    badge: 'AI WRITER',
    color: 'text-[var(--tint-amber-fg)]',
    bg: 'bg-[var(--tint-amber-bg)]',
    edge: 'border-[var(--tint-amber-edge)]',
  },
  {
    label: 'Global Scheduler',
    desc: 'Coordinate and automate your content distribution across all platforms.',
    icon: Send,
    href: '/dashboard/scheduler',
    badge: 'SYNCED',
    color: 'text-[var(--tint-emerald-fg)]',
    bg: 'bg-[var(--tint-emerald-bg)]',
    edge: 'border-[var(--tint-emerald-edge)]',
  },
  {
    label: 'Market Discover',
    desc: 'Uncover trending hooks, viral sounds, and industry-leading formats.',
    icon: Flame,
    href: '/dashboard/trends',
    badge: 'LIVE',
    color: 'text-[var(--tint-orange-fg)]',
    bg: 'bg-[var(--tint-orange-bg)]',
    edge: 'border-[var(--tint-orange-edge)]',
  },
  {
    label: 'Platform Vault',
    desc: 'Manage and connect your TikTok, Instagram, YouTube, and X accounts.',
    icon: Plug,
    href: '/dashboard/integrations',
    badge: 'SECURE',
    color: 'text-[var(--tint-cyan-fg)]',
    bg: 'bg-[var(--tint-cyan-bg)]',
    edge: 'border-[var(--tint-cyan-edge)]',
  },
]

interface DashboardStat { 
  label: string; 
  value: string | number; 
  icon: React.ElementType; 
  color: string; 
  bg: string; 
  trend: string;
  desc: string;
}

function DropZoneOverlay() {
  const [dragging, setDragging] = useState(false)
  
  useEffect(() => {
    const handleDrag = (e: DragEvent) => { e.preventDefault(); setDragging(true) }
    const handleLeave = (e: DragEvent) => { if (!e.relatedTarget) setDragging(false) }
    const handleDrop = async (e: DragEvent) => {
      e.preventDefault(); setDragging(false)
      const files = Array.from(e.dataTransfer?.files ?? [])
      if (!files.length) return
      const f = files[0]
      const result = await validateFile(f, { allowedTypes: ['video/', 'image/', 'audio/'], maxSizeMB: 500 })
      if (result.valid) window.location.href = '/dashboard/video'
    }
    document.addEventListener('dragover', handleDrag)
    document.addEventListener('dragleave', handleLeave)
    document.addEventListener('drop', handleDrop)
    return () => {
      document.removeEventListener('dragover', handleDrag)
      document.removeEventListener('dragleave', handleLeave)
      document.removeEventListener('drop', handleDrop)
    }
  }, [])

  return (
    <AnimatePresence>
      {dragging && (
        <motion.div 
          initial={{ opacity: 0, backdropFilter: 'blur(0px)' }} 
          animate={{ opacity: 1, backdropFilter: 'blur(40px)' }} 
          exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center pointer-events-none border-[12px] border-dashed border-white/5"
        >
          <div className="text-center">
            <motion.div 
              animate={{ y: [0, -20, 0], scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-48 h-48 rounded-[3rem] bg-indigo-500/20 border-2 border-indigo-500/40 flex items-center justify-center mx-auto mb-10 shadow-[0_0_100px_rgba(99,102,241,0.4)]"
            >
              <Box className="w-20 h-20 text-white" />
            </motion.div>
            <h2 className="text-5xl font-black text-white tracking-tighter mb-4">Initialize Import</h2>
            <p className="text-lg text-indigo-400 font-bold uppercase tracking-[0.3em] opacity-80">Drop video to start neural processing</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function fmt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

export default function NeuralDashboard() {
  const { user } = useAuth() as any
  const { resolvedTheme, toggle } = useTheme()
  const [stats, setStats] = useState<DashboardStat[]>([])
  const [apiStatus, setApiStatus] = useState<'online' | 'offline' | 'checking'>('checking')
  const [loading, setLoading] = useState(true)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'
  const firstName = user?.name?.split(' ')[0] || 'Creator'

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [health, analyticsRes, integrationsRes] = await Promise.allSettled([
        fetch('/api/health'),
        apiGet<any>('/analytics/dashboard'),
        apiGet<any>('/integrations'),
      ])

      setApiStatus(health.status === 'fulfilled' && health.value.ok ? 'online' : 'offline')

      const analytics = analyticsRes.status === 'fulfilled' ? (analyticsRes.value?.data ?? analyticsRes.value) : null
      const integrations = integrationsRes.status === 'fulfilled' ? (integrationsRes.value?.data ?? integrationsRes.value) : []
      const integrationCount = Array.isArray(integrations?.integrations) ? integrations.integrations.length : 0

      setStats([
        {
          label: 'Market Reach',
          value: fmt(analytics?.totalViews),
          icon: Globe,
          color: 'text-[var(--tint-indigo-fg)]',
          bg: 'bg-[var(--tint-indigo-bg)]',
          trend: '+12.5% this week',
          desc: 'Total impressions across all synchronized platforms.'
        },
        {
          label: 'Engagement Depth',
          value: fmt(analytics?.totalEngagement),
          icon: Zap,
          color: 'text-[var(--tint-amber-fg)]',
          bg: 'bg-[var(--tint-amber-bg)]',
          trend: 'High resonance detected',
          desc: 'Total likes, comments, and shares across your network.'
        },
        {
          label: 'Active Content',
          value: analytics?.publishedPosts ?? 0,
          icon: Video,
          color: 'text-[var(--tint-rose-fg)]',
          bg: 'bg-[var(--tint-rose-bg)]',
          trend: `${analytics?.totalPosts ?? 0} in pipeline`,
          desc: 'Live posts currently driving traffic to your brand.'
        },
        {
          label: 'Neural Nodes',
          value: integrationCount,
          icon: Signal,
          color: 'text-[var(--tint-emerald-fg)]',
          bg: 'bg-[var(--tint-emerald-bg)]',
          trend: integrationCount === 0 ? 'Action required' : 'Sync stable',
          desc: 'Number of connected social platforms in your ecosystem.'
        }
      ])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <ErrorBoundary>
      <DropZoneOverlay />
      <SubscriptionBanner />
      <ToastContainer />

      <div className="min-h-screen relative z-10 pb-32 px-4 sm:px-6 lg:px-12 pt-12 max-w-[1900px] mx-auto space-y-12 overflow-x-hidden font-inter bg-[var(--page-bg)] text-[var(--text-main)] transition-colors duration-500">
        
        {/* Background Atmosphere */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-[0.04]">
          <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-500 rounded-full blur-[160px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-purple-500 rounded-full blur-[160px]" />
        </div>

        {/* Header HUD */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-50">
          <div className="flex items-center gap-4 sm:gap-8 w-full md:w-auto">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[var(--tint-indigo-bg)] border-2 border-[var(--tint-indigo-edge)] rounded-2xl sm:rounded-3xl flex items-center justify-center shadow-2xl relative overflow-hidden group">
              <ShieldCheck size={32} className="text-[var(--tint-indigo-fg)] relative z-10 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 sm:gap-4 mb-2 flex-wrap">
                <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.4em] text-[var(--tint-indigo-fg)] italic">Click Ecosystem v4.0</span>
                <div className={`px-2 sm:px-3 py-1 rounded-full text-[8px] sm:text-[9px] font-bold border flex items-center gap-2 ${apiStatus === 'online' ? 'bg-[var(--tint-emerald-bg)] text-[var(--tint-emerald-fg)] border-[var(--tint-emerald-edge)]' : 'bg-[var(--tint-rose-bg)] text-[var(--tint-rose-fg)] border-[var(--tint-rose-edge)]'}`}>
                  <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${apiStatus === 'online' ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
                  {apiStatus.toUpperCase()}
                </div>
              </div>
              <h1 className="text-[clamp(1.5rem,5vw,3.5rem)] font-black text-[var(--text-main)] tracking-tight leading-tight mb-2">
                {greeting}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--text-main)] via-[var(--text-main)]/80 to-[var(--text-main)]/40">{firstName}</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 w-full md:w-auto justify-end">
            <button onClick={toggle} className="w-12 h-12 rounded-2xl bg-[var(--glass-surface)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-main)] hover:scale-105 transition-all shadow-xl">
              {resolvedTheme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <Link href="/dashboard/settings" className="w-12 h-12 rounded-2xl bg-[var(--glass-surface)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-main)] hover:border-[var(--glass-border-strong)] transition-all hover:scale-105">
              <Settings size={22} />
            </Link>
            <button onClick={fetchData} className="px-5 sm:px-6 py-3 bg-[var(--text-main)] text-[var(--page-bg)] rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-xl active:scale-95 flex items-center gap-3">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> <span className="hidden sm:inline">SYNC DATA</span>
            </button>
          </div>
        </header>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
          
          {/* Left Column: Stats & Main Activity */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Metric Tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {stats.map((s, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ y: -8, scale: 1.02 }}
                  className={`${glassStyle} p-6 rounded-[2.5rem] relative overflow-hidden group`}
                >
                  <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.1] transition-opacity pointer-events-none group-hover:rotate-12">
                    <s.icon size={120} />
                  </div>
                  <div className={`w-12 h-12 rounded-2xl ${s.bg} flex items-center justify-center mb-4 border border-[var(--glass-border)]`}>
                    <s.icon className={`${s.color}`} size={24} />
                  </div>
                  <p className="text-[10px] font-black text-[var(--text-dim)] uppercase tracking-widest mb-1 italic">{s.label}</p>
                  <h4 className="text-3xl font-black text-[var(--text-main)] tracking-tighter mb-2 italic tabular-nums">{s.value}</h4>
                  <div className="flex items-center gap-2">
                    <ActivitySquare size={12} className="text-[var(--tint-indigo-fg)]" />
                    <span className="text-[9px] font-bold text-[var(--text-dim)] uppercase tracking-wider">{s.trend}</span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Performance Nerve Center */}
            <div className={`${glassStyle} rounded-[3rem] p-6 sm:p-10 relative overflow-hidden min-h-[400px] flex flex-col justify-between group`}>
              <div className="absolute top-0 right-0 p-12 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity pointer-events-none scale-150 rotate-45">
                <BarChart3 size={400} />
              </div>
              
              <div className="relative z-10">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 mb-8 sm:mb-12">
                  <div className="w-14 h-14 rounded-2xl bg-[var(--tint-indigo-bg)] border-2 border-[var(--tint-indigo-edge)] flex items-center justify-center">
                    <Gauge size={30} className="text-[var(--tint-indigo-fg)] animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-black text-[var(--text-main)] tracking-tight">Performance Nerve Center</h2>
                    <p className="text-xs font-medium text-[var(--text-dim)] tracking-wide mt-1">Real-time health and growth trajectory analysis.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                  <div className="p-6 rounded-3xl bg-[var(--glass-surface)] border border-[var(--glass-border)] space-y-4 hover:bg-[var(--glass-surface-heavy)] transition-colors group/card">
                    <div className="flex items-center gap-3">
                      <Brain size={20} className="text-[var(--tint-indigo-fg)]" />
                      <span className="text-sm font-bold text-[var(--text-main)]">AI Strategy Insight</span>
                    </div>
                    <p className="text-sm text-[var(--text-dim)] leading-relaxed">
                      Our neural model predicts a 14% increase in retention if you utilize <span className="text-[var(--text-main)] font-semibold">Pattern-Interrupt</span> hooks in your next 3 videos.
                    </p>
                    <Link href="/dashboard/scripts" className="inline-flex items-center gap-2 text-[11px] font-bold text-[var(--tint-indigo-fg)] uppercase tracking-widest hover:text-[var(--text-main)] transition-colors">
                      Optimize Scripts <ArrowRight size={14} />
                    </Link>
                  </div>

                  <div className="p-6 rounded-3xl bg-[var(--glass-surface)] border border-[var(--glass-border)] space-y-4 hover:bg-[var(--glass-surface-heavy)] transition-colors group/card">
                    <div className="flex items-center gap-3">
                      <Users size={20} className="text-[var(--tint-emerald-fg)]" />
                      <span className="text-sm font-bold text-[var(--text-main)]">Audience Sync</span>
                    </div>
                    <p className="text-sm text-[var(--text-dim)] leading-relaxed">
                      Your synchronized platforms are currently reaching <span className="text-[var(--text-main)] font-semibold">Global Phase 2</span> saturation. Engagement is peak at 19:00 UTC.
                    </p>
                    <Link href="/dashboard/scheduler" className="inline-flex items-center gap-2 text-[11px] font-bold text-[var(--tint-emerald-fg)] uppercase tracking-widest hover:text-[var(--text-main)] transition-colors">
                      Open Scheduler <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-[var(--glass-border)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 sm:gap-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 w-full sm:w-auto">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-[var(--tint-indigo-fg)] animate-ping" />
                    <span className="text-[10px] font-black text-[var(--text-dim)] uppercase tracking-widest italic">Core Engine Stable</span>
                  </div>
                  <div className="flex items-center gap-3 sm:border-l sm:border-[var(--glass-border)] sm:pl-6">
                    <Clock size={12} className="text-[var(--text-dim)]" />
                    <span className="text-[10px] font-black text-[var(--text-dim)] uppercase tracking-widest italic">Sync: 2ms ago</span>
                  </div>
                </div>
                <div className="flex -space-x-3 w-full sm:w-auto justify-end">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-[var(--page-bg)] bg-slate-800 flex items-center justify-center overflow-hidden">
                      <div className="w-full h-full bg-gradient-to-br from-indigo-500/20 to-indigo-900/40" />
                    </div>
                  ))}
                  <div className="w-8 h-8 rounded-full border-2 border-[var(--page-bg)] bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-white shadow-lg">
                    +12
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Quick Launch & Actions */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* Quick Launch Hub */}
            <div className={`${glassStyle} rounded-[3rem] p-6 sm:p-10 relative overflow-hidden group`}>
              <div className="flex items-center gap-4 mb-8 sm:mb-12">
                <div className="w-12 h-12 rounded-2xl bg-[var(--tint-amber-bg)] border-2 border-[var(--tint-amber-edge)] flex items-center justify-center">
                  <Zap size={26} className="text-[var(--tint-amber-fg)]" />
                </div>
                <h3 className="text-2xl font-black text-[var(--text-main)] tracking-tight">Quick Launch Hub</h3>
              </div>

              <div className="space-y-4">
                {DASHBOARD_NAV.map((act, i) => (
                  <Link 
                    key={i} 
                    href={act.href} 
                    className={`${glassStyle} block p-5 rounded-3xl hover:bg-[var(--glass-surface-heavy)] group/nav border-[var(--glass-border)] hover:border-[var(--glass-border-strong)]`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-10 h-10 rounded-xl ${act.bg} border ${act.edge} flex items-center justify-center group-hover/nav:scale-110 transition-transform`}>
                        <act.icon className={`${act.color}`} size={18} />
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-full bg-[var(--glass-surface)] text-[var(--text-dim)] border border-[var(--glass-border)]">
                        {act.badge}
                      </span>
                    </div>
                    <h4 className="text-base font-black text-[var(--text-main)] tracking-tight mb-1 group-hover/nav:translate-x-1 transition-transform">{act.label}</h4>
                    <p className="text-xs text-[var(--text-dim)] font-medium leading-relaxed group-hover/nav:text-[var(--text-main)] transition-colors">
                      {act.desc}
                    </p>
                  </Link>
                ))}
              </div>
            </div>

            {/* Platform Status */}
            <div className={`${glassStyle} rounded-[3rem] p-8 bg-[var(--tint-indigo-bg)] border-[var(--tint-indigo-edge)] shadow-inner group`}>
              <h3 className="text-lg font-black text-[var(--text-main)] uppercase tracking-widest mb-6 italic">Platform Status</h3>
              <div className="space-y-6">
                {['tiktok', 'instagram', 'youtube', 'twitter'].map((p, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-[var(--glass-surface)] flex items-center justify-center text-[var(--text-dim)] border border-[var(--glass-border)]">
                        {p === 'tiktok' ? '♪' : p === 'instagram' ? '◎' : p === 'youtube' ? '▶' : '𝕏'}
                      </div>
                      <span className="text-sm font-bold text-[var(--text-main)] capitalize">{p}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                      <span className="text-[10px] font-black text-[var(--tint-emerald-fg)] uppercase tracking-widest italic">Stable</span>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/dashboard/integrations" aria-label="Manage social platform connections" className="mt-8 block text-center py-4 rounded-2xl bg-[var(--glass-surface)] border border-[var(--glass-border)] text-[10px] font-black text-[var(--tint-indigo-fg)] uppercase tracking-[0.4em] hover:bg-[var(--glass-surface-heavy)] transition-all">
                MANAGE CONNECTIONS
              </Link>
            </div>
          </div>
        </div>

        {/* Global Footer Overlay */}
        <div className="fixed bottom-6 sm:bottom-8 right-6 sm:right-8 z-[150] hidden sm:block">
          <Link 
            href="/dashboard/forge" 
            className="flex items-center gap-4 px-8 py-5 bg-[var(--text-main)] text-[var(--page-bg)] rounded-full font-black text-sm uppercase tracking-widest shadow-[var(--glass-glow)] hover:scale-105 active:scale-95 transition-all group"
          >
            <Hammer size={20} className="group-hover:rotate-12 transition-transform" /> 
            Open One-Click Forge
          </Link>
        </div>

      </div>
    </ErrorBoundary>
  )
}
