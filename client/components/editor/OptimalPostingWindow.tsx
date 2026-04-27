'use client'

import React, { useEffect, useState } from 'react'
import { Clock, TrendingUp, Loader2, Send } from 'lucide-react'
import { apiGet } from '../../lib/api'
import { useWorkflow } from '../../contexts/WorkflowContext'

/**
 * OptimalPostingWindow — drop-in widget that surfaces the 3 best posting
 * windows for the creator's current niche × platform with rationale and
 * confidence. Reads from /marketing-intelligence/optimal-windows which
 * layers platform peaks + niche windows (and, once analytics ingestion is
 * live, the creator's historical engagement-by-hour).
 *
 *   <OptimalPostingWindow onSchedule={(hour) => ...} />
 *
 * Placed in ExportView's success card so users land on a clear "post in N
 * hours" CTA right after a render finishes.
 */

interface Props {
  /** Optional override for niche (defaults to workflow.niche). */
  niche?: string
  /** Optional override for platform (defaults to workflow.platform). */
  platform?: string
  /** Called when the user clicks a window to schedule a post at that time. */
  onSchedule?: (hourLocal: number, rationale: string[]) => void
  className?: string
}

interface Window {
  hour: number
  window: { start: number; end: number }
  label: string
  rationale: string[]
  confidence: number
  source: string
}

export default function OptimalPostingWindow({ niche, platform, onSchedule, className = '' }: Props) {
  const { state: workflow } = useWorkflow()
  const [windows, setWindows] = useState<Window[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const effectiveNiche = niche || workflow.niche || 'other'
  const effectivePlatform = platform || workflow.platform || 'tiktok'

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    apiGet<{ data: { windows: Window[] } }>(
      `/marketing-intelligence/optimal-windows?niche=${encodeURIComponent(effectiveNiche)}&platform=${encodeURIComponent(effectivePlatform)}`,
    )
      .then((res: any) => {
        if (cancelled) return
        setWindows(res?.data?.windows || [])
      })
      .catch((e: any) => { if (!cancelled) setError(e?.message || 'Failed to load windows') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [effectiveNiche, effectivePlatform])

  const fmtHour = (h: number) => {
    const am = h < 12
    const display = h === 0 ? 12 : h <= 12 ? h : h - 12
    return `${display}:00 ${am ? 'AM' : 'PM'}`
  }

  return (
    <div className={`rounded-2xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-500/[0.04] to-violet-500/[0.04] p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock size={12} className="text-fuchsia-300" />
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white">Schedule when it'll land</span>
        </div>
        <span className="text-[9px] font-mono text-slate-500">
          {effectiveNiche.toUpperCase()} · {effectivePlatform.toUpperCase()}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-2">
          <Loader2 size={11} className="text-fuchsia-400 animate-spin" />
          <span className="text-[10px] text-slate-500">Reading platform peaks + niche windows…</span>
        </div>
      ) : error ? (
        <p className="text-[10px] text-rose-300">{error}</p>
      ) : windows.length === 0 ? (
        <p className="text-[10px] text-slate-500">No windows available — set your niche to get tuned suggestions.</p>
      ) : (
        <ul className="space-y-1.5">
          {windows.map((w, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => onSchedule?.(w.hour, w.rationale)}
                className="w-full flex items-start gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-fuchsia-500/30 hover:bg-fuchsia-500/[0.06] transition-all group text-left"
              >
                <div className="flex-shrink-0 w-12 text-center">
                  <div className="text-[14px] font-black text-white tabular-nums">{fmtHour(w.hour)}</div>
                  <div className="text-[8px] text-slate-500 font-mono">{w.window.start}–{w.window.end}h</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-bold text-white">{w.label}</span>
                    <span className="text-[8px] font-mono text-emerald-400 ml-auto">{Math.round(w.confidence * 100)}%</span>
                  </div>
                  {w.rationale.slice(0, 1).map((r, ri) => (
                    <p key={ri} className="text-[9px] text-slate-500 leading-relaxed line-clamp-2">{r}</p>
                  ))}
                </div>
                <Send size={11} className="text-fuchsia-300 flex-shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
