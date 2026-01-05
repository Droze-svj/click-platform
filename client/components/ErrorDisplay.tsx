'use client';

import React from 'react';
import { AlertCircle, X, AlertTriangle, Info } from 'lucide-react';
import { AppError, getUserFriendlyMessage } from '../utils/errorHandler';
import { cn } from '../lib/utils';
import ErrorRecovery from './ErrorRecovery';

interface ErrorDisplayProps {
  error: AppError | Error | string;
  onDismiss?: () => void;
  onRetry?: () => void;
  variant?: 'error' | 'warning' | 'info';
  className?: string;
  showRecovery?: boolean;
}

export default function ErrorDisplay({
  error,
  onDismiss,
  onRetry,
  variant = 'error',
  className,
  showRecovery = true,
}: ErrorDisplayProps) {
  const errorMessage = typeof error === 'string'
    ? error
    : error instanceof AppError
    ? getUserFriendlyMessage(error)
    : error.message || 'An error occurred';

  const variantStyles = {
    error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-300',
    info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300',
  };

  const icons = {
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  };

  const Icon = icons[variant];

  return (
    <div
      className={cn(
        'border rounded-lg p-4 flex items-start gap-3',
        variantStyles[variant],
        className
      )}
    >
      <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium">{errorMessage}</p>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-current opacity-70 hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}


