import { useEffect, useState, useRef, useCallback } from 'react'
import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'
import { IndexeddbPersistence } from 'y-indexeddb'
import { TimelineSegment } from '../types/editor'

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

    // 2. WebRTC P2P Sync (Zero conflict multiplayer)
    // In production, you'd specify signaling servers here
    const webrtcProvider = new WebrtcProvider(`click-v6-room-${roomId}`, ydoc)

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
      webrtcProvider.destroy()
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
