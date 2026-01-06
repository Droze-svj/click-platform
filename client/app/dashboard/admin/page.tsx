'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'
import LoadingSpinner from '../../../components/LoadingSpinner'
import ErrorAlert from '../../../components/ErrorAlert'
import {
  Users,
  FileText,
  TrendingUp,
  Shield,
  BarChart3,
  UserCheck,
  UserX,
  Eye,
  Heart,
  Activity
} from 'lucide-react'

interface AdminOverview {
  users: {
    total: number
    verified: number
    unverified: number
  }
  posts: {
    total: number
    published: number
    drafts: number
  }
  social: {
    connected_accounts: number
  }
}

interface RecentUser {
  id: string
  email: string
  first_name: string
  last_name: string
  created_at: string
}

interface RecentPost {
  id: string
  title: string
  status: string
  author_id: string
  created_at: string
  users: {
    email: string
  }
}

interface SystemHealth {
  database: string
  api: string
  uptime: number
  memory: any
}

interface DashboardData {
  overview: AdminOverview
  recent_activity: {
    users: RecentUser[]
    posts: RecentPost[]
  }
  system_health: SystemHealth
}

export default function AdminPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await apiGet<DashboardData>('/admin/dashboard')
      setData(response)
    } catch (err: any) {
      console.error('Failed to load admin dashboard:', err)
      setError(err.message || 'Failed to load admin dashboard')
    } finally {
      setLoading(false)
    }
  }

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  const formatMemory = (bytes: number) => {
    return `${Math.round(bytes / 1024 / 1024)}MB`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading admin dashboard...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400">System overview and management</p>
          </div>
        </div>
        <ErrorAlert message={error} onRetry={loadDashboard} />
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">System overview and management</p>
        </div>
        <button
          onClick={loadDashboard}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
        >
          <BarChart3 className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.overview.users.total}</p>
              <div className="flex items-center gap-4 mt-2 text-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <UserCheck className="w-3 h-3" />
                  {data.overview.users.verified}
                </span>
                <span className="flex items-center gap-1 text-red-600">
                  <UserX className="w-3 h-3" />
                  {data.overview.users.unverified}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <FileText className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Posts</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.overview.posts.total}</p>
              <div className="flex items-center gap-4 mt-2 text-sm">
                <span className="text-green-600">
                  {data.overview.posts.published} published
                </span>
                <span className="text-gray-600">
                  {data.overview.posts.drafts} drafts
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Connected Accounts</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.overview.social.connected_accounts}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Social media integrations</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
              <Activity className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">System Health</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {data.system_health.database === 'healthy' ? 'Good' : 'Issues'}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Uptime: {formatUptime(data.system_health.uptime)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h2>

          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">New Users</h3>
              <div className="space-y-2">
                {data.recent_activity.users.slice(0, 3).map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {user.first_name} {user.last_name}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{user.email}</p>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Recent Posts</h3>
              <div className="space-y-2">
                {data.recent_activity.posts.slice(0, 3).map((post) => (
                  <div key={post.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white truncate max-w-xs">
                        {post.title || 'Untitled Post'}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{post.users.email}</p>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 text-xs rounded ${
                        post.status === 'published'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {post.status}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(post.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* System Health */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">System Health</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded">
              <span className="font-medium">Database</span>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  data.system_health.database === 'healthy' ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                <span className="text-sm capitalize">{data.system_health.database}</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded">
              <span className="font-medium">API</span>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  data.system_health.api === 'healthy' ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                <span className="text-sm capitalize">{data.system_health.api}</span>
              </div>
            </div>

            <div className="p-3 border border-gray-200 dark:border-gray-700 rounded">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Memory Usage</span>
                <span className="text-sm text-gray-600">
                  {formatMemory(data.system_health.memory.heapUsed)} / {formatMemory(data.system_health.memory.heapTotal)}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{
                    width: `${(data.system_health.memory.heapUsed / data.system_health.memory.heapTotal) * 100}%`
                  }}
                ></div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded">
              <span className="font-medium">Uptime</span>
              <span className="text-sm">{formatUptime(data.system_health.uptime)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => router.push('/dashboard/admin/users')}
            className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
          >
            <Users className="w-8 h-8 text-blue-600 dark:text-blue-400 mb-2" />
            <h3 className="font-medium text-gray-900 dark:text-white">Manage Users</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">View and manage user accounts</p>
          </button>

          <button
            onClick={() => router.push('/dashboard/admin/posts')}
            className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
          >
            <FileText className="w-8 h-8 text-green-600 dark:text-green-400 mb-2" />
            <h3 className="font-medium text-gray-900 dark:text-white">Moderate Content</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Review and moderate posts</p>
          </button>

          <button
            onClick={() => router.push('/dashboard/admin/analytics')}
            className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
          >
            <BarChart3 className="w-8 h-8 text-purple-600 dark:text-purple-400 mb-2" />
            <h3 className="font-medium text-gray-900 dark:text-white">System Analytics</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">View system-wide analytics</p>
          </button>
        </div>
      </div>
    </div>
  )
}
