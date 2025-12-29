'use client'

import { useState } from 'react'
import axios, { AxiosError } from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

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
      const token = localStorage.getItem('token')
      const config = {
        headers: {
          Authorization: token ? `Bearer ${token}` : undefined,
          'Content-Type': data instanceof FormData ? 'multipart/form-data' : 'application/json'
        }
      }

      let response
      switch (method) {
        case 'get':
          response = await axios.get(`${API_URL}${endpoint}`, config)
          break
        case 'post':
          response = await axios.post(`${API_URL}${endpoint}`, data, config)
          break
        case 'put':
          response = await axios.put(`${API_URL}${endpoint}`, data, config)
          break
        case 'delete':
          response = await axios.delete(`${API_URL}${endpoint}`, config)
          break
      }

      const result = response.data.data || response.data
      if (options?.onSuccess) {
        options.onSuccess(result)
      }
      return result
    } catch (err) {
      const axiosError = err as AxiosError
      const errorMessage =
        (axiosError.response?.data as any)?.error ||
        (axiosError.response?.data as any)?.message ||
        axiosError.message ||
        'An error occurred'

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







