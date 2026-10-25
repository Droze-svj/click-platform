'use client'

import { useCallback, useEffect, useState } from 'react'
import { getResponderHistory, type SocialReply } from '@/lib/featuresApi'

// Resolved-reply statuses the history can filter by ('' = all).
const FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'sent', label: 'Sent' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'failed', label: 'Failed' },
]

const STATUS_TONE: Record<string, string> = {
  sent: 'text-blue-600 dark:text-blue-400',
  approved: 'text-green-600 dark:text-green-400',
  rejected: 'text-theme-muted',
  failed: 'text-red-600 dark:text-red-400',
}

const finalText = (r: SocialReply) => (r.editedReply?.trim() ? r.editedReply : r.draftReply)

/**
 * Read-only log of resolved responder replies (approved/sent/rejected/failed),
 * so approved/sent items are no longer invisible after leaving the approval inbox.
 */
export default function ResponderHistory() {
  const [replies, setReplies] = useState<SocialReply[]>([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (s: string) => {
    setLoading(true); setError(null)
    try {
      const res = await getResponderHistory(s || undefined)
      setReplies(res.replies || [])
    } catch (e) {
      setError((e as Error)?.message || 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(status) }, [load, status])

  return (
    <div className="space-y-3" data-testid="responder-history">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-theme-primary">Reply history</h2>
        <select
          data-testid="history-filter"
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded bg-background border border-default p-1 text-xs text-theme-secondary"
        >
          {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>

      {error && <p data-testid="history-error" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {loading && <p data-testid="history-loading" className="text-sm text-theme-secondary">Loading…</p>}

      {!loading && replies.length === 0 && (
        <p data-testid="history-empty" className="text-sm text-theme-muted">No replies yet.</p>
      )}

      {!loading && replies.map((r) => (
        <div key={r._id} data-testid="history-item" className="rounded-lg bg-surface-card border border-default p-3 space-y-1">
          <div className="flex items-center justify-between text-xs text-theme-muted">
            <span className="uppercase">{r.platform}{r.author ? ` · @${r.author}` : ''}</span>
            <span data-testid="history-status" className={`uppercase ${STATUS_TONE[r.status] ?? 'text-theme-secondary'}`}>{r.status}</span>
          </div>
          <p className="text-sm text-theme-secondary">“{r.inboundText}”</p>
          <p className="text-sm text-theme-primary">↳ {finalText(r)}</p>
        </div>
      ))}
    </div>
  )
}
