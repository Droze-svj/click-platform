'use client'

import { useState, useEffect } from 'react'
import { Clock, Calendar as CalendarIcon, TrendingUp } from 'lucide-react'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface BestTime {
  hour: number
  day: string
  engagement: number
  posts: number
  score: number
}

export default function BestTimeToPostCalendar() {
  const [bestTimes, setBestTimes] = useState<BestTime[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all')

  useEffect(() => {
    loadBestTimes()
  }, [selectedPlatform])

  const loadBestTimes = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      
      const response = await axios.get(
        `${API_URL}/analytics/best-times?platform=${selectedPlatform}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.data.success) {
        setBestTimes(response.data.data.bestTimes || [])
      }
    } catch (error: any) {
      console.error('Best times error:', error)
    } finally {
      setLoading(false)
    }
  }

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const hours = Array.from({ length: 24 }, (_, i) => i)

  // Group by day and hour
  const timeMatrix = days.reduce((acc, day) => {
    acc[day] = hours.map(hour => {
      const time = bestTimes.find(t => t.day === day && t.hour === hour)
      return {
        hour,
        engagement: time?.engagement || 0,
        posts: time?.posts || 0,
        score: time?.score || 0
      }
    })
    return acc
  }, {} as Record<string, Array<{ hour: number; engagement: number; posts: number; score: number }>>)

  const maxScore = Math.max(...bestTimes.map(t => t.score), 1)

  const getColor = (score: number) => {
    if (score === 0) return 'bg-gray-100 dark:bg-gray-800'
    const intensity = (score / maxScore) * 100
    if (intensity < 25) return 'bg-green-200 dark:bg-green-900'
    if (intensity < 50) return 'bg-green-400 dark:bg-green-700'
    if (intensity < 75) return 'bg-green-600 dark:bg-green-500'
    return 'bg-green-800 dark:bg-green-400'
  }

  const topTimes = [...bestTimes]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

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
          <Clock className="w-6 h-6 text-green-600" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            Best Time to Post
          </h3>
        </div>
        <select
          value={selectedPlatform}
          onChange={(e) => setSelectedPlatform(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
        >
          <option value="all">All Platforms</option>
          <option value="twitter">Twitter/X</option>
          <option value="linkedin">LinkedIn</option>
          <option value="facebook">Facebook</option>
          <option value="instagram">Instagram</option>
          <option value="youtube">YouTube</option>
          <option value="tiktok">TikTok</option>
        </select>
      </div>

      {/* Top Times */}
      {topTimes.length > 0 && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <h4 className="font-semibold text-gray-900 dark:text-white">Top 5 Best Times</h4>
          </div>
          <div className="space-y-2">
            {topTimes.map((time, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-300">
                  {time.day} at {time.hour}:00
                </span>
                <span className="font-semibold text-green-600">
                  Score: {time.score.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calendar Grid */}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <div className="grid grid-cols-8 gap-2">
            {/* Header */}
            <div className="font-semibold text-sm text-gray-700 dark:text-gray-300"></div>
            {hours.map((hour) => (
              <div
                key={hour}
                className="text-xs text-gray-600 dark:text-gray-400 text-center"
                title={`${hour}:00`}
              >
                {hour % 6 === 0 ? hour : ''}
              </div>
            ))}

            {/* Days */}
            {days.map((day) => (
              <>
                <div
                  key={`${day}-label`}
                  className="font-medium text-sm text-gray-700 dark:text-gray-300 py-2"
                >
                  {day.substring(0, 3)}
                </div>
                {hours.map((hour) => {
                  const time = timeMatrix[day][hour]
                  return (
                    <div
                      key={`${day}-${hour}`}
                      className={`h-8 rounded ${getColor(time.score)} cursor-pointer hover:ring-2 hover:ring-green-500 transition-all`}
                      title={`${day} ${hour}:00 - Engagement: ${time.engagement}, Posts: ${time.posts}, Score: ${time.score.toFixed(1)}`}
                    />
                  )
                })}
              </>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 flex items-center justify-center gap-4">
        <span className="text-sm text-gray-600 dark:text-gray-400">Less Optimal</span>
        <div className="flex gap-1">
          <div className="w-4 h-4 bg-gray-100 dark:bg-gray-800 rounded"></div>
          <div className="w-4 h-4 bg-green-200 dark:bg-green-900 rounded"></div>
          <div className="w-4 h-4 bg-green-400 dark:bg-green-700 rounded"></div>
          <div className="w-4 h-4 bg-green-600 dark:bg-green-500 rounded"></div>
          <div className="w-4 h-4 bg-green-800 dark:bg-green-400 rounded"></div>
        </div>
        <span className="text-sm text-gray-600 dark:text-gray-400">Most Optimal</span>
      </div>
    </div>
  )
}


