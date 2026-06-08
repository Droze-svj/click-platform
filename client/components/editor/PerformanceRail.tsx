'use client'

import React from 'react'
import { TrendingUp, Type as TypeIcon, Sparkles, Wand2, ChevronRight, Loader2, Activity, Cpu, Layers, type LucideIcon } from 'lucide-react'
import { usePerformerInsights, type PerformerEntry } from '../../hooks/usePerformerInsights'
import { Panel, EmptyState } from '../ui'
import { cn } from '../../lib/utils'

/**
 * Real client-performance sampler — NO fabricated numbers.
 *  - fps: measured from actual requestAnimationFrame frame-times (rolling 1s).
 *  - heapMB: real JS heap via performance.memory (Chromium only); null where
 *    the API is unsupported so the UI can honestly show "n/a".
 */
interface LiveMetrics {
  fps: number | null
  heapMB: number | null
  heapLimitMB: number | null
}

function useLiveMetrics(active: boolean): LiveMetrics {
  const [metrics, setMetrics] = React.useState<LiveMetrics>({ fps: null, heapMB: null, heapLimitMB: null })

  React.useEffect(() => {
    if (!active || typeof window === 'undefined' || typeof requestAnimationFrame === 'undefined') return

    let rafId = 0
    let frames = 0
    let windowStart = performance.now()
    let last = windowStart
    let mounted = true

    const tick = (now: number) => {
      if (!mounted) return
      frames++
      last = now
      // Recompute roughly once per second from real elapsed frame count.
      const elapsed = now - windowStart
      if (elapsed >= 1000) {
        const fps = Math.round((frames * 1000) / elapsed)
        // performance.memory is non-standard (Chromium). Absent → null (n/a).
        const mem = (performance as any).memory
        const heapMB = mem && typeof mem.usedJSHeapSize === 'number'
          ? Math.round(mem.usedJSHeapSize / 1048576)
          : null
        const heapLimitMB = mem && typeof mem.jsHeapSizeLimit === 'number'
          ? Math.round(mem.jsHeapSizeLimit / 1048576)
          : null
        setMetrics({ fps, heapMB, heapLimitMB })
        frames = 0
        windowStart = now
      }
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => { mounted = false; cancelAnimationFrame(rafId); void last }
  }, [active])

  return metrics
}

/**
 * PerformanceRail — collapsible card surfaced in the editor's right rail.
 * Shows the creator's top-performing fonts / caption styles / motions /
 * hooks ordered by retention delta × log(sampleSize). Each chip is a
 * one-tap apply: callers wire the optional handlers to the editor's
 * existing TextMotionStudio / Inspector update paths.
 *
 * Renders nothing until the insights load (avoids layout shift) and shows
 * a friendly empty state when no performance data has been ingested yet,
 * pointing the user to publish their first post to seed the loop.
 */

interface Props {
  onApplyFont?: (fontKey: string) => void
  onApplyCaptionStyle?: (styleKey: string) => void
  onApplyMotion?: (motionKey: string) => void
  /**
   * Real editor stats measured by the parent (ModernVideoEditor). These are
   * genuine counts from live editor state — never fabricated. Omitted fields
   * render as "—".
   */
  editorStats?: {
    segmentCount?: number
    overlayCount?: number
  }
  className?: string
}

export default function PerformanceRail({
  onApplyFont, onApplyCaptionStyle, onApplyMotion, editorStats, className = '',
}: Props) {
  const { insights, lastIngestedAt, loaded } = usePerformerInsights()
  // Sample live client metrics only while the rail is actually mounted/visible.
  const live = useLiveMetrics(true)

  const metricsBlock = (
    <div className="grid grid-cols-3 gap-2 mb-5">
      <LiveMetric icon={Activity} label="FPS"
        value={live.fps == null ? '—' : String(live.fps)} />
      <LiveMetric icon={Cpu} label="Heap"
        value={live.heapMB == null ? 'n/a' : `${live.heapMB}MB`} />
      <LiveMetric icon={Layers} label="Layers"
        value={
          editorStats == null
            ? '—'
            : String((editorStats.segmentCount ?? 0) + (editorStats.overlayCount ?? 0))
        } />
    </div>
  )

  if (!loaded) {
    return (
      <Panel variant="glass" className={cn('ds-elev-2 p-6 flex items-center gap-3', className)}>
        <Loader2 size={16} className="text-primary animate-spin" aria-hidden />
        <span className="ds-text-caption text-theme-muted">Calibrating performance metrics…</span>
      </Panel>
    )
  }

  const totalEntries =
    insights.fonts.length + insights.captionStyles.length +
    insights.motions.length + insights.hooks.length

  if (totalEntries === 0) {
    return (
      <Panel variant="glass" className={cn('ds-elev-2 p-6', className)}>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <TrendingUp size={16} aria-hidden />
          </div>
          <span className="ds-text-label text-theme-primary">Retention insights</span>
        </div>
        {metricsBlock}
        <EmptyState
          icon={TrendingUp}
          title="No performance data yet"
          description="Publish your first edit and your top-performing picks land here. Click reads engagement and re-ranks suggestions toward what your audience watches."
          className="p-0"
        />
      </Panel>
    )
  }

  const Section = ({ title, icon: Icon, items, onApply }: {
    title: string
    icon: LucideIcon
    items: PerformerEntry[]
    onApply?: (key: string) => void
  }) => {
    if (items.length === 0) return null
    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Icon size={14} className="text-primary" aria-hidden />
          <span className="ds-text-label text-theme-muted">{title}</span>
        </div>
        <ul className="space-y-2">
          {items.map(item => {
            const pct = Math.round(item.performanceScore * 100)
            const sign = pct >= 0 ? '+' : ''
            const lift = `${sign}${pct}%`
            return (
              <li key={item.key}>
                <button
                 type="button"
                  onClick={() => onApply?.(item.key)}
                  disabled={!onApply}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all group ds-surface-card',
                    onApply
                      ? 'ds-hover-lift hover:border-primary/30'
                      : 'opacity-50'
                  )}
                >
                  <span className="ds-text-body font-medium text-theme-primary truncate flex-1 group-hover:text-primary transition-colors">{prettyKey(item.key)}</span>
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs font-mono font-semibold tabular-nums', pct > 0 ? 'text-emerald-500' : 'text-rose-500')}>{lift}</span>
                    <span className="text-[10px] text-theme-muted font-mono tabular-nums">N={item.sampleSize}</span>
                  </div>
                  {onApply && <ChevronRight size={14} className="text-theme-muted group-hover:text-theme-primary transition-colors flex-shrink-0" aria-hidden />}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  return (
    <Panel variant="glass" className={cn('ds-elev-3 p-6', className)}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <TrendingUp size={16} aria-hidden />
          </div>
          <span className="ds-text-label text-theme-primary leading-none">Retention matrix</span>
        </div>
        {lastIngestedAt && (
          <span className="text-[10px] font-mono text-theme-muted tabular-nums">{lastIngestedAt.toLocaleDateString()}</span>
        )}
      </div>
      {metricsBlock}
      <div className="space-y-6">
        <Section title="Top typography"  icon={TypeIcon}   items={insights.fonts.slice(0, 3)}         onApply={onApplyFont} />
        <Section title="Caption styles"  icon={Sparkles}   items={insights.captionStyles.slice(0, 3)} onApply={onApplyCaptionStyle} />
        <Section title="Motion"          icon={Wand2}      items={insights.motions.slice(0, 3)}       onApply={onApplyMotion} />
        <Section title="Engagement hooks" icon={TrendingUp} items={insights.hooks.slice(0, 3)} />
      </div>
    </Panel>
  )
}

/**
 * A single real-metric tile. Value is whatever the caller measured — including
 * the honest "—" / "n/a" placeholders for metrics that aren't measurable in
 * the current browser. Never displays a synthetic number.
 */
function LiveMetric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  const unavailable = value === '—' || value === 'n/a'
  return (
    <div className="ds-surface-card px-2 py-2.5 flex flex-col items-center gap-1">
      <Icon size={13} className={unavailable ? 'text-theme-muted' : 'text-primary'} aria-hidden />
      <span className={cn('text-sm font-mono font-semibold tabular-nums leading-none', unavailable ? 'text-theme-muted' : 'text-theme-primary')}>{value}</span>
      <span className="ds-text-caption text-theme-muted leading-none">{label}</span>
    </div>
  )
}

/** Strip CSS variable wrappers / dashes for display. */
function prettyKey(k: string): string {
  if (k.startsWith('var(--font-')) return k.match(/var\(--font-([a-z]+)\)/i)?.[1] || k
  return k.replace(/-/g, ' ').replace(/\b\w/g, m => m.toUpperCase())
}
