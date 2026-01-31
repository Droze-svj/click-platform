'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Award, Target, BarChart3, Sparkles, AlertCircle, CheckCircle } from 'lucide-react'
import { apiGet } from '../lib/api'

interface BenchmarkData {
  contentId: string
  contentTitle: string
  hasData: boolean
  metrics: {
    totalPosts: number
    totalEngagement: number
    avgEngagement: number
    avgEngagementRate: number
  }
  benchmarks: Record<string, {
    metrics: any
    percentiles: {
      engagement: { percentile: number; label: string }
      engagementRate: { percentile: number; label: string }
    }
    comparison: {
      engagement: { value: number; benchmark: number; difference: number; percentage: number }
      engagementRate: { value: number; benchmark: number; difference: number; percentage: number }
    }
  }>
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

interface ComparisonData {
  hasComparison: boolean
  currentMetrics: any
  similarMetrics: any
  comparison: {
    engagement: { current: number; similar: number; difference: number; percentage: number }
    engagementRate: { current: number; similar: number; difference: number; percentage: number }
  }
  insights: string[]
}

interface PredictionData {
  hasPrediction: boolean
  currentAvg: number
  predictedEngagement: number
  trend: number
  predictedPercentile: { percentile: number; label: string }
  confidence: string
  recommendation: string
}

export default function ContentBenchmarking({ contentId }: { contentId: string }) {
  const [benchmark, setBenchmark] = useState<BenchmarkData | null>(null)
  const [comparison, setComparison] = useState<ComparisonData | null>(null)
  const [prediction, setPrediction] = useState<PredictionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'benchmark' | 'comparison' | 'prediction'>('benchmark')

  useEffect(() => {
    loadData()
  }, [contentId, activeTab])

  const loadData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'benchmark') {
        const response = await apiGet<any>(`/benchmarking/content/${contentId}`)
        if (response?.success && response.data) {
          setBenchmark(response.data)
        } else if (response?.data) {
          setBenchmark(response.data)
        }
      } else if (activeTab === 'comparison') {
        const response = await apiGet<any>(`/benchmarking/content/${contentId}/compare`)
        if (response?.success && response.data) {
          setComparison(response.data)
        } else if (response?.data) {
          setComparison(response.data)
        }
      } else if (activeTab === 'prediction') {
        const response = await apiGet<any>(`/benchmarking/content/${contentId}/predict`)
        if (response?.success && response.data) {
          setPrediction(response.data)
        } else if (response?.data) {
          setPrediction(response.data)
        }
      }
    } catch (error: any) {
      console.error('Error loading benchmark data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const getPercentileColor = (percentile: number) => {
    if (percentile >= 75) return 'text-green-600'
    if (percentile >= 50) return 'text-blue-600'
    if (percentile >= 25) return 'text-yellow-600'
    return 'text-red-600'
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

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Target className="w-6 h-6 text-purple-600" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Performance Benchmarking
            </h2>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
          {(['benchmark', 'comparison', 'prediction'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                activeTab === tab
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Benchmark Tab */}
        {activeTab === 'benchmark' && benchmark && (
          <div>
            {!benchmark.hasData ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>{(benchmark as any).message || 'No data available'}</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Overall Score */}
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Overall Performance</p>
                      <div className="flex items-center gap-3">
                        <span className={`text-4xl font-bold ${getPercentileColor(benchmark.overallScore.score)}`}>
                          {benchmark.overallScore.score}
                        </span>
                        <span className="text-2xl text-gray-600 dark:text-gray-400">th</span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">percentile</span>
                        <span className={`px-4 py-2 rounded-lg font-bold text-lg ${getGradeColor(benchmark.overallScore.grade)}`}>
                          {benchmark.overallScore.grade}
                        </span>
                      </div>
                    </div>
                    <Award className="w-16 h-16 text-purple-600 opacity-50" />
                  </div>
                </div>

                {/* Platform Benchmarks */}
                {Object.keys(benchmark.benchmarks).length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Platform Performance
                    </h3>
                    <div className="space-y-4">
                      {Object.entries(benchmark.benchmarks).map(([platform, data]) => (
                        <div
                          key={platform}
                          className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="font-semibold text-gray-900 dark:text-white capitalize">
                              {platform}
                            </h4>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${getPercentileColor(data.percentiles.engagement.percentile)}`}>
                                {data.percentiles.engagement.label}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div>
                              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Engagement</p>
                              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                                {formatNumber(data.metrics.avgEngagement)}
                              </p>
                              <div className="flex items-center gap-1 mt-1">
                                {data.comparison.engagement.percentage > 0 ? (
                                  <TrendingUp className="w-3 h-3 text-green-600" />
                                ) : (
                                  <TrendingDown className="w-3 h-3 text-red-600" />
                                )}
                                <span className={`text-xs ${data.comparison.engagement.percentage > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {data.comparison.engagement.percentage > 0 ? '+' : ''}
                                  {data.comparison.engagement.percentage.toFixed(1)}%
                                </span>
                                <span className="text-xs text-gray-500">vs industry</span>
                              </div>
                            </div>

                            <div>
                              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Engagement Rate</p>
                              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                                {data.metrics.avgEngagementRate.toFixed(2)}%
                              </p>
                              <div className="flex items-center gap-1 mt-1">
                                {data.comparison.engagementRate.percentage > 0 ? (
                                  <TrendingUp className="w-3 h-3 text-green-600" />
                                ) : (
                                  <TrendingDown className="w-3 h-3 text-red-600" />
                                )}
                                <span className={`text-xs ${data.comparison.engagementRate.percentage > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {data.comparison.engagementRate.percentage > 0 ? '+' : ''}
                                  {data.comparison.engagementRate.percentage.toFixed(1)}%
                                </span>
                                <span className="text-xs text-gray-500">vs industry</span>
                              </div>
                            </div>

                            <div>
                              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Percentile</p>
                              <p className={`text-lg font-semibold ${getPercentileColor(data.percentiles.engagementRate.percentile)}`}>
                                {data.percentiles.engagementRate.percentile}th
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {data.percentiles.engagementRate.label}
                              </p>
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
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Recommendations
                    </h4>
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
            )}
          </div>
        )}

        {/* Comparison Tab */}
        {activeTab === 'comparison' && comparison && (
          <div>
            {!comparison.hasComparison ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>{(comparison as any).message || 'No comparison data available'}</p>
              </div>
            ) : (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  vs Similar Content
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Engagement</p>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {formatNumber(comparison.currentMetrics.avgEngagement)}
                      </p>
                      <span className="text-sm text-gray-500">vs {formatNumber(comparison.similarMetrics.avgEngagement)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {comparison.comparison.engagement.percentage > 0 ? (
                        <TrendingUp className="w-4 h-4 text-green-600" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-600" />
                      )}
                      <span className={`text-sm font-medium ${comparison.comparison.engagement.percentage > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {comparison.comparison.engagement.percentage > 0 ? '+' : ''}
                        {comparison.comparison.engagement.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Engagement Rate</p>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {comparison.currentMetrics.avgEngagementRate.toFixed(2)}%
                      </p>
                      <span className="text-sm text-gray-500">vs {comparison.similarMetrics.avgEngagementRate.toFixed(2)}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {comparison.comparison.engagementRate.percentage > 0 ? (
                        <TrendingUp className="w-4 h-4 text-green-600" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-600" />
                      )}
                      <span className={`text-sm font-medium ${comparison.comparison.engagementRate.percentage > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {comparison.comparison.engagementRate.percentage > 0 ? '+' : ''}
                        {comparison.comparison.engagementRate.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Impressions</p>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {formatNumber(comparison.currentMetrics.avgImpressions)}
                      </p>
                      <span className="text-sm text-gray-500">vs {formatNumber(comparison.similarMetrics.avgImpressions)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {((comparison.comparison as any).impressions?.percentage || 0) > 0 ? (
                        <TrendingUp className="w-4 h-4 text-green-600" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-600" />
                      )}
                      <span className={`text-sm font-medium ${((comparison.comparison as any).impressions?.percentage || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {((comparison.comparison as any).impressions?.percentage || 0) > 0 ? '+' : ''}
                        {((comparison.comparison as any).impressions?.percentage || 0).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                {comparison.insights.length > 0 && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">Insights</h4>
                    <ul className="space-y-1">
                      {comparison.insights.map((insight, idx) => (
                        <li key={idx} className="text-sm text-blue-800 dark:text-blue-300">
                          • {insight}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Prediction Tab */}
        {activeTab === 'prediction' && prediction && (
          <div>
            {!prediction.hasPrediction ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <Sparkles className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>{(prediction as any).message || 'Insufficient data for prediction'}</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Performance Prediction
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Current Average</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {formatNumber(prediction.currentAvg)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Predicted Engagement</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {formatNumber(prediction.predictedEngagement)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    {prediction.trend > 0 ? (
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-600" />
                    )}
                    <span className={`font-medium ${prediction.trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {prediction.trend > 0 ? '+' : ''}{prediction.trend}% trend
                    </span>
                    <span className="text-sm text-gray-500">({prediction.confidence} confidence)</span>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Predicted Percentile</h4>
                  <p className={`text-2xl font-bold ${getPercentileColor(prediction.predictedPercentile.percentile)}`}>
                    {prediction.predictedPercentile.percentile}th percentile
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {prediction.predictedPercentile.label}
                  </p>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">Recommendation</h4>
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    {prediction.recommendation}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

