'use client'

// Public-landing personalization theme. Deliberately self-contained (does NOT
// use the dashboard-only WorkflowContext) so it's safe on the marketing pages.
//
// A visitor's chosen niche re-tints the landing via ACCENT_PALETTES class
// strings from swarmTheme.ts. With no niche selected the accent resolves to
// `coach` (indigo) — i.e. the landing looks exactly as it does today, so the
// personalization is purely additive and regression-free.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  ACCENT_PALETTES, resolveAccentKey, type AccentClasses, type AccentKey,
} from '../../lib/swarmTheme'

const STORAGE_KEY = 'click.landing_niche'

interface LandingThemeValue {
  niche: string | null
  setNiche: (niche: string | null) => void
  accentKey: AccentKey
  accent: AccentClasses
}

const LandingThemeContext = createContext<LandingThemeValue | null>(null)

export function LandingThemeProvider({ children }: { children: React.ReactNode }) {
  const [niche, setNicheState] = useState<string | null>(null)

  // Hydrate from localStorage after mount (SSR-safe).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setNicheState(saved)
    } catch { /* storage unavailable */ }
  }, [])

  const setNiche = useCallback((next: string | null) => {
    setNicheState(next)
    try {
      if (next) localStorage.setItem(STORAGE_KEY, next)
      else localStorage.removeItem(STORAGE_KEY)
    } catch { /* storage unavailable */ }
  }, [])

  const accentKey = resolveAccentKey(niche, 'coach')

  // Reflect on <html> for any CSS-var ambient hooks (the visible accent comes
  // from the palette class strings below, not from this attribute).
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.setAttribute('data-niche', accentKey)
    return () => { document.documentElement.removeAttribute('data-niche') }
  }, [accentKey])

  const value = useMemo<LandingThemeValue>(() => ({
    niche,
    setNiche,
    accentKey,
    accent: ACCENT_PALETTES[accentKey],
  }), [niche, setNiche, accentKey])

  return <LandingThemeContext.Provider value={value}>{children}</LandingThemeContext.Provider>
}

/**
 * Access the landing accent. Safe to call outside the provider — it falls back
 * to the default (coach/indigo) palette so individual sections never crash if
 * rendered standalone.
 */
export function useLandingTheme(): LandingThemeValue {
  const ctx = useContext(LandingThemeContext)
  if (ctx) return ctx
  const accentKey = resolveAccentKey(null, 'coach')
  return { niche: null, setNiche: () => {}, accentKey, accent: ACCENT_PALETTES[accentKey] }
}
