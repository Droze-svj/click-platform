'use client'

/**
 * Channel Audit — a scorecard for the creator's connected YouTube channel. On load (and via Refresh) it pulls GET /api/seo/channel-audit and
 * renders the live score, grade, sub-scores, issues and strengths.
 *
 * Renders ONLY what the backend returns. When the channel isn't connected the
 * page shows an EmptyState pointing at /dashboard/social — it never fabricates
 * a score. Every backend field is optional-chained so a partial payload can't
 * throw.
 */

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Gauge, RefreshCw, Youtube, Users, AlertTriangle, CheckCircle2,
} from 'lucide-react'
import { useToast } from '../../../../contexts/ToastContext'
import ToastContainer from '../../../../components/ToastContainer'
import { apiGet } from '../../../../lib/api'
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

// ── Issue severity taxonomy returned by the audit. ──
type IssueSeverity = 'high' | 'medium' | 'low'

// One actionable issue surfaced by the scorecard.
interface YouTubeAccount {
  accountId: string
  platformUsername?: string | null
  isPrimary?: boolean
  isActive?: boolean
}

interface AuditIssue {
  area: string
  severity: IssueSeverity
  message: string
}

// The five weighted sub-scores (each 0–100). Mirrors the service payload.
interface AuditSubscores {
  engagement: number
  retention: number
  cadence: number
  growth: number
  metadata: number
}

// Shape of `res.data` from GET /api/seo/channel-audit.
// When the channel is connected `available` is true and the scorecard fields
// are present; otherwise `available` is false and `reason` explains why.
interface ChannelAudit {
  available: boolean
  reason?: string
  period?: string
  score?: number
  grade?: string
  subscriberCount?: number
  subscores?: AuditSubscores
  issues?: AuditIssue[]
  strengths?: string[]
}

// Standard envelope used by apiGet — payload lives under `data`.
interface ApiEnvelope<T> {
  data?: T
}

// Day-window options for the audit lookback.
const DAY_OPTIONS = [7, 28, 90] as const
type DayOption = (typeof DAY_OPTIONS)[number]

type TFn = (key: string, params?: Record<string, string | number>) => string

// The five sub-scores rendered as labeled progress bars, in display order.
const SUBSCORE_FIELDS: ReadonlyArray<keyof AuditSubscores> = [
  'engagement',
  'retention',
  'cadence',
  'growth',
  'metadata',
]

/** Human label for a sub-score / issue area. Unknown areas fall back to "General". */
function areaLabel(area: string | undefined, t: TFn): string {
  switch (area) {
    case 'engagement': return t('growthChannelPage.subscoreEngagement')
    case 'retention': return t('growthChannelPage.subscoreRetention')
    case 'cadence': return t('growthChannelPage.subscoreCadence')
    case 'growth': return t('growthChannelPage.subscoreGrowth')
    case 'metadata': return t('growthChannelPage.subscoreMetadata')
    default: return t('growthChannelPage.areaGeneral')
  }
}

/** Human label for an issue severity. */
function severityLabel(severity: IssueSeverity, t: TFn): string {
  if (severity === 'high') return t('growthChannelPage.severityHigh')
  if (severity === 'medium') return t('growthChannelPage.severityMedium')
  return t('growthChannelPage.severityLow')
}

/**
 * Plain sentence for the backend's "not available" reason code. Raw codes
 * (e.g. google_not_connected) are never shown to the user.
 */
function reasonMessage(reason: string | undefined, t: TFn): string {
  switch (reason) {
    case 'google_not_connected':
    case 'not_connected':
    case 'no_channel_connected':
      return t('growthChannelPage.reasonNotConnected')
    case 'no_channel':
      return t('growthChannelPage.reasonNoChannel')
    case 'channel_error':
      return t('growthChannelPage.reasonChannelError')
    default:
      return t('growthChannelPage.reasonDefault')
  }
}

/** Tailwind text colour for the headline grade: A/B green, C amber, D/F red. */
function gradeColor(grade: string | undefined): string {
  const letter = (grade ?? '').trim().charAt(0).toUpperCase()
  if (letter === 'A' || letter === 'B') return 'text-emerald-500'
  if (letter === 'C') return 'text-amber-500'
  if (letter === 'D' || letter === 'F') return 'text-red-500'
  return 'text-theme-primary'
}

/** Bar fill colour mirrors the same red/amber/green thresholds by value. */
function barColor(value: number): string {
  if (value >= 75) return 'bg-emerald-500'
  if (value >= 50) return 'bg-amber-500'
  return 'bg-red-500'
}

/** Map an issue severity to a Badge variant. */
function severityVariant(severity: IssueSeverity): 'destructive' | 'secondary' | 'outline' {
  if (severity === 'high') return 'destructive'
  if (severity === 'medium') return 'secondary'
  return 'outline'
}

