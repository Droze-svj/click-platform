'use client';

import { useEffect } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { logError, parseApiError } from '../utils/errorHandler';

export function GlobalErrorHandler({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Handle unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = parseApiError(event.reason);
      logError(error.message, 'GlobalErrorHandler', 'unhandledRejection', error);
      event.preventDefault(); // Prevent default browser behavior
    };

    // Handle uncaught errors
    const handleError = (event: ErrorEvent) => {
      const error = parseApiError(event.error);
      logError(error.message, 'GlobalErrorHandler', 'uncaughtError', error);
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  return <ErrorBoundary>{children}</ErrorBoundary>;
}






