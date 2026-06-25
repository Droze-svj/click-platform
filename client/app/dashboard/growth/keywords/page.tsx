'use client'

import React, { useState } from 'react'
import {
  Search, Copy, ChevronDown, KeyRound, Target,
  TrendingUp, Swords, Sparkles, Info,
} from 'lucide-react'
import { useToast } from '../../../../contexts/ToastContext'
import ToastContainer from '../../../../components/ToastContainer'
import { apiGet, handleApiError } from '../../../../lib/api'
import { cn } from '../../../../lib/utils'
import {
  Panel,
  Button,
  Input,
  Badge,
  EmptyState,
  SectionHeader,
} from '../../../../components/ui'

// ── Honest contract ──────────────────────────────────────────────────────────
// Every field below is mapped 1:1 from the live /api/seo/keywords payload.
// Nothing is seeded, scored, or invented client-side — when the backend reports
// no live keyword data we render an explicit "unavailable" empty state instead.
// `demand` is a RELATIVE estimate derived from autocomplete signals, NOT an
// absolute monthly search volume; that framing is surfaced to the user below.
type Recommendation = 'target' | 'secondary' | 'long-tail'

interface KeywordIdea {
  keyword: string
  score: number
  demand: number
  competition: number
  relevance: number
  recommendation: Recommendation
  source?: string
}

interface KeywordResponse {
  seed: string
  platform: string
  ideas: KeywordIdea[]
  total: number
  available: boolean
  source?: string
}

type Platform = 'youtube' | 'tiktok' | 'instagram' | 'x'

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'x', label: 'X' },
]

// Badge only ships default | outline | secondary | destructive, so the
// recommendation tier is carried via className colours on a base secondary badge:
// 'target' green, 'secondary' amber, 'long-tail' neutral.
type BadgeVariant = 'default' | 'outline' | 'secondary' | 'destructive'

