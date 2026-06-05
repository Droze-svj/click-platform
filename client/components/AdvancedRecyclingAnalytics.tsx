'use client'

import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, TrendingDown, Minus, BarChart3, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react'
import axios from 'axios'
import { useTranslation } from '@/hooks/useTranslation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface AdvancedAnalytics {
  overview: {
    totalRecycled: number
    active: number
    paused: number
    completed: number
    totalReposts: number
  }
  performance: {
    averageOriginalEngagement: number
    averageRepostEngagement: number
    averagePerformanceChange: number
    bestPerformer: {
      recycleId: string
      change: number
    } | null
    worstPerformer: {
      recycleId: string
      change: number
    } | null
  }
  trends: {
    improving: number
    stable: number
    declining: number
    decayDetected: number
  }
  platformBreakdown: Record<string, {
    count: number
    totalReposts: number
    averageEngagement: number
  }>
  evergreen: {
    total: number
    averageScore: number
  }
}

export default function AdvancedRecyclingAnalytics({ period = 30 }: { period?: number }) {
  const { t } = useTranslation()
  const [analytics, setAnalytics] = useState<AdvancedAnalytics | null>(null)
  const [loading, setLoading] = useState(true)

  const loadAnalytics = useCallback(async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${API_URL}/recycling/analytics/advanced?period=${period}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.data.success) {
        setAnalytics(response.data.data)
      }
    } catch (error: any) {
      console.error('Error loading analytics:', error)
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    loadAnalytics()
  }, [loadAnalytics])

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center text-gray-500">
        {t('advancedRecyclingAnalytics.noAnalyticsData')}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('advancedRecyclingAnalytics.totalRecycled')}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {analytics.overview.totalRecycled}
          </p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('advancedRecyclingAnalytics.active')}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {analytics.overview.active}
          </p>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('advancedRecyclingAnalytics.paused')}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {analytics.overview.paused}
          </p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('advancedRecyclingAnalytics.totalReposts')}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {analytics.overview.totalReposts}
          </p>
        </div>
        <div className="bg-pink-50 dark:bg-pink-900/20 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('advancedRecyclingAnalytics.evergreen')}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {analytics.evergreen.total}
          </p>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-[var(--text-main)] mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          {t('advancedRecyclingAnalytics.performanceMetrics')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('advancedRecyclingAnalytics.avgOriginalEngagement')}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {formatNumber(analytics.performance.averageOriginalEngagement)}
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('advancedRecyclingAnalytics.avgRepostEngagement')}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {formatNumber(analytics.performance.averageRepostEngagement)}
            </p>
          </div>
          <div className={`p-4 rounded-lg ${
            analytics.performance.averagePerformanceChange >= 0
              ? 'bg-green-50 dark:bg-green-900/20'
              : 'bg-red-50 dark:bg-red-900/20'
          }`}>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('advancedRecyclingAnalytics.avgPerformanceChange')}</p>
            <div className="flex items-center gap-2">
              {analytics.performance.averagePerformanceChange >= 0 ? (
                <TrendingUp className="w-5 h-5 text-green-600" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-600" />
              )}
              <p className={`text-xl font-bold ${
                analytics.performance.averagePerformanceChange >= 0
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}>
                {analytics.performance.averagePerformanceChange > 0 ? '+' : ''}
                {analytics.performance.averagePerformanceChange.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        {/* Best/Worst Performers */}
        {(analytics.performance.bestPerformer || analytics.performance.worstPerformer) && (
          <div className="mt-4 grid grid-cols-2 gap-4">
            {analytics.performance.bestPerformer && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('advancedRecyclingAnalytics.bestPerformer')}</p>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <p className="text-lg font-bold text-green-600">
                    +{analytics.performance.bestPerformer.change}%
                  </p>
                </div>
              </div>
            )}
            {analytics.performance.worstPerformer && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('advancedRecyclingAnalytics.worstPerformer')}</p>
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-600" />
                  <p className="text-lg font-bold text-red-600">
                    {analytics.performance.worstPerformer.change}%
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Trends */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-[var(--text-main)] mb-4">
          {t('advancedRecyclingAnalytics.performanceTrends')}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('advancedRecyclingAnalytics.improving')}</p>
            </div>
            <p className="text-2xl font-bold text-green-600">{analytics.trends.improving}</p>
          </div>
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Minus className="w-5 h-5 text-blue-600" />
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('advancedRecyclingAnalytics.stable')}</p>
            </div>
            <p className="text-2xl font-bold text-blue-600">{analytics.trends.stable}</p>
          </div>
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-5 h-5 text-yellow-600" />
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('advancedRecyclingAnalytics.declining')}</p>
            </div>
            <p className="text-2xl font-bold text-yellow-600">{analytics.trends.declining}</p>
          </div>
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('advancedRecyclingAnalytics.decayDetected')}</p>
            </div>
            <p className="text-2xl font-bold text-red-600">{analytics.trends.decayDetected}</p>
          </div>
        </div>
      </div>

      {/* Platform Breakdown */}
      {Object.keys(analytics.platformBreakdown).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-[var(--text-main)] mb-4">
            {t('advancedRecyclingAnalytics.platformBreakdown')}
          </h3>
          <div className="space-y-3">
            {Object.entries(analytics.platformBreakdown).map(([platform, data]) => (
              <div key={platform} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white capitalize">{platform}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('advancedRecyclingAnalytics.plansReposts', { count: data.count, reposts: data.totalReposts })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('advancedRecyclingAnalytics.avgEngagement')}</p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {formatNumber(data.averageEngagement)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evergreen Stats */}
      {analytics.evergreen.total > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-[var(--text-main)] mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            {t('advancedRecyclingAnalytics.evergreenContent')}
          </h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('advancedRecyclingAnalytics.totalEvergreenContent')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {analytics.evergreen.total}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('advancedRecyclingAnalytics.averageScore')}</p>
              <p className="text-2xl font-bold text-green-600">
                {analytics.evergreen.averageScore}%
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


