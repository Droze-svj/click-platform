'use client'

import { useEffect, useRef } from 'react'

export interface UseProgrammaticKeyframeLoopOptions {
  /** Cap callback to roughly this many frames per second (e.g. 30). Omit for uncapped (60fps). */
  maxFps?: number
}

/**
 * Programmatic keyframe loop using requestAnimationFrame.
 * Use for Canvas API or custom DOM updates driven by time (e.g. animate position via rAF).
 *
 * @param callback - Called each frame with (timeSeconds, deltaSeconds). Time is relative to start.
 * @param active - When false, the loop does not run.
 * @param options - Optional: maxFps to throttle (e.g. 30) for canvas drawing.
 */
export function useProgrammaticKeyframeLoop(
  callback: (time: number, delta: number) => void,
  active: boolean = true,
  options: UseProgrammaticKeyframeLoopOptions = {}
): void {
  const { maxFps } = options
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)
  const prevRef = useRef<number | null>(null)
  const minInterval = maxFps != null && maxFps > 0 ? 1000 / maxFps : 0
  const lastTickRef = useRef(0)

  useEffect(() => {
    if (!active) return

    startRef.current = null
    prevRef.current = null
    lastTickRef.current = 0

    const tick = (now: number) => {
      if (startRef.current == null) {
        startRef.current = now
        prevRef.current = now
        lastTickRef.current = now
      }
      if (minInterval > 0 && now - lastTickRef.current < minInterval) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      lastTickRef.current = now
      const time = (now - startRef.current) / 1000
      const delta = (now - (prevRef.current ?? now)) / 1000
      prevRef.current = now
      callback(time, delta)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [active, minInterval, callback])
}
