// OAuth Hook for Social Media Platforms

import { useState } from 'react'
import { apiGet, apiPost, apiDelete } from '../lib/api'

interface OAuthStatus {
  connected: boolean
  connectedAt?: string
  configured?: boolean
  [key: string]: any
}

export function useOAuth() {
  const [loading, setLoading] = useState(false)

  /**
   * Get OAuth authorization URL for a platform
   */
  const getAuthUrl = async (platform: string): Promise<{ auth_url: string; state: string }> => {
    return await apiGet<{ auth_url: string; state: string }>(`/oauth/${platform}/connect`)
  }

  /**
   * Complete OAuth connection (after callback)
   * Note: The callback is usually handled by the backend redirecting back to the frontend.
   * This function can be used if the frontend needs to manually signal completion.
   */
  const completeConnection = async (platform: string, code: string, state: string): Promise<void> => {
    await apiPost(`/oauth/${platform}/callback`, { code, state })
  }

  /**
   * Get connection status for a platform
   */
  const getStatus = async (platform: string): Promise<OAuthStatus> => {
    const response = await apiGet<{ configured: Record<string, boolean> }>(`/oauth/status`)
    return {
      connected: false, // This hook doesn't currently fetch per-user connection status here
      configured: response.configured[platform]
    }
  }

  /**
   * Disconnect a platform
   */
  const disconnect = async (platform: string): Promise<void> => {
    await apiDelete(`/oauth/${platform}/disconnect`)
  }

  /**
   * Initiate OAuth flow - redirects to platform
   */
  const connect = async (platform: string): Promise<void> => {
    setLoading(true)
    try {
      const response = await getAuthUrl(platform)
      // Redirect to OAuth provider
      window.location.href = response.auth_url
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

  /**
   * Get all connected accounts for the user
   */
  const getConnections = async (): Promise<Record<string, any>> => {
    const response = await apiGet<{ accounts: Record<string, any> }>(`/oauth/connections`)
    return response.accounts
  }

  return {
    loading,
    connect,
    disconnect,
    getStatus,
    getConnections,
    handleCallback,
    getAuthUrl,
  }
}



