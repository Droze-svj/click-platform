'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { AlertCircle, RefreshCw, CheckCircle, XCircle, Lightbulb } from 'lucide-react';
import { AppError } from '../utils/errorHandler';
import { cn } from '../lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

interface RecoverySuggestion {
  actions: string[];
  retryable: boolean;
  retryAfter?: number;
}

interface ErrorRecoveryProps {
  error: AppError;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export default function ErrorRecovery({
  error,
  onRetry,
  onDismiss,
  className,
}: ErrorRecoveryProps) {
  const { t } = useTranslation();
  const [retrying, setRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  // Extract recovery info from error
  const recovery = (error as any).recovery as RecoverySuggestion | undefined;

  if (!recovery) {
    return null;
  }

  const handleRetry = async () => {
    if (!onRetry || retrying) return;

    setRetrying(true);
    setRetryCount(prev => prev + 1);

    try {
      await onRetry();
    } catch (err) {
      // Error handled by parent
    } finally {
      setRetrying(false);
      if (recovery.retryAfter) {
        setRetryAfter(recovery.retryAfter);
        const timer = setInterval(() => {
          setRetryAfter(prev => {
            if (prev === null || prev <= 1) {
              clearInterval(timer);
              return null;
            }
            return prev - 1;
          });
        }, 1000);
      }
    }
  };

  return (
    <Card className={cn('border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-300">
          <Lightbulb className="h-5 w-5" />
          {t('errorRecovery.recoverySuggestions')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {recovery.actions && recovery.actions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">
              {t('errorRecovery.tryTheseSteps')}
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs text-blue-700 dark:text-blue-300">
              {recovery.actions.map((action, idx) => (
                <li key={idx}>{action}</li>
              ))}
            </ul>
          </div>
        )}

        {recovery.retryable && onRetry && (
          <div className="flex items-center gap-2">
            <Button
              onClick={handleRetry}
              disabled={retrying || (retryAfter !== null && retryAfter > 0)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className={cn('h-4 w-4', retrying && 'animate-spin')} />
              {retrying ? t('errorRecovery.retrying') : retryAfter ? t('errorRecovery.retryIn', { seconds: retryAfter }) : t('errorRecovery.tryAgain')}
            </Button>
            {retryCount > 0 && (
              <span className="text-xs text-blue-600 dark:text-blue-400">
                {t('errorRecovery.attempt', { count: retryCount })}
              </span>
            )}
          </div>
        )}

        {onDismiss && (
          <Button
            onClick={onDismiss}
            variant="ghost"
            className="w-full"
          >
            {t('errorRecovery.dismiss')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}





