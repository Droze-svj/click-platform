'use client'
/**
 * LayoutPreferencesContext — global UI density preferences for Click.
 *
 * Currently exposes a single Focus Mode toggle that:
 *   1. Sets `data-focus-mode="true"` on <html> so a single CSS rule in
 *      globals.css can de-animate decorative pulses/pings/spins across
 *      every page without per-component edits.
 *   2. Hides any element tagged with `data-focus-secondary` so dashboards
 *      can mark their non-essential panels/cards/FABs for collapse.
 *   3. Persists to localStorage under `click-layout-prefs`.
 *
 * State indicators that should keep their motion under Focus Mode (e.g.
 * the "API offline" pulsing dot) opt out via `data-keep-motion`.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

interface LayoutPrefs {
  focusMode: boolean
}

interface LayoutPreferencesValue extends LayoutPrefs {
  toggleFocusMode: () => void
  setFocusMode: (v: boolean) => void
}

const STORAGE_KEY = 'click-layout-prefs'
const DEFAULTS: LayoutPrefs = { focusMode: false }

const LayoutPreferencesContext = createContext<LayoutPreferencesValue>({
  ...DEFAULTS,
  toggleFocusMode: () => {},
  setFocusMode: () => {},
})

function applyFocusMode(on: boolean) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (on) {
    root.setAttribute('data-focus-mode', 'true')
  } else {
    root.removeAttribute('data-focus-mode')
  }
  window.dispatchEvent(new CustomEvent('click-focus-mode-change', { detail: { focusMode: on } }))
}

export function LayoutPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<LayoutPrefs>(DEFAULTS)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<LayoutPrefs>
        const next = { ...DEFAULTS, ...parsed }
        setPrefs(next)
        applyFocusMode(next.focusMode)
      }
    } catch {
      // localStorage unavailable or parse failed — stick with defaults.
    }
    setMounted(true)
  }, [])

  const persist = useCallback((next: LayoutPrefs) => {
    setPrefs(next)
    applyFocusMode(next.focusMode)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Best-effort persistence.
    }
  }, [])

  const toggleFocusMode = useCallback(() => {
    persist({ ...prefs, focusMode: !prefs.focusMode })
  }, [prefs, persist])

  const setFocusMode = useCallback((v: boolean) => {
    persist({ ...prefs, focusMode: v })
  }, [prefs, persist])

  const value: LayoutPreferencesValue = {
    ...prefs,
    toggleFocusMode,
    setFocusMode,
  }

  if (!mounted) return <>{children}</>

  return (
    <LayoutPreferencesContext.Provider value={value}>
      {children}
    </LayoutPreferencesContext.Provider>
  )
}

export function useLayoutPreferences() {
  return useContext(LayoutPreferencesContext)
}

export default LayoutPreferencesProvider
