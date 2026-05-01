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
  Sparkle, Command, Hammer, Plug, LayoutGrid, BarChart3, Users, Clock
} from 'lucide-react'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import ToastContainer from '../../components/ToastContainer'
import SubscriptionBanner from '../../components/SubscriptionBanner'
import { validateFile } from '../../utils/fileValidator'
import { useTheme } from '../../components/ThemeProvider'

const glassStyle = 'backdrop-blur-3xl bg-white/[0.02] border border-white/5 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] transition-all duration-500'

const DASHBOARD_NAV = [
  { 
    label: 'One-Click Forge', 
    desc: 'Instantly transform raw footage into viral short-form packs with AI.',  
    icon: Hammer,   
    href: '/dashboard/forge',         
    badge: 'AI ENGINE',
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10'
  },
  { 
    label: 'Neural Video Studio',    
    desc: 'Advanced timeline editor with AI-powered cuts, captions, and b-roll.',        
    icon: Video,    
    href: '/dashboard/video',         
    badge: 'ADVANCED',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10'
  },
  { 
    label: 'Script Architect',         
    desc: 'Generate high-retention scripts for TikTok, Reels, and YouTube Shorts.',    
    icon: FileText, 
    href: '/dashboard/scripts',       
    badge: 'AI WRITER',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10'
  },
  { 
    label: 'Global Scheduler',       
    desc: 'Coordinate and automate your content distribution across all platforms.',      
    icon: Send,     
    href: '/dashboard/scheduler',     
    badge: 'SYNCED',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10'
  },
  { 
    label: 'Market Discover',        
    desc: 'Uncover trending hooks, viral sounds, and industry-leading formats.',  
    icon: Flame,    
    href: '/dashboard/trends',        
    badge: 'LIVE',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10'
  },
  { 
    label: 'Platform Vault',    
    desc: 'Manage and connect your TikTok, Instagram, YouTube, and X accounts.', 
    icon: Plug,     
    href: '/dashboard/integrations',  
    badge: 'SECURE',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10'
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
          color: 'text-indigo-400',
          bg: 'bg-indigo-500/10',
          trend: '+12.5% this week',
          desc: 'Total impressions across all synchronized platforms.'
        },
        {
          label: 'Engagement Depth',
          value: fmt(analytics?.totalEngagement),
          icon: Zap,
          color: 'text-amber-400',
          bg: 'bg-amber-500/10',
          trend: 'High resonance detected',
          desc: 'Total likes, comments, and shares across your network.'
        },
        {
          label: 'Active Content',
          value: analytics?.publishedPosts ?? 0,
          icon: Video,
          color: 'text-rose-400',
          bg: 'bg-rose-500/10',
          trend: `${analytics?.totalPosts ?? 0} in pipeline`,
          desc: 'Live posts currently driving traffic to your brand.'
        },
        {
          label: 'Neural Nodes',
          value: integrationCount,
          icon: Signal,
          color: 'text-emerald-400',
          bg: 'bg-emerald-500/10',
          trend: integrationCount === 0 ? 'Action required' : 'Sync stable',
          desc: 'Number of connected social platforms in your ecosystem.'
        }
      ])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <ErrorBoundary>
      <DropZoneOverlay />
      <SubscriptionBanner />
      <ToastContainer />

      <div className="min-h-screen relative z-10 pb-32 px-6 lg:px-12 pt-12 max-w-[1900px] mx-auto space-y-12 overflow-x-hidden font-inter">
        
        {/* Background Atmosphere */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-[0.04]">
          <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-500 rounded-full blur-[160px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-purple-500 rounded-full blur-[160px]" />
          <LayoutGrid className="absolute top-20 left-20 w-full h-full opacity-10" size={1200} />
        </div>

        {/* Header HUD */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-50">
          <div className="flex items-center gap-8">
            <div className="w-20 h-20 bg-indigo-500/10 border-2 border-indigo-500/20 rounded-3xl flex items-center justify-center shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <ShieldCheck size={40} className="text-indigo-400 relative z-10 group-hover:scale-110 transition-transform" />
            </div>
            <div>
              <div className="flex items-center gap-4 mb-2">
                <span className="text-[11px] font-black uppercase tracking-[0.4em] text-indigo-400/80 italic">Click Ecosystem v4.0</span>
                <div className={`px-3 py-1 rounded-full text-[9px] font-bold border flex items-center gap-2 ${apiStatus === 'online' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                  <div className={`w-2 h-2 rounded-full ${apiStatus === 'online' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-rose-400 animate-pulse'}`} />
                  {apiStatus.toUpperCase()}
                </div>
              </div>
              <h1 className="text-5xl lg:text-6xl font-black text-white tracking-tight leading-none mb-3">
                {greeting}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/40">{firstName}</span>
              </h1>
              <p className="text-slate-400 text-sm lg:text-base font-medium max-w-xl opacity-80 leading-relaxed">
                Welcome to your neural command center. Track your growth, refine your strategy, and launch viral content across the social mesh.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/dashboard/settings" className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:border-white/20 transition-all hover:scale-105">
              <Settings size={22} />
            </Link>
            <button onClick={fetchData} className="px-6 py-3 bg-white text-black rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all shadow-xl active:scale-95 flex items-center gap-3">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> SYNC DATA
            </button>
          </div>
        </header>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
          
          {/* Left Column: Stats & Main Activity */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Metric Tiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {stats.map((s, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ y: -8, scale: 1.02 }}
                  className={`${glassStyle} p-6 rounded-[2.5rem] relative overflow-hidden group hover:bg-white/[0.04]`}
                >
                  <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.1] transition-opacity pointer-events-none group-hover:rotate-12">
                    <s.icon size={120} />
                  </div>
                  <div className={`w-12 h-12 rounded-2xl ${s.bg} flex items-center justify-center mb-4 border border-white/5`}>
                    <s.icon className={`${s.color}`} size={24} />
                  </div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 italic opacity-60">{s.label}</p>
                  <h4 className="text-3xl font-black text-white tracking-tighter mb-2 italic tabular-nums">{s.value}</h4>
                  <div className="flex items-center gap-2">
                    <ActivitySquare size={12} className="text-indigo-400/60" />
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{s.trend}</span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Performance Nerve Center */}
            <div className={`${glassStyle} rounded-[3rem] p-8 lg:p-10 relative overflow-hidden bg-black/40 min-h-[400px] flex flex-col justify-between group`}>
              <div className="absolute top-0 right-0 p-12 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity pointer-events-none scale-150 rotate-45">
                <BarChart3 size={400} />
              </div>
              
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border-2 border-indigo-500/20 flex items-center justify-center">
                    <Gauge size={30} className="text-indigo-400 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-white tracking-tight">Performance Nerve Center</h2>
                    <p className="text-xs font-medium text-slate-400 tracking-wide mt-1">Real-time health and growth trajectory analysis.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-4 hover:bg-white/[0.04] transition-colors group/card">
                    <div className="flex items-center gap-3">
                      <Brain size={20} className="text-indigo-400" />
                      <span className="text-sm font-bold text-white">AI Strategy Insight</span>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed opacity-80">
                      Our neural model predicts a 14% increase in retention if you utilize <span className="text-white">Pattern-Interrupt</span> hooks in your next 3 videos.
                    </p>
                    <Link href="/dashboard/scripts" className="inline-flex items-center gap-2 text-[11px] font-bold text-indigo-400 uppercase tracking-widest hover:text-white transition-colors">
                      Optimize Scripts <ArrowRight size={14} />
                    </Link>
                  </div>

                  <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-4 hover:bg-white/[0.04] transition-colors group/card">
                    <div className="flex items-center gap-3">
                      <Users size={20} className="text-emerald-400" />
                      <span className="text-sm font-bold text-white">Audience Sync</span>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed opacity-80">
                      Your synchronized platforms are currently reaching <span className="text-white">Global Phase 2</span> saturation. Engagement is peak at 19:00 UTC.
                    </p>
                    <Link href="/dashboard/scheduler" className="inline-flex items-center gap-2 text-[11px] font-bold text-emerald-400 uppercase tracking-widest hover:text-white transition-colors">
                      Open Scheduler <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-white/5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Core Engine Stable</span>
                  </div>
                  <div className="flex items-center gap-3 border-l border-white/10 pl-6">
                    <Clock size={12} className="text-slate-500" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Sync: 2ms ago</span>
                  </div>
                </div>
                <div className="flex -space-x-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-black bg-slate-800 flex items-center justify-center overflow-hidden">
                      <div className="w-full h-full bg-gradient-to-br from-indigo-500/20 to-indigo-900/40" />
                    </div>
                  ))}
                  <div className="w-8 h-8 rounded-full border-2 border-black bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-white shadow-lg">
                    +12
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Quick Launch & Actions */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* Quick Launch Hub */}
            <div className={`${glassStyle} rounded-[3rem] p-8 lg:p-10 relative overflow-hidden bg-black/60 group`}>
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border-2 border-amber-500/20 flex items-center justify-center">
                  <Zap size={26} className="text-amber-400" />
                </div>
                <h3 className="text-2xl font-black text-white tracking-tight">Quick Launch Hub</h3>
              </div>

              <div className="space-y-4">
                {DASHBOARD_NAV.map((act, i) => (
                  <Link 
                    key={i} 
                    href={act.href} 
                    className={`${glassStyle} block p-5 rounded-3xl hover:bg-white/[0.04] group/nav border-white/5 hover:border-white/20`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-10 h-10 rounded-xl ${act.bg} flex items-center justify-center group-hover/nav:scale-110 transition-transform`}>
                        <act.icon className={`${act.color}`} size={18} />
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-full bg-white/5 text-slate-400 border border-white/5">
                        {act.badge}
                      </span>
                    </div>
                    <h4 className="text-base font-black text-white tracking-tight mb-1 group-hover/nav:translate-x-1 transition-transform">{act.label}</h4>
                    <p className="text-xs text-slate-400 font-medium leading-relaxed opacity-70 group-hover/nav:opacity-100 transition-opacity">
                      {act.desc}
                    </p>
                  </Link>
                ))}
              </div>
            </div>

            {/* Platform Status */}
            <div className={`${glassStyle} rounded-[3rem] p-8 bg-indigo-500/5 border-indigo-500/20 shadow-inner group`}>
              <h3 className="text-lg font-black text-white uppercase tracking-widest mb-6 italic opacity-80">Platform Status</h3>
              <div className="space-y-6">
                {['tiktok', 'instagram', 'youtube', 'twitter'].map((p, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 border border-white/5">
                        {p === 'tiktok' ? '♪' : p === 'instagram' ? '◎' : p === 'youtube' ? '▶' : '𝕏'}
                      </div>
                      <span className="text-sm font-bold text-white capitalize">{p}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Stable</span>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/dashboard/integrations" className="mt-8 block text-center py-4 rounded-2xl bg-white/[0.03] border border-white/5 text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] hover:bg-white/[0.06] transition-all">
                MANAGE CONNECTIONS
              </Link>
            </div>
          </div>
        </div>

        {/* Global Footer Overlay */}
        <div className="fixed bottom-8 right-8 z-[150]">
          <Link 
            href="/dashboard/forge" 
            className="flex items-center gap-4 px-8 py-5 bg-white text-black rounded-full font-black text-sm uppercase tracking-widest shadow-[0_32px_64px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 transition-all group"
          >
            <Hammer size={20} className="group-hover:rotate-12 transition-transform" /> 
            Open One-Click Forge
          </Link>
        </div>

        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { 
            font-family: 'Inter', sans-serif; 
            background: #020205; 
            color: white; 
            overflow-x: hidden; 
          }
          ::selection {
            background: rgba(99, 102, 241, 0.4);
            color: white;
          }
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
