'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet, apiPut } from '../lib/api'

/**
 * Workspace personalization — the parts of the UI the user arranges themselves.
 *
 * Deliberately server-backed (UserSettings.preferences) rather than
 * localStorage: almost every existing customization in this app is local-only,
 * so a user who arranges their sidebar on a laptop finds it reset on a desktop.
 *
 * Local-first, like `usePreferences`: read the cache synchronously so the
 * sidebar paints in its arranged order on the first frame, then reconcile with
 * the server in the background and push changes back debounced.
 */

const CACHE_KEY = 'click-workspace-prefs'
const SYNC_DEBOUNCE_MS = 600
const MAX_PINS = 24

export interface WorkspacePrefs {
  /** Nav paths promoted into the always-visible part of the sidebar. Ordered. */
  pinnedNav: string[]
  /** Where the logo / "home" goes. Empty string = the dashboard home. */
  defaultLanding: string
}

const DEFAULTS: WorkspacePrefs = { pinnedNav: [], defaultLanding: '' }

function readCache(): WorkspacePrefs {
  if (typeof window === 'undefined') return DEFAULTS
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw)
    return {
      pinnedNav: Array.isArray(parsed?.pinnedNav) ? parsed.pinnedNav.filter((p: unknown) => typeof p === 'string') : [],
      defaultLanding: typeof parsed?.defaultLanding === 'string' ? parsed.defaultLanding : '',
    }
  } catch {
    return DEFAULTS
  }
}

export function useWorkspacePrefs() {
  const [prefs, setPrefs] = useState<WorkspacePrefs>(DEFAULTS)
  const [hydrated, setHydrated] = useState(false)
  // What we last pushed, so a server hydrate doesn't bounce straight back.
  const lastPushedRef = useRef<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setPrefs(readCache())
    setHydrated(true)

    // Without a token this is a guaranteed 401 on every page load.
    const hasToken = typeof localStorage !== 'undefined' && !!localStorage.getItem('token')
    if (!hasToken) return

    let cancelled = false
    apiGet<any>('/user/settings')
      .then((res: any) => {
        if (cancelled) return
        const server = res?.data?.preferences ?? res?.preferences
        if (!server || typeof server !== 'object') return
        setPrefs((prev) => {
          const next: WorkspacePrefs = {
            pinnedNav: Array.isArray(server.pinnedNav) ? server.pinnedNav : prev.pinnedNav,
            defaultLanding:
              typeof server.defaultLanding === 'string' ? server.defaultLanding : prev.defaultLanding,
          }
          lastPushedRef.current = JSON.stringify(next)
          return next
        })
      })
      .catch(() => {
        /* offline / 401 / DB down — the local cache stays authoritative */
      })

    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!hydrated) return

    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(prefs))
    } catch {
      /* private mode / quota — the in-memory state still works this session */
    }

    const desired = JSON.stringify(prefs)
    if (desired === lastPushedRef.current) return
    const hasToken = typeof localStorage !== 'undefined' && !!localStorage.getItem('token')
    if (!hasToken) return

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      // The settings route merges preferences field-by-field, so sending only
      // these two keys will not clobber language/theme/timezone.
      apiPut('/user/settings', { preferences: { ...prefs } })
        .then(() => { lastPushedRef.current = desired })
        .catch(() => { /* best effort — local cache remains the source */ })
    }, SYNC_DEBOUNCE_MS)

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [prefs, hydrated])

  const isPinned = useCallback((path: string) => prefs.pinnedNav.includes(path), [prefs.pinnedNav])

  const togglePin = useCallback((path: string) => {
    setPrefs((prev) => {
      const pinned = prev.pinnedNav.includes(path)
        ? prev.pinnedNav.filter((p) => p !== path)
        : [...prev.pinnedNav, path].slice(0, MAX_PINS)
      return { ...prev, pinnedNav: pinned }
    })
  }, [])

  const setDefaultLanding = useCallback((path: string) => {
    setPrefs((prev) => ({ ...prev, defaultLanding: path }))
  }, [])

  const reorderPins = useCallback((next: string[]) => {
    setPrefs((prev) => ({ ...prev, pinnedNav: next.slice(0, MAX_PINS) }))
  }, [])

  return { prefs, hydrated, isPinned, togglePin, setDefaultLanding, reorderPins }
}

export default useWorkspacePrefs
