'use client'

import { useState } from 'react'
import { autofillCalendar, approveCalendarPlan, type Platform } from '@/lib/featuresApi'

const PLATFORMS: Platform[] = ['tiktok', 'instagram', 'youtube', 'twitter', 'linkedin', 'facebook']

interface Draft {
  platform: string
  content?: { text?: string }
  scheduledTime?: string
}
interface AutofillResult { planId: string; count: number; posts: Draft[] }

/**
 * Calendar Autofill panel: pick a platform + count (+ optional topic), generate
 * a week of AI drafts at optimal times, review them, then approve the whole plan
 * (→ scheduled) in one click.
 */
export default function CalendarAutofillPanel() {
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
      setError((e as Error)?.message || 'Failed to generate drafts')
    } finally {
      setLoading(false)
    }
  }

  async function approve() {
    if (!result) return
    setApproving(true); setError(null)
    try {
      await approveCalendarPlan(result.planId)
      setApproved(true)
    } catch (e) {
      setError((e as Error)?.message || 'Failed to approve')
    } finally {
      setApproving(false)
    }
  }

  return (
    <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-4 space-y-3">
      <h2 className="text-sm font-semibold text-white">Fill my calendar</h2>

      <div className="flex flex-wrap gap-2 items-end">
        <label className="text-xs text-zinc-400">
          Platform
          <select
            data-testid="autofill-platform"
            value={platform}
            onChange={(e) => setPlatform(e.target.value as Platform)}
            className="block mt-1 rounded bg-zinc-950 border border-zinc-800 p-1 text-sm text-zinc-200"
          >
            {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="text-xs text-zinc-400">
          Posts
          <input
            data-testid="autofill-count"
            type="number" min={1} max={30} value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="block mt-1 w-16 rounded bg-zinc-950 border border-zinc-800 p-1 text-sm text-zinc-200"
          />
        </label>
        <label className="text-xs text-zinc-400 flex-1 min-w-[8rem]">
          Topic (optional)
          <input
            data-testid="autofill-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. beginner mistakes"
            className="block mt-1 w-full rounded bg-zinc-950 border border-zinc-800 p-1 text-sm text-zinc-200"
          />
        </label>
        <label className="text-xs text-zinc-400 flex items-center gap-1">
          <input
            data-testid="autofill-optimal"
            type="checkbox" checked={optimalTimes}
            onChange={(e) => setOptimalTimes(e.target.checked)}
          />
          Optimal times
        </label>
      </div>

      <button
        data-testid="autofill-generate"
        onClick={generate}
        disabled={loading}
        className="rounded-lg bg-green-500/90 px-3 py-1.5 text-sm font-medium text-black disabled:opacity-50"
      >
        {loading ? 'Generating…' : 'Generate drafts'}
      </button>

      {error && <p data-testid="autofill-error" className="text-sm text-red-400">{error}</p>}

      {result && (
        <div className="space-y-2" data-testid="autofill-result">
          <p className="text-xs text-zinc-500">{result.count} draft{result.count === 1 ? '' : 's'} created</p>
          <ul className="space-y-1">
            {result.posts.map((d, i) => (
              <li key={i} data-testid="autofill-draft" className="text-sm text-zinc-300 truncate">
                <span className="text-zinc-500">{d.platform}</span> · {d.content?.text || '(empty)'}
              </li>
            ))}
          </ul>
          {approved
            ? <p data-testid="autofill-approved" className="text-sm text-green-400">Approved — scheduled at your best times. ✓</p>
            : (
              <button
                data-testid="autofill-approve"
                onClick={approve}
                disabled={approving}
                className="rounded-lg bg-blue-500/90 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
              >
                {approving ? 'Approving…' : 'Approve all'}
              </button>
            )}
        </div>
      )}
    </div>
  )
}
