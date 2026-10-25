'use client'

import React, { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { MessageSquare, History, Check, CornerDownRight, RefreshCw, Send } from 'lucide-react'
import { useToast } from '../../../../contexts/ToastContext'
import ToastContainer from '../../../../components/ToastContainer'
import { apiGet, apiPost } from '../../../../lib/api'
import { extractApiError } from '../../../../utils/apiResponse'
import { useTranslation } from '@/hooks/useTranslation'
import {
  Panel,
  Button,
  Badge,
  Input,
  Textarea,
  EmptyState,
  SectionHeader,
  PageShell,
} from '../../../../components/ui'

interface ApprovalComment {
  id: string
  authorId?: string | null
  authorName?: string
  authorRole?: string
  text: string
  targetField?: string | null
  parentId?: string | null
  resolved?: boolean
  createdAt?: string
}

interface ApprovalRevision {
  version: number
  changedBy?: string | null
  note?: string
  changes?: Record<string, unknown>
  createdAt?: string
}

interface ApprovalStatus {
  status?: string
  comments?: ApprovalComment[]
  revisions?: ApprovalRevision[]
}

function fmtDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleString()
}

type TFn = (key: string, params?: Record<string, string | number>) => string

/** Plain-language approval status; unknown values pass through unchanged. */
function statusLabel(status: string, t: TFn): string {
  switch (status) {
    case 'pending': return t('approvalCollaboratePage.statusPending')
    case 'in_progress': return t('approvalCollaboratePage.statusInProgress')
    case 'approved': return t('approvalCollaboratePage.statusApproved')
    case 'rejected': return t('approvalCollaboratePage.statusRejected')
    case 'changes_requested': return t('approvalCollaboratePage.statusChangesRequested')
    case 'cancelled': return t('approvalCollaboratePage.statusCancelled')
    default: return status
  }
}

/** Plain-language comment-author role; free-form roles pass through. */
function roleLabel(role: string, t: TFn): string {
  switch (role) {
    case 'reviewer': return t('approvalCollaboratePage.roleReviewer')
    case 'owner': return t('approvalCollaboratePage.roleOwner')
    case 'admin': return t('approvalCollaboratePage.roleAdmin')
    case 'approver': return t('approvalCollaboratePage.roleApprover')
    case 'editor': return t('approvalCollaboratePage.roleEditor')
    default: return role
  }
}

