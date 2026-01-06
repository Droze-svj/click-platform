'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet } from '../../../../lib/api'
import { useAuth } from '../../../../hooks/useAuth'
import LoadingSpinner from '../../../../components/LoadingSpinner'
import ErrorAlert from '../../../../components/ErrorAlert'
import { TrendingUp, Calendar, BarChart3, RefreshCw } from 'lucide-react'

interface PerformanceData {
  date: string
  views: number
  likes: number
  shares: number
  comments: number
  posts_count: number
}

interface PerformanceResponse {
  success: boolean
  period: string
  performance_data: PerformanceData[]
}

export default function PerformancePage() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PerformanceData[]>([])
  const [period, setPeriod] = useState('30')

  useEffect(() => {
    loadPerformance()
  }, [period])

  const loadPerformance = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await apiGet<PerformanceResponse>(`/analytics/performance?period=${period}`)
      setData(response.performance_data)
    } catch (err: any) {
      console.error('Failed to load performance data:', err)
      setError(err.message || 'Failed to load performance data')
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
  }

  const calculateGrowth = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous * 100).toFixed(1)
  }

  const getTotalStats = () => {
    return data.reduce((acc, day) => ({
      views: acc.views + day.views,
      likes: acc.likes + day.likes,
      shares: acc.shares + day.shares,
      comments: acc.comments + day.comments,
      posts: acc.posts + day.posts_count
    }), { views: 0, likes: 0, shares: 0, comments: 0, posts: 0 })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading performance data...</span>
      </div>
    )
  }

  const totalStats = getTotalStats()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Performance Trends</h1>
          <p className="text-gray-600 dark:text-gray-400">Track engagement and growth over time</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <button
            onClick={loadPerformance}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <ErrorAlert message={error} onClose={() => setError(null)} />
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Views</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatNumber(totalStats.views)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Engagement</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatNumber(totalStats.likes + totalStats.shares + totalStats.comments)}
              </p>
            </div>
            <BarChart3 className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Daily Posts</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {(totalStats.posts / parseInt(period)).toFixed(1)}
              </p>
            </div>
            <Calendar className="w-8 h-8 text-purple-600 dark:text-purple-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Engagement Rate</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {totalStats.views > 0
                  ? ((totalStats.likes + totalStats.shares + totalStats.comments) / totalStats.views * 100).toFixed(1)
                  : '0'
                }%
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-orange-600 dark:text-orange-400" />
          </div>
        </div>
      </div>

      {/* Performance Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Daily Performance</h2>
        {data.length > 0 ? (
          <div className="space-y-4">
            {/* Simple bar chart representation */}
            <div className="space-y-2">
              {data.slice(-14).map((day, index) => {
                const engagement = day.likes + day.shares + day.comments
                const maxEngagement = Math.max(...data.slice(-14).map(d => d.likes + d.shares + d.comments))
                const engagementWidth = maxEngagement > 0 ? (engagement / maxEngagement) * 100 : 0

                const maxViews = Math.max(...data.slice(-14).map(d => d.views))
                const viewsWidth = maxViews > 0 ? (day.views / maxViews) * 100 : 0

                return (
                  <div key={day.date} className="flex items-center gap-4">
                    <div className="w-20 text-sm text-gray-600 dark:text-gray-400">
                      {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-gray-500 w-12">Views</div>
                        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${viewsWidth}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 w-16 text-right">
                          {formatNumber(day.views)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-gray-500 w-12">Engage</div>
                        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-green-600 h-2 rounded-full"
                            style={{ width: `${engagementWidth}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 w-16 text-right">
                          {formatNumber(engagement)}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No performance data available</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Performance data will appear once your posts get engagement</p>
          </div>
        )}
      </div>

      {/* Detailed Table */}
      {data.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Detailed Performance</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Views
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Likes
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Shares
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Comments
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Posts
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Engagement Rate
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {data.slice().reverse().map((day) => {
                  const engagement = day.likes + day.shares + day.comments
                  const engagementRate = day.views > 0 ? (engagement / day.views * 100).toFixed(1) : '0'

                  return (
                    <tr key={day.date}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {new Date(day.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {formatNumber(day.views)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {formatNumber(day.likes)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {formatNumber(day.shares)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {formatNumber(day.comments)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {day.posts_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {engagementRate}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
