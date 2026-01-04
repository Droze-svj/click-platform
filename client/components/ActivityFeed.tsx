'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { apiGet } from '../lib/api'

interface Activity {
  _id: string
  type: string
  title: string
  description?: string
  entityType?: string
  entityId?: string
  createdAt: string
}

export default function ActivityFeed({ limit = 10 }: { limit?: number }) {
  const router = useRouter()
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  const dbg = (message: string, data: Record<string, any>) => {
  }

  useEffect(() => {
    loadActivities()
  }, [])

  const loadActivities = async () => {
    try {
      const response = await apiGet<any>(`/engagement/activities?limit=${limit}`)
      if (response?.success) {
        setActivities(response.data?.activities || [])
      }
    } catch (error) {
      console.error('Failed to load activities', error)
    } finally {
      setLoading(false)
    }
  }

  const getActivityIcon = (type: string) => {
    const icons: Record<string, string> = {
      'video_uploaded': '🎥',
      'content_generated': '✨',
      'script_created': '📝',
      'workflow_executed': '🤖',
      'achievement_unlocked': '🏆',
      'milestone_reached': '🎉',
      'streak_continued': '🔥',
      'post_scheduled': '📅',
      'quote_created': '💬'
    }
    return icons[type] || '📌'
  }

  const handleActivityClick = (activity: Activity) => {
    if (activity.entityType && activity.entityId) {
      const routes: Record<string, string> = {
        'video': `/dashboard/video/${activity.entityId}`,
        'content': `/dashboard/content/${activity.entityId}`,
        'script': `/dashboard/scripts/${activity.entityId}`,
        'workflow': `/dashboard/workflows`
      }
      const route = routes[activity.entityType]
      if (route) {
        router.push(route)
      }
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2 mt-2"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
      {activities.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No recent activity</p>
      ) : (
        <div className="space-y-4">
          {activities.map((activity) => (
            <div
              key={activity._id}
              onClick={() => handleActivityClick(activity)}
              className={`p-3 rounded-lg border ${
                activity.entityId
                  ? 'cursor-pointer hover:bg-purple-50 dark:hover:bg-gray-700 transition-colors'
                  : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{getActivityIcon(activity.type)}</span>
                <div className="flex-1">
                  <p className="font-medium">{activity.title}</p>
                  {activity.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {activity.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(activity.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}







