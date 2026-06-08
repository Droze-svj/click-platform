'use client'

/**
 * useEntitlements — the CLIENT mirror of the server's canonical entitlements
 * (server/config/entitlements.js, served by GET /api/me/entitlements).
 *
 * This hook NEVER invents tier/feature/limit data. It reads the resolved
 * per-user view from the API and exposes ergonomic lookups so any component
 * can ask "does this user have feature X?" or "what's their limit for Y?".
 *
 * Design mirrors useAuth.ts:
 *   - module-level cache + in-flight dedupe so N components share ONE fetch
 *   - ~60s cache TTL (entitlements change rarely — only on upgrade/downgrade)
 *   - SSR-safe: returns sensible FREE defaults before the first load resolves
 *   - never throws — a failed fetch leaves the user on the free defaults
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiGet } from '../lib/api'

export type EntitlementTier = 'free' | 'creator' | 'pro' | 'agency'

/**
 * Honest view of the AI intelligence level a tier ACTUALLY runs (derived from
 * server/config/aiProfiles.js via GET /api/me/entitlements). No invented
 * benchmarks — these are the real effort/output/live-web parameters.
 */
export interface AiProfileView {
  label: string
  depth: string
  effort: string
  maxWebSearches: number
  deepReasoning: boolean
  liveWeb: boolean
  premiumTools: boolean
}

export interface EntitlementsPayload {
  tier: EntitlementTier
  /** Map of unlocked feature ids → true. Missing key == not unlocked. */
  features: Record<string, boolean>
  featureList: string[]
  /** Per-tier numeric caps. null === unlimited (server serialized Infinity → null). */
  limits: Record<string, number | null>
  usage: Record<string, number>
  /** Feature ids flagged early-access AND unlocked for this tier. */
  earlyAccess: string[]
  /** The real AI intelligence level this tier runs. */
  aiProfile: AiProfileView
}

const FREE_AI_PROFILE: AiProfileView = {
  label: 'Standard AI',
  depth: 'standard',
  effort: 'medium',
  maxWebSearches: 0,
  deepReasoning: false,
  liveWeb: false,
  premiumTools: false,
}

const FREE_DEFAULTS: EntitlementsPayload = {
  tier: 'free',
  features: {},
  featureList: [],
  limits: {},
  usage: {},
  earlyAccess: [],
  aiProfile: FREE_AI_PROFILE,
}

// ── Module-level cache (shared across every hook instance) ───────────────────
const CACHE_TTL_MS = 60_000
let cached: EntitlementsPayload | null = null
let cachedAt = 0
let inFlight: Promise<EntitlementsPayload> | null = null

// Lightweight subscriber registry so a refresh() in one component pushes the
// new value to every mounted consumer (like useAuth's global cache pattern).
const subscribers = new Set<(p: EntitlementsPayload) => void>()

function notify(payload: EntitlementsPayload) {
  subscribers.forEach((fn) => {
    try {
      fn(payload)
    } catch {
      /* a single bad subscriber must not break the others */
    }
  })
}

function normalize(raw: any): EntitlementsPayload {
  // Tolerate the various response envelopes the API layer may hand back
  // ({ ... }, { data: { ... } }, { success, data: { ... } }).
  const body = raw?.featureList || raw?.features ? raw : raw?.data ?? raw ?? {}
  const tier: EntitlementTier =
    body?.tier === 'creator' || body?.tier === 'pro' || body?.tier === 'agency'
      ? body.tier
      : 'free'
  return {
    tier,
    features:
      body?.features && typeof body.features === 'object' ? body.features : {},
    featureList: Array.isArray(body?.featureList) ? body.featureList : [],
    limits: body?.limits && typeof body.limits === 'object' ? body.limits : {},
    usage: body?.usage && typeof body.usage === 'object' ? body.usage : {},
    earlyAccess: Array.isArray(body?.earlyAccess) ? body.earlyAccess : [],
    aiProfile:
      body?.aiProfile && typeof body.aiProfile === 'object'
        ? { ...FREE_AI_PROFILE, ...body.aiProfile }
        : FREE_AI_PROFILE,
  }
}

async function fetchEntitlements(force = false): Promise<EntitlementsPayload> {
  // SSR / unauthenticated: never fire a request, return free defaults.
  if (typeof window === 'undefined') return FREE_DEFAULTS
  const token = localStorage.getItem('token')
  if (!token) return FREE_DEFAULTS

  const now = Date.now()
  if (!force && cached && now - cachedAt < CACHE_TTL_MS) return cached
  if (inFlight) return inFlight

  inFlight = (async () => {
    try {
      // Bypass the api-layer GET cache so `force` truly re-fetches.
      const raw = await apiGet<any>('/me/entitlements', undefined, false)
      const payload = normalize(raw)
      cached = payload
      cachedAt = Date.now()
      notify(payload)
      return payload
    } catch {
      // Never throw — fall back to whatever we last had, else free defaults.
      // We do NOT cache the failure so the next call retries.
      return cached ?? FREE_DEFAULTS
    } finally {
      inFlight = null
    }
  })()

  return inFlight
}

export interface UseEntitlements {
  tier: EntitlementTier
  hasFeature: (id: string) => boolean
  limit: (key: string) => number | null
  usage: Record<string, number>
  isEarlyAccess: (id: string) => boolean
  features: Record<string, boolean>
  /** The real AI intelligence level this tier runs (honest, derived). */
  aiProfile: AiProfileView
  loading: boolean
  refresh: () => Promise<EntitlementsPayload>
  /** The full resolved payload (free defaults until loaded). */
  entitlements: EntitlementsPayload
}

export function useEntitlements(): UseEntitlements {
  const [data, setData] = useState<EntitlementsPayload>(
    () => cached ?? FREE_DEFAULTS
  )
  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    if (!localStorage.getItem('token')) return false
    return !(cached && Date.now() - cachedAt < CACHE_TTL_MS)
  })
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    const onUpdate = (p: EntitlementsPayload) => {
      if (mountedRef.current) setData(p)
    }
    subscribers.add(onUpdate)

    // Fresh-enough cache → render it immediately, skip the fetch.
    if (cached && Date.now() - cachedAt < CACHE_TTL_MS) {
      setData(cached)
      setLoading(false)
    } else {
      fetchEntitlements().then((p) => {
        if (mountedRef.current) {
          setData(p)
          setLoading(false)
        }
      })
    }

    return () => {
      mountedRef.current = false
      subscribers.delete(onUpdate)
    }
  }, [])

  const refresh = useCallback(async () => {
    if (mountedRef.current) setLoading(true)
    const p = await fetchEntitlements(true)
    if (mountedRef.current) {
      setData(p)
      setLoading(false)
    }
    return p
  }, [])

  const hasFeature = useCallback(
    (id: string) => data.features[id] === true,
    [data]
  )
  const limit = useCallback(
    (key: string) => {
      const v = data.limits[key]
      return v === undefined ? null : v
    },
    [data]
  )
  const isEarlyAccess = useCallback(
    (id: string) => data.earlyAccess.includes(id),
    [data]
  )

  return {
    tier: data.tier,
    hasFeature,
    limit,
    usage: data.usage,
    isEarlyAccess,
    features: data.features,
    aiProfile: data.aiProfile,
    loading,
    refresh,
    entitlements: data,
  }
}
