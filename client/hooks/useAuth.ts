'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet } from '../lib/api'

// Global flag to prevent multiple simultaneous auth checks
let authCheckInProgress = false
let lastAuthCheck = 0
const AUTH_CHECK_DEBOUNCE_MS = 1000 // Reduced to 1 second for better responsiveness

// Global cache to avoid refetching /auth/me across multiple components/hooks mounts
let cachedToken: string | null = null
let cachedUser: User | null = null
let lastAuthSuccess = 0
const AUTH_SUCCESS_CACHE_MS = 30_000 // 30 seconds

// Queue for pending auth checks to prevent race conditions
let authCheckQueue: Array<() => void> = []
let authCheckTimeout: NodeJS.Timeout | null = null

interface User {
  id: string
  email: string
  name: string
  /** User-chosen preferred display name shown in the dashboard greeting. */
  username?: string | null
  first_name?: string | null
  last_name?: string | null
  subscription: {
    status: string
    plan: string
  }
  niche?: string
  brandSettings?: any
  usage?: {
    videosProcessed: number
    contentGenerated: number
    quotesCreated: number
    postsScheduled: number
  }
  // Per-user calendar webhook secret used by AdvancedSchedulingHub to derive
  // an iCal export URL. Optional because not all users have it provisioned.
  calendarSecret?: string
}

