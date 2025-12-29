'use client'

import { useState, useEffect } from 'react'
import { Activity, CheckCircle2, Clock, XCircle, RefreshCw } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'

interface QueueStats {
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
  total: number
}

interface DashboardStats {
  'video-processing'?: QueueStats
  'content-generation'?: QueueStats
  'email-sending'?: QueueStats
}

export default function JobQueueDashboard() {
  const [stats, setStats] = useState<DashboardStats>({})
  const [isLoading, setIsLoading] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    loadDashboard()
    const interval = setInterval(loadDashboard, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [])

  const loadDashboard = async () => {
    setIsLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/jobs/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        setStats(data.data || {})
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const queues = [
    { name: 'video-processing', label: 'Video Processing', color: 'purple' },
    { name: 'content-generation', label: 'Content Generation', color: 'blue' },
    { name: 'email-sending', label: 'Email Sending', color: 'green' },
  ]

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
            Job Queue Dashboard
          </h3>
        </div>
        <button
          onClick={loadDashboard}
          disabled={isLoading}
          className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {queues.map((queue) => {
          const queueStats = stats[queue.name as keyof DashboardStats] as QueueStats | undefined
          
          if (!queueStats || (queueStats as any).error) {
            return (
              <div
                key={queue.name}
                className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                  {queue.label}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {(queueStats as any)?.error || 'Not available'}
                </p>
              </div>
            )
          }

          return (
            <div
              key={queue.name}
              className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <h4 className="font-medium text-gray-900 dark:text-white mb-4">
                {queue.label}
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Waiting</span>
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {queueStats.waiting}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Active</span>
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {queueStats.active}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Completed</span>
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {queueStats.completed}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Failed</span>
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {queueStats.failed}
                  </span>
                </div>
                <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Total
                    </span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {queueStats.total}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}






