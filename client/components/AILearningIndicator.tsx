'use client'

/**
 * AILearningIndicator — small, ambient widget for the dashboard home.
 *
 * Surfaces a single sentence telling creators what the AI has learned from
 * their last edit session. Reads `/api/style-profile/insights` which is
 * already wired to the continuous-learning loop in creatorPerformanceService
 * (every published post's analytics fold into weighted style picks).
 *
 * Showing concrete "the AI knows X about you" is the cheapest trust-signal
 * we can ship — users keep using AI products that reveal their fingerprint.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Brain, Sparkles, ArrowRight } from 'lucide-react'
import { apiGet } from '../lib/api'
import { useTranslation } from '@/hooks/useTranslation'

interface Performer {
  key: string
  performanceScore?: number
  sampleSize?: number
}

interface InsightsResponse {
  topPerformers?: Record<string, Performer[]>
  lastIngestedAt?: string | null
}

// Maps a facet id to a translation key suffix under the `aiLearningIndicator`
// namespace. The human-readable label is resolved via `t()` at render time.
const FACET_LABEL_KEYS: Record<string, string> = {
  fonts: 'facetCaptionFont',
  captionStyles: 'facetCaptionStyle',
  animations: 'facetAnimationPreset',
  motions: 'facetMotionIntensity',
  hooks: 'facetHookFraming',
  colorGrades: 'facetColorGrade',
  transitions: 'facetTransitionStyle',
}

function pickStrongest(insights: InsightsResponse): { facet: string; performer: Performer } | null {
  const entries: { facet: string; performer: Performer }[] = []
  const tp = insights.topPerformers || {}
  for (const facet of Object.keys(tp)) {
    const top = (tp[facet] || []).find(p => (p.sampleSize || 0) >= 2)
    if (top) entries.push({ facet, performer: top })
  }
  if (entries.length === 0) return null
  // Pick the strongest signal: highest performanceScore × log(sampleSize+1).
  entries.sort((a, b) => {
    const sa = (a.performer.performanceScore || 0) * Math.log((a.performer.sampleSize || 0) + 1)
    const sb = (b.performer.performanceScore || 0) * Math.log((b.performer.sampleSize || 0) + 1)
    return sb - sa
  })
  return entries[0]
}

export default function AILearningIndicator() {
  const { t } = useTranslation()
  const [insights, setInsights] = useState<InsightsResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    apiGet<{ data: InsightsResponse }>('/style-profile/insights')
      .then(res => {
        if (!cancelled) setInsights((res as any)?.data || null)
      })
      .catch(() => { /* silent — widget is decorative */ })
    return () => { cancelled = true }
  }, [])

  if (!insights) return null
  const strongest = pickStrongest(insights)
  if (!strongest) return null

  const { facet, performer } = strongest
  const facetLabelKey = FACET_LABEL_KEYS[facet]
  const facetLabel = facetLabelKey ? t(`aiLearningIndicator.${facetLabelKey}`) : facet
  const direction = (performer.performanceScore || 0) >= 0
    ? t('aiLearningIndicator.directionLifts')
    : t('aiLearningIndicator.directionDrags')
  const pct = Math.round(Math.abs(performer.performanceScore || 0) * 100)

  return (
    <div
      role="note"
      aria-label={t('aiLearningIndicator.ariaLabel')}
      className="rounded-2xl border border-[var(--tint-indigo-edge)] bg-[var(--tint-indigo-bg)] backdrop-blur-md flex items-center gap-4 px-5 py-4"
    >
      <div className="w-10 h-10 rounded-xl bg-[var(--glass-surface)] border border-[var(--tint-indigo-edge)] flex items-center justify-center flex-shrink-0">
        <Brain size={18} className="text-[var(--tint-indigo-fg)]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--tint-indigo-fg)] mb-1">{t('aiLearningIndicator.aiLearned')}</p>
        <p className="text-sm text-[var(--text-main)] leading-snug">
          {t('aiLearningIndicator.insightPrefix')} <span className="font-semibold">{facetLabel}</span> {t('aiLearningIndicator.insightPick')} <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-[var(--glass-surface)] border border-[var(--glass-border)]">{performer.key}</span> {direction} {t('aiLearningIndicator.insightSuffix', { pct: pct ?? 0, count: performer.sampleSize ?? 0 })}
        </p>
      </div>
      <Link
        href="/dashboard/analytics/creator"
        className="hidden sm:inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--tint-indigo-fg)] hover:text-[var(--text-main)] transition-colors"
      >
        {t('aiLearningIndicator.seeMore')} <ArrowRight size={12} />
      </Link>
      <Sparkles size={14} className="text-[var(--tint-indigo-fg)] flex-shrink-0 sm:hidden" />
    </div>
  )
}
