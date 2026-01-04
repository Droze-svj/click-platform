// Enhanced error handling and debugging system
import { errorMonitor } from './errorMonitor'

interface ErrorData {
  stack?: string
  component?: string
  action?: string
  data?: any
  userAgent?: string
}

export class AppErrorHandler {
  private static instance: AppErrorHandler
  private errors: ErrorData[] = []
  private maxErrors = 50

  static getInstance(): AppErrorHandler {
    if (!AppErrorHandler.instance) {
      AppErrorHandler.instance = new AppErrorHandler()
    }
    return AppErrorHandler.instance
  }

  // Enhanced error logging with comprehensive debugging
  logError(error: Error | string, component?: string, action?: string, data?: any) {
    const errorData: ErrorData = {
      stack: typeof error === 'object' ? error.stack : undefined,
      component,
      action,
      data,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
    }

    this.errors.push(errorData)

    // Keep only the most recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors)
    }

    // Enhanced debug logging with error recovery
    this.sendToDebugLog(errorData).catch(debugErr => {
      // If debug logging fails, still log to console as fallback
      console.warn('[AppError] Debug logging failed:', debugErr)
    })

    // Enhanced console logging with structured data
    if (process.env.NODE_ENV === 'development') {
      const errorMessage = typeof error === 'string' ? error : error.message || 'Unknown error'
      console.error('[AppError]', {
        message: errorMessage,
        component,
        action,
        data,
        stack: typeof error === 'object' ? error.stack : undefined,
        timestamp: new Date().toISOString(),
        url: typeof window !== 'undefined' ? window.location.href : 'Server',
      })
    }

    // Monitor error with comprehensive tracking
    errorMonitor.monitorError(error, component, action, data)

    // Log to performance API if available
    if (typeof performance !== 'undefined' && performance.mark) {
      try {
        performance.mark(`error-${component || 'unknown'}-${Date.now()}`)
      } catch (perfErr) {
        // Ignore performance API errors
      }
    }
  }

  // Enhanced debug logging with proper error handling
  private async sendToDebugLog(errorData: ErrorData): Promise<void> {
    try {
      // Only send debug logs in development or when explicitly enabled
      const shouldSendDebug = process.env.NODE_ENV === 'development' ||
                             (typeof localStorage !== 'undefined' && localStorage.getItem('debug_logging') === 'enabled')

      if (!shouldSendDebug) {
        return
      }

      await fetch('http://127.0.0.1:5557/ingest/ff7d38f2-f61b-412e-9a79-ebc734d5bd4a', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          location: 'errorHandler.ts',
          message: 'app_error',
          data: {
            ...errorData,
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run-error-handler',
            severity: this.getErrorSeverity(errorData),
            category: this.categorizeError(errorData),
          }
        }),
        // Add timeout to prevent hanging
        signal: AbortSignal.timeout(5000)
      }).catch(fetchErr => {
        // Silently handle fetch errors to prevent error loops
        if (process.env.NODE_ENV === 'development') {
          console.warn('[AppError] Debug log send failed:', fetchErr.message)
        }
      })
    } catch (sendErr) {
      // Never throw from error logging to prevent error loops
      if (process.env.NODE_ENV === 'development') {
        console.warn('[AppError] Debug log send error:', sendErr)
      }
    }
  }

  // Categorize errors for better debugging
  private categorizeError(errorData: ErrorData): string {
    if (errorData.component?.includes('API') || errorData.action?.includes('fetch')) {
      return 'network'
    }
    if (errorData.component?.includes('Auth') || errorData.action?.includes('login')) {
      return 'authentication'
    }
    if (errorData.data?.errorBoundary) {
      return 'react'
    }
    if (errorData.stack?.includes('WebGL')) {
      return 'graphics'
    }
    return 'application'
  }

  // Determine error severity
  private getErrorSeverity(errorData: ErrorData): 'low' | 'medium' | 'high' | 'critical' {
    if (errorData.data?.errorBoundary || errorData.component === 'Global') {
      return 'high'
    }
    if (errorData.component?.includes('Auth') && errorData.action?.includes('login')) {
      return 'medium'
    }
    if (errorData.data?.networkError) {
      return 'low'
    }
    return 'medium'
  }

  // Get recent errors
  getRecentErrors(count: number = 10): ErrorData[] {
    return this.errors.slice(-count)
  }

  // Clear error history
  clearErrors() {
    this.errors = []
  }

  // Export errors for debugging
  exportErrors(): string {
    return JSON.stringify(this.errors, null, 2)
  }
}

