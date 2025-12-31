'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import LoadingSpinner from '../../../components/LoadingSpinner'
import EngagementGrowthDashboard from '../../../components/EngagementGrowthDashboard'
import { extractApiData, extractApiError } from '../../../utils/apiResponse'
import ContentPerformanceHeatmap from '../../../components/ContentPerformanceHeatmap'
import BestTimeToPostCalendar from '../../../components/BestTimeToPostCalendar'
import ContentGapAnalysis from '../../../components/ContentGapAnalysis'
import ROICalculator from '../../../components/ROICalculator'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'

interface Analytics {
  total: number
  byType: Record<string, number>
  byStatus: Record<string, number>
  byPlatform: Record<string, number>
  engagement: {
    totalViews: number
    totalEngagement: number
    averageEngagement: number
    topPerforming: Array<{
      id: string
      title: string
      engagement: number
      views: number
    }>
  }
  trends: {
    daily: Array<{ date: string; count: number }>
  }
  bestPerforming: Array<{
    id: string
    title: string
    engagement: number
    views: number
  }>
}

interface Insights {
  recommendations: Array<{
    type: string
    message: string
    priority: string
  }>
  trends: Array<{
    type: string
    message: string
    trend: string
  }>
  opportunities: Array<{
    type: string
    message: string
    platforms?: string[]
  }>
}

