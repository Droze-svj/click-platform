'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { AlertTriangle, TrendingUp, TrendingDown, Activity, BarChart3 } from 'lucide-react';
import LoadingSkeleton from './LoadingSkeleton';
import { ErrorBoundary } from './ErrorBoundary';
import { useTranslation } from '@/hooks/useTranslation';

interface ErrorStatistics {
  totalErrors: number;
  criticalErrors: number;
  clientErrors: number;
  uniqueUsersAffected: number;
  errorsByType: Array<{ type: string; count: number }>;
  errorsByStatusCode: Array<{ code: number; count: number }>;
  topErrorPaths: Array<{ path: string; count: number }>;
  errorRate: Array<{ time: string; count: number }>;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export default function ErrorAnalyticsDashboard() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ErrorStatistics | null>(null);
  const [period, setPeriod] = useState(7); // days

  const fetchStatistics = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/error-analytics/stats?days=${period}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Fetch error statistics error:', error);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton type="card" count={4} />
      </div>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-gray-500">{t('errorAnalyticsDashboard.noErrorData')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <ErrorBoundary>
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">{t('errorAnalyticsDashboard.title')}</h2>
          <div className="flex gap-2">
            {[7, 30, 90].map(days => (
              <Button
                key={days}
                variant={period === days ? 'default' : 'outline'}
                onClick={() => setPeriod(days)}
              >
                {t('errorAnalyticsDashboard.daysShort', { count: days })}
              </Button>
            ))}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">{t('errorAnalyticsDashboard.totalErrors')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalErrors}</div>
            </CardContent>
          </Card>

          <Card className="border-red-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-600">{t('errorAnalyticsDashboard.criticalErrors')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.criticalErrors}</div>
            </CardContent>
          </Card>

          <Card className="border-yellow-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-yellow-600">{t('errorAnalyticsDashboard.clientErrors')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.clientErrors}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">{t('errorAnalyticsDashboard.usersAffected')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.uniqueUsersAffected}</div>
            </CardContent>
          </Card>
        </div>

        {/* Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {t('errorAnalyticsDashboard.errorTrend')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {stats.trend === 'increasing' ? (
                <>
                  <TrendingUp className="h-5 w-5 text-red-500" />
                  <span className="text-red-600 font-semibold">{t('errorAnalyticsDashboard.trendIncreasing')}</span>
                </>
              ) : stats.trend === 'decreasing' ? (
                <>
                  <TrendingDown className="h-5 w-5 text-green-500" />
                  <span className="text-green-600 font-semibold">{t('errorAnalyticsDashboard.trendDecreasing')}</span>
                </>
              ) : (
                <>
                  <Activity className="h-5 w-5 text-gray-500" />
                  <span className="text-gray-600 font-semibold">{t('errorAnalyticsDashboard.trendStable')}</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Errors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('errorAnalyticsDashboard.errorsByType')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.errorsByType.slice(0, 5).map((error, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm">{error.type}</span>
                    <span className="font-semibold">{error.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('errorAnalyticsDashboard.topErrorPaths')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.topErrorPaths.map((path, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm font-mono truncate">{path.path}</span>
                    <span className="font-semibold">{path.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ErrorBoundary>
  );
}





