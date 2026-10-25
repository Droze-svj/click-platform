'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import axios from 'axios'
import { CheckCircle2, XCircle, MessageSquare, AlertCircle, Loader2 } from 'lucide-react'
import { API_URL } from '@/lib/api'
import { AuthShell, Button, Card, Icon, PageShell } from '@/components/ui'
import ClickLogo from '@/components/ClickLogo'
import { useTranslation } from '@/hooks/useTranslation'

interface ApprovalView {
  approval: {
    id: string
    title: string
    content: {
      text: string
      mediaUrl: string | null
      type: string
    }
    stage: {
      name: string
    }
    createdBy: string
    createdAt: string
  }
  actions: {
    approve: { url: string; method: string }
    decline: { url: string; method: string }
    comment: { url: string; method: string }
  }
  comments: Array<{
    id: string
    text: string
    author: string
    createdAt: string
    type: string
  }>
  token: string
}

/*
 * The page an agency's client opens from an approval link — often the first
 * (and only) Click screen they ever see. It used to be hardcoded light
 * (bg-white cards, text-gray-900); globals.css remaps `.dark .bg-white` to dark
 * grey, so in dark theme every card was dark text on a dark card, and a bad or
 * expired link showed one line of red text on an empty page. It now uses the
 * design-system surfaces, which work in both themes.
 */
