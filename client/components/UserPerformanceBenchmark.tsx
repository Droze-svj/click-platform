'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Award, Target, BarChart3, CheckCircle, AlertCircle } from 'lucide-react'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface UserBenchmark {
  hasData: boolean
  period: number
  totalPosts: number
  platformBenchmarks: Record<string, any>
  overallScore: {
    score: number
    grade: string
    percentile: number
  }
  summary: {
    insights: string[]
    recommendations: string[]
    strengths: string[]
    weaknesses: string[]
  }
}

export default function UserPerformanceBenchmark({ period = 30 }: { period?: number }) {
  const [benchmark, setBenchmark] = useState<UserBenchmark | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadBenchmark()
  }, [period])

  const loadBenchmark = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${API_URL}/benchmarking/user?period=${period}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.data.success) {
        setBenchmark(response.data.data)
      }
    } catch (error: any) {
      console.error('Error loading benchmark:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    if (grade.startsWith('B')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    if (grade.startsWith('C')) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
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

  if (!benchmark || !benchmark.hasData) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center text-gray-500">
        <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p>{(benchmark as any)?.message || 'No benchmark data available'}</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Target className="w-6 h-6 text-purple-600" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Your Performance Benchmark
          </h2>
        </div>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          Last {period} days
        </span>
      </div>

      {/* Overall Score */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Overall Performance</p>
            <div className="flex items-center gap-3">
              <span className="text-4xl font-bold text-purple-600">
                {benchmark.overallScore.score}
              </span>
              <span className="text-2xl text-gray-600 dark:text-gray-400">th</span>
              <span className="text-sm text-gray-600 dark:text-gray-400">percentile</span>
              <span className={`px-4 py-2 rounded-lg font-bold text-lg ${getGradeColor(benchmark.overallScore.grade)}`}>
                {benchmark.overallScore.grade}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              {benchmark.totalPosts} posts analyzed
            </p>
          </div>
          <Award className="w-16 h-16 text-purple-600 opacity-50" />
        </div>
      </div>

      {/* Platform Benchmarks */}
      {Object.keys(benchmark.platformBenchmarks).length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Platform Performance
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(benchmark.platformBenchmarks).map(([platform, data]: [string, any]) => (
              <div
                key={platform}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-900 dark:text-white capitalize">
                    {platform}
                  </h4>
                  <span className="text-xs text-gray-500">
                    {data.metrics.count} posts
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Engagement</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatNumber(data.metrics.avgEngagement)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${Math.min(data.percentiles.engagement.percentile, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-500 w-16 text-right">
                        {data.percentiles.engagement.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      {data.comparison.engagement.percentage > 0 ? (
                        <TrendingUp className="w-3 h-3 text-green-600" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-red-600" />
                      )}
                      <span className={`text-xs ${data.comparison.engagement.percentage > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {data.comparison.engagement.percentage > 0 ? '+' : ''}
                        {data.comparison.engagement.percentage.toFixed(1)}% vs industry
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Engagement Rate</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {data.metrics.avgEngagementRate.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{ width: `${Math.min(data.percentiles.engagementRate.percentile, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-500 w-16 text-right">
                        {data.percentiles.engagementRate.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      {data.comparison.engagementRate.percentage > 0 ? (
                        <TrendingUp className="w-3 h-3 text-green-600" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-red-600" />
                      )}
                      <span className={`text-xs ${data.comparison.engagementRate.percentage > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {data.comparison.engagementRate.percentage > 0 ? '+' : ''}
                        {data.comparison.engagementRate.percentage.toFixed(1)}% vs industry
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      {benchmark.summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {benchmark.summary.strengths.length > 0 && (
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <h4 className="font-semibold text-green-900 dark:text-green-200 mb-2 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Strengths
              </h4>
              <ul className="space-y-1">
                {benchmark.summary.strengths.map((strength, idx) => (
                  <li key={idx} className="text-sm text-green-800 dark:text-green-300">
                    • {strength}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {benchmark.summary.weaknesses.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
              <h4 className="font-semibold text-red-900 dark:text-red-200 mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Areas for Improvement
              </h4>
              <ul className="space-y-1">
                {benchmark.summary.weaknesses.map((weakness, idx) => (
                  <li key={idx} className="text-sm text-red-800 dark:text-red-300">
                    • {weakness}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Recommendations */}
      {benchmark.summary.recommendations.length > 0 && (
        <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">Recommendations</h4>
          <ul className="space-y-1">
            {benchmark.summary.recommendations.map((rec, idx) => (
              <li key={idx} className="text-sm text-blue-800 dark:text-blue-300">
                • {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

