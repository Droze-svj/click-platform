'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../hooks/useAuth'
import { apiGet, apiPost, apiPut } from '../../lib/api'
import { useRouter } from 'next/navigation'
import {
  Video, Sparkles, Send, Brain, RefreshCw,
  ArrowLeft, ArrowRight, Zap, Flame, FileText,
  Globe, Settings,
  ActivitySquare, Plug, BarChart3, Users, Clock, Moon, Sun,
  Box, Hammer, Signal, ChevronRight, Play, LayoutGrid, ArrowUpRight,
  Target, Monitor, Fingerprint, Activity, Terminal, Shield,
  Star, MessageSquare, Heart, Share2, Layers, Boxes, Hexagon,
  Camera, Check, X as XIcon, Pencil
} from 'lucide-react'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { StatsCardSkeleton, ContentSkeleton } from '../../components/LoadingSkeleton'
import ToastContainer from '../../components/ToastContainer'
import SubscriptionBanner from '../../components/SubscriptionBanner'
import AILearningIndicator from '../../components/AILearningIndicator'
import { validateFile } from '../../utils/fileValidator'
import { useTheme } from '../../components/ThemeProvider'
import { useTranslation } from '../../hooks/useTranslation'

/**
 * Dashboard quick-nav cards. The `key` drives the translation lookup
 * (`dashboard.nav.<key>.label` / `dashboard.nav.<key>.desc` / `.badge`)
 * so non-English visitors actually see translated cards instead of
 * "One-Click Forge" hardcoded in English everywhere. The fallback chain
 * in useTranslation returns the English text when a locale lacks the
 * key, so the UI never breaks.
 */
const DASHBOARD_NAV = [
  {
    key: 'forge',
    icon: Hammer,
    href: '/dashboard/forge',
    colors: 'bg-primary-500/10 text-primary-600 dark:text-primary-400 border-primary-500/20 shadow-[0_0_20px_rgba(99,102,241,0.2)]'
  },
  {
    key: 'studio',
    icon: Video,
    href: '/dashboard/video',
    colors: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 shadow-[0_0_20px_rgba(244,63,94,0.2)]'
  },
  {
    key: 'script',
    icon: FileText,
    href: '/dashboard/scripts',
    colors: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
  },
  {
    key: 'scheduler',
    icon: Send,
    href: '/dashboard/scheduler',
    colors: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
  },
  {
    key: 'discover',
    icon: Flame,
    href: '/dashboard/trends',
    colors: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 shadow-[0_0_20px_rgba(249,115,22,0.2)]'
  },
  {
    key: 'vault',
    icon: Plug,
    href: '/dashboard/social',
    colors: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.2)]'
  },
]

