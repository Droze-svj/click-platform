'use client'

import { useState } from 'react'
import { handleApiError } from '@/lib/api'
import { useTranslation } from '@/hooks/useTranslation'
import { generateHooks, type Platform, type HookStyle, type HookResult } from '@/lib/featuresApi'
import { platformLabel } from './platformLabel'

const PLATFORMS: Platform[] = ['instagram', 'tiktok', 'youtube', 'twitter', 'linkedin']
const STYLES: HookStyle[] = ['mix', 'curiosity', 'bold', 'story', 'question', 'contrarian']

/** Generate scroll-stopping opening hooks for a topic/script. */
export default function HookGeneratorPanel() {
  const { t } = useTranslation()
  const styleLabels: Record<string, string> = {
    mix: t('creatorTools.hookGenerator.styleMix'),
    curiosity: t('creatorTools.hookGenerator.styleCuriosity'),
    bold: t('creatorTools.hookGenerator.styleBold'),
    story: t('creatorTools.hookGenerator.styleStory'),
    question: t('creatorTools.hookGenerator.styleQuestion'),
    contrarian: t('creatorTools.hookGenerator.styleContrarian'),
  }
  const [topic, setTopic] = useState('')
  const [platform, setPlatform] = useState<Platform>('instagram')
  const [style, setStyle] = useState<HookStyle>('mix')
  const [result, setResult] = useState<HookResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  async function run() {
    if (!topic.trim()) { setError(t('creatorTools.hookGenerator.topicRequired')); return }
    setLoading(true); setError(null); setCopied(null)
    try {
      setResult(await generateHooks({ topic, platform, style }))
    } catch (e) {
      setError(handleApiError(e) || t('creatorTools.hookGenerator.failed'))
    } finally {
      setLoading(false)
    }
  }

  async function copy(text: string) {
    try { await navigator.clipboard?.writeText(text); setCopied(text) } catch { /* ignore */ }
  }

  return (
    <div className="rounded-xl bg-surface-card border border-default p-4 space-y-3">
      <h2 className="text-sm font-semibold text-theme-primary">{t('creatorTools.hookGenerator.title')}</h2>
      <textarea
        data-testid="hooks-input"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        rows={2}
        placeholder={t('creatorTools.hookGenerator.placeholder')}
        className="w-full rounded-lg bg-background border border-default p-2 text-sm text-theme-primary"
      />
      <div className="flex gap-2">
        <select
          data-testid="hooks-platform" aria-label={t('creatorTools.common.platform')} value={platform}
          onChange={(e) => setPlatform(e.target.value as Platform)}
          className="rounded bg-background border border-default p-1 text-sm text-theme-primary"
        >
          {PLATFORMS.map((p) => <option key={p} value={p}>{platformLabel(t, p)}</option>)}
        </select>
        <select
          data-testid="hooks-style" aria-label={t('creatorTools.hookGenerator.style')} value={style}
          onChange={(e) => setStyle(e.target.value as HookStyle)}
          className="rounded bg-background border border-default p-1 text-sm text-theme-primary"
        >
          {STYLES.map((s) => <option key={s} value={s}>{styleLabels[s] ?? s}</option>)}
        </select>
      </div>
      <button
        type="button"
        data-testid="hooks-run"
        onClick={run}
        disabled={loading}
        className="rounded-lg bg-primary hover:bg-primary/90 px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {loading ? t('creatorTools.common.generating') : t('creatorTools.hookGenerator.run')}
      </button>

      {error && <p data-testid="hooks-error" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {result && (result.hooks ?? []).length === 0 && (
        <p data-testid="hooks-empty" className="text-sm text-theme-secondary">{t('creatorTools.noResults')}</p>
      )}
      {result && (result.hooks ?? []).length > 0 && (
        <ul className="space-y-1" data-testid="hooks-results">
          {result.hooks.map((h, i) => (
            <li
              key={i}
              data-testid="hooks-item"
              className="flex items-start justify-between gap-2 rounded-lg bg-background border border-default p-2 text-sm text-theme-primary"
            >
              <span className="flex-1">{h.text}</span>
              <button
                type="button"
                data-testid="hooks-copy"
                onClick={() => copy(h.text)}
                className="text-xs text-theme-secondary hover:text-theme-primary whitespace-nowrap"
              >
                {copied === h.text ? t('creatorTools.common.copied') : t('creatorTools.common.copy')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
