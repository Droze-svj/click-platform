/**
 * API Client Utilities
 * 
 * Provides a centralized API client for making authenticated requests to the backend API.
 * Handles token management, request/response interceptors, and error handling.
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios'
import { extractApiError } from '../utils/apiResponse'

/**
 * Global upgrade-gate plumbing.
 *
 * Gated server routes return a structured 402/403 body
 * ({ error:'feature_gated'|'limit_reached', requiredTier, currentTier, ... }).
 * Rather than make every caller handle this, the response interceptor detects
 * that shape and dispatches a single window CustomEvent. A top-level listener
 * (mounted once in the dashboard layout) renders the <UpgradeModal> in response.
 *
 * The original AxiosError still rejects so existing try/catch logic keeps
 * working — this is purely additive.
 */
export const UPGRADE_REQUIRED_EVENT = 'click-upgrade-required'

export interface UpgradeRequiredDetail {
  reason: 'feature' | 'limit'
  feature?: string
  requiredTier?: string
  currentTier?: string
  limit?: number
  used?: number
  message?: string
  upgradeUrl?: string
  /** HTTP status that triggered it (403 feature/limit, 402 AI budget). */
  status?: number
}

/** Inspect an error body and, if it's a gate response, emit the global event. */
function maybeEmitUpgradeEvent(error: AxiosError): void {
  if (typeof window === 'undefined') return
  const status = error.response?.status
  if (status !== 403 && status !== 402) return

  const body = error.response?.data as any
  if (!body || typeof body !== 'object') return

  const code = body.error
  const isFeatureGate = code === 'feature_gated' || code === 'limit_reached'
  // 402 is the AI-budget ceiling — treat it as a limit-style upgrade prompt
  // even if the error code differs.
  const isBudget = status === 402

  if (!isFeatureGate && !isBudget) return

  const detail: UpgradeRequiredDetail = {
    reason: code === 'limit_reached' || isBudget ? 'limit' : 'feature',
    feature: body.feature,
    requiredTier: body.requiredTier,
    currentTier: body.currentTier,
    limit: typeof body.limit === 'number' ? body.limit : undefined,
    used: typeof body.used === 'number' ? body.used : undefined,
    message: body.message,
    upgradeUrl: body.upgradeUrl || '/dashboard/billing',
    status,
  }

  try {
    window.dispatchEvent(new CustomEvent(UPGRADE_REQUIRED_EVENT, { detail }))
  } catch {
    /* CustomEvent unsupported (very old env) — silently skip */
  }
}

function resolveBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL

  // Frontend running on localhost: only ROUTE THROUGH the same-origin
  // proxy (`/api`) when the env URL points at a REMOTE host like Render
  // (the user wired prod creds for local dev — we don't want to leak
  // remote calls). When the env URL is itself localhost (e.g. our
  // direct-backend bypass to dodge Next.js's ~30s proxy timeout for
  // long-running auto-edit), USE IT — that's the explicit intent.
  // The previous version forced `/api` for direct-local URLs too,
  // which silently undid the proxy bypass and brought back the 30s
  // socket-hangup on auto-edit.
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    const isLocal = host === 'localhost' || host === '127.0.0.1'
    const isRemoteRender = !!envUrl && envUrl.includes('onrender.com')
    if (isLocal && isRemoteRender) {
      return '/api'
    }
  }

  return envUrl || '/api'
}

/**
 * API base URL from environment variables.
 * Exported for use in components that need the URL directly.
 */
// Prefer same-origin proxy by default (see `client/next.config.js` rewrites).
// This makes local development reliable even if the Render backend is down.
export const API_URL = resolveBaseUrl()

/**
 * Creates and configures an Axios instance with default settings.
 * 
 * @returns Configured Axios instance
 * 
 * @example
 * ```typescript
 * const api = createApiClient()
 * const response = await api.get('/users')
 * ```
 */

// Request queuing with concurrency limits to prevent timeouts
let activeRequests = 0
const MAX_CONCURRENT_REQUESTS = 3
let requestQueue: Array<{ fn: () => Promise<any>, resolve: (value: any) => void, reject: (error: any) => void }> = []

