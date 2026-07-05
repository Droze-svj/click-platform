'use client'

import { useEffect, useState } from 'react'
import { getNextBest, type NextBest } from '@/lib/featuresApi'

// Honest empty-state copy per backend reason (the loop needs real data first).
const REASON_COPY: Record<string, string> = {
  'need-more-data': 'Keep posting — once the loop learns your winners, personalized ideas show up here.',
  'ai-unavailable': 'Personalized ideas are briefly unavailable. Check back soon.',
  error: 'Couldn’t load ideas right now.',
}

/**
 * "Next best" — a ranked make-next list grounded in the creator's OWN proven
 * performers (from the learning loop). Shows an honest prompt until there's data.
 * Read-only Overview tile over the existing /api/me/next-best endpoint.
 */
export default function NextBestTile() {
  const [data, setData] = useState<NextBest | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    getNextBest(4)
      .then((d) => { if (alive) setData(d) })
      .catch((e) => { if (alive) setError((e as Error)?.message || 'Failed to load') })
    return () => { alive = false }
  }, [])

  const ideas = data?.ideas ?? []
  const hasIdeas = !!data?.hasRealData && ideas.length > 0

  return (
    <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-4 space-y-2" data-testid="nextbest-tile">
      <h2 className="text-sm font-semibold text-white">What to make next</h2>

      {error && <p data-testid="nextbest-error" className="text-sm text-red-400">{error}</p>}
      {!data && !error && <p data-testid="nextbest-loading" className="text-sm text-zinc-400">Loading…</p>}

      {data && !hasIdeas && (
        <p data-testid="nextbest-empty" className="text-sm text-zinc-500">
          {REASON_COPY[data.reason ?? 'need-more-data'] ?? REASON_COPY['need-more-data']}
        </p>
      )}

      {hasIdeas && (
        <ul className="space-y-2" data-testid="nextbest-list">
          {ideas.map((idea, i) => (
            <li key={i} data-testid="nextbest-item" className="rounded-lg bg-zinc-950 border border-zinc-800 p-2">
              <div className="text-sm font-medium text-zinc-100">{idea.title}</div>
              {idea.why && <div className="text-xs text-zinc-500">{idea.why}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
