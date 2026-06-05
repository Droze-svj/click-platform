'use client'

import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import LoadingSpinner from './LoadingSpinner'
import { useTranslation } from '@/hooks/useTranslation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface ContentPerformanceProps {
  contentId: string
}

interface PerformanceData {
  contentId: string
  title: string
  type: string
  metrics: {
    totalPosts: number
    posted: number
    scheduled: number
    failed: number
    totalEngagement: number
    totalViews: number
    totalClicks: number
    averageEngagement: number
    averageViews: number
    averageClicks: number
  }
  platformBreakdown: Record<string, {
    posts: number
    engagement: number
    views: number
    clicks: number
  }>
  timeSeries: Array<{
    date: string
    posts: number
    engagement: number
    views: number
    clicks: number
  }>
  bestPerforming: Array<{
    postId: string
    platform: string
    scheduledTime: string
    engagement: number
    views: number
    clicks: number
  }>
  recommendations: Array<{
    type: string
    priority: string
    action: string
  }>
}

export default function ContentPerformanceAnalytics({ contentId }: ContentPerformanceProps) {
  const { showToast } = useToast()
  const { t } = useTranslation()
  const [performance, setPerformance] = useState<PerformanceData | null>(null)
  const [prediction, setPrediction] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const loadPerformance = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${API_URL}/analytics/content-performance/${contentId}`,
        {
        }
      )

      if (response.data.success) {
        setPerformance(response.data.data)
      }
    } catch (error) {
      showToast(t('contentPerformanceAnalytics.loadError'), 'error')
    } finally {
      setLoading(false)
    }
  }, [contentId, showToast])

  const loadPrediction = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${API_URL}/analytics/content-performance/${contentId}/prediction`,
        {
        }
      )

      if (response.data.success) {
        setPrediction(response.data.data)
      }
    } catch (error) {
      // Silent fail for prediction
    }
  }, [contentId])

  useEffect(() => {
    if (contentId) {
      loadPerformance()
      loadPrediction()
    }
  }, [contentId, loadPerformance, loadPrediction])

  if (loading) {
    return <LoadingSpinner size="sm" text={t('contentPerformanceAnalytics.loading')} />
  }

  if (!performance) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <p className="text-gray-500 text-center">{t('contentPerformanceAnalytics.noData')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Metrics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('contentPerformanceAnalytics.totalPosts')}</p>
          <p className="text-2xl font-bold">{performance.metrics.totalPosts}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('contentPerformanceAnalytics.avgEngagement')}</p>
          <p className="text-2xl font-bold">{performance.metrics.averageEngagement.toFixed(1)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('contentPerformanceAnalytics.totalViews')}</p>
          <p className="text-2xl font-bold">{performance.metrics.totalViews.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('contentPerformanceAnalytics.totalClicks')}</p>
          <p className="text-2xl font-bold">{performance.metrics.totalClicks.toLocaleString()}</p>
        </div>
      </div>

      {/* Performance Prediction */}
      {prediction && (
        <div className="bg-blue-50 dark:bg-blue-900 rounded-lg p-4">
          <h3 className="font-semibold mb-2">{t('contentPerformanceAnalytics.predictionTitle')}</h3>
          <p className="text-sm">
            {t('contentPerformanceAnalytics.predictedEngagement')} <strong>{prediction.predictedEngagement}</strong>
            {' '}{t('contentPerformanceAnalytics.predictionDetail', { confidence: prediction.confidence, count: prediction.basedOn })}
          </p>
        </div>
      )}

      {/* Platform Breakdown */}
      {Object.keys(performance.platformBreakdown).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold mb-4">{t('contentPerformanceAnalytics.platformPerformance')}</h3>
          <div className="space-y-3">
            {Object.entries(performance.platformBreakdown).map(([platform, data]) => (
              <div key={platform} className="border rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold capitalize">{platform}</span>
                  <span className="text-sm text-gray-600">{t('contentPerformanceAnalytics.postsCount', { count: data.posts })}</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">{t('contentPerformanceAnalytics.engagement')}</p>
                    <p className="font-semibold">{t('contentPerformanceAnalytics.avgValue', { value: (data.engagement / data.posts).toFixed(1) })}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">{t('contentPerformanceAnalytics.views')}</p>
                    <p className="font-semibold">{t('contentPerformanceAnalytics.avgValue', { value: (data.views / data.posts).toFixed(0) })}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">{t('contentPerformanceAnalytics.clicks')}</p>
                    <p className="font-semibold">{t('contentPerformanceAnalytics.avgValue', { value: (data.clicks / data.posts).toFixed(0) })}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Best Performing Posts */}
      {performance.bestPerforming.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold mb-4">{t('contentPerformanceAnalytics.bestPerforming')}</h3>
          <div className="space-y-2">
            {performance.bestPerforming.map((post, index) => (
              <div key={index} className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900 rounded-lg">
                <div>
                  <p className="font-medium capitalize">{post.platform}</p>
                  <p className="text-sm text-gray-600">
                    {new Date(post.scheduledTime).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">{post.engagement}</p>
                  <p className="text-xs text-gray-500">{t('contentPerformanceAnalytics.engagementLabel')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {performance.recommendations.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold mb-4">{t('contentPerformanceAnalytics.recommendations')}</h3>
          <div className="space-y-3">
            {performance.recommendations.map((rec, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg ${
                  rec.type === 'success' ? 'bg-green-50 dark:bg-green-900' :
                  rec.type === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900' :
                  rec.type === 'info' ? 'bg-blue-50 dark:bg-blue-900' :
                  'bg-gray-50 dark:bg-gray-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <p className="text-sm">{rec.action}</p>
                  <span className={`px-2 py-1 rounded text-xs ${
                    rec.priority === 'high' ? 'bg-red-100 text-red-800' :
                    rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {t(`contentPerformanceAnalytics.priority_${rec.priority}`)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Time Series Chart Placeholder */}
      {performance.timeSeries.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold mb-4">{t('contentPerformanceAnalytics.performanceOverTime')}</h3>
          <div className="space-y-2">
            {performance.timeSeries.slice(-7).map((data, index) => (
              <div key={index} className="flex items-center gap-4">
                <span className="text-sm text-gray-600 w-24">
                  {new Date(data.date).toLocaleDateString()}
                </span>
                <div className="flex-1">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full"
                      style={{ width: `${Math.min((data.engagement / 100) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-semibold w-20 text-right">
                  {data.engagement.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}







