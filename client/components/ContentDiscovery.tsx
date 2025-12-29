'use client'

import { useState, useEffect } from 'react'
import { Sparkles, TrendingUp, Clock, RefreshCw, Eye } from 'lucide-react'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface Recommendation {
  content: any
  reason: string
  score: number
}

export default function ContentDiscovery({ onContentSelect }: { onContentSelect?: (content: any) => void }) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [basedOn, setBasedOn] = useState<'performance' | 'similarity' | 'trending' | 'recent'>('performance')

  useEffect(() => {
    loadRecommendations()
  }, [basedOn])

  const loadRecommendations = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${API_URL}/search/discovery?basedOn=${basedOn}&limit=10`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.data.success) {
        setRecommendations(response.data.data.recommendations || [])
      }
    } catch (error) {
      console.error('Error loading recommendations:', error)
    } finally {
      setLoading(false)
    }
  }

  const getReasonIcon = (reason: string) => {
    if (reason.includes('performance') || reason.includes('High')) {
      return <TrendingUp className="w-4 h-4 text-green-600" />
    }
    if (reason.includes('Similar')) {
      return <Sparkles className="w-4 h-4 text-blue-600" />
    }
    if (reason.includes('Trending')) {
      return <TrendingUp className="w-4 h-4 text-orange-600" />
    }
    return <Clock className="w-4 h-4 text-gray-600" />
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-purple-600" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Content Discovery
          </h2>
        </div>
        <button
          onClick={loadRecommendations}
          className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Discovery Type Selector */}
      <div className="flex gap-2 mb-6">
        {(['performance', 'similarity', 'trending', 'recent'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setBasedOn(type)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              basedOn === type
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          ))}
        </div>
      ) : recommendations.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Sparkles className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>No recommendations available</p>
        </div>
      ) : (
        <div className="space-y-4">
          {recommendations.map((rec, idx) => (
            <div
              key={idx}
              onClick={() => onContentSelect?.(rec.content)}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-purple-500 dark:hover:border-purple-400 transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                    {rec.content.title || 'Untitled'}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    {getReasonIcon(rec.reason)}
                    <span>{rec.reason}</span>
                    {rec.score > 0 && (
                      <>
                        <span>•</span>
                        <span>Score: {rec.score}</span>
                      </>
                    )}
                  </div>
                </div>
                <button className="p-2 text-gray-400 hover:text-gray-600">
                  <Eye className="w-5 h-5" />
                </button>
              </div>
              {rec.content.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                  {rec.content.description}
                </p>
              )}
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="capitalize">{rec.content.type}</span>
                {rec.content.tags && rec.content.tags.length > 0 && (
                  <>
                    <span>•</span>
                    <span>{rec.content.tags.slice(0, 3).join(', ')}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


