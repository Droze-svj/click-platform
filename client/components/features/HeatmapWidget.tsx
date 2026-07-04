'use client'

import { useEffect, useState } from 'react'
import { getHeatmap, type Heatmap } from '@/lib/featuresApi'
import HeatmapCard from './HeatmapCard'

/** Fetching container for HeatmapCard — loads the caller's engagement heatmap. */
export default function HeatmapWidget() {
  const [heatmap, setHeatmap] = useState<Heatmap | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    getHeatmap()
      .then((h) => { if (alive) { setHeatmap(h); setLoaded(true) } })
      .catch((e) => { if (alive) setError((e as Error)?.message || 'Failed to load heatmap') })
    return () => { alive = false }
  }, [])

  if (error) return <div data-testid="heatmap-error" className="text-sm text-red-400">{error}</div>
  if (!loaded) return <div data-testid="heatmap-loading" className="text-sm text-zinc-500">Loading heatmap…</div>
  return <HeatmapCard heatmap={heatmap} />
}
