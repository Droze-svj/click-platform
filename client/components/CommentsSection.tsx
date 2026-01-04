'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../contexts/ToastContext'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface Comment {
  _id: string
  userId: {
    _id: string
    name: string
    email: string
  }
  text: string
  reactions: Array<{
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
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadComments()
  }, [entityId, entityType])

  const loadComments = async () => {
    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams({
        entityType,
        entityId
      })
      if (teamId) params.append('teamId', teamId)

      const response = await axios.get(`${API_URL}/comments?${params.toString()}`, {
      })

      if (response.data.success) {
        setComments(response.data.data || [])
      }
    } catch (error) {
      showToast('Failed to load comments', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      showToast('Comment cannot be empty', 'error')
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await axios.post(
        `${API_URL}/comments`,
        {
          entityType,
          entityId,
          text: newComment,
          teamId: teamId || null
        },
        {
        }
      )

      if (response.data.success) {
        setNewComment('')
        await loadComments()
        showToast('Comment added', 'success')
      }
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to add comment', 'error')
    }
  }

  const handleReaction = async (commentId: string, type: string) => {
    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${API_URL}/comments/${commentId}/reaction`,
        { type },
        {
        }
      )
      await loadComments()
    } catch (error) {
      showToast('Failed to add reaction', 'error')
    }
  }

  const getReactionCount = (comment: Comment, type: string) => {
    return comment.reactions.filter(r => r.type === type).length
  }

  const hasUserReacted = (comment: Comment, type: string) => {
    return comment.reactions.some(
      r => r.userId === user?.id && r.type === type
    )
  }

  if (loading) {
    return <div className="text-center py-4 text-gray-500">Loading comments...</div>
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Comments</h3>

      <div className="mb-4">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          className="w-full px-4 py-2 border rounded-lg mb-2"
          rows={3}
        />
        <button
          onClick={handleAddComment}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
        >
          Post Comment
        </button>
      </div>

      <div className="space-y-4">
        {comments.map((comment) => (
          <div key={comment._id} className="border-b pb-4 last:border-0">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-semibold text-sm">{comment.userId.name}</p>
                <p className="text-xs text-gray-500">
                  {new Date(comment.createdAt).toLocaleString()}
                </p>
              </div>
              {comment.isResolved && (
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                  Resolved
                </span>
              )}
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{comment.text}</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleReaction(comment._id, hasUserReacted(comment, 'like') ? '' : 'like')}
                className={`text-xs px-2 py-1 rounded ${
                  hasUserReacted(comment, 'like')
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                👍 {getReactionCount(comment, 'like')}
              </button>
              <button
                onClick={() => handleReaction(comment._id, hasUserReacted(comment, 'helpful') ? '' : 'helpful')}
                className={`text-xs px-2 py-1 rounded ${
                  hasUserReacted(comment, 'helpful')
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                ✅ Helpful {getReactionCount(comment, 'helpful')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {comments.length === 0 && (
        <p className="text-gray-500 text-center py-8">No comments yet. Be the first to comment!</p>
      )}
    </div>
  )
}







