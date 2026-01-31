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
  engagement_trends?: any[]
  content_performance?: any
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

      // Skip API calls in development mode
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 [Analytics] Skipping analytics API call in development mode')

        // Provide comprehensive mock data for development
        const mockData: DashboardData = {
          overview: {
            total_posts: 45,
            published_posts: 38,
            total_views: 12547,
            total_engagement: 2341,
            avg_engagement_rate: '18.6%'
          },
          platform_distribution: {
            instagram: {
              posts: 15,
              views: 5420,
              engagement: 890
            },
            tiktok: {
              posts: 12,
              views: 3890,
              engagement: 756
            },
            youtube: {
              posts: 8,
              views: 2150,
              engagement: 423
            },
            twitter: {
              posts: 10,
              views: 1087,
              engagement: 272
            }
          },
          recent_posts: [
            {
              id: 'mock-post-1',
              title: '10 Tips for Viral Content Creation',
              published_at: new Date(Date.now() - 86400000).toISOString(),
              total_views: 1250,
              total_engagement: 234,
              avg_engagement_rate: '18.7%'
            },
            {
              id: 'mock-post-2',
              title: 'Behind the Scenes: Content Strategy',
              published_at: new Date(Date.now() - 172800000).toISOString(),
              total_views: 890,
              total_engagement: 156,
              avg_engagement_rate: '17.5%'
            },
            {
              id: 'mock-post-3',
              title: 'Quick Tips for Better Engagement',
              published_at: new Date(Date.now() - 259200000).toISOString(),
              total_views: 675,
              total_engagement: 98,
              avg_engagement_rate: '14.5%'
            }
          ],
          top_performing_posts: [
            {
              id: 'top-post-1',
              title: 'Viral Dance Challenge Tutorial',
              published_at: new Date(Date.now() - 345600000).toISOString(),
              total_views: 5420,
              total_engagement: 1234,
              avg_engagement_rate: '22.7%'
            },
            {
              id: 'top-post-2',
              title: 'Morning Routine for Creators',
              published_at: new Date(Date.now() - 432000000).toISOString(),
              total_views: 3890,
              total_engagement: 890,
              avg_engagement_rate: '22.9%'
            }
          ],
          engagement_trends: [
            { date: '2024-01-01', views: 1200, engagement: 180 },
            { date: '2024-01-02', views: 1350, engagement: 210 },
            { date: '2024-01-03', views: 1100, engagement: 165 },
            { date: '2024-01-04', views: 1500, engagement: 240 },
            { date: '2024-01-05', views: 1800, engagement: 290 },
            { date: '2024-01-06', views: 2100, engagement: 340 },
            { date: '2024-01-07', views: 1900, engagement: 310 }
          ],
          content_performance: {
            best_posting_times: [
              { hour: 9, performance: 85 },
              { hour: 14, performance: 92 },
              { hour: 18, performance: 78 },
              { hour: 21, performance: 95 }
            ],
            content_types: {
              video: { posts: 25, avg_engagement: '22.3%' },
              image: { posts: 12, avg_engagement: '15.7%' },
              text: { posts: 8, avg_engagement: '12.1%' }
            }
          }
        }

        setData(mockData)
        setLoading(false)
        return
      }

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Analytics Dashboard
                </h1>
                <p className="text-gray-600 mt-1">Track your content performance and audience engagement</p>
              </div>
            </div>
            <button
              onClick={loadAnalytics}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-xl flex items-center gap-2 font-medium shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <BarChart3 className="w-5 h-5" />
              Refresh Data
            </button>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-blue-100 hover:shadow-xl transition-all duration-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <Target className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total Posts</p>
                <p className="text-3xl font-bold text-blue-600">{data.overview.total_posts}</p>
                <p className="text-xs text-gray-500">{data.overview.published_posts} published</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-green-100 hover:shadow-xl transition-all duration-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                <Eye className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total Views</p>
                <p className="text-3xl font-bold text-green-600">{formatNumber(data.overview.total_views)}</p>
                <p className="text-xs text-gray-500">Across all platforms</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-purple-100 hover:shadow-xl transition-all duration-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total Engagement</p>
                <p className="text-3xl font-bold text-purple-600">{formatNumber(data.overview.total_engagement)}</p>
                <p className="text-xs text-gray-500">Likes, comments, shares</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-orange-100 hover:shadow-xl transition-all duration-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Avg Engagement Rate</p>
                <p className="text-3xl font-bold text-orange-600">{data.overview.avg_engagement_rate}</p>
                <p className="text-xs text-gray-500">Industry leading!</p>
              </div>
            </div>
          </div>
        </div>

        {/* Platform Distribution */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-100">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <span className="text-2xl">📊</span>
            Platform Performance
          </h2>
          {Object.keys(data.platform_distribution).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(data.platform_distribution).map(([platform, stats]) => (
                <div key={platform} className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-5 hover:shadow-md transition-all duration-200">
                  <div className="flex items-center mb-4">
                    <span className="text-3xl mr-3">{getPlatformIcon(platform)}</span>
                    <div>
                      <span className="font-semibold text-gray-800 capitalize">{platform}</span>
                      <p className="text-xs text-gray-500">{stats.posts} posts</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Views</span>
                      <span className="font-bold text-blue-600">{formatNumber(stats.views)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Engagement</span>
                      <span className="font-bold text-green-600">{formatNumber(stats.engagement)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full"
                        style={{ width: `${Math.min(100, (stats.engagement / stats.views) * 100)}%` }}
                      ></div>
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
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <span className="text-2xl">🏆</span>
            Top Performing Posts
          </h2>
          {data.top_performing_posts.length > 0 ? (
            <div className="space-y-4">
              {data.top_performing_posts.map((post, index) => (
                <div key={post.id} className="bg-gradient-to-r from-white to-gray-50 border border-gray-200 rounded-xl p-5 hover:shadow-md transition-all duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        index === 0 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' :
                        index === 1 ? 'bg-gradient-to-r from-gray-300 to-gray-400' :
                        'bg-gradient-to-r from-orange-300 to-orange-400'
                      }`}>
                        <Award className={`w-5 h-5 ${
                          index === 0 ? 'text-white' :
                          index === 1 ? 'text-gray-700' :
                          'text-orange-700'
                        }`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800 text-lg">{post.title || 'Untitled Post'}</h3>
                        <p className="text-sm text-gray-600">
                          Published {new Date(post.published_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-8">
                      <div className="text-center">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Views</p>
                        <p className="font-bold text-xl text-blue-600">{formatNumber(post.total_views)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Engagement</p>
                        <p className="font-bold text-xl text-green-600">{formatNumber(post.total_engagement)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Rate</p>
                        <p className="font-bold text-xl text-purple-600">{post.avg_engagement_rate}</p>
                      </div>
                      <button
                        onClick={() => router.push(`/dashboard/analytics/posts/${post.id}`)}
                        className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-lg font-medium transition-all duration-200 hover:shadow-md"
                      >
                        View Details
                      </button>
                    </div>
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
    </div>
  )
}
