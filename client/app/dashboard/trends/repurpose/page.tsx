'use client'

import React, { useState } from 'react'
import {
  Recycle, Hash, Music, FileText, Sparkles,
  ChevronDown, Search, Copy, Link2, Zap,
} from 'lucide-react'
import { useToast } from '../../../../contexts/ToastContext'
import ToastContainer from '../../../../components/ToastContainer'
import { apiGet, handleApiError } from '../../../../lib/api'
import { cn } from '../../../../lib/utils'
import { useTranslation } from '@/hooks/useTranslation'
import {
  Panel,
  Button,
  Badge,
  EmptyState,
  SectionHeader,
  PageShell,
} from '../../../../components/ui'

// ── Honest contract ──────────────────────────────────────────────────────────
// Every field below is mapped 1:1 from the live /api/trends/repurpose payload.
// Nothing is seeded, scored, or invented client-side — when the backend reports
// no live trend data we render an explicit "unavailable" empty state instead.
type SuggestionKind = 'hashtag' | 'topic' | 'sound'

interface RepurposeSuggestion {
  trend: string
  kind: SuggestionKind
  relevanceScore?: number
  whyNow?: string
  sourceContentId?: string
  sourceTitle?: string
  platform?: string
  suggestedCaption?: string
  suggestedHashtags?: string[]
}

interface RepurposeResponse {
  platform: string
  suggestions: RepurposeSuggestion[]
  total: number
  available: boolean
  reason?: string
}

type Platform = 'tiktok' | 'instagram' | 'youtube' | 'x'

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'x', label: 'X' },
]

type TFn = (key: string, params?: Record<string, string | number>) => string

