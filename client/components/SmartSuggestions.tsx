'use client'

import { useState, useEffect } from 'react'
import { Sparkles, TrendingUp, Lightbulb, Zap, Target } from 'lucide-react'
import { useRouter } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'

interface Suggestion {
  id: string
  type: 'trending' | 'idea' | 'optimization' | 'reminder'
  title: string
  description: string
  action?: string
  iconType?: string
  icon?: React.ReactNode
  priority: 'high' | 'medium' | 'low'
}

export default function SmartSuggestions() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchSuggestions()
  }, [])

  const fetchSuggestions = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/suggestions/daily`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      })
      
      if (response.ok) {
        const data = await response.json()
        setSuggestions(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSuggestionClick = (suggestion: Suggestion) => {
    if (suggestion.action) {
      router.push(suggestion.action)
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
        </div>
      </div>
    )
  }

  if (suggestions.length === 0) {
    return null
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg shadow-lg p-6 border border-purple-200 dark:border-purple-800">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
          Smart Suggestions
        </h3>
      </div>

      <div className="space-y-3">
        {suggestions.slice(0, 3).map((suggestion) => (
          <button
            key={suggestion.id}
            onClick={() => handleSuggestionClick(suggestion)}
            className="w-full text-left p-4 bg-white dark:bg-gray-800 rounded-lg hover:shadow-md transition-all border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 group"
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${
                suggestion.priority === 'high' 
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                  : suggestion.priority === 'medium'
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
              }`}>
                {suggestion.icon || (
                  suggestion.iconType === 'trending' ? <TrendingUp className="w-4 h-4" /> :
                  suggestion.iconType === 'idea' ? <Lightbulb className="w-4 h-4" /> :
                  suggestion.iconType === 'optimization' ? <Zap className="w-4 h-4" /> :
                  <Target className="w-4 h-4" />
                )}
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-sm text-gray-900 dark:text-white mb-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                  {suggestion.title}
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {suggestion.description}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {suggestions.length > 3 && (
        <button
          onClick={() => router.push('/dashboard/suggestions')}
          className="mt-4 w-full text-center text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium"
        >
          View all {suggestions.length} suggestions →
        </button>
      )}
    </div>
  )
}

