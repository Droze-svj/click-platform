'use client';

import { useCallback } from 'react';
import { useToast } from '../contexts/ToastContext';
import {
  parseApiError,
  getUserFriendlyMessage,
  AppError,
  logError,
} from '../utils/errorHandler';

export function useErrorHandler() {
  const { showToast } = useToast();

  const handleError = useCallback(
    (error: unknown, options?: { showToast?: boolean; log?: boolean }) => {
      const { showToast: showToastOption = true, log: logOption = true } = options || {};

      // Parse error
      const appError = parseApiError(error);

      // Log error
      if (logOption) {
        logError(appError.message, 'useErrorHandler', 'handleError', {
          code: appError.code,
          details: appError.details,
        });
      }

      // Show toast notification
      if (showToastOption) {
        const message = getUserFriendlyMessage(appError);
        showToast(message, 'error');
      }

      return appError;
    },
    [showToast]
  );

  const handleAsyncError = useCallback(
    async <T>(
      fn: () => Promise<T>,
      options?: { showToast?: boolean; log?: boolean }
    ): Promise<T | null> => {
      try {
        return await fn();
      } catch (error) {
        handleError(error, options);
        return null;
      }
    },
    [handleError]
  );

  return {
    handleError,
    handleAsyncError,
  };
}
