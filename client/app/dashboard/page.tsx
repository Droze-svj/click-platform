'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../hooks/useAuth'
import { apiGet } from '../../lib/api'
import {
  Video, Sparkles, Send, Brain, RefreshCw,
  ArrowRight, Zap, Flame, FileText,
  Globe, Settings, ShieldCheck,
  ActivitySquare, Plug, BarChart3, Users, Clock, Moon, Sun,
  Box, Hammer, Signal, ChevronRight, Play, LayoutGrid
} from 'lucide-react'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import ToastContainer from '../../components/ToastContainer'
import SubscriptionBanner from '../../components/SubscriptionBanner'
import AILearningIndicator from '../../components/AILearningIndicator'
import { validateFile } from '../../utils/fileValidator'
import { useTheme } from '../../components/ThemeProvider'

const DASHBOARD_NAV = [
  {
    label: 'One-Click Forge',
    desc: 'Instantly transform raw footage into viral short-form packs with AI.',
    icon: Hammer,
    href: '/dashboard/forge',
    badge: 'AI ENGINE',
    colors: 'bg-primary-50 text-primary-600 border-primary-200 dark:bg-primary-900/20 dark:text-primary-400 dark:border-primary-800/50'
  },
  {
    label: 'Neural Video Studio',
    desc: 'Advanced timeline editor with AI-powered cuts, captions, and b-roll.',
    icon: Video,
    href: '/dashboard/video',
    badge: 'ADVANCED',
    colors: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800/50'
  },
  {
    label: 'Script Architect',
    desc: 'Generate high-retention scripts for TikTok, Reels, and YouTube Shorts.',
    icon: FileText,
    href: '/dashboard/scripts',
    badge: 'AI WRITER',
    colors: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50'
  },
  {
    label: 'Global Scheduler',
    desc: 'Coordinate and automate your content distribution across all platforms.',
    icon: Send,
    href: '/dashboard/scheduler',
    badge: 'SYNCED',
    colors: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50'
  },
  {
    label: 'Market Discover',
    desc: 'Uncover trending hooks, viral sounds, and industry-leading formats.',
    icon: Flame,
    href: '/dashboard/trends',
    badge: 'LIVE',
    colors: 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800/50'
  },
  {
    label: 'Platform Vault',
    desc: 'Manage and connect your TikTok, Instagram, YouTube, and X accounts.',
    icon: Plug,
    href: '/dashboard/integrations',
    badge: 'SECURE',
    colors: 'bg-cyan-50 text-cyan-600 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-400 dark:border-cyan-800/50'
  },
]

