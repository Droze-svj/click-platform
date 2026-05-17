// OAuth Hook for Social Media Platforms

import { useState, useCallback } from 'react'
import { apiGet, apiPost, apiDelete } from '../lib/api'

interface OAuthStatus {
  connected: boolean
  connectedAt?: string
  configured?: boolean
  [key: string]: any
}

/**
 * Every callback returned from this hook is wrapped in useCallback so its
 * identity is stable across renders. This matters because consumers
 * typically thread these into useEffect dep arrays — fresh-each-render
 * functions there cause "Maximum update depth exceeded" loops (the bug
 * the social dashboard hit in dev). Keep new helpers wrapped the same way.
 */
export function useOAuth() {
  const [loading, setLoading] = useState(false)

  const getAuthUrl = useCallback(async (platform: string): Promise<{ auth_url: string; state: string }> => {
    return await apiGet<{ auth_url: string; state: string }>(`/oauth/${platform}/connect`)
  }, [])

  const completeConnection = useCallback(async (platform: string, code: string, state: string): Promise<void> => {
    await apiPost(`/oauth/${platform}/callback`, { code, state })
  }, [])

  const getStatus = useCallback(async (platform: string): Promise<OAuthStatus> => {
    const response = await apiGet<{ configured: Record<string, boolean> }>(`/oauth/status`)
    return {
      connected: false, // This hook doesn't currently fetch per-user connection status here
      configured: response.configured[platform],
    }
  }, [])

  /**
   * Disconnect a platform. Pass `accountId` to drop one specific
   * connected account; omit it to disconnect every account on this
   * platform. The backend forwards the id to the platform service so
   * remaining accounts stay live.
   */
  const disconnect = useCallback(async (platform: string, accountId?: string | null): Promise<void> => {
    // axios DELETE puts the body under `config.data`, not as the 2nd arg.
    await apiDelete(`/oauth/${platform}/disconnect`, accountId ? { data: { accountId } } : undefined)
  }, [])

  /**
   * Initiate OAuth flow — redirects the browser to the platform's
   * consent screen. The server response shape is one of:
   *   - { success, auth_url, state }      ← unified per-platform route
   *   - { success, data: { url, state } } ← legacy nested-data shape
   *   - { url, state }                    ← raw passthrough from some services
   * Accept any of them so the flow doesn't silently fail when a
   * platform's route was authored against a different convention.
   */
  const connect = useCallback(async (platform: string): Promise<void> => {
    setLoading(true)
    try {
      const response: any = await getAuthUrl(platform)
      const url = response?.auth_url || response?.url || response?.data?.url || response?.data?.auth_url
      if (!url) {
        setLoading(false)
        throw new Error(`No auth URL returned for ${platform}`)
      }
      window.location.href = url
    } catch (error: any) {
      setLoading(false)
      throw error
    }
  }, [getAuthUrl])

  const handleCallback = useCallback(async (platform: string, code: string, state: string): Promise<void> => {
    setLoading(true)
    try {
      await completeConnection(platform, code, state)
      setLoading(false)
    } catch (error: any) {
      setLoading(false)
      throw error
    }
  }, [completeConnection])

  const getConnections = useCallback(async (): Promise<Record<string, any>> => {
    const response = await apiGet<{ accounts: Record<string, any> }>(`/oauth/connections`)
    return response.accounts
  }, [])

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
