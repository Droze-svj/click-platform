'use client'

/**
 * QuickActionsBar — single-tap rail at the top of the editor with the
 * six most-used operations + a live status pill showing the user's
 * learned style. Closes the gap between "the editor has 33 categories
 * tucked into a sidebar" and "the user has 6 things they actually
 * want to do most edits".
 *
 *   🪄 Apply my style   — fetches /api/video/clips/style-insight and
 *                          applies the user's top color grade, caption
 *                          style, and transition. Same continuous-
 *                          learning loop the auto-edit HUD uses,
 *                          now also visible inside the manual editor.
 *   ✂  Split at playhead — calls back into the editor's existing handler
 *   ✍  Add captions      — jumps to text-motion category
 *   🎨 Color grade        — jumps to color category
 *   ⚡ Effects           — jumps to effects category
 *   🤖 AI Director        — jumps to ai category
 *
 * Designed to be placed between EditorHUD and the preview area so the
 * user always sees these regardless of which category the sidebar has
 * focused. Hides cleanly on small screens (sm:flex).
 */

import { useEffect, useState } from 'react'
import { Wand2, Scissors, Type, Palette, Zap, Sparkles, Loader2, Brain } from 'lucide-react'
import { apiGet } from '../../lib/api'
import type { EditorCategory } from '../../types/editor'

interface StyleInsight {
  source: 'user' | 'team' | 'defaults'
  totalPicks: number
  topPicks?: {
    preset?: string | null
    captionStyle?: string | null
    colorGrade?: string | null
    transition?: string | null
    hookStyle?: string | null
    musicGenre?: string | null
  }
}

interface Props {
  setActiveCategory: (c: EditorCategory) => void
  onSplitAtPlayhead?: () => void
  /**
   * Called with the resolved style insight when the user clicks
   * "Apply my style". The editor decides what to do with each top pick
   * (captionStyle → setCaptionStyle, colorGrade → setVideoFilters, etc).
   * Receiving the resolved insight rather than calling back per-field
   * keeps the contract narrow.
   */
  onApplyMyStyle?: (insight: StyleInsight) => void
  /** Optional toast callback so we can surface "Applied X" feedback. */
  showToast?: (msg: string, type?: 'info' | 'success' | 'error') => void
}

export default function QuickActionsBar({
  setActiveCategory,
  onSplitAtPlayhead,
  onApplyMyStyle,
  showToast,
}: Props) {
  const [insight, setInsight] = useState<StyleInsight | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  // Background fetch on mount so the pill can show "Click learned X"
  // without waiting for the user to click anything.
  useEffect(() => {
    let cancelled = false
    apiGet<any>('/video/clips/style-insight')
      .then((res) => {
        if (cancelled) return
        const data = res?.data ?? res
        if (data && typeof data === 'object') setInsight(data)
      })
      .catch(() => { /* silent — bar still works without learned data */ })
    return () => { cancelled = true }
  }, [])

  const handleApplyStyle = async () => {
    if (busy) return
    setBusy('apply')
    try {
      // Re-fetch in case publish loop ran while editor was open.
      const res: any = await apiGet('/video/clips/style-insight')
      const data = (res?.data ?? res) as StyleInsight | null
      if (data && data.source === 'user' && (data.totalPicks ?? 0) >= 3) {
        onApplyMyStyle?.(data)
        const tops = [
          data.topPicks?.colorGrade,
          data.topPicks?.captionStyle,
          data.topPicks?.transition,
        ].filter(Boolean)
        showToast?.(
          tops.length > 0
            ? `Applied your style: ${tops.join(' · ')}`
            : 'Applied your learned style.',
          'success'
        )
      } else {
        showToast?.('Publish 3 clips first so Click can learn your style.', 'info')
      }
    } catch (e: any) {
      showToast?.('Could not load your style. Try again.', 'error')
    } finally {
      setBusy(null)
    }
  }

  const learnedLabel = (() => {
    if (!insight || insight.source !== 'user' || (insight.totalPicks ?? 0) < 3) return null
    const top = insight.topPicks || {}
    const parts = [top.preset, top.colorGrade, top.captionStyle].filter(Boolean) as string[]
    return parts.length > 0 ? parts.slice(0, 3).join(' · ') : null
  })()

  return (
    // overflow-x-auto + flex-nowrap: rail scrolls horizontally on small
    // screens instead of being hidden, so mobile users can still tap
    // every action. The min-w-max trick keeps actions from squishing.
    <div className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-black/30 backdrop-blur-md border-b border-white/5 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex items-center gap-2 min-w-max">
        <Action icon={Wand2} label="Apply my style" loading={busy === 'apply'}
                onClick={handleApplyStyle} accent="primary" />

        {onSplitAtPlayhead && (
          <Action icon={Scissors} label="Split" longLabel="Split at playhead"
                  onClick={onSplitAtPlayhead} hotkey="S" />
        )}
        <Action icon={Type}    label="Captions"  onClick={() => setActiveCategory('text-motion')} hotkey="X" />
        <Action icon={Palette} label="Grade"     onClick={() => setActiveCategory('color')}      hotkey="5" />
        <Action icon={Zap}     label="Effects"   onClick={() => setActiveCategory('effects')}    hotkey="4" />
        <Action icon={Sparkles} label="AI"       onClick={() => setActiveCategory('ai')}         hotkey="A" />
      </div>

      {learnedLabel && (
        <span
          className="hidden md:inline-flex ml-auto items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-widest text-emerald-300 flex-shrink-0"
          title={`Click learned from ${insight!.totalPicks} of your published clips`}
        >
          <Brain className="w-3 h-3" />
          <span className="truncate max-w-[180px]">{learnedLabel}</span>
        </span>
      )}
    </div>
  )
}

function Action({
  icon: Icon,
  label,
  longLabel,
  onClick,
  hotkey,
  loading,
  accent,
}: {
  icon: any
  label: string
  /** Full label shown on md+ screens; short `label` shown otherwise. */
  longLabel?: string
  onClick: () => void
  hotkey?: string
  loading?: boolean
  accent?: 'primary'
}) {
  const base = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border whitespace-nowrap'
  const cls = accent === 'primary'
    ? `${base} bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white border-transparent shadow-sm`
    : `${base} bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-slate-200`
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`${cls} ${loading ? 'opacity-60 cursor-wait' : ''}`}
      title={hotkey ? `${label} (${hotkey})` : label}
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
      {longLabel ? (
        <>
          <span className="hidden md:inline">{longLabel}</span>
          <span className="md:hidden">{label}</span>
        </>
      ) : (
        <span>{label}</span>
      )}
      {hotkey && (
        <kbd className="hidden lg:inline-block ml-1 px-1 py-0 rounded bg-black/30 border border-white/10 text-[9px] font-mono text-slate-300">
          {hotkey}
        </kbd>
      )}
    </button>
  )
}
