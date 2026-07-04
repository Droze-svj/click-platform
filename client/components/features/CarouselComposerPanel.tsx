'use client'

import { useState } from 'react'
import { composeSlides, type SlideFormat, type SlideResult } from '@/lib/featuresApi'

const FORMATS: SlideFormat[] = ['carousel', 'thread']

/** Split one idea into ordered carousel slides / thread posts. */
export default function CarouselComposerPanel() {
  const [topic, setTopic] = useState('')
  const [format, setFormat] = useState<SlideFormat>('carousel')
  const [result, setResult] = useState<SlideResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function run() {
    if (!topic.trim()) { setError('Describe your idea first.'); return }
    setLoading(true); setError(null); setCopied(false)
    try {
      setResult(await composeSlides({ topic, format }))
    } catch (e) {
      setError((e as Error)?.message || 'Failed to compose slides')
    } finally {
      setLoading(false)
    }
  }

  async function copyAll() {
    if (!result) return
    const joined = result.slides.map((s) => `${s.n}. ${s.text}`).join('\n\n')
    try { await navigator.clipboard?.writeText(joined); setCopied(true) } catch { /* ignore */ }
  }

  return (
    <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-4 space-y-3">
      <h2 className="text-sm font-semibold text-white">Carousel / thread</h2>
      <textarea
        data-testid="carousel-input"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        rows={2}
        placeholder="One idea to expand into slides…"
        className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-sm text-zinc-200"
      />
      <div className="flex gap-2">
        <select
          data-testid="carousel-format" aria-label="Format" value={format}
          onChange={(e) => setFormat(e.target.value as SlideFormat)}
          className="rounded bg-zinc-950 border border-zinc-800 p-1 text-sm text-zinc-200"
        >
          {FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <button
          type="button"
          data-testid="carousel-run"
          onClick={run}
          disabled={loading}
          className="rounded-lg bg-green-500/90 px-3 py-1.5 text-sm font-medium text-black disabled:opacity-50"
        >
          {loading ? 'Composing…' : 'Compose'}
        </button>
      </div>

      {error && <p data-testid="carousel-error" className="text-sm text-red-400">{error}</p>}

      {result && (
        <div className="space-y-2" data-testid="carousel-results">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">{result.slides.length} slides</span>
            <button type="button" data-testid="carousel-copy-all" onClick={copyAll} className="text-xs text-zinc-400 hover:text-white">
              {copied ? 'Copied ✓' : 'Copy all'}
            </button>
          </div>
          <ol className="space-y-1">
            {result.slides.map((s) => (
              <li key={s.n} data-testid="carousel-slide" className="flex gap-2 rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-sm text-zinc-200">
                <span className="text-zinc-600 tabular-nums">{s.n}</span>
                <span className="flex-1">{s.text}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