function CollaborateInner() {
  const params = useSearchParams()
  const toast = useToast()
  const { t } = useTranslation()

  const [approvalId, setApprovalId] = useState('')
  const [idInput, setIdInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<ApprovalStatus | null>(null)

  // New-comment form
  const [commentText, setCommentText] = useState('')
  const [targetField, setTargetField] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [postingComment, setPostingComment] = useState(false)

  // New-revision form
  const [revisionNote, setRevisionNote] = useState('')
  const [postingRevision, setPostingRevision] = useState(false)

  useEffect(() => {
    const fromQuery = params?.get('id')
    if (fromQuery) {
      setApprovalId(fromQuery)
      setIdInput(fromQuery)
    }
  }, [params])

  const load = useCallback(async (id: string) => {
    if (!id) return
    setLoading(true)
    try {
      const res = await apiGet<{ data: ApprovalStatus }>(`/approvals/${id}/status`)
      setStatus(res?.data || null)
    } catch (err) {
      toast.error(extractApiError(err).message || t('approvalCollaboratePage.errLoad'))
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [toast, t])

  useEffect(() => {
    if (approvalId) load(approvalId)
  }, [approvalId, load])

  const comments = status?.comments ?? []
  const revisions = status?.revisions ?? []
  const topLevel = comments.filter((c) => !c.parentId)
  const repliesOf = (id: string) => comments.filter((c) => c.parentId === id)

  const submitComment = async () => {
    if (!commentText.trim() || !approvalId) return
    setPostingComment(true)
    try {
      await apiPost(`/approvals/${approvalId}/comments`, {
        text: commentText.trim(),
        targetField: targetField.trim() || undefined,
        parentId: replyTo || undefined,
      })
      toast.success(t('approvalCollaboratePage.commentAddedToast'))
      setCommentText('')
      setTargetField('')
      setReplyTo(null)
      await load(approvalId)
    } catch (err) {
      toast.error(extractApiError(err).message || t('approvalCollaboratePage.errAddComment'))
    } finally {
      setPostingComment(false)
    }
  }

  const toggleResolve = async (commentId: string, resolved: boolean) => {
    try {
      await apiPost(`/approvals/${approvalId}/comments/${commentId}/resolve`, { resolved: !resolved })
      await load(approvalId)
    } catch (err) {
      toast.error(extractApiError(err).message || t('approvalCollaboratePage.errUpdateComment'))
    }
  }

  const submitRevision = async () => {
    if (!approvalId) return
    setPostingRevision(true)
    try {
      await apiPost(`/approvals/${approvalId}/revisions`, { note: revisionNote.trim() || undefined })
      toast.success(t('approvalCollaboratePage.revisionRecordedToast'))
      setRevisionNote('')
      await load(approvalId)
    } catch (err) {
      toast.error(extractApiError(err).message || t('approvalCollaboratePage.errRecordRevision'))
    } finally {
      setPostingRevision(false)
    }
  }

  const renderComment = (c: ApprovalComment, isReply = false) => (
    <div
      key={c.id}
      className={`rounded-xl border border-border/60 p-3 ${isReply ? 'ml-6 bg-accent/40' : 'bg-surface'}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-theme-primary">{c.authorName || t('approvalCollaboratePage.defaultAuthor')}</span>
        {c.authorRole ? <Badge variant="secondary">{roleLabel(c.authorRole, t)}</Badge> : null}
        {c.targetField ? <Badge variant="outline">{t('approvalCollaboratePage.onField', { field: c.targetField })}</Badge> : null}
        {c.resolved ? <Badge variant="default">{t('approvalCollaboratePage.resolved')}</Badge> : null}
        <span className="ml-auto text-xs text-theme-muted">{fmtDate(c.createdAt)}</span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-theme-secondary">{c.text}</p>
      <div className="mt-2 flex items-center gap-3">
        {!isReply ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-theme-muted hover:text-theme-primary"
            onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
          >
            <CornerDownRight className="h-3 w-3" /> {replyTo === c.id ? t('approvalCollaboratePage.cancelReply') : t('approvalCollaboratePage.reply')}
          </button>
        ) : null}
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-theme-muted hover:text-emerald-500"
          onClick={() => toggleResolve(c.id, !!c.resolved)}
        >
          <Check className="h-3 w-3" /> {c.resolved ? t('approvalCollaboratePage.reopen') : t('approvalCollaboratePage.resolve')}
        </button>
      </div>
    </div>
  )

  return (
    // max-w-4xl kept explicitly: this is a single comment thread, and a wider
    // column makes the replies hard to scan. twMerge lets it win over the token.
    <PageShell className="max-w-4xl">
      <SectionHeader
        as="h1"
        title={t('approvalCollaboratePage.title')}
        description={t('approvalCollaboratePage.subtitle')}
      />

      {/* Approval id picker */}
      <Panel variant="glass" className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[240px]">
          <Input
            placeholder={t('approvalCollaboratePage.idPlaceholder')}
            aria-label={t('approvalCollaboratePage.idPlaceholder')}
            value={idInput}
            onChange={(e) => setIdInput(e.target.value)}
          />
        </div>
        <Button
          variant="primary"
          leftIcon={<RefreshCw className="h-4 w-4" />}
          loading={loading}
          onClick={() => setApprovalId(idInput.trim())}
        >
          {t('approvalCollaboratePage.loadButton')}
        </Button>
      </Panel>

      {!approvalId ? (
        <EmptyState
          icon={MessageSquare}
          title={t('approvalCollaboratePage.emptyTitle')}
          description={t('approvalCollaboratePage.emptyDescription')}
        />
      ) : (
        <>
          {/* Comments */}
          <Panel variant="bento" className="space-y-4">
            <SectionHeader as="h3" title={t('approvalCollaboratePage.commentsTitle')} description={status?.status ? t('approvalCollaboratePage.approvalStatus', { status: statusLabel(status.status, t) }) : undefined} />

            <div className="space-y-3">
              <Textarea
                rows={3}
                aria-label={replyTo ? t('approvalCollaboratePage.replyPlaceholder') : t('approvalCollaboratePage.commentPlaceholder')}
                placeholder={replyTo ? t('approvalCollaboratePage.replyPlaceholder') : t('approvalCollaboratePage.commentPlaceholder')}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />
              <div className="flex flex-wrap items-center gap-3">
                {!replyTo ? (
                  <div className="min-w-[200px] flex-1">
                    <Input
                      placeholder={t('approvalCollaboratePage.targetFieldPlaceholder')}
                      value={targetField}
                      onChange={(e) => setTargetField(e.target.value)}
                    />
                  </div>
                ) : (
                  <Badge variant="outline">{t('approvalCollaboratePage.replying')} — <button type="button" className="underline" onClick={() => setReplyTo(null)}>{t('approvalCollaboratePage.cancel')}</button></Badge>
                )}
                <Button
                  variant="primary"
                  leftIcon={<Send className="h-4 w-4" />}
                  loading={postingComment}
                  disabled={!commentText.trim()}
                  onClick={submitComment}
                  className="ml-auto"
                >
                  {replyTo ? t('approvalCollaboratePage.reply') : t('approvalCollaboratePage.commentButton')}
                </Button>
              </div>
            </div>

            {topLevel.length === 0 ? (
              <EmptyState icon={MessageSquare} title={t('approvalCollaboratePage.noCommentsTitle')} description={t('approvalCollaboratePage.noCommentsDescription')} />
            ) : (
              <div className="space-y-3">
                {topLevel.map((c) => (
                  <div key={c.id} className="space-y-2">
                    {renderComment(c)}
                    {repliesOf(c.id).map((r) => renderComment(r, true))}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Revisions */}
          <Panel variant="bento" className="space-y-4">
            <SectionHeader as="h3" title={t('approvalCollaboratePage.revisionsTitle')} description={t('approvalCollaboratePage.revisionsDescription')} />

            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[240px] flex-1">
                <Input
                  placeholder={t('approvalCollaboratePage.revisionNotePlaceholder')}
                  aria-label={t('approvalCollaboratePage.revisionNotePlaceholder')}
                  value={revisionNote}
                  onChange={(e) => setRevisionNote(e.target.value)}
                />
              </div>
              <Button
                variant="secondary"
                leftIcon={<History className="h-4 w-4" />}
                loading={postingRevision}
                onClick={submitRevision}
              >
                {t('approvalCollaboratePage.recordRevisionButton')}
              </Button>
            </div>

            {revisions.length === 0 ? (
              <EmptyState icon={History} title={t('approvalCollaboratePage.noRevisionsTitle')} description={t('approvalCollaboratePage.noRevisionsDescription')} />
            ) : (
              <ol className="space-y-2">
                {[...revisions].sort((a, b) => (b.version || 0) - (a.version || 0)).map((r) => (
                  <li key={r.version} className="flex items-start gap-3 rounded-xl border border-border/60 bg-surface p-3">
                    <Badge variant="secondary">{t('approvalCollaboratePage.versionBadge', { version: r.version })}</Badge>
                    <div className="min-w-0">
                      <p className="text-sm text-theme-secondary">{r.note || t('approvalCollaboratePage.revisionFallback')}</p>
                      <span className="text-xs text-theme-muted">{fmtDate(r.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </>
      )}

      <ToastContainer />
    </PageShell>
  )
}

function CollaborateFallback() {
  const { t } = useTranslation()
  return <PageShell className="max-w-4xl text-theme-muted">{t('approvalCollaboratePage.loading')}</PageShell>
}

export default function ApprovalCollaboratePage() {
  return (
    <Suspense fallback={<CollaborateFallback />}>
      <CollaborateInner />
    </Suspense>
  )
}
