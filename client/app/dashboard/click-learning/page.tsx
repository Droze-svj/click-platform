'use client'

/**
 * /dashboard/click-learning — the read-only "what has Click learned about me"
 * page. Reads two endpoints:
 *   - GET /api/style-profile             — the raw taste-graph facet counts
 *   - GET /api/video/clips/style-insight — the resolved top picks per facet
 *
 * The page makes the "Click grows with users" promise visible: the user
 * sees concrete picks Click has recorded from their published work, plus
 * the resolved top-of-mind preset/hook/caption-style/etc. As they publish
 * more, the numbers climb, so the page itself becomes a progress bar for
 * Click's understanding of them.
 *
 * This is intentionally read-only. Editing the profile happens implicitly
 * by publishing clips (the learning loop in styleLearningService).
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Sparkles,
  TrendingUp,
  Brain,
  Layers,
  Clock,
  Hash,
  Music,
  Type,
  Palette,
} from 'lucide-react'
import { apiGet } from '@/lib/api'
import { useTranslation } from '../../../hooks/useTranslation'
import ClickLoadingState from '@/components/click/ClickLoadingState'
import ClickEmptyState from '@/components/click/ClickEmptyState'
import { clickVoice } from '@/lib/clickVoice'
import { Button } from '../../../components/ui/button'

interface Counter {
  key: string
  count: number
  lastUsedAt?: string
}

interface StyleProfile {
  fonts?: Counter[]
  captionStyles?: Counter[]
  animations?: Counter[]
  presets?: Counter[]
  hookStyles?: Counter[]
  transitions?: Counter[]
  colorGrades?: Counter[]
  musicGenres?: Counter[]
  platforms?: Counter[]
  niches?: Counter[]
  publishHours?: Counter[]
  publishDays?: Counter[]
  averages?: { avgCaptionLength?: number | null }
}

interface StyleInsight {
  source?: string
  totalPicks?: number
  topPicks?: Record<string, string | null>
}

const FACET_META: Record<
  string,
  { label: string; icon: React.ReactNode; intent: string }
> = {
  presets: { label: 'Preset', icon: <Sparkles className="w-4 h-4" />, intent: 'preset' },
  hookStyles: { label: 'Hook', icon: <TrendingUp className="w-4 h-4" />, intent: 'hook' },
  captionStyles: { label: 'Caption Style', icon: <Type className="w-4 h-4" />, intent: 'caption' },
  transitions: { label: 'Transition', icon: <Layers className="w-4 h-4" />, intent: 'transition' },
  colorGrades: { label: 'Color Grade', icon: <Palette className="w-4 h-4" />, intent: 'colorgrade' },
  musicGenres: { label: 'Music', icon: <Music className="w-4 h-4" />, intent: 'music' },
  platforms: { label: 'Platform', icon: <Hash className="w-4 h-4" />, intent: 'platform' },
  niches: { label: 'Niche', icon: <Brain className="w-4 h-4" />, intent: 'niche' },
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function totalCount(counters?: Counter[]): number {
  if (!Array.isArray(counters)) return 0
  return counters.reduce((sum, c) => sum + (c.count || 0), 0)
}

function topThree(counters?: Counter[]): Counter[] {
  if (!Array.isArray(counters)) return []
  return [...counters].sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 3)
}

export default function ClickLearningPage() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<StyleProfile | null>(null)
  const [insight, setInsight] = useState<StyleInsight | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // Run both in parallel — they're independent. Either one failing
        // doesn't sink the page; we render whatever came back.
        const [profileRes, insightRes] = await Promise.allSettled([
          apiGet<{ data?: StyleProfile } & StyleProfile>('/style-profile'),
          apiGet<{ data?: StyleInsight } & StyleInsight>('/video/clips/style-insight'),
        ])
        if (cancelled) return
        if (profileRes.status === 'fulfilled') {
          const p = (profileRes.value as any)?.data ?? profileRes.value
          setProfile(p ?? null)
        }
        if (insightRes.status === 'fulfilled') {
          const i = (insightRes.value as any)?.data ?? insightRes.value
          setInsight(i ?? null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen ds-bg-mesh-soft flex items-center justify-center">
        <ClickLoadingState intent="loading.analyzing" />
      </div>
    )
  }

  const totalPicks =
    insight?.totalPicks ??
    Object.keys(FACET_META).reduce(
      (sum, facet) => sum + totalCount((profile as any)?.[facet]),
      0
    )

  // Cold start — nothing learned yet. Show the warm "Click is ready"
  // empty state so the user knows where this page WILL fill in once
  // they start publishing.
  if (totalPicks === 0) {
    return (
      <div className="min-h-screen ds-bg-mesh-soft text-theme-primary pb-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 py-12">
          <ClickEmptyState
            intent="empty.analytics"
            title={t('clickLearningPage.emptyTitle')}
            icon={<Brain className="w-7 h-7 text-primary" />}
            action={
              <Link href="/dashboard/clips/hub">
                <Button variant="primary">{t('clickLearningPage.publishFirstClip')}</Button>
              </Link>
            }
          />
        </div>
      </div>
    )
  }

  // Resolve a list of populated facets so the page only renders cards
  // for things the user has actually picked at least once.
  const populatedFacets = Object.entries(FACET_META).filter(
    ([key]) => totalCount((profile as any)?.[key]) > 0
  )

  return (
    <div className="min-h-screen ds-bg-mesh-soft text-theme-primary pb-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-8 ds-anim-fade-in">
        {/* Headline */}
        <div className="space-y-3">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
            <Sparkles className="w-3 h-3" /> {t('clickLearningPage.tasteGraphBadge')}
          </span>
          <h1 className="ds-text-h1 text-theme-primary">
            {t('clickLearningPage.headlineBefore')} <span className="text-primary">{totalPicks}</span> {t('clickLearningPage.headlineAfter')}
          </h1>
          <p className="text-theme-secondary max-w-2xl">
            {clickVoice('success.learned')} {t('clickLearningPage.refineCopy')}
          </p>
        </div>

        {/* Top picks by facet */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {populatedFacets.map(([facet, meta]) => {
            const counters = (profile as any)?.[facet] as Counter[] | undefined
            const top = topThree(counters)
            const facetTotal = totalCount(counters)
            const resolved = insight?.topPicks?.[facet] || null
            return (
              <div key={facet} className="ds-surface-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-theme-secondary">
                    {meta.icon}
                    <span className="ds-text-label">
                      {t(`clickLearningPage.facets.${facet}`)}
                    </span>
                  </div>
                  <span className="ds-text-caption">
                    {t('clickLearningPage.picksCount', { count: facetTotal })}
                  </span>
                </div>
                <ul className="space-y-2">
                  {top.map((c) => {
                    const isResolvedTop = resolved === c.key
                    const pct = facetTotal > 0 ? Math.round((c.count / facetTotal) * 100) : 0
                    return (
                      <li key={c.key} className="flex items-center justify-between gap-3">
                        <span className={isResolvedTop ? 'text-sm text-primary font-semibold' : 'text-sm text-theme-secondary'}>
                          {c.key}
                          {isResolvedTop && (
                            <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                              {t('clickLearningPage.topBadge')}
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-theme-muted tabular-nums">
                          {c.count} ({pct}%)
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </section>

        {/* Publish timing pattern */}
        {totalCount(profile?.publishHours) > 0 && (
          <PublishTiming
            hours={profile?.publishHours}
            days={profile?.publishDays}
          />
        )}

        {/* Caption length signal */}
        {profile?.averages?.avgCaptionLength != null && (
          <div className="ds-surface-card p-5">
            <div className="flex items-center gap-2 mb-2 text-theme-secondary">
              <Type className="w-4 h-4" />
              <span className="ds-text-label">
                {t('clickLearningPage.avgCaptionLength')}
              </span>
            </div>
            <p className="ds-text-h2 text-theme-primary tabular-nums">
              {t('clickLearningPage.chars', { count: Math.round(profile.averages.avgCaptionLength) })}
            </p>
            <p className="ds-text-caption mt-1">
              {t('clickLearningPage.captionLengthDesc')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function PublishTiming({
  hours,
  days,
}: {
  hours?: Counter[]
  days?: Counter[]
}) {
  const { t } = useTranslation()
  const topHour = (hours || []).slice().sort((a, b) => (b.count || 0) - (a.count || 0))[0]
  const topDay = (days || []).slice().sort((a, b) => (b.count || 0) - (a.count || 0))[0]
  const hourLabel = topHour ? `${topHour.key}:00` : null
  const dayLabel = topDay ? DAY_LABELS[Number(topDay.key) % 7] : null

  return (
    <section className="ds-surface-card p-5">
      <div className="flex items-center gap-2 mb-4 text-theme-secondary">
        <Clock className="w-4 h-4" />
        <span className="ds-text-label">
          {t('clickLearningPage.publishingRhythm')}
        </span>
      </div>
      <p className="text-theme-secondary leading-relaxed">
        {t('clickLearningPage.rhythmBefore')} <span className="font-semibold text-theme-primary">{dayLabel}</span>{' '}
        {t('clickLearningPage.rhythmMiddle')} <span className="font-semibold text-theme-primary">{hourLabel}</span>{t('clickLearningPage.rhythmAfter')}
      </p>
    </section>
  )
}
