'use client'

import { useState, useEffect } from 'react'
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Clock,
  Users,
  Target,
  AlertCircle,
  CheckCircle2,
  Zap,
  Loader2
} from 'lucide-react'
import { extractApiData } from '../utils/apiResponse'

interface PerformancePrediction {
  estimatedViews: {
    min: number
    max: number
    expected: number
  }
  estimatedEngagement: {
    min: number
    max: number
    expected: number
    rate: number
  }
  estimatedReach: {
    min: number
    max: number
    expected: number
  }
  optimalPostingTime: {
    hour: number
    minute: number
    confidence: 'low' | 'medium' | 'high'
  }
  performanceScore: number
  confidence: 'low' | 'medium' | 'high'
  recommendations: Array<{
    type: string
    message: string
    priority: 'low' | 'medium' | 'high'
  }>
}

interface AudienceGrowthPrediction {
  current: number
  predicted: number
  growthRate: number
  confidence: 'low' | 'medium' | 'high'
}

interface PredictiveAnalyticsDashboardProps {
  contentId?: string
  userId?: string
  showAudienceGrowth?: boolean
}

export default function PredictiveAnalyticsDashboard({
  contentId,
  userId,
  showAudienceGrowth = true
}: PredictiveAnalyticsDashboardProps) {
  const [prediction, setPrediction] = useState<PerformancePrediction | null>(null)
  const [audienceGrowth, setAudienceGrowth] = useState<AudienceGrowthPrediction | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingGrowth, setIsLoadingGrowth] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (contentId) {
      loadPrediction()
    }
    if (userId && showAudienceGrowth) {
      loadAudienceGrowth()
    }
  }, [contentId, userId, showAudienceGrowth])

  const loadPrediction = async () => {
    if (!contentId) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/analytics/predictions/content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ contentId }),
      })

      if (response.ok) {
        const data = await response.json()
        const predictionData = extractApiData<PerformancePrediction>(data)
        if (predictionData) {
          setPrediction(predictionData)
        }
      } else {
        const errorData = await response.json()
        setError(errorData.message || 'Failed to load predictions')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load predictions')
    } finally {
      setIsLoading(false)
    }
  }

  const loadAudienceGrowth = async () => {
    if (!userId) return

    setIsLoadingGrowth(true)

    try {
      const response = await fetch('/api/analytics/predictions/audience-growth?days=30', {
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        const growthData = extractApiData<AudienceGrowthPrediction>(data)
        if (growthData) {
          setAudienceGrowth(growthData)
        }
      }
    } catch (err) {
      console.error('Failed to load audience growth:', err)
    } finally {
      setIsLoadingGrowth(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600 dark:text-green-400'
    if (score >= 40) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getScoreBg = (score: number) => {
    if (score >= 70) return 'bg-green-100 dark:bg-green-900/30'
    if (score >= 40) return 'bg-yellow-100 dark:bg-yellow-900/30'
    return 'bg-red-100 dark:bg-red-900/30'
  }

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return 'text-green-600 dark:text-green-400'
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-400'
      default:
        return 'text-red-600 dark:text-red-400'
    }
  }

  const formatTime = (hour: number, minute: number) => {
    const period = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
    return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`
  }

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-8">
        <div className="flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading predictions...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-red-200 dark:border-red-800 p-4">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      </div>
    )
  }

  if (!prediction && !contentId) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
        <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">
          Select content to view performance predictions
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Performance Prediction */}
      {prediction && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Performance Prediction
                </h3>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreBg(prediction.performanceScore)} ${getScoreColor(prediction.performanceScore)}`}>
                Score: {prediction.performanceScore}/100
              </div>
            </div>
            <div className="mt-2">
              <span className={`text-sm ${getConfidenceColor(prediction.confidence)}`}>
                Confidence: {prediction.confidence.charAt(0).toUpperCase() + prediction.confidence.slice(1)}
              </span>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Estimated Views */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Estimated Views
                  </span>
                </div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {prediction.estimatedViews.expected.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Range: {prediction.estimatedViews.min.toLocaleString()} - {prediction.estimatedViews.max.toLocaleString()}
                </div>
              </div>

              {/* Estimated Engagement */}
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Estimated Engagement
                  </span>
                </div>
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {prediction.estimatedEngagement.expected.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Rate: {(prediction.estimatedEngagement.rate * 100).toFixed(1)}%
                </div>
              </div>

              {/* Estimated Reach */}
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Estimated Reach
                  </span>
                </div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {prediction.estimatedReach.expected.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Range: {prediction.estimatedReach.min.toLocaleString()} - {prediction.estimatedReach.max.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Optimal Posting Time */}
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Optimal Posting Time
                </span>
              </div>
              <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                {formatTime(prediction.optimalPostingTime.hour, prediction.optimalPostingTime.minute)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Confidence: {prediction.optimalPostingTime.confidence}
              </div>
            </div>

            {/* Recommendations */}
            {prediction.recommendations && prediction.recommendations.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Recommendations
                </h4>
                <div className="space-y-2">
                  {prediction.recommendations.map((rec, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border ${
                        rec.priority === 'high'
                          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                          : rec.priority === 'medium'
                          ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                          : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {rec.priority === 'high' ? (
                          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-gray-600 dark:text-gray-400 mt-0.5" />
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                            {rec.type}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {rec.message}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Audience Growth Prediction */}
      {showAudienceGrowth && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Audience Growth Forecast
              </h3>
            </div>
          </div>

          <div className="p-6">
            {isLoadingGrowth ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : audienceGrowth ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Current Reach
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {audienceGrowth.current.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Predicted (30 days)
                    </div>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {audienceGrowth.predicted.toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Growth Rate
                    </span>
                    <span className={`text-lg font-bold ${
                      audienceGrowth.growthRate > 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {audienceGrowth.growthRate > 0 ? '+' : ''}
                      {audienceGrowth.growthRate.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Confidence: {audienceGrowth.confidence}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                No growth data available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
