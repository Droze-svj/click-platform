'use client'

import { useCallback, useEffect, useState } from 'react'
import { getResponderHistory, type SocialReply } from '@/lib/featuresApi'
import { useTranslation } from '@/hooks/useTranslation'

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
  const { t } = useTranslation()
  // Resolved-reply statuses the history can filter by ('' = all).
  const filters: { value: string; label: string }[] = [
    { value: '', label: t('creatorTools.responderHistory.filterAll') },
    { value: 'sent', label: t('creatorTools.responderHistory.filterSent') },
    { value: 'approved', label: t('creatorTools.responderHistory.filterApproved') },
    { value: 'rejected', label: t('creatorTools.responderHistory.filterRejected') },
    { value: 'failed', label: t('creatorTools.responderHistory.filterFailed') },
  ]
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
      setError((e as Error)?.message || t('creatorTools.responderHistory.loadFailed'))
    } finally {
      setLoading(false)
    }
    // Mount-only on purpose: t() changes identity once the locale loads, and
    // that must not refetch. It is only used for the fallback error text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load(status) }, [load, status])

  return (
    <div className="space-y-3" data-testid="responder-history">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-theme-primary">{t('creatorTools.responderHistory.title')}</h2>
        <select
          data-testid="history-filter"
          aria-label={t('creatorTools.responderHistory.filterLabel')}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded bg-background border border-default p-1 text-xs text-theme-secondary"
        >
          {filters.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>

      {error && <p data-testid="history-error" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {loading && <p data-testid="history-loading" className="text-sm text-theme-secondary">{t('creatorTools.common.loading')}</p>}

      {!loading && replies.length === 0 && (
        <p data-testid="history-empty" className="text-sm text-theme-muted">{t('creatorTools.responderHistory.empty')}</p>
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
