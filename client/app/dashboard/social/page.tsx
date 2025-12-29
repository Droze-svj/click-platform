'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import axios from 'axios'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'
import { useOAuth } from '../../../hooks/useOAuth'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { extractApiData, extractApiError } from '../../../utils/apiResponse'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { CheckCircle, XCircle, Clock, TrendingUp, Link2 } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface ConnectedAccount {
  platform: string
  connectedAt: string
  metadata?: {
    username?: string
    profilePicture?: string
  }
}

interface OptimalTime {
  hour: number
  time: string
  engagement: number
}

export default function SocialMediaPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const searchParams = useSearchParams()
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const oauth = useOAuth(token)
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)
  const [optimalTimes, setOptimalTimes] = useState<OptimalTime[]>([])
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null)
  const [statuses, setStatuses] = useState<Record<string, any>>({})

  // Handle OAuth callback from URL
  useEffect(() => {
    const platform = searchParams?.get('platform')
    const code = searchParams?.get('code')
    const state = searchParams?.get('state')
    const error = searchParams?.get('error')
    const success = searchParams?.get('success')

    if (error) {
      showToast(`OAuth error: ${error}`, 'error')
      return
    }

    if (platform && code && state && token) {
      handleOAuthCallback(platform, code, state)
    } else if (success && platform) {
      showToast(`${platform} connected successfully!`, 'success')
      loadAccounts()
    }
  }, [searchParams, token])

  useEffect(() => {
    if (user && token) {
      loadAccounts()
      loadAllStatuses()
    }
  }, [user, token])

  const loadAccounts = async () => {
    setLoading(true)
    try {
      const response = await axios.get(`${API_URL}/social/accounts`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const accountsData = extractApiData<ConnectedAccount[]>(response)
      setAccounts(Array.isArray(accountsData) ? accountsData : [])
    } catch (error) {
      const errorMessage = extractApiError(error)
      showToast(errorMessage || 'Failed to load connected accounts', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadAllStatuses = async () => {
    if (!token) return

    const platforms = ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok']
    const statusPromises = platforms.map(async (platform) => {
      try {
        const status = await oauth.getStatus(platform)
        return { platform, status }
      } catch (error) {
        return { platform, status: { connected: false, configured: false } }
      }
    })

    const results = await Promise.all(statusPromises)
    const statusMap: Record<string, any> = {}
    results.forEach(({ platform, status }) => {
      statusMap[platform] = status
    })
    setStatuses(statusMap)
  }

  const handleOAuthCallback = async (platform: string, code: string, state: string) => {
    try {
      await oauth.handleCallback(platform, code, state)
      showToast(`${platform} connected successfully!`, 'success')
      loadAccounts()
      loadAllStatuses()
      // Clean URL
      window.history.replaceState({}, '', '/dashboard/social')
    } catch (error: any) {
      showToast(error.message || 'Failed to complete connection', 'error')
    }
  }

  const loadOptimalTimes = async (platform: string) => {
    try {
      const response = await axios.get(`${API_URL}/social/optimal-times?platform=${platform}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const optimalTimesData = extractApiData<OptimalTime[]>(response)
      setOptimalTimes(Array.isArray(optimalTimesData) ? optimalTimesData : [])
    } catch (error) {
      const errorMessage = extractApiError(error)
      showToast(errorMessage || 'Failed to load optimal times', 'error')
    }
  }

  const handleConnect = async (platform: string) => {
    setConnectingPlatform(platform)
    setShowConnectModal(false)
    
    try {
      // Check if platform is configured
      const status = statuses[platform]
      if (status && !status.configured) {
        showToast(`${platform} OAuth is not configured. Please contact support.`, 'error')
        return
      }

      // Initiate OAuth flow (will redirect)
      await oauth.connect(platform)
    } catch (error: any) {
      showToast(error.message || 'Failed to initiate connection', 'error')
      setConnectingPlatform(null)
    }
  }

  const handleDisconnect = async (platform: string) => {
    if (!confirm(`Disconnect ${platform}?`)) return

    try {
      await oauth.disconnect(platform)
      showToast(`${platform} disconnected successfully`, 'success')
      loadAccounts()
      loadAllStatuses()
      if (selectedPlatform === platform) {
        setSelectedPlatform(null)
        setOptimalTimes([])
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to disconnect', 'error')
    }
  }

  const handlePlatformSelect = (platform: string) => {
    setSelectedPlatform(platform)
    loadOptimalTimes(platform)
  }

  const platforms = [
    { id: 'twitter', name: 'Twitter/X', icon: '🐦', color: 'bg-blue-500' },
    { id: 'linkedin', name: 'LinkedIn', icon: '💼', color: 'bg-blue-600' },
    { id: 'facebook', name: 'Facebook', icon: '📘', color: 'bg-blue-700' },
    { id: 'instagram', name: 'Instagram', icon: '📷', color: 'bg-pink-500' },
    { id: 'youtube', name: 'YouTube', icon: '📺', color: 'bg-red-600' },
    { id: 'tiktok', name: 'TikTok', icon: '🎵', color: 'bg-black' }
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading social accounts..." />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Social Media Integration</h1>
          <button
            onClick={() => setShowConnectModal(true)}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            + Connect Account
          </button>
        </div>

        {/* Connected Accounts */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {platforms.map((platform) => {
            const account = accounts.find(a => a.platform === platform.id)
            const status = statuses[platform.id]
            const isConnected = status?.connected || account
            const isConfigured = status?.configured !== false
            
            return (
              <div
                key={platform.id}
                className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-2 ${
                  isConnected ? 'border-green-500' : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 ${platform.color} rounded-full flex items-center justify-center text-2xl`}>
                      {platform.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{platform.name}</h3>
                      {isConnected && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {status?.platformUsername || account?.metadata?.username || 'Connected'}
                        </p>
                      )}
                      {!isConfigured && (
                        <p className="text-xs text-yellow-600 dark:text-yellow-400">
                          Not configured
                        </p>
                      )}
                    </div>
                  </div>
                  {isConnected ? (
                    <CheckCircle className="text-green-500" size={24} />
                  ) : (
                    <XCircle className="text-gray-400" size={24} />
                  )}
                </div>

                {isConnected ? (
                  <div className="space-y-2">
                    <button
                      onClick={() => handlePlatformSelect(platform.id)}
                      className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm transition-colors"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => handleDisconnect(platform.id)}
                      className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm transition-colors"
                      disabled={oauth.loading}
                    >
                      {oauth.loading ? 'Disconnecting...' : 'Disconnect'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleConnect(platform.id)}
                    className="w-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!isConfigured || oauth.loading}
                  >
                    {oauth.loading ? 'Connecting...' : isConfigured ? 'Connect' : 'Not Available'}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Optimal Posting Times */}
        {selectedPlatform && optimalTimes.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="text-purple-600" size={24} />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Optimal Posting Times - {selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1)}
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {optimalTimes.map((time, index) => (
                <div
                  key={index}
                  className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="text-purple-600" size={20} />
                    <span className="font-semibold text-gray-900 dark:text-white">{time.time}</span>
                  </div>
                  {time.engagement > 0 && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Avg Engagement: {Math.round(time.engagement)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Connect Modal */}
        {showConnectModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Connect {connectingPlatform ? connectingPlatform.charAt(0).toUpperCase() + connectingPlatform.slice(1) : 'Account'}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Click the button below to authorize Click to access your {connectingPlatform} account.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowConnectModal(false)
                    setConnectingPlatform(null)
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() => connectingPlatform && handleConnect(connectingPlatform)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Authorize
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}
