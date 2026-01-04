/**
 * Standardized API Response Handler
 * 
 * This module provides utilities for extracting and handling API responses
 * in a consistent manner across the application.
 */

interface ApiResponse<T = any> {
  success: boolean
  message?: string
  data?: T
  error?: string
}

/**
 * Extracts the data payload from an API response.
 * 
 * @template T - The expected type of the data
 * @param response - API response object (Axios response or plain object)
 * @returns The extracted data or null if not found
 * 
 * @remarks
 * Handles multiple response formats:
 * - Standard format: `{ success: true, data: ... }`
 * - Direct data format: Direct object or array
 * - Axios response format: `response.data`
 * 
 * @example
 * ```typescript
 * const response = await axios.get('/api/users');
 * const users = extractApiData<User[]>(response);
 * ```
 */
export function extractApiData<T = any>(response: any): T | null {

  // Handle axios response object
  if (response?.data) {
    const apiResponse = response.data as ApiResponse<T>


    // Standard format: { success: true, data: ... }
    if (apiResponse.success !== undefined) {
      return apiResponse.data || null
    }

    // Direct data (backward compatibility)
    return apiResponse as T
  }

  // Already extracted data
  if (response?.success !== undefined) {
    return (response as ApiResponse<T>).data || null
  }

  // Direct data
  return response as T
}

/**
 * Enhanced API error extraction with comprehensive error handling
 *
 * @param error - Error object (Axios error, Error instance, or plain object)
 * @param context - Additional context for better error messages
 * @returns A comprehensive error object with user-friendly message and metadata
 */
export function extractApiError(error: any, context?: {
  operation?: string
  endpoint?: string
  retryable?: boolean
}): {
  message: string
  code?: string | number
  details?: any
  retryable: boolean
  severity: 'low' | 'medium' | 'high'
  category: string
} {
  let message = 'An error occurred'
  let code: string | number | undefined
  let details: any
  let retryable = false
  let severity: 'low' | 'medium' | 'high' = 'medium'
  let category = 'unknown'

  try {
    // Handle network errors
    if (!error?.response && error?.code) {
      category = 'network'
      switch (error.code) {
        case 'NETWORK_ERROR':
        case 'ERR_NETWORK':
          message = 'Network connection failed. Please check your internet connection.'
          retryable = true
          severity = 'medium'
          break
        case 'TIMEOUT':
        case 'ECONNABORTED':
          message = 'Request timed out. Please try again.'
          retryable = true
          severity = 'low'
          break
        case 'ERR_CONNECTION_REFUSED':
          message = 'Server is currently unavailable. Please try again later.'
          retryable = true
          severity = 'high'
          break
        default:
          message = 'Network error occurred. Please try again.'
          retryable = true
      }
    }

    // Handle HTTP errors
    else if (error?.response) {
      const status = error.response.status
      code = status
      details = error.response.data

      // Extract error from response data
      if (error.response.data) {
        const apiResponse = error.response.data as ApiResponse
        message = apiResponse.error || apiResponse.message || message
      }

      // Handle specific HTTP status codes
      switch (status) {
        case 400:
          category = 'validation'
          message = message || 'Invalid request. Please check your input.'
          severity = 'low'
          break
        case 401:
          category = 'authentication'
          message = 'Your session has expired. Please sign in again.'
          severity = 'medium'
          retryable = false
          break
        case 403:
          category = 'authorization'
          message = 'You don\'t have permission to perform this action.'
          severity = 'medium'
          break
        case 404:
          category = 'not_found'
          message = 'The requested resource was not found.'
          severity = 'low'
          break
        case 429:
          category = 'rate_limit'
          message = 'Too many requests. Please wait a moment and try again.'
          retryable = true
          severity = 'low'
          break
        case 500:
        case 502:
        case 503:
        case 504:
          category = 'server'
          message = 'Server error occurred. Please try again later.'
          retryable = true
          severity = 'high'
          break
        default:
          category = 'http'
          severity = status >= 500 ? 'high' : 'medium'
          retryable = status >= 500
      }
    }

    // Handle direct data errors
    else if (error?.data) {
      const apiResponse = error.data as ApiResponse
      message = apiResponse.error || apiResponse.message || message
      category = 'api'
    }

    // Handle error instances
    else if (error?.message) {
      message = error.message
      category = 'application'

      // Check for specific error patterns
      if (message.includes('timeout')) {
        retryable = true
        severity = 'low'
        category = 'timeout'
      } else if (message.includes('network') || message.includes('fetch')) {
        retryable = true
        severity = 'medium'
        category = 'network'
      }
    }

    // Override retryable based on context if provided
    if (context?.retryable !== undefined) {
      retryable = context.retryable
    }

    // Enhance message with context
    if (context?.operation) {
      message = `${context.operation} failed: ${message}`
    }

  } catch (parseError) {
    // If error parsing fails, return a safe fallback
    console.warn('[extractApiError] Error parsing failed:', parseError)
    message = 'An unexpected error occurred while processing the error response.'
    category = 'parse_error'
    severity = 'medium'
  }

  return {
    message,
    code,
    details,
    retryable,
    severity,
    category
  }
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use extractApiError for enhanced error handling
 */
export function extractApiErrorLegacy(error: any): string {
  const result = extractApiError(error)
  return result.message
}

/**
 * Checks if an API response indicates success.
 * 
 * @param response - API response object
 * @returns True if the response indicates success, false otherwise
 * 
 * @remarks
 * Checks for:
 * - `response.data.success === true`
 * - `response.success === true`
 * - Valid HTTP status code (200-299)
 * 
 * @example
 * ```typescript
 * const response = await axios.get('/api/users');
 * if (isApiSuccess(response)) {
 *   // Handle success
 * }
 * ```
 */
export function isApiSuccess(response: any): boolean {
  if (response?.data?.success !== undefined) {
    return response.data.success === true
  }
  
  if (response?.success !== undefined) {
    return response.success === true
  }
  
  // Assume success if no error status code
  return !response?.status || (response.status >= 200 && response.status < 300)
}
