'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '../../../hooks/useAuth'
import LoadingSpinner from '../../../components/LoadingSpinner'
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
  CheckCircle,
  AlertCircle,
  Link2
} from 'lucide-react'
import { useOAuth } from '../../../hooks/useOAuth'

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
  twitter?: PlatformAccount | null
  linkedin?: PlatformAccount | null
  facebook?: PlatformAccount | null
  instagram?: PlatformAccount | null
  youtube?: PlatformAccount | null
  tiktok?: PlatformAccount | null
  [key: string]: PlatformAccount | null | undefined
}

export default function SocialPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { connect, disconnect, getConnections, loading: oauthLoading } = useOAuth()
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<ConnectedAccounts | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    loadAccounts()

    // Check for OAuth callback parameters
    const successParam = searchParams.get('success')
    const errorParam = searchParams.get('error')
    const platformParam = searchParams.get('platform')
    const descriptionParam = searchParams.get('description')

    if (successParam === 'true' && platformParam) {
      setSuccess(`Successfully connected your ${platformParam} account!`)
    } else if (errorParam) {
      setError(`Failed to connect ${platformParam || 'account'}: ${descriptionParam || errorParam}`)
    }
  }, [searchParams])

  const loadAccounts = async () => {
    try {
      setLoading(true)
      setError(null)
      const connections = await getConnections()
      setAccounts(connections as ConnectedAccounts)
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
      await connect(platform)
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
      await disconnect(platform)
      setSuccess(`Successfully disconnected your ${platform} account`)
      await loadAccounts()
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
    return icons[platform as keyof typeof icons] || Link2
  }

  const getPlatformColor = (platform: string) => {
    const colors = {
      twitter: 'bg-blue-400 hover:bg-blue-500',
      linkedin: 'bg-blue-700 hover:bg-blue-800',
      facebook: 'bg-blue-600 hover:bg-blue-700',
      instagram: 'bg-pink-500 hover:bg-pink-600',
      youtube: 'bg-red-600 hover:bg-red-700',
      tiktok: 'bg-black hover:bg-gray-900'
    }
    return colors[platform as keyof typeof colors] || 'bg-gray-500 hover:bg-gray-600'
  }

  const getPlatformGradient = (platform: string) => {
    const gradients = {
      twitter: 'from-blue-400 to-blue-600',
      linkedin: 'from-blue-600 to-blue-800',
      facebook: 'from-blue-600 to-blue-700',
      instagram: 'from-pink-500 to-purple-600',
      youtube: 'from-red-600 to-red-800',
      tiktok: 'from-gray-800 to-black'
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
        <ErrorAlert message={error} onClose={() => setError(null)} />
      )}
      {success && (
        <SuccessAlert message={success} onClose={() => setSuccess(null)} />
      )}

      {/* Connected Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          { id: 'twitter', name: 'Twitter', icon: Twitter, desc: 'Share tweets and threads' },
          { id: 'youtube', name: 'YouTube', icon: Youtube, desc: 'Publish and manage videos' },
          { id: 'instagram', name: 'Instagram', icon: Instagram, desc: 'Visual storytelling' },
          { id: 'linkedin', name: 'LinkedIn', icon: Linkedin, desc: 'Professional networking' },
          { id: 'facebook', name: 'Facebook', icon: Facebook, desc: 'Community engagement' },
          { id: 'tiktok', name: 'TikTok', icon: Video, desc: 'Short-form video' }
        ].map((p) => {
          const account = accounts?.[p.id];
          const isConnecting = connecting === p.id;
          const isDisconnecting = disconnecting === p.id;

          return (
            <div key={p.id} className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-gradient-to-r ${getPlatformGradient(p.id)}`}>
                    <p.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{p.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{p.desc}</p>
                  </div>
                </div>
                {account ? (
                  <CheckCircle className="w-6 h-6 text-green-500" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-gray-400 opacity-20" />
                )}
              </div>

              {account ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600">
                    {account.avatar ? (
                      <img
                        src={account.avatar}
                        alt={account.display_name}
                        className="w-10 h-10 rounded-full border-2 border-white dark:border-gray-800"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                        <p.icon className="w-5 h-5 text-gray-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {account.display_name}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                        @{account.username}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          const url = p.id === 'youtube' ? `https://youtube.com/channel/${account.platform_user_id}` :
                                     p.id === 'twitter' ? `https://twitter.com/${account.username}` :
                                     p.id === 'instagram' ? `https://instagram.com/${account.username}` :
                                     p.id === 'linkedin' ? `https://linkedin.com/in/${account.username}` :
                                     `#`;
                          if (url !== '#') window.open(url, '_blank');
                        }}
                        className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => disconnectAccount(p.id, account.platform_user_id)}
                        disabled={isDisconnecting}
                        className="p-2 text-red-400 hover:text-red-600 disabled:opacity-50 transition-colors"
                      >
                        <Unlink className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => connectAccount(p.id)}
                  disabled={isConnecting}
                  className={`w-full py-3 px-4 rounded-lg text-white font-medium transition-all transform active:scale-95 ${getPlatformColor(p.id)} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isConnecting ? (
                    <div className="flex items-center justify-center gap-2">
                      <LoadingSpinner size="sm" />
                      <span>Negotiating...</span>
                    </div>
                  ) : (
                    `Connect ${p.name}`
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* OAuth Status */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">OAuth Configuration</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { id: 'twitter', name: 'Twitter' },
            { id: 'youtube', name: 'YouTube' },
            { id: 'instagram', name: 'Instagram' },
            { id: 'linkedin', name: 'LinkedIn' },
            { id: 'facebook', name: 'Facebook' },
            { id: 'tiktok', name: 'TikTok' }
          ].map(p => (
            <div key={p.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
              <span className="text-sm font-medium">{p.name}</span>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-xs text-green-600">Active</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
