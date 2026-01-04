'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface Achievement {
  _id: string
  achievementType: string
  unlockedAt: string
}

export function useEngagement() {
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [newAchievement, setNewAchievement] = useState<Achievement | null>(null)

  useEffect(() => {
    // Listen for new achievements via polling or socket
    const checkForNewAchievements = async () => {
      try {
        const token = localStorage.getItem('token')
        const response = await axios.get(`${API_URL}/engagement/achievements`, {
        })
        if (response.data.success) {
          const latest = response.data.data[0]
          if (latest && achievements.length > 0) {
            const isNew = !achievements.find(a => a._id === latest._id)
            if (isNew) {
              setNewAchievement(latest)
            }
          }
          setAchievements(response.data.data)
        }
      } catch (error) {
        console.error('Failed to check achievements', error)
      }
    }

    const interval = setInterval(checkForNewAchievements, 10000) // Check every 10 seconds
    checkForNewAchievements() // Initial check

    return () => clearInterval(interval)
  }, [achievements.length])

  const dismissAchievement = () => {
    setNewAchievement(null)
  }

  return {
    achievements,
    newAchievement,
    dismissAchievement
  }
}







