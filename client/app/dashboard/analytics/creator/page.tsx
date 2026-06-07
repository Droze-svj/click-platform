'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Eye, Heart, Share2, Zap, Target, Play, RefreshCw, ArrowLeft,
  ArrowUp, ArrowDown, Minus, Brain, Sparkles,
  Lightbulb, AlertTriangle, MessageSquare, TrendingDown, Radio,
  Network, Fingerprint, Boxes, X, Music, Instagram, Youtube, Video as VideoIcon,
  type LucideIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ErrorBoundary } from '../../../../components/ErrorBoundary'
import ToastContainer from '../../../../components/ToastContainer'
import { apiGet, apiPost } from '../../../../lib/api'
import { StatsCardSkeleton, ContentSkeleton } from '../../../../components/LoadingSkeleton'
import { useTranslation } from '@/hooks/useTranslation'
import { useContainerWidth } from '@/hooks/useContainerWidth'
import { cn } from '@/lib/utils'
import {
  Panel,
  StatCard,
  SectionHeader,
  EmptyState,
  Button,
  IconButton,
} from '@/components/ui'

// ── Types ─────────────────────────────────────────────────────────────────────
interface VideoStat {
  id: string; title: string; platform: 'tiktok' | 'instagram' | 'youtube' | 'other';
  views: number; likes: number; shares: number; comments: number; completionRate: number;
  hookDropOff: number; editStyle: string; filterUsed?: string; hookType: string;
  publishedAt: string; viralScore: number; trend: 'up' | 'down' | 'flat';
  engagementRate: number;
}

/** Verified lucide@0.294.0 icons for the common platforms. */
function platformIcon(platform: string): LucideIcon {
  const p = (platform || '').toLowerCase()
  if (p === 'tiktok') return Music
  if (p === 'instagram') return Instagram
  if (p === 'youtube') return Youtube
  return VideoIcon
}

