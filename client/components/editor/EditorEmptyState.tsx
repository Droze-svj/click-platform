'use client'

import React from 'react'
import type { LucideIcon } from 'lucide-react'

/**
 * Drop-in empty state for editor views. Consistent visual treatment so the
 * dozen+ view components don't each invent their own "nothing here yet" UI.
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
  /** When provided, the icon tile uses this gradient (Tailwind `from-X to-Y`). */
  gradient?: string
  className?: string
}

export default function EditorEmptyState({
  icon: Icon,
  title,
  hint,
  action,
  gradient = 'from-fuchsia-500/15 to-violet-500/15',
  className = '',
}: Props) {
  return (
    <div className={`flex flex-col items-center justify-center text-center px-6 py-12 ${className}`}>
      {Icon && (
        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} border border-white/10 flex items-center justify-center mb-4`}>
          <Icon className="w-5 h-5 text-fuchsia-300" />
        </div>
      )}
      <h3 className="text-[12px] font-black text-white uppercase tracking-[0.22em] mb-2">{title}</h3>
      {hint && (
        <p className="text-[11px] text-slate-500 leading-relaxed max-w-[280px]">{hint}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/**
 * Skeleton — slim loader bar for "loading list of items" states. Keeps the
 * editor from flashing blank while async data resolves.
 */
export function EditorSkeleton({ rows = 4, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`} role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 rounded-xl bg-gradient-to-r from-white/[0.03] via-white/[0.06] to-white/[0.03] animate-pulse"
          style={{ animationDelay: `${i * 80}ms` } as React.CSSProperties} />
      ))}
    </div>
  )
}
