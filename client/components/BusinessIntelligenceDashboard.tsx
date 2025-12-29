'use client'

import { useState, useEffect } from 'react'
import { BarChart3, TrendingUp, Users, Calendar, Download } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'

interface BusinessMetrics {
  period: number
  content: {
    total: { count: number; growth: number }
    byType: Array<{ type: string; count: number }>
    byStatus: Array<{ status: string; count: number }>
  }
  scheduling: {
    total: number
    upcoming: number
    byPlatform: Array<{ platform: string; count: number }>
  }
  users: {
    active: number
    total: number
    activePercentage: number
  }
}

export default function BusinessIntelligenceDashboard() {
  const [metrics, setMetrics] = useState<BusinessMetrics | null>(null)
  const [trends, setTrends] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [period, setPeriod] = useState(30)
  const { showToast } = useToast()

  useEffect(() => {
    loadMetrics()
    loadTrends()
  }, [period])

  const loadMetrics = async () => {
    setIsLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/analytics/bi/metrics?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        setMetrics(data.data)
      }
    } catch (error) {
      console.error('Failed to load metrics:', error)
      showToast('Failed to load metrics', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const loadTrends = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/analytics/bi/trends?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        setTrends(data.data)
      }
    } catch (error) {
      console.error('Failed to load trends:', error)
    }
  }

  const exportData = async (format: 'json' | 'csv') => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/analytics/bi/export?format=${format}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      })

      if (response.ok) {
        if (format === 'csv') {
          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `bi-export-${new Date().toISOString()}.csv`
          a.click()
          window.URL.revokeObjectURL(url)
        } else {
          const data = await response.json()
          const blob = new Blob([JSON.stringify(data.data, null, 2)], {
            type: 'application/json',
          })
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `bi-export-${new Date().toISOString()}.json`
          a.click()
          window.URL.revokeObjectURL(url)
        }
        showToast('Data exported successfully', 'success')
      }
    } catch (error) {
      console.error('Export error:', error)
      showToast('Failed to export data', 'error')
    }
  }

  if (isLoading && !metrics) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  if (!metrics) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Business Intelligence
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Comprehensive analytics and insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
          <button
            onClick={() => exportData('json')}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export JSON
          </button>
          <button
            onClick={() => exportData('csv')}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Content</p>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {metrics.content.total.count}
          </p>
          {metrics.content.total.growth !== 0 && (
            <p className={`text-sm mt-1 ${metrics.content.total.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {metrics.content.total.growth >= 0 ? '+' : ''}
              {metrics.content.total.growth.toFixed(1)}% from previous period
            </p>
          )}
        </div>

        {/* Scheduled Posts */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Scheduled</p>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {metrics.scheduling.total}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {metrics.scheduling.upcoming} upcoming
          </p>
        </div>

        {/* Active Users */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Active Users</p>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {metrics.users.active}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {metrics.users.activePercentage}% of total
          </p>
        </div>

        {/* Growth */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Growth</p>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {metrics.content.total.growth >= 0 ? '+' : ''}
            {metrics.content.total.growth.toFixed(1)}%
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Content growth
          </p>
        </div>
      </div>

      {/* Content Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* By Type */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-4">
            Content by Type
          </h3>
          <div className="space-y-2">
            {metrics.content.byType.map((item) => (
              <div key={item.type} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                  {item.type}
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* By Platform */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-4">
            Scheduled by Platform
          </h3>
          <div className="space-y-2">
            {metrics.scheduling.byPlatform.map((item) => (
              <div key={item.platform} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                  {item.platform}
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}






