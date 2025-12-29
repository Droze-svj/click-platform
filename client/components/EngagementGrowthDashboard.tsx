'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, Users, Heart, Eye, Share2, ArrowUp, ArrowDown, Target } from 'lucide-react'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface GrowthMetrics {
  engagement: {
    current: number
    previous: number
    change: number
    trend: 'up' | 'down'
  }
  followers: {
    current: number
    previous: number
    change: number
    trend: 'up' | 'down'
  }
  reach: {
    current: number
    previous: number
    change: number
    trend: 'up' | 'down'
  }
  engagementRate: {
    current: number
    previous: number
    change: number
    trend: 'up' | 'down'
  }
}

interface GrowthInsight {
  type: 'opportunity' | 'warning' | 'success'
  title: string
  description: string
  action?: string
  impact: 'high' | 'medium' | 'low'
}

export default function EngagementGrowthDashboard() {
  const [metrics, setMetrics] = useState<GrowthMetrics | null>(null)
  const [insights, setInsights] = useState<GrowthInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d')

  useEffect(() => {
    loadGrowthData()
  }, [period])

  const loadGrowthData = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      
      const response = await axios.get(
        `${API_URL}/analytics/growth?period=${period}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.data.success) {
        setMetrics(response.data.data.metrics)
        setInsights(response.data.data.insights || [])
      }
    } catch (error: any) {
      console.error('Growth data error:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const formatPercent = (num: number) => {
    const sign = num >= 0 ? '+' : ''
    return `${sign}${num.toFixed(1)}%`
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Engagement & Growth Dashboard
        </h2>
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Grid */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Engagement */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-blue-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Total Engagement</span>
              </div>
              {metrics.engagement.trend === 'up' ? (
                <ArrowUp className="w-4 h-4 text-green-500" />
              ) : (
                <ArrowDown className="w-4 h-4 text-red-500" />
              )}
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {formatNumber(metrics.engagement.current)}
            </div>
            <div className={`text-sm ${
              metrics.engagement.change >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatPercent(metrics.engagement.change)} vs previous period
            </div>
          </div>

          {/* Followers */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Followers</span>
              </div>
              {metrics.followers.trend === 'up' ? (
                <ArrowUp className="w-4 h-4 text-green-500" />
              ) : (
                <ArrowDown className="w-4 h-4 text-red-500" />
              )}
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {formatNumber(metrics.followers.current)}
            </div>
            <div className={`text-sm ${
              metrics.followers.change >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatPercent(metrics.followers.change)} vs previous period
            </div>
          </div>

          {/* Reach */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-green-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Reach</span>
              </div>
              {metrics.reach.trend === 'up' ? (
                <ArrowUp className="w-4 h-4 text-green-500" />
              ) : (
                <ArrowDown className="w-4 h-4 text-red-500" />
              )}
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {formatNumber(metrics.reach.current)}
            </div>
            <div className={`text-sm ${
              metrics.reach.change >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatPercent(metrics.reach.change)} vs previous period
            </div>
          </div>

          {/* Engagement Rate */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-yellow-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Engagement Rate</span>
              </div>
              {metrics.engagementRate.trend === 'up' ? (
                <ArrowUp className="w-4 h-4 text-green-500" />
              ) : (
                <ArrowDown className="w-4 h-4 text-red-500" />
              )}
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {metrics.engagementRate.current.toFixed(2)}%
            </div>
            <div className={`text-sm ${
              metrics.engagementRate.change >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatPercent(metrics.engagementRate.change)} vs previous period
            </div>
          </div>
        </div>
      )}

      {/* Growth Insights */}
      {insights.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              Growth Insights & Recommendations
            </h3>
          </div>

          <div className="space-y-3">
            {insights.map((insight, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-lg border-l-4 ${
                  insight.type === 'success'
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
                    : insight.type === 'warning'
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500'
                    : 'bg-blue-50 dark:bg-blue-900/20 border-blue-500'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        {insight.title}
                      </h4>
                      <span className={`text-xs px-2 py-1 rounded ${
                        insight.impact === 'high'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          : insight.impact === 'medium'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                      }`}>
                        {insight.impact.toUpperCase()} IMPACT
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                      {insight.description}
                    </p>
                    {insight.action && (
                      <button className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium">
                        {insight.action} →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}


