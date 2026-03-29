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
  Loader2,
  Flame,
  Eye,
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
  /** When provided, renders the Pre-Export Retention Heatmap section */
  timelineSegments?: any[]
  /** Total video duration in seconds for heatmap analysis */
  videoDuration?: number
}

// ── Pre-Export Heatmap Types ────────────────────────────────────────────────
interface RetentionZone {
  timeStart: number
  timeEnd: number
  score: number
  level: 'high' | 'medium' | 'low'
  warnings: string[]
}

export default function PredictiveAnalyticsDashboard({
  contentId,
  userId,
  showAudienceGrowth = true,
  timelineSegments,
  videoDuration = 60,
}: PredictiveAnalyticsDashboardProps) {
  const [prediction, setPrediction] = useState<PerformancePrediction | null>(null)
  const [audienceGrowth, setAudienceGrowth] = useState<AudienceGrowthPrediction | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingGrowth, setIsLoadingGrowth] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retentionHeatmap, setRetentionHeatmap] = useState<RetentionZone[]>([])
  const [heatmapLoading, setHeatmapLoading] = useState(false)
  const [heatmapSummary, setHeatmapSummary] = useState<any>(null)

  useEffect(() => {
    if (contentId) {
      loadPrediction()
    }
    if (userId && showAudienceGrowth) {
      loadAudienceGrowth()
    }
    if (timelineSegments && timelineSegments.length > 0) {
      loadRetentionHeatmap()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentId, userId, showAudienceGrowth, timelineSegments])

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

  const loadRetentionHeatmap = async () => {
    setHeatmapLoading(true)
    try {
      const response = await fetch('/api/retention-heatmap/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          segments: timelineSegments ?? [],
          effects: [],
          captions: [],
          duration: videoDuration,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        setRetentionHeatmap(data.heatmap ?? [])
        setHeatmapSummary(data.summary ?? null)
      }
    } catch (err) {
      console.error('Retention heatmap failed:', err)
    } finally {
      setHeatmapLoading(false)
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

      {/* ── Pre-Export Retention Heatmap ── */}
      {timelineSegments && timelineSegments.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Pre-Export Retention Heatmap
                </h3>
              </div>
              {heatmapSummary && (
                <div className="flex items-center gap-3">
                  <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                    heatmapSummary.avgScore >= 75 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' :
                    heatmapSummary.avgScore >= 55 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' :
                    'bg-red-100 dark:bg-red-900/30 text-red-600'
                  }`}>
                    Avg {heatmapSummary.avgScore}%
                  </div>
                </div>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              AI scores each timeline window for predicted viewer drop-off before you export.
            </p>
          </div>

          <div className="p-6">
            {heatmapLoading ? (
              <div className="flex items-center gap-3 py-8 justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                <span className="text-sm text-gray-500">Analyzing retention…</span>
              </div>
            ) : retentionHeatmap.length > 0 ? (
              <div className="space-y-4">
                {/* SVG Heatmap Bar */}
                <div className="relative w-full h-12 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                  <svg width="100%" height="100%" preserveAspectRatio="none">
                    {retentionHeatmap.map((zone, i) => {
                      const pct = 100 / retentionHeatmap.length
                      const fill = zone.level === 'high' ? '#34d399' : zone.level === 'medium' ? '#fbbf24' : '#f87171'
                      return (
                        <rect
                          key={i}
                          x={`${i * pct}%`}
                          y="0"
                          width={`${pct}%`}
                          height="100%"
                          fill={fill}
                          opacity={zone.level === 'low' ? 0.85 : 0.55}
                        >
                          <title>{zone.timeStart}s–{zone.timeEnd}s: {zone.score}% retention</title>
                        </rect>
                      )
                    })}
                  </svg>
                  {/* Score labels */}
                  <div className="absolute inset-0 flex items-center justify-around px-2 pointer-events-none">
                    {retentionHeatmap.filter((_, i) => i % 2 === 0).map((zone, i) => (
                      <span key={i} className="text-[9px] font-black text-white/80 drop-shadow">
                        {zone.score}%
                      </span>
                    ))}
                  </div>
                </div>

                {/* Timeline labels */}
                <div className="flex justify-between">
                  <span className="text-[9px] text-gray-500">0:00</span>
                  <span className="text-[9px] text-gray-500">
                    {Math.floor(videoDuration / 60)}:{String(Math.round(videoDuration % 60)).padStart(2, '0')}
                  </span>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 text-[10px] text-gray-500">
                  <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-400 inline-block" />High retention</div>
                  <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" />Medium</div>
                  <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block" />Drop zone</div>
                </div>

                {/* Warnings */}
                {retentionHeatmap.filter(z => z.warnings.length > 0).map((zone, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                        ⚠ {zone.timeStart}s–{zone.timeEnd}s ({zone.score}% retention)
                      </span>
                      {zone.warnings.map((w, wi) => (
                        <p key={wi} className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">{w}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Eye className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Add timeline segments to see the heatmap</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
