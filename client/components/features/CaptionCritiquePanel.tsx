'use client'

import { useState } from 'react'
import { critiquePost, type Platform, type Critique } from '@/lib/featuresApi'

const PLATFORMS: Platform[] = ['instagram', 'tiktok', 'youtube', 'twitter', 'linkedin']
const DIMENSIONS: { key: string; label: string }[] = [
  { key: 'hook', label: 'Hook' },
  { key: 'clarity', label: 'Clarity' },
  { key: 'cta', label: 'CTA' },
  { key: 'value', label: 'Value' },
]

// Score → colour band (out of 10).
function scoreTone(n: number): string {
  if (n >= 8) return 'text-green-400'
  if (n >= 5) return 'text-amber-400'
  return 'text-red-400'
}

/** Score a caption/script's copy and surface prioritized fixes. */
export default function CaptionCritiquePanel() {
  const [text, setText] = useState('')
  const [platform, setPlatform] = useState<Platform>('instagram')
  const [result, setResult] = useState<Critique | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    if (!text.trim()) { setError('Paste your caption or script first.'); return }
    setLoading(true); setError(null)
    try {
      setResult(await critiquePost({ text, platform }))
    } catch (e) {
      setError((e as Error)?.message || 'Failed to critique')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-4 space-y-3">
      <h2 className="text-sm font-semibold text-white">Caption critique</h2>
      <textarea
        data-testid="critique-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Paste a caption or script to score…"
        className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-sm text-zinc-200"
      />
      <div className="flex gap-2">
        <select
          data-testid="critique-platform" aria-label="Platform" value={platform}
          onChange={(e) => setPlatform(e.target.value as Platform)}
          className="rounded bg-zinc-950 border border-zinc-800 p-1 text-sm text-zinc-200"
        >
          {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button
          type="button"
          data-testid="critique-run"
          onClick={run}
          disabled={loading}
          className="rounded-lg bg-green-500/90 px-3 py-1.5 text-sm font-medium text-black disabled:opacity-50"
        >
          {loading ? 'Scoring…' : 'Score it'}
        </button>
      </div>

      {error && <p data-testid="critique-error" className="text-sm text-red-400">{error}</p>}

      {result && (
        <div className="space-y-3" data-testid="critique-results">
          <div className="flex items-center gap-3">
            <div data-testid="critique-overall" className={`text-2xl font-bold ${scoreTone(result.overall)}`}>
              {result.overall}<span className="text-sm text-zinc-500">/10</span>
            </div>
            {result.summary && <p className="flex-1 text-sm text-zinc-300">{result.summary}</p>}
          </div>

          <div className="grid grid-cols-4 gap-2">
            {DIMENSIONS.map((d) => (
              <div key={d.key} className="rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-center">
                <div data-testid={`critique-score-${d.key}`} className={`text-lg font-semibold ${scoreTone(result.scores[d.key] ?? 0)}`}>
                  {result.scores[d.key] ?? 0}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-zinc-500">{d.label}</div>
              </div>
            ))}
          </div>

          {result.suggestions.length > 0 && (
            <ul className="space-y-1" data-testid="critique-suggestions">
              {result.suggestions.map((s, i) => (
                <li key={i} data-testid="critique-suggestion" className="flex gap-2 text-sm text-zinc-300">
                  <span className="text-zinc-600">{i + 1}.</span><span>{s}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
