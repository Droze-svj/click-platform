'use client'

/**
 * SEO Scorecard — the flagship Growth tool.
 *
 * Score a piece of content (by contentId or raw title/description/tags) for a
 * target keyword on a given platform, surface the issues + quick wins with
 * concrete fixes, then optionally AI-rewrite the metadata and apply the
 * (editable) suggestion straight back to the content — a closed loop.
 *
 * Renders ONLY live data from the /api/seo/* endpoints; every backend field is
 * optional-chained so a partial payload never throws.
 */

import React, { useState } from 'react'
import {
  Search, Sparkles, Wand2, CheckCircle2, AlertTriangle, Zap, Upload,
} from 'lucide-react'
import { useToast } from '../../../../contexts/ToastContext'
import ToastContainer from '../../../../components/ToastContainer'
import { apiPost } from '../../../../lib/api'
import { extractApiError } from '../../../../utils/apiResponse'
import {
  Panel,
  Button,
  Badge,
  StatCard,
  EmptyState,
  SectionHeader,
  Input,
  Textarea,
} from '../../../../components/ui'

// ── Domain taxonomy mirrored from the backend. ──
type Platform = 'youtube' | 'tiktok' | 'instagram' | 'shorts' | 'x'
type Severity = 'critical' | 'high' | 'medium' | 'low'
type RewriteSource = 'ai' | 'template'
type SubscoreField = 'title' | 'description' | 'tags' | 'thumbnail' | 'keyword'

// One issue / quick win row. `keyword` subscore can be null upstream, but issues
// always carry a concrete field + fix.
interface Issue {
  field: string
  severity: Severity
  message: string
  fix: string
}

// Shape of `res.data` from POST /api/seo/scorecard.
interface Scorecard {
  score: number
  grade: string
  platform: Platform
  targetKeyword: string
  subscores: {
    title: number
    description: number
    tags: number
    thumbnail: number
    keyword: number | null
  }
  issues: Issue[]
  strengths: string[]
  quickWins: Issue[]
  contentId: string | null
}

// The AI-suggested metadata bundle.
interface RewriteSuggestion {
  title: string
  description: string
  tags: string[]
  source: RewriteSource
}

// Shape of `res.data` from POST /api/seo/rewrite.
interface Rewrite {
  suggestion: RewriteSuggestion
  scoreBefore: number
  scoreAfter: number
  improvement: number
  contentId: string | null
}

// Standard envelope used by apiPost — payload lives under `data`.
interface ApiEnvelope<T> {
  data?: T
}

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'shorts', label: 'YouTube Shorts' },
  { value: 'x', label: 'X' },
]

const SUBSCORE_FIELDS: { key: SubscoreField; label: string }[] = [
  { key: 'title', label: 'Title' },
  { key: 'description', label: 'Description' },
  { key: 'tags', label: 'Tags' },
  { key: 'thumbnail', label: 'Thumbnail' },
  { key: 'keyword', label: 'Keyword' },
]

// Severity → Badge styling. Critical/high read as destructive; medium amber;
// low muted.
const SEVERITY_BADGE: Record<Severity, string> = {
  critical: 'border-transparent bg-rose-500 text-white',
  high: 'border-transparent bg-orange-500 text-white',
  medium: 'border-transparent bg-amber-500 text-white',
  low: 'border-transparent bg-slate-400 text-white',
}

/** Color the big grade by letter: A/B green, C amber, D/F red. */
function gradeColor(grade: string | null | undefined): string {
  const g = String(grade ?? '').trim().toUpperCase().charAt(0)
  if (g === 'A' || g === 'B') return 'text-emerald-500'
  if (g === 'C') return 'text-amber-500'
  if (g === 'D' || g === 'F') return 'text-rose-500'
  return 'text-theme-muted'
}

/** Bar fill color mirrors the grade thresholds for a 0–100 subscore. */
function barColor(value: number): string {
  if (value >= 80) return 'bg-emerald-500'
  if (value >= 60) return 'bg-amber-500'
  return 'bg-rose-500'
}

/** Clamp an unknown score to a safe 0–100 integer for width math. */
function clampScore(value: number | null | undefined): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

/** Split the comma-separated tag input into a clean string[]. */
function parseTags(raw: string): string[] {
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
}

/** Pretty before→after with signed improvement, e.g. "72 → 89 (+17)". */
function improvementLabel(before: number, after: number, improvement: number): string {
  const sign = improvement > 0 ? '+' : ''
  return `${clampScore(before)} → ${clampScore(after)} (${sign}${improvement})`
}

