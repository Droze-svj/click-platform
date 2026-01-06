/**
 * Enhanced retry mechanism for API calls and operations
 */

import { extractApiError } from './apiResponse'
import { logError } from './errorHandler'

interface RetryOptions {
  maxRetries?: number
  baseDelay?: number
  maxDelay?: number
  backoffFactor?: number
  retryableErrors?: string[]
  onRetry?: (attempt: number, error: any) => void
  onMaxRetries?: (error: any) => void
}

interface RetryState {
  attempt: number
  lastError: any
  startTime: number
}

export class RetryHandler {
  private static instance: RetryHandler
  private activeRetries = new Map<string, RetryState>()

  static getInstance(): RetryHandler {
    if (!RetryHandler.instance) {
      RetryHandler.instance = new RetryHandler()
    }
    return RetryHandler.instance
  }

  /**
   * Execute a function with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions & { operationId?: string } = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 30000,
      backoffFactor = 2,
      retryableErrors = ['network', 'timeout', 'server', 'rate_limit'],
      onRetry,
      onMaxRetries,
      operationId = `retry-${Date.now()}-${Math.random()}`
    } = options

    const startTime = Date.now()
    let lastError: any

    // Check if already retrying this operation
    const existingRetry = this.activeRetries.get(operationId)
    if (existingRetry && existingRetry.attempt >= maxRetries) {
      throw existingRetry.lastError
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        this.activeRetries.set(operationId, {
          attempt,
          lastError: null,
          startTime
        })

        const result = await operation()

        // Success - clean up
        this.activeRetries.delete(operationId)

        // Log performance if it took multiple attempts
        if (attempt > 0) {
          const duration = Date.now() - startTime
          console.log(`[RetryHandler] Operation succeeded after ${attempt} retries in ${duration}ms`)
        }

        return result

      } catch (error) {
        lastError = error
        const errorInfo = extractApiError(error)

        // Update retry state
        this.activeRetries.set(operationId, {
          attempt,
          lastError: error,
          startTime
        })

        // Check if error is retryable
        const isRetryable = errorInfo.retryable ||
                           retryableErrors.includes(errorInfo.category) ||
                           (errorInfo.code && [408, 429, 500, 502, 503, 504].includes(Number(errorInfo.code)))

        // If this was the last attempt or error is not retryable
        if (attempt >= maxRetries || !isRetryable) {
          this.activeRetries.delete(operationId)

          if (attempt >= maxRetries && maxRetries > 0) {
            logError(`Max retries (${maxRetries}) exceeded for operation`, 'RetryHandler', operationId, {
              errorInfo,
              totalAttempts: attempt + 1,
              duration: Date.now() - startTime
            })

            onMaxRetries?.(error)
          }

          throw error
        }

        // Calculate delay with exponential backoff and jitter
        const delay = Math.min(
          baseDelay * Math.pow(backoffFactor, attempt),
          maxDelay
        )

        // Add jitter (±25%)
        const jitter = delay * 0.25 * (Math.random() * 2 - 1)
        const finalDelay = Math.max(100, delay + jitter)

        // Log retry attempt
        logError(`Retry attempt ${attempt + 1}/${maxRetries + 1} in ${finalDelay}ms`, 'RetryHandler', operationId, {
          errorInfo,
          delay: finalDelay,
          nextAttempt: attempt + 1
        })

        onRetry?.(attempt + 1, error)

        // Wait before retrying
        await this.delay(finalDelay)
      }
    }

    // This should never be reached, but just in case
    throw lastError
  }

  /**
   * Create a retryable API call wrapper
   */
  createRetryableApiCall<T extends any[], R>(
    apiFunction: (...args: T) => Promise<R>,
    retryOptions: RetryOptions = {}
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      const operationId = `api-${apiFunction.name}-${Date.now()}`

      return this.executeWithRetry(
        () => apiFunction(...args),
        {
          ...retryOptions,
          operationId,
          onRetry: (attempt, error) => {
            console.warn(`[RetryHandler] API call retry ${attempt} for ${apiFunction.name}:`, error.message)
            retryOptions.onRetry?.(attempt, error)
          },
          onMaxRetries: (error) => {
            console.error(`[RetryHandler] API call failed after max retries for ${apiFunction.name}:`, error)
            retryOptions.onMaxRetries?.(error)
          }
        }
      )
    }
  }

  /**
   * Get retry statistics
   */
  getRetryStats(operationId?: string): { active: number, totalAttempts: number } {
    if (operationId) {
      const state = this.activeRetries.get(operationId)
      return {
        active: state ? 1 : 0,
        totalAttempts: state?.attempt || 0
      }
    }

    return {
      active: this.activeRetries.size,
      totalAttempts: Array.from(this.activeRetries.values()).reduce((sum, state) => sum + state.attempt, 0)
    }
  }

  /**
   * Cancel active retries for an operation
   */
  cancelRetries(operationId: string): void {
    this.activeRetries.delete(operationId)
  }

  /**
   * Clear all active retries
   */
  clearAllRetries(): void {
    this.activeRetries.clear()
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Export singleton instance
export const retryHandler = RetryHandler.getInstance()

// Convenience functions
export const withRetry = retryHandler.executeWithRetry.bind(retryHandler)
export const createRetryableApiCall = retryHandler.createRetryableApiCall.bind(retryHandler)



