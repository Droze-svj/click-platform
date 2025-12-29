'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { useAuth } from '../hooks/useAuth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface Suggestion {
  type: 'workflow' | 'action'
  title: string
  description: string
  action?: string
  workflowId?: string
  steps?: any[]
}

export default function NextStepsPanel() {
  const router = useRouter()
  const { user } = useAuth()
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (user) {
      loadSuggestions()
    }
  }, [user])

  const loadSuggestions = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/workflows/suggestions`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.data.success) {
        setSuggestions(response.data.data || [])
      }
    } catch (error) {
      console.error('Failed to load suggestions', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSuggestionClick = async (suggestion: Suggestion) => {
    if (suggestion.type === 'workflow' && suggestion.workflowId) {
      // Execute workflow
      try {
        const token = localStorage.getItem('token')
        await axios.post(
          `${API_URL}/workflows/${suggestion.workflowId}/execute`,
          { data: {} },
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        )
        // Navigate based on workflow steps
        if (suggestion.steps && suggestion.steps.length > 0) {
          const nextAction = suggestion.steps[1]?.action
          navigateToAction(nextAction)
        }
      } catch (error) {
        console.error('Failed to execute workflow', error)
      }
    } else if (suggestion.action) {
      navigateToAction(suggestion.action)
    }
  }

  const navigateToAction = (action: string) => {
    const actionRoutes: Record<string, string> = {
      'upload_video': '/dashboard/video',
      'generate_content': '/dashboard/content',
      'generate_script': '/dashboard/scripts',
      'create_quote': '/dashboard/quotes',
      'schedule_post': '/dashboard/scheduler',
      'apply_effects': '/dashboard/video',
      'add_music': '/dashboard/video'
    }

    const route = actionRoutes[action]
    if (route) {
      router.push(route)
    }
  }

  if (loading || suggestions.length === 0) {
    return null
  }

  return (
    <div className={`fixed right-4 bottom-4 z-40 transition-all duration-300 ${
      collapsed ? 'w-16' : 'w-80'
    }`}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-semibold text-sm">Suggested Next Steps</h3>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-gray-400 hover:text-gray-600"
          >
            {collapsed ? '→' : '←'}
          </button>
        </div>
        {!collapsed && (
          <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-purple-50 dark:hover:bg-gray-700 transition-colors"
              >
                <p className="font-medium text-sm">{suggestion.title}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {suggestion.description}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}







