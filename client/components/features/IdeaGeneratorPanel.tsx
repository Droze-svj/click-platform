'use client'

import { useState } from 'react'
import { generateIdeas, type Platform, type ContentIdea } from '@/lib/featuresApi'
import { useTranslation } from '@/hooks/useTranslation'
import { platformLabel } from './platformLabel'

const PLATFORMS: Platform[] = ['instagram', 'tiktok', 'youtube', 'twitter', 'linkedin']

/**
 * Content idea generator — turns a niche/topic into a batch of post ideas
 * (title + angle + suggested format) to feed the Create tools. Reuses the
 * existing /creative/ideation/ideas endpoint.
 */
export default function IdeaGeneratorPanel() {
  const { t } = useTranslation()
  const [topic, setTopic] = useState('')
  const [platform, setPlatform] = useState<Platform>('instagram')
  const [ideas, setIdeas] = useState<ContentIdea[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    if (!topic.trim()) { setError(t('creatorTools.ideaGenerator.topicRequired')); return }
    setLoading(true); setError(null)
    try {
      setIdeas(await generateIdeas({ topic, platform, count: 8 }))
    } catch (e) {
      setError((e as Error)?.message || t('creatorTools.ideaGenerator.failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl bg-surface-card border border-default p-4 space-y-3">
      <h2 className="text-sm font-semibold text-theme-primary">{t('creatorTools.ideaGenerator.title')}</h2>
      <textarea
        data-testid="ideas-input"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        rows={2}
        placeholder={t('creatorTools.ideaGenerator.placeholder')}
        className="w-full rounded-lg bg-background border border-default p-2 text-sm text-theme-primary"
      />
      <div className="flex gap-2">
        <select
          data-testid="ideas-platform" aria-label={t('creatorTools.common.platform')} value={platform}
          onChange={(e) => setPlatform(e.target.value as Platform)}
          className="rounded bg-background border border-default p-1 text-sm text-theme-primary"
        >
          {PLATFORMS.map((p) => <option key={p} value={p}>{platformLabel(t, p)}</option>)}
        </select>
        <button
          type="button"
          data-testid="ideas-run"
          onClick={run}
          disabled={loading}
          className="rounded-lg bg-primary hover:bg-primary/90 px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {loading ? t('creatorTools.ideaGenerator.thinking') : t('creatorTools.ideaGenerator.run')}
        </button>
      </div>

      {error && <p data-testid="ideas-error" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {ideas && ideas.length === 0 && (
        <p data-testid="ideas-empty" className="text-sm text-theme-muted">{t('creatorTools.ideaGenerator.empty')}</p>
      )}

      {ideas && ideas.length > 0 && (
        <ul className="space-y-2" data-testid="ideas-results">
          {ideas.map((idea, i) => (
            <li key={i} data-testid="ideas-item" className="rounded-lg bg-background border border-default p-2 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-theme-primary">{idea.title}</span>
                {idea.format && (
                  <span data-testid="ideas-format" className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-theme-secondary">
                    {idea.format}
                  </span>
                )}
              </div>
              {idea.description && <p className="text-xs text-theme-secondary">{idea.description}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
