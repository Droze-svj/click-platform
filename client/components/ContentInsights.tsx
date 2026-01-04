'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Eye, Heart, MessageCircle, Share2, BarChart3 } from 'lucide-react'

interface ContentInsightsProps {
  contentId: string
  compact?: boolean
}

interface Insights {
  views: number
  engagement: number
  likes: number
  comments: number
  shares: number
  trend: 'up' | 'down' | 'stable'
  trendPercentage: number
  bestPlatform: string
  optimalPostTime: string
  recommendations: string[]
}

export default function ContentInsights({ contentId, compact = false }: ContentInsightsProps) {
  const [insights, setInsights] = useState<Insights | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadInsights()
  }, [contentId])

  const loadInsights = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/analytics/content-performance/${contentId}`, {
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        setInsights(data.data)
      }
    } catch (error) {
      console.error('Failed to load insights:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    )
  }

  if (!insights) {
    return null
  }

  if (compact) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h4 className="font-medium text-sm text-gray-900 dark:text-white">Quick Insights</h4>
          </div>
          {insights.trend === 'up' ? (
            <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
          ) : insights.trend === 'down' ? (
            <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
          ) : null}
        </div>
        
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">{insights.views}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Views</div>
          </div>
          <div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">{insights.engagement}%</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Engagement</div>
          </div>
          <div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">{insights.likes}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Likes</div>
          </div>
          <div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">{insights.shares}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Shares</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
          Content Insights
        </h3>
        {insights.trend === 'up' && (
          <div className="ml-auto flex items-center gap-1 text-green-600 dark:text-green-400">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm font-medium">+{insights.trendPercentage}%</span>
          </div>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <Eye className="w-5 h-5 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{insights.views}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Views</div>
        </div>
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <Heart className="w-5 h-5 text-red-600 dark:text-red-400 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{insights.likes}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Likes</div>
        </div>
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <MessageCircle className="w-5 h-5 text-green-600 dark:text-green-400 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{insights.comments}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Comments</div>
        </div>
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <Share2 className="w-5 h-5 text-purple-600 dark:text-purple-400 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{insights.shares}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Shares</div>
        </div>
      </div>

      {/* Key Insights */}
      <div className="space-y-3">
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>Best Platform:</strong> {insights.bestPlatform}
          </p>
        </div>
        
        {insights.optimalPostTime && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-sm text-green-800 dark:text-green-300">
              <strong>Optimal Post Time:</strong> {insights.optimalPostTime}
            </p>
          </div>
        )}

        {insights.recommendations && insights.recommendations.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Recommendations
            </h4>
            <ul className="space-y-1">
              {insights.recommendations.map((rec, index) => (
                <li key={index} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                  <span className="text-purple-600 dark:text-purple-400 mt-1">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}






