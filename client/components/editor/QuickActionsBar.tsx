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

import { useEffect, useRef, useState } from 'react'
import { Wand2, Scissors, Type, Palette, Zap, Sparkles, Loader2, Brain, Eraser, Shuffle, Film, TrendingUp, Rocket } from 'lucide-react'
import { apiGet, apiPost } from '../../lib/api'
import type { EditorCategory } from '../../types/editor'
import { Badge } from '../ui'
import { cn } from '../../lib/utils'

const STYLE_INSIGHT_TIMEOUT_MS = 8000

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
  /** The clip / content currently loaded in the editor — required for the
   *  variant / B-roll / trends actions to know what to operate on. When
   *  unset, those actions are hidden. */
  contentId?: string | null
  /** Caption / hook text from the loaded clip — fed into the variant
   *  generator so it has a base to riff on. */
  baseContent?: string | null
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
  /**
   * Opens the in-editor SmartCleanupPanel — runs silence-cut / filler-
   * removal / edit-by-text on the current videoId. Keeps these tools
   * inside the editor instead of bouncing the user to a separate page.
   */
  onOpenSmartCleanup?: () => void
  /**
   * The one-click catalyst. Runs the full Auto Viral Edit (beat-synced cuts +
   * varied transitions + karaoke captions with keyword-highlight + auto-emoji)
   * in a single tap. When unset, the headline button is hidden.
   */
  onAutoViralEdit?: () => void | Promise<void>
  /** True while the Auto Viral Edit is running (drives the spinner). */
  autoViralBusy?: boolean
  /** Optional toast callback so we can surface "Applied X" feedback. */
  showToast?: (msg: string, type?: 'info' | 'success' | 'error') => void
}

