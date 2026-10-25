'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calendar, Clock, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/hooks/useTranslation'
import { apiGet } from '../lib/api'

interface SchedulingAssistantProps {
  contentId?: string
  content?: {
    text?: string
    type?: string
    platform?: string
  }
}

// GET /social/optimal-times?platform=X answers
// { data: { platform, niche, optimalTimes: [{ start, end, label }], timezone } }
// — niche posting windows in whole hours (24h clock).
interface PostingWindow {
  start: number
  end: number
  label: string
}

const DEFAULT_PLATFORM = 'instagram'
const pad = (h: number) => `${String(((Number(h) % 24) + 24) % 24).padStart(2, '0')}:00`

export default function ContentSchedulingAssistant({ contentId, content }: SchedulingAssistantProps) {
  const { t } = useTranslation()
  const [windows, setWindows] = useState<PostingWindow[]>([])
  const [timezone, setTimezone] = useState('UTC')
  const [isLoading, setIsLoading] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const router = useRouter()
  // 'all' is not a platform the endpoint knows — it answered an empty list.
  const platform = (content?.platform && content.platform !== 'all') ? content.platform : DEFAULT_PLATFORM
  const hasContent = Boolean(contentId || content)

  const loadOptimalTimes = useCallback(async () => {
    setIsLoading(true)
    setLoadFailed(false)
    try {
      const res: any = await apiGet(`/social/optimal-times?platform=${encodeURIComponent(platform)}`)
      const data = res?.data ?? res
      const list = Array.isArray(data?.optimalTimes) ? data.optimalTimes : []
      setWindows(list.filter((w: any) => w && typeof w.start === 'number' && typeof w.end === 'number'))
      if (typeof data?.timezone === 'string') setTimezone(data.timezone)
    } catch {
      setWindows([])
      setLoadFailed(true)
    } finally {
      setIsLoading(false)
    }
  }, [platform])

  useEffect(() => {
    if (hasContent) loadOptimalTimes()
  }, [hasContent, contentId, loadOptimalTimes])

  const handleSchedule = (w: PostingWindow) => {
    const params = new URLSearchParams({ platform, suggestedTime: pad(w.start) })
    if (contentId) params.set('contentId', contentId)
    router.push(`/dashboard/scheduler?${params.toString()}`)
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

  if (windows.length === 0) {
    return (
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300">
          <Sparkles className="w-4 h-4" />
          <p className="text-sm">
            {loadFailed ? t('contentSchedulingAssistant.loadFailed') : t('contentSchedulingAssistant.connectAccountsPrompt')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="ds-surface-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        <h3 className="ds-text-h3 text-theme-primary">
          {t('contentSchedulingAssistant.bestTimesToPost')}
        </h3>
      </div>

      <div className="space-y-3">
        {windows.slice(0, 3).map((w, index) => (
          <div
            key={`${w.start}-${w.end}-${index}`}
            className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-purple-300 dark:hover:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900 dark:text-white capitalize">
                    {platform}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Clock className="w-3 h-3" />
                  <span>{`${pad(w.start)}–${pad(w.end)} ${timezone}`}</span>
                </div>
                {w.label && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {w.label}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleSchedule(w)}
                className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                {t('contentSchedulingAssistant.schedule')}
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => router.push('/dashboard/scheduler')}
        className="mt-4 w-full text-center text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium"
      >
        {t('contentSchedulingAssistant.viewAllOptimalTimes')}
      </button>
    </div>
  )
}






