'use client'

import { useState } from 'react'
import { handleApiError } from '@/lib/api'
import { useTranslation } from '@/hooks/useTranslation'
import { composeSlides, type SlideFormat, type SlideResult } from '@/lib/featuresApi'

const FORMATS: SlideFormat[] = ['carousel', 'thread']

/** Split one idea into ordered carousel slides / thread posts. */
export default function CarouselComposerPanel() {
  const { t } = useTranslation()
  const formatLabels: Record<string, string> = {
    carousel: t('creatorTools.carousel.formatCarousel'),
    thread: t('creatorTools.carousel.formatThread'),
  }
  const [topic, setTopic] = useState('')
  const [format, setFormat] = useState<SlideFormat>('carousel')
  const [result, setResult] = useState<SlideResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function run() {
    if (!topic.trim()) { setError(t('creatorTools.carousel.ideaRequired')); return }
    setLoading(true); setError(null); setCopied(false)
    try {
      setResult(await composeSlides({ topic, format }))
    } catch (e) {
      setError(handleApiError(e) || t('creatorTools.carousel.failed'))
    } finally {
      setLoading(false)
    }
  }

  async function copyAll() {
    if (!result) return
    const joined = result.slides.map((s) => `${s.n}. ${s.text}`).join('\n\n')
    try { await navigator.clipboard?.writeText(joined); setCopied(true) } catch { /* ignore */ }
  }

  return (
    <div className="rounded-xl bg-surface-card border border-default p-4 space-y-3">
      <h2 className="text-sm font-semibold text-theme-primary">{t('creatorTools.carousel.title')}</h2>
      <textarea
        data-testid="carousel-input"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        rows={2}
        placeholder={t('creatorTools.carousel.placeholder')}
        className="w-full rounded-lg bg-background border border-default p-2 text-sm text-theme-primary"
      />
      <div className="flex gap-2">
        <select
          data-testid="carousel-format" aria-label={t('creatorTools.common.format')} value={format}
          onChange={(e) => setFormat(e.target.value as SlideFormat)}
          className="rounded bg-background border border-default p-1 text-sm text-theme-primary"
        >
          {FORMATS.map((f) => <option key={f} value={f}>{formatLabels[f] ?? f}</option>)}
        </select>
        <button
          type="button"
          data-testid="carousel-run"
          onClick={run}
          disabled={loading}
          className="rounded-lg bg-primary hover:bg-primary/90 px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {loading ? t('creatorTools.common.composing') : t('creatorTools.common.compose')}
        </button>
      </div>

      {error && <p data-testid="carousel-error" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {result && (result.slides ?? []).length === 0 && (
        <p data-testid="carousel-empty" className="text-sm text-theme-secondary">{t('creatorTools.noResults')}</p>
      )}
      {result && (result.slides ?? []).length > 0 && (
        <div className="space-y-2" data-testid="carousel-results">
          <div className="flex items-center justify-between">
            <span className="text-xs text-theme-muted">{result.slides.length === 1
                ? t('creatorTools.carousel.slidesOne', { count: result.slides.length })
                : t('creatorTools.carousel.slidesOther', { count: result.slides.length })}</span>
            <button type="button" data-testid="carousel-copy-all" onClick={copyAll} className="text-xs text-theme-secondary hover:text-theme-primary">
              {copied ? t('creatorTools.common.copied') : t('creatorTools.common.copyAll')}
            </button>
          </div>
          <ol className="space-y-1">
            {result.slides.map((s) => (
              <li key={s.n} data-testid="carousel-slide" className="flex gap-2 rounded-lg bg-background border border-default p-2 text-sm text-theme-primary">
                <span className="text-theme-muted tabular-nums">{s.n}</span>
                <span className="flex-1">{s.text}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
