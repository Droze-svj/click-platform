import { useEffect, useState, useRef, useCallback } from 'react'
import { TimelineSegment } from '../types/editor'
import { useSocket } from './useSocket'
import { useAuth } from './useAuth'

// ─────────────────────────────────────────────────────────────────────────────
// Real-time timeline sync over the shared socket.io connection.
//
// Design (replaces the old Yjs + y-webrtc path, which only ever synced when
// NEXT_PUBLIC_WEBRTC_SIGNALING was set — i.e. never in practice):
//   • Local React state is the source of truth.
//   • updateSegments() mutates local state AND broadcasts a `timeline:op`
//     (array-replace) to the room with a monotonically increasing version.
//   • Remote `timeline:op` is applied ONLY if version > lastAppliedVersion
//     (stale ops dropped) and behind an "applying remote" guard so applying a
//     remote op never re-broadcasts (no echo loop).
//   • Solo behaviour is identical to plain useState: if there's no socket /
//     no peers, this is just local state. Everything is guarded so a null or
//     disconnected socket never throws.
//
// Offline/solo persistence is intentionally NOT handled here anymore — the
// editor's useVideoEditorAutosave already persists timelineSegments, so the
// IndexedDB (Yjs) cache was redundant. Dropping it removes the leaky
// y-webrtc dependency entirely.
//
// The same call site `useMultiplayerTimeline(roomId, initialSegments)` and the
// same return shape `{ activeSegments, updateSegments }` are preserved; extra
// return fields are additive.
// ─────────────────────────────────────────────────────────────────────────────

type SegmentsUpdater =
  | TimelineSegment[]
  | ((prev: TimelineSegment[]) => TimelineSegment[])

interface TimelineOp {
  kind: 'segments:replace'
  segments: TimelineSegment[]
}

export function useMultiplayerTimeline(roomId: string, initialSegments: TimelineSegment[]) {
  const { user } = useAuth()
  const { socket, connected } = useSocket(user?.id || null)

  const [segments, setSegments] = useState<TimelineSegment[]>(initialSegments)

  // Keep a ref to current segments so callbacks stay stable.
  const segmentsRef = useRef(segments)
  useEffect(() => { segmentsRef.current = segments }, [segments])

  // Version bookkeeping. localVersion is what we've emitted; lastAppliedVersion
  // is the highest version we've accepted (local or remote) — used to drop
  // stale remote ops.
  const localVersionRef = useRef(0)
  const lastAppliedVersionRef = useRef(0)
  // Guard so applying a remote op doesn't re-broadcast.
  const applyingRemoteRef = useRef(false)

  const socketRoom = `editor:${roomId}`

  // Join the collaboration room on mount / when socket becomes available.
  useEffect(() => {
    if (!socket || !connected || !roomId) return

    const join = () => {
      socket.emit('join:room', {
        room: socketRoom,
        contentId: roomId,
        user: { id: user?.id, name: user?.name },
      })
    }
    join()

    // Apply remote timeline ops.
    const onTimelineOp = (data: { userId?: string; op?: TimelineOp; version?: number }) => {
      if (!data || !data.op) return
      if (data.userId && data.userId === user?.id) return // never apply our own
      const version = typeof data.version === 'number' ? data.version : 0
      if (version <= lastAppliedVersionRef.current) return // drop stale
      if (data.op.kind !== 'segments:replace' || !Array.isArray(data.op.segments)) return

      lastAppliedVersionRef.current = version
      // Keep our local emit counter ahead of accepted remote versions so our
      // next local edit supersedes this one.
      if (version > localVersionRef.current) localVersionRef.current = version

      applyingRemoteRef.current = true
      setSegments(data.op.segments)
      // Release the guard after the state update flushes.
      queueMicrotask(() => { applyingRemoteRef.current = false })
    }

    socket.on('timeline:op', onTimelineOp)

    return () => {
      socket.off('timeline:op', onTimelineOp)
      try { socket.emit('leave:room', { room: socketRoom }) } catch { /* socket gone */ }
    }
  }, [socket, connected, roomId, socketRoom, user?.id, user?.name])

  const updateSegments = useCallback((updater: SegmentsUpdater) => {
    const prev = segmentsRef.current
    const next = typeof updater === 'function' ? (updater as (p: TimelineSegment[]) => TimelineSegment[])(prev) : updater

    // Always update local state — local state is the source of truth.
    setSegments(next)
    segmentsRef.current = next

    // Do not broadcast while applying a remote op (prevents echo loops).
    if (applyingRemoteRef.current) return

    // Broadcast to peers (best-effort; guarded for null/disconnected socket).
    if (socket && connected && roomId) {
      const version = ++localVersionRef.current
      lastAppliedVersionRef.current = version
      try {
        socket.emit('timeline:op', {
          room: socketRoom,
          contentId: roomId,
          op: { kind: 'segments:replace', segments: next } as TimelineOp,
          version,
        })
      } catch { /* socket unavailable — local state already updated */ }
    }
  }, [socket, connected, roomId, socketRoom])

  return { activeSegments: segments, updateSegments }
}
