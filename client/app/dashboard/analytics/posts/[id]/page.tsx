'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Eye, Heart, Share2, Zap, Activity, Target, Cpu, TrendingUp,
  ArrowLeft, Waves,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

import { apiGet } from '../../../../../lib/api'
import SpectralLoader from '../../../../../components/SpectralLoader'
import { ErrorBoundary } from '../../../../../components/ErrorBoundary'
import { useTranslation } from '@/hooks/useTranslation'
import {
  Panel, StatCard, SectionHeader, EmptyState, Button, IconButton,
} from '@/components/ui'

interface PostStats {
  views: number;
  likes: number;
  shares: number;
  comments: number;
  engagement_rate: number;
}

interface PostAnalytics {
  post: any;
  analytics: PostStats[];
  insights: any;
  history: any[];
}

export default function SovereignPostDiagnosticHub() {
  const router = useRouter()
  const params = useParams()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PostAnalytics | null>(null)

  const loadDiagnosticMatrix = useCallback(async () => {
    try {
      setLoading(true)
      const postId = params.id as string
      const [details, historyRes] = await Promise.all([
        apiGet<any>(`/analytics/posts/${postId}`),
        apiGet<any>(`/analytics/history/${postId}`)
      ])
      setData({
        post: details.post,
        analytics: details.analytics || [],
        insights: details.insights,
        history: historyRes.history || historyRes.data || []
      })
    } catch (err) {
      console.error('Post analytics load failed:', err)
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => { loadDiagnosticMatrix() }, [loadDiagnosticMatrix])

  const chartData = useMemo(() => {
    if (!data?.history) return []
    return data.history.map(d => ({
      name: new Date(d.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      val: d.engagement_count || (d.likes + d.shares + d.comments) || 0,
      raw: d
    }))
  }, [data?.history])

  if (loading) return <SpectralLoader message={t('analyticsPostPage.loaderMessage')} />;

  if (!data) return (
    <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 max-w-[1700px] mx-auto text-theme-primary">
      <EmptyState
        icon={Target}
        title={t('analyticsPostPage.nodeNotFound')}
        className="py-24"
        action={
          <Button variant="secondary" size="md" onClick={() => router.push('/dashboard/analytics')}>
            {t('analyticsPostPage.backToAnalytics')}
          </Button>
        }
      />
    </div>
  )

  const mainStat = data.analytics[0] || { views: 0, likes: 0, shares: 0, comments: 0, engagement_rate: 0 }

  return (
    <ErrorBoundary>
      <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 max-w-[1700px] mx-auto overflow-x-hidden text-theme-primary">
        <SectionHeader
          as="h1"
          title={data.post.title || t('analyticsPostPage.untitledNode')}
          description={t('analyticsPostPage.subtitle')}
          className="mb-6"
          actions={
            <IconButton
              variant="secondary"
              size="md"
              aria-label={t('analyticsPostPage.backToAnalytics')}
              onClick={() => router.push('/dashboard/analytics')}
            >
              <ArrowLeft size={18} aria-hidden />
            </IconButton>
          }
        />

        {/* Real post metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard className="ds-hover-lift ds-anim-rise" label={t('analyticsPostPage.paramViews')} value={mainStat.views || 0} icon={Eye} />
          <StatCard className="ds-hover-lift ds-anim-rise" label={t('analyticsPostPage.paramLikes')} value={mainStat.likes || 0} icon={Heart} />
          <StatCard className="ds-hover-lift ds-anim-rise" label={t('analyticsPostPage.paramShares')} value={mainStat.shares || 0} icon={Share2} />
          <StatCard className="ds-hover-lift ds-anim-rise" label={t('analyticsPostPage.paramEngRate')} value={`${mainStat.engagement_rate || 0}%`} icon={Activity} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Kinetic path chart (real history) */}
          <div className="xl:col-span-2">
            <Panel variant="bento" className="ds-anim-rise p-6 h-full">
              <SectionHeader
                as="h2"
                title={t('analyticsPostPage.kineticPath')}
                description={t('analyticsPostPage.kineticPathSubtitle')}
                className="mb-6"
              />
              <div className="h-[320px] w-full">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorEngagement" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                      <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} axisLine={false} tickLine={false} dy={8} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} axisLine={false} tickLine={false} width={40} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="ds-surface-elevated p-3">
                                <p className="ds-text-caption mb-1">{payload[0].payload.name}</p>
                                <div className="ds-text-h3 text-theme-primary">{payload[0].value} <span className="ds-text-caption">{t('analyticsPostPage.engagements')}</span></div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area type="monotone" dataKey="val" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorEngagement)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState icon={Target} title={t('analyticsPostPage.nullPath')} className="h-full" />
                )}
              </div>
            </Panel>
          </div>

          {/* Diagnostic matrix (real insights) */}
          <Panel variant="bento" className="ds-anim-rise p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <Zap size={20} aria-hidden />
              </span>
              <SectionHeader as="h2" title={t('analyticsPostPage.diagnosticMatrix')} />
            </div>

            {data.insights ? (
              <div className="space-y-6 flex-1">
                <div className="text-center py-4">
                  <div className="ds-text-display text-emerald-500 tabular-nums">{data.insights.performance_score}</div>
                  <div className="ds-text-caption mt-2">{t('analyticsPostPage.signalIntegrity')}</div>
                </div>

                {data.insights.best_posting_time && (
                  <div className="space-y-2">
                    <span className="ds-text-label text-theme-secondary">{t('analyticsPostPage.optimalManifestWindow')}</span>
                    <Panel variant="subtle" className="p-4 ds-text-body text-theme-primary">
                      {data.insights.best_posting_time}
                    </Panel>
                  </div>
                )}

                {data.insights.metadata?.signalGaps?.length > 0 && (
                  <div className="space-y-2">
                    <span className="ds-text-label text-theme-secondary">{t('analyticsPostPage.signalGapsDetected')}</span>
                    <div className="flex flex-wrap gap-2">
                      {data.insights.metadata.signalGaps.map((gap: string, i: number) => (
                        <span key={i} className="px-3 py-1.5 rounded-lg bg-rose-500/10 ds-text-caption text-rose-500">{gap}</span>
                      ))}
                    </div>
                  </div>
                )}

                {data.insights.content_improvements?.length > 0 && (
                  <div className="space-y-2">
                    <span className="ds-text-label text-theme-secondary">{t('analyticsPostPage.generalOptimizations')}</span>
                    <div className="space-y-2">
                      {data.insights.content_improvements.map((imp: string, i: number) => (
                        <Panel key={i} variant="subtle" className="p-3 flex items-start gap-3">
                          <Activity size={16} className="text-violet-500 flex-shrink-0 mt-0.5" aria-hidden />
                          <span className="ds-text-body text-theme-secondary [overflow-wrap:anywhere]">{imp}</span>
                        </Panel>
                      ))}
                    </div>
                  </div>
                )}

                {(data.insights.performance_score != null || data.insights.metadata?.specificAdvice) && (
                  <div className="grid grid-cols-1 gap-3 pt-2 border-t border-[var(--border-subtle)]">
                    {data.insights.performance_score != null && (
                      <StatCard label={t('analyticsPostPage.potencyScore')} value={`${data.insights.performance_score}%`} icon={Target} />
                    )}
                    {data.insights.metadata?.predictiveROI != null && (
                      <StatCard label={t('analyticsPostPage.predictiveRoi')} value={`+${data.insights.metadata.predictiveROI}%`} icon={TrendingUp} />
                    )}
                    {data.insights.metadata?.specificAdvice && (
                      <Panel variant="subtle" className="p-4 flex items-start gap-3">
                        <Cpu size={18} className="text-violet-500 flex-shrink-0 mt-0.5" aria-hidden />
                        <div className="min-w-0">
                          <span className="ds-text-label text-theme-secondary block mb-1">{t('analyticsPostPage.strategicIntervention')}</span>
                          <p className="ds-text-body text-theme-primary [overflow-wrap:anywhere]">{data.insights.metadata.specificAdvice}</p>
                        </div>
                      </Panel>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                icon={Waves}
                title={t('analyticsPostPage.generateHeuristics')}
                description={t('analyticsPostPage.generateHeuristicsBody')}
                className="flex-1"
                action={
                  <Button
                    variant="primary"
                    size="md"
                    leftIcon={<Zap size={16} aria-hidden />}
                    onClick={() => router.push(`/dashboard/analytics/insights/${params.id}`)}
                  >
                    {t('analyticsPostPage.initiateScan')}
                  </Button>
                }
              />
            )}
          </Panel>
        </div>
      </div>
    </ErrorBoundary>
  )
}
