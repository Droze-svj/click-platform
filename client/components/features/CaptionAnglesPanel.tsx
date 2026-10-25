'use client'

import { useState } from 'react'
import { handleApiError } from '@/lib/api'
import { useTranslation } from '@/hooks/useTranslation'
import { generateCaptions, type Platform, type CaptionResult } from '@/lib/featuresApi'
import { platformLabel } from './platformLabel'

const PLATFORMS: Platform[] = ['instagram', 'tiktok', 'youtube', 'twitter', 'linkedin']

/** Draft a few distinct-angle caption options for a topic. */
export default function CaptionAnglesPanel() {
  const { t } = useTranslation()
  // Friendly label per angle key.
  const angleLabels: Record<string, string> = {
    hook: t('creatorTools.captionAngles.angleHook'),
    story: t('creatorTools.captionAngles.angleStory'),
    value: t('creatorTools.captionAngles.angleValue'),
    cta: t('creatorTools.captionAngles.angleCta'),
    question: t('creatorTools.captionAngles.angleQuestion'),
  }
  const [topic, setTopic] = useState('')
  const [platform, setPlatform] = useState<Platform>('instagram')
  const [result, setResult] = useState<CaptionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  async function run() {
    if (!topic.trim()) { setError(t('creatorTools.common.topicRequired')); return }
    setLoading(true); setError(null); setCopied(null)
    try {
      setResult(await generateCaptions({ topic, platform }))
    } catch (e) {
      setError(handleApiError(e) || t('creatorTools.captionAngles.generateFailed'))
    } finally {
      setLoading(false)
    }
  }

  async function copy(text: string) {
    try { await navigator.clipboard?.writeText(text); setCopied(text) } catch { /* ignore */ }
  }

  return (
    <div className="rounded-xl bg-surface-card border border-default p-4 space-y-3">
      <h2 className="text-sm font-semibold text-theme-primary">{t('creatorTools.captionAngles.title')}</h2>
      <textarea
        data-testid="captions-input"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        rows={2}
        placeholder={t('creatorTools.common.postAboutPlaceholder')}
        className="w-full rounded-lg bg-background border border-default p-2 text-sm text-theme-primary"
      />
      <div className="flex gap-2">
        <select
          data-testid="captions-platform" aria-label={t('creatorTools.common.platform')} value={platform}
          onChange={(e) => setPlatform(e.target.value as Platform)}
          className="rounded bg-background border border-default p-1 text-sm text-theme-primary"
        >
          {PLATFORMS.map((p) => <option key={p} value={p}>{platformLabel(t, p)}</option>)}
        </select>
        <button
          type="button"
          data-testid="captions-run"
          onClick={run}
          disabled={loading}
          className="rounded-lg bg-primary hover:bg-primary/90 px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {loading ? t('creatorTools.common.drafting') : t('creatorTools.captionAngles.run')}
        </button>
      </div>

      {error && <p data-testid="captions-error" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {result && (result.captions ?? []).length === 0 && (
        <p data-testid="captions-empty" className="text-sm text-theme-secondary">{t('creatorTools.noResults')}</p>
      )}
      {result && (result.captions ?? []).length > 0 && (
        <ul className="space-y-2" data-testid="captions-results">
          {result.captions.map((c, i) => (
            <li key={i} data-testid="captions-item" className="rounded-lg bg-background border border-default p-2 space-y-1">
              <div className="flex items-center justify-between">
                <span data-testid="captions-angle" className="text-[10px] uppercase tracking-wide text-theme-muted">
                  {angleLabels[c.angle] ?? c.angle}
                </span>
                <button
                  type="button"
                  data-testid="captions-copy"
                  onClick={() => copy(c.text)}
                  className="text-xs text-theme-secondary hover:text-theme-primary"
                >
                  {copied === c.text ? t('creatorTools.common.copied') : t('creatorTools.common.copy')}
                </button>
              </div>
              <p className="text-sm text-theme-primary">{c.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
