'use client'

import { useState } from 'react'
import { handleApiError } from '@/lib/api'
import { useTranslation } from '@/hooks/useTranslation'
import { generateFirstComments, type Platform, type FirstCommentResult } from '@/lib/featuresApi'
import { platformLabel } from './platformLabel'

const GOALS: FirstCommentResult['goal'][] = ['engagement', 'cta', 'link']
const PLATFORMS: Platform[] = ['instagram', 'tiktok', 'youtube', 'twitter', 'linkedin']

/** Draft pinned first-comment options for a post. */
export default function FirstCommentPanel() {
  const { t } = useTranslation()
  const goalLabels: Record<string, string> = {
    engagement: t('creatorTools.firstComment.goalEngagement'),
    cta: t('creatorTools.firstComment.goalCta'),
    link: t('creatorTools.firstComment.goalLink'),
  }
  const [text, setText] = useState('')
  const [platform, setPlatform] = useState<Platform>('instagram')
  const [goal, setGoal] = useState<FirstCommentResult['goal']>('engagement')
  const [result, setResult] = useState<FirstCommentResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    if (!text.trim()) { setError(t('creatorTools.firstComment.textRequired')); return }
    setLoading(true); setError(null)
    try {
      setResult(await generateFirstComments({ text, platform, goal }))
    } catch (e) {
      setError(handleApiError(e) || t('creatorTools.firstComment.failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl bg-surface-card border border-default p-4 space-y-3">
      <h2 className="text-sm font-semibold text-theme-primary">{t('creatorTools.firstComment.title')}</h2>
      <textarea
        data-testid="firstcomment-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder={t('creatorTools.firstComment.placeholder')}
        className="w-full rounded-lg bg-background border border-default p-2 text-sm text-theme-primary"
      />
      <div className="flex gap-2">
        <select aria-label={t('creatorTools.common.platform')} data-testid="firstcomment-platform" value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}
          className="rounded bg-background border border-default p-1 text-sm text-theme-primary">
          {PLATFORMS.map((p) => <option key={p} value={p}>{platformLabel(t, p)}</option>)}
        </select>
        <select aria-label={t('creatorTools.firstComment.goal')} data-testid="firstcomment-goal" value={goal} onChange={(e) => setGoal(e.target.value as FirstCommentResult['goal'])}
          className="rounded bg-background border border-default p-1 text-sm text-theme-primary">
          {GOALS.map((g) => <option key={g} value={g}>{goalLabels[g] ?? g}</option>)}
        </select>
      </div>
      <button
        data-testid="firstcomment-run"
        onClick={run}
        disabled={loading}
        className="rounded-lg bg-primary hover:bg-primary/90 px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {loading ? t('creatorTools.common.generating') : t('creatorTools.firstComment.run')}
      </button>

      {error && <p data-testid="firstcomment-error" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {result && (result.options ?? []).length === 0 && (
        <p data-testid="first-comment-empty" className="text-sm text-theme-secondary">{t('creatorTools.noResults')}</p>
      )}
      {result && (result.options ?? []).length > 0 && (
        <ul className="space-y-1" data-testid="firstcomment-options">
          {result.options.map((o, i) => (
            <li key={i} data-testid="firstcomment-option" className="rounded-lg bg-background border border-default p-2 text-sm text-theme-primary">
              {o.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
