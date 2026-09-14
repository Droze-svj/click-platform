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
  high: {
    label: 'Well established',
    tone: 'text-emerald-500',
    detail: 'Enough of your work is measured that these patterns are dependable.',
  },
  medium: {
    label: 'Taking shape',
    tone: 'text-amber-500',
    detail: 'A pattern is emerging. It will sharpen as you publish more.',
  },
  low: {
    label: 'Still learning',
    tone: 'text-theme-muted',
    detail: 'Click has only seen a little of your work, so treat these as first impressions.',
  },
}

export default function CreatorDnaPage() {
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
        title="Your Creator DNA"
        description="What Click has measured about how you make things — and what it does with that."
        meta={
          <Badge variant="secondary" className={confidence.tone}>
            {confidence.label}
          </Badge>
        }
        actions={
          <>
            <Link href="/dashboard/click-learning">
              <Button variant="secondary" size="md">See the raw signals</Button>
            </Link>
            <Button
              variant="ghost"
              size="md"
              loading={refreshing}
              onClick={() => { setRefreshing(true); load() }}
              leftIcon={!refreshing ? <RefreshCw size={16} aria-hidden /> : undefined}
            >
              Refresh
            </Button>
          </>
        }
      />

      {!hasProfile ? (
        <ClickEmptyState
          intent="empty.analytics"
          title="Click hasn't learned your style yet"
          message="Publish a few clips and Click starts recording the fonts, hooks, pacing and grades you actually reach for. This page fills in from your real work — nothing is guessed."
          action={
            <Link href="/dashboard/forge">
              <Button variant="primary" size="md" leftIcon={<Sparkles size={16} aria-hidden />}>
                Make something
              </Button>
            </Link>
          }
        />
      ) : (
        <>
          {/* Honesty first: how much this is based on. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Choices recorded" value={String(sample)} />
            <StatCard label="Confidence" value={confidence.label} />
            <StatCard
              label="Primary platform"
              value={dna?.engagementDiffusionAnalysis?.metrics?.primaryPlatform || '—'}
            />
          </div>
          <p className="ds-text-caption text-theme-muted -mt-2">{confidence.detail}</p>

          {/* Aesthetic */}
          <Panel variant="bento" className="p-6">
            <SectionHeader
              as="h3"
              title="Your look"
              description="The visual choices you return to, and how they perform against your own baseline."
              className="mb-4"
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FacetList icon={<Type size={14} aria-hidden />} label="Fonts" values={list(dna?.topFonts)} />
              <FacetList icon={<Sparkles size={14} aria-hidden />} label="Caption styles" values={list(dna?.topCaptionStyles)} />
              <FacetList icon={<Palette size={14} aria-hidden />} label="Colour grades" values={list(dna?.topColorGrades)} />
              <FacetList icon={<TrendingUp size={14} aria-hidden />} label="Transitions" values={list(dna?.topTransitions)} />
            </div>
            {dna?.aestheticAffinityIndex?.verdict ? (
              <p className="mt-4 ds-text-body text-theme-secondary">{dna.aestheticAffinityIndex.verdict}</p>
            ) : null}
          </Panel>

          {/* Hooks / engagement */}
          <Panel variant="bento" className="p-6">
            <SectionHeader
              as="h3"
              title="How you open"
              description="Your hook habits, measured against your own retention where there's enough data."
              className="mb-4"
            />
            <div className="flex flex-wrap items-center gap-3">
              <FacetList icon={<Target size={14} aria-hidden />} label="Hooks" values={list(dna?.topHooks)} />
              {dna?.engagementDiffusionAnalysis?.metrics?.hookRetentionDelta ? (
                <Badge variant="secondary">
                  {dna.engagementDiffusionAnalysis.metrics.hookRetentionDelta} vs your baseline
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
                title="What to try next"
                description="Built from your own most-used choices — not generic advice."
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
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 ds-text-label text-theme-muted">
        {icon}
        <span>{label}</span>
      </div>
      {values.length === 0 ? (
        <p className="mt-1.5 ds-text-body text-theme-muted">Not enough data yet</p>
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
