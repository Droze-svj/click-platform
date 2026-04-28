import { useEffect, useState, useRef, useCallback } from 'react'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { TimelineSegment } from '../types/editor'

// y-webrtc keeps a module-level `signalingConns` Map that caches every
// SignalingConn instance for the page lifetime; the WebSockets inside
// self-reconnect indefinitely. That's why disabling the public servers via
// `signaling: []` on a NEW provider doesn't silence connections an OLDER
// provider already opened in the same JS runtime — they leak across hot
// reloads. The cleanest answer is to not load y-webrtc at all unless the
// user explicitly opts into peer sync via NEXT_PUBLIC_WEBRTC_SIGNALING.
// IndexedDB persistence below is enough for solo editing.
type WebrtcProviderClass = typeof import('y-webrtc').WebrtcProvider

export function useMultiplayerTimeline(roomId: string, initialSegments: TimelineSegment[]) {
  const [segments, setSegments] = useState<TimelineSegment[]>(initialSegments)
  const isSetupRef = useRef(false)
  const yarrayRef = useRef<Y.Array<TimelineSegment> | null>(null)
  const docRef = useRef<Y.Doc | null>(null)

  useEffect(() => {
    if (isSetupRef.current) return

    const ydoc = new Y.Doc()
    docRef.current = ydoc

    // 1. IndexedDB Offline Persistence (Local caching)
    const indexdbProvider = new IndexeddbPersistence(`click-v6-timeline-${roomId}`, ydoc)

    // 2. WebRTC P2P Sync — only enabled when signaling servers are configured.
    //    See module comment above for why we lazy-load y-webrtc.
    const signalingServers = (process.env.NEXT_PUBLIC_WEBRTC_SIGNALING || '')
      .split(',').map(s => s.trim()).filter(Boolean)
    let webrtcProvider: InstanceType<WebrtcProviderClass> | null = null
    if (signalingServers.length > 0) {
      // Lazy import so the y-webrtc module never loads in solo mode.
      import('y-webrtc').then(({ WebrtcProvider }) => {
        webrtcProvider = new WebrtcProvider(`click-v6-room-${roomId}`, ydoc, {
          signaling: signalingServers,
        })
      }).catch(() => { /* peer sync unavailable — IndexedDB still works */ })
    }

    const ySegments = ydoc.getArray<TimelineSegment>('timeline-segments')
    yarrayRef.current = ySegments

    // Load from DB or default to initial
    indexdbProvider.on('synced', () => {
      // Avoid inserting duplicates if the array is empty but we just inserted them
      if (ySegments.length === 0 && initialSegments.length > 0) {
        ydoc.transact(() => {
          // Additional safety: ensure we aren't inserting duplicate IDs
          const uniqueInitial = initialSegments.filter((seg, index, self) =>
            index === self.findIndex((s) => s.id === seg.id)
          )
          ySegments.insert(0, uniqueInitial)
        })
      }
      // Always update local state
      setSegments(ySegments.toArray())
    })

    // Listen for CRDT remote/local changes
    ySegments.observe(() => {
      setSegments(ySegments.toArray())
    })

    isSetupRef.current = true

    return () => {
      try { webrtcProvider?.destroy() } catch { /* not yet initialized */ }
      indexdbProvider.destroy()
      ydoc.destroy()
      isSetupRef.current = false
    }
  }, [roomId, initialSegments])

  const segmentsRef = useRef(segments)
  useEffect(() => {
    segmentsRef.current = segments
  }, [segments])

  /**
   * Safe transaction update for CRDTs.
   * In a complete overhaul, we would use observeDeep to do fine-grained field updates,
   * but array replacement serves the initial Phase 1 goal.
   */
  const updateSegments = useCallback((updater: TimelineSegment[] | ((prev: TimelineSegment[]) => TimelineSegment[])) => {
    if (!yarrayRef.current || !docRef.current) {
        setSegments(updater) // fallback
        return
    }

    const currentSegments = segmentsRef.current
    const newSegmentsRaw = typeof updater === 'function' ? updater(currentSegments) : updater
    
    // Safety check to ensure we don't insert duplicate IDs
    const newSegments = newSegmentsRaw.filter((seg, index, self) =>
      index === self.findIndex((s) => s.id === seg.id)
    )

    const ySegments = yarrayRef.current
    docRef.current.transact(() => {
      // Rather than a blind delete/insert which can cause flicker or duplicates in strict mode,
      // we check if they are identical references or effectively the same arrays to skip redundant updates
      if (ySegments.length === newSegments.length && JSON.stringify(ySegments.toArray()) === JSON.stringify(newSegments)) {
        return;
      }
      ySegments.delete(0, ySegments.length)
      ySegments.insert(0, newSegments)
    })
  }, [])

  return { activeSegments: segments, updateSegments }
}