// Retry configuration
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1000
// 429 (Rate Limit) should NOT be retried immediately - it needs a longer wait
// Only retry server errors and timeouts, not rate limits
const RETRYABLE_STATUS_CODES = [500, 502, 503, 504, 408]
const RATE_LIMIT_STATUS_CODE = 429
// In development, use shorter delay; in production, respect server's retry-after header
const RATE_LIMIT_RETRY_DELAY_MS = process.env.NODE_ENV === 'development' ? 5000 : 60000 // 5s dev, 60s prod

function rateLimitRequest<T>(requestFn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    requestQueue.push({ fn: requestFn, resolve, reject })
    processQueue()
  })
}

async function processQueue() {
  // If we're at max concurrency or queue is empty, don't process
  if (activeRequests >= MAX_CONCURRENT_REQUESTS || requestQueue.length === 0) {
    return
  }

  // Process the next request
  const { fn, resolve, reject } = requestQueue.shift()!
  activeRequests++

  // Execute the request with retry logic
  executeWithRetry(fn, 0)
    .then(result => resolve(result))
    .catch(error => reject(error))
    .finally(() => {
      activeRequests--
      // Process next request after a small delay to prevent overwhelming the server
      setTimeout(() => processQueue(), 10)
    })
}

async function executeWithRetry<T>(requestFn: () => Promise<T>, retryCount: number): Promise<T> {
  try {
    return await requestFn()
  } catch (error: any) {
    // Handle rate limiting (429) separately - don't retry immediately
    if (error?.response?.status === RATE_LIMIT_STATUS_CODE) {
      // In development, don't retry rate limits - just fail fast to avoid making it worse
      if (process.env.NODE_ENV === 'development') {
        console.warn('⏸️ API: Rate limited (429) in development. Skipping retry to prevent further rate limiting.')
        throw error
      }
      
      // In production, respect rate limits with appropriate delay
      // Check for Retry-After header from server
      const retryAfter = error?.response?.headers?.['retry-after'] || error?.response?.headers?.['Retry-After']
      const waitTime = retryAfter ? Math.min(parseInt(retryAfter, 10) * 1000, RATE_LIMIT_RETRY_DELAY_MS) : RATE_LIMIT_RETRY_DELAY_MS
      
      if (retryCount === 0) {
        console.warn(`⏸️ API: Rate limited (429). Waiting ${waitTime / 1000}s before retry...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
        return executeWithRetry(requestFn, retryCount + 1)
      } else {
        // Already retried once, don't retry again
        console.error('⛔ API: Rate limit exceeded. Please wait before making more requests.')
        throw error
      }
    }

    const shouldRetry = (
      retryCount < MAX_RETRIES &&
      error?.response?.status &&
      RETRYABLE_STATUS_CODES.includes(error.response.status)
    ) || (
      retryCount < MAX_RETRIES &&
      error?.code === 'ECONNABORTED' // Timeout
    )

    if (shouldRetry) {
      console.log(`🔄 API: Retrying request (attempt ${retryCount + 1}/${MAX_RETRIES}) after ${RETRY_DELAY_MS}ms delay`)
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (retryCount + 1))) // Exponential backoff
      return executeWithRetry(requestFn, retryCount + 1)
    }

    throw error
  }
}

/**
 * Singleton refresh-in-flight promise so N parallel 401s trigger ONE
 * /auth/refresh call. Returns the new access token (also written to
 * localStorage as a side effect). Throws if the refresh fails so the
 * interceptor knows to fall through to logout.
 *
 * Built on raw axios (not our axios instance) so the refresh request
 * doesn't itself go through the response interceptor and recurse.
 */
let refreshInFlight: Promise<string> | null = null
function getOrStartRefresh(refreshToken: string): Promise<string> {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = (async () => {
    try {
      const res = await axios.post(
        `${resolveBaseUrl()}/auth/refresh`,
        { refreshToken },
        { headers: { 'Content-Type': 'application/json' } }
      )
      // Refresh endpoint returns { success, data: { accessToken, refreshToken, expiresIn } }.
      const data = (res.data as any)?.data ?? res.data
      const newAccess: string | undefined = data?.accessToken || data?.token
      const newRefresh: string | undefined = data?.refreshToken
      if (!newAccess) {
        throw new Error('Refresh response missing access token')
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', newAccess)
        if (newRefresh) localStorage.setItem('refreshToken', newRefresh)
      }
      return newAccess
    } finally {
      // Always clear so the NEXT 401 (after another expiry cycle) can
      // start a fresh refresh. The promise above resolves/rejects before
      // this clears, so concurrent callers all see the same result.
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

function createApiClient(): AxiosInstance {
  // API client initialized successfully
  console.log('🔗 API Client initialized with baseURL:', resolveBaseUrl());

  // Enhanced debugging function
  const sendApiDebugLog = (message: string, data: any) => {
    // Development debug logging disabled to prevent console spam
    // fetch('http://127.0.0.1:5557/ingest/ff7d38f2-f61b-412e-9a79-ebc734d5bd4a', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     location: 'api.ts',
    //     message,
    //     data: {
    //       ...data,
    //       timestamp: Date.now(),
    //       sessionId: 'debug-session',
    //       runId: 'run-api-debug'
    //     }
    //   }),
    // }).catch(() => {})
  }

  // Helpful runtime warning: if you're on localhost but still pointing at Render,
  // you will keep seeing 500s/timeouts. The local proxy setup is the intended default.
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    if ((host === 'localhost' || host === '127.0.0.1') && envUrl && envUrl.includes('onrender.com')) {
      // eslint-disable-next-line no-console
      console.warn(
        '[api] You are running locally but NEXT_PUBLIC_API_URL points to Render. ' +
          'Forcing baseURL to "/api" (local proxy) so you can keep testing. ' +
          'To make this permanent, unset NEXT_PUBLIC_API_URL or set it to "/api".'
      );
      sendApiDebugLog('proxy_fallback_warning', {
        host,
        envUrl,
        warning: 'Using local proxy instead of Render URL'
      })
    }
  }

  const client = axios.create({
    baseURL: resolveBaseUrl(),
    headers: {
      'Content-Type': 'application/json',
    },
    // 5 min default. Auto-edit + ffmpeg renders + transcription routinely
    // run 60-90s; the previous 45s ceiling killed the request mid-render
    // and the user saw a 500 even though the server was still working.
    // Per-call overrides can still pass `timeout` to short-circuit.
    timeout: 300_000,
  })

  // Enhanced request interceptor with comprehensive debugging
  client.interceptors.request.use(
    (config) => {
      const requestStartTime = Date.now()
      ;(config as any).metadata = { startTime: requestStartTime }

      // Enhanced logging (only in development to reduce spam)
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 API: Request interceptor triggered for:', config.url)
      }
      
      // Get auth token with SSR safety check
      const authToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null

      // Auth-public routes — these MINT or rotate the credential, so
      // attaching an existing (often stale) Bearer just causes the
      // server to reject before the body even gets parsed. Previously
      // a leftover `dev-jwt-token-*` from an earlier dev session would
      // ride along on /auth/login and 401 the user out of the only
      // path back into a working state.
      const url = String(config.url || '')
      const isAuthPublic = (
        url.includes('/auth/login') ||
        url.includes('/auth/register') ||
        url.includes('/auth/refresh') ||
        url.includes('/auth/forgot-password') ||
        url.includes('/auth/reset-password') ||
        url.includes('/auth/oauth/')
      )

      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 API: Token available:', !!authToken, 'length:', authToken?.length || 0, 'isDevToken:', authToken?.startsWith('dev-jwt-token-'), 'authPublic:', isAuthPublic)
      }

      if (authToken && !isAuthPublic) {
        config.headers.Authorization = `Bearer ${authToken}`
        if (process.env.NODE_ENV === 'development') {
          console.log('🔍 API: Authorization header added')
        }
      } else if (isAuthPublic && config.headers && (config.headers as any).Authorization) {
        // Strip any inherited Authorization header on auth-public routes.
        delete (config.headers as any).Authorization
      }

      // Attach the user's chosen UI language so the server can localize AI
      // output. Reads from the same localStorage slot usePreferences uses.
      try {
        if (typeof window !== 'undefined') {
          const prefRaw = localStorage.getItem('click-user-preferences')
          if (prefRaw) {
            const lang = JSON.parse(prefRaw)?.language
            if (lang && typeof lang === 'string') config.headers['X-Click-Language'] = lang
          }
        }
      } catch { /* preferences corrupted — fall back to Accept-Language */ }


      // Debug logging (with SSR safety checks)
      if (typeof window !== 'undefined') {
        sendApiDebugLog('api_request_start', {
          url: config.url,
          method: config.method,
          headers: {
            ...config.headers,
            authorization: config.headers.Authorization ? '[REDACTED]' : undefined
          },
          data: config.data ? JSON.stringify(config.data).substring(0, 500) + '...' : null,
          timeout: config.timeout,
          hasToken: !!localStorage.getItem('token'),
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
          referrer: typeof document !== 'undefined' ? document.referrer : 'unknown',
          currentPath: window.location.pathname
        })
      }

      return config
    },
    (error) => {
      sendApiDebugLog('api_request_error', {
        error: error.message,
        stack: error.stack,
        config: {
          url: error.config?.url,
          method: error.config?.method
        }
      })
      return Promise.reject(error)
    }
  )

  // Enhanced response interceptor with detailed logging and error handling
  client.interceptors.response.use(
    (response) => {
      const duration = Date.now() - (response.config as any).metadata?.startTime

      console.log('🔍 API: Response received for:', response.config.url, 'status:', response.status, 'duration:', duration + 'ms')

      // Debug logging disabled to prevent console spam
      // fetch('http://127.0.0.1:5561/ingest/ff7d38f2-f61b-412e-9a79-ebc734d5bd4a', ...).catch(() => {})

      // Debug logging
      sendApiDebugLog('api_response_success', {
        url: response.config.url,
        method: response.config.method,
        status: response.status,
        statusText: response.statusText,
        duration,
        responseSize: JSON.stringify(response.data).length,
        responseKeys: Object.keys(response.data || {}),
        hasData: !!response.data,
        dataType: typeof response.data,
        headers: response.headers,
        cached: response.request?.fromCache || false
      })

      return response
    },
    async (error: AxiosError) => {
      const duration = (error.config as any)?.metadata?.startTime ? Date.now() - (error.config as any).metadata.startTime : 0

      // Don't log "canceled" errors as console.error — these are standard
      // React behavior on unmount/re-render and just clutter the log.
      if (!axios.isCancel(error)) {
        console.error('🔍 API: Response error for:', error.config?.url, 'duration:', duration + 'ms', 'error:', error.message)
      } else if (process.env.NODE_ENV === 'development') {
        // Keep a quieter warning in dev so we know it happened
        console.warn('🔍 API: Request canceled for:', error.config?.url, 'duration:', duration + 'ms')
      }

      // Enhanced error logging
      const responseStatus = error.response?.status
      sendApiDebugLog('api_response_error', {
        url: error.config?.url,
        method: error.config?.method,
        duration,
        error: {
          message: error.message,
          code: error.code,
          status: responseStatus,
          statusText: error.response?.statusText,
          data: error.response?.data,
          headers: error.response?.headers
        },
        isTimeout: error.code === 'ECONNABORTED',
        isNetworkError: !error.response,
        isServerError: responseStatus ? responseStatus >= 500 : false,
        isClientError: responseStatus ? responseStatus >= 400 && responseStatus < 500 : false,
        retryCount: (error.config as any)?.retryCount || 0,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        online: typeof navigator !== 'undefined' ? navigator.onLine : true,
        connectionType: typeof navigator !== 'undefined' ? (navigator as any).connection?.effectiveType || 'unknown' : 'unknown'
      })



      // Global upgrade-gate detection. Surface feature_gated / limit_reached
      // (403) and AI-budget (402) responses to the app-wide UpgradeModal via a
      // window event. Does NOT swallow the error — callers still reject below.
      maybeEmitUpgradeEvent(error)

      // Enhanced error handling for database timeouts and server errors
      if (error.response?.status === 500) {
        const errorMessage = (error.response.data as any)?.error || error.message
        const requestUrl = error.config?.url || 'unknown'
        
        // In development, provide detailed error information
        if (process.env.NODE_ENV === 'development') {
          console.error('🔧 [API] 500 Internal Server Error:', {
            url: requestUrl,
            method: error.config?.method,
            error: errorMessage,
            responseData: error.response?.data,
            stack: error.stack
          })
          
          // If it's a dev user and we get a 500, it might be a route that needs dev user handling
          const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
          const isDevToken = token && token.startsWith('dev-jwt-token-')
          if (isDevToken) {
            console.warn('🔧 [API] 500 error with dev token - this route might need dev user handling:', requestUrl)
            console.warn('🔧 [API] Check server logs for more details. The route handler may need to check for dev users.')
          }
        }
        
        if (errorMessage?.includes('buffering timed out') || errorMessage?.includes('timeout')) {
          // Create a more user-friendly error for database timeouts
          const enhancedError = new Error('The server is experiencing temporary issues. Please try again in a moment.')
          enhancedError.name = 'DatabaseTimeoutError'
          ;(enhancedError as any).originalError = error
          ;(enhancedError as any).isRetryable = true
          return Promise.reject(enhancedError)
        }
        
        // For other 500 errors, provide a user-friendly message
        const userFriendlyError = new Error(
          process.env.NODE_ENV === 'development' 
            ? `Server error: ${errorMessage} (${requestUrl})`
            : 'An error occurred on the server. Please try again later.'
        )
        userFriendlyError.name = 'ServerError'
        ;(userFriendlyError as any).originalError = error
        ;(userFriendlyError as any).response = error.response
        ;(userFriendlyError as any).config = error.config
        return Promise.reject(userFriendlyError)
      }

      // Handle 429 Rate Limiting - don't retry immediately, log warning
      if (error.response?.status === 429) {
        const retryAfter = error.response?.headers?.['retry-after'] || error.response?.headers?.['Retry-After']
        const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : RATE_LIMIT_RETRY_DELAY_MS
        console.warn(`⏸️ API: Rate limited (429). Server suggests waiting ${waitTime / 1000}s. Please reduce request frequency.`)
      }

      // Handle 401 Unauthorized — try silent refresh first, fall back to
      // logout. The refresh attempt is gated on (a) the failing request is
      // not itself a public-auth endpoint, (b) we have a refresh token in
      // localStorage, (c) we haven't already retried this request once.
      // A singleton refreshPromise coalesces concurrent 401s so 10 parallel
      // requests trigger ONE refresh instead of 10.
      if (error.response?.status === 401) {
        const originalRequest = error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined
        const requestUrl = String(error.config?.url || 'unknown')
        const requestMethod = error.config?.method || 'unknown'
        const isAuthPublic = (
          requestUrl.includes('/auth/login') ||
          requestUrl.includes('/auth/register') ||
          requestUrl.includes('/auth/refresh') ||
          requestUrl.includes('/auth/forgot-password') ||
          requestUrl.includes('/auth/reset-password')
        )
        // /auth/me has its own retry + redirect logic in useAuth.ts — the
        // interceptor shouldn't race with it and force a logout before the
        // hook can retry. Without this, a single transient 401 from any
        // race-y backend (e.g. cold-start Supabase) kicks the user back
        // to /login immediately after sign-in.
        const isAuthMe = requestUrl.includes('/auth/me') || requestUrl.includes('/auth/profile')

        const refreshTokenValue = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null
        const canTryRefresh = (
          !!refreshTokenValue &&
          !isAuthPublic &&
          !!originalRequest &&
          !originalRequest._retried
        )

        if (process.env.NODE_ENV === 'development') {
          console.warn('🔧 [API] 401 Unauthorized:', {
            url: requestUrl,
            method: requestMethod,
            hasRefreshToken: !!refreshTokenValue,
            willTryRefresh: canTryRefresh,
            authPublic: isAuthPublic,
          })
        }

        if (canTryRefresh) {
          try {
            const newToken = await getOrStartRefresh(refreshTokenValue!)
            if (newToken && originalRequest) {
              originalRequest._retried = true
              originalRequest.headers = {
                ...(originalRequest.headers || {}),
                Authorization: `Bearer ${newToken}`,
              }
              return client.request(originalRequest)
            }
          } catch (refreshErr) {
            // Refresh failed — fall through to logout below.
            if (process.env.NODE_ENV === 'development') {
              console.warn('🔧 [API] Token refresh failed, will sign out:', refreshErr)
            }
          }
        }

        if (typeof window !== 'undefined' && !isAuthPublic && !isAuthMe) {
          // Clear both tokens — refresh either failed, wasn't possible, or
          // we already retried this request once.
          localStorage.removeItem('token')
          localStorage.removeItem('refreshToken')
          const onAuthPage = /\/(login|register|signup)(\b|$|\/)/.test(window.location.pathname)
          if (!onAuthPage) {
            window.location.href = '/login'
          }
        }
      }
      return Promise.reject(error)
    }
  )

  return client
}

/**
 * Default API client instance.
 * Use this for most API requests throughout the application.
 */
export const api = createApiClient()

// Request caching for frequently accessed endpoints
const cache = new Map<string, { data: any; timestamp: number; ttl: number }>()
const CACHE_DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes default
const CACHE_ENABLED_ENDPOINTS = [
  '/subscription/status',
  '/templates',
  '/workflows/suggestions',
  '/dashboard',
  '/library/items',
  '/analytics/dashboard',
  '/video/clips/style-insight'
]

function getCacheKey(endpoint: string, config?: AxiosRequestConfig): string {
  const params = config?.params ? JSON.stringify(config.params) : ''
  return `${endpoint}${params}`
}

function getCachedResponse<T>(key: string): T | null {
  const cached = cache.get(key)
  if (!cached) return null
  
  const now = Date.now()
  if (now - cached.timestamp > cached.ttl) {
    cache.delete(key)
    return null
  }
  
  return cached.data as T
}

function setCachedResponse(key: string, data: any, ttl: number = CACHE_DEFAULT_TTL): void {
  cache.set(key, { data, timestamp: Date.now(), ttl })
}

function shouldCache(endpoint: string): boolean {
  return CACHE_ENABLED_ENDPOINTS.some(enabledEndpoint => endpoint.startsWith(enabledEndpoint))
}

/**
 * Makes a GET request to the API with optional caching.
 * 
 * @param endpoint - API endpoint (without base URL)
 * @param config - Optional Axios request configuration
 * @param useCache - Whether to use cache (default: true for enabled endpoints)
 * @returns Promise resolving to the response data
 * 
 * @example
 * ```typescript
 * const users = await apiGet('/users')
 * const user = await apiGet('/users/123')
 * ```
 */
export async function apiGet<T = any>(
  endpoint: string, 
  config?: AxiosRequestConfig,
  useCache: boolean = true
): Promise<T> {
  const cacheKey = getCacheKey(endpoint, config)
  const shouldUseCache = useCache && shouldCache(endpoint)
  
  // Check cache first
  if (shouldUseCache) {
    const cached = getCachedResponse<T>(cacheKey)
    if (cached !== null) {
      return cached
    }
  }
  
  return rateLimitRequest(async () => {
    const response = await api.get<T>(endpoint, config)
    
    // Cache successful GET requests
    if (shouldUseCache && response.status === 200) {
      setCachedResponse(cacheKey, response.data)
    }
    
    return response.data
  })
}

/**
 * Clear cache for a specific endpoint or all cache
 * 
 * @param endpoint - Optional endpoint to clear (if not provided, clears all)
 */
export function clearApiCache(endpoint?: string): void {
  if (endpoint) {
    // Clear all cache entries that start with this endpoint
    const keys = Array.from(cache.keys())
    for (const key of keys) {
      if (key.startsWith(endpoint)) {
        cache.delete(key)
      }
    }
  } else {
    cache.clear()
  }
}

/**
 * Makes a POST request to the API.
 * 
 * @param endpoint - API endpoint (without base URL)
 * @param data - Request payload
 * @param config - Optional Axios request configuration
 * @returns Promise resolving to the response data
 * 
 * @example
 * ```typescript
 * const newUser = await apiPost('/users', { name: 'John', email: 'john@example.com' })
 * ```
 */
export async function apiPost<T = any>(
  endpoint: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<T> {
  return rateLimitRequest(async () => {
    const response = await api.post<T>(endpoint, data, config)
    return response.data
  })
}

/**
 * Makes a PUT request to the API.
 * 
 * @param endpoint - API endpoint (without base URL)
 * @param data - Request payload
 * @param config - Optional Axios request configuration
 * @returns Promise resolving to the response data
 * 
 * @example
 * ```typescript
 * const updatedUser = await apiPut('/users/123', { name: 'Jane' })
 * ```
 */
export async function apiPut<T = any>(
  endpoint: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<T> {
  return rateLimitRequest(async () => {
    const response = await api.put<T>(endpoint, data, config)
    return response.data
  })
}

/**
 * Makes a PATCH request to the API.
 * 
 * @param endpoint - API endpoint (without base URL)
 * @param data - Request payload
 * @param config - Optional Axios request configuration
 * @returns Promise resolving to the response data
 * 
 * @example
 * ```typescript
 * const patchedUser = await apiPatch('/users/123', { name: 'Jane' })
 * ```
 */
export async function apiPatch<T = any>(
  endpoint: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<T> {
  return rateLimitRequest(async () => {
    const response = await api.patch<T>(endpoint, data, config)
    return response.data
  })
}

/**
 * Makes a DELETE request to the API.
 * 
 * @param endpoint - API endpoint (without base URL)
 * @param config - Optional Axios request configuration
 * @returns Promise resolving to the response data
 * 
 * @example
 * ```typescript
 * await apiDelete('/users/123')
 * ```
 */
export async function apiDelete<T = any>(endpoint: string, config?: AxiosRequestConfig): Promise<T> {
  return rateLimitRequest(async () => {
    const response = await api.delete<T>(endpoint, config)
    return response.data
  })
}

/**
 * Handles API errors and extracts user-friendly error messages.
 * 
 * @param error - Error object (typically an AxiosError)
 * @returns User-friendly error message
 * 
 * @example
 * ```typescript
 * try {
 *   await apiGet('/users')
 * } catch (error) {
 *   const message = handleApiError(error)
 *   console.error(message)
 * }
 * ```
 */
export function handleApiError(error: unknown): string {
  return extractApiError(error).message
}

/**
 * Sets the authentication token for all future API requests.
 * 
 * @param token - JWT token string
 * 
 * @example
 * ```typescript
 * setAuthToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...')
 * ```
 */
export function setAuthToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('token', token)
  }
}

/**
 * Store BOTH the access token and refresh token after a successful login,
 * register, or refresh. Use this in preference to `setAuthToken` when the
 * server response includes a `refreshToken` — that's what powers the
 * silent-refresh-on-401 interceptor below.
 */
export function setTokens(token: string, refreshToken?: string | null): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('token', token)
  if (refreshToken) {
    localStorage.setItem('refreshToken', refreshToken)
  }
}

export function getRefreshToken(): string | null {
  if (typeof window !== 'undefined') return localStorage.getItem('refreshToken')
  return null
}

/**
 * Removes the authentication token and clears authorization headers.
 *
 * @example
 * ```typescript
 * clearAuthToken()
 * ```
 */
export function clearAuthToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
  }
}

/**
 * Gets the current authentication token.
 * 
 * @returns JWT token string or null if not set
 * 
 * @example
 * ```typescript
 * const token = getAuthToken()
 * if (token) {
 *   console.log('User is authenticated')
 * }
 * ```
 */
export function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token')
  }
  return null
}

/**
 * Checks if the user is authenticated (has a valid token).
 * 
 * @returns True if authenticated, false otherwise
 * 
 * @example
 * ```typescript
 * if (isAuthenticated()) {
 *   // Make authenticated request
 * }
 * ```
 */
export function isAuthenticated(): boolean {
  return !!getAuthToken()
}
