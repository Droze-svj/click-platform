'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '../contexts/ToastContext'
import { useSocket } from '../hooks/useSocket'
import { useAuth } from '../hooks/useAuth'
import { apiGet } from '../lib/api'
import {
  Activity,
  TrendingUp,
  Target,
  AlertCircle,
  CheckCircle2,
  BarChart3,
  Calendar,
  Zap,
  RefreshCw,
  Lightbulb,
  Award,
  TrendingDown,
  Sparkles,
  ShieldCheck,
  ZapOff,
  BrainCircuit,
  Orbit,
  ArrowUpRight,
  MousePointer2,
  Cpu,
  Fingerprint,
  Radio,
  Lock,
  Layers,
  Activity as ActivityIcon,
  Filter,
  Eye,
  Settings,
  UserPlus
} from 'lucide-react'
import TeamPresence from './TeamPresence'
import RealTimeActivityTicker from './RealTimeActivityTicker'
import CollaborativeComments from './CollaborativeComments'

const calculateGrade = (score: number) => {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

// --- Types ---
interface HealthMetric {
  overall: {
    grade: string
    score: number
  }
  metrics: Record<string, number>
  gaps: { recommendation: string }[]
}

interface PlanItem {
  day: string
  content: {
    title: string
    type: string
  }
  goal: string
}

interface NextWeekData {
  goal: string
  gap: number
  weeklyPlan: PlanItem[]
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

// Animation Variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 100, damping: 20 }
  }
}

const glassStyle = "backdrop-blur-[40px] bg-white/[0.03] border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.8)]"

