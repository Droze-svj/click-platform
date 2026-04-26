'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet, apiPost } from '../lib/api'

export type StyleFacet =
  | 'fonts'
  | 'captionStyles'
  | 'animations'
  | 'motions'
  | 'colorGrades'
  | 'transitions'
  | 'niches'
  | 'platforms'

export type StyleAverageKey =
  | 'avgCutDuration'
  | 'avgFontSize'
  | 'avgCaptionLength'
  | 'avgVideoDuration'

interface Counter { key: string; count: number; lastUsedAt?: string | Date }

export interface StyleProfile {
  fonts: Counter[]
  captionStyles: Counter[]
  animations: Counter[]
  motions: Counter[]
  colorGrades: Counter[]
  transitions: Counter[]
  niches: Counter[]
  platforms: Counter[]
  averages: Partial<Record<StyleAverageKey, number | null>>
  totalPicks: number
}

const EMPTY: StyleProfile = {
  fonts: [], captionStyles: [], animations: [], motions: [],
  colorGrades: [], transitions: [], niches: [], platforms: [],
  averages: {},
  totalPicks: 0,
}

interface PendingPick { facet: StyleFacet; key: string }
interface PendingAverage { key: StyleAverageKey; value: number }

/**
 * Reads the user's style profile on mount and exposes write helpers.
 * Writes are buffered and flushed on a short debounce so the editor can
 * call recordPick freely without spamming the API.
 */
export function useStyleProfile() {
  const [profile, setProfile] = useState<StyleProfile>(EMPTY)
  const [loaded, setLoaded] = useState(false)
  const pendingPicks = useRef<PendingPick[]>([])
  const pendingAverages = useRef<PendingAverage[]>([])
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Track mount state so async resolutions after unmount don't call setProfile.
  const mountedRef = useRef(true)

  const refresh = useCallback(async () => {
    try {
      const res = await apiGet<{ data: StyleProfile }>('/style-profile')
      const data = (res as any)?.data
      if (data && mountedRef.current) setProfile({ ...EMPTY, ...data, averages: { ...EMPTY.averages, ...(data.averages || {}) } })
    } catch {
      // Network or auth fail — keep empty profile so the UI still works
    } finally {
      if (mountedRef.current) setLoaded(true)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const flush = useCallback(async () => {
    flushTimer.current = null
    const picks = pendingPicks.current.splice(0, pendingPicks.current.length)
    const averages = pendingAverages.current.splice(0, pendingAverages.current.length)
    if (picks.length === 0 && averages.length === 0) return
    try {
      const res = await apiPost<{ data: StyleProfile }>('/style-profile/batch', { picks, averages })
      const data = (res as any)?.data
      if (data && mountedRef.current) setProfile({ ...EMPTY, ...data, averages: { ...EMPTY.averages, ...(data.averages || {}) } })
    } catch {
      // best-effort: drop on failure
    }
  }, [])

  const scheduleFlush = useCallback(() => {
    if (flushTimer.current) return
    flushTimer.current = setTimeout(flush, 800)
  }, [flush])

  const recordPick = useCallback((facet: StyleFacet, key: string) => {
    if (!key) return
    pendingPicks.current.push({ facet, key })
    // Optimistic local update so re-orderings happen immediately
    setProfile(prev => {
      const arr = prev[facet]
      const existing = arr.find(c => c.key === key)
      const nextArr = existing
        ? arr.map(c => c.key === key ? { ...c, count: c.count + 1, lastUsedAt: new Date().toISOString() } : c)
        : [...arr, { key, count: 1, lastUsedAt: new Date().toISOString() }]
      return { ...prev, [facet]: nextArr, totalPicks: prev.totalPicks + 1 }
    })
    scheduleFlush()
  }, [scheduleFlush])

  const recordAverage = useCallback((key: StyleAverageKey, value: number) => {
    if (!isFinite(value)) return
    pendingAverages.current.push({ key, value })
    setProfile(prev => {
      const cur = prev.averages?.[key]
      const next = cur == null ? value : cur * 0.7 + value * 0.3
      return { ...prev, averages: { ...prev.averages, [key]: next } }
    })
    scheduleFlush()
  }, [scheduleFlush])

  // On unmount: cancel the debounce, flush any pending writes once (fire-and-forget),
  // and mark the hook unmounted so resolved promises skip setState.
  useEffect(() => () => {
    if (flushTimer.current) { clearTimeout(flushTimer.current); flushTimer.current = null }
    flush()
    mountedRef.current = false
  }, [flush])

  /**
   * Returns a comparator that biases items the user has picked before to the
   * top of a list, while preserving the original relative order for unseen
   * items. Pass it to Array.sort on tile arrays.
   */
  const biasComparator = useCallback(<T extends { id?: string; name?: string; key?: string }>(facet: StyleFacet) => {
    const arr = profile[facet] || []
    const ranks = new Map<string, number>()
    arr.forEach((c, i) => ranks.set(c.key.toLowerCase(), arr.length - i + c.count))
    return (a: T, b: T) => {
      const ka = ((a.id || a.key || a.name || '') + '').toLowerCase()
      const kb = ((b.id || b.key || b.name || '') + '').toLowerCase()
      return (ranks.get(kb) || 0) - (ranks.get(ka) || 0)
    }
  }, [profile])

  return { profile, loaded, recordPick, recordAverage, biasComparator, refresh }
}
