'use client'

import { useState } from 'react'
import { repurposeStudio, type Platform, type RepurposeVariant } from '@/lib/featuresApi'

const PLATFORMS: Platform[] = ['tiktok', 'instagram', 'youtube', 'twitter', 'linkedin']

/** Paste one piece of content → preview platform-native variants (no save). */
export default function RepurposeStudioPanel() {
  const [text, setText] = useState('')
  const [selected, setSelected] = useState<Platform[]>(['tiktok', 'instagram'])
  const [variants, setVariants] = useState<RepurposeVariant[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = (p: Platform) =>
    setSelected((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]))

  async function run() {
    if (!text.trim()) { setError('Paste some content to repurpose.'); return }
    setLoading(true); setError(null)
    try {
      const res = await repurposeStudio({ text, platforms: selected })
      setVariants(res.variants)
    } catch (e) {
      setError((e as Error)?.message || 'Failed to generate variants')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-4 space-y-3">
      <h2 className="text-sm font-semibold text-white">Repurpose studio</h2>
      <textarea
        data-testid="repurpose-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Paste a caption, script, or post…"
        className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-sm text-zinc-200"
      />
      <div className="flex flex-wrap gap-2">
        {PLATFORMS.map((p) => (
          <button
            key={p}
            data-testid={`repurpose-platform-${p}`}
            onClick={() => toggle(p)}
            className={`rounded-full px-2 py-0.5 text-xs border ${selected.includes(p) ? 'bg-green-500/20 border-green-500/40 text-green-300' : 'border-zinc-700 text-zinc-400'}`}
          >
            {p}
          </button>
        ))}
      </div>
      <button
        data-testid="repurpose-run"
        onClick={run}
        disabled={loading}
        className="rounded-lg bg-green-500/90 px-3 py-1.5 text-sm font-medium text-black disabled:opacity-50"
      >
        {loading ? 'Generating…' : 'Generate variants'}
      </button>

      {error && <p data-testid="repurpose-error" className="text-sm text-red-400">{error}</p>}

      {variants && (
        <ul className="space-y-2" data-testid="repurpose-variants">
          {variants.map((v, i) => (
            <li key={i} data-testid="repurpose-variant" className="rounded-lg bg-zinc-950 border border-zinc-800 p-2">
              <div className="text-xs text-zinc-500">{v.platform} · {v.aspectRatio} · {v.format}</div>
              <div className="text-sm text-zinc-200">{v.content}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