const RECO_CFG: Record<Recommendation, { label: string; variant: BadgeVariant; className: string }> = {
  target:      { label: 'Target',    variant: 'secondary', className: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20' },
  secondary:   { label: 'Secondary', variant: 'secondary', className: 'bg-amber-500/15 text-amber-500 border-amber-500/20' },
  'long-tail': { label: 'Long-tail', variant: 'secondary', className: '' },
}

function recoConfig(reco?: string): { label: string; variant: BadgeVariant; className: string } {
  if (reco === 'target' || reco === 'secondary' || reco === 'long-tail') return RECO_CFG[reco]
  // Unknown recommendation from the API — surface it honestly rather than guessing.
  return { label: reco ? String(reco) : 'Idea', variant: 'secondary', className: '' }
}

// Color-tier the prominent 0–100 score: ≥70 green, 45–69 amber, <45 neutral.
function scoreTier(score: number): { text: string; ring: string } {
  if (score >= 70) return { text: 'text-emerald-500', ring: 'border-emerald-500/30 bg-emerald-500/10' }
  if (score >= 45) return { text: 'text-amber-500', ring: 'border-amber-500/30 bg-amber-500/10' }
  return { text: 'text-theme-secondary', ring: 'border-input bg-background' }
}

// Clamp a raw 0–100 metric so a wayward API value can't blow out the bar width.
function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

// A small labelled 0–100 bar for demand / competition / relevance.
function MetricBar({
  icon: MetricIcon,
  label,
  value,
  barClass,
}: {
  icon: typeof TrendingUp
  label: string
  value?: number
  barClass: string
}) {
  const pct = clampPct(typeof value === 'number' ? value : 0)
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-xs text-theme-secondary">
          <MetricIcon className="h-3 w-3 shrink-0" aria-hidden />
          {label}
        </span>
        <span className="text-xs font-medium text-theme-primary tabular-nums">{pct}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full ds-surface-subtle" aria-hidden>
        <div className={cn('h-full rounded-full', barClass)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function KeywordExplorerPage() {
  const toast = useToast()
  const [seed, setSeed] = useState('')
  const [platform, setPlatform] = useState<Platform>('youtube')
  const [data, setData] = useState<KeywordResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const findKeywords = async () => {
    const trimmed = seed.trim()
    if (!trimmed) {
      toast.info('Enter a seed keyword to explore')
      return
    }
    setLoading(true)
    try {
      const res = await apiGet<{ data: KeywordResponse }>(
        '/api/seo/keywords?seed=' + encodeURIComponent(trimmed) +
          '&platform=' + platform + '&limit=15',
      )
      setData(res?.data ?? null)
    } catch (err) {
      setData(null)
      toast.error(handleApiError(err) || 'Could not load keyword ideas')
    } finally {
      setSearched(true)
      setLoading(false)
    }
  }

  const useAsTarget = async (keyword?: string) => {
    const value = keyword?.trim() || ''
    if (!value) {
      toast.info('Nothing to copy for this keyword')
      return
    }
    try {
      await navigator.clipboard.writeText(value)
      toast.success('Copied — paste into the SEO Scorecard.')
    } catch {
      toast.error('Could not copy to clipboard')
    }
  }

  const ideas = data?.ideas ?? []
  const unavailable = searched && !loading && (data?.available === false || ideas.length === 0)

  return (
    <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1700px] mx-auto overflow-x-hidden text-theme-primary">
      <ToastContainer />

      {/* ── Header ── */}
      <SectionHeader
        as="h1"
        title="Keyword Explorer"
        description="Research keywords worth targeting. Enter a seed term and we surface ranked ideas pulled straight from live autocomplete data — never fabricated."
        className="mb-6"
      />

      {/* ── Controls ── */}
      <Panel variant="bento" className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-4 md:items-end">
          {/* Seed keyword */}
          <div className="relative">
            <label className="ds-text-caption mb-1.5 block text-theme-secondary">Seed keyword</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" aria-hidden />
              <Input
                type="text"
                title="Seed keyword"
                aria-label="Seed keyword"
                placeholder="e.g. ai video editing"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') findKeywords() }}
                className="pl-9"
              />
            </div>
          </div>

          {/* Platform Select */}
          <div className="relative md:w-44">
            <label className="ds-text-caption mb-1.5 block text-theme-secondary">Platform</label>
            <div className="relative">
              <select
                value={platform}
                title="Choose a platform"
                aria-label="Choose a platform"
                onChange={(e) => setPlatform(e.target.value as Platform)}
                className="w-full appearance-none rounded-lg border border-input bg-background px-3 h-10 pr-9 text-sm text-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
              >
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" aria-hidden />
            </div>
          </div>

          <Button
            variant="gradient"
            onClick={findKeywords}
            loading={loading}
            leftIcon={<KeyRound className="h-4 w-4" aria-hidden />}
            className="md:w-auto"
          >
            Find Keywords
          </Button>
        </div>
      </Panel>

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="ds-bento-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="ds-surface-card h-56 animate-pulse" aria-hidden />
          ))}
        </div>
      )}

      {/* ── Honest framing note (only once we have live ideas to show) ── */}
      {!loading && ideas.length > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-input ds-surface-subtle px-3.5 py-2.5 text-xs text-theme-secondary leading-relaxed">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-theme-muted" aria-hidden />
          <span>
            <span className="font-medium text-theme-primary">Demand</span> is a relative estimate
            derived from autocomplete signals — not absolute monthly search volume. Use the scores
            to compare ideas against each other, not as exact traffic figures.
          </span>
        </div>
      )}

      {/* ── Ranked ideas (already score-desc from the API) ── */}
      {!loading && ideas.length > 0 && (
        <div className="ds-bento-grid">
          {ideas.map((idea, idx) => {
            const score = clampPct(typeof idea?.score === 'number' ? idea.score : 0)
            const tier = scoreTier(score)
            const reco = recoConfig(idea?.recommendation)
            return (
              <Panel key={`${idea?.keyword ?? 'idea'}-${idx}`} variant="bento" className="flex h-full flex-col">
                {/* Top row: rank + recommendation */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className="inline-flex items-center gap-1.5 text-xs text-theme-muted">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    #{idx + 1}
                  </span>
                  <Badge variant={reco.variant} className={reco.className}>{reco.label}</Badge>
                </div>

                {/* Keyword + prominent score */}
                <div className="flex items-start justify-between gap-3">
                  <h3 className="ds-text-h3 text-theme-primary leading-tight break-words min-w-0">
                    {idea?.keyword ?? '—'}
                  </h3>
                  <span
                    className={cn(
                      'flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border',
                      tier.ring,
                    )}
                    title="Opportunity score (0–100)"
                  >
                    <span className={cn('text-lg font-bold leading-none tabular-nums', tier.text)}>{score}</span>
                    <span className="text-[9px] uppercase tracking-wide text-theme-muted">score</span>
                  </span>
                </div>

                {/* Metric bars */}
                <div className="mt-4 grid grid-cols-1 gap-3">
                  <MetricBar icon={TrendingUp} label="Demand" value={idea?.demand} barClass="bg-emerald-500/70" />
                  <MetricBar icon={Swords} label="Competition" value={idea?.competition} barClass="bg-rose-500/70" />
                  <MetricBar icon={Target} label="Relevance" value={idea?.relevance} barClass="bg-indigo-500/70" />
                </div>

                {/* Source tag */}
                {idea?.source && (
                  <div className="mt-3">
                    <Badge variant="outline">{idea.source}</Badge>
                  </div>
                )}

                {/* Action */}
                <div className="mt-auto pt-4 flex items-center justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => useAsTarget(idea?.keyword)}
                    leftIcon={<Copy className="h-3.5 w-3.5" aria-hidden />}
                    title="Copy keyword to clipboard"
                    aria-label="Use as target keyword"
                  >
                    Use as target
                  </Button>
                </div>
              </Panel>
            )
          })}
        </div>
      )}

      {/* ── Unavailable / empty (no fabrication) ── */}
      {unavailable && (
        <EmptyState
          icon={Search}
          title="No live keyword data for this seed"
          description="We could not pull live keyword ideas for this seed right now. Rather than invent any, we are showing nothing — try a broader seed term or another platform."
          className="ds-surface-card"
        />
      )}

      {/* ── Initial idle state ── */}
      {!loading && !searched && (
        <EmptyState
          icon={KeyRound}
          title="Explore keywords"
          description="Enter a seed keyword and pick a platform. We will surface ranked, live keyword ideas — each with an opportunity score and a copy-ready target."
          className="ds-surface-card"
        />
      )}
    </div>
  )
}
