'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp, TrendingDown, BarChart3, Trophy,
  RefreshCw, Activity, Eye, RotateCw, Sparkles, ChevronDown, Lightbulb,
} from 'lucide-react'
import { apiGet, apiPost } from '../../../../lib/api'
import { cn } from '../../../../lib/utils'
import { useToast } from '../../../../contexts/ToastContext'
import ToastContainer from '../../../../components/ToastContainer'
import {
  Panel,
  StatCard,
  Badge,
  EmptyState,
  SectionHeader,
  Button,
} from '../../../../components/ui'

// ── Live response shape from GET /api/seo/outliers ──
// Only fields the backend actually returns are typed/rendered — nothing fabricated.
interface OutlierVideo {
  contentId?: string
  platform?: string
  views?: number
  vph?: number
  multiplier?: number
  externalId?: string
  title?: string
}

interface OutlierResponse {
  baseline?: number | null
  metric?: string
  outliers?: OutlierVideo[]
  underperformers?: OutlierVideo[]
  count?: number
  available?: boolean
  reason?: string
}

// apiGet resolves to the raw response body: { data: OutlierResponse }
interface OutlierEnvelope {
  data?: OutlierResponse
}

// ── POST /api/seo/sync ──
interface SyncResponse {
  available?: boolean
  synced?: number
  reason?: string
}
interface SyncEnvelope {
  data?: SyncResponse
}

// ── GET /api/seo/video-retention/:externalId ──
// Per-second retention drill-down for a single video. Only what the
// backend returns is typed/rendered — unavailable states stay honest.
interface RetentionDropOff {
  second?: number
  dropPct?: number
  severity?: string
  recommendation?: string
}
interface RetentionRewatchPeak {
  second?: number
  gainPct?: number
}
interface RetentionRecommendation {
  type?: string
  priority?: string
  message?: string
  second?: number
}
interface RetentionInsight {
  available?: boolean
  source?: string
  externalId?: string
  title?: string
  durationSec?: number
  avgViewPercent?: number
  hookScore?: number
  dropOffs?: RetentionDropOff[]
  rewatchPeaks?: RetentionRewatchPeak[]
  recommendations?: RetentionRecommendation[]
  reason?: string
}
interface RetentionEnvelope {
  data?: RetentionInsight
}

// Compact number formatting for views (e.g. 12500 → "12.5K").
function formatViews(n: number | undefined): string {
  const v = Number(n) || 0
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(v)
}

// Small inline stat used inside the retention drill-down panel.
function RetentionStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg ds-surface-card px-3 py-2">
      <p className="text-base font-bold tabular-nums leading-tight text-theme-primary">{value}</p>
      <p className="text-[11px] uppercase tracking-wide text-theme-muted">{label}</p>
    </div>
  )
}

