'use client'

import { useState } from 'react'
import { apiGet, apiPost, apiPut, apiDelete, handleApiError } from '../lib/api'

interface UseApiOptions {
  onSuccess?: (data: any) => void
  onError?: (error: string) => void
}

export function useApi() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const request = async <T = any>(
    method: 'get' | 'post' | 'put' | 'delete',
    endpoint: string,
    data?: any,
    options?: UseApiOptions
  ): Promise<T | null> => {
    setLoading(true)
    setError(null)

    try {
      let response
      switch (method) {
        case 'get':
          response = await apiGet<T>(endpoint)
          break
        case 'post':
          response = await apiPost<T>(endpoint, data)
          break
        case 'put':
          response = await apiPut<T>(endpoint, data)
          break
        case 'delete':
          response = await apiDelete(endpoint)
          break
      }

      const result = (response as any)?.data || response
      if (options?.onSuccess) {
        options.onSuccess(result)
      }
      return result as T
    } catch (err) {
      const errorMessage = handleApiError(err)
      setError(errorMessage)
      if (options?.onError) {
        options.onError(errorMessage)
      }
      return null
    } finally {
      setLoading(false)
    }
  }

  return { request, loading, error, setError }
}







