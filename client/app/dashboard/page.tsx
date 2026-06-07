'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Hammer, Video, FileText, Send, Flame, Plug,
  Eye, Heart, Megaphone, Signal,
  Sparkles, ArrowRight, ArrowUpRight, Rocket, Clock,
  LayoutGrid, RefreshCw, Target, Fingerprint, Link2, X,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { apiGet } from '../../lib/api'
import { useTranslation } from '../../hooks/useTranslation'
import { useContainerWidth } from '../../hooks/useContainerWidth'
import { cn } from '../../lib/utils'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import ToastContainer from '../../components/ToastContainer'
import SubscriptionBanner from '../../components/SubscriptionBanner'
import {
  Panel,
  StatCard,
  SectionHeader,
  EmptyState,
  Button,
} from '../../components/ui'

/**
 * Dashboard quick-nav cards. The `key` drives the translation lookup
 * (`dashboard.nav.<key>.label` / `.desc`) so non-English visitors see
 * translated cards; t()'s fallback chain returns English when a locale
 * lacks the key. Routes are preserved 1:1 from the previous dashboard.
 */
const DASHBOARD_NAV = [
  { key: 'forge', icon: Hammer, href: '/dashboard/forge', accent: 'text-indigo-500 bg-indigo-500/10' },
  { key: 'studio', icon: Video, href: '/dashboard/video', accent: 'text-rose-500 bg-rose-500/10' },
  { key: 'script', icon: FileText, href: '/dashboard/scripts', accent: 'text-amber-500 bg-amber-500/10' },
  { key: 'scheduler', icon: Send, href: '/dashboard/scheduler', accent: 'text-emerald-500 bg-emerald-500/10' },
  { key: 'discover', icon: Flame, href: '/dashboard/trends', accent: 'text-orange-500 bg-orange-500/10' },
  { key: 'vault', icon: Plug, href: '/dashboard/social', accent: 'text-cyan-500 bg-cyan-500/10' },
] as const

/** Compact human formatting for large counts (1.2K, 3.4M). */
function fmt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

// ── Real backend shapes (loose: the server uses a few field synonyms) ───────
interface AnalyticsSummary {
  totalViews?: number
  totalEngagement?: number
  totalPosts?: number
  publishedPosts?: number
  recent_posts?: RecentPost[]
}
interface RecentPost {
  id: string
  title?: string | null
  status?: string | null
  published_at?: string | null
  created_at?: string | null
  post_analytics?: { views?: number }[]
}
interface StyleInsight {
  source: 'user' | 'team' | 'defaults'
  totalPicks: number
  topPicks: {
    preset?: string | null
    hookStyle?: string | null
    publishHour?: string | null
  }
  hint?: string | null
}

// Human-friendly labels for the niches Click supports — kept 1:1 with the
// register page + NICHE_PLAYBOOKS. Used by the post-signup welcome banner to
// greet the user with their real, chosen workspace (no fabricated copy).
const NICHE_LABELS: Record<string, string> = {
  health: 'Health & Fitness', finance: 'Finance & Money', education: 'Education',
  technology: 'Technology', lifestyle: 'Lifestyle', business: 'Business',
  entertainment: 'Entertainment', crypto: 'Crypto & Web3', parenting: 'Parenting',
  beauty: 'Beauty & Skincare', wellness: 'Wellness', science: 'Science',
  gaming: 'Gaming', other: 'creator',
}

function timeAgo(iso?: string | null): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Date.now() - then
  const mins = Math.round(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return `${days}d ago`
}

