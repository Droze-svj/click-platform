'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Users,
  User,
  MessageCircle,
  Share,
  Link,
  Copy,
  Eye,
  Edit,
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
  MoreVertical
} from 'lucide-react'
import { CollaborationIcon } from './icons/VideoIcons'
import { useToast } from '../contexts/ToastContext'

interface UserPresence {
  id: string
  name: string
  avatar?: string
  color: string
  cursor: {
    x: number
    y: number
    visible: boolean
  }
  lastActivity: number
  currentTool?: string
  status: 'active' | 'idle' | 'away'
}

interface Comment {
  id: string
  userId: string
  userName: string
  text: string
  position: { x: number, y: number, time: number }
  timestamp: number
  resolved: boolean
  replies: Comment[]
}

interface EditSession {
  id: string
  name: string
  participants: UserPresence[]
  comments: Comment[]
  isActive: boolean
  createdAt: number
  lastModified: number
  permissions: {
    canEdit: boolean
    canComment: boolean
    canInvite: boolean
  }
}

interface CollaborativeEditingProps {
  sessionId?: string
  currentUser: {
    id: string
    name: string
    avatar?: string
  }
  onSessionUpdate?: (session: EditSession) => void
  onCommentAdd?: (comment: Comment) => void
  onCursorMove?: (userId: string, position: { x: number, y: number }) => void
}

