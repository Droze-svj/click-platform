'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp, TrendingDown, BarChart3, Trophy,
  RefreshCw, Activity, Eye,
} from 'lucide-react'
import { apiGet } from '../../../../lib/api'
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

// Compact number formatting for views (e.g. 12500 → "12.5K").
function formatViews(n: number | undefined): string {
  const v = Number(n) || 0
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(v)
}

// One row in either the overperformer or underperformer list.
function OutlierRow({ video, kind }: { video: OutlierVideo; kind: 'over' | 'under' }) {
  const isOver = kind === 'over'
  const multiplier = Number(video?.multiplier) || 0
  const Trend = isOver ? TrendingUp : TrendingDown
  return (
    <li
      className={cn(
        'flex items-center justify-between gap-3 rounded-xl ds-surface-subtle px-4 py-3',
        !isOver && 'opacity-80'
      )}
    >
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
          <p className="ds-text-caption truncate">
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3 w-3" aria-hidden />
              {formatViews(video?.views)} views
            </span>
            <span className="text-theme-muted"> · {(Number(video?.vph) || 0).toFixed(1)} views/hr</span>
          </p>
        </div>
      </div>
      <Badge variant="secondary" className="shrink-0">
        {video?.platform ?? '—'}
      </Badge>
    </li>
  )
}

export default function OutliersPage() {
  const toast = useToast()

  const [report, setReport] = useState<OutlierResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadOutliers = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true)
    try {
      const res = await apiGet<OutlierEnvelope>('/api/seo/outliers')
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
          <Button
            variant="secondary"
            size="md"
            onClick={() => loadOutliers(true)}
            disabled={loading || refreshing}
            leftIcon={<RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} aria-hidden />}
          >
            Refresh
          </Button>
        }
      />

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
                {outliers.map((v, i) => (
                  <OutlierRow key={`${v?.contentId ?? 'over'}-${i}`} video={v} kind="over" />
                ))}
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
