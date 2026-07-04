'use client'

import { useState } from 'react'
import { generateFirstComments, type Platform, type FirstCommentResult } from '@/lib/featuresApi'

const GOALS: FirstCommentResult['goal'][] = ['engagement', 'cta', 'link']
const PLATFORMS: Platform[] = ['instagram', 'tiktok', 'youtube', 'twitter', 'linkedin']

/** Draft pinned first-comment options for a post. */
export default function FirstCommentPanel() {
  const [text, setText] = useState('')
  const [platform, setPlatform] = useState<Platform>('instagram')
  const [goal, setGoal] = useState<FirstCommentResult['goal']>('engagement')
  const [result, setResult] = useState<FirstCommentResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    if (!text.trim()) { setError('Paste your post text first.'); return }
    setLoading(true); setError(null)
    try {
      setResult(await generateFirstComments({ text, platform, goal }))
    } catch (e) {
      setError((e as Error)?.message || 'Failed to generate options')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-4 space-y-3">
      <h2 className="text-sm font-semibold text-white">First comment</h2>
      <textarea
        data-testid="firstcomment-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="Paste your post caption…"
        className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-sm text-zinc-200"
      />
      <div className="flex gap-2">
        <select data-testid="firstcomment-platform" value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}
          className="rounded bg-zinc-950 border border-zinc-800 p-1 text-sm text-zinc-200">
          {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select data-testid="firstcomment-goal" value={goal} onChange={(e) => setGoal(e.target.value as FirstCommentResult['goal'])}
          className="rounded bg-zinc-950 border border-zinc-800 p-1 text-sm text-zinc-200">
          {GOALS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      <button
        data-testid="firstcomment-run"
        onClick={run}
        disabled={loading}
        className="rounded-lg bg-green-500/90 px-3 py-1.5 text-sm font-medium text-black disabled:opacity-50"
      >
        {loading ? 'Generating…' : 'Generate options'}
      </button>

      {error && <p data-testid="firstcomment-error" className="text-sm text-red-400">{error}</p>}

      {result && (
        <ul className="space-y-1" data-testid="firstcomment-options">
          {result.options.map((o, i) => (
            <li key={i} data-testid="firstcomment-option" className="rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-sm text-zinc-200">
              {o.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