interface DashboardStat { 
  label: string; 
  value: string | number; 
  icon: React.ElementType; 
  colors: string; 
  trend: string;
  desc: string;
  colorHex: string;
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
          className="fixed inset-0 z-[200] bg-surface-950/80 backdrop-blur-xl flex items-center justify-center pointer-events-none border-[12px] border-dashed border-primary-500/30"
        >
          <div className="text-center bg-surface-card p-20 rounded-[5rem] shadow-[0_100px_300px_rgba(0,0,0,0.8)] border-2 border-surface-100 dark:border-surface-800 relative overflow-hidden">
            <div className="absolute inset-0 bg-primary-500/5 animate-pulse" />
            <motion.div 
              animate={{ y: [0, -20, 0], rotate: [0, 10, -10, 0] }}
              transition={{ repeat: Infinity, duration: 3 }}
              className="w-40 h-40 rounded-[2.5rem] bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center mx-auto mb-10 shadow-2xl relative z-10"
            >
              <Box className="w-20 h-20 text-primary-600 dark:text-primary-400" />
            </motion.div>
            <h2 className="text-6xl font-black text-surface-900 dark:text-white tracking-tighter italic uppercase mb-6 relative z-10">Process Payload</h2>
            <p className="text-[14px] font-black text-primary-500 uppercase tracking-[0.8em] italic relative z-10">Neural analysis initializing...</p>
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

interface StyleInsight {
  source: 'user' | 'team' | 'defaults'
  totalPicks: number
  topPicks: {
    preset?: string | null
    captionStyle?: string | null
    hookStyle?: string | null
    colorGrade?: string | null
    transition?: string | null
    musicGenre?: string | null
    platform?: string | null
    publishHour?: string | null
    publishDay?: string | null
  }
  hint?: string | null
}

// Inline avatar + display-name editor for the dashboard header. The
// previous header showed a static shield icon and an unchangeable
// greeting; this lets the user upload an avatar and rename themselves
// without leaving the dashboard. Persists via PUT /auth/profile and
// POST /auth/avatar (the same endpoints the full settings page uses).
function EditableIdentity({
  initialName,
  initialAvatar,
  greeting,
  onUpdated,
}: {
  initialName: string
  initialAvatar: string | null
  greeting: string
  onUpdated: () => void
}) {
  const [name, setName] = useState(initialName)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatar)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(initialName)
  const [busy, setBusy] = useState<false | 'name' | 'avatar'>(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  // Re-sync if the parent auth state changes (e.g. after first load).
  useEffect(() => {
    setName(initialName)
    setDraft(initialName)
  }, [initialName])
  useEffect(() => {
    setAvatarUrl(initialAvatar)
  }, [initialAvatar])

  const toast = (message: string, type: 'success' | 'error' = 'success') => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('toast', { detail: { message, type } }))
    }
  }

  const initials =
    (name || 'C')
      .trim()
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'C'

  const saveName = async () => {
    const next = draft.trim()
    if (!next) {
      toast('Name cannot be empty.', 'error')
      return
    }
    if (next === name) {
      setEditing(false)
      return
    }
    setBusy('name')
    try {
      // `username` is the preferred-display-name column the dashboard
      // greeting actually reads from; `name` keeps the canonical full
      // name in sync so the rest of the app shows the same thing.
      await apiPut('/auth/profile', { name: next, username: next })
      setName(next)
      setEditing(false)
      toast('Name updated.')
      onUpdated()
    } catch (err: any) {
      toast(err?.response?.data?.error || "Couldn't update name.", 'error')
    } finally {
      setBusy(false)
    }
  }

  const onPickAvatar = () => fileRef.current?.click()

  const onAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!/^image\//.test(file.type)) {
      toast('Please pick an image file.', 'error')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast('Image must be under 5 MB.', 'error')
      return
    }
    // Optimistic preview from the local file so the change feels instant.
    const localUrl = URL.createObjectURL(file)
    setAvatarUrl(localUrl)
    setBusy('avatar')
    try {
      const form = new FormData()
      form.append('avatar', file)
      const res = await apiPost<{ avatar?: string }>(
        '/auth/avatar',
        form,
        { headers: { 'Content-Type': 'multipart/form-data' }, transformRequest: [(d: any) => d] } as any,
      )
      if (res?.avatar) setAvatarUrl(res.avatar)
      toast('Avatar updated.')
      onUpdated()
    } catch (err: any) {
      setAvatarUrl(initialAvatar)
      toast(err?.response?.data?.error || "Couldn't upload avatar.", 'error')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="flex items-center gap-8 w-full lg:w-auto min-w-0">
      <button
        type="button"
        onClick={onPickAvatar}
        disabled={busy === 'avatar'}
        title="Change profile picture"
        aria-label="Change profile picture"
        className="relative w-20 h-20 rounded-[2.5rem] bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center shadow-lg flex-shrink-0 overflow-hidden group hover:border-primary-500/60 transition-all"
      >
        {avatarUrl ? (
          /* Plain <img> is fine here — avatar URLs come from Cloudinary or
             a same-origin data URL; we don't need Next/Image optimisation. */
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="Your avatar" className="w-full h-full object-cover" />
        ) : (
          <span className="text-2xl font-black text-primary-600 dark:text-primary-400 tracking-tight">{initials}</span>
        )}
        <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {busy === 'avatar' ? (
            <RefreshCw size={20} className="text-white animate-spin" />
          ) : (
            <Camera size={20} className="text-white" />
          )}
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={onAvatarFile}
        aria-label="Upload new avatar"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-4 mb-2 flex-wrap">
          <span className="px-3 py-1 rounded-lg text-[10px] font-black bg-primary-500/10 text-primary-600 dark:text-primary-400 uppercase tracking-[0.2em] border-2 border-primary-500/20 italic leading-none">
            Click Terminal
          </span>
        </div>
        {editing ? (
          <div className="flex items-center gap-3 mt-3">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveName()
                if (e.key === 'Escape') { setDraft(name); setEditing(false) }
              }}
              autoFocus
              maxLength={40}
              className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter bg-transparent border-b-2 border-primary-500 outline-none px-2 py-1 text-surface-900 dark:text-white min-w-0 w-full max-w-xl"
              aria-label="Your display name"
            />
            <button
              type="button"
              onClick={saveName}
              disabled={busy === 'name'}
              title="Save name"
              aria-label="Save name"
              className="w-12 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-lg disabled:opacity-50"
            >
              {busy === 'name' ? <RefreshCw size={18} className="animate-spin" /> : <Check size={20} />}
            </button>
            <button
              type="button"
              onClick={() => { setDraft(name); setEditing(false) }}
              title="Cancel"
              aria-label="Cancel name edit"
              className="w-12 h-12 rounded-xl bg-surface-card border-2 border-surface-200 dark:border-surface-800 text-surface-500 hover:text-rose-500 flex items-center justify-center shadow-sm"
            >
              <XIcon size={20} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Click to edit your name"
            className="group/name flex items-center gap-3 text-left mt-3"
          >
            <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-black tracking-tighter leading-tight uppercase italic break-words">
              {greeting}, {name}
            </h1>
            <Pencil size={18} className="text-surface-300 dark:text-surface-700 group-hover/name:text-primary-500 transition-colors shrink-0" />
          </button>
        )}
      </div>
    </div>
  )
}

