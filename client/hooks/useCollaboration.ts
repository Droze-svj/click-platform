'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useSocket } from './useSocket'
import { useAuth } from './useAuth'

// ─────────────────────────────────────────────────────────────────────────────
// Real collaboration state for the video editor, over the shared socket.io
// connection. Companion to useMultiplayerTimeline (which owns the timeline op
// sync). This hook owns presence, remote cursors, segment locks, and live
// comments for a given content/video room.
//
// Room convention matches the server + timeline hook: `editor:${roomId}`.
//
// All socket usage is guarded — a null/disconnected socket simply yields empty
// presence (you're alone) and no-op senders. NEVER fabricates collaborators or
// comments: empty arrays mean genuinely nobody/nothing.
// ─────────────────────────────────────────────────────────────────────────────

export interface PresenceUser {
  userId: string
  name: string | null
  color: string | null
  cursor?: { x: number; y: number } | null
  lastSeen?: string
}

export interface RemoteCursor {
  userId: string
  cursor: { x: number; y: number }
}

export interface LiveComment {
  id: string
  userId: string
  userName: string | null
  text: string
  position?: any
  createdAt: string
}

export function useCollaboration(roomId: string | null | undefined) {
  const { user } = useAuth()
  const { socket, connected } = useSocket(user?.id || null)

  const [presence, setPresence] = useState<PresenceUser[]>([])
  const [remoteCursors, setRemoteCursors] = useState<Record<string, { x: number; y: number }>>({})
  const [segmentLocks, setSegmentLocks] = useState<Record<string, string | null>>({})
  const [comments, setComments] = useState<LiveComment[]>([])

  const socketRoom = roomId ? `editor:${roomId}` : null

  useEffect(() => {
    if (!socket || !connected || !roomId || !socketRoom) {
      // No live connection: honestly report being alone.
      setPresence([])
      setRemoteCursors({})
      return
    }

    // Join (timeline hook also joins; join:room is idempotent server-side —
    // socket.join + trackPresence are both safe to call again).
    socket.emit('join:room', {
      room: socketRoom,
      contentId: roomId,
      user: { id: user?.id, name: user?.name },
    })

    const onPresence = (data: { users?: PresenceUser[] }) => {
      if (!data || !Array.isArray(data.users)) return
      setPresence(data.users)
    }

    const onCursor = (data: { userId?: string; cursor?: { x: number; y: number } }) => {
      if (!data?.userId || !data.cursor) return
      if (data.userId === user?.id) return
      setRemoteCursors(prev => ({ ...prev, [data.userId as string]: data.cursor as { x: number; y: number } }))
    }

    const onLockState = (data: { segmentId?: string; lockedBy?: string | null }) => {
      if (!data?.segmentId) return
      setSegmentLocks(prev => ({ ...prev, [data.segmentId as string]: data.lockedBy ?? null }))
    }

    const onComment = (data: { userId?: string; comment?: any }) => {
      if (!data?.comment) return
      const c = data.comment
      const comment: LiveComment = {
        id: c.id || `${data.userId || 'u'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        userId: String(data.userId || c.userId || ''),
        userName: c.userName ?? c.user?.name ?? null,
        text: c.text || '',
        position: c.position,
        createdAt: c.createdAt || new Date().toISOString(),
      }
      setComments(prev => [...prev, comment])
    }

    socket.on('presence:update', onPresence)
    socket.on('cursor:update', onCursor)
    socket.on('segment:lock-state', onLockState)
    socket.on('comment:add', onComment)

    return () => {
      socket.off('presence:update', onPresence)
      socket.off('cursor:update', onCursor)
      socket.off('segment:lock-state', onLockState)
      socket.off('comment:add', onComment)
    }
  }, [socket, connected, roomId, socketRoom, user?.id, user?.name])

  const lockSegment = useCallback((segmentId: string) => {
    if (!socket || !connected || !roomId || !socketRoom) return
    try { socket.emit('segment:lock', { room: socketRoom, contentId: roomId, segmentId }) } catch { /* offline */ }
  }, [socket, connected, roomId, socketRoom])

  const unlockSegment = useCallback((segmentId: string) => {
    if (!socket || !connected || !roomId || !socketRoom) return
    try { socket.emit('segment:unlock', { room: socketRoom, contentId: roomId, segmentId }) } catch { /* offline */ }
  }, [socket, connected, roomId, socketRoom])

  const sendComment = useCallback((text: string, position?: any) => {
    const trimmed = (text || '').trim()
    if (!trimmed || !socket || !connected || !roomId || !socketRoom) return false
    try {
      socket.emit('comment:add', {
        room: socketRoom,
        contentId: roomId,
        comment: { text: trimmed, position, userName: user?.name || null },
      })
      return true
    } catch { return false }
  }, [socket, connected, roomId, socketRoom, user?.name])

  const sendPlayhead = useCallback((time: number) => {
    if (!socket || !connected || !roomId || !socketRoom) return
    try { socket.emit('playhead:update', { room: socketRoom, time }) } catch { /* offline */ }
  }, [socket, connected, roomId, socketRoom])

  // Other peers, excluding self (presence includes self from the server).
  const peers = presence.filter(p => p.userId !== user?.id)

  return {
    connected,
    currentUserId: user?.id || null,
    presence,        // full list incl. self
    peers,           // everyone but you
    remoteCursors,
    segmentLocks,
    comments,
    lockSegment,
    unlockSegment,
    sendComment,
    sendPlayhead,
  }
}
