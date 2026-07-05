'use client'

import { useMemo, useState } from 'react'
import {
  generateHooks, generateCaptions, generateHashtags, critiquePost,
  type Platform, type Hook, type Caption, type Critique,
} from '@/lib/featuresApi'

const PLATFORMS: Platform[] = ['instagram', 'tiktok', 'youtube', 'twitter', 'linkedin']

/**
 * Guided Composer — one topic fans out to the Create tools (hooks + captions +
 * hashtags) in a single pass, then assembles a pick-and-mix draft ready to post.
 * The assembled draft can be critiqued inline (score + fixes), closing the
 * create → analyze loop. Pure frontend orchestration over the existing endpoints.
 */
export default function ComposerPanel() {
  const [topic, setTopic] = useState('')
  const [platform, setPlatform] = useState<Platform>('instagram')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [hooks, setHooks] = useState<Hook[]>([])
  const [captions, setCaptions] = useState<Caption[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [hookIdx, setHookIdx] = useState(0)
  const [captionIdx, setCaptionIdx] = useState(0)
  const [copied, setCopied] = useState(false)
  const [done, setDone] = useState(false)
  const [critique, setCritique] = useState<Critique | null>(null)
  const [scoring, setScoring] = useState(false)

  async function run() {
    if (!topic.trim()) { setError('Enter a topic to compose from.'); return }
    setLoading(true); setError(null); setCopied(false); setDone(false); setCritique(null)
    try {
      const [h, c, t] = await Promise.all([
        generateHooks({ topic, platform }),
        generateCaptions({ topic, platform }),
        generateHashtags({ topic, platform }),
      ])
      setHooks(h.hooks || [])
      setCaptions(c.captions || [])
      setTags((t.tags || []).map((x) => x.tag))
      setHookIdx(0); setCaptionIdx(0); setDone(true)
    } catch (e) {
      setError((e as Error)?.message || 'Failed to compose')
    } finally {
      setLoading(false)
    }
  }

  const assembled = useMemo(() => {
    const parts = [hooks[hookIdx]?.text, captions[captionIdx]?.text, tags.join(' ')]
    return parts.filter(Boolean).join('\n\n')
  }, [hooks, captions, tags, hookIdx, captionIdx])

  async function copyAssembled() {
    try { await navigator.clipboard?.writeText(assembled); setCopied(true) } catch { /* ignore */ }
  }

  // Pick a new hook/caption → the prior critique no longer matches the draft.
  function pickHook(i: number) { setHookIdx(i); setCritique(null) }
  function pickCaption(i: number) { setCaptionIdx(i); setCritique(null) }

  async function scoreDraft() {
    if (!assembled.trim()) return
    setScoring(true); setError(null)
    try {
      setCritique(await critiquePost({ text: assembled, platform }))
    } catch (e) {
      setError((e as Error)?.message || 'Failed to score draft')
    } finally {
      setScoring(false)
    }
  }

  return (
    <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-white">Composer</h2>
        <p className="text-xs text-zinc-600">One topic → hook + caption + hashtags, assembled into a draft.</p>
      </div>

      <textarea
        data-testid="composer-input"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        rows={2}
        placeholder="What's this post about?"
        className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-sm text-zinc-200"
      />
      <div className="flex gap-2">
        <select
          data-testid="composer-platform" aria-label="Platform" value={platform}
          onChange={(e) => setPlatform(e.target.value as Platform)}
          className="rounded bg-zinc-950 border border-zinc-800 p-1 text-sm text-zinc-200"
        >
          {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button
          type="button"
          data-testid="composer-run"
          onClick={run}
          disabled={loading}
          className="rounded-lg bg-green-500/90 px-3 py-1.5 text-sm font-medium text-black disabled:opacity-50"
        >
          {loading ? 'Composing…' : 'Compose'}
        </button>
      </div>

      {error && <p data-testid="composer-error" className="text-sm text-red-400">{error}</p>}

      {done && (
        <div className="space-y-3" data-testid="composer-results">
          {hooks.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-zinc-500">Hook</div>
              <div className="mt-1 flex flex-wrap gap-1" data-testid="composer-hooks">
                {hooks.map((h, i) => (
                  <button
                    key={i}
                    type="button"
                    data-testid="composer-hook"
                    aria-pressed={i === hookIdx}
                    onClick={() => pickHook(i)}
                    className={`rounded px-2 py-0.5 text-xs border ${i === hookIdx ? 'border-green-500 text-green-300' : 'border-zinc-800 text-zinc-300'}`}
                  >
                    {h.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {captions.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-zinc-500">Caption</div>
              <div className="mt-1 space-y-1" data-testid="composer-captions">
                {captions.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    data-testid="composer-caption"
                    aria-pressed={i === captionIdx}
                    onClick={() => pickCaption(i)}
                    className={`block w-full rounded p-1.5 text-left text-xs border ${i === captionIdx ? 'border-green-500 text-green-200' : 'border-zinc-800 text-zinc-300'}`}
                  >
                    {c.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-wide text-zinc-500">Draft</div>
              <div className="flex items-center gap-3">
                <button type="button" data-testid="composer-score" onClick={scoreDraft} disabled={scoring} className="text-xs text-zinc-400 hover:text-white disabled:opacity-50">
                  {scoring ? 'Scoring…' : 'Critique draft'}
                </button>
                <button type="button" data-testid="composer-copy" onClick={copyAssembled} className="text-xs text-zinc-400 hover:text-white">
                  {copied ? 'Copied ✓' : 'Copy draft'}
                </button>
              </div>
            </div>
            <pre data-testid="composer-draft" className="mt-1 whitespace-pre-wrap rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-sm text-zinc-200 font-sans">{assembled}</pre>
          </div>

          {critique && (
            <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-2 space-y-1" data-testid="composer-critique">
              <div className="flex items-center gap-2">
                <span data-testid="composer-critique-score" className="text-lg font-bold text-white">{critique.overall}<span className="text-xs text-zinc-500">/10</span></span>
                {critique.summary && <span className="text-xs text-zinc-400">{critique.summary}</span>}
              </div>
              {critique.suggestions.length > 0 && (
                <ul className="space-y-0.5">
                  {critique.suggestions.slice(0, 3).map((s, i) => (
                    <li key={i} data-testid="composer-critique-fix" className="text-xs text-zinc-300">• {s}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