// ── Utils ──────────────────────────────────────────────────────────────────────
const fmt = (n: number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n/1000).toFixed(0)}K` : n.toString()
const scoreTone = (s: number) =>
  s >= 80 ? 'bg-emerald-500/10 text-emerald-500' : s >= 60 ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'

export default function HeuristicMatrixPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const { ref: shellRef, width } = useContainerWidth<HTMLDivElement>()
  const [videos, setVideos] = useState<VideoStat[]>([])
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'views' | 'viralScore' | 'completionRate' | 'engagementRate'>('views')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState<VideoStat | null>(null)

  // useCallback so the reference is stable across renders + the
  // useEffect below can declare the dep without re-firing on every
  // render. Without it, the manual reload button captured a stale
  // closure when the auth token refreshed mid-session.
  const fetchStats = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await apiGet('/analytics/creator/stats')
      const raw: any[] = res.stats || []
      // The API returns null for metrics a post doesn't actually report. Coerce
      // to honest, non-fabricated display defaults (0 / 'Unknown' / 'flat') so
      // the UI never crashes and never shows an invented value like "55%".
      const list: VideoStat[] = raw.map(v => ({
        ...v,
        completionRate: v.completionRate ?? 0,
        hookDropOff: v.hookDropOff ?? 0,
        editStyle: v.editStyle || 'Unknown',
        hookType: v.hookType || 'unknown',
        trend: v.trend || 'flat',
        viralScore: v.viralScore ?? 0,
      }))
      setVideos(list)
      // Auto-ingest each unique post into the editor's learning brain. We
      // mark seen ids in localStorage so we don't double-count when the
      // analytics page re-renders. The endpoint itself is idempotent on
      // dev users; in prod it weighted-averages so re-ingestion would
      // gradually re-weight rather than corrupt.
      try {
        const seenKey = 'click.style-profile.ingested'
        const seen = new Set<string>(JSON.parse(localStorage.getItem(seenKey) || '[]'))
        // Only ingest posts that actually report a completion rate — feeding a
        // fabricated default into the learning brain would skew the profile.
        const fresh = raw.filter(v => v?.id && !seen.has(v.id) && typeof v.completionRate === 'number')
        if (fresh.length) {
          await Promise.allSettled(fresh.map(v => apiPost('/style-profile/ingest-post', {
            contentId: v.id,
            metrics: {
              completionRate: v.completionRate / 100,
              retentionRate:  v.completionRate / 100,
              viewCount: v.views,
              likes: v.likes,
              shares: v.shares,
              comments: v.comments,
              benchmarkRetention: 0.55,
            },
          })))
          fresh.forEach(v => seen.add(v.id))
          localStorage.setItem(seenKey, JSON.stringify(Array.from(seen).slice(-200)))
        }
      } catch { /* ingestion is best-effort — analytics view still renders */ }
    } catch (err) {
      console.error('Failed to fetch creator stats', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  const filtered = useMemo(() =>
    videos
      .filter(v => selectedPlatform === 'all' || v.platform === selectedPlatform)
      .sort((a, b) => b[sortBy] - a[sortBy]),
    [videos, selectedPlatform, sortBy]
  )

  const totals = useMemo(() => {
    // Guard against empty arrays — divisions would otherwise produce NaN and
    // React's "Received NaN for the children attribute" warning fires for
    // every renderer that displays these values.
    const n = videos.length || 1
    const empty = videos.length === 0
    return {
      views: videos.reduce((s, v) => s + v.views, 0),
      likes: videos.reduce((s, v) => s + v.likes, 0),
      shares: videos.reduce((s, v) => s + v.shares, 0),
      comments: videos.reduce((s, v) => s + v.comments, 0),
      avgCompletion: empty ? 0 : Math.round(videos.reduce((s, v) => s + v.completionRate, 0) / n),
      avgViralScore: empty ? 0 : Math.round(videos.reduce((s, v) => s + v.viralScore, 0) / n),
      avgEngagement: empty ? 0 : parseFloat((videos.reduce((s, v) => s + v.engagementRate, 0) / n).toFixed(1)),
    }
  }, [videos])

  const styleAttribution = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {}
    videos.forEach(v => {
      if (!map[v.editStyle]) map[v.editStyle] = { total: 0, count: 0 }
      map[v.editStyle].total += v.completionRate
      map[v.editStyle].count += 1
    })
    return Object.entries(map)
      .map(([style, { total, count }]) => ({ style, avg: Math.round(total / count) }))
      .sort((a, b) => b.avg - a.avg)
  }, [videos])

  const bestEditStyle = styleAttribution[0]?.style || '—'

  const aiSummary = useMemo(() => {
    const worstVideo = [...videos].sort((a, b) => a.hookDropOff - b.hookDropOff).reverse()[0]
    const bestVideo = [...videos].sort((a, b) => b.viralScore - a.viralScore)[0]
    return {
      headline: t('analyticsCreatorPage.aiHeadline', { hookType: bestVideo?.hookType.replace(/-/g, '_').toUpperCase() }),
      action: t('analyticsCreatorPage.aiAction', { title: worstVideo?.title.substring(0, 35), dropOff: worstVideo?.hookDropOff }),
      opportunity: t('analyticsCreatorPage.aiOpportunity', { style: bestEditStyle.toUpperCase(), views: Math.round(totals.views * 0.18 / 1000) }),
    }
  }, [videos, bestEditStyle, totals.views, t])

  // Narrow content: hide the per-row views column so nothing overflows.
  const compact = width > 0 && width < 640

  if (loading) return (
     <div className="min-h-screen ds-bg-mesh-soft px-4 sm:px-6 lg:px-10 py-8 max-w-[1700px] mx-auto" aria-busy="true" aria-label={t('analyticsCreatorPage.loading')}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
           {Array.from({ length: 4 }).map((_, i) => <StatsCardSkeleton key={i} />)}
        </div>
        <ContentSkeleton />
     </div>
  )

  const hasVideos = videos.length > 0

  return (
    <ErrorBoundary>
      <div
        ref={shellRef}
        className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 max-w-[1700px] mx-auto overflow-x-hidden text-theme-primary"
      >
        <ToastContainer />

        <SectionHeader
          as="h1"
          title={t('analyticsCreatorPage.title')}
          description={t('analyticsCreatorPage.subtitle')}
          className="mb-6"
          actions={
            <>
              <Button
                variant="secondary"
                size="md"
                leftIcon={<ArrowLeft size={16} aria-hidden />}
                onClick={() => router.push('/dashboard/analytics')}
                aria-label={t('analyticsCreatorPage.backToMatrix')}
              >
                {t('analyticsCreatorPage.backToMatrix')}
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={fetchStats}
                loading={refreshing}
                leftIcon={!refreshing ? <RefreshCw size={16} aria-hidden /> : undefined}
                aria-label={t('analyticsCreatorPage.refreshMatrixStats')}
              >
                {t('analyticsCreatorPage.refreshNodes')}
              </Button>
            </>
          }
        />

        {/* Platform filter */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {['all', 'tiktok', 'instagram', 'youtube'].map(p => (
            <Button
              key={p}
              variant={selectedPlatform === p ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setSelectedPlatform(p)}
              aria-label={t('analyticsCreatorPage.filterBy', { platform: p === 'all' ? t('analyticsCreatorPage.cluster') : p.toUpperCase() })}
            >
              {p === 'all' ? t('analyticsCreatorPage.clusterUpper') : p.toUpperCase()}
            </Button>
          ))}
        </div>

        {/* ── Real aggregate metrics (from /analytics/creator/stats) ─────── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <StatCard className="ds-hover-lift ds-anim-rise" label={t('analyticsCreatorPage.stripSpectralViews')} value={fmt(totals.views)} icon={Eye} />
          <StatCard className="ds-hover-lift ds-anim-rise" label={t('analyticsCreatorPage.stripAffinityLikes')} value={fmt(totals.likes)} icon={Heart} />
          <StatCard className="ds-hover-lift ds-anim-rise" label={t('analyticsCreatorPage.stripSignalShares')} value={fmt(totals.shares)} icon={Share2} />
          <StatCard className="ds-hover-lift ds-anim-rise" label={t('analyticsCreatorPage.stripResonanceComms')} value={fmt(totals.comments)} icon={MessageSquare} />
          <StatCard className="ds-hover-lift ds-anim-rise col-span-2 lg:col-span-1" label={t('analyticsCreatorPage.stripLogicSync')} value={`${totals.avgCompletion}%`} icon={Play} />
        </div>

        {/* ── AI synthesis (real aiSummary derived from real metrics) ────── */}
        {hasVideos && (
          <Panel variant="bento" className="ds-anim-rise mb-6 p-6">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-indigo-500" aria-hidden />
              <span className="ds-text-label text-theme-primary">{t('analyticsCreatorPage.engineSynthesis')}</span>
              <div className={cn('ml-auto flex h-10 items-center gap-2 rounded-xl px-3', scoreTone(totals.avgViralScore))}>
                <span className="text-lg font-bold tabular-nums leading-none">{totals.avgViralScore}</span>
                <span className="ds-text-caption">{t('analyticsCreatorPage.potency')}</span>
              </div>
            </div>
            <p className="ds-text-h3 text-theme-primary mt-3 [overflow-wrap:anywhere]">
              &ldquo;{aiSummary.headline}&rdquo;
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              <div className="flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-4">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500">
                  <AlertTriangle size={18} aria-hidden />
                </span>
                <div className="min-w-0">
                  <div className="ds-text-label text-rose-500">{t('analyticsCreatorPage.protocolTermination')}</div>
                  <p className="ds-text-body text-theme-secondary mt-1">{aiSummary.action}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                  <Lightbulb size={18} aria-hidden />
                </span>
                <div className="min-w-0">
                  <div className="ds-text-label text-emerald-500">{t('analyticsCreatorPage.heuristicExpansion')}</div>
                  <p className="ds-text-body text-theme-secondary mt-1">{aiSummary.opportunity}</p>
                </div>
              </div>
            </div>
          </Panel>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_minmax(0,420px)] gap-6">
          {/* ── Operational nodes (real node list) ──────────────────────── */}
          <Panel variant="bento" className="ds-anim-rise overflow-hidden p-0">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-5 border-b border-[var(--border-subtle)]">
              <SectionHeader
                as="h2"
                title={t('analyticsCreatorPage.operationalNodes')}
                description={t('analyticsCreatorPage.operationalNodesSubtitle')}
                className="min-w-0"
              />
              <div className="flex flex-wrap items-center gap-2">
                {(['views', 'viralScore', 'completionRate', 'engagementRate'] as const).map(s => (
                  <Button
                    key={s}
                    variant={sortBy === s ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setSortBy(s)}
                  >
                    {s === 'views' ? t('analyticsCreatorPage.sortViews') : s === 'viralScore' ? t('analyticsCreatorPage.sortPotency') : s === 'completionRate' ? t('analyticsCreatorPage.sortSync') : t('analyticsCreatorPage.sortSignal')}
                  </Button>
                ))}
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {filtered.length === 0 ? (
                <EmptyState icon={Boxes} title={t('analyticsCreatorPage.operationalNodes')} className="py-16" />
              ) : (
                <ul className="divide-y divide-[var(--border-subtle)]">
                  {filtered.map((video, idx) => {
                    const PIcon = platformIcon(video.platform)
                    const isSelected = selectedVideo?.id === video.id
                    return (
                      <li key={video.id}>
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label={t('analyticsCreatorPage.viewDiagnosticFor', { title: video.title })}
                          onClick={() => setSelectedVideo(isSelected ? null : video)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedVideo(isSelected ? null : video) }}
                          className={cn(
                            'flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 cursor-pointer transition-colors group',
                            isSelected ? 'bg-primary/10' : 'hover:bg-accent'
                          )}
                        >
                          <span className="ds-text-caption tabular-nums w-6 flex-shrink-0 text-theme-muted">{String(idx + 1).padStart(2, '0')}</span>
                          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
                            <PIcon size={18} aria-hidden />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="ds-text-label text-theme-primary truncate">{video.title}</p>
                            <p className="ds-text-caption flex items-center gap-2 flex-wrap">
                              <span className="inline-flex items-center gap-1"><Target size={11} aria-hidden /> {t('analyticsCreatorPage.nodeSignal', { value: video.hookType.replace(/-/g, '_') })}</span>
                              <span aria-hidden>·</span>
                              <span>{t('analyticsCreatorPage.nodeSubstrate', { value: video.editStyle })}</span>
                            </p>
                          </div>
                          {!compact && (
                            <div className="text-right flex-shrink-0">
                              <div className="ds-text-h3 text-theme-primary tabular-nums leading-none">{fmt(video.views)}</div>
                              <div className="ds-text-caption mt-0.5">{t('analyticsCreatorPage.veSaturation')}</div>
                            </div>
                          )}
                          <div className={cn('flex h-11 w-11 flex-shrink-0 flex-col items-center justify-center rounded-xl', scoreTone(video.viralScore))}>
                            <span className="text-sm font-bold leading-none tabular-nums">{video.viralScore}</span>
                            <span className="text-[8px] font-semibold mt-0.5 uppercase tracking-wide">{t('analyticsCreatorPage.sortPotency')}</span>
                          </div>
                          <span className="flex-shrink-0">
                            {video.trend === 'up'   && <ArrowUp   size={18} className="text-emerald-500" aria-hidden />}
                            {video.trend === 'down' && <ArrowDown size={18} className="text-rose-500" aria-hidden />}
                            {video.trend === 'flat' && <Minus     size={18} className="text-theme-muted" aria-hidden />}
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-[var(--border-subtle)]">
              <span className="ds-text-caption">{t('analyticsCreatorPage.operationalNodesSubtitle')}</span>
              <span className="ds-text-caption text-theme-secondary tabular-nums">{filtered.length}</span>
            </div>
          </Panel>

          {/* ── Right column: real style attribution + selected diagnostic ─ */}
          <div className="space-y-6">
            <Panel variant="bento" className="ds-anim-rise p-6">
              <div className="flex items-center gap-2 mb-4">
                <Brain size={18} className="text-indigo-500" aria-hidden />
                <span className="ds-text-label text-theme-primary">{t('analyticsCreatorPage.substrateSyncVelocity')}</span>
              </div>
              {styleAttribution.length === 0 ? (
                <p className="ds-text-caption">{t('analyticsCreatorPage.geneticContentDna')}</p>
              ) : (
                <div className="space-y-4">
                  {styleAttribution.map(({ style, avg }) => (
                    <div key={style}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="ds-text-label text-theme-secondary truncate pr-3">{style}</span>
                        <span className="ds-text-label text-indigo-500 tabular-nums">{avg}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-accent overflow-hidden">
                        <div className="h-full rounded-full bg-indigo-500/60" style={{ width: `${Math.min(100, avg)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {selectedVideo && (
              <Panel variant="elevated" className="ds-anim-rise p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Target size={18} className="text-indigo-500" aria-hidden />
                  <span className="ds-text-label text-theme-primary">{t('analyticsCreatorPage.nodeSpectrumDetail')}</span>
                  <IconButton
                    variant="ghost"
                    size="sm"
                    aria-label={t('analyticsCreatorPage.dismissDiagnostic')}
                    onClick={() => setSelectedVideo(null)}
                    className="ml-auto"
                  >
                    <X size={16} aria-hidden />
                  </IconButton>
                </div>
                <h3 className="ds-text-h3 text-theme-primary mb-4 [overflow-wrap:anywhere]">{selectedVideo.title}</h3>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { label: t('analyticsCreatorPage.metricSignalLoss'), value: `${selectedVideo.hookDropOff}%`, bad: selectedVideo.hookDropOff > 20, icon: TrendingDown },
                    { label: t('analyticsCreatorPage.metricSyncRate'), value: `${selectedVideo.completionRate}%`, good: selectedVideo.completionRate > 65, icon: Radio },
                    { label: t('analyticsCreatorPage.metricSignalAffinity'), value: `${selectedVideo.engagementRate}%`, good: selectedVideo.engagementRate > 8, icon: Network },
                    { label: t('analyticsCreatorPage.metricNeuralPotency'), value: `${selectedVideo.viralScore}`, good: selectedVideo.viralScore >= 75, icon: Fingerprint },
                  ].map(m => (
                    <div
                      key={m.label}
                      className={cn(
                        'rounded-xl border p-4',
                        m.good ? 'border-emerald-500/20 bg-emerald-500/[0.06]' : m.bad ? 'border-rose-500/20 bg-rose-500/[0.06]' : 'border-[var(--border-subtle)] bg-accent'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="ds-text-caption">{m.label}</span>
                        <m.icon size={16} className={m.good ? 'text-emerald-500' : m.bad ? 'text-rose-500' : 'text-theme-muted'} aria-hidden />
                      </div>
                      <div className="ds-text-h2 text-theme-primary tabular-nums mt-1">{m.value}</div>
                    </div>
                  ))}
                </div>
                <p className="ds-text-body text-theme-muted rounded-xl bg-accent p-4 border-l-2 border-l-indigo-500">
                  {t('analyticsCreatorPage.auditResult', { dropOff: selectedVideo.hookDropOff })}
                </p>
                <Button
                  variant="primary"
                  size="md"
                  className="w-full mt-4"
                  onClick={() => setSelectedVideo(null)}
                  rightIcon={<X size={16} aria-hidden />}
                  aria-label={t('analyticsCreatorPage.dismissDiagnostic')}
                >
                  {t('analyticsCreatorPage.dismissDiagnosticLabel')}
                </Button>
              </Panel>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}
