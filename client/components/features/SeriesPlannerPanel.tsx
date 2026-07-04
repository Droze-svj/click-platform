'use client'

import { useState } from 'react'
import { planSeries, type Platform, type SeriesResult } from '@/lib/featuresApi'

const PLATFORMS: Platform[] = ['tiktok', 'instagram', 'youtube', 'twitter', 'linkedin']

/** Plan a coherent multi-part content series from one theme. */
export default function SeriesPlannerPanel() {
  const [theme, setTheme] = useState('')
  const [parts, setParts] = useState(5)
  const [platform, setPlatform] = useState<Platform>('tiktok')
  const [result, setResult] = useState<SeriesResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    if (!theme.trim()) { setError('Enter a theme for your series.'); return }
    setLoading(true); setError(null)
    try {
      setResult(await planSeries({ theme, parts, platform }))
    } catch (e) {
      setError((e as Error)?.message || 'Failed to plan series')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-4 space-y-3">
      <h2 className="text-sm font-semibold text-white">Series planner</h2>
      <div className="flex flex-wrap gap-2 items-end">
        <input
          data-testid="series-theme"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder="Theme, e.g. 'starting a business with $0'"
          className="flex-1 min-w-[10rem] rounded bg-zinc-950 border border-zinc-800 p-1 text-sm text-zinc-200"
        />
        <input
          data-testid="series-parts"
          type="number" min={2} max={10} value={parts}
          onChange={(e) => setParts(Number(e.target.value))}
          className="w-16 rounded bg-zinc-950 border border-zinc-800 p-1 text-sm text-zinc-200"
        />
        <select data-testid="series-platform" value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}
          className="rounded bg-zinc-950 border border-zinc-800 p-1 text-sm text-zinc-200">
          {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <button
        data-testid="series-run"
        onClick={run}
        disabled={loading}
        className="rounded-lg bg-green-500/90 px-3 py-1.5 text-sm font-medium text-black disabled:opacity-50"
      >
        {loading ? 'Planning…' : 'Plan series'}
      </button>

      {error && <p data-testid="series-error" className="text-sm text-red-400">{error}</p>}

      {result && (
        <ol className="space-y-1" data-testid="series-parts-list">
          {result.parts.map((p) => (
            <li key={p.part} data-testid="series-part" className="rounded-lg bg-zinc-950 border border-zinc-800 p-2">
              <div className="text-xs text-zinc-500">Part {p.part}</div>
              <div className="text-sm font-medium text-zinc-100">{p.title}</div>
              {p.hook && <div className="text-xs text-zinc-400">{p.hook}</div>}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
