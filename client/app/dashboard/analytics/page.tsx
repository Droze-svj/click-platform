'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Eye, Brain, Sparkles, RefreshCw, Search, Filter,
  Boxes, Clock, BarChart3, Waves, MoreHorizontal,
  Music, Instagram, Youtube, Video as VideoIcon, ArrowUpRight,
} from 'lucide-react'
import { apiGet } from '@/lib/api'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import ToastContainer from '@/components/ToastContainer'
import { StatsCardSkeleton, ContentSkeleton } from '@/components/LoadingSkeleton'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/hooks/useTranslation'
import { useContainerWidth } from '@/hooks/useContainerWidth'
import { cn } from '@/lib/utils'
import {
  Panel,
  StatCard,
  SectionHeader,
  EmptyState,
  Button,
  IconButton,
  Input,
} from '@/components/ui'

// ── Types ─────────────────────────────────────────────────────────────────────
interface AnalyticsOverview {
  total_posts: number
  total_views: number
  total_engagement: number
  avg_engagement_rate: number
  published_posts: number
  isFallback?: boolean
  ai_summary?: {
    headline: string
    recommendation: string
    intensity: number
  }
}

interface NodeRecord {
  id: string
  title: string
  platform: string
  views: number
  engagement: number
  engagement_rate: number
  status: string
  publishedAt?: string
  viralScore?: number
}

/** Compact human formatting for large counts (1.2K, 3.4M). */
function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}

/** Verified lucide@0.294.0 icons for the common platforms. */
function platformIcon(platform: string) {
  const p = (platform || '').toLowerCase()
  if (p === 'tiktok') return Music
  if (p === 'instagram') return Instagram
  if (p === 'youtube') return Youtube
  return VideoIcon
}

