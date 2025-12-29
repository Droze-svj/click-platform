'use client'

import { useState, useEffect } from 'react'
import { Lightbulb, TrendingUp, Clock, Hash, Sparkles } from 'lucide-react'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface Suggestion {
  type: string
  title: string
  description: string
  action: string
  priority: 'high' | 'medium' | 'low'
  hashtags?: string[]
}

export default function SmartContentSuggestions() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSuggestions()
  }, [])

  const loadSuggestions = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      
      const response = await axios.get(
        `${API_URL}/ai/smart-suggestions?limit=5`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.data.success) {
        setSuggestions(response.data.data.suggestions || [])
      }
    } catch (error: any) {
      console.error('Suggestions error:', error)
    } finally {
      setLoading(false)
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'content_type':
        return <Sparkles className="w-5 h-5" />
      case 'platform':
        return <TrendingUp className="w-5 h-5" />
      case 'hashtags':
        return <Hash className="w-5 h-5" />
      case 'timing':
        return <Clock className="w-5 h-5" />
      default:
        return <Lightbulb className="w-5 h-5" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-red-500 bg-red-50 dark:bg-red-900/20'
      case 'medium':
        return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
      default:
        return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  if (suggestions.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="w-6 h-6 text-yellow-500" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            Smart Content Suggestions
          </h3>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Start creating content to get personalized suggestions based on your performance!
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-6 h-6 text-yellow-500" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            Smart Content Suggestions
          </h3>
        </div>
        <button
          onClick={loadSuggestions}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Refresh
        </button>
      </div>

      <div className="space-y-3">
        {suggestions.map((suggestion, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-lg border-l-4 ${getPriorityColor(suggestion.priority)}`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-blue-600 dark:text-blue-400">
                {getIcon(suggestion.type)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-gray-900 dark:text-white">
                    {suggestion.title}
                  </h4>
                  <span className={`text-xs px-2 py-1 rounded ${
                    suggestion.priority === 'high'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      : suggestion.priority === 'medium'
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                  }`}>
                    {suggestion.priority.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                  {suggestion.description}
                </p>
                {suggestion.hashtags && suggestion.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {suggestion.hashtags.map((tag, tagIdx) => (
                      <span
                        key={tagIdx}
                        className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <button className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium">
                  {suggestion.action} →
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


