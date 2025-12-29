'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import LoadingSpinner from '../../../components/LoadingSpinner'
import LoadingSkeleton from '../../../components/LoadingSkeleton'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { extractApiData, extractApiError } from '../../../utils/apiResponse'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

// Drag and drop types
interface DragData {
  postId: string
  platform: string
  originalDate: Date
}

interface ScheduledPost {
  _id: string
  platform: string
  content: {
    text: string
    hashtags: string[]
  }
  scheduledTime: string
  status: string
}

export default function CalendarPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<'month' | 'week' | 'day'>('month')
  const [draggedPost, setDraggedPost] = useState<DragData | null>(null)
  const [dragOverDate, setDragOverDate] = useState<Date | null>(null)

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }
    loadScheduledPosts()
  }, [user, router, currentDate])

  const loadScheduledPosts = async () => {
    try {
      const token = localStorage.getItem('token')
      const startDate = new Date(currentDate)
      startDate.setDate(1)
      const endDate = new Date(currentDate)
      endDate.setMonth(endDate.getMonth() + 1)

      const response = await axios.get(
        `${API_URL}/scheduler?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )

      const postsData = extractApiData<ScheduledPost[]>(response) || (Array.isArray(response.data) ? response.data : [])
      setScheduledPosts(Array.isArray(postsData) ? postsData : [])
    } catch (error) {
      const errorMessage = extractApiError(error)
      showToast(errorMessage || 'Failed to load scheduled posts', 'error')
    } finally {
      setLoading(false)
    }
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []
    // Empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    // Days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i))
    }
    return days
  }

  const getPostsForDate = (date: Date | null) => {
    if (!date) return []
    const dateStr = date.toISOString().split('T')[0]
    return scheduledPosts.filter(post => {
      const postDate = new Date(post.scheduledTime).toISOString().split('T')[0]
      return postDate === dateStr
    })
  }

  const getPlatformColor = (platform: string) => {
    const colors: Record<string, string> = {
      twitter: 'bg-blue-500',
      linkedin: 'bg-blue-700',
      instagram: 'bg-pink-500',
      facebook: 'bg-blue-600',
      tiktok: 'bg-black',
      youtube: 'bg-red-600'
    }
    return colors[platform as keyof typeof colors] || 'bg-gray-500'
  }

  const navigateMonth = (direction: number) => {
    const newDate = new Date(currentDate)
    newDate.setMonth(newDate.getMonth() + direction)
    setCurrentDate(newDate)
  }

  const handleDragStart = (e: React.DragEvent, post: ScheduledPost) => {
    setDraggedPost({
      postId: post._id,
      platform: post.platform,
      originalDate: new Date(post.scheduledTime)
    })
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, date: Date | null) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (date) {
      setDragOverDate(date)
    }
  }

  const handleDragLeave = () => {
    setDragOverDate(null)
  }

  const handleDrop = async (e: React.DragEvent, targetDate: Date | null) => {
    e.preventDefault()
    setDragOverDate(null)

    if (!draggedPost || !targetDate) return

    try {
      const token = localStorage.getItem('token')
      const newScheduledTime = new Date(targetDate)
      newScheduledTime.setHours(
        draggedPost.originalDate.getHours(),
        draggedPost.originalDate.getMinutes(),
        0,
        0
      )

      await axios.put(
        `${API_URL}/scheduler/posts/${draggedPost.postId}`,
        { scheduledTime: newScheduledTime.toISOString() },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )

      showToast('Post rescheduled successfully', 'success')
      await loadScheduledPosts()
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to reschedule post', 'error')
    } finally {
      setDraggedPost(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading calendar..." />
      </div>
    )
  }

  const days = getDaysInMonth(currentDate)
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Content Calendar</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setView('month')}
              className={`px-4 py-2 rounded-lg ${
                view === 'month' ? 'bg-purple-600 text-white' : 'bg-white text-gray-700'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setView('week')}
              className={`px-4 py-2 rounded-lg ${
                view === 'week' ? 'bg-purple-600 text-white' : 'bg-white text-gray-700'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => router.push('/dashboard/scheduler')}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
            >
              + Schedule Post
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <button
              onClick={() => navigateMonth(-1)}
              className="px-4 py-2 border rounded-lg hover:bg-gray-100"
            >
              ← Previous
            </button>
            <h2 className="text-2xl font-semibold">{monthName}</h2>
            <button
              onClick={() => navigateMonth(1)}
              className="px-4 py-2 border rounded-lg hover:bg-gray-100"
            >
              Next →
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="text-center font-semibold text-gray-600 py-2">
                {day}
              </div>
            ))}

            {days.map((date, index) => {
              const posts = getPostsForDate(date)
              const isToday = date && date.toDateString() === new Date().toDateString()
              const isDragOver = date && dragOverDate && date.toDateString() === dragOverDate.toDateString()

              return (
                <div
                  key={index}
                  className={`min-h-24 border rounded-lg p-2 ${
                    isToday ? 'bg-purple-50 border-purple-500' : 'bg-white'
                  } ${
                    isDragOver ? 'bg-blue-100 border-blue-500 border-2' : ''
                  } ${
                    date ? 'cursor-pointer' : ''
                  }`}
                  onDragOver={(e) => handleDragOver(e, date)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, date)}
                >
                  {date && (
                    <>
                      <div className={`text-sm font-semibold mb-1 ${isToday ? 'text-purple-600' : ''}`}>
                        {date.getDate()}
                      </div>
                      <div className="space-y-1">
                        {posts.slice(0, 3).map((post) => (
                          <div
                            key={post._id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, post)}
                            className={`text-xs px-2 py-1 rounded text-white truncate cursor-move hover:opacity-80 ${getPlatformColor(post.platform)}`}
                            title={`${post.platform}: ${post.content.text} (Drag to reschedule)`}
                          >
                            {post.platform}
                          </div>
                        ))}
                        {posts.length > 3 && (
                          <div className="text-xs text-gray-500">
                            +{posts.length - 3} more
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Upcoming Posts</h2>
          <div className="space-y-3">
            {scheduledPosts
              .filter(post => new Date(post.scheduledTime) >= new Date())
              .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime())
              .slice(0, 10)
              .map((post) => (
                <div key={post._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-1 rounded text-xs text-white ${getPlatformColor(post.platform)}`}>
                        {post.platform}
                      </span>
                      <span className="text-sm text-gray-600">
                        {new Date(post.scheduledTime).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm truncate">{post.content.text}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${
                    post.status === 'scheduled' ? 'bg-green-100 text-green-800' :
                    post.status === 'posted' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {post.status}
                  </span>
                </div>
              ))}
          </div>
          </div>
        </div>
      </div>
  )
}

