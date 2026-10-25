'use client'

import { useEffect, useState } from 'react'
import { handleApiError } from '@/lib/api'
import {
  getMorningBrief, getBriefSubscription, setBriefSubscription,
  type MorningBrief, type BriefSubscriptionState,
} from '@/lib/featuresApi'

const fmtNum = (n: number) => n.toLocaleString('en-US')
const fmtMoney = (n: number, currency: string) => {
  try { return n.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }) } catch { return `${fmtNum(n)} ${currency}` }
}
const fmtHour = (h: number) => `${String(h).padStart(2, '0')}:00`

function Change({ pct }: { pct: number | null }) {
  if (pct == null) return null
  return (
    <span className={pct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
      {' '}({pct >= 0 ? '+' : ''}{pct}%)
    </span>
  )
}

const browserTimeZone = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || '' } catch { return '' }
}

/**
 * Morning Brief: what to make next, how the week's posts and sales are doing,
 * what the audience keeps asking, and what is waiting on you. Built from real
 * data only — an empty section says so.
 */
export default function MorningBriefPanel() {
  const [brief, setBrief] = useState<MorningBrief | null>(null)
  const [sub, setSub] = useState<BriefSubscriptionState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    getMorningBrief()
      .then((b) => { if (alive) setBrief(b) })
      .catch((e) => { if (alive) setError(handleApiError(e) || 'Could not load your brief') })
    getBriefSubscription()
      .then((s) => { if (alive) setSub(s) })
      .catch(() => { /* delivery toggle is optional */ })
    return () => { alive = false }
  }, [])

  async function toggleDelivery() {
    const on = !sub?.subscription?.enabled
    setSaving(true); setError(null)
    try {
      // Keep a timezone the user picked in Settings; only default to the browser's.
      setSub(await setBriefSubscription({
        enabled: on, timezone: sub?.subscription?.timezone || browserTimeZone(), hour: sub?.subscription?.hour ?? 7,
      }))
    } catch (e) {
      setError(handleApiError(e) || 'Could not update delivery')
    } finally {
      setSaving(false)
    }
  }

  const subscribed = !!sub?.subscription?.enabled
  const tz = sub?.subscription?.timezone || browserTimeZone()
  const hour = sub?.subscription?.hour ?? 7
  const ch = sub?.subscription?.channels
  const channelLabel = ch?.email && ch?.inApp ? 'in-app and by email' : ch?.email ? 'by email' : 'as a notification'

  return (
    <div id="brief" data-testid="brief-panel" className="rounded-xl bg-surface-card border border-default p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-theme-primary">Morning brief</h2>
          <p className="text-xs text-theme-muted">What to make next, and what needs you today.</p>
        </div>
        {sub && (
          <button
            type="button" data-testid="brief-delivery" onClick={toggleDelivery} disabled={saving}
            className="rounded-lg border border-strong px-2 py-1 text-xs text-theme-secondary disabled:opacity-50"
          >
            {subscribed ? `Daily at ${fmtHour(hour)} ✓` : `Send daily at ${fmtHour(hour)}`}
          </button>
        )}
      </div>
      <a
        data-testid="brief-settings-link" href="/dashboard/settings?tab=notifications"
        className="inline-block text-xs text-theme-secondary underline hover:text-theme-primary"
      >
        Change time, time zone or email delivery
      </a>
      {subscribed && (
        <p data-testid="brief-delivery-note" className="text-xs text-theme-muted">
          {sub?.deliveryActive
            ? `Arrives ${channelLabel} around ${fmtHour(hour)} ${tz} time.`
            : 'Saved. Daily delivery is not switched on for this server yet, so check here each morning.'}
        </p>
      )}

      {error && <p data-testid="brief-error" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {!brief && !error && <p data-testid="brief-loading" className="text-xs text-theme-muted">Loading your brief…</p>}

      {brief && (
        <>
          <div data-testid="brief-make-next" className="rounded-lg border border-green-500/30 bg-green-500/5 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-green-600 dark:text-green-400">Make next</p>
            <p className="mt-1 text-sm text-theme-primary">{brief.makeNext.title}</p>
            <p className="mt-1 text-xs text-theme-secondary">{brief.makeNext.why}</p>
            <a href="#create" className="mt-2 inline-block text-xs text-green-600 dark:text-green-400 hover:text-green-300">Write the script →</a>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div data-testid="brief-performance" className="rounded-lg bg-background border border-default p-3 text-sm text-theme-primary">
              <p className="text-xs text-theme-muted">{brief.performance?.window || 'Posts published in the last 7 days'}</p>
              {brief.performance ? (
                <>
                  <p>{fmtNum(brief.performance.views)} views<Change pct={brief.performance.viewsChangePct} /></p>
                  <p>{fmtNum(brief.performance.engagement)} engagements<Change pct={brief.performance.engagementChangePct} /></p>
                </>
              ) : <p className="text-theme-muted">No analytics yet for this week&apos;s posts.</p>}
            </div>
            <div data-testid="brief-sales" className="rounded-lg bg-background border border-default p-3 text-sm text-theme-primary">
              <p className="text-xs text-theme-muted">Tracked sales</p>
              {brief.sales ? (
                <>
                  <p>
                    {brief.sales.last24h.count} in 24h · {fmtMoney(brief.sales.last24h.revenue, brief.sales.currency)}
                    <Change pct={brief.sales.revenueChangePct} />
                  </p>
                  <p className="text-theme-secondary">{brief.sales.last7d.count} this week · {fmtMoney(brief.sales.last7d.revenue, brief.sales.currency)}</p>
                </>
              ) : <p className="text-theme-muted">No tracked sales this week.</p>}
            </div>
          </div>

          <div data-testid="brief-audience" className="space-y-1">
            <p className="text-xs text-theme-muted">
              Audience · {brief.audience.questions} question{brief.audience.questions === 1 ? '' : 's'} in {brief.audience.scanned} comments and DMs this week
            </p>
            {brief.audience.themes.length > 0 ? (
              <ul className="space-y-1">
                {brief.audience.themes.map((t) => (
                  <li key={t.theme} data-testid="brief-theme" className="text-xs text-theme-secondary">
                    <span className="text-theme-muted">{t.count}×</span> “{t.example}”
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-theme-muted">No repeated questions yet. Comments you run through the AI Responder show up here.</p>
            )}
          </div>

          {brief.needsYou.length > 0 && (
            <div data-testid="brief-needs-you" className="space-y-1">
              <p className="text-xs text-theme-muted">Needs you</p>
              <ul className="space-y-1">
                {brief.needsYou.map((n) => (
                  <li key={n.id}>
                    <a href={n.link} className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-300">{n.label} →</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
