'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import axios from 'axios'
import { API_URL } from '@/lib/api'

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

export default function SimplePortalPage() {
  const params = useParams()
  const token = params.token as string
  const [view, setView] = useState<ApprovalView | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [comment, setComment] = useState('')
  const [showCommentInput, setShowCommentInput] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadApproval()
  }, [token])

  const loadApproval = async () => {
    try {
      const res = await axios.get(`${API_URL}/simple-portal/${token}`)
      if (res.data.success) {
        setView(res.data.data)
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to load approval' })
    } finally {
      setLoading(false)
    }
  }

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
          text: `Content ${action === 'approve' ? 'approved' : 'declined'} successfully!`
        })
        setTimeout(() => {
          window.location.href = '/simple-portal/success'
        }, 2000)
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || `Failed to ${action}`
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
        setMessage({ type: 'success', text: 'Comment added' })
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to add comment'
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading approval...</p>
        </div>
      </div>
    )
  }

  if (!view) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600">Failed to load approval</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-2xl font-bold mb-2">Content Approval</h1>
          <p className="text-gray-600">Stage: {view.approval.stage.name}</p>
          <p className="text-sm text-gray-500">Created by {view.approval.createdBy}</p>
        </div>

        {/* Content Preview */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">{view.approval.title}</h2>
          <div className="prose max-w-none">
            <p className="whitespace-pre-wrap">{view.approval.content.text}</p>
          </div>
          {view.approval.content.mediaUrl && (
            <div className="mt-4">
              <img
                src={view.approval.content.mediaUrl}
                alt="Content media"
                className="max-w-full rounded-lg"
              />
            </div>
          )}
        </div>

        {/* Comments */}
        {view.comments.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h3 className="font-semibold mb-4">Comments</h3>
            <div className="space-y-3">
              {view.comments.map((c) => (
                <div key={c.id} className="border-l-4 border-blue-500 pl-4 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{c.author}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{c.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comment Input */}
        {showCommentInput && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment..."
              className="w-full p-3 border rounded-lg mb-3"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddComment}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add Comment
              </button>
              <button
                onClick={() => {
                  setShowCommentInput(false)
                  setComment('')
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => handleAction('approve')}
              disabled={actionLoading}
              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg"
            >
              {actionLoading ? 'Processing...' : '✓ Approve'}
            </button>
            <button
              onClick={() => handleAction('decline')}
              disabled={actionLoading}
              className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg"
            >
              {actionLoading ? 'Processing...' : '✗ Decline'}
            </button>
            <button
              onClick={() => setShowCommentInput(!showCommentInput)}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
            >
              💬 Comment
            </button>
          </div>

          {/* Quick comment on action */}
          {!showCommentInput && (
            <div className="mt-4">
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Optional comment when approving/declining..."
                className="w-full p-2 border rounded-lg text-sm"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