interface DashboardStat { 
  label: string; 
  value: string | number; 
  icon: React.ElementType; 
  colors: string; 
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
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-surface-900/80 backdrop-blur-sm flex items-center justify-center pointer-events-none border-[12px] border-dashed border-primary-500/50"
        >
          <div className="text-center bg-white dark:bg-surface-900 p-12 rounded-[3rem] shadow-2xl border border-surface-200 dark:border-surface-800">
            <motion.div 
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-32 h-32 rounded-3xl bg-primary-100 dark:bg-primary-900/40 border-2 border-primary-200 dark:border-primary-800 flex items-center justify-center mx-auto mb-8"
            >
              <Box className="w-16 h-16 text-primary-600 dark:text-primary-400" />
            </motion.div>
            <h2 className="text-4xl font-black text-surface-900 dark:text-white tracking-tight mb-3">Drop to Process</h2>
            <p className="text-sm font-bold text-primary-600 dark:text-primary-400 uppercase tracking-widest">AI will auto-analyze your media</p>
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
          colors: 'bg-primary-50 text-primary-600 border-primary-200 dark:bg-primary-900/20 dark:text-primary-400 dark:border-primary-800/50',
          trend: '+12.5% this week',
          desc: 'Total impressions across all platforms.'
        },
        {
          label: 'Engagement',
          value: fmt(analytics?.totalEngagement),
          icon: Zap,
          colors: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50',
          trend: 'High resonance detected',
          desc: 'Total likes, comments, and shares.'
        },
        {
          label: 'Active Content',
          value: analytics?.publishedPosts ?? 0,
          icon: Video,
          colors: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800/50',
          trend: `${analytics?.totalPosts ?? 0} in pipeline`,
          desc: 'Live posts driving traffic.'
        },
        {
          label: 'Connected Accounts',
          value: integrationCount,
          icon: Signal,
          colors: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50',
          trend: integrationCount === 0 ? 'Action required' : 'Sync stable',
          desc: 'Social platforms actively managed.'
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

      <div className="min-h-screen relative z-10 pb-32 px-4 sm:px-6 lg:px-12 pt-8 max-w-[1900px] mx-auto space-y-8 bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-surface-50 transition-colors duration-500">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-surface-200 dark:border-surface-800">
          <div className="flex items-center gap-5 w-full md:w-auto">
            <div className="w-16 h-16 rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 flex items-center justify-center shadow-sm">
              <ShieldCheck size={32} className="text-primary-600 dark:text-primary-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400 uppercase tracking-wide border border-primary-200 dark:border-primary-800">
                  Click Platform
                </span>
                <div className={`px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1.5 ${apiStatus === 'online' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50' : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800/50'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${apiStatus === 'online' ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
                  {apiStatus.toUpperCase()}
                </div>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-none mt-2">
                {greeting}, {firstName}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <button onClick={toggle} className="w-12 h-12 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 flex items-center justify-center text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors shadow-sm">
              {resolvedTheme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <Link href="/dashboard/settings" className="w-12 h-12 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 flex items-center justify-center text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors shadow-sm">
              <Settings size={20} />
            </Link>
            <button onClick={fetchData} className="px-5 py-3 bg-surface-900 dark:bg-white text-white dark:text-surface-900 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-surface-800 dark:hover:bg-surface-100 transition-colors shadow-sm flex items-center gap-2">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> <span>Sync</span>
            </button>
          </div>
        </header>

        <div data-focus-secondary>
          <AILearningIndicator />
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
          
          {/* Left Column: Stats & Main Activity */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Metric Tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {stats.map((s, i) => (
                <div key={i} className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 p-6 rounded-2xl shadow-sm">
                  <div className={`w-10 h-10 rounded-xl ${s.colors} border flex items-center justify-center mb-4`}>
                    <s.icon size={20} />
                  </div>
                  <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-1">{s.label}</p>
                  <h4 className="text-2xl font-black text-surface-900 dark:text-surface-50 tracking-tight mb-2">{s.value}</h4>
                  <div className="flex items-center gap-1.5">
                    <ActivitySquare size={12} className="text-primary-500" />
                    <span className="text-[10px] font-bold text-surface-500">{s.trend}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Performance Center */}
            <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 flex items-center justify-center">
                    <BarChart3 size={24} className="text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-surface-900 dark:text-surface-50 tracking-tight">Performance Overview</h2>
                    <p className="text-sm font-medium text-surface-500 mt-1">AI-driven insights for your connected accounts.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-5 rounded-xl bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 space-y-3">
                    <div className="flex items-center gap-2">
                      <Brain size={18} className="text-primary-600 dark:text-primary-400" />
                      <span className="text-sm font-bold text-surface-900 dark:text-surface-50">Strategy Insight</span>
                    </div>
                    <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                      Our neural model predicts a 14% increase in retention if you utilize <span className="text-surface-900 dark:text-surface-50 font-semibold">Pattern-Interrupt</span> hooks in your next 3 videos.
                    </p>
                    <Link href="/dashboard/scripts" className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline">
                      Optimize Scripts <ArrowRight size={14} />
                    </Link>
                  </div>

                  <div className="p-5 rounded-xl bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 space-y-3">
                    <div className="flex items-center gap-2">
                      <Users size={18} className="text-emerald-600 dark:text-emerald-400" />
                      <span className="text-sm font-bold text-surface-900 dark:text-surface-50">Audience Peak</span>
                    </div>
                    <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                      Your synchronized platforms are currently reaching peak saturation. Engagement is highest at 19:00 UTC.
                    </p>
                    <Link href="/dashboard/scheduler" className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline">
                      Open Scheduler <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-surface-200 dark:border-surface-800 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
                    <span className="text-xs font-bold text-surface-500 uppercase tracking-wider">Engine Active</span>
                  </div>
                  <div className="flex items-center gap-2 border-l border-surface-200 dark:border-surface-800 pl-4">
                    <Clock size={14} className="text-surface-400" />
                    <span className="text-xs font-bold text-surface-500 uppercase tracking-wider">Synced just now</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Quick Launch */}
          <div className="lg:col-span-4 space-y-6">
            
            <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 flex items-center justify-center">
                  <LayoutGrid size={20} className="text-primary-600 dark:text-primary-400" />
                </div>
                <h3 className="text-lg font-black text-surface-900 dark:text-surface-50 tracking-tight">Quick Actions</h3>
              </div>

              <div className="space-y-3">
                {DASHBOARD_NAV.map((act, i) => (
                  <Link 
                    key={i} 
                    href={act.href} 
                    className="flex items-start gap-4 p-4 rounded-xl bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 hover:border-primary-300 dark:hover:border-primary-700 transition-colors group"
                  >
                    <div className={`w-10 h-10 shrink-0 rounded-lg ${act.colors} border flex items-center justify-center`}>
                      <act.icon size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-bold text-surface-900 dark:text-surface-50">{act.label}</h4>
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-200 dark:bg-surface-800 text-surface-600 dark:text-surface-400">
                          {act.badge}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-surface-500 line-clamp-2">
                        {act.desc}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div data-focus-secondary className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl p-6 shadow-sm">
              <h3 className="text-xs font-bold text-surface-500 uppercase tracking-widest mb-4">Connections</h3>
              <div className="space-y-4">
                {['tiktok', 'instagram', 'youtube', 'twitter'].map((p, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-surface-50 dark:bg-surface-950 flex items-center justify-center text-surface-500 border border-surface-200 dark:border-surface-800">
                        {p === 'tiktok' ? '♪' : p === 'instagram' ? '◎' : p === 'youtube' ? '▶' : '𝕏'}
                      </div>
                      <span className="text-sm font-bold text-surface-900 dark:text-surface-50 capitalize">{p}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Linked</span>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/dashboard/integrations" className="mt-6 block text-center py-3 rounded-xl bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 text-xs font-bold text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors">
                Manage Platforms
              </Link>
            </div>
          </div>
        </div>

      </div>
    </ErrorBoundary>
  )
}