export default function QuickActionsBar({
  contentId,
  baseContent,
  setActiveCategory,
  onSplitAtPlayhead,
  onApplyMyStyle,
  onOpenSmartCleanup,
  onAutoViralEdit,
  autoViralBusy,
  showToast,
}: Props) {
  const [insight, setInsight] = useState<StyleInsight | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const pendingRef = useRef(false)

  // Background fetch on mount so the pill can show "Click learned X"
  // without waiting for the user to click anything. Times out at 8s so a
  // stalled API never leaves consumers waiting forever.
  useEffect(() => {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), STYLE_INSIGHT_TIMEOUT_MS)
    apiGet<any>('/video/clips/style-insight', { signal: ac.signal })
      .then((res) => {
        if (ac.signal.aborted) return
        const data = res?.data ?? res
        if (data && typeof data === 'object') setInsight(data)
      })
      .catch(() => { /* silent — bar still works without learned data */ })
      .finally(() => clearTimeout(timer))
    return () => {
      clearTimeout(timer)
      ac.abort()
    }
  }, [])

  /**
   * Generate 3 caption / hook variants for the current clip using the
   * existing /api/ai/variants endpoint. Surfaces them via a toast that
   * the editor can capture and route into the A/B picker. Cheap to call;
   * no UI panel needed for V1.
   */
  const handleGenerateVariants = async () => {
    if (busy) return
    if (!baseContent || !baseContent.trim()) {
      showToast?.('Add a caption or hook first so the variant generator has something to riff on.', 'info')
      return
    }
    setBusy('variants')
    try {
      const res: any = await apiPost('/ai/variants', { content: baseContent, count: 3 })
      const variants: string[] = res?.data?.variants || res?.variants || []
      if (variants.length === 0) {
        showToast?.('No variants returned — try a longer base hook.', 'info')
      } else {
        showToast?.(`Generated ${variants.length} variants — open A/B picker to preview.`, 'success')
        // Broadcast so the editor (or A/B drawer) can pick them up without
        // tight coupling. Listeners attach in EditorMain or wherever the
        // variant picker lives.
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('click:variants', {
            detail: { contentId, variants },
          }))
        }
      }
    } catch (err: any) {
      showToast?.(`Variants failed: ${err?.message || 'unknown error'}`, 'error')
    } finally {
      setBusy(null)
    }
  }

  /**
   * Ask the B-roll intelligence service for a plan of stock-footage
   * insertions for the current clip. The result is a list of {startTime,
   * duration, url, keyword} entries; we dispatch them on a window event so
   * the timeline can splice them in. No-op without a contentId.
   */
  const handleSuggestBRoll = async () => {
    if (busy) return
    if (!contentId) {
      showToast?.('Load a clip first to suggest B-roll.', 'info')
      return
    }
    setBusy('broll')
    try {
      const res: any = await apiPost(`/video/ai-editing/broll/${contentId}`, {})
      const plan = res?.data?.plan || res?.plan || []
      if (!Array.isArray(plan) || plan.length === 0) {
        showToast?.('No B-roll gaps detected — your clip is already visually dense.', 'info')
      } else {
        showToast?.(`Suggested ${plan.length} B-roll insertions. Open the timeline to review.`, 'success')
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('click:broll-plan', {
            detail: { contentId, plan },
          }))
        }
      }
    } catch (err: any) {
      showToast?.(`B-roll suggest failed: ${err?.message || 'unknown error'}`, 'error')
    } finally {
      setBusy(null)
    }
  }

  /**
   * Pull current trending sounds + hashtags for the clip's platform.
   * Cached on the server to avoid hammering trend APIs every click.
   */
  const handleTrending = async () => {
    if (busy) return
    setBusy('trending')
    try {
      const res: any = await apiGet('/trends/now?platform=tiktok')
      const trends = res?.data || res
      const sounds = trends?.sounds?.length || 0
      const hashtags = trends?.hashtags?.length || 0
      if (sounds === 0 && hashtags === 0) {
        showToast?.('Trend feed is warming up — try again in a minute.', 'info')
      } else {
        showToast?.(`Trending now: ${sounds} sounds · ${hashtags} hashtags. Picker opening.`, 'success')
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('click:trends', { detail: { trends } }))
        }
      }
    } catch (err: any) {
      showToast?.(`Trends fetch failed: ${err?.message || 'unknown error'}`, 'error')
    } finally {
      setBusy(null)
    }
  }

  const handleApplyStyle = async () => {
    if (pendingRef.current || busy) return
    pendingRef.current = true
    setBusy('apply')
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), STYLE_INSIGHT_TIMEOUT_MS)
    try {
      // Re-fetch in case publish loop ran while editor was open.
      const res: any = await apiGet('/video/clips/style-insight', { signal: ac.signal })
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
      if (ac.signal.aborted) {
        showToast?.('Your style request timed out. Try again.', 'error')
      } else {
        showToast?.('Could not load your style. Try again.', 'error')
      }
    } finally {
      clearTimeout(timer)
      pendingRef.current = false
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
    <div className="flex items-center gap-3 px-4 sm:px-6 py-3 ds-surface-card rounded-none border-x-0 border-t-0 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden relative z-40">
      <div className="flex items-center gap-3 min-w-max">
        {/* The headline: one tap = beat-cut + varied transitions + karaoke
            captions w/ keyword-highlight + auto-emoji. The whole creative
            engine fired at once. */}
        {onAutoViralEdit && (
          <Action icon={Rocket} label="Viral Edit" longLabel="Auto Viral Edit — one-tap full edit"
                  onClick={onAutoViralEdit} loading={!!autoViralBusy} accent="primary" hotkey="G" />
        )}

        <Action icon={Wand2} label="Apply style" loading={busy === 'apply'}
                onClick={handleApplyStyle} accent="primary" />

        {onSplitAtPlayhead && (
          <Action icon={Scissors} label="Split" longLabel="Split at playhead"
                  onClick={onSplitAtPlayhead} hotkey="S" />
        )}
        <Action icon={Type}    label="Captions"  onClick={() => setActiveCategory('text-motion')} hotkey="X" />
        <Action icon={Palette} label="Grade"     onClick={() => setActiveCategory('color')}      hotkey="5" />
        <Action icon={Zap}     label="Effects"   onClick={() => setActiveCategory('effects')}    hotkey="4" />
        <Action icon={Sparkles} label="AI tools"     onClick={() => setActiveCategory('ai')}         hotkey="A" />
        {onOpenSmartCleanup && (
          <Action icon={Eraser} label="Clean" longLabel="Smart cleanup"
                  onClick={onOpenSmartCleanup} hotkey="C" />
        )}
        {/* Three competitive-edge actions wired to existing services. The
            backing routes already exist; these buttons surface them in
            one tap so users don't have to dig through sub-menus. */}
        <Action icon={Shuffle} label="Variants" longLabel="A/B variants"
                onClick={handleGenerateVariants} loading={busy === 'variants'} hotkey="V" />
        {contentId && (
          <Action icon={Film} label="B-roll" longLabel="Suggest B-roll"
                  onClick={handleSuggestBRoll} loading={busy === 'broll'} hotkey="B" />
        )}
        <Action icon={TrendingUp} label="Trends" longLabel="Trending now"
                onClick={handleTrending} loading={busy === 'trending'} hotkey="T" />
      </div>

      {learnedLabel && (
        <Badge
          variant="outline"
          className="hidden lg:flex ml-auto items-center gap-2 px-3 py-1.5 border-emerald-500/30 text-emerald-500 flex-shrink-0 font-medium normal-case"
          title={`Click learned from ${insight!.totalPicks} of your published clips`}
        >
          <Brain className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
          <span className="truncate max-w-[150px] lg:max-w-[220px]">{learnedLabel}</span>
        </Badge>
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
  longLabel?: string
  onClick: () => void
  hotkey?: string
  loading?: boolean
  accent?: 'primary'
}) {
  const base = 'inline-flex items-center justify-center w-10 h-10 rounded-xl transition-all active:scale-95 group relative flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
  const cls = accent === 'primary'
    ? cn(base, 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm')
    : cn(base, 'ds-surface-subtle border border-subtle text-theme-secondary hover:text-theme-primary')

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-label={loading ? `${longLabel || label} — loading` : (hotkey ? `${longLabel || label} (shortcut ${hotkey})` : (longLabel || label))}
      className={cn(cls, loading && 'opacity-60 cursor-wait')}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}

      {/* Tooltip */}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50">
        <div className="ds-surface-elevated text-theme-primary text-[11px] font-medium px-3 py-1.5 rounded-lg whitespace-nowrap">
          {longLabel || label}
          {hotkey && <span className="ml-2 text-theme-muted border border-subtle rounded px-1">{hotkey}</span>}
        </div>
      </div>
    </button>
  )
}
