'use client'

import { useState, useCallback, useRef } from 'react'

/**
 * Field-level validation error map, keyed by field name.
 * Matches the `details` array shape returned by the server's 'Elite' validation format.
 */
export type FieldErrors = Record<string, string>

export interface HardenedRequestState {
  loading: boolean
  fieldErrors: FieldErrors
  rateLimitCountdown: number | null
  globalError: string | null
}

export interface HardenedRequestActions {
  execute: <T>(apiCall: () => Promise<T>) => Promise<T | null>
  clearFieldError: (field: string) => void
  clearAllErrors: () => void
  setFieldError: (field: string, message: string) => void
}

export type UseHardenedRequestReturn = HardenedRequestState & HardenedRequestActions

/**
 * useHardenedRequest
 *
 * A universal hook that wraps any API call with:
 * - `loading` state management
 * - Field-level error extraction from the server's structured `details` array
 * - `429` rate-limit countdown timer
 * - `globalError` for unstructured / non-field errors
 *
 * @example
 * ```tsx
 * const { execute, loading, fieldErrors, clearFieldError } = useHardenedRequest()
 *
 * const handleSubmit = async () => {
 *   await execute(() => apiPost('/brand-kit', formData))
 * }
 *
 * <input
 *   className={fieldErrors.name ? 'border-red-500' : 'border-white/10'}
 *   onChange={e => { setValue(e.target.value); clearFieldError('name') }}
 * />
 * ```
 */
export function useHardenedRequest(): UseHardenedRequestReturn {
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
  }, [])

  const startRateLimitCountdown = useCallback((retryAfterSecs: number) => {
    clearCountdown()
    let remaining = retryAfterSecs
    setRateLimitCountdown(remaining)
    countdownRef.current = setInterval(() => {
      remaining -= 1
      if (remaining <= 0) {
        clearCountdown()
        setRateLimitCountdown(null)
      } else {
        setRateLimitCountdown(remaining)
      }
    }, 1000)
  }, [clearCountdown])

  const extractFieldErrors = useCallback((err: any): FieldErrors => {
    const details = err?.response?.data?.details || err?.data?.details
    if (!details || !Array.isArray(details)) return {}

    const errors: FieldErrors = {}
    details.forEach((d: any) => {
      const field = d.field || d.path || d.param || 'general'
      errors[field] = d.message || d.msg || 'Invalid value'
    })
    return errors
  }, [])

  const execute = useCallback(async <T>(apiCall: () => Promise<T>): Promise<T | null> => {
    setLoading(true)
    setFieldErrors({})
    setGlobalError(null)

    try {
      const result = await apiCall()
      return result
    } catch (err: any) {
      const status = err?.response?.status

      // 429 — Rate limited: start countdown
      if (status === 429) {
        const retryAfter = parseInt(err?.response?.headers?.['retry-after'] || '15', 10)
        startRateLimitCountdown(isNaN(retryAfter) ? 15 : retryAfter)
        setGlobalError('Too many requests. Please wait before trying again.')
        return null
      }

      // 400/422 — Structured validation error: map to fields
      if (status === 400 || status === 422) {
        const extracted = extractFieldErrors(err)
        if (Object.keys(extracted).length > 0) {
          setFieldErrors(extracted)
        } else {
          setGlobalError(
            err?.response?.data?.error ||
            err?.response?.data?.message ||
            'Validation failed. Please check your input.'
          )
        }
        return null
      }

      // 401 — Unauthenticated
      if (status === 401) {
        setGlobalError('Your session has expired. Please sign in again.')
        return null
      }

      // 403 — Unauthorized / admin gate
      if (status === 403) {
        setGlobalError("You don't have permission to perform this action.")
        return null
      }

      // 5xx or network errors
      setGlobalError(
        err?.response?.data?.error ||
        err?.message ||
        'An unexpected error occurred. Please try again.'
      )
      return null
    } finally {
      setLoading(false)
    }
  }, [extractFieldErrors, startRateLimitCountdown])

  const clearFieldError = useCallback((field: string) => {
    setFieldErrors(prev => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }, [])

  const clearAllErrors = useCallback(() => {
    setFieldErrors({})
    setGlobalError(null)
    clearCountdown()
    setRateLimitCountdown(null)
  }, [clearCountdown])

  const setFieldError = useCallback((field: string, message: string) => {
    setFieldErrors(prev => ({ ...prev, [field]: message }))
  }, [])

  return {
    loading,
    fieldErrors,
    rateLimitCountdown,
    globalError,
    execute,
    clearFieldError,
    clearAllErrors,
    setFieldError,
  }
}