export default function SeoScorecardPage() {
  const toast = useToast()

  // ── Inputs ──
  const [contentId, setContentId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [targetKeyword, setTargetKeyword] = useState('')
  const [platform, setPlatform] = useState<Platform>('youtube')

  // ── Results ──
  const [analyzing, setAnalyzing] = useState(false)
  const [scorecard, setScorecard] = useState<Scorecard | null>(null)

  const [rewriting, setRewriting] = useState(false)
  const [rewrite, setRewrite] = useState<Rewrite | null>(null)

  // Editable preview of the AI suggestion (seeded from the rewrite payload).
  const [draftTitle, setDraftTitle] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const [draftTags, setDraftTags] = useState('')

  const [applying, setApplying] = useState(false)

  // The contentId the scorecard/rewrite was actually keyed to (server may echo
  // a resolved id even when the input box is empty). Apply is gated on this.
  const resolvedContentId =
    scorecard?.contentId ?? rewrite?.contentId ?? (contentId.trim() || null)

  /** Build the shared request body for scorecard + rewrite. */
  function buildBody() {
    const trimmedId = contentId.trim()
    const body: {
      contentId?: string
      title?: string
      description?: string
      tags?: string[]
      targetKeyword: string
      platform: Platform
    } = {
      targetKeyword: targetKeyword.trim(),
      platform,
    }
    if (trimmedId) body.contentId = trimmedId
    if (title.trim()) body.title = title.trim()
    if (description.trim()) body.description = description.trim()
    const parsed = parseTags(tags)
    if (parsed.length) body.tags = parsed
    return body
  }

  async function handleAnalyze() {
    if (!targetKeyword.trim()) {
      toast.error('Add a target keyword to score against.')
      return
    }
    if (!contentId.trim() && !title.trim() && !description.trim()) {
      toast.error('Provide a contentId or some title/description to analyze.')
      return
    }
    setAnalyzing(true)
    setRewrite(null)
    try {
      const res = await apiPost<ApiEnvelope<Scorecard>>('/seo/scorecard', buildBody())
      const data = res?.data ?? null
      setScorecard(data)
      if (data) {
        toast.success(`Scored ${clampScore(data.score)}/100 (${data.grade ?? '—'}).`)
      } else {
        toast.error('No scorecard was returned. Try richer inputs.')
      }
    } catch (err) {
      toast.error(extractApiError(err).message)
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleRewrite() {
    if (!targetKeyword.trim()) {
      toast.error('Add a target keyword first.')
      return
    }
    setRewriting(true)
    try {
      const res = await apiPost<ApiEnvelope<Rewrite>>('/seo/rewrite', buildBody())
      const data = res?.data ?? null
      setRewrite(data)
      if (data?.suggestion) {
        setDraftTitle(data.suggestion.title ?? '')
        setDraftDescription(data.suggestion.description ?? '')
        setDraftTags((data.suggestion.tags ?? []).join(', '))
        toast.success('AI rewrite ready — review and apply.')
      } else {
        toast.error('No rewrite was returned. Please try again.')
      }
    } catch (err) {
      toast.error(extractApiError(err).message)
    } finally {
      setRewriting(false)
    }
  }

  async function handleApply() {
    if (!resolvedContentId) {
      toast.error('Apply needs a contentId — analyze a saved content item first.')
      return
    }
    setApplying(true)
    try {
      await apiPost<ApiEnvelope<unknown>>('/seo/apply', {
        contentId: resolvedContentId,
        title: draftTitle.trim(),
        description: draftDescription.trim(),
        tags: parseTags(draftTags),
      })
      toast.success('Applied the optimized metadata to your content.')
    } catch (err) {
      toast.error(extractApiError(err).message)
    } finally {
      setApplying(false)
    }
  }

  const subscores = scorecard?.subscores
  const issues = scorecard?.issues ?? []
  const strengths = scorecard?.strengths ?? []
  const quickWins = scorecard?.quickWins ?? []

  return (
    <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1500px] mx-auto overflow-x-hidden text-theme-primary">
      <ToastContainer />

      <SectionHeader
        as="h1"
        title="SEO Scorecard"
        description="Score your title, description, tags, and thumbnail for a target keyword on any platform — then AI-rewrite the metadata and apply it back in one click."
        className="mb-8"
      />

      {/* ── Inputs ── */}
      <Panel variant="bento" className="mb-8 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="seo-content-id" className="ds-text-label text-theme-secondary">
              Content ID <span className="text-theme-muted">(optional)</span>
            </label>
            <Input
              id="seo-content-id"
              value={contentId}
              onChange={(e) => setContentId(e.target.value)}
              placeholder="e.g. 665f2a… — required to apply changes"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="seo-target-keyword" className="ds-text-label text-theme-secondary">
              Target keyword
            </label>
            <Input
              id="seo-target-keyword"
              value={targetKeyword}
              onChange={(e) => setTargetKeyword(e.target.value)}
              placeholder="e.g. home espresso setup"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="seo-title" className="ds-text-label text-theme-secondary">
              Title
            </label>
            <Input
              id="seo-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Your content title…"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="seo-platform" className="ds-text-label text-theme-secondary">
              Platform
            </label>
            <select
              id="seo-platform"
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Platform)}
              className="w-full appearance-none rounded-lg border border-input bg-background px-3 h-10 text-sm text-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
            >
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="seo-description" className="ds-text-label text-theme-secondary">
            Description
          </label>
          <Textarea
            id="seo-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Your content description…"
            className="min-h-[100px]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="seo-tags" className="ds-text-label text-theme-secondary">
            Tags <span className="text-theme-muted">(comma-separated)</span>
          </label>
          <Input
            id="seo-tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="espresso, coffee, barista, home setup"
          />
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <Button
            variant="secondary"
            loading={rewriting}
            disabled={analyzing}
            onClick={handleRewrite}
            leftIcon={<Wand2 className="h-4 w-4" aria-hidden />}
          >
            AI Rewrite
          </Button>
          <Button
            variant="primary"
            loading={analyzing}
            disabled={rewriting}
            onClick={handleAnalyze}
            leftIcon={<Search className="h-4 w-4" aria-hidden />}
          >
            Analyze
          </Button>
        </div>
      </Panel>

      {/* ── Scorecard results ── */}
      {scorecard ? (
        <div className="space-y-8">
          {/* Score + grade + meta */}
          <Panel variant="bento" className="flex flex-col gap-6 lg:flex-row lg:items-center">
            <div className="flex items-center gap-6">
              <div className="flex h-28 w-28 shrink-0 flex-col items-center justify-center rounded-full border-4 border-border ds-surface-subtle">
                <span className="text-3xl font-bold text-theme-primary leading-none">
                  {clampScore(scorecard.score)}
                </span>
                <span className="ds-text-caption text-theme-muted mt-1">/ 100</span>
              </div>
              <div>
                <p className="ds-text-caption text-theme-muted">Grade</p>
                <p className={`text-5xl font-bold leading-none ${gradeColor(scorecard.grade)}`}>
                  {scorecard.grade ?? '—'}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{scorecard.platform ?? platform}</Badge>
                  {scorecard.targetKeyword ? (
                    <Badge variant="outline">{scorecard.targetKeyword}</Badge>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Sub-score bars */}
            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:pl-6 lg:border-l lg:border-border">
              {SUBSCORE_FIELDS.map(({ key, label }) => {
                const raw = subscores?.[key]
                const isNull = raw === null || raw === undefined
                const value = clampScore(typeof raw === 'number' ? raw : 0)
                return (
                  <div key={key}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-medium text-theme-secondary">{label}</span>
                      <span className="text-sm font-semibold text-theme-primary">
                        {isNull ? '—' : value}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full ds-surface-subtle">
                      {!isNull && (
                        <div
                          className={`h-full rounded-full ${barColor(value)}`}
                          style={{ width: `${value}%` }}
                        />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Panel>

          {/* Quick wins (highlighted at top) */}
          {quickWins.length > 0 && (
            <Panel variant="bento" className="space-y-4 border-amber-500/30">
              <SectionHeader
                as="h2"
                title="Quick wins"
                description="High-leverage fixes you can ship right now."
              />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {quickWins.map((win, i) => (
                  <div
                    key={`qw-${win?.field}-${i}`}
                    className="ds-surface-subtle rounded-xl p-4 flex gap-3"
                  >
                    <Zap className="h-5 w-5 shrink-0 text-amber-500" aria-hidden />
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-theme-primary">
                          {win?.field ?? '—'}
                        </span>
                        {win?.severity ? (
                          <Badge className={SEVERITY_BADGE[win.severity] ?? SEVERITY_BADGE.low}>
                            {win.severity}
                          </Badge>
                        ) : null}
                      </div>
                      {win?.message ? (
                        <p className="text-sm text-theme-secondary">{win.message}</p>
                      ) : null}
                      {win?.fix ? (
                        <p className="text-sm text-theme-muted">
                          <span className="font-medium text-theme-secondary">Fix: </span>
                          {win.fix}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* Issues & fixes + strengths */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <Panel variant="bento" className="space-y-4">
              <SectionHeader
                as="h2"
                title="Issues & fixes"
                description="What's holding the score back, and how to fix it."
              />
              {issues.length > 0 ? (
                <ul className="space-y-3">
                  {issues.map((issue, i) => (
                    <li
                      key={`issue-${issue?.field}-${i}`}
                      className="ds-surface-subtle rounded-xl p-4 flex gap-3"
                    >
                      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" aria-hidden />
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-theme-primary">
                            {issue?.field ?? '—'}
                          </span>
                          {issue?.severity ? (
                            <Badge
                              className={SEVERITY_BADGE[issue.severity] ?? SEVERITY_BADGE.low}
                            >
                              {issue.severity}
                            </Badge>
                          ) : null}
                        </div>
                        {issue?.message ? (
                          <p className="text-sm text-theme-secondary">{issue.message}</p>
                        ) : null}
                        {issue?.fix ? (
                          <p className="text-sm text-theme-muted">
                            <span className="font-medium text-theme-secondary">Fix: </span>
                            {issue.fix}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-theme-muted">No issues found — nicely optimized.</p>
              )}
            </Panel>

            <Panel variant="bento" className="space-y-4">
              <SectionHeader
                as="h2"
                title="Strengths"
                description="What's already working in your favor."
              />
              {strengths.length > 0 ? (
                <ul className="space-y-3">
                  {strengths.map((s, i) => (
                    <li key={`strength-${i}`} className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" aria-hidden />
                      <span className="text-sm text-theme-secondary">{s}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-theme-muted">No standout strengths detected yet.</p>
              )}
            </Panel>
          </div>

          {/* ── AI rewrite preview (editable) ── */}
          {rewrite?.suggestion && (
            <Panel variant="bento" className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <SectionHeader
                  as="h2"
                  title="AI rewrite"
                  description="Edit the suggestion if you like, then apply it to your content."
                />
                <div className="flex items-center gap-2">
                  <Badge variant={rewrite.suggestion.source === 'ai' ? 'default' : 'outline'}>
                    {rewrite.suggestion.source === 'ai' ? 'ai' : 'template'}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard label="Before" value={clampScore(rewrite.scoreBefore)} />
                <StatCard label="After" value={clampScore(rewrite.scoreAfter)} />
                <StatCard
                  label="Improvement"
                  value={improvementLabel(
                    rewrite.scoreBefore,
                    rewrite.scoreAfter,
                    rewrite.improvement,
                  )}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="seo-draft-title" className="ds-text-label text-theme-secondary">
                  Suggested title
                </label>
                <Input
                  id="seo-draft-title"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="Suggested title…"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="seo-draft-description"
                  className="ds-text-label text-theme-secondary"
                >
                  Suggested description
                </label>
                <Textarea
                  id="seo-draft-description"
                  value={draftDescription}
                  onChange={(e) => setDraftDescription(e.target.value)}
                  placeholder="Suggested description…"
                  className="min-h-[100px]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="seo-draft-tags" className="ds-text-label text-theme-secondary">
                  Suggested tags <span className="text-theme-muted">(comma-separated)</span>
                </label>
                <Input
                  id="seo-draft-tags"
                  value={draftTags}
                  onChange={(e) => setDraftTags(e.target.value)}
                  placeholder="tag-one, tag-two, tag-three"
                />
                {parseTags(draftTags).length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {parseTags(draftTags).map((tag, i) => (
                      <Badge key={`draft-tag-${i}`} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                {!resolvedContentId && (
                  <p className="text-sm text-theme-muted">
                    Add a Content ID above to apply changes to a saved item.
                  </p>
                )}
                <Button
                  variant="primary"
                  className="ml-auto"
                  loading={applying}
                  disabled={!resolvedContentId}
                  onClick={handleApply}
                  leftIcon={<Upload className="h-4 w-4" aria-hidden />}
                >
                  Apply to content
                </Button>
              </div>
            </Panel>
          )}
        </div>
      ) : (
        !analyzing && (
          <EmptyState
            icon={Sparkles}
            title="No scorecard yet"
            description="Fill in your content details and a target keyword, then run Analyze to see your SEO score, issues, and quick wins."
            className="ds-surface-card"
          />
        )
      )}
    </div>
  )
}