async function waitForAuthCheckToFinish(timeoutMs = 5000) {
  const start = Date.now()
  while (authCheckInProgress && Date.now() - start < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}

export function useAuth() {
  const router = useRouter()

  // Debug logging disabled to prevent console spam
  // fetch('http://127.0.0.1:5561/ingest/ff7d38f2-f61b-412e-9a79-ebc734d5bd4a', ...).catch(() => {})

  // Always use the real auth flow. The previous dev-mode mock-user override
  // poisoned legitimate sessions by overwriting real JWT tokens with a fake
  // `dev-jwt-token-…` string, which then 500'd against any auth-gated route.
  // One-time cleanup: discard any leftover fake dev tokens from prior sessions.
  if (typeof window !== 'undefined') {
    const stale = localStorage.getItem('token')
    if (stale && stale.startsWith('dev-jwt-token-')) {
      localStorage.removeItem('token')
      cachedToken = null
      cachedUser = null
      lastAuthSuccess = 0
    }
  }

  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === 'undefined') return null
    const token = localStorage.getItem('token')
    if (token && cachedToken === token && cachedUser) return cachedUser
    return null
  })
  const [loading, setLoading] = useState(() => {
    if (typeof window === 'undefined') return true
    const token = localStorage.getItem('token')
    // If we have a cached user for the current token, we can render immediately and refresh in the background.
    if (token && cachedToken === token && cachedUser) return false
    // If there's no token, we are effectively "done" (unauthenticated) and should not block the UI.
    if (!token) return false
    return true
  })
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    // React StrictMode in dev intentionally runs effects twice (setup -> cleanup -> setup).
    // Our cleanup flips mountedRef.current=false, so we must reset it here or state updates get skipped forever.
    mountedRef.current = true
    // IMPORTANT: avoid debounce timers here. In dev StrictMode, effects mount/unmount rapidly
    // and scheduled timers get cancelled, leaving some hook instances stuck in loading=true.
    // Global in-flight + caching already prevent excessive /auth/me calls.
    checkAuth()

    return () => {
      mountedRef.current = false
    }
    // checkAuth is a stable function (closures over module-level globals) and
    // is intentionally invoked once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkAuth = async (retryCount = 0) => {
    // Debug logging disabled to prevent console spam
    // fetch('http://127.0.0.1:5561/ingest/ff7d38f2-f61b-412e-9a79-ebc734d5bd4a', ...).catch(() => {})

    // If auth check is already in progress, queue this request
    if (authCheckInProgress) {
      return new Promise<void>((resolve) => {
        authCheckQueue.push(() => resolve())
      })
    }

    // Check debounce timing
    const now = Date.now()
    if (now - lastAuthCheck < AUTH_CHECK_DEBOUNCE_MS) {
      return new Promise<void>((resolve) => {
        authCheckQueue.push(() => resolve())
      })
    }

    // Enhanced debugging function (commented out to avoid ERR_CONNECTION_REFUSED)
    const sendAuthDebugLog = (message: string, data: any) => {
      // Development debug logging disabled to prevent console spam
      // fetch('http://127.0.0.1:5557/ingest/ff7d38f2-f61b-412e-9a79-ebc734d5bd4a', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     location: 'useAuth.ts',
      //     message,
      //     data: {
      //       ...data,
      //       timestamp: Date.now(),
      //       sessionId: 'debug-session',
      //       runId: 'run-auth-debug'
      //     }
      //   }),
      // }).catch(() => {})
    }

    // Track timing for debugging
    const authStartTime = Date.now()

    try {
      authCheckInProgress = true
      lastAuthCheck = now

    // Don't redirect on auth pages
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname
      if (pathname === '/login' || pathname === '/register' || pathname === '/') {
        setLoading(false)
        return
      }
    }

      const token = localStorage.getItem('token')
      if (!token) {
        setLoading(false)
        // Only redirect if not on auth pages
        if (typeof window !== 'undefined') {
          const pathname = window.location.pathname
          if (pathname !== '/login' && pathname !== '/register' && pathname !== '/') {
            router.push('/login')
          }
        }
        return
      }

      // If we've recently fetched the user for this exact token, reuse it.
      // This prevents repeated /auth/me calls when multiple components mount and call useAuth().
      const currentTime = Date.now()
      if (
        retryCount === 0 &&
        cachedToken &&
        cachedToken === token &&
        cachedUser &&
        currentTime - lastAuthSuccess < AUTH_SUCCESS_CACHE_MS
      ) {
        setUser(cachedUser)
        setError(null)
        return
      }

      sendAuthDebugLog('auth_check_start', {
        tokenLength: token.length,
        retryCount,
        cachedTokenExists: !!cachedToken,
        cacheAge: cachedToken ? Date.now() - lastAuthSuccess : null,
        userAgent: navigator.userAgent,
        online: navigator.onLine
      })

      const response = await apiGet<any>('/auth/me', { timeout: 60000 })

      sendAuthDebugLog('auth_check_success', {
        duration: Date.now() - authStartTime,
        responseKeys: Object.keys(response || {}),
        hasUser: !!(response?.user || response?.data?.user || response?.data?.data?.user),
        userId: (response?.user || response?.data?.user || response?.data?.data?.user)?.id || null,
        userEmail: (response?.user || response?.data?.user || response?.data?.data?.user)?.email || null
      })
      // Support multiple API response shapes:
      // - { user: {...} }
      // - { data: { user: {...} } }
      // - { success: true, data: { user: {...} } }
      const resolvedUser = response?.user || response?.data?.user || response?.data?.data?.user || null
      setUser(resolvedUser)
      cachedToken = token
      cachedUser = resolvedUser
      lastAuthSuccess = Date.now()
      setError(null)
    } catch (err: any) {
      // Quiet by default — only log auth failures that aren't 401/403 (which
      // are expected when the token expires or the user signs out). Real
      // errors still go to sendAuthDebugLog below.
      const errStatus = err.response?.status || err.status
      if (errStatus && errStatus !== 401 && errStatus !== 403) {
        console.error('[useAuth] Auth check failed', { status: errStatus, code: err.code })
      }

      // Enhanced error debugging
      sendAuthDebugLog('auth_check_error', {
        duration: Date.now() - authStartTime,
        error: {
          message: err.message,
          code: err.code,
          status: err.response?.status || err.status,
          statusText: err.response?.statusText,
          data: err.response?.data,
          stack: err.stack
        },
        retryCount,
        isNetworkError: err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK' || err.code === 'ECONNREFUSED',
        isTimeout: err.message?.includes('timeout'),
        isServerError: (err.response?.status || 0) >= 500,
        isAuthError: (err.response?.status || 0) === 401 || (err.response?.status || 0) === 403,
        online: navigator.onLine,
        connectionType: (navigator as any).connection?.effectiveType || 'unknown'
      })

      // Retry logic for network errors (Render.com free tier can be slow)
      if (retryCount < 2 && (
        err.code === 'ECONNABORTED' ||
        err.code === 'ERR_NETWORK' ||
        err.code === 'ECONNREFUSED' ||
        err.message?.includes('timeout') ||
        err.message?.includes('Network Error')
      )) {
        sendAuthDebugLog('auth_retry_scheduled', {
          retryAttempt: retryCount + 1,
          maxRetries: 2,
          delayMs: 2000,
          errorType: err.code || 'unknown'
        })
        await new Promise(resolve => setTimeout(resolve, 2000))
        return checkAuth(retryCount + 1)
      }

      // Only redirect to login if it's an auth error (401, 403).
      // Network timeouts / cold-start issues should NOT log users out.
      const status = err.response?.status || err.status
      if (status === 401 || status === 403) {
        // First 401: give it one more chance after a short delay before
        // forcing logout. Backend cold-start / transient Supabase RLS
        // races can briefly 401 a valid token, especially right after
        // login. A single retry rules those out without making bad
        // tokens loop forever. Release the in-progress flag first so the
        // retry can actually execute (otherwise the queue check inside
        // checkAuth() would deadlock against this call's own lock).
        if (retryCount === 0) {
          authCheckInProgress = false
          lastAuthCheck = 0
          await new Promise(r => setTimeout(r, 800))
          return checkAuth(retryCount + 1)
        }
        setError(err.response?.data?.error || err?.message || 'Authentication failed')
        localStorage.removeItem('token')
        cachedToken = null
        cachedUser = null
        lastAuthSuccess = 0
        router.push('/login')
      } else {
        // For other errors, don't redirect immediately
        setError('Connection issue. Please try again.')
      }
    } finally {
      authCheckInProgress = false

      // Process queued auth checks
      if (authCheckQueue.length > 0) {
        const nextCheck = authCheckQueue.shift()
        if (nextCheck) {
          // Use setTimeout to avoid immediate recursive calls
          if (authCheckTimeout) clearTimeout(authCheckTimeout)
          authCheckTimeout = setTimeout(() => {
            nextCheck()
          }, 10)
        }
      }

      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
    cachedToken = null
    cachedUser = null
    lastAuthSuccess = 0
    router.push('/login')
  }

  return { user, loading, error, logout, refresh: checkAuth }
}







