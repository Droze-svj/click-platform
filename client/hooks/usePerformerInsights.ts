'use client'

import { useEffect, useState } from 'react'
import { apiGet } from '../lib/api'

/**
 * usePerformerInsights — pulls /style-profile/insights and exposes the
 * creator's top-performing picks per facet, ordered by retention impact.
 * The editor's PerformanceRail consumes this to render the "What's working
 * for you" panel; useStyleProfile's biasComparator can also accept these
 * arrays to weight tile order by performance, not just frequency.
 */

export interface PerformerEntry {
  key: string
  count?: number
  performanceScore: number
  sampleSize: number
  lastUsedAt?: string | Date
}

export interface PerformerInsights {
  fonts: PerformerEntry[]
  captionStyles: PerformerEntry[]
  animations: PerformerEntry[]
  motions: PerformerEntry[]
  colorGrades: PerformerEntry[]
  transitions: PerformerEntry[]
  hooks: PerformerEntry[]
}

const EMPTY: PerformerInsights = {
  fonts: [], captionStyles: [], animations: [], motions: [],
  colorGrades: [], transitions: [], hooks: [],
}

export function usePerformerInsights() {
  const [insights, setInsights] = useState<PerformerInsights>(EMPTY)
  const [lastIngestedAt, setLastIngestedAt] = useState<Date | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    apiGet<{ data: { topPerformers: Partial<PerformerInsights>; lastIngestedAt: string | null } }>(
      '/style-profile/insights',
    )
      .then((res: any) => {
        if (cancelled) return
        const tp = res?.data?.topPerformers || {}
        setInsights({ ...EMPTY, ...tp })
        setLastIngestedAt(res?.data?.lastIngestedAt ? new Date(res.data.lastIngestedAt) : null)
      })
      .catch(() => { /* silent — empty insights are a valid state */ })
      .finally(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [])

  /** Quick top-N accessor for any facet. */
  const top = (facet: keyof PerformerInsights, n = 3): PerformerEntry[] =>
    (insights[facet] || []).slice(0, n)

  return { insights, lastIngestedAt, loaded, top }
}
