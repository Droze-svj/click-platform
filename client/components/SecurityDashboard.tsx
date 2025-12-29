'use client'

import { useState, useEffect } from 'react'
import { Shield, AlertTriangle, CheckCircle2, XCircle, BarChart3 } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'

interface SecurityStats {
  totalEvents: number
  criticalEvents: number
  failedLogins: number
  suspiciousActivities: number
  period: number
}

interface SecurityEvent {
  eventType: string
  severity: string
  ipAddress: string
  createdAt: string
  details?: any
}

export default function SecurityDashboard() {
  const [stats, setStats] = useState<SecurityStats | null>(null)
  const [events, setEvents] = useState<SecurityEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    loadStats()
    loadEvents()
  }, [])

  const loadStats = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/security/stats?period=30', {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        setStats(data.data)
      }
    } catch (error) {
      console.error('Failed to load security stats:', error)
    }
  }

  const loadEvents = async () => {
    setIsLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/security/events?limit=20', {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        setEvents(data.data.events || [])
      }
    } catch (error) {
      console.error('Failed to load security events:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
      case 'high':
        return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20'
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50'
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Events</p>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalEvents}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Critical</p>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.criticalEvents}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Failed Logins</p>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.failedLogins}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Suspicious</p>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.suspiciousActivities}</p>
          </div>
        </div>
      )}

      {/* Recent Events */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-4">
          Recent Security Events
        </h3>
        {isLoading ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-600 dark:text-gray-400">Loading events...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400">No security events</p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((event, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${getSeverityColor(event.severity)}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {event.eventType.replace(/_/g, ' ').toUpperCase()}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {event.ipAddress} • {new Date(event.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${getSeverityColor(event.severity)}`}>
                    {event.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}






