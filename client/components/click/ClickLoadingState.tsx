'use client'

import { clickVoice, type ClickIntent } from '@/lib/clickVoice'
import ClickSignal, { type ClickSignalState } from './ClickSignal'

/**
 * ClickLoadingState — replaces generic <Loader2 spin /> + "Loading…" with
 * Click's living <ClickSignal /> motif + Click's voice. Use this anywhere
 * there's a pending or active AI synthesis state.
 *
 * Variants are picked by clickVoice() per-session so the same load
 * doesn't flicker, but different sessions feel alive.
 */

interface ClickLoadingStateProps {
  /** Which loading flavor. Defaults to plain "loading". Pick the one
   *  that matches the work — e.g. 'loading.rendering' on the render
   *  page, 'loading.analyzing' on style-insight calls. */
  intent?: Extract<
    ClickIntent,
    | 'loading'
    | 'loading.thinking'
    | 'loading.analyzing'
    | 'loading.rendering'
    | 'loading.publishing'
    | 'loading.learning'
  >
  /** Optional override message — skip clickVoice entirely. */
  message?: string
  /** Stable id (e.g. contentId) to keep the variant consistent for a given item. */
  seedHint?: string | number
  /** Display style — 'inline' (one line) or 'block' (centered card). Defaults to 'block'. */
  variant?: 'inline' | 'block'
  className?: string
}

function signalStateForIntent(intent: NonNullable<ClickLoadingStateProps['intent']>): ClickSignalState {
  if (intent === 'loading.rendering' || intent === 'loading.analyzing' || intent === 'loading.learning') {
    return 'synthesizing'
  }
  return 'thinking'
}

export default function ClickLoadingState({
  intent = 'loading',
  message,
  seedHint,
  variant = 'block',
  className = '',
}: ClickLoadingStateProps) {
  const copy = message ?? clickVoice(intent, seedHint)
  const signalState = signalStateForIntent(intent)

  if (variant === 'inline') {
    return (
      <span
        role="status"
        aria-live="polite"
        className={`inline-flex items-center gap-2 text-theme-muted text-sm ${className}`}
      >
        <ClickSignal state={signalState} size="xs" />
        <span>{copy}</span>
      </span>
    )
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-4 py-12 ${className}`}
    >
      <div className="click-aperture-icon w-14 h-14">
        <ClickSignal state={signalState} size="md" />
      </div>
      <p className="text-theme-muted text-sm font-medium">{copy}</p>
    </div>
  )
}
