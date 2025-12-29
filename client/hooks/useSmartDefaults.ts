'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface UserPreferences {
  commonActions: Record<string, number>
  commonConfigs: Record<string, any>
  preferredPlatforms: string[]
  preferredEffects: string[]
  preferredMusicGenres: string[]
}

/**
 * Hook to get smart defaults based on user history
 */
export function useSmartDefaults() {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPreferences()
  }, [])

  const loadPreferences = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/workflows/preferences`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.data.success) {
        setPreferences(response.data.data)
      }
    } catch (error) {
      console.error('Failed to load preferences', error)
    } finally {
      setLoading(false)
    }
  }

  const getDefaultPlatforms = () => {
    return preferences?.preferredPlatforms || ['twitter', 'linkedin']
  }

  const getDefaultEffects = () => {
    return preferences?.preferredEffects || []
  }

  const getDefaultMusicGenre = () => {
    return preferences?.preferredMusicGenres[0] || 'energetic'
  }

  const trackAction = async (action: string, metadata: any = {}) => {
    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${API_URL}/workflows/track`,
        {
          action,
          metadata: {
            ...metadata,
            page: window.location.pathname,
            sessionId: sessionStorage.getItem('sessionId') || Date.now().toString()
          }
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )
    } catch (error) {
      console.error('Failed to track action', error)
    }
  }

  return {
    preferences,
    loading,
    getDefaultPlatforms,
    getDefaultEffects,
    getDefaultMusicGenre,
    trackAction,
    refresh: loadPreferences
  }
}







