'use client'

import { useEffect, useState } from 'react'
import { apiGet } from '@/lib/api'

export interface AIHealth {
  /** true once we have a definitive answer from the probe */
  loaded: boolean
  /** at least one provider key is set + the SDK initialised */
  configured: boolean
  /** human-readable mode string from the probe ("live AI" / "FALLBACK ...") */
  mode: string | null
  /** convenience flag: AI is in canned-fallback mode (configured === false) */
  degraded: boolean
  providers: { gemini?: boolean; openai?: boolean; anthropic?: boolean } | null
  model: string | null
}

interface AIHealthResponse {
  status?: string
  ai?: {
    configured?: boolean
    mode?: string
    model?: string
    providers?: { gemini?: boolean; openai?: boolean; anthropic?: boolean }
    liveTest?: string
  }
}

const DEFAULT_POLL_MS = 120_000
const MIN_POLL_MS = 30_000

const INITIAL: AIHealth = {
  loaded: false,
  configured: false,
  mode: null,
  degraded: false,
  providers: null,
  model: null,
}

/**
 * Polls `GET /api/health/ai` so the UI can tell the user when AI is running in
 * canned-fallback mode — i.e. no provider key is configured in the environment
 * and every AI feature is returning placeholder output instead of real
 * generation. The probe reports config booleans only (no secrets, no paid
 * round-trip — `?live=1` is NOT requested here), so it's safe to poll.
 *
 * Failure handling is deliberately conservative: on a transient fetch error we
 * never flip `degraded` to `true`. We only report degraded when the probe
 * definitively returns `configured:false`, so a network blip can't raise a
 * false "AI is down" banner.
 */
export function useAIHealth(pollMs: number = DEFAULT_POLL_MS): AIHealth {
  const [health, setHealth] = useState<AIHealth>(INITIAL)

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      try {
        const res = await apiGet<AIHealthResponse>('/health/ai', undefined, false)
        const ai = res?.ai
        if (cancelled || !ai || typeof ai.configured !== 'boolean') return
        setHealth({
          loaded: true,
          configured: ai.configured,
          mode: ai.mode ?? null,
          degraded: ai.configured === false,
          providers: ai.providers ?? null,
          model: ai.model ?? null,
        })
      } catch {
        // Network/server blip — keep any prior definitive state, otherwise
        // stay at INITIAL (degraded:false). Never raise a false alarm.
        if (!cancelled) setHealth((h) => (h.loaded ? h : INITIAL))
      }
    }

    check()
    const id = setInterval(check, Math.max(MIN_POLL_MS, pollMs))
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [pollMs])

  return health
}

export default useAIHealth
