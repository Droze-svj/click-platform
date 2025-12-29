'use client'

import { useState, useCallback } from 'react'

interface UseRetryOptions {
  maxRetries?: number
  initialDelay?: number
  onRetry?: (attempt: number) => void
}

export function useRetry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: UseRetryOptions = {}
) {
  const { maxRetries = 3, initialDelay = 1000, onRetry } = options
  const [retryCount, setRetryCount] = useState(0)
  const [isRetrying, setIsRetrying] = useState(false)

  const executeWithRetry = useCallback(
    async (...args: Parameters<T>): Promise<ReturnType<T>> => {
      let lastError: Error | null = null

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            setIsRetrying(true)
            setRetryCount(attempt)
            onRetry?.(attempt)
            
            const delay = initialDelay * Math.pow(2, attempt - 1)
            await new Promise(resolve => setTimeout(resolve, delay))
          }

          const result = await fn(...args)
          setIsRetrying(false)
          setRetryCount(0)
          return result
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error')
          
          // Don't retry on client errors (4xx)
          if (error && typeof error === 'object' && 'status' in error) {
            const status = (error as any).status
            if (status >= 400 && status < 500) {
              throw error
            }
          }

          if (attempt === maxRetries) {
            setIsRetrying(false)
            throw lastError
          }
        }
      }

      throw lastError || new Error('Max retries exceeded')
    },
    [fn, maxRetries, initialDelay, onRetry]
  )

  return { executeWithRetry, retryCount, isRetrying }
}







