'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'
import LoadingSpinner from '../../../components/LoadingSpinner'
import ErrorAlert from '../../../components/ErrorAlert'
import {
  BarChart3,
  TrendingUp,
  Eye,
  Heart,
  MessageSquare,
  Share2,
  Target,
  Calendar,
  Award,
  Zap
} from 'lucide-react'

interface AnalyticsOverview {
  total_posts: number
  published_posts: number
  total_views: number
  total_engagement: number
  avg_engagement_rate: string
}

interface PlatformDistribution {
  [platform: string]: {
    posts: number
    views: number
    engagement: number
  }
}

interface TopPerformingPost {
  id: string
  title: string
  published_at: string
  total_views: number
  total_engagement: number
  avg_engagement_rate: string
}

interface DashboardData {
  overview: AnalyticsOverview
  platform_distribution: PlatformDistribution
  recent_posts: any[]
  top_performing_posts: TopPerformingPost[]
}

export default function AnalyticsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    loadAnalytics()
  }, [])

  const loadAnalytics = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await apiGet<DashboardData>('/analytics/dashboard')
      setData(response)
    } catch (err: any) {
      console.error('Failed to load analytics:', err)
      setError(err.message || 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
  }

  const getPlatformColor = (platform: string) => {
    const colors = {
      twitter: 'bg-blue-500',
      linkedin: 'bg-blue-700',
      instagram: 'bg-pink-500',
      facebook: 'bg-blue-600',
      tiktok: 'bg-black',
      youtube: 'bg-red-500'
    }
    return colors[platform as keyof typeof colors] || 'bg-gray-500'
  }

  const getPlatformIcon = (platform: string) => {
    const icons = {
      twitter: '🐦',
      linkedin: '💼',
      instagram: '📷',
      facebook: '📘',
      tiktok: '🎵',
      youtube: '📺'
    }
    return icons[platform as keyof typeof icons] || '📱'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading analytics...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
            <p className="text-gray-600 dark:text-gray-400">Track your content performance</p>
          </div>
        </div>
        <ErrorAlert message={error} onClose={() => setError(null)} />
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-gray-600 dark:text-gray-400">Track your content performance and insights</p>
        </div>
        <button
          onClick={loadAnalytics}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
        >
          <BarChart3 className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Target className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Posts</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.overview.total_posts}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <Eye className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Views</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatNumber(data.overview.total_views)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <Heart className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Engagement</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatNumber(data.overview.total_engagement)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
              <TrendingUp className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Engagement Rate</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.overview.avg_engagement_rate}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Platform Distribution */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Platform Performance</h2>
        {Object.keys(data.platform_distribution).length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(data.platform_distribution).map(([platform, stats]) => (
              <div key={platform} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <span className="text-2xl mr-2">{getPlatformIcon(platform)}</span>
                  <span className="font-medium text-gray-900 dark:text-white capitalize">{platform}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Posts</span>
                    <span className="font-medium">{stats.posts}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Views</span>
                    <span className="font-medium">{formatNumber(stats.views)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Engagement</span>
                    <span className="font-medium">{formatNumber(stats.engagement)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No platform analytics available yet</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Analytics will appear once your posts are published and get engagement</p>
          </div>
        )}
      </div>

      {/* Top Performing Posts */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top Performing Posts</h2>
        {data.top_performing_posts.length > 0 ? (
          <div className="space-y-4">
            {data.top_performing_posts.map((post, index) => (
              <div key={post.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-center">
                  <div className="flex items-center justify-center w-8 h-8 bg-yellow-100 dark:bg-yellow-900 rounded-full mr-4">
                    <Award className={`w-4 h-4 ${index === 0 ? 'text-yellow-600' : 'text-gray-600'}`} />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{post.title || 'Untitled Post'}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(post.published_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Views</p>
                    <p className="font-medium">{formatNumber(post.total_views)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Engagement</p>
                    <p className="font-medium">{formatNumber(post.total_engagement)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Rate</p>
                    <p className="font-medium">{post.avg_engagement_rate}%</p>
                  </div>
                  <button
                    onClick={() => router.push(`/dashboard/analytics/posts/${post.id}`)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No published posts with analytics yet</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Publish some posts to start seeing performance data</p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => router.push('/dashboard/posts')}
            className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Calendar className="w-8 h-8 text-blue-600 dark:text-blue-400 mb-2" />
            <h3 className="font-medium text-gray-900 dark:text-white">View All Posts</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Manage and analyze your content</p>
          </button>

          <button
            onClick={() => router.push('/dashboard/analytics/performance')}
            className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <TrendingUp className="w-8 h-8 text-green-600 dark:text-green-400 mb-2" />
            <h3 className="font-medium text-gray-900 dark:text-white">Performance Trends</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">View engagement over time</p>
          </button>

          <button
            onClick={() => router.push('/dashboard/analytics/insights')}
            className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Zap className="w-8 h-8 text-purple-600 dark:text-purple-400 mb-2" />
            <h3 className="font-medium text-gray-900 dark:text-white">AI Insights</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Get smart recommendations</p>
          </button>
        </div>
      </div>
    </div>
  )
}
