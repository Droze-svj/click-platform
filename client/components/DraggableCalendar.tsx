'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface ScheduledPost {
  _id: string
  platform: string
  content: {
    text: string
    mediaUrl?: string
    hashtags: string[]
  }
  scheduledTime: string
  status: string
}

interface DraggableCalendarProps {
  view: 'month' | 'week' | 'day'
  onPostUpdate?: () => void
}

export default function DraggableCalendar({ view = 'month', onPostUpdate }: DraggableCalendarProps) {
  const { showToast } = useToast()
  const [posts, setPosts] = useState<ScheduledPost[]>([])
  const [loading, setLoading] = useState(true)
  const [draggedPost, setDraggedPost] = useState<string | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())

  useEffect(() => {
    loadPosts()
  }, [currentDate])

  const loadPosts = async () => {
    try {
      const token = localStorage.getItem('token')
      const startDate = new Date(currentDate)
      startDate.setDate(1)
      const endDate = new Date(currentDate)
      endDate.setMonth(endDate.getMonth() + 1)

      const response = await axios.get(
        `${API_URL}/scheduler/posts?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )

      if (response.data.success) {
        setPosts(response.data.data || [])
      }
    } catch (error) {
      showToast('Failed to load scheduled posts', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDragStart = (postId: string) => {
    setDraggedPost(postId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault()
    if (!draggedPost) return

    try {
      const token = localStorage.getItem('token')
      await axios.put(
        `${API_URL}/scheduler/posts/${draggedPost}`,
        { scheduledTime: targetDate.toISOString() },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )

      showToast('Post rescheduled successfully', 'success')
      setDraggedPost(null)
      loadPosts()
      onPostUpdate?.()
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to reschedule post', 'error')
      setDraggedPost(null)
    }
  }

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day))
    }

    return days
  }

  const getPostsForDate = (date: Date | null) => {
    if (!date) return []
    const dateStr = date.toISOString().split('T')[0]
    return posts.filter(post => {
      const postDate = new Date(post.scheduledTime).toISOString().split('T')[0]
      return postDate === dateStr
    })
  }

  const getPlatformColor = (platform: string) => {
    const colors: Record<string, string> = {
      twitter: 'bg-blue-500',
      instagram: 'bg-pink-500',
      linkedin: 'bg-blue-600',
      facebook: 'bg-blue-700',
      tiktok: 'bg-black',
      youtube: 'bg-red-500'
    }
    return colors[platform.toLowerCase()] || 'bg-gray-500'
  }

  const days = getDaysInMonth()
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  if (loading) {
    return <div className="text-center py-8">Loading calendar...</div>
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const newDate = new Date(currentDate)
              newDate.setMonth(newDate.getMonth() - 1)
              setCurrentDate(newDate)
            }}
            className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            ← Previous
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Today
          </button>
          <button
            onClick={() => {
              const newDate = new Date(currentDate)
              newDate.setMonth(newDate.getMonth() + 1)
              setCurrentDate(newDate)
            }}
            className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {/* Day Headers */}
        {dayNames.map(day => (
          <div key={day} className="text-center font-semibold text-gray-600 dark:text-gray-400 p-2">
            {day}
          </div>
        ))}

        {/* Calendar Days */}
        {days.map((date, index) => {
          const dayPosts = getPostsForDate(date)
          const isToday = date && date.toDateString() === new Date().toDateString()

          return (
            <div
              key={index}
              onDragOver={handleDragOver}
              onDrop={(e) => date && handleDrop(e, date)}
              className={`min-h-24 border rounded-lg p-2 ${
                isToday ? 'bg-blue-50 dark:bg-blue-900 border-blue-300' : 'bg-gray-50 dark:bg-gray-700'
              } ${!date ? 'opacity-50' : 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600'}`}
            >
              {date && (
                <>
                  <div className={`text-sm font-semibold mb-1 ${isToday ? 'text-blue-600' : ''}`}>
                    {date.getDate()}
                  </div>
                  <div className="space-y-1">
                    {dayPosts.slice(0, 3).map(post => (
                      <div
                        key={post._id}
                        draggable
                        onDragStart={() => handleDragStart(post._id)}
                        className={`text-xs p-1 rounded ${getPlatformColor(post.platform)} text-white cursor-move truncate`}
                        title={`${post.platform}: ${post.content.text.substring(0, 50)}...`}
                      >
                        {post.platform}
                      </div>
                    ))}
                    {dayPosts.length > 3 && (
                      <div className="text-xs text-gray-500">
                        +{dayPosts.length - 3} more
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-4">
        <p className="text-sm font-semibold">Platforms:</p>
        {['twitter', 'instagram', 'linkedin', 'facebook', 'tiktok', 'youtube'].map(platform => (
          <div key={platform} className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded ${getPlatformColor(platform)}`} />
            <span className="text-sm capitalize">{platform}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
        💡 Drag and drop posts to reschedule them
      </div>
    </div>
  )
}







