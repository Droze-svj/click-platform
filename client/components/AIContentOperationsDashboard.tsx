'use client'

import { useState, useEffect, useCallback } from 'react'
import { m } from 'framer-motion'
import { useToast } from '../contexts/ToastContext'
import { useSocket } from '../hooks/useSocket'
import { apiGet, apiPost } from '../lib/api'
import {
  TrendingUp,
  RefreshCw,
  Stethoscope,
  BrainCircuit,
  AlertCircle,
} from 'lucide-react'
import TeamPresence from './TeamPresence'
import RealTimeActivityTicker from './RealTimeActivityTicker'
import CollaborativeComments from './CollaborativeComments'
import { useTranslation } from '@/hooks/useTranslation'

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

interface RefreshRec {
  action?: string
  title?: string
}

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

// The health endpoints return { overallScore, scores, gaps }; normalise once.
function toHealth(d: any): HealthMetric | null {
  if (!d || typeof d !== 'object' || !Number.isFinite(Number(d.overallScore))) return null
  const score = Math.round(Number(d.overallScore))
  const metrics: Record<string, number> = {}
  if (d.scores && typeof d.scores === 'object') {
    for (const [k, v] of Object.entries(d.scores)) {
      if (Number.isFinite(Number(v))) metrics[k] = Math.round(Number(v))
    }
  }
  return {
    overall: { score, grade: calculateGrade(score) },
    metrics,
    gaps: (Array.isArray(d.gaps) ? d.gaps : [])
      .map((g: any) => ({ recommendation: g?.recommendation || g?.description || '' }))
      .filter((g: { recommendation: string }) => g.recommendation),
  }
}

