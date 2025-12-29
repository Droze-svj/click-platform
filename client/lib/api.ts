/**
 * API Client Utilities
 * 
 * Provides a centralized API client for making authenticated requests to the backend API.
 * Handles token management, request/response interceptors, and error handling.
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios'
import { extractApiError } from '../utils/apiResponse'

/**
 * API base URL from environment variables.
 * Exported for use in components that need the URL directly.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

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
function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api',
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 30000, // 30 seconds
  })

  // Request interceptor: Add auth token
  client.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    },
    (error) => {
      return Promise.reject(error)
    }
  )

  // Response interceptor: Handle errors globally
  client.interceptors.response.use(
    (response) => response,
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
  const response = await api.get<T>(endpoint, config)
  return response.data
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
  const response = await api.post<T>(endpoint, data, config)
  return response.data
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
  const response = await api.put<T>(endpoint, data, config)
  return response.data
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
  const response = await api.patch<T>(endpoint, data, config)
  return response.data
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
  const response = await api.delete<T>(endpoint, config)
  return response.data
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
  return extractApiError(error)
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