export default function CollaborativeEditing({
  sessionId,
  currentUser,
  onSessionUpdate,
  onCommentAdd,
  onCursorMove
}: CollaborativeEditingProps) {
  const [session, setSession] = useState<EditSession>({
    id: sessionId || `session-${Date.now()}`,
    name: 'Collaborative Edit Session',
    participants: [{
      id: currentUser.id,
      name: currentUser.name,
      avatar: currentUser.avatar,
      color: '#3B82F6',
      cursor: { x: 0, y: 0, visible: true },
      lastActivity: Date.now(),
      status: 'active',
      currentTool: 'select'
    }],
    comments: [],
    isActive: true,
    createdAt: Date.now(),
    lastModified: Date.now(),
    permissions: {
      canEdit: true,
      canComment: true,
      canInvite: true
    }
  })

  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [showCommentsPanel, setShowCommentsPanel] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [commentPosition, setCommentPosition] = useState<{ x: number, y: number, time: number } | null>(null)
  const [selectedComment, setSelectedComment] = useState<Comment | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { showToast } = useToast()

  // Mock collaborative features (in real implementation, this would use WebSockets/Socket.io)
  const updateCursorPosition = useCallback((x: number, y: number) => {
    setSession(prev => ({
      ...prev,
      participants: prev.participants.map(p =>
        p.id === currentUser.id
          ? { ...p, cursor: { x, y, visible: true }, lastActivity: Date.now() }
          : p
      )
    }))
    onCursorMove?.(currentUser.id, { x, y })
  }, [currentUser.id, onCursorMove])

  const addComment = useCallback((text: string, position: { x: number, y: number, time: number }) => {
    if (!text.trim()) return

    const comment: Comment = {
      id: `comment-${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      text: text.trim(),
      position,
      timestamp: Date.now(),
      resolved: false,
      replies: []
    }

    setSession(prev => ({
      ...prev,
      comments: [...prev.comments, comment],
      lastModified: Date.now()
    }))

    onCommentAdd?.(comment)
    setNewComment('')
    setCommentPosition(null)
    showToast('Comment added', 'success')
  }, [currentUser, onCommentAdd, showToast])

  const resolveComment = useCallback((commentId: string) => {
    setSession(prev => ({
      ...prev,
      comments: prev.comments.map(c =>
        c.id === commentId ? { ...c, resolved: true } : c
      ),
      lastModified: Date.now()
    }))
    showToast('Comment resolved', 'success')
  }, [showToast])

  const inviteParticipant = useCallback((email: string) => {
    // Mock invitation (in real implementation, this would send an email/invitation)
    showToast(`Invitation sent to ${email}`, 'success')
    setShowInviteDialog(false)
  }, [showToast])

  const generateShareLink = useCallback(() => {
    const shareUrl = `${window.location.origin}/collaborate/${session.id}`
    navigator.clipboard.writeText(shareUrl)
    showToast('Share link copied to clipboard', 'success')
  }, [session.id, showToast])

  // Mock real-time updates (in real implementation, this would use WebSockets)
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate other users' activity
      setSession(prev => ({
        ...prev,
        participants: prev.participants.map(p => ({
          ...p,
          status: Date.now() - p.lastActivity > 30000 ? 'idle' :
                  Date.now() - p.lastActivity > 60000 ? 'away' : 'active'
        }))
      }))
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  // Handle mouse movement for cursor tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const x = ((e.clientX - rect.left) / rect.width) * 100
        const y = ((e.clientY - rect.top) / rect.height) * 100
        updateCursorPosition(x, y)
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    return () => document.removeEventListener('mousemove', handleMouseMove)
  }, [updateCursorPosition])

  const getStatusColor = (status: UserPresence['status']) => {
    switch (status) {
      case 'active': return 'bg-green-500'
      case 'idle': return 'bg-yellow-500'
      case 'away': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  const formatTime = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Header Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Session Info */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{session.name}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {session.participants.length} participant{session.participants.length !== 1 ? 's' : ''} •
              {session.comments.length} comment{session.comments.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Participants Avatars */}
          <div className="flex -space-x-2">
            {session.participants.slice(0, 5).map(participant => (
              <div
                key={participant.id}
                className={`w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center text-white text-xs font-medium relative`}
                style={{ backgroundColor: participant.color }}
                title={`${participant.name} (${participant.status})`}
              >
                {participant.avatar ? (
                  <img src={participant.avatar} alt={participant.name} className="w-full h-full rounded-full" />
                ) : (
                  participant.name.charAt(0).toUpperCase()
                )}
                <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border border-white dark:border-gray-800 ${getStatusColor(participant.status)}`}></div>
              </div>
            ))}
            {session.participants.length > 5 && (
              <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 border-2 border-white dark:border-gray-800 flex items-center justify-center text-xs font-medium">
                +{session.participants.length - 5}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Comments Toggle */}
          <button
            onClick={() => setShowCommentsPanel(!showCommentsPanel)}
            className={`p-2 rounded-lg transition-colors relative ${
              showCommentsPanel
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}
          >
            <MessageCircle className="w-5 h-5" />
            {session.comments.filter(c => !c.resolved).length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {session.comments.filter(c => !c.resolved).length}
              </span>
            )}
          </button>

          {/* Invite Button */}
          <button
            onClick={() => setShowInviteDialog(true)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-600 dark:text-gray-400"
            title="Invite collaborators"
          >
            <Users className="w-5 h-5" />
          </button>

          {/* Share Button */}
          <button
            onClick={generateShareLink}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-600 dark:text-gray-400"
            title="Copy share link"
          >
            <Share className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Live Cursors Overlay */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {session.participants
          .filter(p => p.id !== currentUser.id && p.cursor.visible)
          .map(participant => (
            <div
              key={participant.id}
              className="absolute pointer-events-none"
              style={{
                left: `${participant.cursor.x}%`,
                top: `${participant.cursor.y}%`,
                transform: 'translate(-2px, -2px)'
              }}
            >
              <div
                className="w-4 h-4 rounded-full border-2 border-white shadow-lg"
                style={{ backgroundColor: participant.color }}
              ></div>
              <div
                className="px-2 py-1 rounded text-white text-xs font-medium whitespace-nowrap shadow-lg"
                style={{ backgroundColor: participant.color }}
              >
                {participant.name}
              </div>
            </div>
          ))}
      </div>

      {/* Comments Overlay */}
      {session.comments.map(comment => (
        <div
          key={comment.id}
          className="absolute pointer-events-none z-20"
          style={{
            left: `${comment.position.x}%`,
            top: `${comment.position.y}%`,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div className={`w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center ${
            comment.resolved ? 'bg-green-500' : 'bg-blue-500'
          }`}>
            {comment.resolved ? (
              <CheckCircle className="w-4 h-4 text-white" />
            ) : (
              <MessageCircle className="w-4 h-4 text-white" />
            )}
          </div>
        </div>
      ))}

      {/* Comments Panel */}
      {showCommentsPanel && (
        <div className="absolute right-4 top-20 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-30">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-gray-900 dark:text-white">Comments</h4>
              <button
                onClick={() => setShowCommentsPanel(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                ×
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto p-4 space-y-4">
            {session.comments.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No comments yet</p>
                <p className="text-sm">Right-click on the video to add a comment</p>
              </div>
            ) : (
              session.comments.map(comment => (
                <div key={comment.id} className="space-y-2">
                  <div className={`p-3 rounded-lg ${
                    comment.resolved
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700'
                      : 'bg-gray-50 dark:bg-gray-700'
                  }`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                          style={{ backgroundColor: session.participants.find(p => p.id === comment.userId)?.color || '#666' }}
                        >
                          {comment.userName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-sm text-gray-900 dark:text-white">{comment.userName}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">{formatTime(comment.timestamp)}</p>
                        </div>
                      </div>
                      {!comment.resolved && (
                        <button
                          onClick={() => resolveComment(comment.id)}
                          className="text-green-600 hover:text-green-700 text-sm"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{comment.text}</p>
                    {comment.resolved && (
                      <div className="flex items-center gap-1 mt-2 text-green-600 text-xs">
                        <CheckCircle className="w-3 h-3" />
                        Resolved
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add Comment Input */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && newComment.trim()) {
                    addComment(newComment, commentPosition || { x: 50, y: 50, time: 0 })
                  }
                }}
                placeholder="Add a comment..."
                className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={() => newComment.trim() && addComment(newComment, commentPosition || { x: 50, y: 50, time: 0 })}
                disabled={!newComment.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Dialog */}
      {showInviteDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Invite Collaborators</h2>
                <button
                  onClick={() => setShowInviteDialog(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="colleague@example.com"
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Permission Level
                  </label>
                  <select className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="editor">Can edit and comment</option>
                    <option value="commenter">Can only comment</option>
                    <option value="viewer">View only</option>
                  </select>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => inviteParticipant('colleague@example.com')}
                    className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    Send Invitation
                  </button>
                  <button
                    onClick={() => setShowInviteDialog(false)}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Activity Indicator */}
      <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-1">
            {session.participants.slice(0, 3).map(participant => (
              <div
                key={participant.id}
                className="w-6 h-6 rounded-full border border-white dark:border-gray-800 flex items-center justify-center text-white text-xs"
                style={{ backgroundColor: participant.color }}
              >
                {participant.name.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {session.participants.length} active
          </div>
        </div>
      </div>
    </div>
  )
}