export default function DashboardHome() {
  const { user } = useAuth() as any
  const { t } = useTranslation()
  const { ref: gridRef, width } = useContainerWidth<HTMLDivElement>()
  const searchParams = useSearchParams()

  // Post-signup welcome banner — additive, dismissible. Shows only when the
  // register flow routes here with ?welcome=1. The niche (when present) is the
  // real one the user picked at signup, so we greet their actual workspace.
  const isWelcome = searchParams?.get('welcome') === '1'
  const welcomeNiche = (searchParams?.get('niche') || '').toLowerCase()
  const welcomeNicheLabel = welcomeNiche && NICHE_LABELS[welcomeNiche] ? NICHE_LABELS[welcomeNiche] : ''
  const [welcomeDismissed, setWelcomeDismissed] = useState(false)

  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null)
  const [styleInsight, setStyleInsight] = useState<StyleInsight | null>(null)
  const [connections, setConnections] = useState<Record<string, boolean>>({})

  // Live time-aware greeting — re-evaluates each minute so it stays correct
  // without a reload when the user crosses a time-of-day boundary.
  const [hour, setHour] = useState(() => new Date().getHours())
  useEffect(() => {
    const id = setInterval(() => setHour(new Date().getHours()), 60_000)
    return () => clearInterval(id)
  }, [])
  const greeting =
    hour >= 5 && hour < 12 ? t('dashboard.greeting.morning') || 'Good morning' :
    hour >= 12 && hour < 17 ? t('dashboard.greeting.afternoon') || 'Good afternoon' :
    hour >= 17 && hour < 22 ? t('dashboard.greeting.evening') || 'Good evening' :
    t('dashboard.greeting.night') || 'Good night'

  const rawName =
    user?.username ||
    user?.first_name ||
    (user?.name && String(user.name).trim().split(/\s+/)[0]) ||
    user?.email?.split('@')[0] ||
    'Creator'
  const firstName = String(rawName).length > 24 ? String(rawName).slice(0, 24) + '…' : String(rawName)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [analyticsRes, insightRes, connectionsRes] = await Promise.allSettled([
        apiGet<any>('/analytics/dashboard'),
        apiGet<any>('/video/clips/style-insight'),
        apiGet<any>('/oauth/connections'),
      ])

      const a = analyticsRes.status === 'fulfilled' ? (analyticsRes.value?.data ?? analyticsRes.value) : null
      setAnalytics(a)

      const insight = insightRes.status === 'fulfilled' ? (insightRes.value?.data ?? insightRes.value) : null
      if (insight && typeof insight === 'object') setStyleInsight(insight as StyleInsight)

      const rawAccounts = connectionsRes.status === 'fulfilled'
        ? (connectionsRes.value?.accounts ?? connectionsRes.value?.data?.accounts ?? {})
        : {}
      const connMap: Record<string, boolean> = {}
      for (const [platform, val] of Object.entries(rawAccounts)) {
        connMap[platform] = val !== null && val !== undefined
      }
      setConnections(connMap)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const connectedCount = Object.values(connections).filter(Boolean).length
  const noConnections = Object.keys(connections).length > 0 && connectedCount === 0

  const recentPosts = (analytics?.recent_posts ?? []).slice(0, 5)

  // On very narrow content widths drop the quick-actions to a single column so
  // the labels never wrap awkwardly inside the bento tile.
  const quickActionsCols = width > 0 && width < 520 ? 1 : 2

  return (
    <ErrorBoundary>
      <SubscriptionBanner />
      <ToastContainer />

      <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 max-w-[1700px] mx-auto overflow-x-hidden">
        {/* The layout already renders DashboardHeader (page title + breadcrumb),
            so we start straight into the greeting hero and bento content. */}

        {/* Post-signup welcome — additive, dismissible. Reflects the real niche
            the user chose at signup; falls back to honest generic copy when
            niche is absent (e.g. the user skipped personalization). */}
        {isWelcome && !welcomeDismissed && (
          <Panel variant="bento" className="ds-anim-rise mb-6 p-5 sm:p-6 border-indigo-500/30 flex items-start gap-4">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
              <Sparkles size={22} aria-hidden />
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="ds-text-h3 text-theme-primary">
                {welcomeNicheLabel
                  ? `Your ${welcomeNicheLabel} workspace is ready`
                  : 'Welcome to Click'}
              </h3>
              <p className="ds-text-caption text-theme-muted mt-1">
                {welcomeNicheLabel
                  ? 'Click is tuned to your niche playbook. Finish setup or forge your first clip.'
                  : 'Pick your niche to tune Click to your style, or jump straight into your first clip.'}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/dashboard/onboarding">
                  <Button variant="primary" size="md" rightIcon={<ArrowRight size={16} aria-hidden />}>
                    {welcomeNicheLabel ? 'Open your playbook' : 'Finish setup'}
                  </Button>
                </Link>
                <Link href="/dashboard/forge">
                  <Button variant="secondary" size="md" leftIcon={<Hammer size={16} aria-hidden />}>
                    Forge a clip
                  </Button>
                </Link>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setWelcomeDismissed(true)}
              aria-label="Dismiss welcome"
              className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-theme-muted hover:bg-accent hover:text-theme-primary transition-colors"
            >
              <X size={18} aria-hidden />
            </button>
          </Panel>
        )}

        <div ref={gridRef} className="ds-bento-grid">

          {/* ── Hero / welcome (2x1) ───────────────────────────────────── */}
          <Panel
            variant="bento"
            className="ds-bento-2x1 ds-anim-rise relative overflow-hidden flex flex-col justify-between p-6 sm:p-8 ds-bg-mesh"
          >
            <div className="relative z-10">
              <p className="ds-text-label text-theme-muted">{greeting}</p>
              <h2 className="ds-text-display text-theme-primary mt-1 break-words">{firstName}</h2>
              <p className="ds-text-body text-theme-muted mt-2 max-w-md">
                {t('dashboard.hero.subtitle') || 'Forge a clip, write a script, or schedule your next post — Click is ready when you are.'}
              </p>
            </div>
            <div className="relative z-10 mt-6 flex flex-wrap gap-3">
              <Link href="/dashboard/forge">
                <Button variant="gradient" size="lg" leftIcon={<Hammer size={18} aria-hidden />}>
                  {t('dashboard.nav.forge.label') || 'One-Click Forge'}
                </Button>
              </Link>
              <Link href="/dashboard/video">
                <Button variant="secondary" size="lg" leftIcon={<Video size={18} aria-hidden />}>
                  {t('dashboard.nav.studio.label') || 'Studio'}
                </Button>
              </Link>
              <Link href="/dashboard/scheduler">
                <Button variant="secondary" size="lg" leftIcon={<Send size={18} aria-hidden />}>
                  {t('dashboard.nav.scheduler.label') || 'Scheduler'}
                </Button>
              </Link>
            </div>
          </Panel>

          {/* ── Stat tiles (real /analytics/dashboard) ─────────────────── */}
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Panel key={`s-${i}`} variant="subtle" className="p-5 animate-pulse">
                <div className="h-3 w-16 rounded bg-theme-muted/20" />
                <div className="mt-4 h-8 w-20 rounded bg-theme-muted/20" />
              </Panel>
            ))
          ) : (
            <>
              <StatCard
                className="ds-hover-lift ds-anim-rise"
                label={t('dashboard.stats.reach') || 'Reach'}
                value={fmt(analytics?.totalViews)}
                icon={Eye}
              />
              <StatCard
                className="ds-hover-lift ds-anim-rise"
                label={t('dashboard.stats.engagement') || 'Engagement'}
                value={fmt(analytics?.totalEngagement)}
                icon={Heart}
              />
              <StatCard
                className="ds-hover-lift ds-anim-rise"
                label={t('dashboard.stats.published') || 'Published'}
                value={analytics?.publishedPosts ?? 0}
                icon={Megaphone}
              />
              <StatCard
                className="ds-hover-lift ds-anim-rise"
                label={t('dashboard.stats.connected') || 'Connected'}
                value={connectedCount}
                icon={Signal}
              />
            </>
          )}

          {/* ── Quick actions (2x2) ────────────────────────────────────── */}
          <Panel variant="bento" className="ds-bento-2x2 ds-anim-rise p-6">
            <SectionHeader
              as="h3"
              title={t('dashboard.quickActions.title') || 'Quick actions'}
              description={t('dashboard.quickActions.subtitle') || 'Jump straight into a workflow'}
              className="mb-5"
            />
            <div className={cn('grid gap-3', quickActionsCols === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
              {DASHBOARD_NAV.map((act) => (
                <Link
                  key={act.key}
                  href={act.href}
                  className="ds-surface-subtle ds-hover-lift group flex items-start gap-3 p-4 transition-colors hover:border-[var(--glass-border-strong)]"
                >
                  <span className={cn('flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl', act.accent)}>
                    <act.icon size={20} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="ds-text-label text-theme-primary truncate">
                      {t(`dashboard.nav.${act.key}.label`)}
                    </p>
                    <p className="ds-text-caption line-clamp-2">
                      {t(`dashboard.nav.${act.key}.desc`)}
                    </p>
                  </div>
                  <ArrowUpRight
                    size={16}
                    className="ml-auto flex-shrink-0 text-theme-muted opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden
                  />
                </Link>
              ))}
            </div>
          </Panel>

          {/* ── AI insight (real /video/clips/style-insight) ───────────── */}
          <Panel variant="bento" className="ds-bento-1x2 ds-anim-rise flex flex-col p-6">
            <SectionHeader
              as="h3"
              title={t('dashboard.insight.title') || 'AI insight'}
              className="mb-4"
            />
            <div className="flex flex-1 flex-col gap-4">
              <div className="ds-surface-subtle p-4">
                <div className="flex items-center gap-2">
                  <Fingerprint size={18} className="text-indigo-500" aria-hidden />
                  <span className="ds-text-label text-theme-primary">
                    {t('dashboard.insight.style') || 'Your style'}
                  </span>
                  {styleInsight && styleInsight.totalPicks > 0 && (
                    <span className="ml-auto rounded-md bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-500">
                      {styleInsight.source === 'user' ? 'Learned' : styleInsight.source === 'team' ? 'Team' : 'Starter'}
                    </span>
                  )}
                </div>
                <p className="ds-text-body mt-2 text-sm text-theme-muted">
                  {(() => {
                    if (!styleInsight || styleInsight.totalPicks === 0) {
                      return t('dashboard.insight.empty') ||
                        'Publish your first few clips and Click will surface your learned style here — top hooks, presets, and best publish hours.'
                    }
                    const top = styleInsight.topPicks || {}
                    const parts: string[] = []
                    if (top.preset) parts.push(`preset ${top.preset}`)
                    if (top.hookStyle) parts.push(`${top.hookStyle} hooks`)
                    if (top.publishHour) parts.push(`best at ${top.publishHour}:00`)
                    if (parts.length === 0) {
                      return styleInsight.hint || 'Click is learning your style — publish more clips to refine.'
                    }
                    return `Across ${styleInsight.totalPicks} clips: ${parts.join(', ')}.`
                  })()}
                </p>
              </div>

              {styleInsight?.topPicks?.publishHour != null && (
                <div className="ds-surface-subtle p-4">
                  <div className="flex items-center gap-2">
                    <Target size={18} className="text-emerald-500" aria-hidden />
                    <span className="ds-text-label text-theme-primary">
                      {t('dashboard.insight.peak') || 'Audience peak'}
                    </span>
                  </div>
                  <p className="ds-text-body mt-2 text-sm text-theme-muted">
                    {`Engagement is strongest around ${styleInsight.topPicks.publishHour}:00.`}
                  </p>
                </div>
              )}

              <Link href="/dashboard/forge" className="mt-auto">
                <Button variant="secondary" size="md" rightIcon={<ArrowRight size={16} aria-hidden />} className="w-full">
                  {styleInsight && styleInsight.totalPicks > 0
                    ? (t('dashboard.insight.cta.forge') || 'Open Forge')
                    : (t('dashboard.insight.cta.start') || 'Start a clip')}
                </Button>
              </Link>
            </div>
          </Panel>

          {/* ── Recent content (real recent_posts) (2x1) ───────────────── */}
          <Panel variant="bento" className="ds-bento-2x1 ds-anim-rise p-6">
            <SectionHeader
              as="h3"
              title={t('dashboard.recent.title') || 'Recent content'}
              actions={
                <Link href="/dashboard/content" className="ds-text-label text-indigo-500 hover:underline inline-flex items-center gap-1">
                  {t('common.viewAll') || 'View all'} <ArrowRight size={14} aria-hidden />
                </Link>
              }
              className="mb-4"
            />
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded-xl bg-theme-muted/10" />
                ))}
              </div>
            ) : recentPosts.length === 0 ? (
              <EmptyState
                icon={Rocket}
                title={t('dashboard.recent.empty.title') || 'No content yet'}
                description={t('dashboard.recent.empty.desc') || 'Forge your first clip and it will show up here.'}
                action={
                  <Link href="/dashboard/forge">
                    <Button variant="primary" size="sm" leftIcon={<Sparkles size={16} aria-hidden />}>
                      {t('dashboard.nav.forge.label') || 'One-Click Forge'}
                    </Button>
                  </Link>
                }
              />
            ) : (
              <ul className="space-y-2">
                {recentPosts.map((post) => {
                  const views = (post.post_analytics ?? []).reduce((s, p) => s + (p.views ?? 0), 0)
                  const published = post.status === 'published'
                  return (
                    <li key={post.id}>
                      <Link
                        href="/dashboard/content"
                        className="ds-surface-subtle ds-hover-lift flex items-center gap-3 p-3"
                      >
                        <span className={cn(
                          'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg',
                          published ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                        )}>
                          <Video size={16} aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="ds-text-label text-theme-primary truncate">
                            {post.title || (t('dashboard.recent.untitled') || 'Untitled')}
                          </p>
                          <p className="ds-text-caption flex items-center gap-2">
                            <span className="capitalize">{post.status || 'draft'}</span>
                            {(post.published_at || post.created_at) && (
                              <>
                                <span aria-hidden>·</span>
                                <Clock size={11} aria-hidden />
                                {timeAgo(post.published_at || post.created_at)}
                              </>
                            )}
                          </p>
                        </div>
                        {views > 0 && (
                          <span className="ds-text-caption flex items-center gap-1 text-theme-muted">
                            <Eye size={12} aria-hidden /> {fmt(views)}
                          </span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>

          {/* ── Connect accounts (real /oauth/connections) ─────────────── */}
          <Panel variant="bento" className="ds-bento-1x2 ds-anim-rise flex flex-col p-6">
            <SectionHeader
              as="h3"
              title={t('dashboard.connect.title') || 'Accounts'}
              className="mb-4"
            />
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-11 animate-pulse rounded-xl bg-theme-muted/10" />
                ))}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {(['tiktok', 'instagram', 'youtube', 'twitter'] as const).map((p) => {
                    const linked = connections[p] === true
                    return (
                      <Link
                        key={p}
                        href="/dashboard/social"
                        className="ds-surface-subtle flex items-center justify-between p-3 transition-colors hover:border-[var(--glass-border-strong)]"
                      >
                        <span className="ds-text-label text-theme-primary capitalize">{p}</span>
                        {linked ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                            {t('dashboard.connect.linked') || 'Linked'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-500">
                            <Link2 size={13} aria-hidden />
                            {t('dashboard.connect.connect') || 'Connect'}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
                {noConnections && (
                  <Link href="/dashboard/social" className="mt-auto pt-4">
                    <Button variant="primary" size="md" className="w-full" rightIcon={<ArrowRight size={16} aria-hidden />}>
                      {t('dashboard.connect.cta') || 'Connect accounts'}
                    </Button>
                  </Link>
                )}
              </>
            )}
          </Panel>

          {/* ── Footer utility tile ────────────────────────────────────── */}
          <Panel variant="bento" className="ds-anim-rise flex items-center justify-between gap-4 p-6">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
                <LayoutGrid size={20} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="ds-text-label text-theme-primary truncate">
                  {t('dashboard.refresh.title') || 'Up to date'}
                </p>
                <p className="ds-text-caption">{t('dashboard.refresh.subtitle') || 'Pull the latest metrics'}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="md"
              onClick={fetchData}
              loading={loading}
              leftIcon={!loading ? <RefreshCw size={16} aria-hidden /> : undefined}
              aria-label={t('common.refresh') || 'Refresh'}
            >
              {t('common.refresh') || 'Refresh'}
            </Button>
          </Panel>

        </div>
      </div>
    </ErrorBoundary>
  )
}
