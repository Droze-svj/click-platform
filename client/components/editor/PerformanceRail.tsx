'use client'

import React from 'react'
import { TrendingUp, Type as TypeIcon, Sparkles, Wand2, ChevronRight, Loader2, type LucideIcon } from 'lucide-react'
import { usePerformerInsights, type PerformerEntry } from '../../hooks/usePerformerInsights'

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
  className?: string
}

export default function PerformanceRail({
  onApplyFont, onApplyCaptionStyle, onApplyMotion, className = '',
}: Props) {
  const { insights, lastIngestedAt, loaded } = usePerformerInsights()

  if (!loaded) {
    return (
      <div className={`rounded-2xl border border-white/10 bg-white/[0.02] p-4 flex items-center gap-2 ${className}`}>
        <Loader2 size={12} className="text-fuchsia-400 animate-spin" />
        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Reading what's working for you…</span>
      </div>
    )
  }

  const totalEntries =
    insights.fonts.length + insights.captionStyles.length +
    insights.motions.length + insights.hooks.length

  if (totalEntries === 0) {
    return (
      <div className={`rounded-2xl border border-white/10 bg-white/[0.02] p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp size={12} className="text-fuchsia-400" />
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">What's working for you</span>
        </div>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          Publish your first edit and your top-performing picks land here. Click reads engagement and re-ranks suggestions toward what your audience watches.
        </p>
      </div>
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
        <div className="flex items-center gap-1.5 mb-1.5">
          <Icon size={10} className="text-fuchsia-300" />
          <span className="text-[8px] font-black uppercase tracking-[0.25em] text-slate-400">{title}</span>
        </div>
        <ul className="space-y-1">
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
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all ${
                    onApply
                      ? 'bg-white/[0.02] border border-white/10 hover:border-fuchsia-500/30 hover:bg-fuchsia-500/[0.06]'
                      : 'bg-white/[0.01] border border-white/5'
                  }`}
                >
                  <span className="text-[10px] text-slate-200 font-bold truncate flex-1">{prettyKey(item.key)}</span>
                  <span className={`text-[9px] font-mono tabular-nums ${pct > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{lift}</span>
                  <span className="text-[8px] text-slate-600 font-mono">n={item.sampleSize}</span>
                  {onApply && <ChevronRight size={10} className="text-slate-500 flex-shrink-0" />}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-500/[0.04] to-violet-500/[0.04] p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={12} className="text-fuchsia-300" />
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white">What's working for you</span>
        </div>
        {lastIngestedAt && (
          <span className="text-[8px] font-mono text-slate-500">{lastIngestedAt.toLocaleDateString()}</span>
        )}
      </div>
      <div className="space-y-3">
        <Section title="Fonts"          icon={TypeIcon} items={insights.fonts.slice(0, 3)}          onApply={onApplyFont} />
        <Section title="Caption styles" icon={Sparkles} items={insights.captionStyles.slice(0, 3)} onApply={onApplyCaptionStyle} />
        <Section title="Motions"        icon={Wand2}    items={insights.motions.slice(0, 3)}        onApply={onApplyMotion} />
        <Section title="Hooks"          icon={TrendingUp} items={insights.hooks.slice(0, 3)} />
      </div>
    </div>
  )
}

/** Strip CSS variable wrappers / dashes for display. */
function prettyKey(k: string): string {
  if (k.startsWith('var(--font-')) return k.match(/var\(--font-([a-z]+)\)/i)?.[1] || k
  return k.replace(/-/g, ' ').replace(/\b\w/g, m => m.toUpperCase())
}
