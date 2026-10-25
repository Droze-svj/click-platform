'use client'

/**
 * /dashboard/creator-dna — the creator's measured style, and what Click does
 * with it.
 *
 * Reads GET /api/me/creator-dna, which had NO client consumer at all: the
 * service computed affinity, retention deltas, a confidence level and
 * recommendations, and none of it was ever shown to the person it described.
 *
 * Companion to /dashboard/click-learning: that page shows the raw counts Click
 * has recorded, this one shows the conclusions drawn from them. Read-only —
 * the profile changes by publishing work, not by editing it here.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Brain, Sparkles, Target, TrendingUp, Type, Palette, RefreshCw } from 'lucide-react'
import { apiGet } from '@/lib/api'
import ClickLoadingState from '@/components/click/ClickLoadingState'
import ClickEmptyState from '@/components/click/ClickEmptyState'
import { useTranslation } from '@/hooks/useTranslation'
import {
  PageShell,
  PageHeader,
  Panel,
  SectionHeader,
  StatCard,
  Badge,
  Button,
} from '@/components/ui'

interface WeightedPick {
  key: string
  count?: number
  performanceScore?: number
  sampleSize?: number
}

interface CreatorDna {
  empty?: boolean
  sample?: number
  confidence?: 'low' | 'medium' | 'high'
  topFonts?: string[]
  topCaptionStyles?: string[]
  topColorGrades?: string[]
  topTransitions?: string[]
  topHooks?: string[]
  topPlatforms?: string[]
  weightedTopFonts?: WeightedPick[]
  weightedTopHooks?: WeightedPick[]
  aestheticAffinityIndex?: { metrics?: Record<string, string>; verdict?: string }
  engagementDiffusionAnalysis?: {
    metrics?: { primaryPlatform?: string; hookRetentionDelta?: string | null; hookSampleSize?: number }
    verdict?: string
  }
  neuroMarketingRecommendations?: string[]
  computedAt?: string
}

/** How much Click actually knows, stated plainly rather than as a score. */
const CONFIDENCE_COPY: Record<string, { label: string; tone: string; detail: string }> = {
  high: { label: 'creatorDnaPage.confHigh', tone: 'text-emerald-500', detail: 'creatorDnaPage.confHighDetail' },
  medium: { label: 'creatorDnaPage.confMedium', tone: 'text-amber-500', detail: 'creatorDnaPage.confMediumDetail' },
  low: { label: 'creatorDnaPage.confLow', tone: 'text-theme-muted', detail: 'creatorDnaPage.confLowDetail' },
}