const KIND_CFG: Record<SuggestionKind, { icon: typeof Hash; color: string; bg: string }> = {
  hashtag: { icon: Hash,     color: 'text-indigo-500',  bg: 'bg-indigo-500/10 border-indigo-500/20' },
  topic:   { icon: FileText, color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  sound:   { icon: Music,    color: 'text-fuchsia-500', bg: 'bg-fuchsia-500/10 border-fuchsia-500/20' },
}

function kindLabel(t: TFn, kind: SuggestionKind): string {
  switch (kind) {
    case 'hashtag': return t('trendRepurposePage.kindHashtag')
    case 'topic': return t('trendRepurposePage.kindTopic')
    case 'sound': return t('trendRepurposePage.kindSound')
  }
}

function kindConfig(t: TFn, kind?: string) {
  if (kind === 'hashtag' || kind === 'topic' || kind === 'sound') {
    return { label: kindLabel(t, kind), ...KIND_CFG[kind] }
  }
  // Unknown kind from the API — surface it honestly rather than guessing.
  return { label: kind ? String(kind) : t('trendRepurposePage.kindTrend'), icon: Sparkles, color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20' }
}

/**
 * The API reports why there are no suggestions as a machine code
 * (no_trends / no_content / trends_unavailable). Map each to a plain
 * title + sentence; anything unrecognised falls back to the generic copy.
 */
function unavailableCopy(t: TFn, reason?: string): { title: string; description: string } {
  switch (reason?.trim()) {
    case 'no_trends':
      return {
        title: t('trendRepurposePage.noTrendsTitle'),
        description: t('trendRepurposePage.noTrendsDescription'),
      }
    case 'no_content':
      return {
        title: t('trendRepurposePage.noContentTitle'),
        description: t('trendRepurposePage.noContentDescription'),
      }
    default:
      return {
        title: t('trendRepurposePage.unavailableTitle'),
        description: t('trendRepurposePage.unavailableDescription'),
      }
  }
}

export default function TrendRepurposePage() {
  const { showToast } = useToast()
  const { t } = useTranslation()
  const [platform, setPlatform] = useState<Platform>('tiktok')
  const [data, setData] = useState<RepurposeResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const findIdeas = async () => {
    setLoading(true)
    try {
      const res = await apiGet<{ data: RepurposeResponse }>(
        `/trends/repurpose?platform=${encodeURIComponent(platform)}&limit=6`
      )
      setData(res?.data ?? null)
    } catch (err) {
      setData(null)
      showToast(handleApiError(err) || t('trendRepurposePage.errLoad'), 'error')
    } finally {
      setSearched(true)
      setLoading(false)
    }
  }

  const copyCaption = async (s: RepurposeSuggestion) => {
    const caption = s.suggestedCaption?.trim() || ''
    const tags = (s.suggestedHashtags ?? []).join(' ')
    const payload = [caption, tags].filter(Boolean).join('\n\n')
    if (!payload) {
      showToast(t('trendRepurposePage.nothingToCopy'), 'info')
      return
    }
    try {
      await navigator.clipboard.writeText(payload)
      showToast(t('trendRepurposePage.copiedToast'), 'success')
    } catch {
      showToast(t('trendRepurposePage.errCopy'), 'error')
    }
  }

  const suggestions = data?.suggestions ?? []
  const unavailable = searched && !loading && (data?.available === false || suggestions.length === 0)
  const unavailableText = unavailableCopy(t, data?.reason)

  return (
    <PageShell width="wide" className="ds-bg-mesh-soft min-h-screen overflow-x-hidden">
      <ToastContainer />

      {/* ── Header ── */}
      <SectionHeader
        as="h1"
        title={t('trendRepurposePage.title')}
        description={t('trendRepurposePage.subtitle')}
        className="mb-6"
      />

      {/* ── Controls ── */}
      <Panel variant="bento" className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 md:items-end">
          {/* Platform Select */}
          <div className="relative max-w-xs">
            <label className="ds-text-caption mb-1.5 block text-theme-secondary">{t('trendRepurposePage.platformLabel')}</label>
            <div className="relative">
              <select
                value={platform}
                title={t('trendRepurposePage.choosePlatform')}
                aria-label={t('trendRepurposePage.choosePlatform')}
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
            onClick={findIdeas}
            loading={loading}
            leftIcon={<Recycle className="h-4 w-4" aria-hidden />}
            className="md:w-auto"
          >
            {t('trendRepurposePage.findButton')}
          </Button>
        </div>
      </Panel>

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="ds-bento-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="ds-surface-card h-64 animate-pulse" aria-hidden />
          ))}
        </div>
      )}

      {/* ── Suggestions grid ── */}
      {!loading && suggestions.length > 0 && (
        <div className="ds-bento-grid">
          {suggestions.map((s, idx) => {
            const cfg = kindConfig(t, s.kind)
            const KindIcon = cfg.icon
            const tags = s.suggestedHashtags ?? []
            const score = typeof s.relevanceScore === 'number' ? Math.round(s.relevanceScore) : null
            return (
              <Panel key={`${s.kind}-${s.trend}-${idx}`} variant="bento" className="flex h-full flex-col">
                {/* Top row: kind icon + badges */}
                <div className="flex items-start justify-between gap-2 mb-4">
                  <span className={cn('flex h-10 w-10 items-center justify-center rounded-lg', cfg.bg)}>
                    <KindIcon className={cn('h-5 w-5', cfg.color)} aria-hidden />
                  </span>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <Badge variant="secondary">{cfg.label}</Badge>
                    {score !== null && (
                      <Badge variant="outline" className="gap-1">
                        <Zap className="h-3 w-3" aria-hidden />
                        {t('trendRepurposePage.matchPercent', { score })}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Trend label */}
                <h3 className="ds-text-h3 text-theme-primary leading-tight break-words">{s.trend}</h3>

                {/* Why now */}
                {s.whyNow && (
                  <p className="mt-2 text-sm text-theme-muted leading-relaxed">{s.whyNow}</p>
                )}

                {/* Source clip pairing */}
                <div className="mt-3 flex items-center gap-1.5 text-xs text-theme-secondary">
                  <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate">
                    {t('trendRepurposePage.pairsWith')} <span className="text-theme-primary font-medium">{s.sourceTitle?.trim() || t('trendRepurposePage.aRecentClip')}</span>
                  </span>
                </div>

                {/* Draft caption */}
                {s.suggestedCaption?.trim() && (
                  <blockquote className="mt-4 ds-surface-subtle rounded-lg border-l-2 border-primary/40 px-3 py-2.5 text-sm text-theme-secondary italic leading-relaxed">
                    {s.suggestedCaption}
                  </blockquote>
                )}

                {/* Hashtag chips */}
                {tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {tags.map((tag, i) => (
                      <span
                        key={`${tag}-${i}`}
                        className="inline-flex items-center rounded-full ds-surface-subtle px-2.5 py-0.5 text-xs font-medium text-theme-secondary"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="mt-auto pt-4 flex items-center justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyCaption(s)}
                    leftIcon={<Copy className="h-3.5 w-3.5" aria-hidden />}
                    title={t('trendRepurposePage.copyCaptionTitle')}
                    aria-label={t('trendRepurposePage.copyCaptionTitle')}
                  >
                    {t('trendRepurposePage.copyCaption')}
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
          title={unavailableText.title}
          description={unavailableText.description}
          className="ds-surface-card"
        />
      )}

      {/* ── Initial idle state ── */}
      {!loading && !searched && (
        <EmptyState
          icon={Recycle}
          title={t('trendRepurposePage.idleTitle')}
          description={t('trendRepurposePage.idleDescription')}
          className="ds-surface-card"
        />
      )}
    </PageShell>
  )
}
