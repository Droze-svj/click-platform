'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * useEditorDensity — picks the editor's spacing tier and persists it.
 *
 * Compact   : tighter rows, smaller fonts — for power users / dense timelines.
 * Comfortable (default) : current spacing.
 * Expanded  : larger touch targets — for mobile / mouse-light setups.
 *
 * Components opt in by reading `density` and choosing classes accordingly.
 * No global CSS changes — layout migration is incremental.
 */

export type EditorDensity = 'compact' | 'comfortable' | 'expanded'

const STORAGE_KEY = 'click-editor-density'
const VALID: EditorDensity[] = ['compact', 'comfortable', 'expanded']

export function useEditorDensity(initial: EditorDensity = 'comfortable') {
  const [density, setDensityState] = useState<EditorDensity>(initial)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const v = localStorage.getItem(STORAGE_KEY) as EditorDensity | null
      if (v && VALID.includes(v)) setDensityState(v)
    } catch { /* fall through to initial */ }
  }, [])

  const setDensity = useCallback((d: EditorDensity) => {
    setDensityState(d)
    try { localStorage.setItem(STORAGE_KEY, d) } catch {}
  }, [])

  const cycle = useCallback(() => {
    setDensityState(prev => {
      const i = VALID.indexOf(prev)
      const next = VALID[(i + 1) % VALID.length]
      try { localStorage.setItem(STORAGE_KEY, next) } catch {}
      return next
    })
  }, [])

  return { density, setDensity, cycle }
}
