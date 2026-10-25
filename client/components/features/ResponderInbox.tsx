'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  getPendingReplies, approveReply, rejectReply, sendReply, getResponderPlatforms,
  type SocialReply,
} from '@/lib/featuresApi'
import { useTranslation } from '@/hooks/useTranslation'

/**
 * Human-approval inbox for the AI Comment/DM Responder. Lists pending drafts,
 * lets the creator edit the reply, then approve or reject. When outbound sending
 * is enabled (SOCIAL_REPLY_SEND), approving keeps the item as "approved" with a
 * Send-now action; otherwise approve/reject just drop it from the list. Sending
 * is always enforced server-side.
 */
export default function ResponderInbox() {
  const { t } = useTranslation()
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
      setError((e as Error)?.message || t('creatorTools.responderInbox.loadFailed'))
    } finally {
      setLoading(false)
    }
    // Mount-only on purpose: t() changes identity once the locale loads, and
    // that must not refetch. It is only used for the fallback error text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // A reply can only be posted as a reply TO something: the platform comment
  // id. Drafts made from pasted comments (Comment triage) have none, and the
  // send used to fail on the platform with an opaque error.
  const canSend = (r: SocialReply) => !!(r.externalCommentId && String(r.externalCommentId).trim())

  async function copyAndClose(r: SocialReply) {
    try {
      await navigator.clipboard?.writeText(draftFor(r))
    } catch {
      /* clipboard blocked — the text is still visible to copy by hand */
      return
    }
    setReplies((rs) => rs.filter((x) => x._id !== r._id))
  }

  // Run an action; `keep` leaves the item in the list (e.g. approve when sending
  // is enabled, so the creator can then Send it), otherwise it drops out.
  async function act(id: string, fn: () => Promise<unknown>, onDone?: () => void) {
    setBusy((b) => ({ ...b, [id]: true })); setError(null)
    try {
      await fn()
      if (onDone) onDone()
      else setReplies((rs) => rs.filter((r) => r._id !== id))
    } catch (e) {
      setError((e as Error)?.message || t('creatorTools.responderInbox.actionFailed'))
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

  if (loading) return <p data-testid="responder-loading" className="text-sm text-theme-secondary">{t('creatorTools.common.loading')}</p>

  return (
    <div className="space-y-3" data-testid="responder-inbox">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-theme-primary">{t('creatorTools.responderInbox.title')}</h2>
        <button onClick={load} className="text-xs text-theme-secondary hover:text-theme-primary" data-testid="responder-refresh">{t('creatorTools.responderInbox.refresh')}</button>
      </div>

      {error && <p data-testid="responder-error" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {replies.length === 0 && (
        <p data-testid="responder-empty" className="text-sm text-theme-muted">{t('creatorTools.responderInbox.empty')}</p>
      )}

      {replies.map((r) => (
        <div key={r._id} data-testid="responder-item" className="rounded-xl bg-surface-card border border-default p-3 space-y-2">
          <div className="text-xs text-theme-muted">
            <span className="uppercase">{r.platform}</span>
            {r.author ? <span> · @{r.author}</span> : null}
          </div>
          <p className="text-sm text-theme-secondary" data-testid="responder-inbound">“{r.inboundText}”</p>
          <textarea
            data-testid="responder-draft"
            aria-label={t('creatorTools.responderInbox.draftLabel')}
            value={draftFor(r)}
            onChange={(e) => setEdits((s) => ({ ...s, [r._id]: e.target.value }))}
            rows={2}
            className="w-full rounded-lg bg-background border border-default p-2 text-sm text-theme-primary"
          />
          <div className="flex gap-2">
            {approved[r._id] && canSend(r) ? (
              <button
                type="button"
                data-testid="responder-send"
                disabled={busy[r._id]}
                onClick={() => act(r._id, () => sendReply(r._id))}
                className="rounded-lg bg-blue-500/90 px-3 py-1 text-sm font-medium text-black disabled:opacity-50"
              >
                {busy[r._id] ? t('creatorTools.responderInbox.sending') : t('creatorTools.responderInbox.sendNow')}
              </button>
            ) : approved[r._id] ? (
              <>
                <button
                  type="button"
                  data-testid="responder-send"
                  disabled
                  aria-describedby={`responder-no-target-${r._id}`}
                  className="rounded-lg bg-blue-500/90 px-3 py-1 text-sm font-medium text-black disabled:opacity-50"
                >
                  {t('creatorTools.responderInbox.sendNow')}
                </button>
                <button
                  type="button"
                  data-testid="responder-copy"
                  onClick={() => copyAndClose(r)}
                  className="rounded-lg bg-muted px-3 py-1 text-sm text-theme-secondary"
                >
                  {t('responderInbox.copyReply')}
                </button>
              </>
            ) : (
              <button
                type="button"
                data-testid="responder-approve"
                disabled={busy[r._id]}
                onClick={() => approve(r._id)}
                className="rounded-lg bg-primary hover:bg-primary/90 px-3 py-1 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {t('creatorTools.responderInbox.approve')}
              </button>
            )}
            <button
              type="button"
              data-testid="responder-reject"
              disabled={busy[r._id] || approved[r._id]}
              onClick={() => act(r._id, () => rejectReply(r._id))}
              className="rounded-lg bg-muted px-3 py-1 text-sm text-theme-secondary disabled:opacity-50"
            >
              {t('creatorTools.responderInbox.reject')}
            </button>
          </div>
          {approved[r._id] && !canSend(r) && (
            <p id={`responder-no-target-${r._id}`} data-testid="responder-send-unavailable" className="text-xs text-theme-muted">
              {t('responderInbox.sendNeedsComment', { platform: r.platform })}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
