'use client';

import React from 'react';
import { ErrorBoundary as ReactErrorBoundary, FallbackProps } from 'react-error-boundary';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { logError } from '../utils/errorHandler';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const [retryCount, setRetryCount] = React.useState(0)
  const [showDetails, setShowDetails] = React.useState(false)
  const [hasReported, setHasReported] = React.useState(false)
  const [isRecovering, setIsRecovering] = React.useState(false)
  const [recoveryAttempted, setRecoveryAttempted] = React.useState(false)

  // Enhanced error reporting with retry logic
  const reportError = React.useCallback(async (errorData: any) => {
    if (hasReported) return

    try {
      const shouldSendDebug = process.env.NODE_ENV === 'development' ||
                             (typeof localStorage !== 'undefined' && localStorage.getItem('debug_logging') === 'enabled')

      if (!shouldSendDebug) return

      await fetch('http://127.0.0.1:5557/ingest/ff7d38f2-f61b-412e-9a79-ebc734d5bd4a', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'ErrorBoundary.tsx',
          message: 'error_boundary_activated',
          data: {
            ...errorData,
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run-error-boundary-debug',
            retryCount,
            severity: 'high',
            category: 'react'
          }
        }),
        signal: AbortSignal.timeout(5000)
      })
      setHasReported(true)
    } catch (fetchErr) {
      console.warn('[ErrorBoundary] Debug log send failed:', fetchErr instanceof Error ? fetchErr.message : String(fetchErr))
    }
  }, [hasReported, retryCount])

  // Enhanced error data collection
  const getErrorDetails = React.useCallback(() => {
    if (!error) return null

    return {
      errorMessage: error.message,
      errorStack: error.stack,
      errorName: error.name,
      componentStack: error.stack?.split('\n').slice(0, 10).join('\n'),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'Unknown',
      referrer: typeof document !== 'undefined' ? document.referrer : 'Unknown',
      timestamp: new Date().toISOString(),
      viewport: typeof window !== 'undefined' ? {
        width: window.innerWidth,
        height: window.innerHeight
      } : null,
      memoryInfo: typeof performance !== 'undefined' && (performance as any).memory ? {
        used: (performance as any).memory.usedJSHeapSize,
        total: (performance as any).memory.totalJSHeapSize,
        limit: (performance as any).memory.jsHeapSizeLimit
      } : null,
      localStorage: typeof localStorage !== 'undefined' ? {
        length: localStorage.length,
        keys: Object.keys(localStorage).slice(0, 10) // Only first 10 keys for privacy
      } : null
    }
  }, [error])

  // Report error on mount
  React.useEffect(() => {
    if (error) {
      const errorDetails = getErrorDetails()
      if (errorDetails) {
        reportError(errorDetails)
      }
    }
  }, [error, reportError, getErrorDetails])

  // Automatic recovery for certain error types
  const attemptRecovery = React.useCallback(async () => {
    if (recoveryAttempted) return

    setIsRecovering(true)
    setRecoveryAttempted(true)

    try {
      console.log('🔄 Attempting automatic error recovery...')

      // Clear potentially corrupted cache/localStorage
      if (typeof window !== 'undefined') {
        // Clear service worker dynamic caches
        if ('caches' in window) {
          const cacheNames = await caches.keys()
          for (const cacheName of cacheNames) {
            if (cacheName.includes('dynamic') || cacheName.includes('api')) {
              await caches.delete(cacheName)
            }
          }
        }

        // Clear potentially corrupted localStorage items
        const keysToClean = ['user-preferences', 'cached-routes', 'offline-queue', 'analytics-events']
        keysToClean.forEach(key => {
          try {
            const item = localStorage.getItem(key)
            if (item && item.length > 1024 * 1024) { // Remove items > 1MB
              localStorage.removeItem(key)
            }
          } catch (e) {
            localStorage.removeItem(key)
          }
        })

        // Reset error state
        setTimeout(() => {
          resetErrorBoundary()
          setIsRecovering(false)
        }, 1000)
      }
    } catch (recoveryError) {
      console.warn('⚠️ Recovery failed:', recoveryError)
      setIsRecovering(false)
    }
  }, [recoveryAttempted, resetErrorBoundary])

  // Enhanced retry with exponential backoff and recovery
  const handleRetry = React.useCallback(() => {
    const newRetryCount = retryCount + 1
    setRetryCount(newRetryCount)

    // Attempt automatic recovery for recoverable errors
    if (!recoveryAttempted && isRecoverableError(error)) {
      attemptRecovery()
      return
    }

    // Exponential backoff for retries
    const delay = Math.min(1000 * Math.pow(2, newRetryCount - 1), 10000)
    setTimeout(() => {
      resetErrorBoundary()
    }, delay)
  }, [retryCount, resetErrorBoundary, recoveryAttempted, attemptRecovery, error])

  // Check if error is recoverable
  const isRecoverableError = React.useCallback((error: Error | null): boolean => {
    if (!error) return false

    const recoverablePatterns = [
      /network/i,
      /timeout/i,
      /connection/i,
      /fetch/i,
      /loading chunk/i,
      /loadable/i,
      /chunk/i,
      /module/i
    ]

    return recoverablePatterns.some(pattern =>
      pattern.test(error.message) || pattern.test(error.name)
    )
  }, [])

  // Auto-attempt recovery on mount for recoverable errors
  React.useEffect(() => {
    if (error && isRecoverableError(error) && !recoveryAttempted && retryCount === 0) {
      // Delay to allow user to see the error first
      const timer = setTimeout(() => {
        attemptRecovery()
      }, 3000)

      return () => clearTimeout(timer)
    }
  }, [error, isRecoverableError, recoveryAttempted, attemptRecovery, retryCount])

  const errorDetails = getErrorDetails()

  return (
    <Card className="border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-800 dark:text-red-400">
          <AlertCircle className="h-5 w-5" />
          Something went wrong
          {retryCount > 0 && (
            <span className="text-xs bg-red-100 dark:bg-red-800 px-2 py-1 rounded-full">
              Retry #{retryCount}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-white dark:bg-red-950/50 p-3 rounded-lg border border-red-200 dark:border-red-700">
          <p className="text-sm text-red-700 dark:text-red-300 font-medium">
            {error?.message || 'An unexpected error occurred'}
          </p>
          {error?.name && error.name !== 'Error' && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              Error Type: {error.name}
            </p>
          )}
        </div>

        {/* Error recovery suggestions */}
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-700">
          <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
            Recovery Options:
          </h4>
          <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
            <li>• Automatic recovery {isRecovering ? '(in progress...)' : recoveryAttempted ? '(attempted)' : '(available)'}</li>
            <li>• Manual retry with exponential backoff</li>
            <li>• Cache clearing and state reset</li>
            <li>• Navigate to safe location</li>
            <li>• Full page reload as last resort</li>
          </ul>
        </div>

        {isRecoverableError(error) && !recoveryAttempted && (
          <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-700">
            <p className="text-xs text-green-700 dark:text-green-400">
              🔄 This error appears recoverable. Automatic recovery will be attempted in a few seconds...
            </p>
          </div>
        )}

        {process.env.NODE_ENV !== 'production' && error?.stack && (
          <details className="mt-4">
            <summary
              className="text-xs text-red-600 dark:text-red-400 cursor-pointer hover:text-red-700 dark:hover:text-red-300 transition-colors flex items-center gap-2"
              onClick={() => setShowDetails(!showDetails)}
            >
              <span>{showDetails ? '▼' : '▶'}</span>
              Technical Details (for developers)
            </summary>
            {showDetails && (
              <div className="mt-2 space-y-2">
                <pre className="text-xs bg-red-100 dark:bg-red-900/50 p-2 rounded overflow-auto max-h-40 border">
                  {error.stack}
                </pre>
                {errorDetails && (
                  <div className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded space-y-1">
                    <div><strong>URL:</strong> {errorDetails.url}</div>
                    <div><strong>Time:</strong> {errorDetails.timestamp}</div>
                    {errorDetails.viewport && (
                      <div><strong>Viewport:</strong> {errorDetails.viewport.width}×{errorDetails.viewport.height}</div>
                    )}
                    {errorDetails.memoryInfo && (
                      <div><strong>Memory:</strong> {Math.round(errorDetails.memoryInfo.used / 1024 / 1024)}MB used</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </details>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            onClick={handleRetry}
            disabled={retryCount >= 3}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg flex items-center gap-2 transition-colors disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 ${retryCount >= 3 ? '' : 'animate-spin'}`} />
            {retryCount >= 3 ? 'Max Retries Reached' : 'Try Again'}
          </button>
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.href = '/dashboard';
              }
            }}
            className="px-4 py-2 border border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Home className="h-4 w-4" />
            Go Home
          </button>
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.reload();
              }
            }}
            className="px-4 py-2 border border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            Reload Page
          </button>
        </div>

        {retryCount > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Retry attempts: {retryCount}/3 • This helps recover from temporary issues
          </p>
        )}
      </CardContent>
    </Card>
  );
}

const ErrorBoundary: React.FC<ErrorBoundaryProps> = ({ children, fallback, onError }) => {
  const handleError = (error: Error, info: React.ErrorInfo) => {

    // Log error
    try {
      logError(error, 'ErrorBoundary', 'error-caught', {
        componentStack: info.componentStack || '',
        errorBoundary: true,
      });
    } catch (logErr) {
      console.error('Error logging failed:', logErr);
    }

    // Call custom error handler if provided
    if (onError) {
      try {
        onError(error, info);
      } catch (handlerErr) {
        console.error('Error handler failed:', handlerErr);
      }
    }
  };

  return (
    <ReactErrorBoundary
      FallbackComponent={fallback ? () => <>{fallback}</> : ErrorFallback}
      onError={handleError}
      onReset={() => {
        // Reset logic if needed
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
};

ErrorBoundary.displayName = 'ErrorBoundary';

export { ErrorBoundary };
export default ErrorBoundary;
