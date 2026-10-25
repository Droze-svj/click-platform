'use client'

import { useState } from 'react'
import { repurposeStudio, type Platform, type RepurposeVariant } from '@/lib/featuresApi'
import { handleApiError } from '@/lib/api'
import { useTranslation } from '@/hooks/useTranslation'

const PLATFORMS: Platform[] = ['tiktok', 'instagram', 'youtube', 'twitter', 'linkedin']

/** Paste one piece of content → preview platform-native variants (no save). */
export default function RepurposeStudioPanel() {
  const { t } = useTranslation()
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
      setError(handleApiError(e) || 'Failed to generate variants')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl bg-surface-card border border-default p-4 space-y-3">
      <h2 className="text-sm font-semibold text-theme-primary">Repurpose studio</h2>
      <textarea
        data-testid="repurpose-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Paste a caption, script, or post…"
        className="w-full rounded-lg bg-background border border-default p-2 text-sm text-theme-primary"
      />
      <div className="flex flex-wrap gap-2">
        {PLATFORMS.map((p) => (
          <button
            key={p}
            data-testid={`repurpose-platform-${p}`}
            onClick={() => toggle(p)}
            className={`rounded-full px-2 py-0.5 text-xs border ${selected.includes(p) ? 'bg-primary/10 border-primary/40 text-primary' : 'border-default text-theme-muted hover:text-theme-primary'}`}
          >
            {p}
          </button>
        ))}
      </div>
      <button
        data-testid="repurpose-run"
        onClick={run}
        disabled={loading}
        className="rounded-lg bg-primary hover:bg-primary/90 px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {loading ? 'Generating…' : 'Generate variants'}
      </button>

      {error && <p data-testid="repurpose-error" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {variants && variants.length === 0 && (
        <p data-testid="repurpose-empty" className="text-sm text-theme-secondary">{t('creatorTools.noResults')}</p>
      )}
      {variants && variants.length > 0 && (
        <ul className="space-y-2" data-testid="repurpose-variants">
          {variants.map((v, i) => (
            <li key={i} data-testid="repurpose-variant" className="rounded-lg bg-background border border-default p-2">
              <div className="text-xs text-theme-muted">{v.platform} · {v.aspectRatio} · {v.format}</div>
              {v.degraded && (
                <div data-testid="repurpose-degraded" className="text-xs text-amber-600 dark:text-amber-400">{t('creatorTools.variantNotAdapted')}</div>
              )}
              <div className="text-sm text-theme-primary">{v.content}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