export default function NeuralDashboard() {
  const router = useRouter()
  const { user, refresh: refreshAuth } = useAuth() as any
  const { resolvedTheme, toggle } = useTheme()
  const { t } = useTranslation()
  const [stats, setStats] = useState<DashboardStat[]>([])
  const [apiStatus, setApiStatus] = useState<'online' | 'offline' | 'checking'>('checking')
  const [loading, setLoading] = useState(true)
  const [styleInsight, setStyleInsight] = useState<StyleInsight | null>(null)
  const [connections, setConnections] = useState<Record<string, boolean>>({})
  // Loose shape — backend response uses a handful of synonyms (totalEngagement vs
  // total_engagement vs totalLikes; same for shares). Optional everywhere so a
  // partial response renders zeroes instead of throwing.
  interface AnalyticsSummary {
    totalEngagement?: number
    total_engagement?: number
    totalLikes?: number
    totalShares?: number
    total_shares?: number
    totalDiffusion?: number
  }
  const [analyticsData, setAnalyticsData] = useState<AnalyticsSummary | null>(null)

  // Live time-aware greeting — re-evaluates every minute so the dashboard
  // updates without a reload when the user crosses a time-of-day boundary.
  const [hour, setHour] = useState(() => new Date().getHours())
  useEffect(() => {
    const id = setInterval(() => setHour(new Date().getHours()), 60_000)
    return () => clearInterval(id)
  }, [])
  const greeting =
    hour >= 5 && hour < 12 ? 'Good Morning' :
    hour >= 12 && hour < 17 ? 'Good Afternoon' :
    hour >= 17 && hour < 22 ? 'Good Evening' :
    'Good Night'
  // Prefer the user-chosen display name (`username`), then first name,
  // then email local-part, then "Creator". Trim + cap so any name length
  // renders without breaking the layout.
  const rawName =
    (user as any)?.username ||
    (user as any)?.first_name ||
    (user?.name && user.name.trim().split(/\s+/)[0]) ||
    (user as any)?.email?.split('@')[0] ||
    'Creator'
  const firstName = String(rawName).length > 24
    ? String(rawName).slice(0, 24) + '…'
    : String(rawName)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [health, analyticsRes, integrationsRes, insightRes, connectionsRes] = await Promise.allSettled([
        fetch('/api/health'),
        apiGet<any>('/analytics/dashboard'),
        apiGet<any>('/integrations'),
        apiGet<any>('/video/clips/style-insight'),
        apiGet<any>('/oauth/connections'),
      ])
      const insight = insightRes.status === 'fulfilled' ? (insightRes.value?.data ?? insightRes.value) : null
      if (insight && typeof insight === 'object') setStyleInsight(insight as StyleInsight)

      setApiStatus(health.status === 'fulfilled' && health.value.ok ? 'online' : 'offline')

      const analytics = analyticsRes.status === 'fulfilled' ? (analyticsRes.value?.data ?? analyticsRes.value) : null
      setAnalyticsData(analytics)

      const rawAccounts = connectionsRes.status === 'fulfilled'
        ? (connectionsRes.value?.accounts ?? connectionsRes.value?.data?.accounts ?? {})
        : {}
      const connMap: Record<string, boolean> = {}
      for (const [platform, val] of Object.entries(rawAccounts)) {
        connMap[platform] = val !== null && val !== undefined
      }
      setConnections(connMap)

      const integrations = integrationsRes.status === 'fulfilled' ? (integrationsRes.value?.data ?? integrationsRes.value) : []
      const integrationCount = Array.isArray(integrations?.integrations) ? integrations.integrations.length : 0

      setStats([
        {
          label: 'Reach',
          value: fmt(analytics?.totalViews),
          icon: Globe,
          colors: 'bg-primary-500/10 text-primary-600 dark:text-primary-400 border-primary-500/20',
          colorHex: '#6366f1',
          trend: 'Total impressions',
          desc: 'Total impressions across your accounts.'
        },
        {
          label: 'Engagement',
          value: fmt(analytics?.totalEngagement),
          icon: Zap,
          colors: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
          colorHex: '#f59e0b',
          trend: 'Likes, comments & shares',
          desc: 'Total likes, comments, and shares.'
        },
        {
          label: 'Published',
          value: analytics?.publishedPosts ?? 0,
          icon: Video,
          colors: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
          colorHex: '#f43f5e',
          trend: `${analytics?.totalPosts ?? 0} in pipeline`,
          desc: 'Posts that are live right now.'
        },
        {
          label: 'Connected',
          value: integrationCount,
          icon: Signal,
          colors: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
          colorHex: '#10b981',
          trend: integrationCount === 0 ? 'Action required' : 'All good',
          desc: 'Platforms actively connected.'
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

  if (loading) return (
     <div className="min-h-screen bg-surface-page transition-colors duration-500 px-4 sm:px-6 lg:px-12 pt-8 max-w-[1900px] mx-auto" aria-busy="true" aria-label="Loading dashboard">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
           {Array.from({ length: 4 }).map((_, i) => <StatsCardSkeleton key={i} />)}
        </div>
        <ContentSkeleton />
     </div>
  );

  return (
    <ErrorBoundary>
      <DropZoneOverlay />
      <SubscriptionBanner />
      <ToastContainer />

      <div className="min-h-screen relative z-10 pb-48 px-4 sm:px-6 lg:px-12 pt-8 max-w-[1900px] mx-auto space-y-12 bg-surface-page text-surface-900 dark:text-surface-50 transition-colors duration-500 font-inter overflow-x-hidden">
        
        {/* Header HUD */}
        <header className="flex flex-col lg:flex-row items-center justify-between gap-12 pb-10 border-b border-surface-100 dark:border-surface-800 relative z-50">
           <EditableIdentity
             initialName={firstName}
             initialAvatar={(user as any)?.avatar || null}
             greeting={greeting}
             onUpdated={refreshAuth}
           />

           <div className="flex flex-wrap items-center gap-6 justify-end w-full lg:w-auto">
               <div
                 title={`API ${apiStatus}`}
                 className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-card border-2 border-surface-100 dark:border-surface-800 text-[10px] font-black italic shadow-inner ${apiStatus === 'online' ? 'text-emerald-500' : 'text-rose-500'}`}
               >
                 <span className={`w-2 h-2 rounded-full ${apiStatus === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 animate-pulse'}`} />
                 {apiStatus.toUpperCase()}
               </div>
               <button type="button" onClick={toggle} title="Toggle Theme" aria-label="Toggle Theme" className="w-16 h-16 rounded-[1.8rem] bg-surface-card border-2 border-surface-100 dark:border-surface-800 flex items-center justify-center text-surface-400 hover:text-surface-900 dark:hover:text-white transition-all shadow-xl active:scale-90 border-none">
                 {resolvedTheme === 'dark' ? <Sun size={28} /> : <Moon size={28} />}
               </button>
              <Link href="/dashboard/settings" className="w-16 h-16 rounded-[1.8rem] bg-surface-card border-2 border-surface-100 dark:border-surface-800 flex items-center justify-center text-surface-400 hover:text-surface-900 dark:hover:text-white transition-all shadow-xl active:scale-90">
                <Settings size={28} />
              </Link>
               <button type="button" onClick={fetchData} title="Refresh data" aria-label="Refresh data" className="px-10 py-5 bg-surface-900 dark:bg-white text-white dark:text-black font-black uppercase text-[11px] tracking-[0.6em] italic rounded-2xl hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white transition-all shadow-2xl active:scale-95 flex items-center gap-4 group border-none">
                 <RefreshCw size={22} className={loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'} />
                 {loading ? 'Refreshing…' : 'Refresh'}
               </button>
           </div>
        </header>

        <div data-focus-secondary>
          <AILearningIndicator />
        </div>

        {Object.values(connections).every((v) => !v) && (
          <Link
            href="/dashboard/social"
            className="block bg-amber-500/10 dark:bg-amber-500/15 border-2 border-amber-500/40 hover:border-amber-500/70 rounded-[2.5rem] p-8 sm:p-10 shadow-xl transition-all hover:-translate-y-1 group"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-10">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border-2 border-amber-500/40 flex items-center justify-center shrink-0">
                <Share2 size={32} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] italic text-amber-600 dark:text-amber-400 mb-2">Setup required</p>
                <h2 className="text-xl sm:text-2xl font-black text-surface-900 dark:text-white tracking-tight leading-tight">
                  Connect your social accounts to publish from Click
                </h2>
                <p className="text-sm text-surface-500 dark:text-slate-400 mt-2 leading-relaxed">
                  TikTok, Instagram, YouTube, X, LinkedIn, Facebook — link them once and Click can post, schedule, and analyze on your behalf.
                </p>
              </div>
              <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-amber-500 text-white font-bold text-sm whitespace-nowrap shadow-lg group-hover:bg-amber-600 transition-colors">
                Connect now <ArrowRight size={18} />
              </div>
            </div>
          </Link>
        )}

        {/* Dashboard Content Lattice */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-12 relative z-10">
          
          {/* Main Telemetry & Intelligence */}
          <div className="xl:col-span-8 space-y-12">
            
            {/* Spectral Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((s, i) => (
                <motion.div key={i} whileHover={{ y: -10, scale: 1.02 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                  className="bg-surface-card backdrop-blur-3xl border-2 border-surface-100 dark:border-surface-800 p-8 rounded-[3rem] shadow-2xl transition-all duration-500 hover:shadow-[0_40px_80px_rgba(0,0,0,0.4)] group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none group-hover:opacity-[0.08] transition-opacity duration-1000"><s.icon size={150} style={{ color: s.colorHex }} /></div>
                  <div className={`w-14 h-14 rounded-2xl ${s.colors} border-2 flex items-center justify-center mb-8 shadow-lg group-hover:rotate-12 transition-transform duration-500`}>
                    <s.icon size={28} />
                  </div>
                  <p className="text-[10px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-[0.4em] italic mb-3 leading-none">{s.label}</p>
                  <h4 className="text-4xl font-black text-surface-900 dark:text-white tracking-tighter mb-4 italic tabular-nums leading-none">{s.value}</h4>
                  <div className="flex items-center gap-3 pt-6 border-t-2 border-surface-100 dark:border-surface-800">
                    <Activity size={16} className="text-primary-500" />
                    <span className="text-[10px] font-black text-primary-500/80 dark:text-primary-400/60 uppercase tracking-widest italic">{s.trend}</span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Neural Performance Center */}
            <section className="bg-surface-card backdrop-blur-3xl border-2 border-surface-100 dark:border-surface-800 rounded-[4rem] p-10 sm:p-14 shadow-2xl relative overflow-hidden group transition-all duration-500 hover:shadow-[0_80px_150px_rgba(0,0,0,0.5)]">
              <div className="absolute top-0 right-0 p-20 opacity-[0.02] pointer-events-none group-hover:opacity-[0.08] transition-opacity duration-1000"><Brain size={400} className="text-primary-500" /></div>
              
              <div className="flex flex-col sm:flex-row sm:items-center gap-10 mb-16 relative z-10">
                <div className="w-20 h-20 rounded-[2.5rem] bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center shadow-2xl group-hover:rotate-12 transition-transform duration-500">
                  <Monitor size={40} className="text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <h2 className="text-4xl font-black text-surface-900 dark:text-white tracking-tighter italic uppercase leading-none mb-3">Performance Matrix</h2>
                  <p className="text-[11px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-[0.5em] italic">AUTONOMOUS_NEURAL_DIAGNOSTICS_ENABLED</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
                <div className="p-10 rounded-[3rem] bg-surface-page/50 dark:bg-surface-950/40 border-2 border-surface-100 dark:border-surface-800 space-y-6 shadow-inner group/card hover:bg-surface-card transition-all duration-700 backdrop-blur-2xl">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-xl bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center"><Fingerprint size={24} className="text-primary-600 dark:text-primary-400" /></div>
                    <span className="text-lg font-black text-surface-900 dark:text-white italic uppercase tracking-tighter">Synthetic Insight</span>
                    {styleInsight && (
                      <span className="ml-auto text-[9px] font-black uppercase tracking-[0.3em] text-primary-500 dark:text-primary-400 bg-primary-500/5 px-3 py-1 rounded-lg border-2 border-primary-500/20 shadow-sm italic leading-none">
                        {styleInsight.source === 'user' ? 'USER_CORE' : styleInsight.source === 'team' ? 'TEAM_MESH' : 'STARTER_LATTICE'}
                      </span>
                    )}
                  </div>
                  <p className="text-base font-bold text-surface-500 dark:text-slate-400 leading-relaxed italic uppercase tracking-tight">
                    {(() => {
                      if (!styleInsight || styleInsight.totalPicks === 0) {
                        return 'Publish your first 3 clips and Click will start surfacing your learned style here — top hooks, color grades, and best publish hours.'
                      }
                      const top = styleInsight.topPicks || {}
                      const parts: string[] = []
                      if (top.preset) parts.push(<>top preset is <span key="p" className="text-primary-500 dark:text-primary-400 font-black">{top.preset.toUpperCase()}</span></> as any)
                      if (top.hookStyle) parts.push(<>hooks lean <span key="h" className="text-primary-500 dark:text-primary-400 font-black">{top.hookStyle.toUpperCase()}</span></> as any)
                      if (top.publishHour) parts.push(<>best ship hour <span key="t" className="text-primary-500 dark:text-primary-400 font-black">{top.publishHour}:00</span></> as any)
                      if (parts.length === 0) return styleInsight.hint || 'Click is learning your style — publish more clips to refine.'
                      return (
                        <>
                          Detected resonance in <span className="text-primary-500 dark:text-primary-400 font-black">{styleInsight.totalPicks}</span> payloads: {parts.map((p, i) => (
                            <span key={i}>{i > 0 ? (i === parts.length - 1 ? ', and ' : ', ') : ''}{p as any}</span>
                          ))}.
                        </>
                      ) as any
                    })()}
                  </p>
                  <Link href="/dashboard/forge" className="inline-flex items-center gap-4 text-[10px] font-black text-primary-600 dark:text-primary-400 hover:text-primary-500 transition-all uppercase tracking-[0.6em] italic mt-6 border-none">
                    {styleInsight && styleInsight.totalPicks > 0 ? 'ACCESS_ARCHIVE' : 'INITIALIZE_FORGE'} <ArrowRight size={18} className="group-hover/card:translate-x-3 transition-transform duration-500" />
                  </Link>
                </div>

                <div className="p-10 rounded-[3rem] bg-surface-page/50 dark:bg-surface-950/40 border-2 border-surface-100 dark:border-surface-800 space-y-6 shadow-inner group/card hover:bg-surface-card transition-all duration-700 backdrop-blur-2xl">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border-2 border-emerald-500/20 flex items-center justify-center"><Target size={24} className="text-emerald-600 dark:text-emerald-400" /></div>
                    <span className="text-lg font-black text-surface-900 dark:text-white italic uppercase tracking-tighter">Audience Peak</span>
                    {styleInsight?.topPicks?.publishHour != null && (
                      <span className="ml-auto text-[9px] font-black uppercase tracking-[0.3em] text-emerald-500 bg-emerald-500/5 px-3 py-1 rounded-lg border-2 border-emerald-500/20 shadow-sm italic leading-none">LEARNED</span>
                    )}
                  </div>
                  <p className="text-base font-bold text-surface-500 dark:text-slate-400 leading-relaxed italic uppercase tracking-tight">
                    {styleInsight?.topPicks?.publishHour != null
                      ? <>Based on your published clips, engagement is strongest around <strong className="text-emerald-500">{styleInsight.topPicks.publishHour}:00</strong>.</>
                      : 'Publish more clips and Click will learn the publish hours that perform best for your audience.'}
                  </p>
                  <Link href="/dashboard/scheduler" className="inline-flex items-center gap-4 text-[10px] font-black text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 transition-all uppercase tracking-[0.6em] italic mt-6 border-none">
                    Open <ArrowRight size={18} className="group-hover/card:translate-x-3 transition-transform duration-500" />
                  </Link>
                </div>
              </div>

              <div className="mt-16 pt-10 border-t-2 border-surface-100 dark:border-surface-800 flex flex-col sm:flex-row items-center justify-between gap-8 relative z-10">
                <div className="flex items-center gap-10">
                  <div className="flex items-center gap-4">
                    <div className="w-3 h-3 rounded-full bg-primary-500 shadow-[0_0_15px_rgba(99,102,241,0.8)] animate-pulse" />
                    <span className="text-[11px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-[0.6em] italic leading-none">Neural_Core: ACTIVE</span>
                  </div>
                  <div className="flex items-center gap-4 border-l-2 border-surface-100 dark:border-surface-800 pl-10">
                    <Clock size={20} className="text-surface-300 dark:text-slate-800" />
                    <span className="text-[11px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-[0.6em] italic leading-none">SYNCHRONIZED_NOW</span>
                  </div>
                </div>
                <div className="flex -space-x-4">
                   {Array.from({ length: 4 }).map((_, i) => (
                     <div key={i} className="w-12 h-12 rounded-xl bg-surface-card border-2 border-surface-100 dark:border-surface-800 flex items-center justify-center shadow-lg transition-transform hover:translate-y-[-10px] cursor-pointer">
                        <Star size={18} className="text-amber-500" />
                     </div>
                   ))}
                </div>
              </div>
            </section>
          </div>

          {/* Right Column: Tactical Launch HUD */}
          <aside className="xl:col-span-4 space-y-12">
            
            <div className="bg-surface-card backdrop-blur-3xl border-2 border-surface-100 dark:border-surface-800 rounded-[3.5rem] p-10 sm:p-12 shadow-2xl transition-all duration-500 group/nav hover:shadow-[0_80px_150px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-6 mb-12 border-b-2 border-surface-100 dark:border-surface-800 pb-8">
                <div className="w-16 h-16 rounded-[1.8rem] bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center shadow-xl group-hover/nav:rotate-12 transition-transform duration-500">
                  <LayoutGrid size={32} className="text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                   <h3 className="text-3xl font-black text-surface-900 dark:text-white tracking-tighter italic uppercase leading-none">Tactical Launch</h3>
                   <p className="text-[10px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-[0.5em] italic mt-2">DEPLOY_ASSET_MATRIX</p>
                </div>
              </div>

              <div className="space-y-6">
                {DASHBOARD_NAV.map((act) => (
                  <Link
                    key={act.key}
                    href={act.href}
                    className="flex items-start gap-6 p-6 rounded-[2.5rem] bg-surface-page/50 dark:bg-surface-950/40 border-2 border-surface-100 dark:border-surface-800 hover:border-primary-500/40 hover:bg-surface-card transition-all duration-700 group/item shadow-inner backdrop-blur-2xl"
                  >
                    <div className={`w-14 h-14 shrink-0 rounded-[1.5rem] ${act.colors} border-2 flex items-center justify-center group-hover/item:rotate-12 group-hover/item:scale-110 transition-all duration-500 shadow-lg`}>
                      <act.icon size={26} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-4 mb-2 flex-wrap">
                        <h4 className="text-lg font-black text-surface-900 dark:text-white italic uppercase tracking-tighter group-hover/item:text-primary-500 transition-colors leading-none">{t(`dashboard.nav.${act.key}.label`)}</h4>
                        <span className="text-[9px] font-black uppercase tracking-[0.3em] px-3 py-1 rounded-lg bg-surface-card dark:bg-surface-900 text-surface-500 dark:text-slate-500 border-2 border-surface-100 dark:border-surface-800 shadow-inner italic leading-none">
                          {t(`dashboard.nav.${act.key}.badge`)}
                        </span>
                      </div>
                      <p className="text-[11px] font-bold text-surface-400 dark:text-slate-600 italic line-clamp-2 leading-relaxed uppercase tracking-tight opacity-60 group-hover/item:opacity-100 transition-opacity">
                        {t(`dashboard.nav.${act.key}.desc`)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Platform Substrate Sync */}
            <div data-focus-secondary className="bg-surface-card backdrop-blur-3xl border-2 border-surface-100 dark:border-surface-800 rounded-[3.5rem] p-10 sm:p-12 shadow-2xl transition-all duration-500 group/mesh hover:shadow-[0_80px_150px_rgba(0,0,0,0.5)]">
              <div className="flex items-center justify-between mb-10 border-b-2 border-surface-100 dark:border-surface-800 pb-6">
                 <h3 className="text-[11px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-[0.8em] italic leading-none">Spectral Mesh</h3>
                 <div className="flex items-center gap-3">
                    <Signal size={14} className="text-emerald-500 animate-pulse" />
                    <span className="text-[9px] font-black text-emerald-500 uppercase italic">ACTIVE</span>
                 </div>
              </div>
              <div className="space-y-8">
                {(['tiktok', 'instagram', 'youtube', 'twitter'] as const).map((p) => {
                  const isLinked = connections[p] === true
                  return (
                    <div key={p} className="flex items-center justify-between group/p">
                      <div className="flex items-center gap-6">
                        <div className="w-12 h-12 rounded-2xl bg-surface-page dark:bg-surface-950 flex items-center justify-center text-surface-300 dark:text-slate-800 border-2 border-surface-100 dark:border-surface-800 shadow-inner group-hover/p:bg-primary-500/10 group-hover/p:text-primary-500 group-hover/p:border-primary-500/30 transition-all duration-500 group-hover/p:scale-110 group-hover/p:rotate-12 text-2xl font-black italic">
                          {p === 'tiktok' ? '♪' : p === 'instagram' ? '◈' : p === 'youtube' ? '▶' : '𝕏'}
                        </div>
                        <span className="text-base font-black text-surface-900 dark:text-white uppercase italic tracking-tighter group-hover/p:text-primary-500 transition-colors">{p}</span>
                      </div>
                      {isLinked ? (
                        <div className="flex items-center gap-4 px-4 py-1.5 rounded-xl bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 shadow-inner">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)] animate-pulse" />
                          <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.3em] italic">LINKED</span>
                        </div>
                      ) : (
                        <Link href="/dashboard/social" className="flex items-center gap-4 px-4 py-1.5 rounded-xl bg-surface-page dark:bg-surface-950 border-2 border-amber-500/40 shadow-inner hover:bg-amber-500/10 transition-colors group/badge">
                          <div className="w-2 h-2 rounded-full bg-amber-500" />
                          <span className="text-[9px] font-black text-amber-500 uppercase tracking-[0.3em] italic group-hover/badge:text-amber-400">CONNECT</span>
                        </Link>
                      )}
                    </div>
                  )
                })}
              </div>
              <Link href="/dashboard/social" className="mt-12 block text-center py-6 rounded-[2rem] bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 text-[11px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-[0.6em] italic hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white hover:border-none transition-all shadow-inner active:scale-95 group-hover/mesh:-translate-y-2">
                Manage Substrates
              </Link>
            </div>

            {/* Quick Metrics HUD */}
            <div className="grid grid-cols-2 gap-8">
               <div className="p-8 rounded-[2.5rem] bg-surface-card border-2 border-surface-100 dark:border-surface-800 shadow-xl flex flex-col items-center gap-4 group hover:border-primary-500/30 transition-all border-none">
                  <div className="w-12 h-12 rounded-xl bg-violet-500/10 border-2 border-violet-500/20 flex items-center justify-center text-violet-500 group-hover:rotate-12 transition-transform"><Heart size={24} /></div>
                  <div className="text-center">
                     <p className="text-2xl font-black italic tabular-nums text-surface-900 dark:text-white leading-none">
                       {analyticsData ? fmt(analyticsData?.totalEngagement ?? analyticsData?.total_engagement ?? analyticsData?.totalLikes ?? 0) : '—'}
                     </p>
                     <p className="text-[8px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-widest mt-1">AFFINITY</p>
                  </div>
               </div>
               <div className="p-8 rounded-[2.5rem] bg-surface-card border-2 border-surface-100 dark:border-surface-800 shadow-xl flex flex-col items-center gap-4 group hover:border-primary-500/30 transition-all border-none">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border-2 border-cyan-500/20 flex items-center justify-center text-cyan-500 group-hover:rotate-12 transition-transform"><Share2 size={24} /></div>
                  <div className="text-center">
                     <p className="text-2xl font-black italic tabular-nums text-surface-900 dark:text-white leading-none">
                       {analyticsData ? fmt(analyticsData?.totalShares ?? analyticsData?.total_shares ?? analyticsData?.totalDiffusion ?? 0) : '—'}
                     </p>
                     <p className="text-[8px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-widest mt-1">DIFFUSION</p>
                  </div>
               </div>
            </div>
          </aside>
        </div>

        {/* Global Persistence Shortcuts */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-10 relative z-10 pt-12">
          {[
            { label: 'Neural Forge', desc: 'Synthetic logic payload crafting.', icon: Sparkles, href: '/dashboard/forge', color: 'text-indigo-600 dark:text-indigo-400' },
            { label: 'Spectral Sync', desc: 'Detailed performance diagnostics.', icon: BarChart3, href: '/dashboard/analytics', color: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Sovereign Hub', desc: 'Manage mission swarm & nodes.', icon: Users, href: '/dashboard/teams', color: 'text-rose-600 dark:text-rose-400' },
          ].map((a, i) => (
            <motion.button key={a.label} whileHover={{ y: -15, scale: 1.02 }} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              onClick={() => router.push(a.href)}
              className="bg-surface-card backdrop-blur-3xl p-10 rounded-[3.5rem] text-center flex flex-col items-center gap-8 border-2 border-surface-100 dark:border-surface-800 hover:border-primary-500/40 shadow-2xl group transition-all duration-500 active:scale-95 border-none"
            >
              <div className="w-20 h-20 bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 rounded-[2rem] flex items-center justify-center shadow-inner group-hover:rotate-12 transition-all duration-700">
                <a.icon size={36} className={a.color} />
              </div>
              <div>
                <h4 className="text-3xl font-black text-surface-900 dark:text-white italic uppercase tracking-tighter mb-3 leading-none">{a.label}</h4>
                <p className="text-[12px] text-surface-400 dark:text-slate-500 font-black uppercase tracking-[0.4em] italic leading-relaxed px-6">{a.desc}</p>
              </div>
              <div className="mt-4 flex items-center gap-6 text-[10px] font-black text-primary-500 uppercase tracking-[0.8em] italic group-hover:gap-10 transition-all duration-1000">
                 INITIATE <ArrowRight size={20} />
              </div>
            </motion.button>
          ))}
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
