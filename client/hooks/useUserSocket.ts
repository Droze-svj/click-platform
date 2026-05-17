'use client'

import { useEffect } from 'react'
import { useSocket } from './useSocket'

export interface PostStatusPayload {
  postId: string
  platform?: string
  status: 'published' | 'failed' | 'scheduled' | 'publishing'
  url?: string | null
  error?: string | null
  postedAt?: string
  dryRun?: boolean
}

export interface NotificationPayload {
  id?: string
  title?: string
  message?: string
  type?: 'success' | 'error' | 'info' | 'warning'
  link?: string
  category?: string
  createdAt?: string
}

interface UseUserSocketOptions {
  /** Fires when a scheduled post transitions to published or failed. */
  onPostStatus?: (payload: PostStatusPayload) => void
  /** Fires when a new in-app notification arrives. */
  onNotification?: (payload: NotificationPayload) => void
  /** Fires when a generated clip is ready (auto-clip flow). */
  onClipReady?: (payload: { contentId: string; clipId?: string }) => void
}

/**
 * Subscribes to per-user real-time events from the backend. The server joins
 * a `user-<userId>` socket.io room on `authenticate`, then emits events like
 * `post:status` from workers and route handlers when state changes.
 *
 * Pages that show ScheduledPost / notification state should call this hook
 * with appropriate callbacks (typically wrapped in useCallback) so the UI
 * stays in sync without manual refreshes.
 */
export function useUserSocket(userId: string | null | undefined, opts: UseUserSocketOptions = {}) {
  const { socket } = useSocket(userId || undefined)
  const { onPostStatus, onNotification, onClipReady } = opts

  useEffect(() => {
    if (!socket) return

    const handlePostStatus = (payload: PostStatusPayload) => {
      onPostStatus?.(payload)
    }
    const handleNotification = (payload: NotificationPayload) => {
      onNotification?.(payload)
    }
    const handleClipReady = (payload: { contentId: string; clipId?: string }) => {
      onClipReady?.(payload)
    }

    socket.on('post:status', handlePostStatus)
    // Server emits `notification` from notificationService.createNotification.
    socket.on('notification', handleNotification)
    socket.on('clip:ready', handleClipReady)

    return () => {
      socket.off('post:status', handlePostStatus)
      socket.off('notification', handleNotification)
      socket.off('clip:ready', handleClipReady)
    }
  }, [socket, onPostStatus, onNotification, onClipReady])
}