// Global error handler instance
export const errorHandler = AppErrorHandler.getInstance()

// React error boundary helper
export const logReactError = (error: Error, errorInfo: any, componentName?: string) => {
  errorHandler.logError(
    error,
    componentName || 'ReactComponent',
    'render',
    {
      errorBoundary: true,
      errorInfo,
      componentStack: errorInfo?.componentStack
    }
  )
}

// WebGL error helper
export const logWebGLError = (operation: string, error?: any) => {
  errorHandler.logError(
    `WebGL Error during ${operation}`,
    'WebGLRenderer',
    operation,
    { webglError: error }
  )
}

// Network error helper
export const logNetworkError = (url: string, operation: string, error?: any) => {
  errorHandler.logError(
    `Network Error: ${operation} failed`,
    'Network',
    operation,
    { url, networkError: error }
  )
}

// Template error helper
export const logTemplateError = (templateId: string, operation: string, error?: any) => {
  errorHandler.logError(
    `Template Error: ${operation} failed`,
    'TemplateSystem',
    operation,
    { templateId, templateError: error }
  )
}

// Performance monitoring
export const logPerformance = (operation: string, duration: number, data?: any) => {
  try {
    console.log(`Performance: ${operation} took ${duration}ms`, data)
  } catch (err) {
    console.error('Performance log failed:', err)
  }
}

// Performance measurement helper
export const measurePerformance = async <T>(
  operation: string,
  fn: () => Promise<T>,
  data?: any
): Promise<T> => {
  const start = performance.now()
  try {
    const result = await fn()
    const duration = performance.now() - start
    logPerformance(operation, duration, { success: true, ...data })
    return result
  } catch (error) {
    const duration = performance.now() - start
    logPerformance(operation, duration, { success: false, error: error.message, ...data })
    throw error
  }
}

// Export individual functions for component imports
export const logError = (error: Error | string, component?: string, action?: string, data?: any) => {
  errorHandler.logError(error, component, action, data)
}

// API error parsing helper
export const parseApiError = (error: any): { message: string; code?: string; details?: any } => {
  if (typeof error === 'string') {
    return { message: error }
  }

  if (error?.response?.data) {
    const data = error.response.data
    return {
      code: data.code || data.status,
      details: data.details || data
    }
  }

  if (error?.message) {
    return { message: error.message, details: error }
  }

  return { message: 'An unknown error occurred', details: error }
}

// AppError class for type safety
export class AppError extends Error {
  public code?: string
  public details?: any
  public component?: string
  public action?: string

  constructor(message: string, code?: string, details?: any, component?: string, action?: string) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.details = details
    this.component = component
    this.action = action
  }
}

// User-friendly message helper
export const getUserFriendlyMessage = (error: any): string => {
  const parsed = parseApiError(error)

  // Map common error codes to user-friendly messages
  const friendlyMessages: Record<string, string> = {
    'NETWORK_ERROR': 'Please check your internet connection and try again.',
    'UNAUTHORIZED': 'Your session has expired. Please sign in again.',
    'FORBIDDEN': 'You don\'t have permission to perform this action.',
    'NOT_FOUND': 'The requested resource was not found.',
    'VALIDATION_ERROR': 'Please check your input and try again.',
    'SERVER_ERROR': 'Something went wrong on our end. Please try again later.',
    'TIMEOUT': 'The request took too long. Please try again.',
    'QUOTA_EXCEEDED': 'You\'ve reached your usage limit for this feature.',
    'FILE_TOO_LARGE': 'The file you selected is too large. Please choose a smaller file.',
    'UNSUPPORTED_FORMAT': 'This file format is not supported. Please try a different file.',
  }

  // Check if we have a specific friendly message for this error code
  if (parsed.code && friendlyMessages[parsed.code]) {
    return friendlyMessages[parsed.code]
  }

  // Return the parsed message if it's user-friendly, otherwise a generic message
  if (parsed.message && parsed.message.length < 100 && !parsed.message.includes('Error:') && !parsed.message.includes('Exception:')) {
    return parsed.message
  }

  // Fallback to generic message
  return 'Something went wrong. Please try again or contact support if the problem persists.'
}

// Global error boundary for unhandled errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    errorHandler.logError(
      event.error || event.message,
      'Global',
      'unhandled_error',
      {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        globalError: true
      }
    )
  })

  window.addEventListener('unhandledrejection', (event) => {
    errorHandler.logError(
      event.reason || 'Unhandled Promise Rejection',
      'Global',
      'unhandled_rejection',
      {
        promise: event.promise,
        globalRejection: true
      }
    )
  })
}