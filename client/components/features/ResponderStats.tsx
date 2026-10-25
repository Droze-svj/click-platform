'use client'

import { useEffect, useState } from 'react'
import { getResponderStats, type ResponderStats } from '@/lib/featuresApi'

// Status buckets shown as KPI cells, in display order.
const CELLS: { key: string; label: string; tone: string }[] = [
  { key: 'pending_approval', label: 'Pending', tone: 'text-amber-600 dark:text-amber-400' },
  { key: 'approved', label: 'Approved', tone: 'text-green-600 dark:text-green-400' },
  { key: 'sent', label: 'Sent', tone: 'text-blue-600 dark:text-blue-400' },
  { key: 'rejected', label: 'Rejected', tone: 'text-theme-secondary' },
  { key: 'failed', label: 'Failed', tone: 'text-red-600 dark:text-red-400' },
]

/**
 * Compact KPI summary for the AI responder — reply counts by status over the
 * last 30 days. Gives creators an at-a-glance sense of throughput.
 */
export default function ResponderStats() {
  const [stats, setStats] = useState<ResponderStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    getResponderStats(30)
      .then((s) => { if (alive) setStats(s) })
      .catch((e) => { if (alive) setError((e as Error)?.message || 'Failed to load stats') })
    return () => { alive = false }
  }, [])

  return (
    <div className="rounded-xl bg-surface-card border border-default p-4 space-y-3" data-testid="responder-stats">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-theme-primary">Responder — last 30 days</h2>
        {stats && <span data-testid="stats-total" className="text-xs text-theme-secondary">{stats.total} total</span>}
      </div>

      {error && <p data-testid="stats-error" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {!stats && !error && <p data-testid="stats-loading" className="text-sm text-theme-secondary">Loading…</p>}

      {stats && (
        <div className="grid grid-cols-5 gap-2" data-testid="stats-grid">
          {CELLS.map((c) => (
            <div key={c.key} className="rounded-lg bg-background border border-default p-2 text-center">
              <div data-testid={`stats-${c.key}`} className={`text-lg font-semibold ${c.tone}`}>
                {stats.byStatus[c.key] ?? 0}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-theme-muted">{c.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
