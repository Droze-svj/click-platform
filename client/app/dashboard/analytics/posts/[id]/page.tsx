'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { apiGet } from '../../../../../lib/api'
import { useAuth } from '../../../../../hooks/useAuth'
import LoadingSpinner from '../../../../../components/LoadingSpinner'
import ErrorAlert from '../../../../../components/ErrorAlert'
import {
  ArrowLeft,
  Eye,
  Heart,
  MessageSquare,
  Share2,
  TrendingUp,
  Calendar,
  Zap,
  BarChart3,
  ExternalLink
} from 'lucide-react'

interface PostAnalytics {
  id: string
  platform: string
  platform_post_id?: string
  platform_post_url?: string
  views: number
  likes: number
  shares: number
  comments: number
  retweets: number
  saves: number
  engagement_rate: number
  click_through_rate: number
  posted_at?: string
  last_updated: string
  metadata?: any
  created_at: string
}

interface PostInsights {
  post_id: string
  user_id: string
  performance_score: number
  best_posting_time: string
  recommended_hashtags: string[]
  content_improvements: string[]
  audience_reach_estimate: number
  trending_topics: string[]
  competitor_performance: any
  generated_at: string
  expires_at: string
}

interface PostData {
  post_id: string
  analytics: PostAnalytics[]
  insights: PostInsights | null
  aggregate: {
    total_views: number
    total_likes: number
    total_shares: number
    total_comments: number
    total_retweets: number
    total_saves: number
    platforms_count: number
    overall_engagement_rate: string
  }
}

export default function PostAnalyticsPage() {
  const router = useRouter()
  const params = useParams()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PostData | null>(null)

  useEffect(() => {
    if (params.id) {
      loadPostAnalytics()
    }
  }, [params.id])

  const loadPostAnalytics = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await apiGet<PostData>(`/analytics/posts/${params.id}`)
      setData(response)
    } catch (err: any) {
      console.error('Failed to load post analytics:', err)
      setError(err.message || 'Failed to load post analytics')
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading post analytics...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
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
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Analytics
        </button>
        <button
          onClick={loadPostAnalytics}
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
              <Eye className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Views</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatNumber(data.aggregate.total_views)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <Heart className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Engagement</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatNumber(data.aggregate.total_likes + data.aggregate.total_comments + data.aggregate.total_shares)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Engagement Rate</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.aggregate.overall_engagement_rate}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
              <Zap className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Platforms</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.aggregate.platforms_count}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Platform Breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Platform Performance</h2>
        {data.analytics.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.analytics.map((platform) => (
              <div key={platform.platform} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <span className="text-2xl mr-2">{getPlatformIcon(platform.platform)}</span>
                  <span className="font-medium text-gray-900 dark:text-white capitalize">{platform.platform}</span>
                  {platform.platform_post_url && (
                    <a
                      href={platform.platform_post_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-blue-600 hover:text-blue-700"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Views</span>
                    <span className="font-medium">{formatNumber(platform.views)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Likes</span>
                    <span className="font-medium">{formatNumber(platform.likes)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Shares</span>
                    <span className="font-medium">{formatNumber(platform.shares)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Comments</span>
                    <span className="font-medium">{formatNumber(platform.comments)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Engagement Rate</span>
                    <span className="font-medium">{platform.engagement_rate.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No analytics data available yet</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Analytics will appear once this post gets engagement on social platforms</p>
          </div>
        )}
      </div>

      {/* AI Insights */}
      {data.insights && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">AI Insights</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Performance Score</h3>
              <div className="flex items-center gap-4">
                <div className="text-3xl font-bold text-blue-600">{data.insights.performance_score}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">out of 100</div>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Best Posting Time</h3>
              <p className="text-gray-600 dark:text-gray-400">{data.insights.best_posting_time}</p>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Recommended Hashtags</h3>
              <div className="flex flex-wrap gap-1">
                {data.insights.recommended_hashtags.map((hashtag, index) => (
                  <span key={index} className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-sm">
                    {hashtag}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Audience Reach Estimate</h3>
              <p className="text-gray-600 dark:text-gray-400">{formatNumber(data.insights.audience_reach_estimate)} people</p>
            </div>
          </div>

          {data.insights.content_improvements.length > 0 && (
            <div className="mt-6">
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Content Improvement Suggestions</h3>
              <ul className="space-y-2">
                {data.insights.content_improvements.map((improvement, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-gray-600 dark:text-gray-400 text-sm">{improvement}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Generate Insights Button */}
      {!data.insights && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="text-center">
            <Zap className="w-12 h-12 text-purple-600 dark:text-purple-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Get AI Insights</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Generate personalized recommendations and performance analysis for this post
            </p>
            <button
              onClick={() => router.push(`/dashboard/analytics/insights/${params.id}`)}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
            >
              Generate Insights
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
