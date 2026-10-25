'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../hooks/useAuth'
import { apiGet, apiPost, handleApiError } from '../lib/api'
import { useTranslation } from '@/hooks/useTranslation'
import { useToast } from '../contexts/ToastContext'

interface Suggestion {
  type: 'workflow' | 'action' | 'onboarding'
  title: string
  description: string
  action?: string
  workflowId?: string
  steps?: any[]
  route?: string
}

export default function NextStepsPanel() {
  const router = useRouter()
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { user } = useAuth()
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)

  const dbg = (message: string, data: Record<string, any>) => {
  }

  useEffect(() => {
    if (user) {
      loadSuggestions()
    }
  }, [user])

  const loadSuggestions = async () => {
    try {
      const [workflowRes, onboardingRes] = await Promise.all([
        apiGet<any>('/workflows/suggestions'),
        apiGet<any>('/onboarding').catch(() => null),
      ])
      let list: Suggestion[] = Array.isArray(workflowRes?.data) ? workflowRes.data : []
      // AI-guided onboarding: prepend suggested next step when onboarding is not complete
      const onboarding = onboardingRes?.data
      if (onboarding && !onboarding.isComplete && onboarding.currentStepData) {
        const step = onboarding.currentStepData
        const routeByComponent: Record<string, string> = {
          ConnectSocialStep: '/dashboard/social',
          FirstContentStep: '/dashboard/content',
          ExploreFeaturesStep: '/dashboard',
          ProfileStep: '/dashboard/settings/profile',
        }
        list = [
          {
            type: 'onboarding',
            title: step.title || t('nextStepsPanel.nextStep'),
            description: step.description || t('nextStepsPanel.continueSetup'),
            route: routeByComponent[step.component] || '/dashboard',
          },
          ...list,
        ]
      }
      setSuggestions(list)
    } catch (error) {
      console.error('Failed to load suggestions', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSuggestionClick = async (suggestion: Suggestion) => {
    if (suggestion.type === 'onboarding' && suggestion.route) {
      router.push(suggestion.route)
      return
    }
    if (suggestion.type === 'workflow' && suggestion.workflowId) {
      try {
        await apiPost<any>(`/workflows/${suggestion.workflowId}/execute`, { data: {} })
        if (suggestion.steps && suggestion.steps.length > 0) {
          const nextAction = suggestion.steps[1]?.action
          navigateToAction(nextAction)
        }
      } catch (error) {
        showToast(handleApiError(error) || t('nextStepsPanel.workflowFailed'), 'error')
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
    <div className="w-full">
      <div className="ds-surface-card overflow-hidden">
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <h3 className="ds-text-h3 text-theme-primary">{t('nextStepsPanel.suggestedNextSteps')}</h3>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-expanded={!collapsed}
            className="rounded-md px-2 py-1 text-theme-muted hover:text-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {collapsed ? '▾' : '▴'}
          </button>
        </div>
        {!collapsed && (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {suggestions.map((suggestion, index) => (
              <button
                type="button"
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







