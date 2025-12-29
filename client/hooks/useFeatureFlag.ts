'use client'

import { useState, useEffect } from 'react'

interface FeatureFlag {
  name: string
  enabled: boolean
  config?: any
}

export function useFeatureFlag(featureName: string) {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkFeature = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          setEnabled(false)
          setLoading(false)
          return
        }

        const response = await fetch(`/api/feature-flags/${featureName}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          credentials: 'include',
        })

        if (response.ok) {
          const data = await response.json()
          setEnabled(data.data.enabled)
        } else {
          setEnabled(false)
        }
      } catch (err: any) {
        setError(err.message)
        setEnabled(false)
      } finally {
        setLoading(false)
      }
    }

    checkFeature()
  }, [featureName])

  return { enabled, loading, error }
}

export function FeatureFlag({ 
  feature, 
  children, 
  fallback = null 
}: { 
  feature: string
  children: React.ReactNode
  fallback?: React.ReactNode | null
}) {
  const { enabled, loading } = useFeatureFlag(feature)

  if (loading) {
    return null // Or a loading spinner
  }

  return enabled ? (children as React.ReactElement) : (fallback as React.ReactElement)
}






