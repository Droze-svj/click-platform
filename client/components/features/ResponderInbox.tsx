'use client'

import { useCallback, useEffect, useState } from 'react'
import { getPendingReplies, approveReply, rejectReply, type SocialReply } from '@/lib/featuresApi'

/**
 * Human-approval inbox for the AI Comment/DM Responder. Lists pending drafts,
 * lets the creator edit the reply, then approve or reject. Approved/rejected
 * items drop out of the list. (Sending stays server-side + flag-gated.)
 */
export default function ResponderInbox() {
  const [replies, setReplies] = useState<SocialReply[]>([])
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await getPendingReplies()
      setReplies(res.replies || [])
    } catch (e) {
      setError((e as Error)?.message || 'Failed to load pending replies')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const draftFor = (r: SocialReply) => (r._id in edits ? edits[r._id] : (r.editedReply ?? r.draftReply))

  async function act(id: string, fn: () => Promise<unknown>) {
    setBusy((b) => ({ ...b, [id]: true })); setError(null)
    try {
      await fn()
      setReplies((rs) => rs.filter((r) => r._id !== id))
    } catch (e) {
      setError((e as Error)?.message || 'Action failed')
    } finally {
      setBusy((b) => ({ ...b, [id]: false }))
    }
  }

  if (loading) return <p data-testid="responder-loading" className="text-sm text-zinc-400">Loading…</p>

  return (
    <div className="space-y-3" data-testid="responder-inbox">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Replies awaiting approval</h2>
        <button onClick={load} className="text-xs text-zinc-400 hover:text-white" data-testid="responder-refresh">Refresh</button>
      </div>

      {error && <p data-testid="responder-error" className="text-sm text-red-400">{error}</p>}

      {replies.length === 0 && (
        <p data-testid="responder-empty" className="text-sm text-zinc-500">Nothing to review — inbox zero. 🎉</p>
      )}

      {replies.map((r) => (
        <div key={r._id} data-testid="responder-item" className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-3 space-y-2">
          <div className="text-xs text-zinc-500">
            <span className="uppercase">{r.platform}</span>
            {r.author ? <span> · @{r.author}</span> : null}
          </div>
          <p className="text-sm text-zinc-400" data-testid="responder-inbound">“{r.inboundText}”</p>
          <textarea
            data-testid="responder-draft"
            value={draftFor(r)}
            onChange={(e) => setEdits((s) => ({ ...s, [r._id]: e.target.value }))}
            rows={2}
            className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-sm text-zinc-200"
          />
          <div className="flex gap-2">
            <button
              data-testid="responder-approve"
              disabled={busy[r._id]}
              onClick={() => act(r._id, () => approveReply(r._id, edits[r._id]))}
              className="rounded-lg bg-green-500/90 px-3 py-1 text-sm font-medium text-black disabled:opacity-50"
            >
              Approve
            </button>
            <button
              data-testid="responder-reject"
              disabled={busy[r._id]}
              onClick={() => act(r._id, () => rejectReply(r._id))}
              className="rounded-lg bg-zinc-800 px-3 py-1 text-sm text-zinc-300 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
