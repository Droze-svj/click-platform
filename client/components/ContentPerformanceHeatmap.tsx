'use client'

import { useState, useEffect } from 'react'
import { Calendar, TrendingUp } from 'lucide-react'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface HeatmapData {
  date: string
  hour: number
  engagement: number
  posts: number
}

export default function ContentPerformanceHeatmap() {
  const [heatmapData, setHeatmapData] = useState<HeatmapData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d')

  useEffect(() => {
    loadHeatmapData()
  }, [selectedPeriod])

  const loadHeatmapData = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      
      const response = await axios.get(
        `${API_URL}/analytics/heatmap?period=${selectedPeriod}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.data.success) {
        setHeatmapData(response.data.data.heatmap || [])
      }
    } catch (error: any) {
      console.error('Heatmap data error:', error)
    } finally {
      setLoading(false)
    }
  }

  // Group data by day and hour
  const groupedData = heatmapData.reduce((acc, item) => {
    const key = `${item.date}-${item.hour}`
    if (!acc[key]) {
      acc[key] = { engagement: 0, posts: 0 }
    }
    acc[key].engagement += item.engagement
    acc[key].posts += item.posts
    return acc
  }, {} as Record<string, { engagement: number; posts: number }>)

  // Get max engagement for normalization
  const maxEngagement = Math.max(...Object.values(groupedData).map(d => d.engagement), 1)

  // Generate days for the period
  const days = Array.from({ length: selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 90 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 90) + i + 1)
    return date.toISOString().split('T')[0]
  })

  const hours = Array.from({ length: 24 }, (_, i) => i)

  const getIntensity = (date: string, hour: number) => {
    const key = `${date}-${hour}`
    const data = groupedData[key]
    if (!data || data.engagement === 0) return 0
    return Math.min((data.engagement / maxEngagement) * 100, 100)
  }

  const getColor = (intensity: number) => {
    if (intensity === 0) return 'bg-gray-100 dark:bg-gray-800'
    if (intensity < 25) return 'bg-blue-200 dark:bg-blue-900'
    if (intensity < 50) return 'bg-blue-400 dark:bg-blue-700'
    if (intensity < 75) return 'bg-blue-600 dark:bg-blue-500'
    return 'bg-blue-800 dark:bg-blue-400'
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="w-6 h-6 text-blue-600" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            Performance Heatmap
          </h3>
        </div>
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as const).map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedPeriod === period
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {period === '7d' ? '7 Days' : period === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Hour labels */}
          <div className="flex mb-2">
            <div className="w-24"></div>
            <div className="flex-1 grid grid-cols-24 gap-1">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="text-xs text-gray-600 dark:text-gray-400 text-center"
                  title={`${hour}:00`}
                >
                  {hour % 6 === 0 ? hour : ''}
                </div>
              ))}
            </div>
          </div>

          {/* Heatmap grid */}
          <div className="space-y-1">
            {days.slice(-14).map((date) => (
              <div key={date} className="flex items-center gap-2">
                <div className="w-24 text-xs text-gray-600 dark:text-gray-400">
                  {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <div className="flex-1 grid grid-cols-24 gap-1">
                  {hours.map((hour) => {
                    const intensity = getIntensity(date, hour)
                    const data = groupedData[`${date}-${hour}`]
                    return (
                      <div
                        key={`${date}-${hour}`}
                        className={`h-6 rounded ${getColor(intensity)} cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all`}
                        title={`${date} ${hour}:00 - Engagement: ${data?.engagement || 0}, Posts: ${data?.posts || 0}`}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">Less</span>
          <div className="flex gap-1">
            <div className="w-4 h-4 bg-gray-100 dark:bg-gray-800 rounded"></div>
            <div className="w-4 h-4 bg-blue-200 dark:bg-blue-900 rounded"></div>
            <div className="w-4 h-4 bg-blue-400 dark:bg-blue-700 rounded"></div>
            <div className="w-4 h-4 bg-blue-600 dark:bg-blue-500 rounded"></div>
            <div className="w-4 h-4 bg-blue-800 dark:bg-blue-400 rounded"></div>
          </div>
          <span className="text-sm text-gray-600 dark:text-gray-400">More</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <TrendingUp className="w-4 h-4" />
          <span>Hover to see engagement data</span>
        </div>
      </div>
    </div>
  )
}


