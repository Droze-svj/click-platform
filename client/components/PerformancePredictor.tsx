'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown, BarChart3, Zap } from 'lucide-react'

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
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [isPredicting, setIsPredicting] = useState(false)

  const handlePredict = async () => {
    setIsPredicting(true)
    try {
      const response = await fetch('/api/ai/predict-performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          content: content.text,
          title: content.title,
          description: content.description
        })
      })

      if (response.ok) {
        const data = await response.json()
        setPrediction(data.data)
        if (onPredict) {
          onPredict(data.data)
        }
      }
    } catch (error) {
      console.error('Prediction failed:', error)
    } finally {
      setIsPredicting(false)
    }
  }

  if (!prediction && !isPredicting) {
    return (
      <button
        onClick={handlePredict}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl"
      >
        <Zap className="w-4 h-4" />
        <span>Predict Performance</span>
      </button>
    )
  }

  if (isPredicting) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-600 border-t-transparent"></div>
          <span className="text-sm">Analyzing content...</span>
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
        <h3 className="font-semibold text-lg">Performance Prediction</h3>
      </div>

      {/* Overall Score */}
      <div className={`${getScoreBg(prediction.score)} rounded-lg p-4 mb-4`}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Overall Score
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

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400 mx-auto mb-1" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {prediction.engagement}%
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Engagement</div>
        </div>
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400 mx-auto mb-1" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {prediction.reach}K
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Reach</div>
        </div>
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <Zap className="w-5 h-5 text-purple-600 dark:text-purple-400 mx-auto mb-1" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {prediction.virality}%
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Virality</div>
        </div>
      </div>

      {/* Insights */}
      {prediction.insights.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Key Insights
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
            Recommendations
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






