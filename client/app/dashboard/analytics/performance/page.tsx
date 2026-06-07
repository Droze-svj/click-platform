'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  TrendingUp, RefreshCw, ArrowLeft, Activity,
  Eye, Zap, Boxes, Target,
} from 'lucide-react'
import { apiGet } from '../../../../lib/api'
import { StatsCardSkeleton, ContentSkeleton } from '../../../../components/LoadingSkeleton'
import ToastContainer from '../../../../components/ToastContainer'
import { ErrorBoundary } from '../../../../components/ErrorBoundary'
import { useTranslation } from '@/hooks/useTranslation'
import { cn } from '@/lib/utils'
import {
  Panel, StatCard, SectionHeader, EmptyState, Button, IconButton,
} from '@/components/ui'

interface PerformanceData {
  date: string
  views: number
  likes: number
  shares: number
  comments: number
  posts_count: number
}

interface PerformanceResponse {
  success: boolean
  period: string
  performance_data: PerformanceData[]
}

export default function FluxForecastingMatrixPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PerformanceData[]>([])
  const [period, setPeriod] = useState('30')

  const loadFluxPerformance = useCallback(async (isRefresh = false, triggerSync = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true)
      setError(null)
      const syncFlag = triggerSync ? '&sync=true' : ''
      const response = await apiGet<PerformanceResponse>(`/analytics/performance?period=${period}${syncFlag}`)
      setData(response.performance_data || [])
    } catch (err: any) {
      setError(err.message || 'FLUX_SYNC_INTERFACE_FAILURE')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [period])

  useEffect(() => {
    loadFluxPerformance()
  }, [loadFluxPerformance])

  const formatFmt = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
  }

  const getTotalResonance = () => {
    return data.reduce((acc, day) => ({
      views: acc.views + day.views,
      engage: acc.engage + (day.likes + day.shares + day.comments),
      posts: acc.posts + day.posts_count
    }), { views: 0, engage: 0, posts: 0 })
  }

  if (loading) return (
    <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 max-w-[1700px] mx-auto" aria-busy="true" aria-label={t('analyticsPerformancePage.loading')}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => <StatsCardSkeleton key={i} />)}
      </div>
      <ContentSkeleton />
    </div>
  )

  const stats = getTotalResonance()
  const engageRate = stats.views > 0 ? (stats.engage / stats.views * 100).toFixed(1) : '0'

  return (
    <ErrorBoundary>
      <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 max-w-[1700px] mx-auto overflow-x-hidden text-theme-primary">
        <ToastContainer />

        <SectionHeader
          as="h1"
          title={t('analyticsPerformancePage.title')}
          description={t('analyticsPerformancePage.subtitle')}
          className="mb-6"
          actions={
            <>
              <IconButton
                variant="secondary"
                size="md"
                aria-label={t('analyticsPerformancePage.backToAnalytics')}
                onClick={() => router.push('/dashboard/analytics')}
              >
                <ArrowLeft size={18} aria-hidden />
              </IconButton>
              <Button
                variant="primary"
                size="md"
                onClick={() => loadFluxPerformance(true, true)}
                loading={refreshing}
                leftIcon={!refreshing ? <RefreshCw size={16} aria-hidden /> : undefined}
              >
                {refreshing ? t('analyticsPerformancePage.interpreting') : t('analyticsPerformancePage.forceSync')}
              </Button>
            </>
          }
        />

        {/* Period selector */}
        <div className="flex items-center gap-1 mb-6 ds-surface-subtle p-1 w-fit rounded-xl">
          {['7', '30', '90'].map(p => (
            <button
              type="button"
              key={p}
              onClick={() => setPeriod(p)}
              aria-pressed={period === p ? 'true' : 'false'}
              aria-label={t('analyticsPerformancePage.viewCycles', { count: p })}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                period === p ? 'bg-primary/10 text-primary' : 'text-theme-secondary hover:text-theme-primary hover:bg-accent'
              )}
            >
              {t('analyticsPerformancePage.cyclesLabel', { count: p })}
            </button>
          ))}
        </div>

        {error && (
          <Panel variant="subtle" className="ds-anim-fade-in mb-6 border-rose-500/30 flex flex-col sm:flex-row items-center gap-4 p-5">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
              <Activity size={24} aria-hidden />
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <h3 className="ds-text-h3 text-theme-primary">{t('analyticsPerformancePage.errorTitle')}</h3>
              <p className="ds-text-caption mt-1">{error}</p>
            </div>
            <Button variant="secondary" size="md" onClick={() => loadFluxPerformance(true, true)}>
              {t('analyticsPerformancePage.retry')}
            </Button>
          </Panel>
        )}

        {/* Real totals */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard className="ds-hover-lift ds-anim-rise" label={t('analyticsPerformancePage.cardTotalSaturation')} value={formatFmt(stats.views)} icon={Eye} />
          <StatCard className="ds-hover-lift ds-anim-rise" label={t('analyticsPerformancePage.cardTotalResonance')} value={formatFmt(stats.engage)} icon={Zap} />
          <StatCard className="ds-hover-lift ds-anim-rise" label={t('analyticsPerformancePage.cardNodeDensity')} value={(stats.posts / parseInt(period)).toFixed(1)} icon={Boxes} />
          <StatCard className="ds-hover-lift ds-anim-rise" label={t('analyticsPerformancePage.cardKineticRate')} value={`${engageRate}%`} icon={Activity} />
        </div>

        {/* Temporal velocity bars */}
        <Panel variant="bento" className="ds-anim-rise mb-6 p-6">
          <SectionHeader
            as="h2"
            title={t('analyticsPerformancePage.temporalVelocity')}
            description={t('analyticsPerformancePage.temporalVelocitySubtitle')}
            className="mb-6"
          />
          {data.length > 0 ? (
            <div className="space-y-4">
              {data.slice(-parseInt(period)).map((day) => {
                const engagement = day.likes + day.shares + day.comments
                const maxEngage = Math.max(...data.map(d => d.likes + d.shares + d.comments))
                const maxViews = Math.max(...data.map(d => d.views))
                const engWidth = maxEngage > 0 ? (engagement / maxEngage) * 100 : 0
                const viewWidth = maxViews > 0 ? (day.views / maxViews) * 100 : 0
                return (
                  <div key={day.date} className="flex items-center gap-4">
                    <div className="w-20 flex-shrink-0 ds-text-caption tabular-nums">
                      {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                    <div className="flex-1 space-y-2 min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="h-2 bg-accent rounded-full flex-1 overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${viewWidth}%` }} />
                        </div>
                        <span className="w-16 text-right ds-text-caption tabular-nums">{formatFmt(day.views)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-2 bg-accent rounded-full flex-1 overflow-hidden">
                          <div className="h-full bg-amber-500" style={{ width: `${engWidth}%` }} />
                        </div>
                        <span className="w-16 text-right ds-text-caption text-amber-500 tabular-nums">{formatFmt(engagement)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState icon={Target} title={t('analyticsPerformancePage.nullFluxSignature')} description={t('analyticsPerformancePage.noResonanceData')} className="py-12" />
          )}
        </Panel>

        {/* Resonance ledger table */}
        <Panel variant="bento" className="ds-anim-rise overflow-hidden p-0">
          <div className="flex items-center justify-between gap-4 p-5 border-b border-[var(--border-subtle)]">
            <SectionHeader as="h2" title={t('analyticsPerformancePage.resonanceLedger')} className="min-w-0" />
          </div>
          {data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b border-[var(--border-subtle)]">
                  <tr>
                    {['Temporal_Coord', 'Saturation', 'Affinities', 'Signal_Resonance', 'Active_Nodes', 'Kinetic_Flux'].map(h => (
                      <th key={h} className="px-5 py-3 ds-text-caption font-semibold whitespace-nowrap">{t(`analyticsPerformancePage.tableHeader.${h}`)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {data.slice().reverse().map((day) => {
                    const engage = day.likes + day.shares + day.comments
                    const rate = day.views > 0 ? (engage / day.views * 100).toFixed(1) : '0'
                    return (
                      <tr key={day.date} className="hover:bg-accent transition-colors">
                        <td className="px-5 py-4 whitespace-nowrap ds-text-label text-theme-primary">
                          {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </td>
                        <td className="px-5 py-4 ds-text-body text-emerald-500 tabular-nums">{formatFmt(day.views)}</td>
                        <td className="px-5 py-4 ds-text-caption text-amber-500">
                          {t('analyticsPerformancePage.likesShares', { likes: formatFmt(day.likes), shares: formatFmt(day.shares) })}
                        </td>
                        <td className="px-5 py-4 ds-text-body text-theme-primary tabular-nums">{formatFmt(engage)}</td>
                        <td className="px-5 py-4 ds-text-caption text-indigo-500">{t('analyticsPerformancePage.phantoms', { count: day.posts_count })}</td>
                        <td className="px-5 py-4">
                          <span className="inline-flex rounded-lg bg-emerald-500/10 px-2.5 py-1 ds-text-caption font-semibold text-emerald-500 tabular-nums">{rate}%</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={TrendingUp} title={t('analyticsPerformancePage.noResonanceData')} className="py-12" />
          )}
        </Panel>
      </div>
    </ErrorBoundary>
  )
}