export default function AIContentOperationsDashboard() {
  const [refreshRecs, setRefreshRecs] = useState<RefreshRec[]>([])
  const [teamId, setTeamId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState('twitter')
  const [healthCheck, setHealthCheck] = useState<HealthMetric | null>(null)
  const [nextWeek, setNextWeek] = useState<NextWeekData | null>(null)
  const { showToast } = useToast()
  const { socket, connected } = useSocket()
  const { t } = useTranslation()

  const platformThemes: Record<string, { accentHex: string, glow: string }> = {
    twitter: { glow: 'rgba(99,102,241,0.4)', accentHex: '#6366f1' },
    linkedin: { glow: 'rgba(59,130,246,0.4)', accentHex: '#3b82f6' },
    facebook: { glow: 'rgba(37,99,235,0.4)', accentHex: '#2563eb' },
    instagram: { glow: 'rgba(217,70,239,0.4)', accentHex: '#d946ef' },
    youtube: { glow: 'rgba(225,29,72,0.4)', accentHex: '#e11d48' },
    tiktok: { glow: 'rgba(34,211,238,0.4)', accentHex: '#22d3ee' }
  }

  const currentTheme = platformThemes[selectedPlatform] || platformThemes.twitter

  // Join the user's first team so the comments panel has a room.
  useEffect(() => {
    if (!socket || !connected) return
    let cancelled = false
    const loadTeamContext = async () => {
      try {
        const teamRes = await apiGet('/teams')
        const teams = (teamRes as any)?.data || []
        if (!cancelled && teams.length > 0) {
          const tid = teams[0]._id
          setTeamId(tid)
          socket.emit('join:team', { teamId: tid })
        }
      } catch (err) {
        console.error('Failed to load team context', err)
      }
    }
    loadTeamContext()
    return () => { cancelled = true }
  }, [socket, connected])

  const platforms = [
    { id: 'twitter', name: 'Twitter/X', icon: '𝕏' },
    { id: 'linkedin', name: 'LinkedIn', icon: 'in' },
    { id: 'facebook', name: 'Facebook', icon: 'f' },
    { id: 'instagram', name: 'Instagram', icon: '📸' },
    { id: 'youtube', name: 'YouTube', icon: '▶️' },
    { id: 'tiktok', name: 'TikTok', icon: '🎵' }
  ]

  const loadDashboard = useCallback(async (manual = false) => {
    setLoading(true)
    setLoadFailed(false)
    let failures = 0
    const settle = <T,>(p: Promise<T>) => p.catch(() => { failures += 1; return null })
    try {
      const [healthRaw, nextWeekRaw, refreshRaw] = await Promise.all([
        settle(apiGet<any>('/content-operations/health', undefined, false)),
        settle(apiGet<any>(`/content-operations/next-week?platform=${selectedPlatform}`, undefined, false)),
        settle(apiGet<any>('/content-operations/refresh/recommendations', undefined, false)),
      ])

      setHealthCheck(toHealth(healthRaw?.data))
      const nw = nextWeekRaw?.data
      setNextWeek(nw && typeof nw === 'object' ? nw : null)
      setRefreshRecs(Array.isArray(refreshRaw?.data) ? refreshRaw.data : [])

      if (failures === 3) {
        setLoadFailed(true)
        showToast(t('aiContentOperationsDashboard.toastSyncInterrupted'), 'error')
      } else if (failures > 0) {
        showToast(t('aiContentOperationsDashboard.toastPartialLoad'), 'warning')
      } else if (manual) {
        showToast(t('aiContentOperationsDashboard.toastRefreshed'), 'success')
      }
    } finally {
      setLoading(false)
    }
  }, [selectedPlatform, showToast, t])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  // POST /health/monitor runs a real health check (and raises an alert
  // notification when the score is low). It returns the check, or null on
  // failure — report exactly that.
  const runHealthCheck = async () => {
    setChecking(true)
    try {
      const res: any = await apiPost('/content-operations/health/monitor', {})
      const health = toHealth(res?.data)
      if (!health) {
        showToast(t('aiContentOperationsDashboard.toastDeepScanFailed'), 'error')
        return
      }
      setHealthCheck(health)
      showToast(t('aiContentOperationsDashboard.toastHealthScore', { score: String(health.overall.score) }), 'success')
    } catch {
      showToast(t('aiContentOperationsDashboard.toastDeepScanFailed'), 'error')
    } finally {
      setChecking(false)
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

  const gapValue = nextWeek && Number.isFinite(Number(nextWeek.gap)) ? Math.round(Number(nextWeek.gap)).toLocaleString() : null

  return (
    <div className="min-h-screen bg-[#020202] text-slate-200 relative overflow-hidden selection:bg-indigo-500/30">
      {/* Decorative background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.08),transparent_50%),radial-gradient(circle_at_50%_100%,rgba(139,92,246,0.05),transparent_50%)]" />
        <div
          className="absolute top-1/4 left-1/4 w-[800px] h-[800px] blur-[150px] rounded-full opacity-20 transition-all duration-1000"
          style={{ backgroundColor: `${currentTheme.accentHex}15` }}
        />
      </div>

      <m.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 max-w-[1600px] mx-auto space-y-12 px-6 py-16 md:px-12"
      >
        {/* Platform selector + actions */}
        <m.div variants={itemVariants} className="flex flex-col xl:flex-row items-center justify-between gap-8 bg-white/[0.01] border border-white/5 rounded-[3.5rem] p-4 backdrop-blur-3xl">
          <div className="flex flex-wrap items-center justify-center gap-2 pl-4">
            <div className="mr-6 pr-6 border-r border-white/10 hidden xl:block">
              <TeamPresence />
            </div>
            {platforms.map(p => (
              <button
                type="button"
                key={p.id}
                onClick={() => setSelectedPlatform(p.id)}
                aria-pressed={selectedPlatform === p.id}
                className={`group relative overflow-hidden px-8 py-4 rounded-[2.2rem] transition-all duration-500 flex items-center gap-3 ${selectedPlatform === p.id ? `bg-white text-black shadow-2xl` : 'text-slate-500 hover:text-white border border-transparent'}`}
              >
                <span className="text-xl relative z-10" aria-hidden="true">{p.icon}</span>
                <span className="text-[11px] font-black uppercase tracking-[0.2em] relative z-10">{p.name}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4 pr-4">
            <button type="button" onClick={() => loadDashboard(true)} disabled={loading} className="flex items-center gap-3 px-10 py-4 rounded-[2.2rem] bg-white/[0.03] border border-white/10 hover:bg-white/[0.08] transition-all font-black text-[11px] uppercase tracking-[0.2em] disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" /> {t('aiContentOperationsDashboard.refresh')}
            </button>
            <button type="button" onClick={runHealthCheck} disabled={checking} aria-busy={checking} style={{ backgroundColor: currentTheme.accentHex, boxShadow: `0 20px 40px ${currentTheme.glow}` }} className="flex items-center gap-3 px-10 py-4 rounded-[2.2rem] text-white font-black text-[11px] uppercase tracking-[0.2em] border border-white/20 disabled:opacity-60">
              {checking ? <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Stethoscope className="w-4 h-4" aria-hidden="true" />}
              {checking ? t('aiContentOperationsDashboard.checking') : t('aiContentOperationsDashboard.runHealthCheck')}
            </button>
          </div>
        </m.div>

        {/* Header */}
        <m.div variants={itemVariants} className={`relative flex flex-col lg:flex-row items-center gap-12 p-12 md:p-16 rounded-[4.5rem] border-white/5 overflow-hidden ${glassStyle}`}>
          <div className="space-y-8 flex-1 text-center lg:text-left">
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] bg-gradient-to-b from-white via-white to-white/30 bg-clip-text text-transparent">{t('aiContentOperationsDashboard.pageTitle')}</h1>
            <p className="text-slate-400 text-xl md:text-2xl font-medium tracking-tight max-w-3xl leading-relaxed">
              {t('aiContentOperationsDashboard.pageSubtitle', { platform: platforms.find(p => p.id === selectedPlatform)?.name || selectedPlatform })}
            </p>
            <div className="border-t border-white/5 pt-8">
              <RealTimeActivityTicker />
            </div>
          </div>
          <div className="hidden lg:flex w-64 h-64 rounded-[4.5rem] items-center justify-center bg-white/[0.01] border border-white/5" aria-hidden="true">
            <BrainCircuit className="w-28 h-28" style={{ color: currentTheme.accentHex }} />
          </div>
        </m.div>

        {loadFailed && (
          <div role="alert" className={`${glassStyle} p-8 rounded-[3rem] flex flex-col sm:flex-row items-center justify-between gap-4`}>
            <p className="flex items-center gap-3 text-rose-300 font-semibold"><AlertCircle className="w-5 h-5" aria-hidden="true" /> {t('aiContentOperationsDashboard.loadFailed')}</p>
            <button type="button" onClick={() => loadDashboard(true)} className="px-8 py-3 rounded-full bg-white text-black text-[11px] font-black uppercase tracking-widest">{t('aiContentOperationsDashboard.retry')}</button>
          </div>
        )}

        {/* Health + next week */}
        <m.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-12 xl:col-span-5">
            <div className={`${glassStyle} p-12 md:p-16 rounded-[4rem] border-white/5 h-full`}>
              <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-8">{t('aiContentOperationsDashboard.neuralAudit')}</h2>
              {healthCheck ? (
                <div className="space-y-12">
                  <div className="flex items-end justify-center gap-8 py-6">
                    <div className={`text-[9rem] font-black leading-none ${getGradeColor(healthCheck.overall.grade)}`}>{healthCheck.overall.grade}</div>
                    <div className="text-6xl font-black text-white tabular-nums pb-4">{healthCheck.overall.score}%</div>
                  </div>
                  {Object.keys(healthCheck.metrics).length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                      {Object.entries(healthCheck.metrics).map(([key, val]) => (
                        <div key={key} className="p-6 rounded-[2rem] bg-white/[0.01] border border-white/5 text-center">
                          <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{key}</div>
                          <div className="text-3xl font-black text-white tabular-nums">{val}%</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {healthCheck.gaps.length > 0 && (
                    <ul className="space-y-3">
                      {healthCheck.gaps.slice(0, 3).map((g, i) => (
                        <li key={i} className="text-sm text-slate-300 leading-relaxed">• {g.recommendation}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <div className="text-6xl font-black text-slate-600">—</div>
                  <p className="text-sm text-slate-500 mt-4">{loading ? t('aiContentOperationsDashboard.loading') : t('aiContentOperationsDashboard.noHealthData')}</p>
                </div>
              )}
            </div>
          </div>
          <div className="lg:col-span-12 xl:col-span-7">
            <div className={`${glassStyle} p-12 md:p-16 rounded-[4.5rem] border-white/5 h-full space-y-10`}>
              <div className="flex items-center gap-6">
                <TrendingUp className="w-8 h-8 text-emerald-400" aria-hidden="true" />
                <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight">{t('aiContentOperationsDashboard.nextWeekTitle')}</h2>
              </div>
              {nextWeek ? (
                <>
                  {nextWeek.goal && <p className="text-lg text-slate-300 leading-relaxed">{nextWeek.goal}</p>}
                  <div>
                    <div className="text-6xl font-black text-white tabular-nums leading-none">{gapValue ?? '—'}</div>
                    <div className="text-[11px] font-black text-slate-500 uppercase tracking-widest mt-3">{t('aiContentOperationsDashboard.gapLabel')}</div>
                  </div>
                  {Array.isArray(nextWeek.weeklyPlan) && nextWeek.weeklyPlan.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {nextWeek.weeklyPlan.slice(0, 4).map((plan, i) => (
                        <div key={i} className="p-6 rounded-[2.5rem] bg-white/[0.02] border border-white/5">
                          <div className="text-[10px] font-black text-slate-500 uppercase mb-3">{plan.day}</div>
                          <h4 className="text-xl font-black text-white">{plan.content?.title}</h4>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="py-8">
                  <div className="text-6xl font-black text-slate-600">—</div>
                  <p className="text-sm text-slate-500 mt-4">{loading ? t('aiContentOperationsDashboard.loading') : t('aiContentOperationsDashboard.noPlanData')}</p>
                </div>
              )}
            </div>
          </div>
        </m.div>

        {/* Posts to refresh */}
        <m.div variants={itemVariants} className={`${glassStyle} p-12 rounded-[3.5rem]`}>
          <h3 className="text-2xl font-black text-white uppercase mb-6">{t('aiContentOperationsDashboard.refreshTitle')}</h3>
          {refreshRecs.length > 0 ? (
            <ul className="space-y-3">
              {refreshRecs.slice(0, 5).map((rec, i) => (
                <li key={i} className="text-sm text-slate-300">
                  {rec.action && <span className="font-black uppercase text-[11px] text-indigo-300 mr-2">{rec.action}</span>}
                  {rec.title}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">{loading ? t('aiContentOperationsDashboard.loading') : t('aiContentOperationsDashboard.noRefreshRecs')}</p>
          )}
        </m.div>

        {teamId && (
          <CollaborativeComments teamId={teamId} entityId={`health-${selectedPlatform}`} title={t('aiContentOperationsDashboard.healthOperationsTitle', { platform: selectedPlatform })} />
        )}
      </m.div>
    </div>
  )
}
