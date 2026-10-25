'use client'

import { useCallback, useEffect, useState } from 'react'
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
 *
 * ONE store for every mounted instance. The sidebar, Settings → Appearance and
 * the onboarding wizard all use this hook at the same time; with per-instance
 * state each copy pushed its own (stale) `pinnedNav` whenever it changed
 * anything, so pinning in the sidebar and then picking a start page in
 * Settings silently reverted the pin.
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

function hasToken(): boolean {
  try {
    return typeof localStorage !== 'undefined' && !!localStorage.getItem('token')
  } catch {
    return false
  }
}

/* ── Shared store ─────────────────────────────────────────────────────────── */

type Listener = (prefs: WorkspacePrefs) => void

let current: WorkspacePrefs | null = null
const listeners = new Set<Listener>()
// What the server is known to hold, so a hydrate doesn't bounce straight back.
let lastPushed: string | null = null
let serverHydrateStarted = false
// The user changed something before the server answered — their change wins.
let changedLocally = false
let pushTimer: ReturnType<typeof setTimeout> | null = null

function publish(next: WorkspacePrefs) {
  current = next
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(next))
  } catch {
    /* private mode / quota — the in-memory state still works this session */
  }
  listeners.forEach((l) => l(next))
}

function schedulePush() {
  if (!hasToken()) return
  if (pushTimer) clearTimeout(pushTimer)
  // Deliberately NOT cleared on unmount: leaving Settings within the debounce
  // window used to drop the change on the floor.
  pushTimer = setTimeout(() => {
    pushTimer = null
    const snapshot = current ?? readCache()
    const desired = JSON.stringify(snapshot)
    if (desired === lastPushed) return
    // The settings route merges preferences field-by-field, so sending only
    // these two keys will not clobber language/theme/timezone.
    apiPut('/user/settings', { preferences: { ...snapshot } })
      .then(() => { lastPushed = desired })
      .catch(() => { /* best effort — local cache remains the source */ })
  }, SYNC_DEBOUNCE_MS)
}

function update(mutate: (prev: WorkspacePrefs) => WorkspacePrefs) {
  const prev = current ?? readCache()
  const next = mutate(prev)
  if (JSON.stringify(next) === JSON.stringify(prev)) return
  changedLocally = true
  publish(next)
  schedulePush()
}

function hydrateFromServer() {
  if (serverHydrateStarted || !hasToken()) return
  serverHydrateStarted = true
  apiGet<any>('/user/settings')
    .then((res: any) => {
      const server = res?.data?.preferences ?? res?.preferences
      if (!server || typeof server !== 'object') return
      if (changedLocally) return
      const prev = current ?? readCache()
      const next: WorkspacePrefs = {
        pinnedNav: Array.isArray(server.pinnedNav)
          ? server.pinnedNav.filter((p: unknown) => typeof p === 'string')
          : prev.pinnedNav,
        defaultLanding:
          typeof server.defaultLanding === 'string' ? server.defaultLanding : prev.defaultLanding,
      }
      lastPushed = JSON.stringify(next)
      publish(next)
    })
    .catch(() => {
      /* offline / 401 / DB down — the local cache stays authoritative */
      serverHydrateStarted = false
    })
}

/** Test helper — forget the shared store so each test starts from the cache. */
export function __resetWorkspacePrefsStore() {
  current = null
  lastPushed = null
  serverHydrateStarted = false
  changedLocally = false
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = null
  listeners.clear()
}

/* ── Hook ─────────────────────────────────────────────────────────────────── */

export function useWorkspacePrefs() {
  // DEFAULTS on the first render so server and client markup agree.
  const [prefs, setPrefs] = useState<WorkspacePrefs>(DEFAULTS)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (!current) current = readCache()
    listeners.add(setPrefs)
    setPrefs(current)
    setHydrated(true)
    hydrateFromServer()

    return () => {
      listeners.delete(setPrefs)
      // Last one out: the next mount re-reads the cache (which every change
      // was written to) and reconciles with the server again.
      if (listeners.size === 0) {
        current = null
        serverHydrateStarted = false
        changedLocally = false
      }
    }
  }, [])

  const isPinned = useCallback((path: string) => prefs.pinnedNav.includes(path), [prefs.pinnedNav])

  const togglePin = useCallback((path: string) => {
    update((prev) => ({
      ...prev,
      pinnedNav: prev.pinnedNav.includes(path)
        ? prev.pinnedNav.filter((p) => p !== path)
        : [...prev.pinnedNav, path].slice(0, MAX_PINS),
    }))
  }, [])

  const setDefaultLanding = useCallback((path: string) => {
    update((prev) => ({ ...prev, defaultLanding: path }))
  }, [])

  const reorderPins = useCallback((next: string[]) => {
    update((prev) => ({ ...prev, pinnedNav: next.slice(0, MAX_PINS) }))
  }, [])

  return { prefs, hydrated, isPinned, togglePin, setDefaultLanding, reorderPins }
}

export default useWorkspacePrefs
