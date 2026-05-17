'use client'

import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../contexts/ToastContext'
import { Calendar, AlertCircle, Plus, LayoutGrid, Zap } from 'lucide-react'
import { API_URL } from '../lib/api'

interface ScheduledPost {
  _id: string
  platform: string
  content: {
    text: string
    mediaUrl?: string
    hashtags?: string[]
  }
  scheduledTime: string
  status: string
  contentId?: {
    _id: string
    title: string
    type: string
  }
}

interface ContentGap {
  date: string
  dayOfWeek: string
  recommendation: string
}

export default function EnhancedContentCalendar() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const [calendar, setCalendar] = useState<Record<string, ScheduledPost[]>>({})
  const [gaps, setGaps] = useState<ContentGap[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'month' | 'week' | 'day'>('month')
  const [currentDate, setCurrentDate] = useState(new Date())

  const loadCalendar = useCallback(async () => {
    setLoading(true)
    try {
      const startDate = getStartDate()
      const endDate = getEndDate()

      const response = await axios.get(
        `${API_URL}/productive/calendar?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
        {}
      )

      if (response.data.success) {
        setCalendar(response.data.data || {})
      }
    } catch (error) {
      showToast('Failed to load calendar', 'error')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, view, showToast])

  const loadGaps = useCallback(async () => {
    try {
      const startDate = getStartDate()
      const endDate = getEndDate()

      const response = await axios.get(
        `${API_URL}/productive/calendar/gaps?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
        {}
      )

      if (response.data.success) {
        let gapsData = response.data.data || []
        if (!Array.isArray(gapsData)) {
          gapsData = []
        }
        setGaps(gapsData)
      }
    } catch (error) {
      // Silent fail for gaps
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, view])

  useEffect(() => {
    if (user && token) {
      loadCalendar()
      loadGaps()
    }
  }, [user, token, currentDate, loadCalendar, loadGaps])

  const getStartDate = () => {
    const date = new Date(currentDate)
    if (view === 'month') {
      date.setDate(1)
    } else if (view === 'week') {
      const day = date.getDay()
      date.setDate(date.getDate() - day)
    }
    return date
  }

  const getEndDate = () => {
    const date = new Date(currentDate)
    if (view === 'month') {
      date.setMonth(date.getMonth() + 1)
      date.setDate(0)
    } else if (view === 'week') {
      date.setDate(date.getDate() + (7 - date.getDay()))
    } else {
      date.setDate(date.getDate() + 1)
    }
    return date
  }

  const getDaysInView = () => {
    const days = []
    const start = getStartDate()
    const end = getEndDate()
    const current = new Date(start)

    while (current <= end) {
      days.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }

    return days
  }

  const getPlatformStyle = (platform: string) => {
    const styles = {
      twitter: 'bg-surface-800 text-white',
      linkedin: 'bg-blue-600 text-white',
      facebook: 'bg-indigo-600 text-white',
      instagram: 'bg-pink-500 text-white',
      tiktok: 'bg-black text-white',
      youtube: 'bg-red-600 text-white'
    }
    return styles[platform.toLowerCase() as keyof typeof styles] || 'bg-surface-500 text-white'
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl p-8 shadow-sm">
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-surface-100 dark:bg-surface-800 rounded-xl w-1/3" />
          <div className="h-[400px] bg-surface-100 dark:bg-surface-800 rounded-2xl" />
        </div>
      </div>
    )
  }

  const days = getDaysInView()

  return (
    <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl p-6 sm:p-8 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8 border-b border-surface-200 dark:border-surface-800 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 flex items-center justify-center">
            <Calendar className="text-primary-600 dark:text-primary-400" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-surface-900 dark:text-white tracking-tight">Content Calendar</h2>
            <p className="text-xs font-bold text-surface-500 uppercase tracking-wider mt-1">Schedule & Gaps</p>
          </div>
        </div>
        <div className="flex bg-surface-50 dark:bg-surface-950 p-1.5 rounded-xl border border-surface-200 dark:border-surface-800 shadow-sm w-fit">
          <button
            type="button"
            onClick={() => setView('month')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${view === 'month' ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 shadow-sm border border-primary-200 dark:border-primary-800/50' : 'text-surface-500 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800'}`}
          >
            Month
          </button>
          <button
            type="button"
            onClick={() => setView('week')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${view === 'week' ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 shadow-sm border border-primary-200 dark:border-primary-800/50' : 'text-surface-500 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800'}`}
          >
            Week
          </button>
          <button
            type="button"
            onClick={() => setView('day')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${view === 'day' ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 shadow-sm border border-primary-200 dark:border-primary-800/50' : 'text-surface-500 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800'}`}
          >
            Day
          </button>
        </div>
      </div>

      {/* Content Gaps Alert */}
      {gaps.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-5 mb-8 flex items-start gap-4 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-800/40 flex items-center justify-center shrink-0">
            <AlertCircle className="text-amber-600 dark:text-amber-400" size={20} />
          </div>
          <div>
            <h3 className="font-black text-amber-900 dark:text-amber-300 tracking-tight">
              {gaps.length} Content Gap{gaps.length !== 1 ? 's' : ''} Detected
            </h3>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mt-1">
              Consider scheduling content for these dates to maintain consistency across platforms.
            </p>
          </div>
        </div>
      )}

      {/* Calendar Grid */}
      <div className="overflow-x-auto pb-4">
        <div className="min-w-[700px]">
          <div className="grid grid-cols-7 gap-3 mb-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center font-bold text-surface-500 uppercase tracking-wider text-xs py-2">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-3">
            {days.map((day, index) => {
              const dateStr = day.toISOString().split('T')[0]
              const posts = calendar[dateStr] || []
              const isToday = dateStr === new Date().toISOString().split('T')[0]
              const isGap = gaps.some(gap => gap.date === dateStr)

              return (
                <div
                  key={index}
                  className={`min-h-[100px] sm:min-h-[120px] rounded-xl p-3 transition-colors ${
                    isToday
                      ? 'border-2 border-primary-400 dark:border-primary-600 bg-primary-50/50 dark:bg-primary-900/10'
                      : 'border border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-950 hover:border-surface-300 dark:hover:border-surface-700'
                  } ${isGap ? 'ring-2 ring-amber-400/30 dark:ring-amber-500/30' : ''}`}
                >
                  <div className="flex justify-between items-center mb-3">
                    <span className={`text-sm font-bold ${isToday ? 'text-primary-600 dark:text-primary-400' : 'text-surface-700 dark:text-surface-300'}`}>
                      {day.getDate()}
                    </span>
                    {isGap && (
                      <div title="Content Gap">
                        <AlertCircle className="text-amber-500 animate-pulse" size={14} />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {posts.slice(0, 3).map((post) => (
                      <div
                        key={post._id}
                        className={`${getPlatformStyle(post.platform)} text-[10px] sm:text-xs font-bold px-2 py-1 rounded-md truncate shadow-sm`}
                        title={`${post.platform}: ${post.content.text}`}
                      >
                        {post.platform}
                      </div>
                    ))}
                    {posts.length > 3 && (
                      <div className="text-[10px] font-bold text-surface-500 text-center mt-2">
                        +{posts.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-8 flex flex-wrap gap-6 text-xs font-bold text-surface-600 dark:text-surface-400 uppercase tracking-wider pt-6 border-t border-surface-200 dark:border-surface-800">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-surface-800 rounded-sm shadow-sm" />
          <span>X (Twitter)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-600 rounded-sm shadow-sm" />
          <span>LinkedIn</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-indigo-600 rounded-sm shadow-sm" />
          <span>Facebook</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-pink-500 rounded-sm shadow-sm" />
          <span>Instagram</span>
        </div>
        <div className="flex items-center gap-2">
          <AlertCircle className="text-amber-500" size={16} />
          <span>Content Gap</span>
        </div>
      </div>
    </div>
  )
}
