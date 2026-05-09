'use client'

import { useEffect, useRef, useState } from 'react'

export interface ContainerSize {
  width: number
  height: number
}

/**
 * Observes the size of a DOM element and returns its current width/height.
 * SSR-safe: returns {0,0} until mounted. Throttles to animation frames so
 * downstream layout reflows don't stall on rapid resize events.
 */
export function useResizeObserver<T extends HTMLElement = HTMLDivElement>(): {
  ref: React.RefObject<T>
  size: ContainerSize
} {
  const ref = useRef<T>(null)
  const [size, setSize] = useState<ContainerSize>({ width: 0, height: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return

    let frame = 0
    const ro = new ResizeObserver((entries) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const entry = entries[0]
        if (!entry) return
        const cr = entry.contentRect
        setSize((prev) =>
          prev.width === cr.width && prev.height === cr.height
            ? prev
            : { width: cr.width, height: cr.height }
        )
      })
    })

    ro.observe(el)
    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
    }
  }, [])

  return { ref, size }
}

export default useResizeObserver
