'use client'

import { useState, useEffect, useRef } from 'react'
import { Users, MessageSquare, Loader2 } from 'lucide-react'
import { useSocket } from '../hooks/useSocket'
import { useToast } from '../contexts/ToastContext'
import { useTranslation } from '@/hooks/useTranslation'

interface ActiveUser {
  userId: string
  name: string
  cursor?: { line: number; column: number }
}

interface RealtimeCollaborationProps {
  contentId: string
  onContentChange?: (content: string) => void
}

export default function RealtimeCollaboration({
  contentId,
  onContentChange,
}: RealtimeCollaborationProps) {
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const socket = useSocket()
  const { showToast } = useToast()
  const { t } = useTranslation()
  const contentRef = useRef<string>('')

  useEffect(() => {
    if (!socket || !contentId) return

    // Join session
    joinSession()

    // Socket event listeners
    socket.on('collaboration:user-joined', handleUserJoined)
    socket.on('collaboration:user-left', handleUserLeft)
    socket.on('collaboration:cursor-update', handleCursorUpdate)
    socket.on('collaboration:content-change', handleContentChange)
    socket.on('collaboration:comment', handleComment)
    socket.on('connect', () => setIsConnected(true))
    socket.on('disconnect', () => setIsConnected(false))

    return () => {
      leaveSession()
      socket.off('collaboration:user-joined')
      socket.off('collaboration:user-left')
      socket.off('collaboration:cursor-update')
      socket.off('collaboration:content-change')
      socket.off('collaboration:comment')
      socket.off('connect')
      socket.off('disconnect')
    }
    // Handlers and joinSession/leaveSession close over stable values; converting
    // them all to useCallback with their full dep set would create a cycle with
    // the activeUsers state they update. Effect should only re-run when the
    // socket or contentId changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, contentId])

  const joinSession = async () => {
    if (!socket) return

    setIsJoining(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/collaboration/realtime/${contentId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Socket-ID': socket.socket?.id || ''
        },
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setActiveUsers(data.data.activeUsers || [])
        setIsConnected(true)
      }
    } catch (error) {
      console.error('Failed to join session:', error)
      showToast(t('realtimeCollaboration.failedToJoin'), 'error')
    } finally {
      setIsJoining(false)
    }
  }

  const leaveSession = async () => {
    if (!socket) return

    try {
      const token = localStorage.getItem('token')
      await fetch(`/api/collaboration/realtime/${contentId}/leave`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include'
      })
    } catch (error) {
      console.error('Failed to leave session:', error)
    }
  }

  const handleUserJoined = (data: { userId: string; activeUsers: string[] }) => {
    setActiveUsers(prev => {
      const newUsers = [...prev]
      if (!newUsers.find(u => u.userId === data.userId)) {
        newUsers.push({ userId: data.userId, name: 'User' })
      }
      return newUsers
    })
    showToast(t('realtimeCollaboration.userJoined'), 'info')
  }

  const handleUserLeft = (data: { userId: string; activeUsers: string[] }) => {
    setActiveUsers(prev => prev.filter(u => u.userId !== data.userId))
    showToast(t('realtimeCollaboration.userLeft'), 'info')
  }

  const handleCursorUpdate = (data: { userId: string; cursor: any }) => {
    setActiveUsers(prev =>
      prev.map(u =>
        u.userId === data.userId ? { ...u, cursor: data.cursor } : u
      )
    )
  }

  const handleContentChange = (data: { change: any; version: number }) => {
    // Apply change to local content
    if (onContentChange && data.change.content) {
      contentRef.current = data.change.content
      onContentChange(data.change.content)
    }
  }

  const handleComment = (data: { comment: any }) => {
    showToast(t('realtimeCollaboration.newComment', { text: data.comment.text }), 'info')
  }

  const sendContentChange = async (operation: string, change: any) => {
    if (!socket) return

    try {
      const token = localStorage.getItem('token')
      await fetch(`/api/collaboration/realtime/${contentId}/change`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify({
          operation,
          ...change
        })
      })
    } catch (error) {
      console.error('Failed to send content change:', error)
    }
  }

  const updateCursor = async (cursor: { line: number; column: number }) => {
    if (!socket) return

    try {
      const token = localStorage.getItem('token')
      await fetch(`/api/collaboration/realtime/${contentId}/cursor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify(cursor)
      })
    } catch (error) {
      console.error('Failed to update cursor:', error)
    }
  }

  if (isJoining) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>{t('realtimeCollaboration.joiningSession')}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {isConnected ? t('realtimeCollaboration.connected') : t('realtimeCollaboration.disconnected')}
        </span>
      </div>

      {activeUsers.length > 0 && (
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {activeUsers.length === 1
              ? t('realtimeCollaboration.usersEditing', { count: activeUsers.length })
              : t('realtimeCollaboration.usersEditing_plural', { count: activeUsers.length })}
          </span>
        </div>
      )}
    </div>
  )
}






