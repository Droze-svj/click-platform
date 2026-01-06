'use client'

import { useState, useEffect } from 'react'
import { apiGet } from '../lib/api'
import LoadingSpinner from './LoadingSpinner'
import ErrorAlert from './ErrorAlert'

interface DashboardStats {
  postsCount: number
  followersCount: number
  engagementRate: number
  subscriptionStatus: string
  trialDaysLeft: number
}

interface QuickAction {
  id: string
  title: string
  description: string
  icon: string
  action: string
}

interface Notification {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  timestamp: string
}

interface DashboardOverview {
  user: {
    id: string
    name: string
    email: string
    subscription: any
    emailVerified: boolean
  }
  quickActions: QuickAction[]
  notifications: Notification[]
}

export default function DashboardOverview() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load stats and overview in parallel
      const [statsResponse, overviewResponse] = await Promise.all([
        apiGet('/dashboard/stats'),
        apiGet('/dashboard/overview')
      ])

      setStats(statsResponse.stats)
      setOverview(overviewResponse.overview)
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err)
      setError(err.message || 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
        <span className="ml-2 text-gray-600">Loading dashboard...</span>
      </div>
    )
  }

  if (error) {
    return (
      <ErrorAlert
        message={error}
        onClose={() => setError(null)}
      />
    )
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      {overview?.user && (
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white">
          <h1 className="text-2xl font-bold mb-2">
            Welcome back, {overview.user.name}! 👋
          </h1>
          <p className="opacity-90">
            {overview.user.emailVerified
              ? "Your account is verified and ready to go!"
              : "Please verify your email to unlock all features."
            }
          </p>
          <div className="mt-4 flex items-center space-x-4 text-sm">
            <span className={`px-2 py-1 rounded ${overview.user.subscription?.status === 'trial' ? 'bg-yellow-500' : 'bg-green-500'}`}>
              {overview.user.subscription?.status === 'trial' ? 'Trial' : 'Active'} Plan
            </span>
            {overview.user.emailVerified && (
              <span className="px-2 py-1 rounded bg-green-500">
                ✓ Email Verified
              </span>
            )}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <span className="text-2xl">📝</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Posts</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.postsCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <span className="text-2xl">👥</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Followers</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.followersCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <span className="text-2xl">📈</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Engagement</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.engagementRate}%</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                <span className="text-2xl">⏰</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Trial Days</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.trialDaysLeft}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {overview?.quickActions && overview.quickActions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {overview.quickActions.map((action) => (
              <button
                key={action.id}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
              >
                <div className="flex items-center mb-2">
                  <span className="text-2xl mr-3">{action.icon}</span>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{action.title}</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{action.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recent Notifications */}
      {overview?.notifications && overview.notifications.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Recent Activity</h2>
          <div className="space-y-3">
            {overview.notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 rounded-lg border-l-4 ${
                  notification.type === 'info' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' :
                  notification.type === 'success' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' :
                  'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                }`}
              >
                <div className="flex items-start">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white">{notification.title}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{notification.message}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                      {new Date(notification.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full ml-2 mt-2"></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