export default function AnalyticsPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const { ref: shellRef, width } = useContainerWidth<HTMLDivElement>()
  const [data, setData] = useState<AnalyticsOverview | null>(null)
  const [nodes, setNodes] = useState<NodeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [fetchError, setFetchError] = useState(false)
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [showFilterMenu, setShowFilterMenu] = useState(false)

  const fetchMatrix = useCallback(async () => {
    setRefreshing(true)
    setFetchError(false)
    try {
      const res: any = await apiGet('/analytics/dashboard')
      const overview = res?.overview ? { ...res.overview, isFallback: !!(res.isFallback || res.overview.isFallback) } : null
      setData(overview)

      const nodeRes: any = await apiGet('/analytics/creator/stats')
      setNodes(Array.isArray(nodeRes?.stats) ? nodeRes.stats : [])
    } catch (err) {
      console.error('Analytics fetch failed', err)
      setFetchError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchMatrix() }, [fetchMatrix])

  const availablePlatforms = useMemo(
    () => Array.from(new Set(nodes.map(n => n.platform).filter(Boolean))),
    [nodes]
  )

  const filteredNodes = nodes.filter(node => {
    const matchesSearch =
      node.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.platform.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesPlatform = platformFilter === 'all' || node.platform === platformFilter
    return matchesSearch && matchesPlatform
  })

  // Narrow content: stack the ledger row metrics so nothing overflows.
  const compact = width > 0 && width < 640

  if (loading) return (
    <div className="min-h-screen ds-bg-mesh-soft px-4 sm:px-6 lg:px-10 py-8 max-w-[1700px] mx-auto" aria-busy="true" aria-label={t('analyticsPage.loading')}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => <StatsCardSkeleton key={i} />)}
      </div>
      <ContentSkeleton />
    </div>
  )

  return (
    <ErrorBoundary>
      <div
        ref={shellRef}
        className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 max-w-[1700px] mx-auto overflow-x-hidden text-theme-primary"
      >
        <ToastContainer />

        {/* The dashboard layout already renders the global header (title +
            breadcrumb). We keep only the page-specific controls here. */}
        <SectionHeader
          as="h1"
          title={t('analyticsPage.title')}
          description={t('analyticsPage.recentPostsSubtitle')}
          className="mb-6"
          actions={
            <>
              <Button
                variant="secondary"
                size="md"
                leftIcon={<Brain size={16} aria-hidden />}
                onClick={() => router.push('/dashboard/analytics/creator')}
              >
                {t('analyticsPage.aiInsights')}
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={fetchMatrix}
                loading={refreshing}
                leftIcon={!refreshing ? <RefreshCw size={16} aria-hidden /> : undefined}
              >
                {refreshing ? t('analyticsPage.syncing') : t('analyticsPage.refresh')}
              </Button>
            </>
          }
        />

        {/* API error banner */}
        {fetchError && (
          <Panel variant="subtle" className="ds-anim-fade-in mb-6 border-rose-500/30 flex flex-col sm:flex-row items-center gap-4 p-5">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
              <BarChart3 size={24} aria-hidden />
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <h3 className="ds-text-h3 text-theme-primary">{t('analyticsPage.errorTitle')}</h3>
              <p className="ds-text-caption mt-1">{t('analyticsPage.errorSubtitle')}</p>
            </div>
            <Button variant="secondary" size="md" onClick={fetchMatrix}>
              {t('analyticsPage.retry')}
            </Button>
          </Panel>
        )}

        {/* Empty-state banner — shown when analytics are a server fallback
            (no connected accounts / no data yet). */}
        {data?.isFallback && (
          <Panel variant="subtle" className="ds-anim-fade-in mb-6 border-amber-500/30 flex flex-col sm:flex-row items-center gap-4 p-5">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <Sparkles size={24} aria-hidden />
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <h3 className="ds-text-h3 text-theme-primary">{t('analyticsPage.emptyTitle')}</h3>
              <p className="ds-text-caption mt-1">
                {t('analyticsPage.emptyBodyBefore')}{' '}
                <Link href="/dashboard/social" className="text-amber-500 underline hover:no-underline">{t('analyticsPage.connectAccounts')}</Link>{' '}
                {t('analyticsPage.emptyBodyAfter')}
              </p>
            </div>
            <Button variant="secondary" size="md" onClick={() => router.push('/dashboard/social')}>
              {t('analyticsPage.connect')}
            </Button>
          </Panel>
        )}

        {/* ── Real metrics (from /analytics/dashboard overview) ─────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            className="ds-hover-lift ds-anim-rise"
            label={t('analyticsPage.cardReach')}
            value={fmt(data?.total_views || 0)}
            icon={Eye}
          />
          <StatCard
            className="ds-hover-lift ds-anim-rise"
            label={t('analyticsPage.cardEngagement')}
            value={fmt(data?.total_engagement || 0)}
            icon={Waves}
          />
          <StatCard
            className="ds-hover-lift ds-anim-rise"
            label={t('analyticsPage.cardPosts')}
            value={data?.total_posts || 0}
            icon={Boxes}
          />
          <StatCard
            className="ds-hover-lift ds-anim-rise"
            label={t('analyticsPage.engagement')}
            value={`${data?.avg_engagement_rate || 0}%`}
            icon={BarChart3}
          />
        </div>

        {/* ── AI insight (real ai_summary.headline) ────────────────────── */}
        {data?.ai_summary?.headline && (
          <Panel variant="bento" className="ds-anim-rise mb-6 p-6">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-indigo-500" aria-hidden />
              <span className="ds-text-label text-theme-primary">{t('analyticsPage.aiInsight')}</span>
              <IconButton
                variant="ghost"
                size="sm"
                aria-label={t('analyticsPage.refreshInsight')}
                onClick={fetchMatrix}
                disabled={refreshing}
                className="ml-auto"
              >
                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} aria-hidden />
              </IconButton>
            </div>
            <p className="ds-text-h3 text-theme-primary mt-3 [overflow-wrap:anywhere]">
              &ldquo;{data.ai_summary.headline}&rdquo;
            </p>
            {data.ai_summary.recommendation && (
              <p className="ds-text-body text-theme-muted mt-2">{data.ai_summary.recommendation}</p>
            )}
          </Panel>
        )}

        {/* ── Recent posts ledger (real /analytics/creator/stats) ──────── */}
        <Panel variant="bento" className="ds-anim-rise overflow-hidden p-0">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-5 border-b border-[var(--border-subtle)]">
            <SectionHeader as="h2" title={t('analyticsPage.recentPosts')} className="min-w-0" />
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 min-w-0 md:w-72">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" aria-hidden />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('analyticsPage.searchPosts')}
                  aria-label={t('analyticsPage.searchPosts')}
                  className="pl-9"
                />
              </div>
              <div className="relative shrink-0">
                <IconButton
                  variant={platformFilter !== 'all' ? 'primary' : 'secondary'}
                  size="md"
                  onClick={() => setShowFilterMenu(v => !v)}
                  aria-label={t('analyticsPage.filterByPlatform')}
                  aria-haspopup="menu"
                  aria-expanded={showFilterMenu ? 'true' : 'false'}
                >
                  <Filter size={18} aria-hidden />
                </IconButton>
                {showFilterMenu && (
                  <div role="menu" className="ds-surface-elevated absolute right-0 mt-2 w-52 z-50 overflow-hidden p-1">
                    {['all', ...availablePlatforms].map(platform => (
                      <button
                        key={platform}
                        type="button"
                        role="menuitemradio"
                        aria-checked={platformFilter === platform}
                        onClick={() => { setPlatformFilter(platform); setShowFilterMenu(false); }}
                        className={cn(
                          'w-full text-left rounded-lg px-3 py-2 text-sm font-medium capitalize transition-colors',
                          platformFilter === platform ? 'bg-primary/10 text-primary' : 'text-theme-secondary hover:bg-accent hover:text-theme-primary'
                        )}
                      >
                        {platform === 'all' ? t('analyticsPage.allPlatforms') : platform}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {filteredNodes.length === 0 ? (
              <EmptyState
                icon={Boxes}
                title={t('analyticsPage.noPostsYet')}
                className="py-16"
              />
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {filteredNodes.map((node, idx) => {
                  const PIcon = platformIcon(node.platform)
                  const score = node.viralScore ?? 0
                  return (
                    <li key={node.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label={t('analyticsPage.viewDetailsFor', { title: node.title })}
                        onClick={() => router.push(`/dashboard/video/edit/${node.id}`)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push(`/dashboard/video/edit/${node.id}`) }}
                        className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 hover:bg-accent transition-colors cursor-pointer group"
                      >
                        <span className="ds-text-caption tabular-nums w-6 flex-shrink-0 text-theme-muted">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
                          <PIcon size={18} aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="ds-text-label text-theme-primary truncate">{node.title}</p>
                          <p className="ds-text-caption flex items-center gap-2 flex-wrap">
                            <span className="capitalize">{node.platform}</span>
                            <span aria-hidden>·</span>
                            <Clock size={11} aria-hidden />
                            {new Date(node.publishedAt || Date.now()).toLocaleDateString()}
                          </p>
                        </div>
                        {!compact && (
                          <div className="text-right flex-shrink-0">
                            <div className="ds-text-h3 text-theme-primary tabular-nums leading-none">{fmt(node.views)}</div>
                            <div className="ds-text-caption mt-0.5">{t('analyticsPage.views')}</div>
                          </div>
                        )}
                        <div className={cn(
                          'flex h-11 w-11 flex-shrink-0 flex-col items-center justify-center rounded-xl',
                          score >= 80 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-indigo-500/10 text-indigo-500'
                        )}>
                          <span className="text-sm font-bold leading-none tabular-nums">{score}</span>
                          <span className="text-[8px] font-semibold mt-0.5 uppercase tracking-wide">{t('analyticsPage.score')}</span>
                        </div>
                        <IconButton
                          variant="ghost"
                          size="sm"
                          aria-label={t('analyticsPage.viewPostAnalytics')}
                          onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/analytics/posts/${node.id}`) }}
                          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal size={18} aria-hidden />
                        </IconButton>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-[var(--border-subtle)]">
            <span className="ds-text-caption inline-flex items-center gap-1.5">
              <ArrowUpRight size={12} aria-hidden /> {t('analyticsPage.secureConnection')}
            </span>
            <span className="ds-text-caption text-theme-secondary">
              {filteredNodes.length === nodes.length
                ? t('analyticsPage.postsTracked', { count: nodes.length })
                : t('analyticsPage.postsFiltered', { shown: filteredNodes.length, total: nodes.length })}
            </span>
          </div>
        </Panel>
      </div>
    </ErrorBoundary>
  )
}
