'use client'

import { Cloud, CloudOff, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import type { AutosaveStatus } from '@/hooks/useDraftAutosave'

/**
 * ClickAutosaveBadge — small status pill for the editor header. Reads
 * directly from useDraftAutosave's status + lastSavedAt and renders
 * a Click-flavored message so users see at all times that their work
 * is being saved.
 *
 * The badge is intentionally tiny — it lives in the editor toolbar
 * and reassures without distracting.
 */

interface ClickAutosaveBadgeProps {
  status: AutosaveStatus
  lastSavedAt: Date | null
  className?: string
}

function relativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

export default function ClickAutosaveBadge({
  status,
  lastSavedAt,
  className = '',
}: ClickAutosaveBadgeProps) {
  let icon: React.ReactNode
  let label: string
  let tone: string

  switch (status) {
    case 'saving':
      icon = <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
      label = 'Click is saving…'
      tone = 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20'
      break
    case 'saved':
      icon = <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
      label = lastSavedAt ? `Saved ${relativeTime(lastSavedAt)}` : 'Saved'
      tone = 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
      break
    case 'error':
      icon = <CloudOff className="w-3 h-3" aria-hidden="true" />
      label = 'Save failed — Click will retry'
      tone = 'text-rose-300 bg-rose-500/10 border-rose-500/20'
      break
    case 'conflict':
      icon = <AlertCircle className="w-3 h-3" aria-hidden="true" />
      label = 'Another tab edited this — refresh to merge'
      tone = 'text-amber-300 bg-amber-500/10 border-amber-500/20'
      break
    case 'idle':
    default:
      icon = <Cloud className="w-3 h-3" aria-hidden="true" />
      label = lastSavedAt ? `Saved ${relativeTime(lastSavedAt)}` : 'Click will save as you edit'
      tone = 'text-slate-400 bg-white/[0.03] border-white/[0.08]'
      break
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${tone} ${className}`}
      role="status"
      aria-live="polite"
      title={label}
    >
      {icon}
      <span>{label}</span>
    </div>
  )
}
