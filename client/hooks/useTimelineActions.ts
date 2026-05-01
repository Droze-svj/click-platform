/**
 * useTimelineActions — bridges the pure applySuggestion() dispatcher
 * with the editor's React state, including a one-step undo stack.
 *
 * The editor's existing `history` state is currently unused (handleUndo/
 * handleRedo are stubs in ModernVideoEditor). This hook owns its own
 * minimal undo so an "Apply All" can be reverted in one click without
 * needing to wire the full editor history graph.
 *
 * NOT to be confused with useCreatorPipeline — that's the autonomous
 * full-run flow. Suggestion-apply is a synchronous, per-click operation.
 */

import { useCallback, useRef, useState } from 'react'
import type { AIDirectorSuggestion, TimelineSegment, TextOverlay } from '../types/editor'
import { applySuggestion, applyAllSuggestions, type ApplySuggestionContext } from '../utils/applySuggestion'

export interface UseTimelineActionsArgs {
  segments: TimelineSegment[]
  setSegments: (next: TimelineSegment[] | ((prev: TimelineSegment[]) => TimelineSegment[])) => void
  textOverlays: TextOverlay[]
  setTextOverlays: (next: TextOverlay[] | ((prev: TextOverlay[]) => TextOverlay[])) => void
  duration: number
  /** Toast callback — kept generic so the hook is usable from any host. */
  showToast?: (msg: string, kind?: 'success' | 'info' | 'error') => void
}

interface HistorySnapshot {
  segments: TimelineSegment[]
  textOverlays: TextOverlay[]
  description: string
}

export function useTimelineActions(args: UseTimelineActionsArgs) {
  const { segments, setSegments, textOverlays, setTextOverlays, duration, showToast } = args
  const [appliedIds, setAppliedIds] = useState<Set<string>>(() => new Set())
  const [lastAppliedAt, setLastAppliedAt] = useState<number | null>(null)
  const undoStack = useRef<HistorySnapshot[]>([])

  const ctx: ApplySuggestionContext = { segments, textOverlays, duration }

  const snapshot = useCallback((description: string): HistorySnapshot => ({
    segments: segments.slice(),
    textOverlays: textOverlays.slice(),
    description,
  }), [segments, textOverlays])

  const apply = useCallback((s: AIDirectorSuggestion) => {
    const before = snapshot(`Before: ${s.label || s.type}`)
    const result = applySuggestion(s, { segments, textOverlays, duration })
    if (!result.changed) {
      showToast?.(result.description, 'info')
      return false
    }
    undoStack.current.push(before)
    if (undoStack.current.length > 20) undoStack.current.shift()
    setSegments(result.segments)
    setTextOverlays(result.textOverlays)
    setAppliedIds(prev => {
      const next = new Set(prev)
      next.add(s.id)
      return next
    })
    setLastAppliedAt(Date.now())
    showToast?.(result.description, 'success')
    return true
  }, [segments, textOverlays, duration, snapshot, setSegments, setTextOverlays, showToast])

  const applyAll = useCallback((list: AIDirectorSuggestion[]) => {
    const fresh = list.filter(s => !appliedIds.has(s.id))
    if (fresh.length === 0) {
      showToast?.('All suggestions already applied', 'info')
      return { applied: 0, skipped: list.length }
    }
    const before = snapshot(`Before: Apply All (${fresh.length})`)
    const result = applyAllSuggestions(fresh, { segments, textOverlays, duration })
    if (!result.changed) {
      showToast?.('Nothing to apply', 'info')
      return { applied: 0, skipped: fresh.length }
    }
    undoStack.current.push(before)
    if (undoStack.current.length > 20) undoStack.current.shift()
    setSegments(result.segments)
    setTextOverlays(result.textOverlays)
    setAppliedIds(prev => {
      const next = new Set(prev)
      for (const id of result.applied) next.add(id)
      return next
    })
    setLastAppliedAt(Date.now())
    showToast?.(result.description, 'success')
    return { applied: result.applied.length, skipped: result.skipped.length }
  }, [segments, textOverlays, duration, appliedIds, snapshot, setSegments, setTextOverlays, showToast])

  const undoLastApply = useCallback(() => {
    const last = undoStack.current.pop()
    if (!last) {
      showToast?.('Nothing to undo', 'info')
      return false
    }
    setSegments(last.segments)
    setTextOverlays(last.textOverlays)
    showToast?.(`Undone: ${last.description}`, 'info')
    return true
  }, [setSegments, setTextOverlays, showToast])

  const reset = useCallback(() => {
    setAppliedIds(new Set())
    undoStack.current = []
    setLastAppliedAt(null)
  }, [])

  return {
    apply,
    applyAll,
    undoLastApply,
    reset,
    appliedIds,
    lastAppliedAt,
    canUndo: undoStack.current.length > 0,
  }
}
