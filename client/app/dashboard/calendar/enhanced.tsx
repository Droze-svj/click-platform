'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'
import DraggableCalendar from '../../../components/DraggableCalendar'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

export default function EnhancedCalendarPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [optimalTimes, setOptimalTimes] = useState<any>(null)
  const [contentGaps, setContentGaps] = useState<any>(null)

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }
    loadOptimalTimes()
    loadContentGaps()
  }, [user, router])

  const loadOptimalTimes = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/analytics/content-performance/optimal-times`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.data.success) {
        setOptimalTimes(response.data.data)
      }
    } catch (error) {
      // Silent fail
    }
  }

  const loadContentGaps = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/suggestions/enhanced/gaps`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.data.success) {
        setContentGaps(response.data.data)
      }
    } catch (error) {
      // Silent fail
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Enhanced Content Calendar</h1>
          <button
            onClick={() => router.push('/dashboard/scheduler')}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
          >
            + Schedule Post
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <DraggableCalendar view="month" onPostUpdate={() => {}} />
          </div>

          <div className="space-y-6">
            {/* Optimal Posting Times */}
            {optimalTimes && optimalTimes.optimalHours && optimalTimes.optimalHours.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">⏰ Optimal Posting Times</h2>
                <div className="space-y-3">
                  {optimalTimes.optimalHours.map((hour: any, index: number) => (
                    <div key={index} className="border rounded-lg p-3">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">{hour.time}</span>
                        <span className="text-sm text-gray-600">
                          {hour.averageEngagement.toFixed(0)} avg engagement
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Based on {hour.posts} posts
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Content Gaps */}
            {contentGaps && contentGaps.daysWithoutContent && contentGaps.daysWithoutContent.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">📅 Content Gaps</h2>
                <p className="text-sm text-gray-600 mb-2">
                  {contentGaps.daysWithoutContent.length} days without content in the last 30 days
                </p>
                <button
                  onClick={() => router.push('/dashboard/content')}
                  className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm"
                >
                  Create Content
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}







