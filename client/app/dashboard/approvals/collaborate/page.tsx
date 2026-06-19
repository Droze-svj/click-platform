'use client'

import React, { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { MessageSquare, History, Check, CornerDownRight, RefreshCw, Send } from 'lucide-react'
import { useToast } from '../../../../contexts/ToastContext'
import ToastContainer from '../../../../components/ToastContainer'
import { apiGet, apiPost } from '../../../../lib/api'
import { extractApiError } from '../../../../utils/apiResponse'
import {
  Panel,
  Button,
  Badge,
  Input,
  Textarea,
  EmptyState,
  SectionHeader,
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

function CollaborateInner() {
  const params = useSearchParams()
  const toast = useToast()

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
      const res = await apiGet<{ data: ApprovalStatus }>(`/api/approvals/${id}/status`)
      setStatus(res?.data || null)
    } catch (err) {
      toast.error(extractApiError(err).message || 'Could not load approval')
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [toast])

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
      await apiPost(`/api/approvals/${approvalId}/comments`, {
        text: commentText.trim(),
        targetField: targetField.trim() || undefined,
        parentId: replyTo || undefined,
      })
      toast.success('Comment added')
      setCommentText('')
      setTargetField('')
      setReplyTo(null)
      await load(approvalId)
    } catch (err) {
      toast.error(extractApiError(err).message || 'Could not add comment')
    } finally {
      setPostingComment(false)
    }
  }

  const toggleResolve = async (commentId: string, resolved: boolean) => {
    try {
      await apiPost(`/api/approvals/${approvalId}/comments/${commentId}/resolve`, { resolved: !resolved })
      await load(approvalId)
    } catch (err) {
      toast.error(extractApiError(err).message || 'Could not update comment')
    }
  }

  const submitRevision = async () => {
    if (!approvalId) return
    setPostingRevision(true)
    try {
      await apiPost(`/api/approvals/${approvalId}/revisions`, { note: revisionNote.trim() || undefined })
      toast.success('Revision recorded')
      setRevisionNote('')
      await load(approvalId)
    } catch (err) {
      toast.error(extractApiError(err).message || 'Could not record revision')
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
        <span className="font-medium text-theme-primary">{c.authorName || 'Reviewer'}</span>
        {c.authorRole ? <Badge variant="secondary">{c.authorRole}</Badge> : null}
        {c.targetField ? <Badge variant="outline">on: {c.targetField}</Badge> : null}
        {c.resolved ? <Badge variant="default">Resolved</Badge> : null}
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
            <CornerDownRight className="h-3 w-3" /> {replyTo === c.id ? 'Cancel reply' : 'Reply'}
          </button>
        ) : null}
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-theme-muted hover:text-emerald-500"
          onClick={() => toggleResolve(c.id, !!c.resolved)}
        >
          <Check className="h-3 w-3" /> {c.resolved ? 'Reopen' : 'Resolve'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <SectionHeader
        as="h1"
        title="Approval Collaboration"
        description="Inline comment threads + revision history for a content approval."
      />

      {/* Approval id picker */}
      <Panel variant="glass" className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[240px]">
          <Input
            placeholder="Content approval ID"
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
          Load
        </Button>
      </Panel>

      {!approvalId ? (
        <EmptyState
          icon={MessageSquare}
          title="Enter an approval to collaborate"
          description="Paste a content approval ID above (or open this page with ?id=…) to view its comment threads and revision history."
        />
      ) : (
        <>
          {/* Comments */}
          <Panel variant="bento" className="space-y-4">
            <SectionHeader as="h3" title="Comments" description={status?.status ? `Approval status: ${status.status}` : undefined} />

            <div className="space-y-3">
              <Textarea
                rows={3}
                placeholder={replyTo ? 'Write a reply…' : 'Add a comment on the content…'}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />
              <div className="flex flex-wrap items-center gap-3">
                {!replyTo ? (
                  <div className="min-w-[200px] flex-1">
                    <Input
                      placeholder="Target field (optional, e.g. caption)"
                      value={targetField}
                      onChange={(e) => setTargetField(e.target.value)}
                    />
                  </div>
                ) : (
                  <Badge variant="outline">Replying — <button type="button" className="underline" onClick={() => setReplyTo(null)}>cancel</button></Badge>
                )}
                <Button
                  variant="primary"
                  leftIcon={<Send className="h-4 w-4" />}
                  loading={postingComment}
                  disabled={!commentText.trim()}
                  onClick={submitComment}
                  className="ml-auto"
                >
                  {replyTo ? 'Reply' : 'Comment'}
                </Button>
              </div>
            </div>

            {topLevel.length === 0 ? (
              <EmptyState icon={MessageSquare} title="No comments yet" description="Be the first to leave feedback on this content." />
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
            <SectionHeader as="h3" title="Revision history" description="Each re-submission after changes-requested." />

            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[240px] flex-1">
                <Input
                  placeholder="Revision note (what changed)"
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
                Record revision
              </Button>
            </div>

            {revisions.length === 0 ? (
              <EmptyState icon={History} title="No revisions yet" description="Recorded revisions will appear here." />
            ) : (
              <ol className="space-y-2">
                {[...revisions].sort((a, b) => (b.version || 0) - (a.version || 0)).map((r) => (
                  <li key={r.version} className="flex items-start gap-3 rounded-xl border border-border/60 bg-surface p-3">
                    <Badge variant="secondary">v{r.version}</Badge>
                    <div className="min-w-0">
                      <p className="text-sm text-theme-secondary">{r.note || 'Revision'}</p>
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
    </div>
  )
}

export default function ApprovalCollaboratePage() {
  return (
    <Suspense fallback={<div className="p-6 text-theme-muted">Loading…</div>}>
      <CollaborateInner />
    </Suspense>
  )
}
