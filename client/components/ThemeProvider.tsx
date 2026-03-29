'use client'
/**
 * ThemeProvider — Click Platform Theme System
 * - Detects system preference on first load
 * - Persists choice in localStorage
 * - Listens for system changes live
 * - Provides useTheme() hook to any component
 * - Applies 'dark' class to <html> for Tailwind dark: utilities
 * - Emits a 'click-theme-change' event for non-React consumers
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

type Theme = 'dark' | 'light' | 'system'
type ResolvedTheme = 'dark' | 'light'

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (t: Theme) => void
  toggle: () => void
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  resolvedTheme: 'dark',
  setTheme: () => {},
  toggle: () => {},
  isDark: true,
})

const STORAGE_KEY = 'click-theme'

function getSystemPreference(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement
  if (resolved === 'dark') {
    root.classList.add('dark')
    root.classList.remove('light')
    root.setAttribute('data-theme', 'dark')
    root.style.colorScheme = 'dark'
  } else {
    root.classList.remove('dark')
    root.classList.add('light')
    root.setAttribute('data-theme', 'light')
    root.style.colorScheme = 'light'
  }
  // Notify non-React consumers
  window.dispatchEvent(new CustomEvent('click-theme-change', { detail: { resolved } }))
}

export function ThemeProvider({ children, defaultTheme = 'dark' }: { children: React.ReactNode; defaultTheme?: Theme }) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('dark')
  const [mounted, setMounted] = useState(false)

  // Resolve and apply
  const resolve = useCallback((t: Theme): ResolvedTheme => {
    return t === 'system' ? getSystemPreference() : t
  }, [])

  // Init from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    const initial: Theme = stored || defaultTheme
    const resolved = resolve(initial)
    setThemeState(initial)
    setResolvedTheme(resolved)
    applyTheme(resolved)
    setMounted(true)
  }, [defaultTheme, resolve])

  // Listen for system preference changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (theme === 'system') {
        const resolved = getSystemPreference()
        setResolvedTheme(resolved)
        applyTheme(resolved)
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    const resolved = resolve(t)
    setResolvedTheme(resolved)
    applyTheme(resolved)
    localStorage.setItem(STORAGE_KEY, t)
  }, [resolve])

  const toggle = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }, [resolvedTheme, setTheme])

  const value: ThemeContextValue = { theme, resolvedTheme, setTheme, toggle, isDark: resolvedTheme === 'dark' }

  // Prevent flash by not rendering until mounted
  if (!mounted) return <>{children}</>

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

// Default export for convenient named import in layout
export default ThemeProvider

