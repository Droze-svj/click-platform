'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiGet, apiPost } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'
import LoadingSpinner from '../../../components/LoadingSpinner'
import ErrorAlert from '../../../components/ErrorAlert'
import {
  BarChart3,
  TrendingUp,
  Target,
  Users,
  Sparkles,
  RefreshCw,
  Link2,
  Calendar,
  Zap,
  MessageSquare,
  Heart,
  Share2,
  ChevronRight
} from 'lucide-react'

interface AudienceOverview {
  totalEngagement?: number
  totalImpressions?: number
  engagementRate?: number
  platformDistribution?: Record<string, number>
  postsPerDay?: number
}

interface AudienceInsights {
  hasData: boolean
  message?: string
  period?: number
  totalPosts?: number
  insights?: {
    overview?: AudienceOverview
    engagement?: Record<string, unknown>
    demographics?: Record<string, unknown>
    recommendations?: string[]
  }
}

interface PlatformAudience {
  totalPosts?: number
  totalReach?: number
  totalEngagement?: number
  averageEngagementRate?: number
  topPlatform?: string
  bestPostingTime?: string
  engagementByPlatform?: Record<string, number>
}

interface ConnectedAccounts {
  twitter?: unknown
  linkedin?: unknown
  facebook?: unknown
  instagram?: unknown
  youtube?: unknown
  tiktok?: unknown
}

