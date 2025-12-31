'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'
import LoadingSpinner from '../../../components/LoadingSpinner'
import LoadingSkeleton from '../../../components/LoadingSkeleton'
import EnhancedContentCalendar from '../../../components/EnhancedContentCalendar'
import ViralPredictor from '../../../components/ViralPredictor'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { extractApiData, extractApiError } from '../../../utils/apiResponse'
import { Calendar, Clock, Plus, TrendingUp } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'

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
  }
}

export default function SchedulerPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const [posts, setPosts] = useState<ScheduledPost[]>([])
  const [loading, setLoading] = useState(true)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [selectedContent, setSelectedContent] = useState<string | null>(null)
  const [selectedPlatform, setSelectedPlatform] = useState('twitter')
  const [scheduledTime, setScheduledTime] = useState('')
  const [useOptimalTime, setUseOptimalTime] = useState(true)

  useEffect(() => {
    if (user && token) {
      loadPosts()
    }
  }, [user, token])

  const loadPosts = async () => {
    setLoading(true)
    try {
      const response = await axios.get(`${API_URL}/scheduler`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const posts = extractApiData<ScheduledPost[]>(response) || []
      setPosts(Array.isArray(posts) ? posts : [])
    } catch (error) {
      const errorMessage = extractApiError(error)
      showToast(errorMessage || 'Failed to load scheduled posts', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSchedule = async () => {
    if (!selectedContent) {
      showToast('Please select content', 'warning')
      return
    }

    try {
      if (useOptimalTime) {
        await axios.post(
          `${API_URL}/scheduling/optimal`,
          {
            contentId: selectedContent,
            platform: selectedPlatform
          },
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        )
      } else {
        await axios.post(
          `${API_URL}/scheduler`,
          {
            contentId: selectedContent,
            platform: selectedPlatform,
            scheduledTime: scheduledTime || new Date().toISOString()
          },
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        )
      }

      showToast('Content scheduled successfully!', 'success')
      setShowScheduleModal(false)
      loadPosts()
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to schedule content', 'error')
    }
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8">
          {loading && (
            <div className="mb-6">
              <LoadingSkeleton type="card" count={3} />
            </div>
          )}
          {!loading && (
            <>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 md:gap-0 mb-4 md:mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Content Scheduler</h1>
          <button
            onClick={() => setShowScheduleModal(true)}
            className="w-full sm:w-auto bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-purple-700 transition-colors touch-target"
          >
            <Plus size={20} />
            <span>Schedule Content</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-4 md:mb-6">
          <div className="lg:col-span-2 order-2 lg:order-1">
            <EnhancedContentCalendar />
          </div>
          <div className="order-1 lg:order-2">
            <ViralPredictor
              content={{
                text: '',
                platform: selectedPlatform
              }}
            />
          </div>
        </div>

        {/* Scheduled Posts List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 md:p-6">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-3 md:mb-4">Upcoming Posts</h2>
          {posts.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center py-8">
              No scheduled posts. Schedule your first post!
            </p>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <div
                  key={post._id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold text-white ${
                        post.platform === 'twitter' ? 'bg-blue-500' :
                        post.platform === 'linkedin' ? 'bg-blue-600' :
                        post.platform === 'instagram' ? 'bg-pink-500' :
                        'bg-gray-500'
                      }`}>
                        {post.platform}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        post.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                        post.status === 'posted' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {post.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                      {post.content.text || post.contentId?.title || 'No content'}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <Clock size={14} />
                      {new Date(post.scheduledTime).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Schedule Modal */}
        {showScheduleModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-4 md:p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-3 md:mb-4">Schedule Content</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Content ID
                  </label>
                  <input
                    type="text"
                    value={selectedContent || ''}
                    onChange={(e) => setSelectedContent(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter content ID"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Platform
                  </label>
                  <select
                    value={selectedPlatform}
                    onChange={(e) => setSelectedPlatform(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="twitter">Twitter/X</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="facebook">Facebook</option>
                    <option value="instagram">Instagram</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="useOptimal"
                    checked={useOptimalTime}
                    onChange={(e) => setUseOptimalTime(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="useOptimal" className="text-sm text-gray-700 dark:text-gray-300">
                    Use optimal posting time
                  </label>
                </div>

                {!useOptimalTime && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Scheduled Time
                    </label>
                    <input
                      type="datetime-local"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-end mt-4 md:mt-6">
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 touch-target"
                >
                  Cancel
                </button>
                      <button
                        onClick={handleSchedule}
                        className="w-full sm:w-auto px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 touch-target"
                        aria-label="Schedule content for selected platform and time"
                      >
                        Schedule
                      </button>
              </div>
            </div>
          </div>
        )}
            </>
          )}
      </div>
      </div>
    </ErrorBoundary>
  )
}
