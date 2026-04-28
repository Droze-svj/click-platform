'use client'

import { useEffect, useRef } from 'react'

/**
 * Professional editor shortcuts — additive layer that brings JKL transport,
 * in/out points, split, ripple delete, and zoom into the timeline without
 * touching ModernVideoEditor's existing keyboard wiring.
 *
 * Bindings (when no input/contenteditable is focused):
 *   J        rewind 1× (each press doubles up to 4×)
 *   K        pause / cancel JKL
 *   L        forward 1× (each press doubles up to 4×)
 *   Space    toggle play
 *   Left     -1 frame (~1/30s) · Shift+Left -1s
 *   Right    +1 frame · Shift+Right +1s
 *   Home     jump to 0
 *   End      jump to videoDuration
 *   I        set in-point at playhead
 *   O        set out-point at playhead
 *   S        split selected/intersecting segment(s) at playhead
 *   X        ripple delete selected segments (close the gap)
 *   ⌘/Ctrl+= zoom in   ·  ⌘/Ctrl+- zoom out  ·  ⌘/Ctrl+0 zoom reset
 *
 * The caller passes the editor's actions; this hook only translates key
 * events. Dependencies are stable refs so re-renders don't re-bind.
 */

export interface EditorShortcutActions {
  getCurrentTime: () => number
  getDuration: () => number
  seek: (time: number) => void
  togglePlay: () => void
  setPlaybackRate: (rate: number) => void
  setInPoint?: (time: number) => void
  setOutPoint?: (time: number) => void
  splitAtPlayhead?: () => void
  rippleDeleteSelected?: () => void
  zoomBy?: (delta: number) => void  // positive = in, negative = out
  resetZoom?: () => void
}

const FRAME = 1 / 30

function isTextEntryFocused(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if ((el as HTMLElement).isContentEditable) return true
  return false
}

export function useEditorShortcuts(actions: EditorShortcutActions, enabled: boolean = true) {
  const actionsRef = useRef(actions)
  useEffect(() => { actionsRef.current = actions }, [actions])

  // JKL state — each press of J/L past the first doubles the rate.
  const jklRateRef = useRef(0)

  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (isTextEntryFocused()) return
      const a = actionsRef.current

      // ⌘/Ctrl combos: zoom only.
      if (e.metaKey || e.ctrlKey) {
        if (e.key === '=' || e.key === '+') { e.preventDefault(); a.zoomBy?.(1); return }
        if (e.key === '-' || e.key === '_') { e.preventDefault(); a.zoomBy?.(-1); return }
        if (e.key === '0') { e.preventDefault(); a.resetZoom?.(); return }
        return
      }

      // Don't intercept when other modifiers are pressed.
      if (e.altKey) return

      const k = e.key.toLowerCase()
      switch (k) {
        case ' ':
        case 'spacebar':
          e.preventDefault()
          jklRateRef.current = 0
          a.togglePlay()
          return
        case 'j':
          e.preventDefault()
          jklRateRef.current = jklRateRef.current >= 0 ? -1 : Math.max(-8, jklRateRef.current * 2)
          a.setPlaybackRate(jklRateRef.current)
          return
        case 'k':
          e.preventDefault()
          jklRateRef.current = 0
          a.setPlaybackRate(0)
          return
        case 'l':
          e.preventDefault()
          jklRateRef.current = jklRateRef.current <= 0 ? 1 : Math.min(8, jklRateRef.current * 2)
          a.setPlaybackRate(jklRateRef.current)
          return
        case 'arrowleft': {
          e.preventDefault()
          const step = e.shiftKey ? 1 : FRAME
          a.seek(Math.max(0, a.getCurrentTime() - step))
          return
        }
        case 'arrowright': {
          e.preventDefault()
          const step = e.shiftKey ? 1 : FRAME
          a.seek(Math.min(a.getDuration(), a.getCurrentTime() + step))
          return
        }
        case 'home': e.preventDefault(); a.seek(0); return
        case 'end':  e.preventDefault(); a.seek(a.getDuration()); return
        case 'i':
          if (e.shiftKey) return  // Shift+I reserved
          e.preventDefault(); a.setInPoint?.(a.getCurrentTime()); return
        case 'o':
          if (e.shiftKey) return
          e.preventDefault(); a.setOutPoint?.(a.getCurrentTime()); return
        case 's':
          if (e.shiftKey) return
          e.preventDefault(); a.splitAtPlayhead?.(); return
        case 'x':
          if (e.shiftKey) return
          e.preventDefault(); a.rippleDeleteSelected?.(); return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}

/**
 * Magnetic snap — given a candidate time, snap to the nearest stop within
 * `tolerance` seconds. Stops typically include playhead, 0, duration, clip
 * edges, and markers. Returns the snapped time (or input if no stop is close).
 */
export function snapTime(candidate: number, stops: number[], tolerance: number = 0.08): number {
  let best = candidate
  let bestDist = tolerance
  for (const s of stops) {
    const d = Math.abs(s - candidate)
    if (d < bestDist) { bestDist = d; best = s }
  }
  return best
}
