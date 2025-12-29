'use client'

import { useState, useCallback } from 'react'

interface UseOptimisticUpdateOptions<T> {
  initialData: T
  updateFn: (data: T) => Promise<T>
  onError?: (error: Error, rollbackData: T) => void
}

/**
 * Hook for optimistic updates - immediately update UI, rollback on error
 */
export function useOptimisticUpdate<T>({
  initialData,
  updateFn,
  onError
}: UseOptimisticUpdateOptions<T>) {
  const [data, setData] = useState<T>(initialData)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const update = useCallback(async (optimisticData: T) => {
    const previousData = data
    
    // Optimistically update UI
    setData(optimisticData)
    setIsUpdating(true)
    setError(null)

    try {
      // Perform actual update
      const result = await updateFn(optimisticData)
      setData(result)
      setIsUpdating(false)
      return result
    } catch (err) {
      // Rollback on error
      const error = err instanceof Error ? err : new Error('Update failed')
      setData(previousData)
      setError(error)
      setIsUpdating(false)
      
      if (onError) {
        onError(error, previousData)
      }
      
      throw error
    }
  }, [data, updateFn, onError])

  const reset = useCallback(() => {
    setData(initialData)
    setError(null)
    setIsUpdating(false)
  }, [initialData])

  return {
    data,
    isUpdating,
    error,
    update,
    reset
  }
}
