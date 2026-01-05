'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../contexts/ToastContext'
import { Calendar, Clock, AlertCircle, Plus } from 'lucide-react'
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

  useEffect(() => {
    if (user && token) {
      loadCalendar()
      loadGaps()
    }
  }, [user, token, currentDate])

  const loadCalendar = async () => {
    setLoading(true)
    try {
      const startDate = getStartDate()
      const endDate = getEndDate()

      const response = await axios.get(
        `${API_URL}/productive/calendar?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
        {
        }
      )

      if (response.data.success) {
        setCalendar(response.data.data || {})
      }
    } catch (error) {
      showToast('Failed to load calendar', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadGaps = async () => {

    try {
      const startDate = getStartDate()
      const endDate = getEndDate()

      const response = await axios.get(
        `${API_URL}/productive/calendar/gaps?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
        {
        }
      )


      if (response.data.success) {
        let gapsData = response.data.data || []
        // Handle case where API returns object instead of array
        if (!Array.isArray(gapsData)) {
          gapsData = []
        }
        setGaps(gapsData)
      }
    } catch (error) {
      // Silent fail for gaps
    }
  }

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

  const getPlatformColor = (platform: string) => {
    const colors = {
      twitter: 'bg-blue-500',
      linkedin: 'bg-blue-600',
      facebook: 'bg-blue-700',
      instagram: 'bg-pink-500'
    }
    return colors[platform as keyof typeof colors] || 'bg-gray-500'
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    )
  }

  const days = getDaysInView()

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="text-purple-600" size={24} />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Content Calendar</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView('month')}
            className={`px-3 py-1 rounded text-sm ${view === 'month' ? 'bg-purple-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
          >
            Month
          </button>
          <button
            onClick={() => setView('week')}
            className={`px-3 py-1 rounded text-sm ${view === 'week' ? 'bg-purple-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
          >
            Week
          </button>
          <button
            onClick={() => setView('day')}
            className={`px-3 py-1 rounded text-sm ${view === 'day' ? 'bg-purple-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
          >
            Day
          </button>
        </div>
      </div>

      {/* Content Gaps Alert */}
      {gaps.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="text-yellow-600" size={20} />
            <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
              {gaps.length} Content Gap{gaps.length !== 1 ? 's' : ''} Detected
            </h3>
          </div>
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            Consider scheduling content for these dates to maintain consistency.
          </p>
        </div>
      )}

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2 mb-4">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center font-semibold text-gray-700 dark:text-gray-300 text-sm py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((day, index) => {
          const dateStr = day.toISOString().split('T')[0]
          const posts = calendar[dateStr] || []
          const isToday = dateStr === new Date().toISOString().split('T')[0]
          const isGap = gaps.some(gap => gap.date === dateStr)

          return (
            <div
              key={index}
              className={`min-h-24 border rounded-lg p-2 ${
                isToday
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-200 dark:border-gray-700'
              } ${isGap ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className={`text-sm font-medium ${isToday ? 'text-purple-600 dark:text-purple-400' : 'text-gray-700 dark:text-gray-300'}`}>
                  {day.getDate()}
                </span>
                {isGap && (
                  <AlertCircle className="text-yellow-500" size={14} />
                )}
              </div>
              <div className="space-y-1">
                {posts.slice(0, 2).map((post) => (
                  <div
                    key={post._id}
                    className={`${getPlatformColor(post.platform)} text-white text-xs px-1 py-0.5 rounded truncate`}
                    title={`${post.platform}: ${post.content.text}`}
                  >
                    {post.platform}
                  </div>
                ))}
                {posts.length > 2 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    +{posts.length - 2} more
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-500 rounded" />
          <span className="text-gray-700 dark:text-gray-300">Twitter</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-600 rounded" />
          <span className="text-gray-700 dark:text-gray-300">LinkedIn</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-pink-500 rounded" />
          <span className="text-gray-700 dark:text-gray-300">Instagram</span>
        </div>
        <div className="flex items-center gap-2">
          <AlertCircle className="text-yellow-500" size={16} />
          <span className="text-gray-700 dark:text-gray-300">Content Gap</span>
        </div>
      </div>
    </div>
  )
}







