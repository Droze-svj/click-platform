'use client'

import { useState } from 'react'
import { handleApiError } from '@/lib/api'
import { useTranslation } from '@/hooks/useTranslation'
import { critiquePost, type Platform, type Critique } from '@/lib/featuresApi'
import { platformLabel } from './platformLabel'

const PLATFORMS: Platform[] = ['instagram', 'tiktok', 'youtube', 'twitter', 'linkedin']
const DIMENSIONS = ['hook', 'clarity', 'cta', 'value'] as const

// Score → colour band (out of 10).
function scoreTone(n: number): string {
  if (n >= 8) return 'text-green-600 dark:text-green-400'
  if (n >= 5) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

/** Score a caption/script's copy and surface prioritized fixes. */
export default function CaptionCritiquePanel() {
  const { t } = useTranslation()
  const dimensionLabels: Record<string, string> = {
    hook: t('creatorTools.captionCritique.dimHook'),
    clarity: t('creatorTools.captionCritique.dimClarity'),
    cta: t('creatorTools.captionCritique.dimCta'),
    value: t('creatorTools.captionCritique.dimValue'),
  }
  const [text, setText] = useState('')
  const [platform, setPlatform] = useState<Platform>('instagram')
  const [result, setResult] = useState<Critique | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    if (!text.trim()) { setError(t('creatorTools.captionCritique.textRequired')); return }
    setLoading(true); setError(null)
    try {
      setResult(await critiquePost({ text, platform }))
    } catch (e) {
      setError(handleApiError(e) || t('creatorTools.captionCritique.failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl bg-surface-card border border-default p-4 space-y-3">
      <h2 className="text-sm font-semibold text-theme-primary">{t('creatorTools.captionCritique.title')}</h2>
      <textarea
        data-testid="critique-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder={t('creatorTools.captionCritique.placeholder')}
        className="w-full rounded-lg bg-background border border-default p-2 text-sm text-theme-primary"
      />
      <div className="flex gap-2">
        <select
          data-testid="critique-platform" aria-label={t('creatorTools.common.platform')} value={platform}
          onChange={(e) => setPlatform(e.target.value as Platform)}
          className="rounded bg-background border border-default p-1 text-sm text-theme-primary"
        >
          {PLATFORMS.map((p) => <option key={p} value={p}>{platformLabel(t, p)}</option>)}
        </select>
        <button
          type="button"
          data-testid="critique-run"
          onClick={run}
          disabled={loading}
          className="rounded-lg bg-primary hover:bg-primary/90 px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {loading ? t('creatorTools.common.scoring') : t('creatorTools.captionCritique.run')}
        </button>
      </div>

      {error && <p data-testid="critique-error" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {result && (
        <div className="space-y-3" data-testid="critique-results">
          <div className="flex items-center gap-3">
            <div data-testid="critique-overall" className={`text-2xl font-bold ${scoreTone(result.overall)}`}>
              {result.overall}<span className="text-sm text-theme-muted">/10</span>
            </div>
            {result.summary && <p className="flex-1 text-sm text-theme-secondary">{result.summary}</p>}
          </div>

          <div className="grid grid-cols-4 gap-2">
            {DIMENSIONS.map((d) => (
              <div key={d} className="rounded-lg bg-background border border-default p-2 text-center">
                <div data-testid={`critique-score-${d}`} className={`text-lg font-semibold ${scoreTone(result.scores[d] ?? 0)}`}>
                  {result.scores[d] ?? 0}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-theme-muted">{dimensionLabels[d]}</div>
              </div>
            ))}
          </div>

          {result.suggestions.length > 0 && (
            <ul className="space-y-1" data-testid="critique-suggestions">
              {result.suggestions.map((s, i) => (
                <li key={i} data-testid="critique-suggestion" className="flex gap-2 text-sm text-theme-secondary">
                  <span className="text-theme-muted">{i + 1}.</span><span>{s}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