export default function InsightsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audienceInsights, setAudienceInsights] = useState<AudienceInsights | null>(null)
  const [platformAudience, setPlatformAudience] = useState<PlatformAudience | null>(null)
  const [accounts, setAccounts] = useState<ConnectedAccounts | null>(null)
  const [period, setPeriod] = useState(30)

  useEffect(() => {
    loadAll()
  }, [period])

  const loadAll = async () => {
    try {
      setLoading(true)
      setError(null)
      const [insightsRes, platformRes, accountsRes] = await Promise.all([
        apiGet<{ success?: boolean; data?: AudienceInsights }>(`/audience/insights?period=${period}`).catch(() => ({ data: null })),
        apiGet<{ success?: boolean; data?: PlatformAudience }>(`/analytics/platform/audience?period=${period}`).catch(() => ({ data: null })),
        apiGet<{ success?: boolean; accounts?: ConnectedAccounts }>('/oauth/accounts').catch(() => ({ accounts: {} }))
      ])
      const rawInsights = insightsRes as any
      const rawPlatform = platformRes as any
      const rawAccounts = accountsRes as any
      const insightsData = rawInsights?.data ?? rawInsights ?? null
      const platformData = rawPlatform?.data ?? rawPlatform ?? null
      const accountsData = rawAccounts?.accounts ?? rawAccounts ?? {}
      setAudienceInsights(typeof insightsData === 'object' && insightsData !== null ? insightsData : { hasData: false })
      setPlatformAudience(typeof platformData === 'object' && platformData !== null ? platformData : null)
      setAccounts(accountsData)
    } catch (err: any) {
      setError(err?.message || 'Failed to load insights')
    } finally {
      setLoading(false)
    }
  }

  const handleSyncAnalytics = async () => {
    try {
      setSyncing(true)
      setError(null)
      await apiPost('/analytics/platform/sync-all', { limit: 50 })
      await loadAll()
    } catch (err: any) {
      setError(err?.message || 'Failed to sync analytics')
    } finally {
      setSyncing(false)
    }
  }

  const connectedCount = accounts ? Object.values(accounts).filter(Boolean).length : 0

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading insights...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Insights & Marketing</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Viewer analysis, engagement trends, and marketing recommendations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={handleSyncAnalytics}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Analytics'}
          </button>
        </div>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError(null)} />}

      {/* Connected Accounts CTA */}
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 dark:from-blue-500/20 dark:to-purple-500/20 rounded-xl p-6 border border-blue-200/50 dark:border-blue-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <Link2 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Social Media Accounts</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                {connectedCount > 0
                  ? `${connectedCount} platform${connectedCount !== 1 ? 's' : ''} connected`
                  : 'Link your social accounts to upload content and collect analytics'}
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/social"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
          >
            {connectedCount > 0 ? 'Manage Accounts' : 'Connect Accounts'}
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={BarChart3}
          label="Total Reach"
          value={
            audienceInsights?.insights?.overview?.totalImpressions ??
            platformAudience?.totalReach ??
            0
          }
          format="number"
        />
        <MetricCard
          icon={MessageSquare}
          label="Total Engagement"
          value={
            audienceInsights?.insights?.overview?.totalEngagement ??
            platformAudience?.totalEngagement ??
            0
          }
          format="number"
        />
        <MetricCard
          icon={TrendingUp}
          label="Engagement Rate"
          value={
            audienceInsights?.insights?.overview?.engagementRate ??
            platformAudience?.averageEngagementRate ??
            0
          }
          format="percent"
        />
        <MetricCard
          icon={Target}
          label="Top Platform"
          value={platformAudience?.topPlatform ?? '—'}
          format="text"
        />
      </div>

      {/* Two columns: Insights + Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overview & Platform Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Audience Overview
          </h3>
          {audienceInsights?.hasData || platformAudience ? (
            <div className="space-y-4">
              {audienceInsights?.insights?.overview?.platformDistribution &&
                Object.keys(audienceInsights.insights.overview.platformDistribution).length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Posts by Platform
                    </p>
                    <div className="space-y-2">
                      {Object.entries(audienceInsights.insights.overview.platformDistribution).map(
                        ([platform, count]) => (
                          <div key={platform} className="flex items-center justify-between">
                            <span className="capitalize text-sm">{platform}</span>
                            <span className="font-medium">{String(count)} posts</span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              {platformAudience?.bestPostingTime && (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <Calendar className="w-5 h-5 text-green-600" />
                  <span className="text-sm">
                    Best posting time: <strong>{platformAudience.bestPostingTime}</strong>
                  </span>
                </div>
              )}
              {audienceInsights?.insights?.overview?.postsPerDay != null && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  ~{audienceInsights.insights.overview.postsPerDay} posts per day
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No posted content yet</p>
              <p className="text-sm mt-1">
                Publish content and sync analytics to see audience insights
              </p>
            </div>
          )}
        </div>

        {/* Marketing Recommendations */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Marketing & Creativity Tips
          </h3>
          {audienceInsights?.insights?.recommendations &&
            audienceInsights.insights.recommendations.length > 0 ? (
            <ul className="space-y-3">
              {audienceInsights.insights.recommendations.slice(0, 6).map((rec, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm"
                >
                  <Zap className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Connect accounts and publish content to receive personalized recommendations.
              </p>
              <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-2">
                <li>• Post consistently to build audience loyalty</li>
                <li>• Use peak hours for maximum reach</li>
                <li>• Experiment with different content formats</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          href="/dashboard/analytics"
          className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex items-center gap-3"
        >
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <BarChart3 className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900 dark:text-white">Analytics</p>
            <p className="text-xs text-gray-500">View detailed performance</p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </Link>
        <Link
          href="/dashboard/scheduler"
          className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex items-center gap-3"
        >
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <Calendar className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900 dark:text-white">Scheduler</p>
            <p className="text-xs text-gray-500">Schedule optimal posts</p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </Link>
        <Link
          href="/dashboard/content"
          className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex items-center gap-3"
        >
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <Share2 className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900 dark:text-white">Content</p>
            <p className="text-xs text-gray-500">Create and publish content</p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </Link>
      </div>
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  format
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string
  format: 'number' | 'percent' | 'text'
}) {
  const display =
    format === 'number'
      ? typeof value === 'number'
        ? value >= 1000
          ? (value / 1000).toFixed(1) + 'k'
          : String(value)
        : String(value)
      : format === 'percent'
        ? typeof value === 'number'
          ? value.toFixed(1) + '%'
          : String(value)
        : String(value)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
          <Icon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{display}</p>
        </div>
      </div>
    </div>
  )
}