// Inline "Why it worked" retention panel rendered under an overperformer row.
function RetentionPanel({
  insight,
  loading,
}: {
  insight: RetentionInsight | undefined
  loading: boolean
}) {
  if (loading) {
    return <div className="ds-surface-subtle h-24 animate-pulse rounded-xl" aria-hidden />
  }
  if (!insight) return null

  if (insight.available === false) {
    return (
      <p className="text-sm text-theme-muted">
        No retention data yet for this video{insight.reason ? ` (${insight.reason})` : ''}.
      </p>
    )
  }

  const hookScore = insight.hookScore
  const avgViewPercent = insight.avgViewPercent
  const recommendations = (insight.recommendations ?? []).filter((r) => !!r?.message)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:max-w-xs">
        <RetentionStat
          label="Hook score"
          value={typeof hookScore === 'number' ? hookScore.toFixed(0) : '—'}
        />
        <RetentionStat
          label="Avg. view %"
          value={typeof avgViewPercent === 'number' ? `${avgViewPercent.toFixed(0)}%` : '—'}
        />
      </div>

      {recommendations.length === 0 ? (
        <p className="text-sm text-theme-muted">
          No specific recommendations for this video yet.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {recommendations.map((rec, i) => (
            <li
              key={`${rec?.type ?? 'rec'}-${i}`}
              className="flex items-start gap-2 text-sm text-theme-primary"
            >
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden />
              <span>{rec?.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface OutlierRowProps {
  video: OutlierVideo
  kind: 'over' | 'under'
  // Drill-down wiring (overperformers with an externalId only).
  expanded?: boolean
  retentionLoading?: boolean
  retention?: RetentionInsight
  onToggleRetention?: (externalId: string) => void
}

// One row in either the overperformer or underperformer list.
function OutlierRow({
  video,
  kind,
  expanded = false,
  retentionLoading = false,
  retention,
  onToggleRetention,
}: OutlierRowProps) {
  const isOver = kind === 'over'
  const multiplier = Number(video?.multiplier) || 0
  const Trend = isOver ? TrendingUp : TrendingDown
  const externalId = video?.externalId
  const canDrillDown = isOver && !!externalId && !!onToggleRetention

  return (
    <li
      className={cn(
        'rounded-xl ds-surface-subtle px-4 py-3',
        !isOver && 'opacity-80'
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg shrink-0',
              isOver
                ? 'bg-emerald-500/10 text-emerald-500'
                : 'bg-theme-muted/10 text-theme-muted'
            )}
          >
            <Trend className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p
              className={cn(
                'text-lg font-bold tabular-nums leading-tight',
                isOver ? 'text-emerald-500' : 'text-theme-muted'
              )}
            >
              {multiplier > 0 ? `${multiplier.toFixed(1)}×` : '—'}
              <span className="text-xs font-normal text-theme-muted"> your median</span>
            </p>
            {video?.title ? (
              <p className="ds-text-caption truncate font-medium text-theme-primary">
                {video.title}
              </p>
            ) : null}
            <p className="ds-text-caption truncate">
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3 w-3" aria-hidden />
                {formatViews(video?.views)} views
              </span>
              <span className="text-theme-muted"> · {(Number(video?.vph) || 0).toFixed(1)} views/hr</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canDrillDown ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleRetention?.(externalId!)}
              disabled={retentionLoading}
              leftIcon={
                retentionLoading ? (
                  <RotateCw size={14} className="animate-spin" aria-hidden />
                ) : (
                  <ChevronDown
                    size={14}
                    className={cn('transition-transform', expanded && 'rotate-180')}
                    aria-hidden
                  />
                )
              }
              aria-expanded={expanded}
            >
              Why it worked
            </Button>
          ) : null}
          <Badge variant="secondary">{video?.platform ?? '—'}</Badge>
        </div>
      </div>

      {canDrillDown && expanded ? (
        <div className="mt-3 border-t border-theme-subtle pt-3">
          <RetentionPanel insight={retention} loading={retentionLoading} />
        </div>
      ) : null}
    </li>
  )
}

export default function OutliersPage() {
  const toast = useToast()

  const [report, setReport] = useState<OutlierResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [syncing, setSyncing] = useState(false)

  // Per-video retention drill-down: which row is open, which is loading,
  // and a cache keyed by externalId so re-opening doesn't refetch.
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [retentionLoadingId, setRetentionLoadingId] = useState<string | null>(null)
  const [retentionById, setRetentionById] = useState<Record<string, RetentionInsight>>({})

  const loadOutliers = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true)
    try {
      const res = await apiGet<OutlierEnvelope>('/seo/outliers')
      setReport(res?.data ?? null)
    } catch {
      toast.error('Failed to load performance outliers.')
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }, [toast])

  useEffect(() => {
    loadOutliers()
  }, [loadOutliers])

  const handleSync = useCallback(async () => {
    setSyncing(true)
    try {
      const res = await apiPost<SyncEnvelope>('/seo/sync', {})
      const data = res?.data
      const available = data?.available
      const synced = Number(data?.synced) || 0
      if (available && synced > 0) {
        toast.success(`Synced ${synced} videos from your channel`)
        await loadOutliers(true)
      } else if (available === false) {
        toast.error(data?.reason || 'Connect your YouTube channel first')
      } else {
        // available but nothing new to sync
        toast.info('Your channel is already up to date.')
      }
    } catch {
      toast.error('Failed to sync your channel. Please try again.')
    } finally {
      setSyncing(false)
    }
  }, [toast, loadOutliers])

  const handleToggleRetention = useCallback(
    async (externalId: string) => {
      // Collapse if this row is already open.
      if (expandedId === externalId) {
        setExpandedId(null)
        return
      }
      setExpandedId(externalId)

      // Use cached insight when we already have it.
      if (retentionById[externalId]) return

      setRetentionLoadingId(externalId)
      try {
        const res = await apiGet<RetentionEnvelope>(
          '/seo/video-retention/' + encodeURIComponent(externalId)
        )
        const insight = res?.data ?? { available: false }
        setRetentionById((prev) => ({ ...prev, [externalId]: insight }))
      } catch {
        toast.error('Failed to load retention insight for this video.')
        // Leave it uncached so the user can retry by re-opening.
        setExpandedId((cur) => (cur === externalId ? null : cur))
      } finally {
        setRetentionLoadingId((cur) => (cur === externalId ? null : cur))
      }
    },
    [expandedId, retentionById, toast]
  )

  const outliers = report?.outliers ?? []
  const underperformers = report?.underperformers ?? []
  const baseline = report?.baseline ?? null
  const totalAnalyzed = report?.count ?? (outliers.length + underperformers.length)
  const unavailable =
    !!report && (report.available === false || report.reason === 'insufficient_data')

  return (
    <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1700px] mx-auto overflow-x-hidden text-theme-primary space-y-8">
      <ToastContainer />

      <SectionHeader
        as="h1"
        title="Performance Outliers"
        description="See which of your videos overperform — and which fall flat — so you can do more of what works."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="md"
              onClick={handleSync}
              disabled={syncing || loading || refreshing}
              leftIcon={
                syncing ? (
                  <RotateCw size={16} className="animate-spin" aria-hidden />
                ) : (
                  <Sparkles size={16} aria-hidden />
                )
              }
            >
              {syncing ? 'Syncing…' : 'Sync my channel'}
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => loadOutliers(true)}
              disabled={loading || refreshing || syncing}
              leftIcon={<RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} aria-hidden />}
            >
              Refresh
            </Button>
          </div>
        }
      />

      <p className="-mt-4 text-sm text-theme-muted">
        Sync pulls your whole channel — including videos published outside Click — so outliers cover everything.
      </p>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="ds-surface-card h-28 animate-pulse" aria-hidden />
            ))}
          </div>
          <div className="ds-surface-card h-64 animate-pulse" aria-hidden />
        </div>
      )}

      {/* Not enough data — never fabricate outliers. */}
      {!loading && unavailable && (
        <EmptyState
          icon={BarChart3}
          title="Not enough data yet"
          description="We need at least 3 published videos with view metrics before we can compare them. Publish a few more and check back — your outliers will appear here automatically."
          className="ds-surface-card"
        />
      )}

      {/* Content */}
      {!loading && report && !unavailable && (
        <>
          {/* 1 ── Summary StatCards ── */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label="Your median views"
              value={baseline === null ? '—' : formatViews(baseline)}
              icon={Activity}
            />
            <StatCard label="Overperformers" value={outliers.length} icon={Trophy} />
            <StatCard label="Videos analyzed" value={totalAnalyzed} icon={BarChart3} />
          </section>

          <p className="text-sm text-theme-muted">
            The baseline is your OWN median views across your published videos — this is a per-channel
            comparison, not a global benchmark. A multiplier of 3.2× means that video earned 3.2 times
            your typical post.
          </p>

          {/* 2 ── Overperformers ── */}
          <Panel variant="bento" className="space-y-4">
            <SectionHeader as="h2" title="Overperformers — do more of this" />
            {outliers.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="No standout overperformers yet."
                description="None of your videos are pulling meaningfully ahead of your median right now."
                className="ds-surface-subtle"
              />
            ) : (
              <ul className="space-y-2">
                {outliers.map((v, i) => {
                  const externalId = v?.externalId
                  return (
                    <OutlierRow
                      key={`${v?.contentId ?? v?.externalId ?? 'over'}-${i}`}
                      video={v}
                      kind="over"
                      expanded={!!externalId && expandedId === externalId}
                      retentionLoading={!!externalId && retentionLoadingId === externalId}
                      retention={externalId ? retentionById[externalId] : undefined}
                      onToggleRetention={handleToggleRetention}
                    />
                  )
                })}
              </ul>
            )}
          </Panel>

          {/* 3 ── Underperformers ── */}
          <Panel variant="bento" className="space-y-4">
            <SectionHeader as="h2" title="Underperformers" />
            {underperformers.length === 0 ? (
              <EmptyState
                icon={TrendingDown}
                title="No clear underperformers."
                description="Nothing is trailing far below your median — your output is fairly consistent."
                className="ds-surface-subtle"
              />
            ) : (
              <ul className="space-y-2">
                {underperformers.map((v, i) => (
                  <OutlierRow key={`${v?.contentId ?? 'under'}-${i}`} video={v} kind="under" />
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  )
}
