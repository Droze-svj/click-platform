'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { apiGet, apiDelete, apiPost } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'
import LoadingSpinner from '../../../components/LoadingSpinner'

function OAuthStatusSection() {
  const [config, setConfig] = useState<Record<string, boolean> | null>(null)
  useEffect(() => {
    apiGet<{ configured?: Record<string, boolean> }>('/oauth/status')
      .then((r) => setConfig(r?.configured || {}))
      .catch(() => setConfig({}))
  }, [])
  const platforms = [
    { key: 'twitter', label: 'Twitter' },
    { key: 'linkedin', label: 'LinkedIn' },
    { key: 'facebook', label: 'Facebook' },
    { key: 'instagram', label: 'Instagram' },
    { key: 'youtube', label: 'YouTube' },
    { key: 'tiktok', label: 'TikTok' }
  ]
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">OAuth Configuration</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {platforms.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
            <span className="text-sm font-medium">{label}</span>
            <div className="flex items-center gap-2">
              {config === null ? (
                <LoadingSpinner size="sm" />
              ) : config[key] ? (
                <>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-green-600">Configured</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <span className="text-xs text-amber-600">Not configured</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
import ErrorAlert from '../../../components/ErrorAlert'
import SuccessAlert from '../../../components/SuccessAlert'
import {
  Twitter,
  Linkedin,
  Facebook,
  Instagram,
  Youtube,
  Video,
  Unlink,
  ExternalLink,
  ChevronRight,
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
  youtube: PlatformAccount | null
  tiktok: PlatformAccount | null
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

  const completedOAuthRef = useRef(false)

  useEffect(() => {
    loadAccounts()
  }, [])

  // Handle OAuth callback params (success/error from main flow, or code/state for LinkedIn/Facebook)
  useEffect(() => {
    const successParam = searchParams.get('success')
    const errorParam = searchParams.get('error')
    const platformParam = searchParams.get('platform')
    const description = searchParams.get('description')
    const code = searchParams.get('code')
    const state = searchParams.get('state')

    // LinkedIn/Facebook authorize+complete flow: redirect with code & state
    if (platformParam && code && state && (platformParam === 'linkedin' || platformParam === 'facebook') && !completedOAuthRef.current) {
      completedOAuthRef.current = true
      apiPost(`/oauth/${platformParam}/complete`, { code, state })
        .then(() => {
          setSuccess(`Successfully connected your ${platformParam} account!`)
          router.replace('/dashboard/social?success=true&platform=' + platformParam)
          loadAccounts()
        })
        .catch((err: any) => {
          setError(err?.response?.data?.error || err?.message || `Failed to connect ${platformParam}`)
          router.replace('/dashboard/social?error=' + encodeURIComponent(err?.message || 'connection_failed'))
        })
      return
    }

    if (successParam === 'true' && platformParam) {
      setSuccess(`Successfully connected your ${platformParam} account!`)
    } else if (errorParam) {
      setError(`Failed to connect ${platformParam || 'account'}: ${description || errorParam}`)
    }
  }, [searchParams])

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

      await apiDelete(`/oauth/${platform}/disconnect`, { data: { platform_user_id: platformUserId } })

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
      instagram: Instagram,
      youtube: Youtube,
      tiktok: Video
    }
    return icons[platform as keyof typeof icons] || Twitter
  }

  const getPlatformColor = (platform: string) => {
    const colors = {
      twitter: 'bg-blue-500 hover:bg-blue-600',
      linkedin: 'bg-blue-700 hover:bg-blue-800',
      facebook: 'bg-blue-600 hover:bg-blue-700',
      instagram: 'bg-pink-500 hover:bg-pink-600',
      youtube: 'bg-red-600 hover:bg-red-700',
      tiktok: 'bg-gray-900 hover:bg-black'
    }
    return colors[platform as keyof typeof colors] || 'bg-gray-500 hover:bg-gray-600'
  }

  const getPlatformGradient = (platform: string) => {
    const gradients = {
      twitter: 'from-blue-500 to-blue-600',
      linkedin: 'from-blue-600 to-blue-800',
      facebook: 'from-blue-600 to-blue-700',
      instagram: 'from-pink-500 to-purple-600',
      youtube: 'from-red-600 to-red-700',
      tiktok: 'from-gray-900 to-black'
    }
    return gradients[platform as keyof typeof gradients] || 'from-gray-500 to-gray-600'
  }

  const renderPlatformCard = (platform: string, account: PlatformAccount | null, config: { title: string; description: string; profileUrl?: string }) => {
    const Icon = getPlatformIcon(platform)
    return (
      <div key={platform} className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-gradient-to-r ${getPlatformGradient(platform)}`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{config.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{config.description}</p>
            </div>
          </div>
          {account ? (
            <CheckCircle className="w-6 h-6 text-green-500" />
          ) : (
            <AlertCircle className="w-6 h-6 text-gray-400" />
          )}
        </div>

        {account ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              {account.avatar && (
                <img
                  src={account.avatar}
                  alt={account.display_name}
                  className="w-10 h-10 rounded-full"
                />
              )}
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-white">
                  {account.display_name}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  @{account.username}
                </p>
              </div>
              <div className="flex gap-2">
                {config.profileUrl && (
                  <button
                    onClick={() => window.open(config.profileUrl!.replace('{username}', account.username), '_blank')}
                    className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => disconnectAccount(platform, account.platform_user_id)}
                  disabled={disconnecting === platform}
                  className="p-2 text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  <Unlink className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => connectAccount(platform)}
            disabled={connecting === platform}
            className={`w-full py-3 px-4 rounded-lg text-white font-medium transition-colors ${getPlatformColor(platform)} disabled:opacity-50`}
          >
            {connecting === platform ? (
              <div className="flex items-center justify-center gap-2">
                <LoadingSpinner size="sm" />
                Connecting...
              </div>
            ) : (
              `Connect ${config.title}`
            )}
          </button>
        )}
      </div>
    )
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
          <p className="text-gray-600 dark:text-gray-400">Connect your social media accounts to publish content and collect analytics</p>
          <Link
            href="/dashboard/insights"
            className="inline-flex items-center gap-1 mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            View Insights & Marketing
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Success/Error Alerts */}
      {error && (
        <ErrorAlert message={error} onClose={() => setError(null)} />
      )}
      {success && (
        <SuccessAlert message={success} onClose={() => setSuccess(null)} />
      )}

      {/* Connected Accounts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {renderPlatformCard('twitter', accounts?.twitter ?? null, { title: 'Twitter', description: 'Share tweets and threads', profileUrl: 'https://twitter.com/{username}' })}
        {renderPlatformCard('linkedin', accounts?.linkedin ?? null, { title: 'LinkedIn', description: 'Professional networking' })}
        {renderPlatformCard('facebook', accounts?.facebook ?? null, { title: 'Facebook', description: 'Share with your community' })}
        {renderPlatformCard('instagram', accounts?.instagram ?? null, { title: 'Instagram', description: 'Visual storytelling', profileUrl: 'https://instagram.com/{username}' })}
        {renderPlatformCard('youtube', accounts?.youtube ?? null, { title: 'YouTube', description: 'Upload videos and reach viewers', profileUrl: 'https://youtube.com/@{username}' })}
        {renderPlatformCard('tiktok', accounts?.tiktok ?? null, { title: 'TikTok', description: 'Short-form video and reels', profileUrl: 'https://tiktok.com/@{username}' })}
      </div>

      {/* OAuth Status */}
      <OAuthStatusSection />
    </div>
  )
}
