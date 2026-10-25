'use client'

import { useState } from 'react'
import { autofillCalendar, approveCalendarPlan, type Platform } from '@/lib/featuresApi'
import { useTranslation } from '@/hooks/useTranslation'
import { platformLabel } from './platformLabel'

const PLATFORMS: Platform[] = ['tiktok', 'instagram', 'youtube', 'twitter', 'linkedin', 'facebook']

interface Draft {
  platform: string
  content?: { text?: string }
  scheduledTime?: string
}
interface AutofillResult { planId: string | null; count: number; posts: Draft[]; degraded?: boolean }

/**
 * Calendar Autofill panel: pick a platform + count (+ optional topic), generate
 * a week of AI drafts at optimal times, review them, then approve the whole plan
 * (→ scheduled) in one click.
 */
export default function CalendarAutofillPanel() {
  const { t } = useTranslation()
  const [platform, setPlatform] = useState<Platform>('tiktok')
  const [count, setCount] = useState(7)
  const [topic, setTopic] = useState('')
  const [optimalTimes, setOptimalTimes] = useState(true)
  const [result, setResult] = useState<AutofillResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [approving, setApproving] = useState(false)
  const [approved, setApproved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setLoading(true); setError(null); setApproved(false); setResult(null)
    try {
      const res = await autofillCalendar({
        count, platforms: [platform], topic: topic || undefined, optimalTimes,
      })
      setResult(res as AutofillResult)
    } catch (e) {
      setError((e as Error)?.message || t('creatorTools.calendarAutofill.generateFailed'))
    } finally {
      setLoading(false)
    }
  }

  async function approve() {
    if (!result?.planId) return
    setApproving(true); setError(null)
    try {
      await approveCalendarPlan(result.planId)
      setApproved(true)
    } catch (e) {
      setError((e as Error)?.message || t('creatorTools.calendarAutofill.approveFailed'))
    } finally {
      setApproving(false)
    }
  }

  return (
    <div className="rounded-xl bg-surface-card border border-default p-4 space-y-3">
      <h2 className="text-sm font-semibold text-theme-primary">{t('creatorTools.calendarAutofill.title')}</h2>

      <div className="flex flex-wrap gap-2 items-end">
        <label className="text-xs text-theme-secondary">
          {t('creatorTools.common.platform')}
          <select
            data-testid="autofill-platform"
            value={platform}
            onChange={(e) => setPlatform(e.target.value as Platform)}
            className="block mt-1 rounded bg-background border border-default p-1 text-sm text-theme-primary"
          >
            {PLATFORMS.map((p) => <option key={p} value={p}>{platformLabel(t, p)}</option>)}
          </select>
        </label>
        <label className="text-xs text-theme-secondary">
          {t('creatorTools.calendarAutofill.posts')}
          <input
            data-testid="autofill-count"
            type="number" min={1} max={30} value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="block mt-1 w-16 rounded bg-background border border-default p-1 text-sm text-theme-primary"
          />
        </label>
        <label className="text-xs text-theme-secondary flex-1 min-w-[8rem]">
          {t('creatorTools.calendarAutofill.topicOptional')}
          <input
            data-testid="autofill-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={t('creatorTools.calendarAutofill.topicPlaceholder')}
            className="block mt-1 w-full rounded bg-background border border-default p-1 text-sm text-theme-primary"
          />
        </label>
        <label className="text-xs text-theme-secondary flex items-center gap-1">
          <input
            data-testid="autofill-optimal"
            type="checkbox" checked={optimalTimes}
            onChange={(e) => setOptimalTimes(e.target.checked)}
          />
          {t('creatorTools.calendarAutofill.optimalTimes')}
        </label>
      </div>

      <button
        data-testid="autofill-generate"
        onClick={generate}
        disabled={loading}
        className="rounded-lg bg-primary hover:bg-primary/90 px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {loading ? t('creatorTools.common.generating') : t('creatorTools.calendarAutofill.generate')}
      </button>

      {error && <p data-testid="autofill-error" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {result && (result.degraded || !result.planId || result.count === 0) && (
        // The server creates no plan when the AI produced no ideas — there is
        // nothing to list or approve, so say so instead of "0 drafts created".
        <p data-testid="autofill-unavailable" className="text-sm text-amber-600 dark:text-amber-400">
          {t('creatorTools.calendarAutofill.unavailable')}
        </p>
      )}

      {result && !result.degraded && result.planId && result.count > 0 && (
        <div className="space-y-2" data-testid="autofill-result">
          <p className="text-xs text-theme-muted">{result.count === 1
            ? t('creatorTools.calendarAutofill.draftsCreatedOne', { count: result.count })
            : t('creatorTools.calendarAutofill.draftsCreatedOther', { count: result.count })}</p>
          <ul className="space-y-1">
            {result.posts.map((d, i) => (
              <li key={i} data-testid="autofill-draft" className="text-sm text-theme-secondary truncate">
                <span className="text-theme-muted">{d.platform}</span> · {d.content?.text || t('creatorTools.calendarAutofill.empty')}
              </li>
            ))}
          </ul>
          {approved
            ? <p data-testid="autofill-approved" className="text-sm text-green-600 dark:text-green-400">{t('creatorTools.calendarAutofill.approved')}</p>
            : (
              <button
                data-testid="autofill-approve"
                onClick={approve}
                disabled={approving}
                className="rounded-lg bg-blue-500/90 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
              >
                {approving ? t('creatorTools.calendarAutofill.approving') : t('creatorTools.calendarAutofill.approveAll')}
              </button>
            )}
        </div>
      )}
    </div>
  )
}
