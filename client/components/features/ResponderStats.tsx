'use client'

import { useEffect, useState } from 'react'
import { getResponderStats, type ResponderStats } from '@/lib/featuresApi'
import { useTranslation } from '@/hooks/useTranslation'

// Status buckets shown as KPI cells, in display order.
const CELLS: { key: string; tone: string }[] = [
  { key: 'pending_approval', tone: 'text-amber-600 dark:text-amber-400' },
  { key: 'approved', tone: 'text-green-600 dark:text-green-400' },
  { key: 'sent', tone: 'text-blue-600 dark:text-blue-400' },
  { key: 'rejected', tone: 'text-theme-secondary' },
  { key: 'failed', tone: 'text-red-600 dark:text-red-400' },
]

/**
 * Compact KPI summary for the AI responder — reply counts by status over the
 * last 30 days. Gives creators an at-a-glance sense of throughput.
 */
export default function ResponderStats() {
  const { t } = useTranslation()
  const cellLabels: Record<string, string> = {
    pending_approval: t('creatorTools.responderStats.pending'),
    approved: t('creatorTools.responderStats.approved'),
    sent: t('creatorTools.responderStats.sent'),
    rejected: t('creatorTools.responderStats.rejected'),
    failed: t('creatorTools.responderStats.failed'),
  }
  const [stats, setStats] = useState<ResponderStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    getResponderStats(30)
      .then((s) => { if (alive) setStats(s) })
      .catch((e) => { if (alive) setError((e as Error)?.message || t('creatorTools.responderStats.loadFailed')) })
    return () => { alive = false }
    // Mount-only on purpose: t() changes identity once the locale loads, and
    // that must not refetch. It is only used for the fallback error text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="rounded-xl bg-surface-card border border-default p-4 space-y-3" data-testid="responder-stats">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-theme-primary">{t('creatorTools.responderStats.title')}</h2>
        {stats && <span data-testid="stats-total" className="text-xs text-theme-secondary">{t('creatorTools.responderStats.total', { count: stats.total })}</span>}
      </div>

      {error && <p data-testid="stats-error" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {!stats && !error && <p data-testid="stats-loading" className="text-sm text-theme-secondary">{t('creatorTools.common.loading')}</p>}

      {stats && (
        <div className="grid grid-cols-5 gap-2" data-testid="stats-grid">
          {CELLS.map((c) => (
            <div key={c.key} className="rounded-lg bg-background border border-default p-2 text-center">
              <div data-testid={`stats-${c.key}`} className={`text-lg font-semibold ${c.tone}`}>
                {stats.byStatus[c.key] ?? 0}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-theme-muted">{cellLabels[c.key]}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
