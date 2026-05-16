'use client'

import { Loader2 } from 'lucide-react'
import { clickVoice, type ClickIntent } from '@/lib/clickVoice'

/**
 * ClickLoadingState — replaces generic <Loader2 spin /> + "Loading…" with
 * a spinner + Click's voice. Use this anywhere there's a pending state.
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

export default function ClickLoadingState({
  intent = 'loading',
  message,
  seedHint,
  variant = 'block',
  className = '',
}: ClickLoadingStateProps) {
  const copy = message ?? clickVoice(intent, seedHint)

  if (variant === 'inline') {
    return (
      <span
        role="status"
        aria-live="polite"
        className={`inline-flex items-center gap-2 text-slate-400 text-sm ${className}`}
      >
        <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
        <span>{copy}</span>
      </span>
    )
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-3 py-12 ${className}`}
    >
      <Loader2 className="w-6 h-6 animate-spin text-indigo-400" aria-hidden="true" />
      <p className="text-slate-400 text-sm">{copy}</p>
    </div>
  )
}
