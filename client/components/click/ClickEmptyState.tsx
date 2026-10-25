'use client'

import { type ReactNode } from 'react'
import { clickVoice, type ClickIntent } from '@/lib/clickVoice'

/**
 * ClickEmptyState — replaces generic "No items yet" with Click's voice.
 *
 * Pass `intent` to pick the appropriate copy (e.g. 'empty.posts',
 * 'empty.clips'). Optionally pass `action` to render a CTA button below
 * the message — keeps the "Click is ready, you act next" rhythm.
 */

interface ClickEmptyStateProps {
  intent?: Extract<
    ClickIntent,
    | 'empty.posts'
    | 'empty.clips'
    | 'empty.scripts'
    | 'empty.scheduled'
    | 'empty.library'
    | 'empty.achievements'
    | 'empty.analytics'
    | 'empty.generic'
  >
  /** Override the body copy entirely. */
  message?: string
  /** Optional headline above the body. */
  title?: string
  /** Optional icon (Lucide or any ReactNode). */
  icon?: ReactNode
  /** Optional CTA — rendered below the copy. */
  action?: ReactNode
  className?: string
}

export default function ClickEmptyState({
  intent = 'empty.generic',
  message,
  title,
  icon,
  action,
  className = '',
}: ClickEmptyStateProps) {
  const copy = message ?? clickVoice(intent)

  return (
    <div
      className={`flex flex-col items-center justify-center text-center py-16 px-6 ${className}`}
    >
      {icon && (
        <div className="w-14 h-14 rounded-2xl ds-surface-subtle border border-subtle flex items-center justify-center mb-5 text-theme-muted">
          {icon}
        </div>
      )}
      {title && (
        <h3 className="ds-text-h3 text-theme-primary mb-2">
          {title}
        </h3>
      )}
      <p className="text-theme-muted text-sm max-w-md leading-relaxed">{copy}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