export default function CreatorDnaPage() {
  const { t } = useTranslation()
  const [dna, setDna] = useState<CreatorDna | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await apiGet<any>('/me/creator-dna')
      setDna((res?.data ?? res) as CreatorDna)
    } catch {
      setDna(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <PageShell>
        <ClickLoadingState intent="loading.learning" variant="block" />
      </PageShell>
    )
  }

  const sample = dna?.sample ?? 0
  const confidence = CONFIDENCE_COPY[dna?.confidence ?? 'low']
  const hasProfile = Boolean(dna && !dna.empty && sample > 0)

  const list = (values?: string[]) => (values ?? []).filter(Boolean)

  return (
    <PageShell>
      <PageHeader
        as="h2"
        icon={<Brain size={22} aria-hidden />}
        title={t('creatorDnaPage.title')}
        description={t('creatorDnaPage.description')}
        meta={
          <Badge variant="outline" className={confidence.tone}>
            {t(confidence.label)}
          </Badge>
        }
        actions={
          <>
            <Link href="/dashboard/click-learning">
              <Button variant="secondary" size="md">{t('creatorDnaPage.rawSignals')}</Button>
            </Link>
            <Button
              variant="ghost"
              size="md"
              loading={refreshing}
              onClick={() => { setRefreshing(true); load() }}
              leftIcon={!refreshing ? <RefreshCw size={16} aria-hidden /> : undefined}
            >
              {t('creatorDnaPage.refresh')}
            </Button>
          </>
        }
      />

      {!hasProfile ? (
        <ClickEmptyState
          intent="empty.analytics"
          title={t('creatorDnaPage.emptyTitle')}
          message={t('creatorDnaPage.emptyBody')}
          action={
            <Link href="/dashboard/forge">
              <Button variant="primary" size="md" leftIcon={<Sparkles size={16} aria-hidden />}>
                {t('creatorDnaPage.makeSomething')}
              </Button>
            </Link>
          }
        />
      ) : (
        <>
          {/* Honesty first: how much this is based on. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label={t('creatorDnaPage.statChoices')} value={String(sample)} />
            <StatCard label={t('creatorDnaPage.statConfidence')} value={t(confidence.label)} />
            <StatCard
              label={t('creatorDnaPage.statPlatform')}
              value={dna?.engagementDiffusionAnalysis?.metrics?.primaryPlatform || '—'}
            />
          </div>
          <p className="ds-text-caption text-theme-muted -mt-2">{t(confidence.detail)}</p>

          {/* Aesthetic */}
          <Panel variant="bento" className="p-6">
            <SectionHeader
              as="h3"
              title={t('creatorDnaPage.lookTitle')}
              description={t('creatorDnaPage.lookDesc')}
              className="mb-4"
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FacetList icon={<Type size={14} aria-hidden />} label={t('creatorDnaPage.fonts')} values={list(dna?.topFonts)} />
              <FacetList icon={<Sparkles size={14} aria-hidden />} label={t('creatorDnaPage.captionStyles')} values={list(dna?.topCaptionStyles)} />
              <FacetList icon={<Palette size={14} aria-hidden />} label={t('creatorDnaPage.colourGrades')} values={list(dna?.topColorGrades)} />
              <FacetList icon={<TrendingUp size={14} aria-hidden />} label={t('creatorDnaPage.transitions')} values={list(dna?.topTransitions)} />
            </div>
            {dna?.aestheticAffinityIndex?.verdict ? (
              <p className="mt-4 ds-text-body text-theme-secondary">{dna.aestheticAffinityIndex.verdict}</p>
            ) : null}
          </Panel>

          {/* Hooks / engagement */}
          <Panel variant="bento" className="p-6">
            <SectionHeader
              as="h3"
              title={t('creatorDnaPage.openTitle')}
              description={t('creatorDnaPage.openDesc')}
              className="mb-4"
            />
            <div className="flex flex-wrap items-center gap-3">
              <FacetList icon={<Target size={14} aria-hidden />} label={t('creatorDnaPage.hooks')} values={list(dna?.topHooks)} />
              {dna?.engagementDiffusionAnalysis?.metrics?.hookRetentionDelta ? (
                <Badge variant="secondary">
                  {t('creatorDnaPage.vsBaseline', { delta: dna.engagementDiffusionAnalysis.metrics.hookRetentionDelta })}
                </Badge>
              ) : null}
            </div>
            {dna?.engagementDiffusionAnalysis?.verdict ? (
              <p className="mt-4 ds-text-body text-theme-secondary">{dna.engagementDiffusionAnalysis.verdict}</p>
            ) : null}
          </Panel>

          {/* Suggestions */}
          {(dna?.neuroMarketingRecommendations?.length ?? 0) > 0 && (
            <Panel variant="bento" className="p-6">
              <SectionHeader
                as="h3"
                title={t('creatorDnaPage.nextTitle')}
                description={t('creatorDnaPage.nextDesc')}
                className="mb-4"
              />
              <ul className="flex flex-col gap-3">
                {dna!.neuroMarketingRecommendations!.map((rec, i) => (
                  <li key={i} className="flex gap-3 ds-text-body text-theme-secondary">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--primary))]" aria-hidden />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </>
      )}
    </PageShell>
  )
}

/** A labelled row of facet chips, or an honest dash when nothing is recorded. */
function FacetList({ icon, label, values }: { icon: React.ReactNode; label: string; values: string[] }) {
  const { t } = useTranslation()
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 ds-text-label text-theme-muted">
        {icon}
        <span>{label}</span>
      </div>
      {values.length === 0 ? (
        <p className="mt-1.5 ds-text-body text-theme-muted">{t('creatorDnaPage.notEnough')}</p>
      ) : (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {values.slice(0, 5).map((v) => (
            <Badge key={v} variant="outline">{v}</Badge>
          ))}
        </div>
      )}
    </div>
  )
}
