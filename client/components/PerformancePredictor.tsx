'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown, BarChart3, Zap } from 'lucide-react'
import { apiPost, handleApiError } from '../lib/api'
import { useTranslation } from '@/hooks/useTranslation'

interface Prediction {
  score: number // 0-100
  engagement: number
  reach: number
  virality: number
  insights: string[]
  recommendations: string[]
}

interface PerformancePredictorProps {
  content: {
    text?: string
    type?: string
    platform?: string
    tags?: string[]
  }
  onPredict?: (prediction: Prediction) => void
}

export default function PerformancePredictor({ content, onPredict }: PerformancePredictorProps) {
  const { t } = useTranslation()
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [isPredicting, setIsPredicting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePredict = async () => {
    setIsPredicting(true)
    try {
      // POST /ai/predict-performance reads `text` (it 400'd on `content`).
      const data = await apiPost<any>('/ai/predict-performance', {
        text: content.text,
        type: content.type,
        platform: content.platform,
        tags: content.tags,
      })
      const result = data?.data ?? data
      if (result && typeof result.score === 'number') {
        setPrediction({
          ...result,
          insights: Array.isArray(result.insights) ? result.insights : [],
          recommendations: Array.isArray(result.recommendations) ? result.recommendations : [],
        })
        setError(null)
        if (onPredict) {
          onPredict(result)
        }
      } else {
        setError(t('performancePredictor.predictFailed'))
      }
    } catch (err) {
      setError(handleApiError(err) || t('performancePredictor.predictFailed'))
    } finally {
      setIsPredicting(false)
    }
  }

  if (!prediction && !isPredicting) {
    return (
      <div className="space-y-2">
      {!content.text?.trim() && (
        <p className="text-xs text-gray-500">{t('performancePredictor.needsText')}</p>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
      <button
        disabled={!content.text?.trim()}
        type="button"
        onClick={handlePredict}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Zap className="w-4 h-4" />
        <span>{t('performancePredictor.predictPerformance')}</span>
      </button>
      </div>
    )
  }

  if (isPredicting) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-600 border-t-transparent"></div>
          <span className="text-sm">{t('performancePredictor.analyzingContent')}</span>
        </div>
      </div>
    )
  }

  if (!prediction) return null

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

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        <h3 className="font-semibold text-lg">{t('performancePredictor.performancePrediction')}</h3>
      </div>

      {/* Overall Score */}
      <div className={`${getScoreBg(prediction.score)} rounded-lg p-4 mb-4`}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('performancePredictor.overallScore')}
          </span>
          <span className={`text-3xl font-bold ${getScoreColor(prediction.score)}`}>
            {prediction.score}/100
          </span>
        </div>
        <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${
              prediction.score >= 70
                ? 'bg-green-500'
                : prediction.score >= 40
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${prediction.score}%` }}
          />
        </div>
      </div>

      {/* The engagement / reach / virality tiles were fixed multiples of the
          score (reach = score x 7.5 "K") presented as forecasts. Say what the
          score actually is instead. */}
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">{t('performancePredictor.ruleBasedNote')}</p>

      {/* Insights */}
      {prediction.insights.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('performancePredictor.keyInsights')}
          </h4>
          <ul className="space-y-1">
            {prediction.insights.map((insight, index) => (
              <li key={index} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                <span className="text-purple-600 dark:text-purple-400 mt-1">•</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {prediction.recommendations.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('performancePredictor.recommendations')}
          </h4>
          <ul className="space-y-1">
            {prediction.recommendations.map((rec, index) => (
              <li key={index} className="text-sm text-blue-600 dark:text-blue-400 flex items-start gap-2">
                <span className="mt-1">→</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}






