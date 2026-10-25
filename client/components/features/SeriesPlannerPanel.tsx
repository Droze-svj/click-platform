'use client'

import { useState } from 'react'
import { handleApiError } from '@/lib/api'
import { useTranslation } from '@/hooks/useTranslation'
import { planSeries, type Platform, type SeriesResult } from '@/lib/featuresApi'
import { platformLabel } from './platformLabel'

const PLATFORMS: Platform[] = ['tiktok', 'instagram', 'youtube', 'twitter', 'linkedin']

/** Plan a coherent multi-part content series from one theme. */
export default function SeriesPlannerPanel() {
  const { t } = useTranslation()
  const [theme, setTheme] = useState('')
  const [parts, setParts] = useState(5)
  const [platform, setPlatform] = useState<Platform>('tiktok')
  const [result, setResult] = useState<SeriesResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    if (!theme.trim()) { setError(t('creatorTools.seriesPlanner.themeRequired')); return }
    setLoading(true); setError(null)
    try {
      setResult(await planSeries({ theme, parts, platform }))
    } catch (e) {
      setError(handleApiError(e) || t('creatorTools.seriesPlanner.failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl bg-surface-card border border-default p-4 space-y-3">
      <h2 className="text-sm font-semibold text-theme-primary">{t('creatorTools.seriesPlanner.title')}</h2>
      <div className="flex flex-wrap gap-2 items-end">
        <input
          data-testid="series-theme"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder={t('creatorTools.seriesPlanner.placeholder')}
          className="flex-1 min-w-[10rem] rounded bg-background border border-default p-1 text-sm text-theme-primary"
        />
        <input
          data-testid="series-parts"
          type="number" min={2} max={10} value={parts}
          onChange={(e) => setParts(Number(e.target.value))}
          className="w-16 rounded bg-background border border-default p-1 text-sm text-theme-primary"
        />
        <select data-testid="series-platform" value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}
          className="rounded bg-background border border-default p-1 text-sm text-theme-primary">
          {PLATFORMS.map((p) => <option key={p} value={p}>{platformLabel(t, p)}</option>)}
        </select>
      </div>
      <button
        data-testid="series-run"
        onClick={run}
        disabled={loading}
        className="rounded-lg bg-primary hover:bg-primary/90 px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {loading ? t('creatorTools.seriesPlanner.planning') : t('creatorTools.seriesPlanner.run')}
      </button>

      {error && <p data-testid="series-error" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {result && (result.parts ?? []).length === 0 && (
        <p data-testid="series-empty" className="text-sm text-theme-secondary">{t('creatorTools.noResults')}</p>
      )}
      {result && (result.parts ?? []).length > 0 && (
        <ol className="space-y-1" data-testid="series-parts-list">
          {result.parts.map((p) => (
            <li key={p.part} data-testid="series-part" className="rounded-lg bg-background border border-default p-2">
              <div className="text-xs text-theme-muted">{t('creatorTools.seriesPlanner.part', { number: p.part })}</div>
              <div className="text-sm font-medium text-theme-primary">{p.title}</div>
              {p.hook && <div className="text-xs text-theme-secondary">{p.hook}</div>}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
