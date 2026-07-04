'use client'

import { useState } from 'react'
import { generateCaptions, type Platform, type CaptionResult } from '@/lib/featuresApi'

const PLATFORMS: Platform[] = ['instagram', 'tiktok', 'youtube', 'twitter', 'linkedin']

// Friendly label per angle key.
const ANGLE_LABEL: Record<string, string> = {
  hook: 'Hook-led', story: 'Story', value: 'Value', cta: 'CTA', question: 'Question',
}

/** Draft a few distinct-angle caption options for a topic. */
export default function CaptionAnglesPanel() {
  const [topic, setTopic] = useState('')
  const [platform, setPlatform] = useState<Platform>('instagram')
  const [result, setResult] = useState<CaptionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  async function run() {
    if (!topic.trim()) { setError('Describe your topic first.'); return }
    setLoading(true); setError(null); setCopied(null)
    try {
      setResult(await generateCaptions({ topic, platform }))
    } catch (e) {
      setError((e as Error)?.message || 'Failed to generate captions')
    } finally {
      setLoading(false)
    }
  }

  async function copy(text: string) {
    try { await navigator.clipboard?.writeText(text); setCopied(text) } catch { /* ignore */ }
  }

  return (
    <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-4 space-y-3">
      <h2 className="text-sm font-semibold text-white">Caption angles</h2>
      <textarea
        data-testid="captions-input"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        rows={2}
        placeholder="What's the post about?"
        className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-sm text-zinc-200"
      />
      <div className="flex gap-2">
        <select
          data-testid="captions-platform" aria-label="Platform" value={platform}
          onChange={(e) => setPlatform(e.target.value as Platform)}
          className="rounded bg-zinc-950 border border-zinc-800 p-1 text-sm text-zinc-200"
        >
          {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button
          type="button"
          data-testid="captions-run"
          onClick={run}
          disabled={loading}
          className="rounded-lg bg-green-500/90 px-3 py-1.5 text-sm font-medium text-black disabled:opacity-50"
        >
          {loading ? 'Drafting…' : 'Draft captions'}
        </button>
      </div>

      {error && <p data-testid="captions-error" className="text-sm text-red-400">{error}</p>}

      {result && (
        <ul className="space-y-2" data-testid="captions-results">
          {result.captions.map((c, i) => (
            <li key={i} data-testid="captions-item" className="rounded-lg bg-zinc-950 border border-zinc-800 p-2 space-y-1">
              <div className="flex items-center justify-between">
                <span data-testid="captions-angle" className="text-[10px] uppercase tracking-wide text-zinc-500">
                  {ANGLE_LABEL[c.angle] ?? c.angle}
                </span>
                <button
                  type="button"
                  data-testid="captions-copy"
                  onClick={() => copy(c.text)}
                  className="text-xs text-zinc-400 hover:text-white"
                >
                  {copied === c.text ? 'Copied ✓' : 'Copy'}
                </button>
              </div>
              <p className="text-sm text-zinc-200">{c.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
