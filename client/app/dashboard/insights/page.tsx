'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  BarChart3, TrendingUp, Target, Users, Sparkles, RefreshCw, 
  Link2, Calendar, Zap, MessageSquare, Heart, Share2, 
  ChevronRight, Cpu, Activity, Shield, Globe, Radio, 
  Layers, Terminal, X, ArrowUpRight, Hexagon, PieChart,
  ArrowLeft, Network, Gauge, Fingerprint, Monitor,
  ActivitySquare, Lock, AlertCircle, Boxes, ArrowRight, ChevronDown
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiGet, apiPost } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'
import { useTranslation } from '@/hooks/useTranslation'
import ToastContainer from '../../../components/ToastContainer'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { StatsCardSkeleton, ContentSkeleton } from '../../../components/LoadingSkeleton'

interface AudienceOverview {
  totalEngagement?: number
  totalImpressions?: number
  engagementRate?: number
  platformDistribution?: Record<string, number>
  postsPerDay?: number
}

interface AudienceInsights {
  hasData: boolean
  message?: string
  period?: number
  totalPosts?: number
  insights?: {
    overview?: AudienceOverview
    engagement?: Record<string, unknown>
    demographics?: Record<string, unknown>
    recommendations?: string[]
  }
}

interface PlatformAudience {
  totalPosts?: number
  totalReach?: number
  totalEngagement?: number
  averageEngagementRate?: number
  topPlatform?: string
  bestPostingTime?: string
  engagementByPlatform?: Record<string, number>
}

interface ConnectedAccounts {
  twitter?: unknown; linkedin?: unknown; facebook?: unknown; 
  instagram?: unknown; youtube?: unknown; tiktok?: unknown;
}

/**
 * Short relative-time formatter for the "Updated N ago" pill. We intentionally
 * don't pull in a full date library — the pill only needs five buckets
 * (just now / minutes / hours / days / "X ago" for older). Falls back to a
 * locale-formatted string for anything older than ~30 days.
 */
