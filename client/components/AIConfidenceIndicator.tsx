'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_URL } from '@/lib/api'

interface UncertaintyFlag {
  type: string
  severity: string
  suggestion: string
}

interface AIConfidenceScore {
  overallConfidence: number
  editEffort: number
  needsHumanReview: boolean
  reviewReason: string | null
  uncertaintyFlags: UncertaintyFlag[]
  aspectConfidence: {
    tone: number
    humor: number
    sarcasm: number
    sensitivity: number
    brandAlignment: number
    clarity: number
    engagement: number
  }
}

interface AIConfidenceIndicatorProps {
  contentId: string
  onReviewRequested?: () => void
}

export default function AIConfidenceIndicator({ contentId, onReviewRequested }: AIConfidenceIndicatorProps) {
  const [confidence, setConfidence] = useState<AIConfidenceScore | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadConfidence()
  }, [contentId])

  const loadConfidence = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(
        `${API_URL}/ai/confidence/${contentId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (res.data.success) {
        setConfidence(res.data.data)
      }
    } catch (error) {
      console.error('Error loading confidence', error)
    } finally {
      setLoading(false)
    }
  }

  const getConfidenceColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getConfidenceBg = (score: number) => {
    if (score >= 80) return 'bg-green-100'
    if (score >= 60) return 'bg-yellow-100'
    return 'bg-red-100'
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-600 text-white'
      case 'high': return 'bg-orange-600 text-white'
      case 'medium': return 'bg-yellow-600 text-white'
      case 'low': return 'bg-gray-600 text-white'
      default: return 'bg-gray-600 text-white'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        <span>Analyzing confidence...</span>
      </div>
    )
  }

  if (!confidence) {
    return null
  }

  return (
    <div className="border rounded-lg p-4 space-y-4">
      {/* Overall Confidence */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-gray-700">AI Confidence</div>
          <div className={`text-2xl font-bold ${getConfidenceColor(confidence.overallConfidence)}`}>
            {confidence.overallConfidence}%
          </div>
        </div>
        <div>
          <div className="text-sm font-medium text-gray-700">Edit Effort</div>
          <div className={`text-2xl font-bold ${getConfidenceColor(100 - confidence.editEffort)}`}>
            {confidence.editEffort}%
          </div>
        </div>
      </div>

      {/* Human Review Flag */}
      {confidence.needsHumanReview && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-semibold text-red-800 mb-1">⚠️ Human Review Recommended</div>
              <div className="text-sm text-red-700">{confidence.reviewReason}</div>
            </div>
            {onReviewRequested && (
              <button
                onClick={onReviewRequested}
                className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
              >
                Review
              </button>
            )}
          </div>
        </div>
      )}

      {/* Uncertainty Flags */}
      {confidence.uncertaintyFlags.length > 0 && (
        <div>
          <div className="text-sm font-medium text-gray-700 mb-2">Uncertainty Flags</div>
          <div className="space-y-2">
            {confidence.uncertaintyFlags.map((flag, i) => (
              <div
                key={i}
                className="flex items-start gap-2 p-2 bg-gray-50 rounded"
              >
                <span className={`px-2 py-1 rounded text-xs ${getSeverityColor(flag.severity)}`}>
                  {flag.severity}
                </span>
                <div className="flex-1">
                  <div className="text-sm font-medium">{flag.suggestion}</div>
                  <div className="text-xs text-gray-600">{flag.suggestion}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aspect Confidence */}
      <div>
        <div className="text-sm font-medium text-gray-700 mb-2">Confidence by Aspect</div>
        <div className="space-y-2">
          {Object.entries(confidence.aspectConfidence).map(([aspect, score]) => (
            <div key={aspect} className="flex items-center gap-2">
              <div className="w-24 text-xs text-gray-600 capitalize">{aspect.replace(/([A-Z])/g, ' $1').trim()}</div>
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getConfidenceBg(score)}`}
                  style={{ width: `${score}%` }}
                ></div>
              </div>
              <div className={`text-xs font-medium w-12 text-right ${getConfidenceColor(score)}`}>
                {score}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


