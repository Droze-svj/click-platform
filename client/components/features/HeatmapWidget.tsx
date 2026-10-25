'use client'

import { useEffect, useState } from 'react'
import { getHeatmap, type Heatmap } from '@/lib/featuresApi'
import { useTranslation } from '@/hooks/useTranslation'
import HeatmapCard from './HeatmapCard'

/** Fetching container for HeatmapCard — loads the caller's engagement heatmap. */
export default function HeatmapWidget() {
  const { t } = useTranslation()
  const [heatmap, setHeatmap] = useState<Heatmap | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    getHeatmap()
      .then((h) => { if (alive) { setHeatmap(h); setLoaded(true) } })
      .catch((e) => { if (alive) setError((e as Error)?.message || t('creatorTools.heatmap.loadFailed')) })
    return () => { alive = false }
    // Mount-only on purpose: t() changes identity once the locale loads, and
    // that must not refetch. It is only used for the fallback error text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (error) return <div data-testid="heatmap-error" className="text-sm text-red-600 dark:text-red-400">{error}</div>
  if (!loaded) return <div data-testid="heatmap-loading" className="text-sm text-theme-muted">{t('creatorTools.heatmap.loading')}</div>
  return <HeatmapCard heatmap={heatmap} />
}
