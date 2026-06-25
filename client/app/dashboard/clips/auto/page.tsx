'use client'

import React, { useEffect, useState, useCallback } from 'react'
import {
  Sparkles, Wand2, Film, Search, ChevronDown, Flame, Clock, Hash,
} from 'lucide-react'
import { apiGet, apiPost } from '../../../../lib/api'
import {
  Panel,
  Button,
  Badge,
  StatCard,
  EmptyState,
  SectionHeader,
  Input,
} from '../../../../components/ui'
import { useToast } from '../../../../contexts/ToastContext'
import ToastContainer from '../../../../components/ToastContainer'

// ── Types ────────────────────────────────────────────────────────────────
// Strict shapes for the live backend payloads. Only fields the API actually
// returns are typed/rendered — nothing is fabricated. Everything is optional
// where the backend may omit it, and the UI optional-chains accordingly.

interface ContentItem {
  _id: string
  title?: string
  status?: string
  createdAt?: string
  thumbnailUrl?: string
}

interface Clip {
  id: string
  rank?: number
  startTime?: number
  endTime?: number
  durationSec?: number
  viralityScore?: number
  hook?: string
  triggerType?: string
  reason?: string
}

interface AutoClipResponse {
  clips?: Clip[]
  total?: number
  hookScore?: number
  narrativeStructure?: string
  niche?: string
  topPlatform?: string
  // When the source video has no transcript the backend returns
  // { clips: [], message } — surfaced via an EmptyState.
  message?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Format a second offset as "m:ss" (e.g. 65 → "1:05"). */
function fmtTime(sec?: number): string {
  const total = Math.max(0, Math.floor(typeof sec === 'number' && isFinite(sec) ? sec : 0))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Map a virality score (0-100) to a Badge color tier. */
function scoreTone(score?: number): { direction: 'up' | 'down' | 'neutral'; badge: string; ring: string } {
  const n = typeof score === 'number' ? score : 0
  if (n >= 70) {
    return {
      direction: 'up',
      badge: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
      ring: 'bg-emerald-500/10 border-emerald-500/20',
    }
  }
  if (n >= 40) {
    return {
      direction: 'neutral',
      badge: 'bg-amber-500/10 text-amber-500 border border-amber-500/20',
      ring: 'bg-amber-500/10 border-amber-500/20',
    }
  }
  return {
    direction: 'neutral',
    badge: 'ds-surface-subtle text-theme-secondary',
    ring: 'ds-surface-subtle',
  }
}

function contentLabel(item: ContentItem): string {
  const t = (item.title || '').trim()
  return t || item._id
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function AutoClipsPage() {
  const { showToast } = useToast()

  const [content, setContent] = useState<ContentItem[]>([])
  const [contentLoading, setContentLoading] = useState(true)
  const [contentFailed, setContentFailed] = useState(false)

  const [selectedId, setSelectedId] = useState('')
  const [manualId, setManualId] = useState('')

  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<AutoClipResponse | null>(null)

  // Load recent content for the source picker.
  useEffect(() => {
    let cancelled = false
    setContentLoading(true)
    apiGet<{ success?: boolean; message?: string; data?: ContentItem[] }>('/content?limit=20')
      .then((res) => {
        if (cancelled) return
        const list = Array.isArray(res?.data) ? res.data : []
        // Filter to completed items only when the status field is present.
        const usable = list.filter((c) => c?._id && (c.status === undefined || c.status === 'completed'))
        setContent(usable)
        setContentFailed(usable.length === 0)
      })
      .catch(() => {
        if (cancelled) return
        setContent([])
        setContentFailed(true)
      })
      .finally(() => {
        if (!cancelled) setContentLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  // The contentId we'll actually generate against: the dropdown selection,
  // falling back to a manually-pasted id.
  const activeId = (selectedId || manualId).trim()

  const generate = useCallback(async () => {
    const contentId = (selectedId || manualId).trim()
    if (!contentId || generating) return
    setGenerating(true)
    try {
      const res = await apiPost<{ data?: AutoClipResponse }>(
        `/video/${contentId}/auto-clip`,
        { maxClips: 10 }
      )
      setResult(res?.data ?? null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate clips.'
      showToast(message, 'error')
    } finally {
      setGenerating(false)
    }
  }, [selectedId, manualId, generating, showToast])

  const clips = (result?.clips ?? [])
    .slice()
    .sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER))

  const hasResult = result !== null
  const noTranscript = hasResult && clips.length === 0

  return (
    <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1700px] mx-auto overflow-x-hidden text-theme-primary">
      <ToastContainer />

      <SectionHeader
        as="h1"
        title="AI Clips"
        description="Auto-generate a ranked gallery of viral-ready clips from any of your finished videos."
        className="mb-6"
      />

      {/* ── Source picker ── */}
      <Panel variant="bento" className="mb-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
          <div className="space-y-4">
            {/* Dropdown of recent content */}
            <div className="space-y-1.5">
              <label className="ds-text-label text-theme-secondary">Source video</label>
              <div className="relative">
                <Film size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" aria-hidden />
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  disabled={contentLoading || content.length === 0}
                  aria-label="Select source video"
                  title="Select source video"
                  className="w-full appearance-none rounded-lg border border-input bg-background pl-9 pr-9 h-10 text-sm text-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer disabled:opacity-50"
                >
                  <option value="">
                    {contentLoading
                      ? 'Loading your videos…'
                      : content.length === 0
                        ? 'No completed videos found'
                        : 'Select a video…'}
                  </option>
                  {content.map((c) => (
                    <option key={c._id} value={c._id}>{contentLabel(c)}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" aria-hidden />
              </div>
            </div>

            {/* Manual contentId fallback — shown when the list is empty/failed */}
            {!contentLoading && (contentFailed || content.length === 0) && (
              <div className="space-y-1.5">
                <label className="ds-text-label text-theme-secondary">Or paste a content ID</label>
                <div className="relative">
                  <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" aria-hidden />
                  <Input
                    type="text"
                    value={manualId}
                    onChange={(e) => setManualId(e.target.value)}
                    placeholder="Paste a contentId…"
                    aria-label="Content ID"
                    className="pl-9"
                  />
                </div>
              </div>
            )}
          </div>

          <Button
            variant="primary"
            size="lg"
            leftIcon={<Wand2 className="w-4 h-4" aria-hidden />}
            onClick={generate}
            loading={generating}
            disabled={!activeId || generating}
            className="w-full md:w-auto"
          >
            {generating ? 'Generating…' : 'Generate Clips'}
          </Button>
        </div>
      </Panel>

      {/* ── Header summary ── */}
      {hasResult && !noTranscript && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
          {typeof result?.hookScore === 'number' && (
            <StatCard label="Hook Score" value={Math.round(result.hookScore)} icon={Flame} />
          )}
          {result?.niche && (
            <StatCard label="Niche" value={result.niche} icon={Sparkles} />
          )}
          {result?.topPlatform && (
            <StatCard label="Top Platform" value={result.topPlatform} icon={Film} />
          )}
          <StatCard
            label="Clips Found"
            value={typeof result?.total === 'number' ? result.total : clips.length}
            icon={Wand2}
          />
        </div>
      )}

      {result?.narrativeStructure && !noTranscript && (
        <Panel variant="subtle" className="mb-6 flex items-center gap-3">
          <Sparkles className="w-4 h-4 text-primary shrink-0" aria-hidden />
          <p className="text-sm text-theme-secondary">
            <span className="font-semibold text-theme-primary">Narrative structure: </span>
            {result.narrativeStructure}
          </p>
        </Panel>
      )}

      {/* ── No transcript / empty result ── */}
      {noTranscript && (
        <EmptyState
          icon={Search}
          title="No clips yet"
          description={result?.message || 'This video has no transcript to analyze for clips.'}
          className="ds-surface-card"
        />
      )}

      {/* ── Ranked gallery ── */}
      {!noTranscript && clips.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6">
          {clips.map((clip) => {
            const tone = scoreTone(clip.viralityScore)
            const score = typeof clip.viralityScore === 'number' ? Math.round(clip.viralityScore) : null
            const duration = typeof clip.durationSec === 'number'
              ? clip.durationSec
              : (typeof clip.endTime === 'number' && typeof clip.startTime === 'number'
                  ? clip.endTime - clip.startTime
                  : undefined)
            return (
              <Panel key={clip.id} variant="bento" className="flex h-full flex-col">
                {/* Top row: rank + virality score */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {typeof clip.rank === 'number' && (
                      <span className="ds-text-caption font-semibold text-primary">#{clip.rank}</span>
                    )}
                    {clip.triggerType && (
                      <Badge variant="secondary">{clip.triggerType}</Badge>
                    )}
                  </div>
                  {score !== null && (
                    <span className={`flex flex-col items-center justify-center rounded-xl px-3 py-1.5 ${tone.ring}`}>
                      <span className={`text-2xl font-bold leading-none ${tone.direction === 'up' ? 'text-emerald-500' : score >= 40 ? 'text-amber-500' : 'text-theme-secondary'}`}>
                        {score}
                      </span>
                      <span className="ds-text-caption text-theme-muted mt-0.5">virality</span>
                    </span>
                  )}
                </div>

                {/* Hook */}
                {clip.hook && (
                  <h3 className="ds-text-h3 text-theme-primary leading-tight">{clip.hook}</h3>
                )}

                {/* Reason */}
                {clip.reason && (
                  <p className="mt-2 text-sm text-theme-muted leading-relaxed">{clip.reason}</p>
                )}

                {/* Time window */}
                <div className="mt-auto pt-4 flex items-center gap-2 text-theme-secondary">
                  <Clock className="w-4 h-4 text-theme-muted shrink-0" aria-hidden />
                  <span className="ds-text-caption font-medium">
                    {fmtTime(clip.startTime)}–{fmtTime(clip.endTime)}
                  </span>
                  {typeof duration === 'number' && (
                    <Badge variant="secondary">{Math.round(duration)}s</Badge>
                  )}
                </div>
              </Panel>
            )
          })}
        </div>
      )}

      {/* ── First-run idle state ── */}
      {!hasResult && !generating && (
        <EmptyState
          icon={Sparkles}
          title="Pick a video to start"
          description="Choose a finished video above and we'll surface its highest-potential clips, ranked by virality."
          className="ds-surface-card"
        />
      )}
    </div>
  )
}
