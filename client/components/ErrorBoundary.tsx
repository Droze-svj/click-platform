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
  return (
    <Card className="border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-800 dark:text-red-400">
          <AlertCircle className="h-5 w-5" />
          Something went wrong
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-red-700 dark:text-red-300">
          {error?.message || 'An unexpected error occurred'}
        </p>
        
        {process.env.NODE_ENV !== 'production' && error?.stack && (
          <details className="mt-4">
            <summary className="text-xs text-red-600 dark:text-red-400 cursor-pointer">
              Error Details
            </summary>
            <pre className="mt-2 text-xs bg-red-100 dark:bg-red-900/50 p-2 rounded overflow-auto max-h-40">
              {error.stack}
            </pre>
          </details>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={resetErrorBoundary}
            className="px-4 py-2 border rounded-lg hover:bg-gray-100 flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.href = '/dashboard';
              }
            }}
            className="px-4 py-2 border rounded-lg hover:bg-gray-100 flex items-center gap-2"
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
            className="px-4 py-2 border rounded-lg hover:bg-gray-100"
          >
            Reload Page
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

const ErrorBoundary: React.FC<ErrorBoundaryProps> = ({ children, fallback, onError }) => {
  const handleError = (error: Error, info: React.ErrorInfo) => {
    // Log error
    try {
      logError(error, {
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
