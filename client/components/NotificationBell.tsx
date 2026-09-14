'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'

import { useSocket } from '../hooks/useSocket'
import { useToast } from '../contexts/ToastContext'
import { apiGet, apiPut } from '../lib/api'
import { useTranslation } from '@/hooks/useTranslation'

interface Notification {
  _id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message?: string | null
  link?: string | null
  suggestion?: string | null
  read: boolean
  createdAt: string
}

export default function NotificationBell() {
  const { t } = useTranslation()
  const router = useRouter()
  const { socket } = useSocket()
  const { showToast } = useToast()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [pendingApprovals, setPendingApprovals] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadNotifications()
    loadPendingApprovals()
  }, [])

  const loadPendingApprovals = async () => {
    try {

      const response = await apiGet<any>('/approvals/pending-count')
      if (response?.success) {
        setPendingApprovals(response.data?.count || 0)
      }
    } catch (error) {
      console.error('Failed to load pending approvals', error)
    }
  }

  useEffect(() => {
    if (socket) {
      socket.on('notification', (notification: Notification) => {
        setNotifications(prev => [notification, ...prev])
        setUnreadCount(prev => prev + 1)
        showToast(notification.title, notification.type)
      })

      return () => {
        socket.off('notification')
      }
    }
  }, [socket, showToast])

  const loadNotifications = async () => {
    try {

      const response = await apiGet<any>('/notifications?limit=10')
      if (response?.success) {
        setNotifications(response.data?.notifications || [])
        setUnreadCount(response.data?.unreadCount || 0)
      }
    } catch (error) {
      console.error('Failed to load notifications', error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {

      await apiPut(`/notifications/${notificationId}/read`, {})
      setNotifications(prev =>
        prev.map(n => n._id === notificationId ? { ...n, read: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Failed to mark notification as read', error)
    }
  }

  const markAllAsRead = async () => {
    try {

      await apiPut('/notifications/read-all', {})
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch (error) {
      console.error('Failed to mark all as read', error)
    }
  }

  const totalBadge = unreadCount + pendingApprovals
  const rootRef = useRef<HTMLDivElement | null>(null)

  // A dropdown that only closes by clicking its own trigger is a trap on
  // desktop. Escape and outside-click both dismiss it.
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false) }
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointer)
    }
  }, [isOpen])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={
          totalBadge > 0
            ? `${t('notificationBell.notifications')} (${totalBadge} unread)`
            : t('notificationBell.notifications')
        }
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-theme-muted transition-colors hover:bg-accent hover:text-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Bell size={18} aria-hidden="true" />
        {totalBadge > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[hsl(var(--destructive))] px-1 text-[10px] font-bold leading-none text-white"
          >
            {totalBadge > 9 ? '9+' : totalBadge}
          </span>
        )}
      </button>

      {isOpen && (
        <div role="menu" aria-label={t('notificationBell.notifications')} className="ds-surface-elevated absolute right-0 z-50 mt-2 max-h-96 w-80 overflow-y-auto rounded-xl">
          <div className="flex items-center justify-between border-b border-[var(--glass-border)] p-4">
            <h3 className="ds-text-label text-theme-primary">{t('notificationBell.notifications')}</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="rounded text-sm text-[hsl(var(--primary))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t('notificationBell.markAllAsRead')}
              </button>
            )}
          </div>
          <div className="divide-y divide-[var(--glass-border)]">
            {loading ? (
              <div className="p-4 text-center text-theme-muted">{t('notificationBell.loading')}</div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-theme-muted">{t('notificationBell.noNotifications')}</div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification._id}
                  className={`cursor-pointer p-4 transition-colors hover:bg-accent ${
                    !notification.read ? 'bg-[hsl(var(--primary)/0.08)]' : ''
                  }`}
                  onClick={() => {
                    if (!notification.read) markAsRead(notification._id)
                    if (notification.link) router.push(notification.link)
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${
                      notification.type === 'success' ? 'bg-green-500' :
                      notification.type === 'error' ? 'bg-red-500' :
                      notification.type === 'warning' ? 'bg-yellow-500' :
                      'bg-blue-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-theme-primary">{notification.title}</p>
                      {(notification.message || notification.suggestion) && (
                        <p className="mt-1 text-sm text-theme-secondary">
                          {notification.message}
                          {notification.suggestion && (
                            <span className="font-medium text-[hsl(var(--primary))]">{notification.message ? ' — ' : ''}{notification.suggestion}</span>
                          )}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-theme-muted">
                        {new Date(notification.createdAt).toLocaleString()}
                      </p>
                      {notification.link && (
                        <span className="mt-1 inline-block text-xs text-[hsl(var(--primary))]">{t('notificationBell.view')} →</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

