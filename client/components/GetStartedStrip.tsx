'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiGet } from '../lib/api'
import { X, ChevronRight } from 'lucide-react'

const DISMISSED_KEY = 'get_started_strip_dismissed'

const stepRoutes: Record<string, string> = {
  welcome: '/dashboard',
  profile: '/dashboard/settings/profile',
  'first-content': '/dashboard/content',
  'connect-social': '/dashboard/social',
  'explore-features': '/dashboard',
  complete: '/dashboard',
}

export default function GetStartedStrip() {
  const router = useRouter()
  const [progress, setProgress] = useState<{
    totalSteps: number
    completedSteps: number
    currentStepData: { id: string; title: string } | null
    isComplete: boolean
  } | null>(null)
  const [dismissed, setDismissed] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setDismissed(localStorage.getItem(DISMISSED_KEY) === 'true')
  }, [])

  useEffect(() => {
    if (dismissed) {
      setLoading(false)
      return
    }
    let cancelled = false
    apiGet('/onboarding')
      .then((res: any) => {
        if (cancelled) return
        const data = res?.data ?? res
        const payload = data?.data ?? data
        if (payload && !payload.isComplete && (payload.totalSteps ?? 0) > 0) {
          setProgress({
            totalSteps: payload.totalSteps,
            completedSteps: payload.completedSteps ?? 0,
            currentStepData: payload.currentStepData ?? null,
            isComplete: payload.isComplete,
          })
        } else {
          setProgress(null)
        }
      })
      .catch(() => {
        if (!cancelled) setProgress(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [dismissed])

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true')
    setDismissed(true)
  }

  const handleContinue = () => {
    if (!progress?.currentStepData?.id) return
    const route = stepRoutes[progress.currentStepData.id] ?? '/dashboard'
    router.push(route)
  }

  if (dismissed || loading || !progress || progress.isComplete) return null

  const { totalSteps, completedSteps, currentStepData } = progress
  const pct = totalSteps ? Math.round((completedSteps / totalSteps) * 100) : 0

  return (
    <div className="relative flex items-center justify-between gap-4 px-4 py-3 bg-gradient-to-r from-primary-500/10 to-purple-500/10 dark:from-primary-500/20 dark:to-purple-500/20 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex-shrink-0 w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 dark:bg-primary-400 rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
          Get started: {completedSteps}/{totalSteps}
          {currentStepData?.title && (
            <span className="text-gray-500 dark:text-gray-400 font-normal"> — {currentStepData.title}</span>
          )}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={handleContinue}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-500/10 rounded-lg transition"
        >
          Continue
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
