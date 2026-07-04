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
  sent: 'text-blue-400',
  approved: 'text-green-400',
  rejected: 'text-zinc-500',
  failed: 'text-red-400',
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
        <h2 className="text-sm font-semibold text-white">Reply history</h2>
        <select
          data-testid="history-filter"
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded bg-zinc-950 border border-zinc-800 p-1 text-xs text-zinc-300"
        >
          {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>

      {error && <p data-testid="history-error" className="text-sm text-red-400">{error}</p>}
      {loading && <p data-testid="history-loading" className="text-sm text-zinc-400">Loading…</p>}

      {!loading && replies.length === 0 && (
        <p data-testid="history-empty" className="text-sm text-zinc-500">No replies yet.</p>
      )}

      {!loading && replies.map((r) => (
        <div key={r._id} data-testid="history-item" className="rounded-lg bg-zinc-900/60 border border-zinc-800 p-3 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span className="uppercase">{r.platform}{r.author ? ` · @${r.author}` : ''}</span>
            <span data-testid="history-status" className={`uppercase ${STATUS_TONE[r.status] ?? 'text-zinc-400'}`}>{r.status}</span>
          </div>
          <p className="text-sm text-zinc-400">“{r.inboundText}”</p>
          <p className="text-sm text-zinc-200">↳ {finalText(r)}</p>
        </div>
      ))}
    </div>
  )
}
