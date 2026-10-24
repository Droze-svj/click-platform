'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost, handleApiError } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../contexts/ToastContext'
import { useTranslation } from '@/hooks/useTranslation'

// Comment docs (server/models/Comment.js): userId is a raw id (not populated);
// the display name is userName. reactions[] is toggled by
// POST /comments/:id/reaction { type }.
interface Comment {
  _id: string
  userId: any
  userName?: string
  text: string
  reactions?: Array<{
    userId: string
    type: string
  }>
  isResolved: boolean
  createdAt: string
  parentCommentId?: string
}

interface CommentsSectionProps {
  entityType: 'content' | 'script' | 'workflow'
  entityId: string
  teamId?: string
}

export default function CommentsSection({ entityType, entityId, teamId }: CommentsSectionProps) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { t } = useTranslation()
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)

  const loadComments = useCallback(async () => {
    // Comments are team-scoped server-side; without a teamId the API rejects the
    // request, so render the empty state instead of erroring.
    if (!teamId) { setComments([]); setLoading(false); return }
    try {
      const params = new URLSearchParams({
        entityType,
        entityId,
        teamId
      })

      const res: any = await apiGet(`/comments?${params.toString()}`, undefined, false)
      const list = res?.data ?? res
      setComments(Array.isArray(list) ? list : [])
    } catch (error) {
      showToast(t('commentsSection.loadFailed'), 'error')
    } finally {
      setLoading(false)
    }
  }, [entityId, entityType, teamId, showToast])

  useEffect(() => {
    loadComments()
  }, [loadComments])

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      showToast(t('commentsSection.emptyError'), 'error')
      return
    }

    try {
      await apiPost('/comments', {
        entityType,
        entityId,
        text: newComment,
        teamId: teamId || null,
        userName: (user as any)?.name || undefined,
      })
      setNewComment('')
      await loadComments()
      showToast(t('commentsSection.added'), 'success')
    } catch (error: any) {
      showToast(handleApiError(error) || t('commentsSection.addFailed'), 'error')
    }
  }

  // The server toggles the caller's reaction of this type.
  const handleReaction = async (commentId: string, type: string) => {
    try {
      const res: any = await apiPost(`/comments/${encodeURIComponent(commentId)}/reaction`, { type })
      const updated = res?.data ?? null
      if (updated && updated._id) {
        setComments(prev => prev.map(c => (c._id === updated._id ? updated : c)))
      } else {
        await loadComments()
      }
    } catch (error) {
      showToast(t('commentsSection.reactionFailed'), 'error')
    }
  }

  const myId = String((user as any)?._id || user?.id || '')

  const getReactionCount = (comment: Comment, type: string) => {
    return (comment.reactions || []).filter(r => r.type === type).length
  }

  const hasUserReacted = (comment: Comment, type: string) => {
    return (comment.reactions || []).some(
      r => String(r.userId) === myId && r.type === type
    )
  }

  if (loading) {
    return <div className="text-center py-4 text-gray-500">{t('commentsSection.loading')}</div>
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">{t('commentsSection.title')}</h3>

      <div className="mb-4">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={t('commentsSection.inputPlaceholder')}
          className="w-full px-4 py-2 border rounded-lg mb-2"
          rows={3}
        />
        <button
          type="button"
          onClick={handleAddComment}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
        >
          {t('commentsSection.postComment')}
        </button>
      </div>

      <div className="space-y-4">
        {comments.map((comment) => (
          <div key={comment._id} className="border-b pb-4 last:border-0">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-semibold text-sm">{comment.userName || comment.userId?.name || '—'}</p>
                <p className="text-xs text-gray-500">
                  {new Date(comment.createdAt).toLocaleString()}
                </p>
              </div>
              {comment.isResolved && (
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                  {t('commentsSection.resolved')}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{comment.text}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleReaction(comment._id, 'like')}
                className={`text-xs px-2 py-1 rounded ${
                  hasUserReacted(comment, 'like')
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                👍 {getReactionCount(comment, 'like')}
              </button>
              <button
                type="button"
                onClick={() => handleReaction(comment._id, 'helpful')}
                className={`text-xs px-2 py-1 rounded ${
                  hasUserReacted(comment, 'helpful')
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                ✅ {t('commentsSection.helpful')} {getReactionCount(comment, 'helpful')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {comments.length === 0 && (
        <p className="text-gray-500 text-center py-8">{t('commentsSection.empty')}</p>
      )}
    </div>
  )
}







