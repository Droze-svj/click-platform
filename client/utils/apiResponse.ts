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
 * Extracts a user-friendly error message from an API error response.
 * 
 * @param error - Error object (Axios error, Error instance, or plain object)
 * @returns A user-friendly error message string
 * 
 * @remarks
 * Handles multiple error formats:
 * - Axios errors: `error.response.data.error` or `error.response.data.message`
 * - Error instances: `error.message`
 * - String errors: Returns the string directly
 * - Default: Returns 'An error occurred'
 * 
 * @example
 * ```typescript
 * try {
 *   await axios.post('/api/users', data);
 * } catch (error) {
 *   const message = extractApiError(error);
 *   showToast(message, 'error');
 * }
 * ```
 */
export function extractApiError(error: any): string {
  if (error?.response?.data) {
    const apiResponse = error.response.data as ApiResponse
    return apiResponse.error || apiResponse.message || error.message || 'An error occurred'
  }
  
  if (error?.data) {
    const apiResponse = error.data as ApiResponse
    return apiResponse.error || apiResponse.message || error.message || 'An error occurred'
  }
  
  return error?.message || 'An error occurred'
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
