'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet, apiPut, apiDelete } from '@/lib/api'

/**
 * useDraftAutosave — server-side autosave for any editor.
 *
 * Backed by /api/drafts/:scope/:scopeId. Debounces writes (default 1.5s),
 * tracks status for a UI badge, hydrates the editor from the last
 * server-side draft on mount, and surfaces stale-revision conflicts so
 * a slow tab doesn't clobber a faster one.
 *
 * Usage (video editor):
 *
 *   const { status, lastSavedAt, hydrate, clear } = useDraftAutosave({
 *     scope: 'video',
 *     scopeId: contentId,
 *     state: renderTree,       // <-- changes trigger debounced save
 *     enabled: !!contentId,
 *   })
 *
 *   useEffect(() => { hydrate(snap => snap && setRenderTree(snap.state)) }, [])
 *
 *   // After publish: clear()  — so the draft doesn't haunt the next session.
 *
 * The state argument should be a stable reference per change (e.g. via
 * useMemo or by replacing the object on each mutation). Comparing by
 * JSON.stringify keeps the hook from saving identical state repeatedly.
 */

export type DraftScope = 'video' | 'script' | 'post'

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict'

interface UseDraftAutosaveOptions<T> {
  scope: DraftScope
  scopeId: string | null | undefined
  state: T
  enabled?: boolean
  /** Debounce window before sending the save. Defaults to 1500ms. */
  debounceMs?: number
  /** Called when the server returns a 409 stale-revision conflict. */
  onConflict?: (canonical: { state: T; revision: number; lastSavedAt: string }) => void
}

interface DraftSnapshot<T> {
  state: T
  revision: number
  lastSavedAt: Date
}

interface UseDraftAutosaveResult<T> {
  status: AutosaveStatus
  lastSavedAt: Date | null
  revision: number
  /** Read the latest server-side snapshot. Idempotent — call once on mount. */
  hydrate: (cb?: (snap: DraftSnapshot<T> | null) => void) => Promise<DraftSnapshot<T> | null>
  /** Force an immediate save, skipping the debounce. Returns when the request settles. */
  flush: () => Promise<void>
  /** Delete the server-side draft (call after publish so it doesn't re-hydrate next time). */
  clear: () => Promise<void>
}

export function useDraftAutosave<T>({
  scope,
  scopeId,
  state,
  enabled = true,
  debounceMs = 1500,
  onConflict,
}: UseDraftAutosaveOptions<T>): UseDraftAutosaveResult<T> {
  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [revision, setRevision] = useState(0)

  const lastSerializedRef = useRef<string>('')
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inflightRef = useRef<Promise<void> | null>(null)
  const mountedRef = useRef(true)

  // Track the latest values without forcing the save callback to re-bind.
  const stateRef = useRef(state)
  const revisionRef = useRef(0)
  const scopeIdRef = useRef(scopeId)
  useEffect(() => {
    stateRef.current = state
  }, [state])
  useEffect(() => {
    revisionRef.current = revision
  }, [revision])
  useEffect(() => {
    scopeIdRef.current = scopeId
  }, [scopeId])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [])

  const performSave = useCallback(async (): Promise<void> => {
    const sId = scopeIdRef.current
    if (!sId) return
    const serialized = JSON.stringify(stateRef.current ?? null)
    if (serialized === lastSerializedRef.current) return
    if (mountedRef.current) setStatus('saving')
    try {
      const resp = await apiPut<{
        data?: { revision: number; lastSavedAt: string }
        revision?: number
        lastSavedAt?: string
      }>(`/drafts/${scope}/${encodeURIComponent(sId)}`, {
        state: stateRef.current,
        revision: revisionRef.current,
      })
      const data = (resp as any)?.data ?? resp
      lastSerializedRef.current = serialized
      if (mountedRef.current) {
        if (data?.revision != null) setRevision(data.revision)
        if (data?.lastSavedAt) setLastSavedAt(new Date(data.lastSavedAt))
        setStatus('saved')
        // Fall back to idle after 2s so the badge doesn't get sticky.
        setTimeout(() => {
          if (mountedRef.current) {
            setStatus((s) => (s === 'saved' ? 'idle' : s))
          }
        }, 2000)
      }
    } catch (err: any) {
      if (!mountedRef.current) return
      const status409 = err?.response?.status === 409
      if (status409 && err?.response?.data?.canonical) {
        setStatus('conflict')
        const canonical = err.response.data.canonical
        onConflict?.({
          state: canonical.state,
          revision: canonical.revision,
          lastSavedAt: canonical.lastSavedAt,
        })
      } else {
        setStatus('error')
        // Auto-retry after a short delay — typical cause is a transient
        // network blip; the next state change will retry anyway, but a
        // standalone retry covers the "user idle but offline" case.
        setTimeout(() => {
          if (mountedRef.current && status === 'error') void performSave()
        }, 5000)
      }
    }
  }, [scope, onConflict])

  // Schedule a debounced save whenever state changes.
  useEffect(() => {
    if (!enabled || !scopeId) return
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      inflightRef.current = performSave()
    }, debounceMs)
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, enabled, scopeId, debounceMs])

  // Flush on tab close — best-effort, uses sendBeacon-style sync request.
  useEffect(() => {
    if (!enabled || !scopeId) return
    const onBeforeUnload = () => {
      // Best effort — if there's a pending change, fire-and-forget a save
      // before unload. The await isn't actually awaited, but axios will
      // queue the request.
      const serialized = JSON.stringify(stateRef.current ?? null)
      if (serialized !== lastSerializedRef.current) {
        void performSave()
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [enabled, scopeId, performSave])

  const hydrate = useCallback(
    async (cb?: (snap: DraftSnapshot<T> | null) => void): Promise<DraftSnapshot<T> | null> => {
      if (!scopeId) {
        cb?.(null)
        return null
      }
      try {
        const resp = await apiGet<{
          data?: {
            found: boolean
            state?: T
            revision?: number
            lastSavedAt?: string
          }
        }>(`/drafts/${scope}/${encodeURIComponent(scopeId)}`)
        const data = (resp as any)?.data ?? resp
        if (!data?.found) {
          cb?.(null)
          return null
        }
        const snap: DraftSnapshot<T> = {
          state: data.state as T,
          revision: data.revision ?? 0,
          lastSavedAt: new Date(data.lastSavedAt ?? Date.now()),
        }
        if (mountedRef.current) {
          setRevision(snap.revision)
          setLastSavedAt(snap.lastSavedAt)
          lastSerializedRef.current = JSON.stringify(snap.state ?? null)
        }
        cb?.(snap)
        return snap
      } catch {
        cb?.(null)
        return null
      }
    },
    [scope, scopeId]
  )

  const flush = useCallback(async (): Promise<void> => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    await performSave()
  }, [performSave])

  const clear = useCallback(async (): Promise<void> => {
    if (!scopeId) return
    try {
      await apiDelete(`/drafts/${scope}/${encodeURIComponent(scopeId)}`)
    } catch {
      // Ignore — clearing is best-effort
    }
    if (mountedRef.current) {
      setRevision(0)
      setLastSavedAt(null)
      setStatus('idle')
      lastSerializedRef.current = ''
    }
  }, [scope, scopeId])

  return { status, lastSavedAt, revision, hydrate, flush, clear }
}
