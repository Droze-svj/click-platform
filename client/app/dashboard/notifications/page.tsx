'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import Navbar from '../../../components/Navbar'
import LoadingSkeleton from '../../../components/LoadingSkeleton'
import LoadingSpinner from '../../../components/LoadingSpinner'
import EmptyState from '../../../components/EmptyState'
import ToastContainer from '../../../components/ToastContainer'
import NotificationPreferences from '../../../components/NotificationPreferences'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { extractApiData, extractApiError } from '../../../utils/apiResponse'
import { useToast } from '../../../contexts/ToastContext'
import { Search, Settings, CheckCircle2, Trash2 } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'

interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  read: boolean
  createdAt: Date
  actionUrl?: string
}

export default function NotificationsPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showPreferences, setShowPreferences] = useState(false)
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadNotifications()
  }, [filter])

  const loadNotifications = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      const response = await axios.get(`${API_URL}/notifications?filter=${filter}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      const notificationsData = extractApiData<Notification[]>(response)
      setNotifications(Array.isArray(notificationsData) ? notificationsData : [])
    } catch (error: any) {
      console.error('Failed to load notifications:', error)
      if (error.response?.status === 401) {
        router.push('/login')
      }
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (id: string) => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      await axios.put(`${API_URL}/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })

      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
      showToast('Notification marked as read', 'success')
    } catch (error) {
      console.error('Failed to mark as read:', error)
      showToast('Failed to mark notification as read', 'error')
    }
  }

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      await axios.put(`${API_URL}/notifications/read-all`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })

      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      showToast('All notifications marked as read', 'success')
    } catch (error) {
      console.error('Failed to mark all as read:', error)
      showToast('Failed to mark all notifications as read', 'error')
    }
  }

  const deleteNotification = async (id: string) => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      await axios.delete(`${API_URL}/notifications/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      setNotifications(prev => prev.filter(n => n.id !== id))
      showToast('Notification deleted', 'success')
    } catch (error) {
      const errorMessage = extractApiError(error) || 'Failed to delete notification'
      showToast(errorMessage, 'error')
    }
  }

  const handleBulkDelete = async () => {
    if (selectedNotifications.size === 0) return

    try {
      const token = localStorage.getItem('token')
      if (!token) return

      await axios.post(
        `${API_URL}/notifications/bulk-delete`,
        { ids: Array.from(selectedNotifications) },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      setNotifications(prev => prev.filter(n => !selectedNotifications.has(n.id)))
      setSelectedNotifications(new Set())
      showToast(`Deleted ${selectedNotifications.size} notifications`, 'success')
    } catch (error) {
      const errorMessage = extractApiError(error) || 'Failed to delete notifications'
      showToast(errorMessage, 'error')
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success': return '✅'
      case 'warning': return '⚠️'
      case 'error': return '❌'
      default: return 'ℹ️'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success': return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
      case 'warning': return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
      case 'error': return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
      default: return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
    }
  }

  const filteredNotifications = notifications.filter(n => {
    // Filter by read status
    let matchesFilter = true
    if (filter === 'unread') matchesFilter = !n.read
    if (filter === 'read') matchesFilter = n.read

    // Filter by search query
    const matchesSearch = searchQuery === '' || 
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.message.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesFilter && matchesSearch
  })

  const toggleSelect = (id: string) => {
    setSelectedNotifications(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const selectAll = () => {
    setSelectedNotifications(new Set(filteredNotifications.map(n => n.id)))
  }

  const deselectAll = () => {
    setSelectedNotifications(new Set())
  }

  const bulkMarkAsRead = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      await Promise.all(
        Array.from(selectedNotifications).map(id =>
          axios.put(`${API_URL}/notifications/${id}/read`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          })
        )
      )

      const count = selectedNotifications.size
      setNotifications(prev => prev.map(n => 
        selectedNotifications.has(n.id) ? { ...n, read: true } : n
      ))
      setSelectedNotifications(new Set())
      showToast(`Marked ${count} notification${count !== 1 ? 's' : ''} as read`, 'success')
    } catch (error) {
      const errorMessage = extractApiError(error) || 'Failed to mark notifications as read'
      showToast(errorMessage, 'error')
    }
  }

  const bulkDelete = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      await Promise.all(
        Array.from(selectedNotifications).map(id =>
          axios.delete(`${API_URL}/notifications/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        )
      )

      const count = selectedNotifications.size
      setNotifications(prev => prev.filter(n => !selectedNotifications.has(n.id)))
      setSelectedNotifications(new Set())
      showToast(`Deleted ${count} notification${count !== 1 ? 's' : ''}`, 'success')
    } catch (error) {
      const errorMessage = extractApiError(error) || 'Failed to delete notifications'
      showToast(errorMessage, 'error')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <LoadingSkeleton type="card" count={5} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
      <ToastContainer />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Notifications</h1>
            <p className="text-gray-600 dark:text-gray-400">Stay updated with your activity</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={markAllAsRead}
              className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
              Mark All Read
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => setShowPreferences(!showPreferences)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Preferences
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {(['all', 'unread', 'read'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg transition ${
                    filter === f
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {selectedNotifications.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedNotifications.size} selected
                </span>
                <button
                  onClick={bulkMarkAsRead}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-1"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Mark Read
                </button>
                <button
                  onClick={bulkDelete}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-1"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
                <button
                  onClick={deselectAll}
                  className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Notification Preferences */}
        {showPreferences && (
          <div className="mb-6">
            <NotificationPreferences onUpdate={loadNotifications} />
          </div>
        )}

        {/* Notifications List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          {filteredNotifications.length === 0 ? (
            <EmptyState
              title="No notifications"
              description={filter === 'unread' ? "You're all caught up! No unread notifications." : filter === 'read' ? "No read notifications" : "You don't have any notifications yet"}
              icon="🔔"
            />
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredNotifications.length > 0 && selectedNotifications.size === 0 && (
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <button
                    onClick={selectAll}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Select All ({filteredNotifications.length})
                  </button>
                </div>
              )}
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition ${
                    !notification.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  } ${selectedNotifications.has(notification.id) ? 'bg-blue-100 dark:bg-blue-900/30' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={selectedNotifications.has(notification.id)}
                      onChange={() => toggleSelect(notification.id)}
                      className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${getTypeColor(notification.type)}`}>
                      {getTypeIcon(notification.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold mb-1">{notification.title}</h3>
                          <p className="text-gray-600 dark:text-gray-400">{notification.message}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                            {new Date(notification.createdAt).toLocaleString()}
                          </p>
                        </div>
                        {!notification.read && (
                          <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                        )}
                      </div>
                      {notification.actionUrl && (
                        <a
                          href={notification.actionUrl}
                          className="mt-3 inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          View →
                        </a>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {!notification.read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition"
                        >
                          Mark Read
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
      </div>
    )
  }