export default function AIContentOperationsDashboard() {
  const [refreshRecs, setRefreshRecs] = useState<any[]>([])
  const [contentId, setContentId] = useState<string | null>(null)
  const [teamId, setTeamId] = useState<string | null>(null)
  const [directiveClaims, setDirectiveClaims] = useState<Record<string, any>>({})
  const [trends, setTrends] = useState<any[]>([])
  const [competitors, setCompetitors] = useState<any[]>([])
  const [predictedGaps, setPredictedGaps] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [isAutoLoopActive, setIsAutoLoopActive] = useState(true)
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [repairLogs, setRepairLogs] = useState<string[]>([])
  const [showRepairLogs, setShowRepairLogs] = useState(false)
  const [activeThought, setActiveThought] = useState('')
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [selectedPlatform, setSelectedPlatform] = useState('twitter')
  const [healthCheck, setHealthCheck] = useState<HealthMetric | null>(null)
  const [benchmarks, setBenchmarks] = useState<any>(null)
  const [nextWeek, setNextWeek] = useState<NextWeekData | null>(null)
  const { showToast } = useToast()
  const { socket, connected, on, off } = useSocket()
  const { user } = useAuth()

  const platformThemes: Record<string, { accent: string, glow: string, bg: string, accentHex: string }> = {
    twitter: { accent: 'indigo-500', glow: 'rgba(99,102,241,0.4)', bg: 'from-indigo-600/10', accentHex: '#6366f1' },
    linkedin: { accent: 'blue-500', glow: 'rgba(59,130,246,0.4)', bg: 'from-blue-600/10', accentHex: '#3b82f6' },
    facebook: { accent: 'blue-600', glow: 'rgba(37,99,235,0.4)', bg: 'from-blue-700/10', accentHex: '#2563eb' },
    instagram: { accent: 'fuchsia-500', glow: 'rgba(217,70,239,0.4)', bg: 'from-fuchsia-600/10', accentHex: '#d946ef' },
    youtube: { accent: 'rose-600', glow: 'rgba(225,29,72,0.4)', bg: 'from-rose-700/10', accentHex: '#e11d48' },
    tiktok: { accent: 'cyan-400', glow: 'rgba(34,211,238,0.4)', bg: 'from-cyan-500/10', accentHex: '#22d3ee' }
  }

  const currentTheme = platformThemes[selectedPlatform] || platformThemes.twitter

  const aiThoughts = [
    "Neural latency optimized. Signal clear.",
    "Cross-platform parity verified at 98.4%.",
    "Viral coefficient projecting 4.2x surge.",
    "Ecosystem entropy reduced. Integrity stable.",
    "Autonomous loop: Executing high-yield protocols.",
    "B-roll clusters synced with audience pulse.",
    "Strategic telemetry ingested. Re-routing vectors."
  ]

  useEffect(() => {
    const thoughtInterval = setInterval(() => {
      setActiveThought(aiThoughts[Math.floor(Math.random() * aiThoughts.length)])
    }, 8000)
    return () => clearInterval(thoughtInterval)
  }, [])

  const claimDirective = async (directiveId: string) => {
    if (!socket || !teamId || !user) return

    socket.emit('directive:claim', {
      teamId,
      directiveId,
      userName: user.name
    })

    socket.emit('activity:pulse', {
      teamId,
      pulse: {
        userName: user.name,
        action: 'Claimed Directive',
        target: directiveId.split(' - ')[0] || 'Optimization',
        type: 'collaboration'
      }
    })
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  useEffect(() => {
    if (!socket || !connected) return

    const handlePresence = (data: any) => {}

    on('presence-update', handlePresence)
    socket.emit('get-presence')

    const loadTeamContext = async () => {
      try {
        const teamRes = await apiGet('/teams')
        const teams = (teamRes as any)?.data || []
        if (teams.length > 0) {
          const tid = teams[0]._id
          setTeamId(tid)
          socket.emit('join:team', { teamId: tid })
        }
      } catch (err) {
        console.error('Failed to load team context', err)
      }
    }
    loadTeamContext()

    const handleClaimed = ({ directiveId, claim }: any) => {
      setDirectiveClaims(prev => ({ ...prev, [directiveId]: claim }))
    }

    on('directive:claimed', handleClaimed)

    return () => {
      off('presence-update', handlePresence)
      off('directive:claimed', handleClaimed)
    }
  }, [socket, connected, on, off])

  const platforms = [
    { id: 'twitter', name: 'Twitter/X', icon: '𝕏' },
    { id: 'linkedin', name: 'LinkedIn', icon: 'in' },
    { id: 'facebook', name: 'Facebook', icon: 'f' },
    { id: 'instagram', name: 'Instagram', icon: '📸' },
    { id: 'youtube', name: 'YouTube', icon: '▶️' },
    { id: 'tiktok', name: 'TikTok', icon: '🎵' }
  ]

  useEffect(() => {
    loadDashboard()
  }, [selectedPlatform])

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }

      const results = await Promise.all([
        apiGet('/content-operations/health').catch(() => null),
        apiGet(`/content-operations/benchmarks?platform=${selectedPlatform}`).catch(() => null),
        apiGet(`/content-operations/next-week?platform=${selectedPlatform}`).catch(() => null),
        apiGet('/content-operations/trends').catch(() => null),
        apiGet(`/content-operations/competitors/compare?platform=${selectedPlatform}`).catch(() => null),
        apiGet('/content-operations/refresh/recommendations').catch(() => null)
      ])

      const [healthRaw, benchmarksRaw, nextWeekRaw, trendsRaw, competitorRaw, refreshRaw] = results as any[]

      // Correctly extract the 'data' property from each response wrapper
      if (healthRaw?.data) {
        const d = healthRaw.data
        setHealthCheck({
          overall: {
            score: d.overallScore || 0,
            grade: calculateGrade(d.overallScore || 0)
          },
          metrics: d.scores || {},
          gaps: (d.gaps || []).map((g: any) => ({
            recommendation: g.recommendation || g.description || 'Improve content'
          }))
        })
      }

      if (benchmarksRaw?.data) setBenchmarks(benchmarksRaw.data)
      if (nextWeekRaw?.data) setNextWeek(nextWeekRaw.data)
      if (trendsRaw?.data) setTrends(trendsRaw.data.overallScore || [])
      if (competitorRaw?.data) setCompetitors(competitorRaw.data)
      if (refreshRaw?.data) setRefreshRecs(Array.isArray(refreshRaw.data) ? refreshRaw.data : [])

      setActiveThought("Intelligence Synchronization Complete.")
      showToast('Ecosystem Intelligence Updated', 'success')
    } catch (error: any) {
      console.error('Sync error:', error)
      showToast('Neural Sync Interrupted', 'error')
    } finally {
      setLoading(false)
    }
  }

  const startDeepScan = async () => {
    setIsScanning(true)
    setScanProgress(0)
    setRepairLogs([])
    setShowRepairLogs(false)

    const token = localStorage.getItem('token')
    const headers = { Authorization: `Bearer ${token}` }

    try {
      setRepairLogs(prev => [...prev, 'Initializing Neural Repository Probe...'])
      await import('../lib/api').then(m => m.apiPost('/content-operations/health/monitor', { autoOptimize: true })).catch(() => {})
      setScanProgress(20)

      setRepairLogs(prev => [...prev, 'Scanning Engagement Patterns for ' + selectedPlatform + '...'])
      await new Promise(r => setTimeout(r, 800))
      setScanProgress(40)

      setRepairLogs(prev => [...prev, 'Predicting Future Content Gaps...'])
      const gapRes: any = await import('../lib/api').then(m => m.apiGet('/content-operations/gaps/predict')).catch(() => null)
      if (gapRes?.data) setPredictedGaps(gapRes.data)
      setScanProgress(70)

      setRepairLogs(prev => [...prev, 'Optimizing Meta-Signals for Peak ROI...'])
      await new Promise(r => setTimeout(r, 800))
      setScanProgress(90)

      setRepairLogs(prev => [...prev, 'Ecosystem Healed & Optimized for Performance.'])
      setScanProgress(100)

      setTimeout(() => {
        setIsScanning(false)
        setShowRepairLogs(true)
        showToast('Ecosystem Neural Integrity Restored', 'success')
        loadDashboard()
      }, 1000)
    } catch (error) {
      setRepairLogs(prev => [...prev, 'CRITICAL: Neural Probe Aborted due to sync error.'])
      setIsScanning(false)
      showToast('Deep Scan Failed', 'error')
    }
  }

  const applyAutoOptimization = async () => {
    setLoading(true)
    try {
      await import('../lib/api').then(m => m.apiPost('/content-operations/health/auto-optimize', {}))
      showToast('Ecosystem Optimization Applied', 'success')
      loadDashboard()
    } catch (error) {
      showToast('Optimization Failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return `text-emerald-400 drop-shadow-[0_0_20px_rgba(52,211,153,0.5)]`
      case 'B': return 'text-cyan-400 drop-shadow-[0_0_20px_rgba(34,211,238,0.5)]'
      case 'C': return 'text-violet-400 drop-shadow-[0_0_20px_rgba(139,92,246,0.5)]'
      case 'D': return 'text-fuchsia-400 drop-shadow-[0_0_20px_rgba(232,121,249,0.5)]'
      default: return 'text-rose-400 drop-shadow-[0_0_20px_rgba(244,63,94,0.5)]'
    }
  }

  const cosmicBg = "relative overflow-hidden selection:bg-indigo-500/30"

  return (
    <div className={`min-h-screen bg-[#020202] text-slate-200 ${cosmicBg}`}>
      {/* Immersive Background System */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.08),transparent_50%),radial-gradient(circle_at_50%_100%,rgba(139,92,246,0.05),transparent_50%)]" />

        <motion.div
          animate={{ x: mousePos.x / 40, y: mousePos.y / 40 }}
          className="absolute inset-0 opacity-20 mix-blend-screen"
        >
          <div
            className="absolute top-1/4 left-1/4 w-[800px] h-[800px] blur-[150px] rounded-full animate-pulse transition-all duration-1000"
            style={{ backgroundColor: `${currentTheme.accentHex}15` }}
          />
          <div className="absolute bottom-1/4 right-1/4 w-[900px] h-[900px] bg-indigo-600/5 blur-[200px] rounded-full animate-pulse transition-all duration-1000" style={{ animationDelay: '2s' }} />
        </motion.div>
      </div>

      {/* Scanning Overlay */}
      <AnimatePresence>
        {isScanning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-3xl"
          >
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
            <div className="text-center space-y-16 max-w-2xl w-full px-8 relative">
              <div className="relative inline-block">
                <motion.div
                  animate={{ rotate: 360, scale: [1, 1.05, 1] }}
                  transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                  className={`w-56 h-56 rounded-full border-2 border-dashed border-${currentTheme.accent}/40 flex items-center justify-center relative shadow-[0_0_50px_${currentTheme.glow}]`}
                >
                  <Cpu className={`w-24 h-24 text-${currentTheme.accent}`} />
                </motion.div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    animate={{ opacity: [0, 1, 0], scale: [0.8, 1.4, 0.8] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className={`w-72 h-72 rounded-full border border-${currentTheme.accent}/20`}
                  />
                </div>
              </div>
              <div className="space-y-6">
                <h3 className="text-6xl font-black text-white uppercase tracking-tighter italic leading-none">Neural Probe <span style={{ color: currentTheme.accentHex }}>Alpha</span></h3>
                <p className="text-slate-500 text-xl font-medium tracking-tight uppercase">Re-calibrating Neural Clusters for <span style={{ color: currentTheme.accentHex }} className="font-black italic">{selectedPlatform}</span> repository...</p>
              </div>
              <div className="space-y-6">
                <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                  <motion.div
                    className="h-full bg-gradient-to-r from-transparent via-white to-transparent"
                    style={{ width: `${scanProgress}%`, backgroundColor: currentTheme.accentHex, boxShadow: `0 0 30px ${currentTheme.glow}` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${scanProgress}%` }}
                  />
                </div>
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-10 text-left font-mono text-xs h-52 relative overflow-hidden shadow-3xl backdrop-blur-xl">
                 <div className="space-y-4">
                  <AnimatePresence mode="popLayout">
                    {repairLogs.map((log, i) => (
                      <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-6 text-emerald-400 font-bold">
                        <span className="text-slate-700 font-black tabular-nums">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)] animate-pulse" />
                        <span className="tracking-tight uppercase">{log}</span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 max-w-[1600px] mx-auto space-y-12 px-6 py-16 md:px-12"
      >
        {/* Elite Navigation Control Cluster */}
        <motion.div variants={itemVariants} className="flex flex-col xl:flex-row items-center justify-between gap-12 bg-white/[0.01] border border-white/5 rounded-[3.5rem] p-4 backdrop-blur-3xl shadow-3xl">
          <div className="flex flex-wrap items-center justify-center gap-2 pl-4">
            <div className="mr-6 pr-6 border-r border-white/10 hidden xl:block">
              <TeamPresence />
            </div>
            {platforms.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedPlatform(p.id)}
                className={`group relative overflow-hidden px-10 py-5 rounded-[2.2rem] transition-all duration-500 flex items-center gap-4 ${selectedPlatform === p.id ? `bg-white text-black shadow-2xl scale-105 -translate-y-1` : 'text-slate-600 hover:text-white border border-transparent'}`}
              >
                <span className="text-xl relative z-10">{p.icon}</span>
                <span className="text-[11px] font-black uppercase tracking-[0.3em] relative z-10">{p.name}</span>
                {selectedPlatform === p.id && (
                  <motion.div layoutId="platform-glow" className="absolute inset-0 bg-white" transition={{ type: "spring", bounce: 0.1, duration: 0.6 }} />
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4 pr-4">
            <motion.button whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }} onClick={loadDashboard} className="flex items-center gap-4 px-12 py-5 rounded-[2.2rem] bg-white/[0.03] border border-white/10 hover:bg-white/[0.08] hover:border-white/20 transition-all font-black text-[11px] uppercase tracking-[0.4em] italic">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Sync Logic
            </motion.button>
            <motion.button whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }} onClick={startDeepScan} style={{ backgroundColor: currentTheme.accentHex, boxShadow: `0 20px 40px ${currentTheme.glow}` }} className="flex items-center gap-4 px-12 py-5 rounded-[2.2rem] text-white font-black text-[11px] uppercase tracking-[0.4em] border border-white/20 italic">
              <Fingerprint className="w-4 h-4" /> Deep Scan
            </motion.button>
          </div>
        </motion.div>

        {/* Elite Sub-Header (Neural Status) */}
        <motion.div variants={itemVariants} className={`relative flex flex-col lg:flex-row items-center gap-12 p-16 rounded-[4.5rem] border-white/5 overflow-hidden ${glassStyle}`}>
          <div className="absolute top-0 right-0 w-[600px] h-[600px] blur-[150px] rounded-full pointer-events-none" style={{ backgroundColor: `${currentTheme.accentHex}10` }} />
          <div className="space-y-12 flex-1 text-center lg:text-left">
            <div className="space-y-6">
              <h1 className="text-[8rem] md:text-[12rem] font-black tracking-tighter italic leading-[0.7] bg-gradient-to-b from-white via-white to-white/10 bg-clip-text text-transparent">NEURAL<br />CENTER</h1>
              <p className="text-slate-400 text-3xl font-medium tracking-tight max-w-4xl mt-10 leading-relaxed">
                Autonomous system <span style={{ color: currentTheme.accentHex }} className="font-black italic underline underline-offset-[12px] decoration-4">dominating</span> the <span className="text-white font-black">{selectedPlatform}</span> repository cluster.
              </p>
            </div>
            <div className="flex items-center justify-center lg:justify-start gap-10">
              <div className="flex items-center gap-6 px-10 py-6 rounded-[2.5rem] bg-white/[0.02] border border-white/5 backdrop-blur-3xl min-w-[400px]">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center border border-white/10 shadow-2xl" style={{ backgroundColor: `${currentTheme.accentHex}20` }}>
                  <Sparkles className="w-6 h-6" style={{ color: currentTheme.accentHex }} />
                </div>
                <AnimatePresence mode="wait">
                  <motion.div key={activeThought} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="text-[14px] font-black text-slate-300 uppercase tracking-[0.3em] italic">{activeThought}</motion.div>
                </AnimatePresence>
              </div>
            </div>
            <div className="mt-8 border-t border-white/5 pt-8">
              <RealTimeActivityTicker />
            </div>
          </div>
          <div className="relative group/core scale-125 lg:scale-110 pr-8">
            <div className={`w-80 h-80 rounded-[5.5rem] flex items-center justify-center bg-white/[0.01] border border-white/5 backdrop-blur-3xl relative overflow-hidden transition-all duration-1000 ${isAutoLoopActive ? 'shadow-2xl' : ''}`} style={{ boxShadow: isAutoLoopActive ? `0 0 100px ${currentTheme.glow}` : 'none' }}>
              <div className="relative w-48 h-48">
                <motion.div animate={{ scale: isAutoLoopActive ? [1, 1.1, 1] : 1, rotate: isAutoLoopActive ? 360 : 0 }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }} className="absolute inset-0 border-4 border-white/10 rounded-full border-dashed" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <BrainCircuit className="w-32 h-32" style={{ color: isAutoLoopActive ? currentTheme.accentHex : '#1e293b', filter: isAutoLoopActive ? `drop-shadow(0 0 40px ${currentTheme.accentHex}60)` : 'none' }} />
                </div>
              </div>
            </div>
            <motion.button whileHover={{ scale: 1.05, y: -4 }} whileTap={{ scale: 0.95 }} onClick={() => setIsAutoLoopActive(!isAutoLoopActive)} style={{ backgroundColor: isAutoLoopActive ? currentTheme.accentHex : '#0f172a', boxShadow: isAutoLoopActive ? `0 20px 50px ${currentTheme.glow}` : 'none' }} className={`absolute -bottom-8 left-1/2 -translate-x-1/2 px-12 py-5 rounded-[2.2rem] border border-white/10 text-white`}>
              <Zap className={`w-5 h-5 ${isAutoLoopActive ? 'fill-white' : ''}`} />
              <span className="text-[11px] font-black uppercase tracking-[0.4em] italic">{isAutoLoopActive ? 'Neural Active' : 'Suspended'}</span>
            </motion.button>
          </div>
        </motion.div>

        {/* Intelligence Grid */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-12 xl:col-span-5 space-y-12">
            <div className={`${glassStyle} p-16 rounded-[4rem] group border-white/5`}>
              {healthCheck && healthCheck.overall && (
                <div className="space-y-16">
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className={`text-[20rem] font-black italic leading-[0.5] ${getGradeColor(healthCheck.overall.grade)}`}>{healthCheck.overall.grade}</div>
                    <div className="text-[8rem] font-black text-white italic tabular-nums">{healthCheck.overall.score}%</div>
                  </div>
                  <div className="grid grid-cols-3 gap-8">
                    {healthCheck.metrics && Object.entries(healthCheck.metrics).map(([key, val]: [string, number]) => (
                      <div key={key} className="p-8 rounded-[2rem] bg-white/[0.01] border border-white/5 text-center">
                        <div className="text-[9px] text-slate-600 font-black uppercase italic tracking-widest">{key}</div>
                        <div className="text-4xl font-black text-white tabular-nums">{val}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="lg:col-span-12 xl:col-span-7 space-y-12">
            <div className={`${glassStyle} p-16 rounded-[4.5rem] group border-white/5`}>
              <div className="flex-1 space-y-12">
                <div className="flex items-center gap-6">
                  <TrendingUp className="w-8 h-8 text-emerald-400" />
                  <h2 className="text-5xl font-black text-white italic uppercase">Apex Flow</h2>
                </div>
                <div className="text-8xl font-black text-white italic tabular-nums leading-none">
                  {nextWeek ? `+${nextWeek.gap}%` : '+38.2%'}
                </div>
                {nextWeek?.weeklyPlan && (
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {nextWeek.weeklyPlan.slice(0, 4).map((plan, i) => (
                      <div key={i} className="p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/5">
                        <div className="text-[10px] font-black text-slate-600 uppercase italic mb-4">{plan.day}</div>
                        <h4 className="text-2xl font-black text-white italic uppercase">{plan.content.title}</h4>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Footer Intelligence */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className={`${glassStyle} p-12 rounded-[3.5rem]`}>
            <h3 className="text-2xl font-black text-white italic uppercase mb-8">Decay Alert</h3>
            <div className="space-y-4">
              {refreshRecs.slice(0, 3).map((rec, i) => (
                <div key={i} className="text-sm text-slate-400 italic">[{rec.action}] {rec.title}</div>
              ))}
            </div>
          </div>
          <div className={`${glassStyle} p-12 rounded-[3.5rem]`}>
            <h3 className="text-2xl font-black text-white italic uppercase mb-8">Neural Audit</h3>
            <div className="text-6xl font-black text-white italic tabular-nums">99.9%</div>
            <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-2">Compliance Score</div>
          </div>
          <div className={`${glassStyle} p-12 rounded-[3.5rem]`}>
            <h3 className="text-2xl font-black text-white italic uppercase mb-8">Auto Loop</h3>
            <p className="text-slate-400 text-sm italic mb-6">System is self-optimizing the repository cluster.</p>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
               <motion.div animate={{ x: ['-100%', '100%'] }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }} className="h-full w-1/3 bg-white/20" />
            </div>
          </div>
        </motion.div>

        {teamId && (
          <CollaborativeComments teamId={teamId} entityId={`health-${selectedPlatform}`} title={`${selectedPlatform} Health Operations`} />
        )}
      </motion.div>
    </div>
  )
}
