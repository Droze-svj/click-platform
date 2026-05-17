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
      <div className={`rounded-[2rem] border-2 border-white/5 bg-black/40 backdrop-blur-3xl p-6 flex items-center gap-3 shadow-2xl ${className}`}>
        <Loader2 size={16} className="text-primary-400 animate-spin" />
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 italic">CALIBRATING_PERFORMANCE_METRICS…</span>
      </div>
    )
  }

  const totalEntries =
    insights.fonts.length + insights.captionStyles.length +
    insights.motions.length + insights.hooks.length

  if (totalEntries === 0) {
    return (
      <div className={`rounded-[2rem] border-2 border-white/5 bg-black/40 backdrop-blur-3xl p-6 shadow-2xl ${className}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary-500/10 border border-primary-500/20">
            <TrendingUp size={14} className="text-primary-400" />
          </div>
          <span className="text-[11px] font-black uppercase tracking-[0.3em] text-white italic">RETENTION_GENESIS</span>
        </div>
        <p className="text-[10px] text-slate-500 leading-relaxed italic uppercase font-bold tracking-wider">
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
        <div className="flex items-center gap-2 mb-3">
          <Icon size={12} className="text-primary-400" />
          <span className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-500 italic">{title}</span>
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
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all group ${
                    onApply
                      ? 'bg-white/[0.02] border-2 border-white/5 hover:border-primary-500/30 hover:bg-primary-500/5 active:scale-95 shadow-sm'
                      : 'bg-white/[0.01] border-2 border-white/5 opacity-50'
                  }`}
                >
                  <span className="text-[10px] text-white font-black uppercase tracking-widest truncate flex-1 italic group-hover:text-primary-400 transition-colors">{prettyKey(item.key)}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-mono font-black tabular-nums ${pct > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{lift}</span>
                    <span className="text-[8px] text-slate-600 font-mono font-black opacity-60">N={item.sampleSize}</span>
                  </div>
                  {onApply && <ChevronRight size={12} className="text-slate-700 group-hover:text-white transition-colors flex-shrink-0" />}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  return (
    <div className={`rounded-[2.5rem] border-2 border-primary-500/20 bg-black/40 backdrop-blur-3xl p-6 shadow-2xl relative overflow-hidden group ${className}`}>
      {/* Glow effect */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 blur-[60px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
      
      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary-500/10 border border-primary-500/20 shadow-inner">
             <TrendingUp size={14} className="text-primary-400" />
          </div>
          <span className="text-[11px] font-black uppercase tracking-[0.3em] text-white italic leading-none">RETENTION_MATRIX</span>
        </div>
        {lastIngestedAt && (
          <span className="text-[9px] font-mono font-black text-slate-600 uppercase tracking-tighter opacity-60 italic">{lastIngestedAt.toLocaleDateString()}</span>
        )}
      </div>
      <div className="space-y-6 relative z-10">
        <Section title="TOP_TYPOGRAPHY"          icon={TypeIcon} items={insights.fonts.slice(0, 3)}          onApply={onApplyFont} />
        <Section title="CAPTION_DNA" icon={Sparkles} items={insights.captionStyles.slice(0, 3)} onApply={onApplyCaptionStyle} />
        <Section title="KINETIC_MOTION"        icon={Wand2}    items={insights.motions.slice(0, 3)}        onApply={onApplyMotion} />
        <Section title="ENGAGEMENT_HOOKS"          icon={TrendingUp} items={insights.hooks.slice(0, 3)} />
      </div>
    </div>
  )
}

/** Strip CSS variable wrappers / dashes for display. */
function prettyKey(k: string): string {
  if (k.startsWith('var(--font-')) return k.match(/var\(--font-([a-z]+)\)/i)?.[1] || k
  return k.replace(/-/g, ' ').replace(/\b\w/g, m => m.toUpperCase())
}
