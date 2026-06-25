// Live transition preview — approximate the export xfade on the editor canvas
// with a CSS effect overlay. The "which transition is active at time t" logic is
// PURE (testable); transitionOverlayStyle maps it to a CSS effect. This is a
// HINT of the transition's style + timing, not a pixel-exact compositor.

import type { CSSProperties } from 'react'
import type { SegmentTransitionType, TimelineSegment } from '../types/editor'

export interface ActiveTransition {
  type: SegmentTransitionType
  progress: number // 0 → 1 across the transition window
  segmentId: string
}

/**
 * PURE: the transition active at `currentTime`, if any. A segment's transition
 * plays in the window [endTime - transitionDuration, endTime] (into the next clip).
 */
export function activeTransitionAt(segments: TimelineSegment[] | undefined, currentTime: number): ActiveTransition | null {
  const t = Number(currentTime)
  if (!Array.isArray(segments) || !Number.isFinite(t)) return null
  for (const s of segments) {
    if (!s || s.type !== 'video') continue
    const dur = Number(s.transitionDuration)
    const out = s.transitionOut
    if (!out || out === 'none' || !(dur > 0)) continue
    const end = Number(s.endTime)
    if (!Number.isFinite(end)) continue
    const start = end - dur
    if (t >= start && t <= end) {
      return { type: out, progress: Math.max(0, Math.min(1, (t - start) / dur)), segmentId: s.id }
    }
  }
  return null
}

/** PURE: CSS for the transition overlay at a given progress (0→1). */
export function transitionOverlayStyle(type: SegmentTransitionType, progress: number): CSSProperties {
  const p = Math.max(0, Math.min(1, Number(progress) || 0))
  const bell = Math.sin(p * Math.PI) // 0 → 1 → 0, peaks mid-transition
  const base: CSSProperties = { position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 40 }

  switch (type) {
    case 'flash':
      return { ...base, background: '#fff', opacity: bell * 0.85 }
    case 'dip':
      return { ...base, background: '#000', opacity: bell }
    case 'crossfade':
    case 'dissolve':
      return { ...base, background: '#000', opacity: bell * 0.55 }
    case 'wipe-left':
      return { ...base, background: '#000', clipPath: `inset(0 ${100 - p * 100}% 0 0)` }
    case 'wipe-right':
      return { ...base, background: '#000', clipPath: `inset(0 0 0 ${100 - p * 100}%)` }
    case 'wipe-up':
      return { ...base, background: '#000', clipPath: `inset(${100 - p * 100}% 0 0 0)` }
    case 'wipe-down':
      return { ...base, background: '#000', clipPath: `inset(0 0 ${100 - p * 100}% 0)` }
    case 'slide-up':
    case 'whip-right':
      return { ...base, background: '#000', transform: `translateY(${(1 - p) * 100}%)` }
    case 'slide-down':
    case 'whip-left':
      return { ...base, background: '#000', transform: `translateY(${-(1 - p) * 100}%)` }
    case 'zoom':
    case 'iris':
    case 'radial':
      return { ...base, background: 'radial-gradient(circle, transparent 0%, #000 100%)', opacity: bell * 0.7 }
    case 'glitch':
      return { ...base, background: '#0ff', opacity: bell * 0.35, mixBlendMode: 'difference' as CSSProperties['mixBlendMode'] }
    default:
      return { ...base, background: '#000', opacity: bell * 0.5 }
  }
}