export default function AnalyticsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [insights, setInsights] = useState<Insights | null>(null)
  const [comprehensive, setComprehensive] = useState<any>(null)
  const [trends, setTrends] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(30)
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'platforms'>('overview')

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }
    loadAnalytics()
  }, [user, router, period])

  const loadAnalytics = async () => {
    try {
      const token = localStorage.getItem('token')
      const [analyticsRes, insightsRes, comprehensiveRes, trendsRes] = await Promise.all([
        axios.get(`${API_URL}/analytics/content?period=${period}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/analytics/content/insights`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/analytics/enhanced/comprehensive?period=${period}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/analytics/enhanced/trends?period=${period}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ])

      const analyticsData = extractApiData<Analytics>(analyticsRes)
      const insightsData = extractApiData<Insights>(insightsRes)
      const comprehensiveData = extractApiData<any>(comprehensiveRes)
      const trendsData = extractApiData<any>(trendsRes)

      if (analyticsData) setAnalytics(analyticsData)
      if (insightsData) setInsights(insightsData)
      if (comprehensiveData) setComprehensive(comprehensiveData)
      if (trendsData) setTrends(trendsData)
    } catch (error) {
      const errorMessage = extractApiError(error)
      showToast(errorMessage || 'Failed to load analytics', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${API_URL}/analytics/enhanced/export?format=${format}&period=${period}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: format === 'csv' ? 'blob' : 'json'
        }
      )

      if (format === 'csv') {
        const blob = new Blob([response.data])
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `analytics_export_${Date.now()}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        const blob = new Blob([JSON.stringify(response.data.data, null, 2)], { type: 'application/json' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `analytics_export_${Date.now()}.json`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }

      showToast(`Analytics exported as ${format.toUpperCase()}`, 'success')
    } catch (error) {
      showToast('Failed to export analytics', 'error')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading analytics..." />
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 md:gap-0 mb-4 md:mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">Analytics</h1>
          <select
            value={period}
            onChange={(e) => setPeriod(parseInt(e.target.value))}
            className="w-full sm:w-auto px-4 py-2 border rounded-lg touch-target"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>

        {/* Engagement & Growth Dashboard */}
        <div className="mb-4 md:mb-8">
          <EngagementGrowthDashboard />
        </div>

        {/* Advanced Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-8">
          <ContentPerformanceHeatmap />
          <BestTimeToPostCalendar />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-8">
          <ContentGapAnalysis />
          <ROICalculator />
        </div>

        {activeTab === 'overview' && analytics && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-4 md:mb-8">
              <div className="bg-white rounded-lg shadow p-4 md:p-6">
                <p className="text-xs md:text-sm text-gray-600">Total Content</p>
                <p className="text-2xl md:text-3xl font-bold mt-2">{analytics.total}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4 md:p-6">
                <p className="text-xs md:text-sm text-gray-600">Total Views</p>
                <p className="text-2xl md:text-3xl font-bold mt-2">{analytics.engagement.totalViews}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4 md:p-6">
                <p className="text-xs md:text-sm text-gray-600">Total Engagement</p>
                <p className="text-2xl md:text-3xl font-bold mt-2">{analytics.engagement.totalEngagement}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm text-gray-600">Avg Engagement</p>
                <p className="text-3xl font-bold mt-2">
                  {analytics.engagement.averageEngagement.toFixed(1)}
                </p>
              </div>
            </div>

            {comprehensive && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {comprehensive.content && (
                  <>
                    <div className="bg-white rounded-lg shadow p-6">
                      <p className="text-sm text-gray-600">Success Rate</p>
                      <p className="text-3xl font-bold mt-2">
                        {comprehensive.content.successRate?.toFixed(1) || 0}%
                      </p>
                    </div>
                    <div className="bg-white rounded-lg shadow p-6">
                      <p className="text-sm text-gray-600">Avg Processing</p>
                      <p className="text-3xl font-bold mt-2">
                        {comprehensive.content.averageProcessingTime?.toFixed(1) || 0}m
                      </p>
                    </div>
                  </>
                )}
                {comprehensive.posts && (
                  <>
                    <div className="bg-white rounded-lg shadow p-6">
                      <p className="text-sm text-gray-600">Posts Scheduled</p>
                      <p className="text-3xl font-bold mt-2">{comprehensive.posts.scheduled || 0}</p>
                    </div>
                    <div className="bg-white rounded-lg shadow p-6">
                      <p className="text-sm text-gray-600">Posts Posted</p>
                      <p className="text-3xl font-bold mt-2">{comprehensive.posts.posted || 0}</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === 'trends' && trends && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Engagement Trends</h2>
              <div className="space-y-4">
                {trends.engagement && trends.engagement.length > 0 ? (
                  trends.engagement.map((item: any, index: number) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm">Week {item.week}</span>
                      <div className="flex-1 mx-4">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-purple-600 h-2 rounded-full"
                            style={{ width: `${Math.min((item.value / 100) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-semibold">{item.value.toFixed(0)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-8">No trend data available</p>
                )}
              </div>
            </div>

            {trends.bestPerforming && trends.bestPerforming.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Best Performing Posts</h2>
                <div className="space-y-3">
                  {trends.bestPerforming.map((post: any) => (
                    <div key={post.id} className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <div>
                        <p className="font-medium capitalize">{post.platform}</p>
                        <p className="text-sm text-gray-600">
                          {new Date(post.scheduledTime).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="text-lg font-bold text-green-600">{post.engagement}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'platforms' && comprehensive && comprehensive.platforms && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(comprehensive.platforms).map(([platform, stats]: [string, any]) => (
              <div key={platform} className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold text-lg capitalize mb-4">{platform}</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Connected</span>
                    <span className={stats.connected ? 'text-green-600' : 'text-red-600'}>
                      {stats.connected ? '✓ Yes' : '✗ No'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Posts</span>
                    <span className="font-semibold">{stats.postsCount || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Avg Engagement</span>
                    <span className="font-semibold">{stats.averageEngagement?.toFixed(0) || 0}</span>
                  </div>
                  {stats.lastUsed && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Last Used</span>
                      <span className="text-xs text-gray-500">
                        {new Date(stats.lastUsed).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {analytics && (
            <>
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Content by Type</h2>
                <div className="space-y-3">
                  {Object.entries(analytics.byType).map(([type, count]) => (
                    <div key={type}>
                      <div className="flex justify-between mb-1">
                        <span className="capitalize">{type}</span>
                        <span className="font-semibold">{count}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full"
                          style={{
                            width: `${(count / analytics.total) * 100}%`
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Platform Distribution</h2>
                <div className="space-y-3">
                  {Object.entries(analytics.byPlatform || {}).map(([platform, count]) => (
                    <div key={platform}>
                      <div className="flex justify-between mb-1">
                        <span className="capitalize">{platform}</span>
                        <span className="font-semibold">{count}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: `${(count / Object.values(analytics.byPlatform || {}).reduce((a: number, b: number) => a + b, 0)) * 100}%`
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {analytics && analytics.bestPerforming.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Top Performing Content</h2>
            <div className="space-y-3">
              {analytics.bestPerforming.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{item.title || 'Untitled'}</p>
                    <p className="text-sm text-gray-600">
                      {item.views} views • {item.engagement} engagement
                    </p>
                  </div>
                  <button
                    onClick={() => router.push(`/dashboard/content/${item.id}`)}
                    className="text-purple-600 hover:underline text-sm"
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'overview' && insights && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {insights.recommendations.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">💡 Recommendations</h2>
                <div className="space-y-3">
                  {insights.recommendations.map((rec, index) => (
                    <div key={index} className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm">{rec.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {insights.trends.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">📈 Trends</h2>
                <div className="space-y-3">
                  {insights.trends.map((trend, index) => (
                    <div key={index} className="p-3 bg-green-50 rounded-lg">
                      <p className="text-sm">{trend.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {insights.opportunities.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">🚀 Opportunities</h2>
                <div className="space-y-3">
                  {insights.opportunities.map((opp, index) => (
                    <div key={index} className="p-3 bg-yellow-50 rounded-lg">
                      <p className="text-sm">{opp.message}</p>
                      {opp.platforms && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {opp.platforms.map((platform) => (
                            <span key={platform} className="text-xs bg-yellow-200 px-2 py-1 rounded">
                              {platform}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {comprehensive && comprehensive.daily && comprehensive.daily.length > 0 && activeTab === 'overview' && (
          <div className="bg-white rounded-lg shadow p-6 mt-6">
            <h2 className="text-xl font-semibold mb-4">Daily Activity</h2>
            <div className="space-y-2">
              {comprehensive.daily.slice(-14).map((day: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                  <span className="text-sm">{new Date(day.date).toLocaleDateString()}</span>
                  <div className="flex gap-4 text-sm">
                    <span>Content: {day.contentCreated}</span>
                    <span>Posts: {day.postsScheduled}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      </div>
    </ErrorBoundary>
  )
}
