'use client'

import { useEffect, useState } from 'react'
import { getNextBest, type NextBest } from '@/lib/featuresApi'
import { useTranslation } from '@/hooks/useTranslation'

/**
 * "Next best" — a ranked make-next list grounded in the creator's OWN proven
 * performers (from the learning loop). Shows an honest prompt until there's data.
 * Read-only Overview tile over the existing /api/me/next-best endpoint.
 */
export default function NextBestTile() {
  const { t } = useTranslation()
  // Honest empty-state copy per backend reason (the loop needs real data first).
  const reasonCopy: Record<string, string> = {
    'need-more-data': t('creatorTools.nextBest.needMoreData'),
    'ai-unavailable': t('creatorTools.nextBest.aiUnavailable'),
    error: t('creatorTools.nextBest.error'),
  }
  const [data, setData] = useState<NextBest | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    getNextBest(4)
      .then((d) => { if (alive) setData(d) })
      .catch((e) => { if (alive) setError((e as Error)?.message || t('creatorTools.nextBest.loadFailed')) })
    return () => { alive = false }
    // Mount-only on purpose: t() changes identity once the locale loads, and
    // that must not refetch. It is only used for the fallback error text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ideas = data?.ideas ?? []
  const hasIdeas = !!data?.hasRealData && ideas.length > 0

  return (
    <div className="rounded-xl bg-surface-card border border-default p-4 space-y-2" data-testid="nextbest-tile">
      <h2 className="text-sm font-semibold text-theme-primary">{t('creatorTools.nextBest.title')}</h2>

      {error && <p data-testid="nextbest-error" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {!data && !error && <p data-testid="nextbest-loading" className="text-sm text-theme-secondary">{t('creatorTools.common.loading')}</p>}

      {data && !hasIdeas && (
        <p data-testid="nextbest-empty" className="text-sm text-theme-muted">
          {reasonCopy[data.reason ?? 'need-more-data'] ?? reasonCopy['need-more-data']}
        </p>
      )}

      {hasIdeas && (
        <ul className="space-y-2" data-testid="nextbest-list">
          {ideas.map((idea, i) => (
            <li key={i} data-testid="nextbest-item" className="rounded-lg bg-background border border-default p-2">
              <div className="text-sm font-medium text-theme-primary">{idea.title}</div>
              {idea.why && <div className="text-xs text-theme-muted">{idea.why}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
