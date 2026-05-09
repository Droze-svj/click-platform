'use client'

import React, { useCallback, useRef } from 'react'
import { RotateCw } from 'lucide-react'

interface Props {
  /** Current rotation in degrees. */
  rotation: number
  /** Called continuously while dragging with the new rotation in degrees. */
  onRotate: (next: number) => void
  /** Called once when the gesture ends, so callers can commit a single
   *  history entry rather than one per mousemove tick. */
  onCommit?: (final: number) => void
  /** Hide the handle (e.g. while playback is running). */
  disabled?: boolean
}

const HANDLE_SIZE = 22
const HANDLE_OFFSET_PX = 28

/**
 * RotationHandle — a circular grab handle 28px above its parent's top edge.
 * Rotates the parent element around its own center via CSS transform updates.
 *
 * Usage: render inside the element you want to rotate. The handle reads the
 * parent's bounding rect on pointer-down to compute the rotation pivot.
 */
export default function RotationHandle({ rotation, onRotate, onCommit, disabled }: Props) {
  const draggingRef = useRef(false)
  const lastAngleRef = useRef(rotation)

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return
    e.stopPropagation()
    e.preventDefault()
    const parent = e.currentTarget.parentElement as HTMLElement | null
    if (!parent) return
    draggingRef.current = true

    const rect = parent.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2

    const handleMove = (ev: PointerEvent) => {
      if (!draggingRef.current) return
      const dx = ev.clientX - cx
      const dy = ev.clientY - cy
      const radians = Math.atan2(dy, dx)
      // 0deg points up so the handle sitting above the box equals 0 rotation.
      let degrees = (radians * 180) / Math.PI + 90
      if (ev.shiftKey) {
        // Snap to 15deg increments when Shift is held.
        degrees = Math.round(degrees / 15) * 15
      }
      lastAngleRef.current = degrees
      onRotate(degrees)
    }

    const handleUp = () => {
      if (!draggingRef.current) return
      draggingRef.current = false
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      onCommit?.(lastAngleRef.current)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }, [disabled, onRotate, onCommit])

  if (disabled) return null

  return (
    <button
      type="button"
      title={`Rotate (${Math.round(rotation)}°) — hold Shift to snap to 15°`}
      aria-label="Rotate overlay"
      onPointerDown={onPointerDown}
      style={{
        position: 'absolute',
        left: '50%',
        top: -HANDLE_OFFSET_PX,
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
        transform: 'translateX(-50%)',
        cursor: 'grab',
        touchAction: 'none',
      }}
      className="z-30 rounded-full bg-indigo-600 border border-white/30 text-white shadow-lg shadow-indigo-500/40 flex items-center justify-center hover:bg-indigo-500 active:cursor-grabbing"
    >
      <RotateCw className="w-3 h-3" />
    </button>
  )
}