/** Clamp any backend number into the 0–100 progress-bar range. */
function clampScore(value: number | null | undefined): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return Math.max(0, Math.min(100, n))
}

export default function ChannelAuditPage() {
  const { showToast } = useToast()
  const { t } = useTranslation()

  const [days, setDays] = useState<DayOption>(28)
  const [loading, setLoading] = useState(true)
  const [audit, setAudit] = useState<ChannelAudit | null>(null)
  const [accounts, setAccounts] = useState<YouTubeAccount[]>([])
  const [accountId, setAccountId] = useState<string>('')

  // Load the user's connected YouTube channels so multi-channel creators can
  // audit each one (not just whichever is active/primary).
  useEffect(() => {
    // /oauth/accounts returns a per-platform map ({ accounts: { youtube: [...] } }),
    // so pull the youtube list out of it. (There is no /oauth/youtube/accounts route.)
    apiGet<{ accounts?: { youtube?: YouTubeAccount[] } }>('/oauth/accounts')
      .then((res) => {
        const list = Array.isArray(res?.accounts?.youtube) ? res.accounts.youtube : []
        setAccounts(list)
        const active = list.find((a) => a.isActive) || list.find((a) => a.isPrimary) || list[0]
        if (active?.accountId) setAccountId(String(active.accountId))
      })
      .catch(() => setAccounts([]))
  }, [])

  const loadAudit = useCallback(
    async (window: DayOption, acct: string) => {
      setLoading(true)
      try {
        const qs = `days=${window}${acct ? `&accountId=${encodeURIComponent(acct)}` : ''}`
        const res = await apiGet<ApiEnvelope<ChannelAudit>>(`/seo/channel-audit?${qs}`)
        setAudit(res?.data ?? null)
      } catch {
        showToast(t('growthChannelPage.loadError'), 'error')
        setAudit(null)
      } finally {
        setLoading(false)
      }
    },
    [showToast, t],
  )

  useEffect(() => {
    loadAudit(days, accountId)
  }, [days, accountId, loadAudit])

  const available = audit?.available === true
  const subscores = audit?.subscores
  const issues = audit?.issues ?? []
  const strengths = audit?.strengths ?? []

  return (
    <PageShell width="wide" className="ds-bg-mesh-soft min-h-screen overflow-x-hidden">
      <ToastContainer />

      {/* ── Header + controls ── */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeader
          as="h1"
          title={t('growthChannelPage.title')}
          description={t('growthChannelPage.description')}
        />

        <div className="flex flex-wrap items-center gap-2">
          {/* Channel picker — only when the creator has >1 connected channel. */}
          {accounts.length > 1 && (
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              aria-label={t('growthChannelPage.selectChannel')}
              className="rounded-lg ds-surface-subtle px-3 py-1.5 text-xs font-medium text-theme-primary"
            >
              {accounts.map((a) => (
                <option key={a.accountId} value={a.accountId}>
                  {a.isActive
                    ? t('growthChannelPage.channelActive', { name: a.platformUsername || a.accountId })
                    : a.platformUsername || a.accountId}
                </option>
              ))}
            </select>
          )}

          {/* Days selector */}
          <div className="inline-flex rounded-lg ds-surface-subtle p-1">
            {DAY_OPTIONS.map((opt) => {
              const active = days === opt
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setDays(opt)}
                  title={t('growthChannelPage.auditLastDays', { count: opt })}
                  aria-label={t('growthChannelPage.auditLastDays', { count: opt })}
                  aria-pressed={active}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-theme-secondary hover:text-theme-primary',
                  )}
                >
                  {t('growthChannelPage.daysShort', { count: opt })}
                </button>
              )
            })}
          </div>

          <Button
            variant="secondary"
            size="sm"
            loading={loading}
            onClick={() => loadAudit(days, accountId)}
            leftIcon={<RefreshCw className="h-4 w-4" aria-hidden />}
          >
            {t('growthChannelPage.refresh')}
          </Button>
        </div>
      </div>

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="space-y-6">
          <div className="ds-surface-card h-48 animate-pulse rounded-2xl" aria-hidden />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="ds-surface-card h-72 animate-pulse rounded-2xl" aria-hidden />
            <div className="ds-surface-card h-72 animate-pulse rounded-2xl" aria-hidden />
          </div>
        </div>
      )}

      {/* ── Not connected ── */}
      {!loading && audit && !available && (
        <EmptyState
          icon={Youtube}
          title={t('growthChannelPage.connectTitle')}
          description={reasonMessage(audit?.reason, t)}
          className="ds-surface-card"
          action={
            <Link href="/dashboard/social">
              <Button variant="primary" leftIcon={<Youtube className="h-4 w-4" aria-hidden />}>
                {t('growthChannelPage.connectChannel')}
              </Button>
            </Link>
          }
        />
      )}

      {/* ── Scorecard ── */}
      {!loading && available && (
        <div className="space-y-6">
          {/* Headline score + grade + subscribers */}
          <Panel variant="bento">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-6xl font-bold leading-none text-theme-primary tabular-nums">
                    {typeof audit?.score === 'number' ? Math.round(audit.score) : '—'}
                  </span>
                  <span className="text-2xl font-medium text-theme-muted">{t('growthChannelPage.outOf100')}</span>
                </div>

                <div className="flex flex-col">
                  <span className="ds-text-caption text-theme-muted">{t('growthChannelPage.grade')}</span>
                  <span
                    className={cn('text-5xl font-bold leading-none', gradeColor(audit?.grade))}
                  >
                    {audit?.grade ?? '—'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-primary">
                  <Users className="h-6 w-6" aria-hidden />
                </span>
                <div>
                  <p className="ds-text-caption text-theme-muted">{t('growthChannelPage.subscribers')}</p>
                  <p className="text-2xl font-semibold text-theme-primary tabular-nums">
                    {typeof audit?.subscriberCount === 'number'
                      ? audit.subscriberCount.toLocaleString()
                      : '—'}
                  </p>
                </div>
              </div>
            </div>

            {audit?.period && (
              <p className="mt-4 ds-text-caption text-theme-muted">
                {t('growthChannelPage.auditWindow', { period: audit.period })}
              </p>
            )}
          </Panel>

          {/* Sub-scores as labeled progress bars */}
          <Panel variant="bento" className="space-y-5">
            <SectionHeader
              as="h2"
              title={t('growthChannelPage.subscoresTitle')}
              description={t('growthChannelPage.subscoresDescription')}
            />
            <div className="space-y-4">
              {SUBSCORE_FIELDS.map((key) => {
                const label = areaLabel(key, t)
                const value = clampScore(subscores?.[key])
                return (
                  <div key={key}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-sm font-medium text-theme-secondary">{label}</span>
                      <span className="text-sm font-semibold text-theme-primary tabular-nums">
                        {value}
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full ds-surface-subtle">
                      <div
                        className={cn('h-full rounded-full transition-all', barColor(value))}
                        style={{ width: `${value}%` }}
                        role="progressbar"
                        aria-valuenow={value}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={t('growthChannelPage.subscoreAria', { label })}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </Panel>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Issues & fixes */}
            <Panel variant="bento" className="space-y-4">
              <SectionHeader
                as="h2"
                title={t('growthChannelPage.issuesTitle')}
                description={t('growthChannelPage.issuesDescription')}
              />
              {issues.length > 0 ? (
                <ul className="space-y-3">
                  {issues.map((issue, i) => (
                    <li
                      key={`${issue?.area ?? 'issue'}-${i}`}
                      className="ds-surface-subtle flex items-start gap-3 rounded-xl p-4"
                    >
                      <AlertTriangle
                        className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-theme-primary">
                            {areaLabel(issue?.area, t)}
                          </span>
                          {issue?.severity && (
                            <Badge variant={severityVariant(issue.severity)}>
                              {severityLabel(issue.severity, t)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-theme-muted">{issue?.message}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-theme-muted">
                  {t('growthChannelPage.noIssues')}
                </p>
              )}
            </Panel>

            {/* Strengths */}
            <Panel variant="bento" className="space-y-4">
              <SectionHeader
                as="h2"
                title={t('growthChannelPage.strengthsTitle')}
                description={t('growthChannelPage.strengthsDescription')}
              />
              {strengths.length > 0 ? (
                <ul className="space-y-3">
                  {strengths.map((strength, i) => (
                    <li
                      key={`strength-${i}`}
                      className="ds-surface-subtle flex items-start gap-3 rounded-xl p-4"
                    >
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
                        aria-hidden
                      />
                      <p className="text-sm text-theme-primary">{strength}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-theme-muted">
                  {t('growthChannelPage.noStrengths')}
                </p>
              )}
            </Panel>
          </div>
        </div>
      )}

      {/* ── Error / no-data fallback ── */}
      {!loading && !audit && (
        <EmptyState
          icon={Gauge}
          title={t('growthChannelPage.noAuditTitle')}
          description={t('growthChannelPage.noAuditDescription')}
          className="ds-surface-card"
          action={
            <Button
              variant="secondary"
              onClick={() => loadAudit(days, accountId)}
              leftIcon={<RefreshCw className="h-4 w-4" aria-hidden />}
            >
              {t('growthChannelPage.tryAgain')}
            </Button>
          }
        />
      )}
    </PageShell>
  )
}
