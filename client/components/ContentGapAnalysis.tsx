'use client'

import { useState, useEffect } from 'react'
import { Target, AlertCircle, CheckCircle, TrendingUp } from 'lucide-react'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface Gap {
  type: 'platform' | 'content_type' | 'timing' | 'hashtags' | 'frequency'
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  opportunity: string
  current: number
  recommended: number
  potential: string
}

export default function ContentGapAnalysis() {
  const [gaps, setGaps] = useState<Gap[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadGapAnalysis()
  }, [])

  const loadGapAnalysis = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      
      const response = await axios.get(
        `${API_URL}/analytics/gap-analysis`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.data.success) {
        setGaps(response.data.data.gaps || [])
      }
    } catch (error: any) {
      console.error('Gap analysis error:', error)
    } finally {
      setLoading(false)
    }
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high':
        return 'border-red-500 bg-red-50 dark:bg-red-900/20'
      case 'medium':
        return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
      default:
        return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
    }
  }

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'high':
        return <AlertCircle className="w-5 h-5 text-red-600" />
      case 'medium':
        return <TrendingUp className="w-5 h-5 text-yellow-600" />
      default:
        return <CheckCircle className="w-5 h-5 text-blue-600" />
    }
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

  if (gaps.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-6 h-6 text-blue-600" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            Content Gap Analysis
          </h3>
        </div>
        <div className="text-center py-12">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            No significant gaps found. Your content strategy looks good!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center gap-2 mb-6">
        <Target className="w-6 h-6 text-blue-600" />
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
          Content Gap Analysis
        </h3>
      </div>

      <div className="space-y-4">
        {gaps.map((gap, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-lg border-l-4 ${getImpactColor(gap.impact)}`}
          >
            <div className="flex items-start gap-3">
              {getImpactIcon(gap.impact)}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-semibold text-gray-900 dark:text-white">
                    {gap.title}
                  </h4>
                  <span className={`text-xs px-2 py-1 rounded ${
                    gap.impact === 'high'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      : gap.impact === 'medium'
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                  }`}>
                    {gap.impact.toUpperCase()} IMPACT
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                  {gap.description}
                </p>
                
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Current</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {gap.current}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Recommended</p>
                    <p className="text-lg font-semibold text-green-600">
                      {gap.recommended}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Potential</p>
                    <p className="text-lg font-semibold text-blue-600">
                      {gap.potential}
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                    Opportunity:
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {gap.opportunity}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


