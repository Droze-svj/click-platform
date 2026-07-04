'use client'

import { useState } from 'react'
import { generateHooks, type Platform, type HookStyle, type HookResult } from '@/lib/featuresApi'

const PLATFORMS: Platform[] = ['instagram', 'tiktok', 'youtube', 'twitter', 'linkedin']
const STYLES: HookStyle[] = ['mix', 'curiosity', 'bold', 'story', 'question', 'contrarian']

/** Generate scroll-stopping opening hooks for a topic/script. */
export default function HookGeneratorPanel() {
  const [topic, setTopic] = useState('')
  const [platform, setPlatform] = useState<Platform>('instagram')
  const [style, setStyle] = useState<HookStyle>('mix')
  const [result, setResult] = useState<HookResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  async function run() {
    if (!topic.trim()) { setError('Describe your topic or paste your script first.'); return }
    setLoading(true); setError(null); setCopied(null)
    try {
      setResult(await generateHooks({ topic, platform, style }))
    } catch (e) {
      setError((e as Error)?.message || 'Failed to generate hooks')
    } finally {
      setLoading(false)
    }
  }

  async function copy(text: string) {
    try { await navigator.clipboard?.writeText(text); setCopied(text) } catch { /* ignore */ }
  }

  return (
    <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-4 space-y-3">
      <h2 className="text-sm font-semibold text-white">Hook generator</h2>
      <textarea
        data-testid="hooks-input"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        rows={2}
        placeholder="What's the video/post about? (topic or script)"
        className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-sm text-zinc-200"
      />
      <div className="flex gap-2">
        <select
          data-testid="hooks-platform" aria-label="Platform" value={platform}
          onChange={(e) => setPlatform(e.target.value as Platform)}
          className="rounded bg-zinc-950 border border-zinc-800 p-1 text-sm text-zinc-200"
        >
          {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          data-testid="hooks-style" aria-label="Hook style" value={style}
          onChange={(e) => setStyle(e.target.value as HookStyle)}
          className="rounded bg-zinc-950 border border-zinc-800 p-1 text-sm text-zinc-200"
        >
          {STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <button
        type="button"
        data-testid="hooks-run"
        onClick={run}
        disabled={loading}
        className="rounded-lg bg-green-500/90 px-3 py-1.5 text-sm font-medium text-black disabled:opacity-50"
      >
        {loading ? 'Generating…' : 'Generate hooks'}
      </button>

      {error && <p data-testid="hooks-error" className="text-sm text-red-400">{error}</p>}

      {result && (
        <ul className="space-y-1" data-testid="hooks-results">
          {result.hooks.map((h, i) => (
            <li
              key={i}
              data-testid="hooks-item"
              className="flex items-start justify-between gap-2 rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-sm text-zinc-200"
            >
              <span className="flex-1">{h.text}</span>
              <button
                type="button"
                data-testid="hooks-copy"
                onClick={() => copy(h.text)}
                className="text-xs text-zinc-400 hover:text-white whitespace-nowrap"
              >
                {copied === h.text ? 'Copied ✓' : 'Copy'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
