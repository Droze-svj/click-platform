'use client'

import React from 'react'
import type { LucideIcon } from 'lucide-react'
import { EmptyState } from '../ui'
import { cn } from '../../lib/utils'

/**
 * Drop-in empty state for editor views. Consistent visual treatment so the
 * dozen+ view components don't each invent their own "nothing here yet" UI.
 * Restyled onto the 2026 design system: thin wrapper over the shared
 * `EmptyState` primitive so every editor view matches the calm chrome.
 *
 *   <EditorEmptyState
 *     icon={Layers}
 *     title="No effects applied"
 *     hint="Drop a preset on a clip to start."
 *     action={<button>Browse presets</button>}
 *   />
 */

interface Props {
  icon?: LucideIcon
  title: string
  hint?: string
  action?: React.ReactNode
  /**
   * Retained for API compatibility — previously tinted the icon tile. The 2026
   * system uses a single calm accent tile, so this is accepted but not styled.
   */
  gradient?: string
  className?: string
}

export default function EditorEmptyState({
  icon: Icon,
  title,
  hint,
  action,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  gradient,
  className = '',
}: Props) {
  return (
    <EmptyState
      icon={Icon}
      title={title}
      description={hint}
      action={action}
      className={cn('px-6 py-12', className)}
    />
  )
}

/**
 * Skeleton — slim loader bar for "loading list of items" states. Keeps the
 * editor from flashing blank while async data resolves.
 */
export function EditorSkeleton({ rows = 4, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 rounded-xl ds-surface-subtle motion-safe:animate-pulse"
          style={{ animationDelay: `${i * 80}ms` } as React.CSSProperties} />
      ))}
    </div>
  )
}
