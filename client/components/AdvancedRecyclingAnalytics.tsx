'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Minus, BarChart3, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react'
import axios from 'axios'

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
  const [analytics, setAnalytics] = useState<AdvancedAnalytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAnalytics()
  }, [period])

  const loadAnalytics = async () => {
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
  }

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
        No analytics data available
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Recycled</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {analytics.overview.totalRecycled}
          </p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Active</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {analytics.overview.active}
          </p>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Paused</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {analytics.overview.paused}
          </p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Reposts</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {analytics.overview.totalReposts}
          </p>
        </div>
        <div className="bg-pink-50 dark:bg-pink-900/20 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Evergreen</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {analytics.evergreen.total}
          </p>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Performance Metrics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Avg Original Engagement</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {formatNumber(analytics.performance.averageOriginalEngagement)}
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Avg Repost Engagement</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {formatNumber(analytics.performance.averageRepostEngagement)}
            </p>
          </div>
          <div className={`p-4 rounded-lg ${
            analytics.performance.averagePerformanceChange >= 0
              ? 'bg-green-50 dark:bg-green-900/20'
              : 'bg-red-50 dark:bg-red-900/20'
          }`}>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Avg Performance Change</p>
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
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Best Performer</p>
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
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Worst Performer</p>
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
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Performance Trends
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Improving</p>
            </div>
            <p className="text-2xl font-bold text-green-600">{analytics.trends.improving}</p>
          </div>
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Minus className="w-5 h-5 text-blue-600" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Stable</p>
            </div>
            <p className="text-2xl font-bold text-blue-600">{analytics.trends.stable}</p>
          </div>
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-5 h-5 text-yellow-600" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Declining</p>
            </div>
            <p className="text-2xl font-bold text-yellow-600">{analytics.trends.declining}</p>
          </div>
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Decay Detected</p>
            </div>
            <p className="text-2xl font-bold text-red-600">{analytics.trends.decayDetected}</p>
          </div>
        </div>
      </div>

      {/* Platform Breakdown */}
      {Object.keys(analytics.platformBreakdown).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Platform Breakdown
          </h3>
          <div className="space-y-3">
            {Object.entries(analytics.platformBreakdown).map(([platform, data]) => (
              <div key={platform} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white capitalize">{platform}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {data.count} plans • {data.totalReposts} reposts
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Avg Engagement</p>
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Evergreen Content
          </h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Evergreen Content</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {analytics.evergreen.total}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 dark:text-gray-400">Average Score</p>
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


