'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiGet, apiDelete } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'
import LoadingSpinner from '../../../components/LoadingSpinner'
import ErrorAlert from '../../../components/ErrorAlert'
import SuccessAlert from '../../../components/SuccessAlert'
import {
  Twitter,
  Linkedin,
  Facebook,
  Instagram,
  Unlink,
  ExternalLink,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

interface PlatformAccount {
  id: string
  platform: string
  platform_user_id: string
  username: string
  display_name: string
  avatar?: string
  is_connected: boolean
  metadata?: any
  created_at: string
}

interface ConnectedAccounts {
  twitter: PlatformAccount | null
  linkedin: PlatformAccount | null
  facebook: PlatformAccount | null
  instagram: PlatformAccount | null
}

export default function SocialPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<ConnectedAccounts | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    loadAccounts()

    // Check for OAuth callback parameters
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    const platform = searchParams.get('platform')
    const description = searchParams.get('description')

    if (success === 'true' && platform) {
      setSuccess(`Successfully connected your ${platform} account!`)
    } else if (error) {
      setError(`Failed to connect ${platform || 'account'}: ${description || error}`)
    }
  }, [])

  const loadAccounts = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await apiGet<{ accounts: ConnectedAccounts }>('/oauth/accounts')
      setAccounts(response.accounts)
    } catch (err: any) {
      console.error('Failed to load accounts:', err)
      setError(err.message || 'Failed to load connected accounts')
    } finally {
      setLoading(false)
    }
  }

  const connectAccount = async (platform: string) => {
    try {
      setConnecting(platform)
      setError(null)

      const response = await apiGet<{ auth_url: string }>(`/oauth/${platform}/connect`)

      // Redirect to OAuth provider
      window.location.href = response.auth_url
    } catch (err: any) {
      console.error(`Failed to connect ${platform}:`, err)
      setError(err.message || `Failed to connect ${platform}`)
      setConnecting(null)
    }
  }

  const disconnectAccount = async (platform: string, platformUserId: string) => {
    if (!confirm(`Are you sure you want to disconnect your ${platform} account?`)) {
      return
    }

    try {
      setDisconnecting(platform)
      setError(null)

      await apiDelete(`/oauth/${platform}/disconnect`, { platform_user_id: platformUserId })

      setSuccess(`Successfully disconnected your ${platform} account`)
      await loadAccounts() // Refresh accounts
    } catch (err: any) {
      console.error(`Failed to disconnect ${platform}:`, err)
      setError(err.message || `Failed to disconnect ${platform}`)
    } finally {
      setDisconnecting(null)
    }
  }

  const getPlatformIcon = (platform: string) => {
    const icons = {
      twitter: Twitter,
      linkedin: Linkedin,
      facebook: Facebook,
      instagram: Instagram
    }
    return icons[platform as keyof typeof icons] || Twitter
  }

  const getPlatformColor = (platform: string) => {
    const colors = {
      twitter: 'bg-blue-500 hover:bg-blue-600',
      linkedin: 'bg-blue-700 hover:bg-blue-800',
      facebook: 'bg-blue-600 hover:bg-blue-700',
      instagram: 'bg-pink-500 hover:bg-pink-600'
    }
    return colors[platform as keyof typeof colors] || 'bg-gray-500 hover:bg-gray-600'
  }

  const getPlatformGradient = (platform: string) => {
    const gradients = {
      twitter: 'from-blue-500 to-blue-600',
      linkedin: 'from-blue-600 to-blue-800',
      facebook: 'from-blue-600 to-blue-700',
      instagram: 'from-pink-500 to-purple-600'
    }
    return gradients[platform as keyof typeof gradients] || 'from-gray-500 to-gray-600'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading social accounts...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Social Media</h1>
          <p className="text-gray-600 dark:text-gray-400">Connect your social media accounts to publish content</p>
        </div>
      </div>

      {/* Success/Error Alerts */}
      {error && (
        <ErrorAlert message={error} onRetry={() => setError(null)} />
      )}
      {success && (
        <SuccessAlert message={success} onDismiss={() => setSuccess(null)} />
      )}

      {/* Connected Accounts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Twitter */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-gradient-to-r ${getPlatformGradient('twitter')}`}>
                <Twitter className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Twitter</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Share tweets and threads</p>
              </div>
            </div>
            {accounts?.twitter ? (
              <CheckCircle className="w-6 h-6 text-green-500" />
            ) : (
              <AlertCircle className="w-6 h-6 text-gray-400" />
            )}
          </div>

          {accounts?.twitter ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                {accounts.twitter.avatar && (
                  <img
                    src={accounts.twitter.avatar}
                    alt={accounts.twitter.display_name}
                    className="w-10 h-10 rounded-full"
                  />
                )}
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {accounts.twitter.display_name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    @{accounts.twitter.username}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => window.open(`https://twitter.com/${accounts.twitter!.username}`, '_blank')}
                    className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => disconnectAccount('twitter', accounts.twitter!.platform_user_id)}
                    disabled={disconnecting === 'twitter'}
                    className="p-2 text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    <Unlink className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => connectAccount('twitter')}
              disabled={connecting === 'twitter'}
              className={`w-full py-3 px-4 rounded-lg text-white font-medium transition-colors ${getPlatformColor('twitter')} disabled:opacity-50`}
            >
              {connecting === 'twitter' ? (
                <div className="flex items-center justify-center gap-2">
                  <LoadingSpinner size="sm" />
                  Connecting...
                </div>
              ) : (
                'Connect Twitter'
              )}
            </button>
          )}
        </div>

        {/* LinkedIn */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-gradient-to-r ${getPlatformGradient('linkedin')}`}>
                <Linkedin className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">LinkedIn</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Professional networking</p>
              </div>
            </div>
            <AlertCircle className="w-6 h-6 text-gray-400" />
          </div>

          <div className="text-center py-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              LinkedIn integration coming soon
            </p>
            <button
              disabled
              className="w-full py-3 px-4 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
            >
              Coming Soon
            </button>
          </div>
        </div>

        {/* Facebook */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-gradient-to-r ${getPlatformGradient('facebook')}`}>
                <Facebook className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Facebook</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Share with your community</p>
              </div>
            </div>
            <AlertCircle className="w-6 h-6 text-gray-400" />
          </div>

          <div className="text-center py-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Facebook integration coming soon
            </p>
            <button
              disabled
              className="w-full py-3 px-4 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
            >
              Coming Soon
            </button>
          </div>
        </div>

        {/* Instagram */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-gradient-to-r ${getPlatformGradient('instagram')}`}>
                <Instagram className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Instagram</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Visual storytelling</p>
              </div>
            </div>
            <AlertCircle className="w-6 h-6 text-gray-400" />
          </div>

          <div className="text-center py-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Instagram integration coming soon
            </p>
            <button
              disabled
              className="w-full py-3 px-4 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
            >
              Coming Soon
            </button>
          </div>
        </div>
      </div>

      {/* OAuth Status */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">OAuth Configuration</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
            <span className="text-sm font-medium">Twitter</span>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-xs text-green-600">Configured</span>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
            <span className="text-sm font-medium">LinkedIn</span>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-500" />
              <span className="text-xs text-yellow-600">Coming Soon</span>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
            <span className="text-sm font-medium">Facebook</span>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-500" />
              <span className="text-xs text-yellow-600">Coming Soon</span>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
            <span className="text-sm font-medium">Instagram</span>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-500" />
              <span className="text-xs text-yellow-600">Coming Soon</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
