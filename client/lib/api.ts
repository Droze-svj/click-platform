/**
 * API Client Utilities
 * 
 * Provides a centralized API client for making authenticated requests to the backend API.
 * Handles token management, request/response interceptors, and error handling.
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios'
import { extractApiError } from '../utils/apiResponse'

function resolveBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL

  // Debug instrumentation disabled

  // If you're running the frontend locally, always prefer same-origin proxy (/api)
  // to avoid CORS, mixed-host issues, and "invisible" auth failures.
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    const isLocal = host === 'localhost' || host === '127.0.0.1'
    const isRemoteRender = !!envUrl && envUrl.includes('onrender.com')
    const isDirectLocalApi =
      !!envUrl &&
      (envUrl.startsWith('http://localhost:5001') ||
        envUrl.startsWith('http://127.0.0.1:5001') ||
        envUrl.startsWith('https://localhost:5001') ||
        envUrl.startsWith('https://127.0.0.1:5001'))

    if (isLocal && (isRemoteRender || isDirectLocalApi)) {
      // Debug instrumentation disabled
      return '/api'
    }
  }

  const finalUrl = envUrl || '/api'
  // Debug instrumentation disabled
  return finalUrl
}

/**
 * API base URL from environment variables.
 * Exported for use in components that need the URL directly.
 */
// Prefer same-origin proxy by default (see `client/next.config.js` rewrites).
// This makes local development reliable even if the Render backend is down.
export const API_URL = resolveBaseUrl()

const DEBUG_RUN_ID = 'run5'

function shouldDebugLogUrl(url: string): boolean {
  const u = (url || '').trim()
  return (
    u === '/auth/me' ||
    u === 'auth/me' ||
    u.startsWith('/notifications') ||
    u.startsWith('notifications') ||
    u.startsWith('/approvals') ||
    u.startsWith('approvals') ||
    u.startsWith('/search') ||
    u.startsWith('search') ||
    u.startsWith('/onboarding') ||
    u.startsWith('onboarding')
  )
}

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

  // Execute the request
  fn()
    .then(result => resolve(result))
    .catch(error => reject(error))
    .finally(() => {
      activeRequests--
      // Process next request after a small delay to prevent overwhelming the server
      setTimeout(() => processQueue(), 10)
    })
}

function createApiClient(): AxiosInstance {
  // API client initialized successfully
  console.log('🔗 API Client initialized with baseURL:', resolveBaseUrl());

  // Enhanced debugging function
  const sendApiDebugLog = (message: string, data: any) => {
    // #region agent log
    fetch('http://127.0.0.1:5557/ingest/ff7d38f2-f61b-412e-9a79-ebc734d5bd4a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'api.ts',
        message,
        data: {
          ...data,
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run-api-debug'
        }
      }),
    }).catch(() => {})
    // #endregion
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
    timeout: 30000, // 30 seconds
  })

  // Enhanced request interceptor with comprehensive debugging
  client.interceptors.request.use(
    (config) => {
      const startTime = Date.now()
      ;(config as any).metadata = { startTime }

      // Enhanced logging
      console.log('🔍 API: Request interceptor triggered for:', config.url)
      const token = localStorage.getItem('token')
      console.log('🔍 API: Token available:', !!token, 'length:', token?.length || 0)

      if (token) {
        config.headers.Authorization = `Bearer ${token}`
        console.log('🔍 API: Authorization header added')
      }

      // Debug logging
      sendApiDebugLog('api_request_start', {
        url: config.url,
        method: config.method,
        headers: {
          ...config.headers,
          authorization: config.headers.Authorization ? '[REDACTED]' : undefined
        },
        data: config.data ? JSON.stringify(config.data).substring(0, 500) + '...' : null,
        timeout: config.timeout,
        hasToken: !!token,
        userAgent: navigator.userAgent,
        referrer: document.referrer,
        currentPath: window.location.pathname
      })

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

  // Enhanced response interceptor with detailed logging
  client.interceptors.response.use(
    (response) => {
      const duration = Date.now() - (response.config as any).metadata?.startTime

      console.log('🔍 API: Response received for:', response.config.url, 'status:', response.status, 'duration:', duration + 'ms')

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
    (error) => {
      const duration = error.config?.metadata?.startTime ? Date.now() - error.config.metadata.startTime : 0

      console.error('🔍 API: Response error for:', error.config?.url, 'duration:', duration + 'ms', 'error:', error.message)

      // Enhanced error logging
      sendApiDebugLog('api_response_error', {
        url: error.config?.url,
        method: error.config?.method,
        duration,
        error: {
          message: error.message,
          code: error.code,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          headers: error.response?.headers
        },
        isTimeout: error.code === 'ECONNABORTED',
        isNetworkError: !error.response,
        isServerError: error.response?.status >= 500,
        isClientError: error.response?.status >= 400 && error.response?.status < 500,
        retryCount: error.config?.retryCount || 0,
        userAgent: navigator.userAgent,
        online: navigator.onLine,
        connectionType: (navigator as any).connection?.effectiveType || 'unknown'
      })

      return Promise.reject(error)
    }
  )

  // Response interceptor: Handle errors globally
  client.interceptors.response.use(
    (response) => {

      return response
    },
    (error: AxiosError) => {



      // Handle 401 Unauthorized - redirect to login
      if (error.response?.status === 401) {
        localStorage.removeItem('token')
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
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

/**
 * Makes a GET request to the API.
 * 
 * @param endpoint - API endpoint (without base URL)
 * @param config - Optional Axios request configuration
 * @returns Promise resolving to the response data
 * 
 * @example
 * ```typescript
 * const users = await apiGet('/users')
 * const user = await apiGet('/users/123')
 * ```
 */
export async function apiGet<T = any>(endpoint: string, config?: AxiosRequestConfig): Promise<T> {
  return rateLimitRequest(async () => {
    const response = await api.get<T>(endpoint, config)
    return response.data
  })
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
  localStorage.setItem('token', token)
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
  localStorage.removeItem('token')
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
  return localStorage.getItem('token')
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
