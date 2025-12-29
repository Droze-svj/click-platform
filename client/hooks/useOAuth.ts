// OAuth Hook for Social Media Platforms

import { useState } from 'react'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface OAuthStatus {
  connected: boolean
  connectedAt?: string
  configured?: boolean
  [key: string]: any
}

export function useOAuth(token: string | null) {
  const [loading, setLoading] = useState(false)

  /**
   * Get OAuth authorization URL for a platform
   */
  const getAuthUrl = async (platform: string): Promise<{ url: string; state: string }> => {
    if (!token) throw new Error('Authentication required')

    const response = await axios.get(`${API_URL}/oauth/${platform}/authorize`, {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (response.data.success) {
      return response.data.data
    }
    throw new Error(response.data.error || 'Failed to get authorization URL')
  }

  /**
   * Complete OAuth connection (after callback)
   */
  const completeConnection = async (platform: string, code: string, state: string): Promise<void> => {
    if (!token) throw new Error('Authentication required')

    const response = await axios.post(
      `${API_URL}/oauth/${platform}/complete`,
      { code, state },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    )

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to complete connection')
    }
  }

  /**
   * Get connection status for a platform
   */
  const getStatus = async (platform: string): Promise<OAuthStatus> => {
    if (!token) throw new Error('Authentication required')

    const response = await axios.get(`${API_URL}/oauth/${platform}/status`, {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (response.data.success) {
      return response.data.data
    }
    throw new Error(response.data.error || 'Failed to get status')
  }

  /**
   * Disconnect a platform
   */
  const disconnect = async (platform: string): Promise<void> => {
    if (!token) throw new Error('Authentication required')

    const response = await axios.delete(`${API_URL}/oauth/${platform}/disconnect`, {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to disconnect')
    }
  }

  /**
   * Initiate OAuth flow - redirects to platform
   */
  const connect = async (platform: string): Promise<void> => {
    setLoading(true)
    try {
      const { url } = await getAuthUrl(platform)
      // Redirect to OAuth provider
      window.location.href = url
    } catch (error: any) {
      setLoading(false)
      throw error
    }
  }

  /**
   * Handle OAuth callback from URL params
   */
  const handleCallback = async (platform: string, code: string, state: string): Promise<void> => {
    setLoading(true)
    try {
      await completeConnection(platform, code, state)
      setLoading(false)
    } catch (error: any) {
      setLoading(false)
      throw error
    }
  }

  return {
    loading,
    connect,
    disconnect,
    getStatus,
    handleCallback,
    getAuthUrl,
  }
}