function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const diffMs = Date.now() - t
  if (diffMs < 60_000) return 'just now'
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export default function CognitiveForecasterPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audienceInsights, setAudienceInsights] = useState<AudienceInsights | null>(null)
  const [platformAudience, setPlatformAudience] = useState<PlatformAudience | null>(null)
  const [accounts, setAccounts] = useState<ConnectedAccounts | null>(null)
  const [period, setPeriod] = useState(30)
  // Tracks when the AI learning loop last ingested fresh analytics into
  // the UserStyleProfile. Surfaced as a "Last updated X minutes ago"
  // pill so the user can tell whether the page reflects today's posts
  // or last week's. Sourced from /api/style-profile/insights → profile.
  const [lastIngestedAt, setLastIngestedAt] = useState<string | null>(null)

  const loadCognitiveData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [insightsRes, platformRes, accountsRes, styleRes] = await Promise.all([
        apiGet<{ success?: boolean; data?: AudienceInsights }>(`/audience/insights?period=${period}`).catch(() => ({ data: { hasData: false } })),
        apiGet<{ success?: boolean; data?: PlatformAudience }>(`/analytics/platform/audience?period=${period}`).catch(() => ({ data: null })),
        apiGet<{ success?: boolean; accounts?: ConnectedAccounts }>('/oauth/accounts').catch(() => ({ accounts: {} })),
        apiGet<{ lastIngestedAt?: string | null; profile?: { lastIngestedAt?: string | null } }>('/style-profile/insights').catch(() => ({ lastIngestedAt: null })),
      ])

      const rawI = insightsRes as any
      const rawP = platformRes as any
      const rawA = accountsRes as any
      const rawS = styleRes as any

      setAudienceInsights(rawI?.data ?? rawI ?? { hasData: false })
      setPlatformAudience(rawP?.data ?? rawP ?? null)
      setAccounts(rawA?.accounts ?? rawA ?? {})
      // The endpoint may return either at the root or nested under `profile`.
      const ingestStamp = rawS?.lastIngestedAt ?? rawS?.profile?.lastIngestedAt ?? null
      setLastIngestedAt(ingestStamp || null)
    } catch {
      setError(t('insightsPage.errorLoad'))
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { loadCognitiveData() }, [loadCognitiveData])

  const handleSynchronizeCognitive = async () => {
    try {
      setSyncing(true)
      setError(null)
      await apiPost('/analytics/platform/sync-all', { limit: 50 })
      await loadCognitiveData()
    } catch {
      setError(t('insightsPage.errorSync'))
    } finally {
      setSyncing(false)
    }
  }

  const connectedCount = accounts ? Object.values(accounts).filter(Boolean).length : 0

  if (loading) return (
     <div className="min-h-screen relative z-10 pb-48 px-4 sm:px-6 lg:px-12 pt-8 max-w-[1900px] mx-auto space-y-12 bg-surface-page transition-colors duration-500" aria-busy="true" aria-label={t('insightsPage.loadingAria')}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
           {Array.from({ length: 4 }).map((_, i) => <StatsCardSkeleton key={i} />)}
        </div>
        <ContentSkeleton />
     </div>
  );

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-4 sm:px-6 lg:px-12 pt-8 max-w-[1900px] mx-auto space-y-12 bg-surface-page text-surface-900 dark:text-surface-50 transition-colors duration-500 font-inter">
        <ToastContainer />

        {/* Matrix Header */}
        <header className="flex flex-col lg:flex-row justify-between items-center gap-12 pb-10 border-b border-surface-200 dark:border-surface-800 relative z-50">
           <div className="flex items-center gap-6 w-full lg:w-auto min-w-0">
              <button type="button" onClick={() => router.push('/dashboard')} title={t('insightsPage.backToDashboard')} aria-label={t('insightsPage.backToDashboard')} className="w-14 h-14 rounded-2xl bg-surface-card border border-surface-200 dark:border-surface-800 flex items-center justify-center text-surface-400 hover:text-surface-900 dark:hover:text-white transition-all shadow-sm active:scale-90">
                <ArrowLeft size={24} />
              </button>
              <div className="w-20 h-20 rounded-[2.5rem] bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center shadow-lg flex-shrink-0 group hover:rotate-12 transition-transform duration-500">
                <Cpu size={40} className="text-primary-600 dark:text-primary-400" />
              </div>
              <div className="flex-1 min-w-0">
                 <div className="flex items-center gap-4 mb-2 flex-wrap">
                    <span className="px-3 py-1 rounded-lg text-[10px] font-black bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400 uppercase tracking-[0.2em] border border-primary-200 dark:border-primary-800 italic leading-none">
                      {t('insightsPage.kicker')}
                    </span>
                    <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-surface-card text-surface-500 border border-surface-200 dark:bg-surface-800/50 dark:text-surface-400 dark:border-surface-700/50 text-[10px] font-black italic shadow-inner">
                        <div className="w-2 h-2 rounded-full bg-primary-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                        {t('insightsPage.live')}
                    </div>
                    {/* Data-freshness pill — answers "is this current?".
                        Sourced from UserStyleProfile.lastIngestedAt
                        (stamped by the ingest service every time new
                        analytics get folded into the learning profile).
                        Hidden until at least one ingest has run. */}
                    {lastIngestedAt && (
                      <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-black italic shadow-inner" title={t('insightsPage.lastSyncTitle', { time: new Date(lastIngestedAt).toLocaleString() })}>
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        {t('insightsPage.updatedPrefix', { time: formatRelativeTime(lastIngestedAt) })}
                      </div>
                    )}
                 </div>
                 <h1 className="text-4xl sm:text-5xl font-black tracking-tighter leading-none mt-3 truncate uppercase italic">{t('insightsPage.title')}</h1>
              </div>
           </div>

           <div className="flex flex-wrap items-center gap-6 justify-end w-full lg:w-auto">
              <div className="flex items-center p-2 rounded-[2rem] bg-surface-card border-2 border-surface-100 dark:border-surface-800 shadow-inner">
                {[7, 30, 90].map(p => (
                  <button type="button" key={p} onClick={() => setPeriod(p)}
                    className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] italic transition-all duration-500 ${
                      period === p ? 'bg-surface-900 dark:bg-white text-white dark:text-black shadow-xl scale-110' : 'text-surface-400 hover:text-surface-900 dark:hover:text-white'
                    }`}
                  >
                    {t('insightsPage.days', { count: p })}
                  </button>
                ))}
              </div>
              <button type="button" onClick={handleSynchronizeCognitive} disabled={syncing}
                className="px-10 py-5 bg-surface-900 dark:bg-white text-white dark:text-black font-black uppercase text-[11px] tracking-[0.6em] italic rounded-2xl hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white transition-all shadow-2xl active:scale-95 flex items-center gap-4 group border-none"
              >
                <RefreshCw size={22} className={syncing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'} />
                {syncing ? t('insightsPage.refreshing') : t('insightsPage.refresh')}
              </button>
           </div>
        </header>

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative z-50"
            >
               <div className="p-10 rounded-[2.5rem] bg-rose-500/10 border-2 border-rose-500/20 flex items-center justify-between gap-8 group shadow-2xl backdrop-blur-xl">
                  <div className="flex items-center gap-8">
                     <div className="w-16 h-16 bg-rose-500/20 rounded-2xl flex items-center justify-center border-2 border-rose-500/30 shadow-lg"><AlertCircle className="text-rose-500" size={32} /></div>
                     <p className="text-2xl font-black text-rose-600 dark:text-rose-400 uppercase tracking-tighter italic leading-none">{error}</p>
                  </div>
                   <button type="button" onClick={() => setError(null)} title={t('insightsPage.dismissError')} aria-label={t('insightsPage.dismissError')} className="w-12 h-12 rounded-xl bg-surface-card border border-rose-500/20 flex items-center justify-center text-surface-400 hover:text-rose-500 transition-all active:scale-90"><X size={24} /></button>
               </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Connection Status */}
        <section className="bg-surface-card backdrop-blur-3xl border border-surface-200 dark:border-surface-800 rounded-[3.5rem] p-10 sm:p-14 relative z-10 group overflow-hidden transition-all duration-500 hover:shadow-[0_80px_150px_rgba(0,0,0,0.5)]">
          <div className="absolute top-0 right-0 p-20 opacity-[0.02] pointer-events-none group-hover:opacity-[0.08] transition-opacity duration-1000"><Boxes size={450} className="text-primary-500" /></div>
          <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-12 relative z-10">
            <div className="flex items-center gap-10 min-w-0 flex-1">
              <div className="w-24 h-24 bg-primary-500/10 border-2 border-primary-500/20 rounded-[2.5rem] flex items-center justify-center shadow-2xl group-hover:rotate-12 transition-transform duration-700 flex-shrink-0">
                <Link2 className="w-12 h-12 text-primary-600 dark:text-primary-400" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-4xl font-black text-surface-900 dark:text-white italic uppercase tracking-tighter leading-none mb-4">{t('insightsPage.connectedPlatforms')}</h3>
                <p className="text-[12px] text-surface-400 dark:text-slate-500 font-black uppercase tracking-[0.5em] italic leading-snug break-words">
                  {connectedCount > 0
                    ? t('insightsPage.platformsConnected', { count: connectedCount })
                    : t('insightsPage.connectToSee')}
                </p>
              </div>
            </div>
            <button type="button" onClick={() => router.push('/dashboard/social')}
              className="w-full xl:w-auto px-12 py-7 bg-surface-900 dark:bg-white text-white dark:text-black rounded-[2.5rem] text-[13px] font-black uppercase tracking-[0.8em] italic hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white transition-all shadow-[0_30px_80px_rgba(0,0,0,0.4)] flex items-center justify-center gap-8 group flex-shrink-0 active:scale-95 border-none"
            >
              {connectedCount > 0 ? t('insightsPage.manage') : t('insightsPage.connectPlatform')}
              <ArrowUpRight className="w-8 h-8 group-hover:translate-x-3 group-hover:-translate-y-3 transition-transform duration-700" />
            </button>
          </div>
        </section>

        {/* Empty-state hint — only shows when the user has nothing to look at yet.
            Without this, a brand-new account sees an entire page of zeroes
            and assumes the product is broken. We detect "no data" the same
            way the metric cards do, so this card disappears the moment any
            metric becomes non-zero. */}
        {(() => {
          const reach = audienceInsights?.insights?.overview?.totalImpressions ?? platformAudience?.totalReach ?? 0
          const eng = audienceInsights?.insights?.overview?.totalEngagement ?? platformAudience?.totalEngagement ?? 0
          const hasData = (Number(reach) || 0) > 0 || (Number(eng) || 0) > 0
          if (hasData) return null
          return (
            <section className="bg-surface-card border-2 border-dashed border-primary-500/30 rounded-[3rem] p-10 sm:p-12 relative z-10 text-center space-y-4">
              <h3 className="text-xl font-bold text-surface-900 dark:text-white">{t('insightsPage.noDataYet')}</h3>
              <p className="text-sm text-surface-500 max-w-xl mx-auto leading-relaxed">
                {connectedCount > 0
                  ? t('insightsPage.noDataHintConnected')
                  : t('insightsPage.noDataHintDisconnected')}
              </p>
            </section>
          )
        })()}

        {/* Metric tiles. `min-w-0` + `whitespace-normal` on the tile wrapper
            so long labels like "Engagement rate" wrap instead of clipping
            to "ENGAGEMENT RAT…" at the tile edge. */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 relative z-10">
          <HeuristicStatCard icon={Globe} label={t('insightsPage.metricReach')} value={audienceInsights?.insights?.overview?.totalImpressions ?? platformAudience?.totalReach ?? 0} format="number" color="text-indigo-600 dark:text-indigo-400" badge={t('insightsPage.insightBadge')} />
          <HeuristicStatCard icon={Activity} label={t('insightsPage.metricEngagement')} value={audienceInsights?.insights?.overview?.totalEngagement ?? platformAudience?.totalEngagement ?? 0} format="number" color="text-emerald-600 dark:text-emerald-400" badge={t('insightsPage.insightBadge')} />
          <HeuristicStatCard icon={Zap} label={t('insightsPage.metricEngagementRate')} value={audienceInsights?.insights?.overview?.engagementRate ?? platformAudience?.averageEngagementRate ?? 0} format="percent" color="text-amber-600 dark:text-amber-400" badge={t('insightsPage.insightBadge')} />
          <HeuristicStatCard icon={Target} label={t('insightsPage.metricTopPlatform')} value={platformAudience?.topPlatform ?? t('insightsPage.notAvailable')} format="text" color="text-rose-600 dark:text-rose-400" badge={t('insightsPage.insightBadge')} />
        </section>

        {/* Cognitive Intelligence Layers */}
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-12 relative z-10">
          {/* Neural Receptor Density */}
          <div className="bg-surface-card backdrop-blur-3xl border border-surface-200 dark:border-surface-800 rounded-[4rem] overflow-hidden group shadow-2xl transition-all duration-500 hover:shadow-[0_80px_150px_rgba(0,0,0,0.4)]">
            <div className="p-12 border-b-2 border-surface-100 dark:border-surface-800 flex items-center gap-10 bg-primary-500/5">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border-2 border-indigo-500/20 flex items-center justify-center shadow-lg transition-all group-hover:rotate-12"><Users size={32} className="text-indigo-600 dark:text-indigo-400" /></div>
              <h3 className="font-black text-surface-900 dark:text-white italic uppercase tracking-tighter text-4xl leading-none">{t('insightsPage.audience')}</h3>
            </div>
            <div className="p-12 min-h-[550px] flex flex-col justify-center">
              {audienceInsights?.hasData || platformAudience ? (
                <div className="space-y-12">
                  {audienceInsights?.insights?.overview?.platformDistribution && (
                    <div className="space-y-10">
                      <p className="text-[11px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-[0.6em] italic leading-none pl-6 border-l-4 border-indigo-500/40">{t('insightsPage.postsByPlatform')}</p>
                      <div className="grid grid-cols-1 gap-6">
                        {Object.entries(audienceInsights.insights.overview.platformDistribution).map(([p, count], idx) => (
                          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.1 }}
                            key={p} className="p-10 bg-surface-page dark:bg-surface-950/40 border-2 border-surface-100 dark:border-surface-800 rounded-[3rem] flex items-center justify-between group/node hover:border-indigo-500/40 transition-all duration-500 shadow-inner backdrop-blur-xl"
                          >
                            <span className="text-3xl font-black text-surface-900 dark:text-white italic tracking-tighter uppercase leading-none group-hover/node:text-indigo-500 transition-colors">{p}</span>
                            <div className="flex items-center gap-10">
                               <div className="hidden md:block w-48 h-3 bg-surface-card dark:bg-surface-900 rounded-full overflow-hidden border-2 border-surface-100 dark:border-surface-800 shadow-inner p-0.5">
                                  <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min((count as number) * 10, 100)}%` }} transition={{ duration: 1, delay: idx * 0.1 }} className="h-full bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.6)] rounded-full" />
                               </div>
                               <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 italic tabular-nums leading-none tracking-tighter">{t('insightsPage.postsCount', { count: String(count) })}</span>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                  {platformAudience?.bestPostingTime && (
                    <div className="flex items-center gap-12 p-12 bg-primary-500/5 border-2 border-primary-500/10 rounded-[3.5rem] shadow-xl group/opt transition-all duration-500 hover:border-primary-500/40 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-12 opacity-[0.02] pointer-events-none group-hover/opt:opacity-[0.08] transition-opacity duration-1000"><Monitor size={250} /></div>
                      <div className="w-24 h-24 bg-primary-500/10 border-2 border-primary-500/20 text-primary-500 rounded-3xl flex items-center justify-center shadow-lg group-hover/opt:rotate-12 transition-transform duration-700 shrink-0"><Calendar size={44} /></div>
                      <div className="relative z-10 min-w-0">
                          <p className="text-[11px] font-black text-primary-500/60 uppercase tracking-[0.8em] italic mb-4 leading-none truncate">{t('insightsPage.bestTimeToPost')}</p>
                          <p className="text-6xl font-black text-surface-900 dark:text-white italic uppercase tracking-tighter leading-none truncate">{platformAudience.bestPostingTime}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-10 gap-16 group-hover:opacity-20 transition-opacity duration-1000">
                   <PieChart size={150} className="text-surface-300 dark:text-slate-800 animate-pulse" />
                   <p className="text-4xl font-black text-surface-900 dark:text-white uppercase tracking-[0.8em] italic leading-none max-w-md">{t('insightsPage.noAudienceData')}</p>
                </div>
              )}
            </div>
          </div>

          {/* Synthetic Logic Synthesis */}
          <div className="bg-surface-card backdrop-blur-3xl border border-surface-200 dark:border-surface-800 rounded-[4rem] overflow-hidden group shadow-2xl transition-all duration-500 hover:shadow-[0_80px_150px_rgba(0,0,0,0.4)]">
            <div className="p-12 border-b-2 border-surface-100 dark:border-surface-800 flex items-center gap-10 bg-amber-500/5">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border-2 border-amber-500/20 flex items-center justify-center shadow-lg transition-all group-hover:rotate-[-12deg]"><Sparkles size={32} className="text-amber-600 dark:text-amber-400" /></div>
              <h3 className="font-black text-surface-900 dark:text-white italic uppercase tracking-tighter text-4xl leading-none">{t('insightsPage.recommendations')}</h3>
            </div>
            <div className="p-12 min-h-[550px] flex flex-col justify-center">
              {audienceInsights?.insights?.recommendations && audienceInsights.insights.recommendations.length > 0 ? (
                <div className="space-y-8">
                  {audienceInsights.insights.recommendations.slice(0, 5).map((rec, i) => (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} key={i}
                      className="flex items-center gap-10 p-10 bg-surface-page dark:bg-surface-950/40 border-2 border-surface-100 dark:border-surface-800 rounded-[3rem] group/rec hover:border-amber-500/40 transition-all duration-500 shadow-inner backdrop-blur-xl"
                    >
                      <div className="w-16 h-16 bg-amber-500/10 border-2 border-amber-500/20 rounded-[1.8rem] flex items-center justify-center text-amber-500 flex-shrink-0 group-hover/rec:rotate-12 transition-all duration-500 shadow-lg">
                         <Zap size={28} />
                      </div>
                      <div className="min-w-0">
                          <div className="flex items-center gap-6 mb-3">
                             <span className="text-[11px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-[0.6em] italic leading-none shrink-0">{t('insightsPage.tip', { number: i + 1 })}</span>
                             <div className="h-[2px] flex-1 bg-amber-500/10 rounded-full" />
                          </div>
                          <span className="text-2xl font-black text-surface-900 dark:text-white italic leading-[1.3] uppercase tracking-tight line-clamp-2 group-hover/rec:text-amber-500 transition-colors">{rec}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-10 gap-16 group-hover:opacity-20 transition-opacity duration-1000">
                   <Shield size={150} className="text-surface-300 dark:text-slate-800 animate-pulse" />
                   <div className="space-y-8">
                      <p className="text-4xl font-black text-surface-900 dark:text-white uppercase tracking-[0.8em] italic leading-none">{t('insightsPage.noTipsYet')}</p>
                      <p className="text-sm font-black text-surface-400 dark:text-slate-600 uppercase tracking-[0.4em] italic leading-none max-w-sm mx-auto">{t('insightsPage.noTipsHint')}</p>
                   </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Global Persistence Shortcuts */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-10 relative z-10 pt-16">
          {[
            { label: t('insightsPage.shortcutAnalytics'), desc: t('insightsPage.shortcutAnalyticsDesc'), icon: BarChart3, href: '/dashboard/analytics', color: 'text-indigo-600 dark:text-indigo-400' },
            { label: t('insightsPage.shortcutScheduler'), desc: t('insightsPage.shortcutSchedulerDesc'), icon: Calendar, href: '/dashboard/scheduler', color: 'text-emerald-600 dark:text-emerald-400' },
            { label: t('insightsPage.shortcutAiStudio'), desc: t('insightsPage.shortcutAiStudioDesc'), icon: Sparkles, href: '/dashboard/content', color: 'text-purple-600 dark:text-purple-400' },
          ].map((a, i) => (
            <motion.button key={a.label} whileHover={{ y: -15, scale: 1.02 }} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              onClick={() => router.push(a.href)}
              className="bg-surface-card backdrop-blur-3xl p-12 rounded-[4rem] text-center flex flex-col items-center gap-10 border-2 border-surface-100 dark:border-surface-800 hover:border-primary-500/40 shadow-2xl group transition-all duration-500 active:scale-95"
            >
              <div className="w-24 h-24 bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 rounded-[2.5rem] flex items-center justify-center shadow-inner group-hover:rotate-12 transition-all duration-700">
                <a.icon size={44} className={a.color} />
              </div>
              <div>
                <h4 className="text-4xl font-black text-surface-900 dark:text-white italic uppercase tracking-tighter mb-4 leading-none">{a.label}</h4>
                <p className="text-[13px] text-surface-400 dark:text-slate-500 font-black uppercase tracking-[0.5em] italic leading-relaxed px-10">{a.desc}</p>
              </div>
              <div className="mt-6 flex items-center gap-6 text-[12px] font-black text-primary-500 uppercase tracking-[1em] italic group-hover:gap-12 transition-all duration-1000">
                 {t('insightsPage.open')} <ArrowRight size={24} />
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

function HeuristicStatCard({ icon: Icon, label, value, format, color, badge }: { icon: any; label: string; value: any; format: 'number' | 'percent' | 'text'; color: string; badge: string }) {
  const display = format === 'number' ? (typeof value === 'number' ? (value >= 1000 ? (value / 1000).toFixed(1) + 'K' : String(value)) : '0') : format === 'percent' ? (typeof value === 'number' ? value.toFixed(1) + '%' : '0%') : String(value)

  return (
    <motion.div whileHover={{ y: -10, scale: 1.02 }}
       className="bg-surface-card backdrop-blur-3xl rounded-[3.5rem] p-12 flex flex-col items-center text-center group border-2 border-surface-100 dark:border-surface-800 hover:border-primary-500/30 relative overflow-hidden shadow-2xl transition-all duration-500"
    >
      <div className="absolute top-0 right-0 p-12 opacity-[0.02] group-hover:opacity-[0.08] transition-opacity duration-1000 pointer-events-none"><Monitor size={200} /></div>
      <div className={`w-24 h-24 rounded-[2.5rem] bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 flex items-center justify-center mb-12 shadow-inner group-hover:rotate-12 transition-all duration-700`}>
        <Icon size={44} className={color} />
      </div>
      <div className={`text-6xl font-black italic tabular-nums leading-none tracking-tighter mb-5 text-surface-900 dark:text-white group-hover:text-primary-500 transition-colors duration-700`}>{display.toUpperCase()}</div>
      <div className="text-[12px] text-surface-400 dark:text-slate-500 font-black uppercase tracking-[0.5em] italic leading-none">{label}</div>
      <div className="text-[10px] text-surface-300 dark:text-slate-800 font-black uppercase tracking-[1em] mt-10 italic bg-surface-page dark:bg-surface-950/50 px-8 py-3 rounded-2xl border-2 border-surface-100 dark:border-surface-800 group-hover:text-primary-500 group-hover:border-primary-500/30 transition-all shadow-inner">{badge}</div>
    </motion.div>
  )
}
