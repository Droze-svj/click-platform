'use client'

import { useState } from 'react'
import { generateHashtags, type Platform, type HashtagResult } from '@/lib/featuresApi'

const PLATFORMS: Platform[] = ['instagram', 'tiktok', 'youtube', 'twitter', 'linkedin']
// Tier display order + labels.
const TIERS: { key: string; label: string; tone: string }[] = [
  { key: 'broad', label: 'Broad reach', tone: 'text-blue-400' },
  { key: 'niche', label: 'Niche', tone: 'text-green-400' },
  { key: 'community', label: 'Community', tone: 'text-amber-400' },
  { key: 'branded', label: 'Branded', tone: 'text-fuchsia-400' },
]

/** Build a balanced, tiered hashtag set for a topic. */
export default function HashtagStrategistPanel() {
  const [topic, setTopic] = useState('')
  const [platform, setPlatform] = useState<Platform>('instagram')
  const [result, setResult] = useState<HashtagResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function run() {
    if (!topic.trim()) { setError('Describe your topic first.'); return }
    setLoading(true); setError(null); setCopied(false)
    try {
      setResult(await generateHashtags({ topic, platform }))
    } catch (e) {
      setError((e as Error)?.message || 'Failed to generate hashtags')
    } finally {
      setLoading(false)
    }
  }

  async function copyAll() {
    if (!result) return
    const all = result.tags.map((t) => t.tag).join(' ')
    try { await navigator.clipboard?.writeText(all); setCopied(true) } catch { /* ignore */ }
  }

  return (
    <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-4 space-y-3">
      <h2 className="text-sm font-semibold text-white">Hashtag strategist</h2>
      <textarea
        data-testid="hashtags-input"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        rows={2}
        placeholder="What's the post about?"
        className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-sm text-zinc-200"
      />
      <div className="flex gap-2">
        <select
          data-testid="hashtags-platform" aria-label="Platform" value={platform}
          onChange={(e) => setPlatform(e.target.value as Platform)}
          className="rounded bg-zinc-950 border border-zinc-800 p-1 text-sm text-zinc-200"
        >
          {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button
          type="button"
          data-testid="hashtags-run"
          onClick={run}
          disabled={loading}
          className="rounded-lg bg-green-500/90 px-3 py-1.5 text-sm font-medium text-black disabled:opacity-50"
        >
          {loading ? 'Building…' : 'Build set'}
        </button>
      </div>

      {error && <p data-testid="hashtags-error" className="text-sm text-red-400">{error}</p>}

      {result && (
        <div className="space-y-2" data-testid="hashtags-results">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">{result.count} tags</span>
            <button type="button" data-testid="hashtags-copy-all" onClick={copyAll} className="text-xs text-zinc-400 hover:text-white">
              {copied ? 'Copied ✓' : 'Copy all'}
            </button>
          </div>
          {TIERS.filter((t) => (result.groups[t.key]?.length ?? 0) > 0).map((t) => (
            <div key={t.key} data-testid={`hashtags-tier-${t.key}`}>
              <div className={`text-[10px] uppercase tracking-wide ${t.tone}`}>{t.label}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {result.groups[t.key].map((tag) => (
                  <span key={tag} data-testid="hashtags-tag" className="rounded bg-zinc-950 border border-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
