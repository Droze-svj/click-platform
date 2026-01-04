'use client'

import { useState } from 'react'
import axios from 'axios'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../contexts/ToastContext'
import { TrendingUp, AlertCircle, CheckCircle } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface ViralPrediction {
  viralScore: number
  potential: 'high' | 'medium' | 'low'
  factors: {
    hashtags: number
    mentions: number
    hasQuestion: boolean
    emojiCount: number
    length: number
  }
  recommendations: string[]
}

interface ViralPredictorProps {
  content: {
    text: string
    hashtags?: string[]
    platform?: string
  }
  onPrediction?: (prediction: ViralPrediction) => void
}

export default function ViralPredictor({ content, onPrediction }: ViralPredictorProps) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const [prediction, setPrediction] = useState<ViralPrediction | null>(null)
  const [loading, setLoading] = useState(false)

  const analyzeContent = async () => {
    if (!content.text) {
      showToast('Please enter content text', 'warning')
      return
    }

    setLoading(true)
    try {
      const response = await axios.post(
        `${API_URL}/ai/viral-prediction`,
        {
          contentData: {
            text: content.text,
            hashtags: content.hashtags || [],
            platform: content.platform || 'twitter'
          }
        },
        {
        }
      )

      if (response.data.success) {
        const pred = response.data.data
        setPrediction(pred)
        onPrediction?.(pred)
      }
    } catch (error) {
      showToast('Failed to analyze content', 'error')
    } finally {
      setLoading(false)
    }
  }

  const getPotentialColor = (potential: string) => {
    switch (potential) {
      case 'high':
        return 'text-green-600 dark:text-green-400'
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'low':
        return 'text-red-600 dark:text-red-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600 dark:text-green-400'
    if (score >= 50) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="text-purple-600" size={24} />
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Viral Potential Predictor</h3>
      </div>

      <button
        onClick={analyzeContent}
        disabled={loading || !content.text}
        className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mb-4"
      >
        {loading ? 'Analyzing...' : 'Analyze Viral Potential'}
      </button>

      {prediction && (
        <div className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Viral Score</span>
              <span className={`text-2xl font-bold ${getScoreColor(prediction.viralScore)}`}>
                {prediction.viralScore}/100
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Potential:</span>
              <span className={`font-semibold capitalize ${getPotentialColor(prediction.potential)}`}>
                {prediction.potential}
              </span>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Content Factors</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                {prediction.factors.hashtags >= 3 ? (
                  <CheckCircle className="text-green-500" size={16} />
                ) : (
                  <AlertCircle className="text-yellow-500" size={16} />
                )}
                <span className="text-gray-700 dark:text-gray-300">
                  Hashtags: {prediction.factors.hashtags}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {prediction.factors.mentions > 0 ? (
                  <CheckCircle className="text-green-500" size={16} />
                ) : (
                  <AlertCircle className="text-yellow-500" size={16} />
                )}
                <span className="text-gray-700 dark:text-gray-300">
                  Mentions: {prediction.factors.mentions}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {prediction.factors.hasQuestion ? (
                  <CheckCircle className="text-green-500" size={16} />
                ) : (
                  <AlertCircle className="text-yellow-500" size={16} />
                )}
                <span className="text-gray-700 dark:text-gray-300">
                  Has Question: {prediction.factors.hasQuestion ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {prediction.factors.emojiCount >= 2 ? (
                  <CheckCircle className="text-green-500" size={16} />
                ) : (
                  <AlertCircle className="text-yellow-500" size={16} />
                )}
                <span className="text-gray-700 dark:text-gray-300">
                  Emojis: {prediction.factors.emojiCount}
                </span>
              </div>
            </div>
          </div>

          {prediction.recommendations.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Recommendations</h4>
              <ul className="space-y-1">
                {prediction.recommendations.map((rec, index) => (
                  <li key={index} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                    <span className="text-purple-600 mt-1">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}







