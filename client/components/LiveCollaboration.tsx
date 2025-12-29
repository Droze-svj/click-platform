'use client'

import { useState, useEffect, useRef } from 'react'
import { useSocket } from '../hooks/useSocket'
import { useAuth } from '../hooks/useAuth'
import { useRouter } from 'next/navigation'

interface Collaborator {
  userId: string
  name?: string
  cursor?: {
    x: number
    y: number
  }
  lastSeen: string
}

interface LiveCollaborationProps {
  contentId: string
  onContentChange?: (change: any) => void
}

export default function LiveCollaboration({ contentId, onContentChange }: LiveCollaborationProps) {
  const { user } = useAuth()
  const router = useRouter()
  const { socket, connected } = useSocket(user?.id || null)
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const cursorTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!socket || !connected || !contentId) return

    const room = `content:${contentId}`
    
    // Join content room
    socket.emit('join:room', { room, contentId })

    // Listen for presence updates
    socket.on('presence:update', (data: { users: Collaborator[] }) => {
      setCollaborators(data.users.filter(u => u.userId !== user?.id))
    })

    // Listen for content changes
    socket.on('content:change', (data: { change: any, userId: string }) => {
      if (data.userId !== user?.id) {
        onContentChange?.(data.change)
      }
    })

    // Listen for typing indicators
    socket.on('user:typing', (data: { userId: string, isTyping: boolean }) => {
      if (data.userId !== user?.id) {
        setTypingUsers(prev => {
          const next = new Set(prev)
          if (data.isTyping) {
            next.add(data.userId)
          } else {
            next.delete(data.userId)
          }
          return next
        })
      }
    })

    // Track cursor movement
    const handleMouseMove = (e: MouseEvent) => {
      if (socket && connected) {
        socket.emit('cursor:update', {
          room,
          cursor: { x: e.clientX, y: e.clientY }
        })

        // Clear previous timeout
        if (cursorTimeoutRef.current) {
          clearTimeout(cursorTimeoutRef.current)
        }

        // Update cursor every 100ms
        cursorTimeoutRef.current = setTimeout(() => {
          socket.emit('cursor:update', {
            room,
            cursor: { x: e.clientX, y: e.clientY }
          })
        }, 100)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)

    // Cleanup
    return () => {
      socket.emit('leave:room', { room })
      socket.off('presence:update')
      socket.off('content:change')
      socket.off('user:typing')
      window.removeEventListener('mousemove', handleMouseMove)
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current)
      }
    }
  }, [socket, connected, contentId, user?.id, onContentChange])

  const handleTyping = () => {
    if (!socket || !connected || !contentId) return

    setIsTyping(true)
    socket.emit('typing:start', { contentId })

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Stop typing indicator after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false)
      socket.emit('typing:stop', { contentId })
    }, 3000)
  }

  const broadcastContentChange = (change: any) => {
    if (!socket || !connected || !contentId) return
    socket.emit('content:change', { contentId, change })
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Collaborators List */}
      {collaborators.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 mb-2 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              {collaborators.length} {collaborators.length === 1 ? 'person' : 'people'} viewing
            </span>
          </div>
          <div className="flex gap-2">
            {collaborators.slice(0, 5).map((collaborator) => (
              <div
                key={collaborator.userId}
                className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-semibold"
                title={collaborator.name || 'Collaborator'}
              >
                {(collaborator.name || 'U')[0].toUpperCase()}
              </div>
            ))}
            {collaborators.length > 5 && (
              <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 flex items-center justify-center text-xs font-semibold">
                +{collaborators.length - 5}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Typing Indicator */}
      {typingUsers.size > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 mb-2 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {Array.from(typingUsers).length} {Array.from(typingUsers).length === 1 ? 'person' : 'people'} typing...
          </p>
        </div>
      )}

      {/* Connection Status */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {connected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>
    </div>
  )
}

// Export helper for content changes
export function useContentBroadcast(contentId: string) {
  const { socket, connected } = useSocket()

  const broadcastChange = (change: any) => {
    if (socket && connected && contentId) {
      socket.emit('content:change', { contentId, change })
    }
  }

  return { broadcastChange, connected }
}

