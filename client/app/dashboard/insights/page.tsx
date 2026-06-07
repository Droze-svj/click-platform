'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Target, Users, Sparkles, RefreshCw,
  Link2, Calendar, Zap, Globe, PieChart, Shield,
  Activity, ArrowUpRight, AlertCircle, type LucideIcon
} from 'lucide-react'
import { apiGet, apiPost } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'
import { useTranslation } from '@/hooks/useTranslation'
import ToastContainer from '../../../components/ToastContainer'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { StatsCardSkeleton, ContentSkeleton } from '../../../components/LoadingSkeleton'
import { Panel, Button, IconButton, StatCard, SectionHeader, Badge, EmptyState } from '../../../components/ui'
import { cn } from '../../../lib/utils'

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

function formatMetric(value: any, format: 'number' | 'percent' | 'text'): string {
  if (format === 'number') return typeof value === 'number' ? (value >= 1000 ? (value / 1000).toFixed(1) + 'K' : String(value)) : '0'
  if (format === 'percent') return typeof value === 'number' ? value.toFixed(1) + '%' : '0%'
  return String(value)
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
    <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 max-w-[1900px] mx-auto space-y-6" aria-busy="true" aria-label={t('insightsPage.loadingAria')}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <StatsCardSkeleton key={i} />)}
      </div>
      <ContentSkeleton />
    </div>
  );

  const reach = audienceInsights?.insights?.overview?.totalImpressions ?? platformAudience?.totalReach ?? 0
  const eng = audienceInsights?.insights?.overview?.totalEngagement ?? platformAudience?.totalEngagement ?? 0
  const engRate = audienceInsights?.insights?.overview?.engagementRate ?? platformAudience?.averageEngagementRate ?? 0
  const topPlatform = platformAudience?.topPlatform ?? t('insightsPage.notAvailable')
  const hasData = (Number(reach) || 0) > 0 || (Number(eng) || 0) > 0
  const platformDist = audienceInsights?.insights?.overview?.platformDistribution
  const recommendations = audienceInsights?.insights?.recommendations

  return (
    <ErrorBoundary>
      <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1900px] mx-auto overflow-x-hidden text-theme-primary">
        <ToastContainer />

        <SectionHeader
          as="h1"
          title={t('insightsPage.title')}
          className="mb-6"
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              {lastIngestedAt && (
                <Badge variant="secondary" className="gap-1.5" title={t('insightsPage.lastSyncTitle', { time: new Date(lastIngestedAt).toLocaleString() })}>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {t('insightsPage.updatedPrefix', { time: formatRelativeTime(lastIngestedAt) })}
                </Badge>
              )}
              <div className="flex items-center gap-1 p-1 rounded-lg ds-surface-subtle">
                {[7, 30, 90].map(p => (
                  <button type="button" key={p} onClick={() => setPeriod(p)}
                    className={cn(
                      'rounded-md px-3 h-8 text-xs font-medium transition-colors',
                      period === p ? 'bg-primary text-primary-foreground' : 'text-theme-secondary hover:text-theme-primary'
                    )}
                  >
                    {t('insightsPage.days', { count: p })}
                  </button>
                ))}
              </div>
              <Button
                variant="primary"
                size="md"
                onClick={handleSynchronizeCognitive}
                loading={syncing}
                disabled={syncing}
                leftIcon={<RefreshCw size={16} className={syncing ? 'animate-spin' : ''} aria-hidden />}
              >
                {syncing ? t('insightsPage.refreshing') : t('insightsPage.refresh')}
              </Button>
            </div>
          }
        />

        {error && (
          <Panel variant="subtle" className="mb-6 border border-rose-500/20 bg-rose-500/5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="text-rose-500" size={22} aria-hidden />
              <p className="font-medium text-rose-600 dark:text-rose-400">{error}</p>
            </div>
            <IconButton variant="ghost" size="sm" onClick={() => setError(null)} title={t('insightsPage.dismissError')} aria-label={t('insightsPage.dismissError')} className="text-rose-500">
              <AlertCircle size={16} aria-hidden />
            </IconButton>
          </Panel>
        )}

        {/* Connection status */}
        <Panel variant="bento" className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-primary shrink-0">
              <Link2 className="w-5 h-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h3 className="ds-text-h3 text-theme-primary">{t('insightsPage.connectedPlatforms')}</h3>
              <p className="text-sm text-theme-muted">
                {connectedCount > 0
                  ? t('insightsPage.platformsConnected', { count: connectedCount })
                  : t('insightsPage.connectToSee')}
              </p>
            </div>
          </div>
          <Button variant="primary" size="md" onClick={() => router.push('/dashboard/social')} rightIcon={<ArrowUpRight className="w-4 h-4" aria-hidden />} className="shrink-0">
            {connectedCount > 0 ? t('insightsPage.manage') : t('insightsPage.connectPlatform')}
          </Button>
        </Panel>

        {/* Honest empty-state when the user has no analytics yet. */}
        {!hasData && (
          <EmptyState
            icon={PieChart}
            title={t('insightsPage.noDataYet')}
            description={connectedCount > 0 ? t('insightsPage.noDataHintConnected') : t('insightsPage.noDataHintDisconnected')}
            className="mb-6 ds-surface-subtle"
          />
        )}

        {/* Real metrics — no fabricated deltas. */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Globe} label={t('insightsPage.metricReach')} value={formatMetric(reach, 'number')} />
          <StatCard icon={Activity} label={t('insightsPage.metricEngagement')} value={formatMetric(eng, 'number')} />
          <StatCard icon={Zap} label={t('insightsPage.metricEngagementRate')} value={formatMetric(engRate, 'percent')} />
          <StatCard icon={Target} label={t('insightsPage.metricTopPlatform')} value={formatMetric(topPlatform, 'text')} />
        </section>

        {/* Intelligence layers */}
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Audience */}
          <Panel variant="bento" className="flex flex-col">
            <h3 className="ds-text-h3 text-theme-primary flex items-center gap-2 mb-5">
              <Users size={18} className="text-primary" aria-hidden /> {t('insightsPage.audience')}
            </h3>
            {audienceInsights?.hasData || platformAudience ? (
              <div className="space-y-6">
                {platformDist && Object.keys(platformDist).length > 0 && (
                  <div className="space-y-3">
                    <p className="ds-text-label text-theme-muted">{t('insightsPage.postsByPlatform')}</p>
                    <div className="space-y-2">
                      {Object.entries(platformDist).map(([p, count]) => (
                        <div key={p} className="flex items-center justify-between gap-4 p-3 rounded-lg ds-surface-subtle">
                          <span className="text-sm font-medium text-theme-primary capitalize">{p}</span>
                          <div className="flex items-center gap-3">
                            <div className="hidden md:block w-40 h-2 rounded-full bg-accent overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min((count as number) * 10, 100)}%` }} />
                            </div>
                            <span className="text-sm font-semibold text-primary tabular-nums">{t('insightsPage.postsCount', { count: String(count) })}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {platformAudience?.bestPostingTime && (
                  <div className="flex items-center gap-4 p-4 rounded-xl ds-surface-subtle">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-primary shrink-0">
                      <Calendar size={20} aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="ds-text-label text-theme-muted">{t('insightsPage.bestTimeToPost')}</p>
                      <p className="ds-text-h3 text-theme-primary truncate">{platformAudience.bestPostingTime}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState icon={PieChart} title={t('insightsPage.noAudienceData')} className="flex-1" />
            )}
          </Panel>

          {/* Recommendations */}
          <Panel variant="bento" className="flex flex-col">
            <h3 className="ds-text-h3 text-theme-primary flex items-center gap-2 mb-5">
              <Sparkles size={18} className="text-primary" aria-hidden /> {t('insightsPage.recommendations')}
            </h3>
            {recommendations && recommendations.length > 0 ? (
              <div className="space-y-3">
                {recommendations.slice(0, 5).map((rec, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg ds-surface-subtle">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary shrink-0">
                      <Zap size={15} aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <span className="ds-text-caption text-primary font-semibold">{t('insightsPage.tip', { number: i + 1 })}</span>
                      <p className="text-sm text-theme-primary leading-snug">{rec}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={Shield} title={t('insightsPage.noTipsYet')} description={t('insightsPage.noTipsHint')} className="flex-1" />
            )}
          </Panel>
        </section>

        {/* Shortcuts */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          {([
            { label: t('insightsPage.shortcutAnalytics'), desc: t('insightsPage.shortcutAnalyticsDesc'), icon: Activity, href: '/dashboard/analytics' },
            { label: t('insightsPage.shortcutScheduler'), desc: t('insightsPage.shortcutSchedulerDesc'), icon: Calendar, href: '/dashboard/scheduler' },
            { label: t('insightsPage.shortcutAiStudio'), desc: t('insightsPage.shortcutAiStudioDesc'), icon: Sparkles, href: '/dashboard/content' },
          ] as { label: string; desc: string; icon: LucideIcon; href: string }[]).map((a) => {
            const AIcon = a.icon
            return (
              <button key={a.label} type="button" onClick={() => router.push(a.href)} className="text-left group">
                <Panel variant="bento" className="h-full">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-primary mb-4">
                    <AIcon size={20} aria-hidden />
                  </div>
                  <h4 className="ds-text-h3 text-theme-primary mb-1">{a.label}</h4>
                  <p className="text-sm text-theme-muted leading-relaxed">{a.desc}</p>
                  <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-primary">
                    {t('insightsPage.open')} <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" aria-hidden />
                  </div>
                </Panel>
              </button>
            )
          })}
        </section>
      </div>
    </ErrorBoundary>
  )
}
