'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface Streak {
  currentStreak: number
  longestStreak: number
  lastActivityDate: string | null
}

export default function StreakDisplay() {
  const [streak, setStreak] = useState<Streak | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStreak()
  }, [])

  const loadStreak = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/engagement/streak`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.data.success) {
        setStreak(response.data.data)
      }
    } catch (error) {
      console.error('Failed to load streak', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !streak) {
    return null
  }

  return (
    <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-lg p-4 text-white">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm opacity-90">Current Streak</p>
          <p className="text-3xl font-bold flex items-center gap-2">
            {streak.currentStreak} {streak.currentStreak > 0 ? '🔥' : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm opacity-90">Longest Streak</p>
          <p className="text-2xl font-bold">{streak.longestStreak} ⭐</p>
        </div>
      </div>
      {streak.currentStreak > 0 && (
        <p className="text-xs mt-2 opacity-75">
          Keep it up! Come back tomorrow to continue your streak.
        </p>
      )}
    </div>
  )
}







