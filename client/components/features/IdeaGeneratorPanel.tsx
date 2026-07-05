'use client'

import { useState } from 'react'
import { generateIdeas, type Platform, type ContentIdea } from '@/lib/featuresApi'

const PLATFORMS: Platform[] = ['instagram', 'tiktok', 'youtube', 'twitter', 'linkedin']

/**
 * Content idea generator — turns a niche/topic into a batch of post ideas
 * (title + angle + suggested format) to feed the Create tools. Reuses the
 * existing /creative/ideation/ideas endpoint.
 */
export default function IdeaGeneratorPanel() {
  const [topic, setTopic] = useState('')
  const [platform, setPlatform] = useState<Platform>('instagram')
  const [ideas, setIdeas] = useState<ContentIdea[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    if (!topic.trim()) { setError('Enter a niche or topic first.'); return }
    setLoading(true); setError(null)
    try {
      setIdeas(await generateIdeas({ topic, platform, count: 8 }))
    } catch (e) {
      setError((e as Error)?.message || 'Failed to generate ideas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-4 space-y-3">
      <h2 className="text-sm font-semibold text-white">Idea generator</h2>
      <textarea
        data-testid="ideas-input"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        rows={2}
        placeholder="Your niche or a theme (e.g. 'budget home cooking')…"
        className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-sm text-zinc-200"
      />
      <div className="flex gap-2">
        <select
          data-testid="ideas-platform" aria-label="Platform" value={platform}
          onChange={(e) => setPlatform(e.target.value as Platform)}
          className="rounded bg-zinc-950 border border-zinc-800 p-1 text-sm text-zinc-200"
        >
          {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button
          type="button"
          data-testid="ideas-run"
          onClick={run}
          disabled={loading}
          className="rounded-lg bg-green-500/90 px-3 py-1.5 text-sm font-medium text-black disabled:opacity-50"
        >
          {loading ? 'Thinking…' : 'Get ideas'}
        </button>
      </div>

      {error && <p data-testid="ideas-error" className="text-sm text-red-400">{error}</p>}

      {ideas && ideas.length === 0 && (
        <p data-testid="ideas-empty" className="text-sm text-zinc-500">No ideas came back — try a broader topic.</p>
      )}

      {ideas && ideas.length > 0 && (
        <ul className="space-y-2" data-testid="ideas-results">
          {ideas.map((idea, i) => (
            <li key={i} data-testid="ideas-item" className="rounded-lg bg-zinc-950 border border-zinc-800 p-2 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-zinc-100">{idea.title}</span>
                {idea.format && (
                  <span data-testid="ideas-format" className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                    {idea.format}
                  </span>
                )}
              </div>
              {idea.description && <p className="text-xs text-zinc-400">{idea.description}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
