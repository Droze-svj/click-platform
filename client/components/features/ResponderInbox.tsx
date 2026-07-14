'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  getPendingReplies, approveReply, rejectReply, sendReply, getResponderPlatforms,
  type SocialReply,
} from '@/lib/featuresApi'

/**
 * Human-approval inbox for the AI Comment/DM Responder. Lists pending drafts,
 * lets the creator edit the reply, then approve or reject. When outbound sending
 * is enabled (SOCIAL_REPLY_SEND), approving keeps the item as "approved" with a
 * Send-now action; otherwise approve/reject just drop it from the list. Sending
 * is always enforced server-side.
 */
export default function ResponderInbox() {
  const [replies, setReplies] = useState<SocialReply[]>([])
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [approved, setApproved] = useState<Record<string, boolean>>({})
  const [sendEnabled, setSendEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await getPendingReplies()
      setReplies(res.replies || [])
      setApproved({})
    } catch (e) {
      setError((e as Error)?.message || 'Failed to load pending replies')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Whether outbound sending is turned on; drives the Send-now affordance.
  useEffect(() => {
    let alive = true
    getResponderPlatforms()
      .then((res) => { if (alive && res) setSendEnabled(!!res.sendEnabled) })
      .catch(() => { /* leave sending affordance off */ })
    return () => { alive = false }
  }, [])

  const draftFor = (r: SocialReply) => (r._id in edits ? edits[r._id] : (r.editedReply ?? r.draftReply))

  // Run an action; `keep` leaves the item in the list (e.g. approve when sending
  // is enabled, so the creator can then Send it), otherwise it drops out.
  async function act(id: string, fn: () => Promise<unknown>, onDone?: () => void) {
    setBusy((b) => ({ ...b, [id]: true })); setError(null)
    try {
      await fn()
      if (onDone) onDone()
      else setReplies((rs) => rs.filter((r) => r._id !== id))
    } catch (e) {
      setError((e as Error)?.message || 'Action failed')
    } finally {
      setBusy((b) => ({ ...b, [id]: false }))
    }
  }

  function approve(id: string) {
    if (sendEnabled) {
      return act(id, () => approveReply(id, edits[id]), () => setApproved((a) => ({ ...a, [id]: true })))
    }
    return act(id, () => approveReply(id, edits[id]))
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
            aria-label="Reply draft"
            value={draftFor(r)}
            onChange={(e) => setEdits((s) => ({ ...s, [r._id]: e.target.value }))}
            rows={2}
            className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-sm text-zinc-200"
          />
          <div className="flex gap-2">
            {approved[r._id] ? (
              <button
                type="button"
                data-testid="responder-send"
                disabled={busy[r._id]}
                onClick={() => act(r._id, () => sendReply(r._id))}
                className="rounded-lg bg-blue-500/90 px-3 py-1 text-sm font-medium text-black disabled:opacity-50"
              >
                {busy[r._id] ? 'Sending…' : 'Send now'}
              </button>
            ) : (
              <button
                type="button"
                data-testid="responder-approve"
                disabled={busy[r._id]}
                onClick={() => approve(r._id)}
                className="rounded-lg bg-green-500/90 px-3 py-1 text-sm font-medium text-black disabled:opacity-50"
              >
                Approve
              </button>
            )}
            <button
              type="button"
              data-testid="responder-reject"
              disabled={busy[r._id] || approved[r._id]}
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
