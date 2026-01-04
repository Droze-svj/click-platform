'use client'

import { useState, useEffect } from 'react'
import { Calendar, Clock, TrendingUp, Sparkles, CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface SchedulingAssistantProps {
  contentId?: string
  content?: {
    text?: string
    type?: string
    platform?: string
  }
}

interface OptimalTime {
  platform: string
  time: string
  day: string
  score: number
  reason: string
}

export default function ContentSchedulingAssistant({ contentId, content }: SchedulingAssistantProps) {
  const [optimalTimes, setOptimalTimes] = useState<OptimalTime[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (contentId || content) {
      loadOptimalTimes()
    }
  }, [contentId, content])

  const loadOptimalTimes = async () => {
    setIsLoading(true)
    try {
      const token = localStorage.getItem('token')
      const platform = content?.platform || 'all'
      
      const response = await fetch(`/api/social/optimal-times?platform=${platform}`, {
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        setOptimalTimes(data.data || [])
      }
    } catch (error) {
      console.error('Failed to load optimal times:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSchedule = (time: OptimalTime) => {
    if (contentId) {
      router.push(`/dashboard/scheduler?contentId=${contentId}&platform=${time.platform}&suggestedTime=${time.time}`)
    } else {
      router.push(`/dashboard/scheduler?platform=${time.platform}&suggestedTime=${time.time}`)
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    )
  }

  if (optimalTimes.length === 0) {
    return (
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300">
          <Sparkles className="w-4 h-4" />
          <p className="text-sm">
            Connect social accounts to get optimal posting time suggestions
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
          Best Times to Post
        </h3>
      </div>

      <div className="space-y-3">
        {optimalTimes.slice(0, 3).map((time, index) => (
          <div
            key={index}
            className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-purple-300 dark:hover:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900 dark:text-white capitalize">
                    {time.platform}
                  </span>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-green-600 dark:text-green-400" />
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                      {time.score}% optimal
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Clock className="w-3 h-3" />
                  <span>{time.day} at {time.time}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {time.reason}
                </p>
              </div>
              <button
                onClick={() => handleSchedule(time)}
                className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Schedule
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => router.push('/dashboard/scheduler')}
        className="mt-4 w-full text-center text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium"
      >
        View all optimal times →
      </button>
    </div>
  )
}