export default function SimplePortalPage() {
  const params = useParams()
  const token = params.token as string
  const { t } = useTranslation()
  const [view, setView] = useState<ApprovalView | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [comment, setComment] = useState('')
  const [showCommentInput, setShowCommentInput] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadApproval = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/simple-portal/${token}`)
      if (res.data.success) {
        setView(res.data.data)
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || t('simplePortalPage.loadFailed') })
    } finally {
      setLoading(false)
    }
  }, [token, t])

  useEffect(() => {
    loadApproval()
  }, [loadApproval])

  const handleAction = async (action: 'approve' | 'decline') => {
    setActionLoading(true)
    setMessage(null)

    try {
      const res = await axios.post(
        `${API_URL}/simple-portal/${token}/${action}`,
        comment ? { comment } : {}
      )

      if (res.data.success) {
        setMessage({
          type: 'success',
          text: action === 'approve' ? t('simplePortalPage.approved') : t('simplePortalPage.declined'),
        })
        setTimeout(() => {
          window.location.href = '/simple-portal/success'
        }, 2000)
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || (action === 'approve' ? t('simplePortalPage.approveFailed') : t('simplePortalPage.declineFailed')),
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleAddComment = async () => {
    if (!comment.trim()) return

    try {
      const res = await axios.post(`${API_URL}/simple-portal/${token}/comment`, { comment })
      if (res.data.success) {
        setComment('')
        setShowCommentInput(false)
        await loadApproval() // Reload to show new comment
        setMessage({ type: 'success', text: t('simplePortalPage.commentAdded') })
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || t('simplePortalPage.commentFailed'),
      })
    }
  }

  const fieldClass =
    'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-theme-primary placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

  if (loading) {
    return (
      <AuthShell width="md" aria-busy="true">
        <div role="status" className="flex flex-col items-center gap-4 text-theme-secondary">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <p className="ds-text-body">{t('simplePortalPage.loading')}</p>
        </div>
      </AuthShell>
    )
  }

  if (!view) {
    return (
      <AuthShell width="md">
        <Card variant="elevated" className="p-8 sm:p-10 text-center space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/20">
            <Icon icon={AlertCircle} size="lg" className="text-rose-500" />
          </div>
          <h1 className="ds-text-h2 text-theme-primary">{t('simplePortalPage.unavailableTitle')}</h1>
          <p className="ds-text-body text-theme-secondary">{t('simplePortalPage.unavailableBody')}</p>
          {message?.text ? (
            <p className="text-xs text-theme-muted">{message.text}</p>
          ) : null}
        </Card>
      </AuthShell>
    )
  }

  return (
    <main className="min-h-screen ds-bg-mesh">
      <PageShell width="narrow">
        {/* Header */}
        <Card variant="elevated" className="p-6 flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ds-surface-subtle">
            <ClickLogo size={28} />
          </span>
          <div className="min-w-0">
            <p className="ds-text-label text-theme-muted">{t('simplePortalPage.kicker')}</p>
            <h1 className="ds-text-h2 text-theme-primary break-words">{view.approval.title}</h1>
            <p className="mt-1 text-sm text-theme-secondary">
              {t('simplePortalPage.stage', { stage: view.approval.stage.name })} · {t('simplePortalPage.createdBy', { name: view.approval.createdBy })}
            </p>
          </div>
        </Card>

        {/* Content Preview */}
        <Card variant="glass" className="p-6">
          <p className="whitespace-pre-wrap break-words ds-text-body text-theme-primary">{view.approval.content.text}</p>
          {view.approval.content.mediaUrl && (
            <img
              src={view.approval.content.mediaUrl}
              alt={t('simplePortalPage.mediaAlt')}
              className="mt-4 max-w-full rounded-lg"
            />
          )}
        </Card>

        {/* Comments */}
        {view.comments.length > 0 && (
          <Card variant="glass" className="p-6">
            <h2 className="ds-text-h3 text-theme-primary mb-4">{t('simplePortalPage.comments')}</h2>
            <ul className="space-y-3">
              {view.comments.map((c) => (
                <li key={c.id} className="border-l-2 border-primary pl-4 py-1">
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span className="text-sm font-medium text-theme-primary">{c.author}</span>
                    <span className="text-xs text-theme-muted">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-theme-secondary break-words">{c.text}</p>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* Comment Input */}
        {showCommentInput && (
          <Card variant="glass" className="p-6 space-y-3">
            <label htmlFor="portal-comment" className="ds-text-label text-theme-secondary">{t('simplePortalPage.addComment')}</label>
            <textarea
              id="portal-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('simplePortalPage.commentPlaceholder')}
              className={`${fieldClass} min-h-[88px] resize-y`}
              rows={3}
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={handleAddComment} disabled={!comment.trim()}>
                {t('simplePortalPage.addComment')}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowCommentInput(false)
                  setComment('')
                }}
              >
                {t('simplePortalPage.cancel')}
              </Button>
            </div>
          </Card>
        )}

        {/* Message */}
        {message && (
          <div
            role={message.type === 'error' ? 'alert' : 'status'}
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${
              message.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
            }`}
          >
            <Icon icon={message.type === 'success' ? CheckCircle2 : AlertCircle} size="sm" className="mt-0.5 shrink-0" />
            <span className="min-w-0 break-words">{message.text}</span>
          </div>
        )}

        {/* Actions */}
        <Card variant="elevated" className="p-6 space-y-4">
          {!showCommentInput && (
            <div className="space-y-1.5">
              <label htmlFor="portal-quick-comment" className="ds-text-label text-theme-secondary">
                {t('simplePortalPage.optionalComment')}
              </label>
              <input
                id="portal-quick-comment"
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t('simplePortalPage.optionalCommentPlaceholder')}
                className={`${fieldClass} h-10`}
              />
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              size="lg"
              onClick={() => handleAction('approve')}
              disabled={actionLoading}
              loading={actionLoading}
              leftIcon={<CheckCircle2 className="h-5 w-5" />}
              className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {actionLoading ? t('simplePortalPage.processing') : t('simplePortalPage.approve')}
            </Button>
            <Button
              size="lg"
              onClick={() => handleAction('decline')}
              disabled={actionLoading}
              leftIcon={<XCircle className="h-5 w-5" />}
              className="flex-1 bg-rose-600 text-white hover:bg-rose-700"
            >
              {actionLoading ? t('simplePortalPage.processing') : t('simplePortalPage.decline')}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => setShowCommentInput(!showCommentInput)}
              leftIcon={<MessageSquare className="h-5 w-5" />}
            >
              {t('simplePortalPage.comment')}
            </Button>
          </div>
        </Card>
      </PageShell>
    </main>
  )
}
