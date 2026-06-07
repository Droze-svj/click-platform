'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiGet, apiDelete } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'
import { useTranslation } from '@/hooks/useTranslation'
import {
  Plus, Edit3, Trash2, BarChart2, RefreshCw,
  Database, Activity, Target, FileText, Inbox,
  ChevronLeft, ChevronRight, type LucideIcon,
} from 'lucide-react'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { StatsCardSkeleton, ListItemSkeleton } from '../../../components/LoadingSkeleton'
import ToastContainer from '../../../components/ToastContainer'
import { cn } from '../../../lib/utils'
import {
  Panel,
  Button,
  IconButton,
  Badge,
  StatCard,
  EmptyState,
  SectionHeader,
} from '../../../components/ui'

interface Post {
  id: string; title: string; content: string; excerpt: string; slug: string
  status: 'draft' | 'published' | 'scheduled'
  featured_image?: string; thumbnail?: string
  tags: string[]; categories: string[]
  published_at?: string; scheduled_at?: string
  created_at: string; updated_at: string
}

const STATUS_BADGE: Record<Post['status'], string> = {
  published: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  scheduled: 'bg-primary/10 text-primary',
  draft: 'ds-surface-subtle text-theme-muted',
}

export default function PostsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { t } = useTranslation()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [hasMore, setHasMore] = useState(false)
  const PAGE_SIZE = 24

  const loadPosts = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: currentPage.toString(), limit: String(PAGE_SIZE) })
      if (selectedStatus !== 'all') params.append('status', selectedStatus)
      const res = await apiGet<{ posts: Post[]; pagination?: { page: number; limit: number; total: number; pages: number } }>(`/posts?${params}`)
      const results = res.posts || []
      setPosts(results)
      // Drive pagination from the server's real totals when available;
      // otherwise infer "has more" from a full page of results.
      if (res.pagination && typeof res.pagination.total === 'number') {
        setHasMore(currentPage * PAGE_SIZE < res.pagination.total)
      } else {
        setHasMore(results.length === PAGE_SIZE)
      }
    } catch (err: any) { setError(err.message); setHasMore(false) }
    finally { setLoading(false); setRefreshing(false) }
  }, [currentPage, selectedStatus])

  useEffect(() => { loadPosts() }, [loadPosts])

  const handleDelete = async (postId: string) => {
    if (!confirm(t('postsPage.confirmDelete'))) return
    try { await apiDelete(`/posts/${postId}`); loadPosts() }
    catch (err: any) { setError(err.message) }
  }

  const STATUS_LABELS: Record<string, string> = {
    published: t('postsPage.statusPublished'),
    scheduled: t('postsPage.statusScheduled'),
    draft: t('postsPage.statusDraft'),
  }

  if (loading && posts.length === 0) return (
    <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 max-w-[1700px] mx-auto" aria-busy="true" aria-label={t('postsPage.loadingAria')}>
      <div className="ds-bento-grid mb-8">
        {Array.from({ length: 4 }).map((_, i) => <StatsCardSkeleton key={i} />)}
      </div>
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => <ListItemSkeleton key={i} />)}
      </div>
    </div>
  )

  const STATS: { label: string; val: number; icon: LucideIcon }[] = [
    { label: t('postsPage.statTotal'), val: posts.length, icon: Database },
    { label: t('postsPage.statPublished'), val: posts.filter(p => p.status === 'published').length, icon: Activity },
    { label: t('postsPage.statScheduled'), val: posts.filter(p => p.status === 'scheduled').length, icon: Target },
    { label: t('postsPage.statDraft'), val: posts.filter(p => p.status === 'draft').length, icon: FileText },
  ]

  return (
    <ErrorBoundary>
      <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1700px] mx-auto overflow-x-hidden text-theme-primary">
        <ToastContainer />

        {/* Header (global DashboardHeader provides the breadcrumb) */}
        <SectionHeader
          as="h1"
          title={t('postsPage.title')}
          description={t('postsPage.subtitle')}
          className="mb-6"
          actions={
            <>
              <Button
                variant="secondary"
                size="md"
                onClick={() => loadPosts(true)}
                title={t('postsPage.refresh')}
                aria-label={t('postsPage.refresh')}
                leftIcon={<RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} aria-hidden />}
              >
                {t('postsPage.refresh')}
              </Button>
              <Link href="/dashboard/posts/create">
                <Button variant="primary" size="md" leftIcon={<Plus size={16} aria-hidden />}>
                  {t('postsPage.createPost')}
                </Button>
              </Link>
            </>
          }
        />

        {error && (
          <Panel variant="subtle" className="mb-6 border border-rose-500/30 text-rose-600 dark:text-rose-400">
            {error}
          </Panel>
        )}

        {/* Metrics (real counts only — no fabricated deltas) */}
        <div className="ds-bento-grid mb-8">
          {STATS.map((s) => (
            <StatCard key={s.label} label={s.label} value={s.val} icon={s.icon} className="ds-bento-2x1" />
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {['all', 'published', 'scheduled', 'draft'].map(s => (
            <Button
              key={s}
              variant={selectedStatus === s ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => { setCurrentPage(1); setSelectedStatus(s) }}
            >
              {s === 'all' ? t('postsPage.filterAll') : STATUS_LABELS[s]}
            </Button>
          ))}
          <span className="ds-text-caption ml-auto">
            {t('postsPage.trajectoriesOnline', { count: posts.length })}
          </span>
        </div>

        {/* Registry */}
        {posts.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={t('postsPage.emptyTitle')}
            description={t('postsPage.emptyDescription')}
            className="ds-surface-card"
            action={
              <Link href="/dashboard/posts/create">
                <Button variant="primary" size="md" leftIcon={<Plus size={16} aria-hidden />}>
                  {t('postsPage.createPost')}
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="ds-bento-grid">
            {posts.map((post) => {
              const status = post.status || 'draft'
              return (
                <Panel key={post.id} variant="bento" className="ds-bento-2x1 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <Badge className={STATUS_BADGE[status] || STATUS_BADGE.draft}>
                      {STATUS_LABELS[status] || STATUS_LABELS.draft}
                    </Badge>
                    {post.categories?.[0] && (
                      <Badge className="ds-surface-subtle text-theme-muted">{post.categories[0]}</Badge>
                    )}
                  </div>

                  <div className="flex-1 space-y-3">
                    <h3 className="ds-text-h3 text-theme-primary line-clamp-2">{post.title || t('postsPage.untitledPost')}</h3>
                    {post.excerpt && (
                      <p className="ds-text-body text-theme-muted line-clamp-3">{post.excerpt}</p>
                    )}
                    {post.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {post.tags.slice(0, 3).map((tag, i) => (
                          <span key={i} className="ds-text-caption ds-surface-subtle rounded-md px-2 py-0.5">#{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-5 pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3">
                    <span className="ds-text-caption tabular-nums">
                      {status === 'published' && post.published_at
                        ? new Date(post.published_at).toLocaleDateString()
                        : status === 'scheduled' && post.scheduled_at
                          ? new Date(post.scheduled_at).toLocaleDateString()
                          : t('postsPage.noDate')}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <IconButton
                        variant="ghost" size="sm"
                        onClick={() => router.push(`/dashboard/posts/${post.id}/edit`)}
                        title={t('postsPage.editPost')} aria-label={t('postsPage.editPost')}
                      >
                        <Edit3 size={16} aria-hidden />
                      </IconButton>
                      <IconButton
                        variant="ghost" size="sm"
                        onClick={() => router.push('/dashboard/analytics')}
                        title={t('postsPage.viewAnalytics')} aria-label={t('postsPage.viewAnalytics')}
                      >
                        <BarChart2 size={16} aria-hidden />
                      </IconButton>
                      <IconButton
                        variant="ghost" size="sm"
                        onClick={() => handleDelete(post.id)}
                        title={t('postsPage.deletePost')} aria-label={t('postsPage.deletePost')}
                        className="text-rose-500"
                      >
                        <Trash2 size={16} aria-hidden />
                      </IconButton>
                    </div>
                  </div>
                </Panel>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {(currentPage > 1 || hasMore) && (
          <div className="mt-8 flex items-center justify-between gap-4">
            <span className="ds-text-caption">{t('postsPage.pageLabel', { page: currentPage })}</span>
            <div className="flex items-center gap-2">
              <IconButton
                variant="secondary" size="md"
                aria-label={t('postsPage.previousPage')}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={18} aria-hidden />
              </IconButton>
              <IconButton
                variant="secondary" size="md"
                aria-label={t('postsPage.nextPage')}
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={!hasMore}
              >
                <ChevronRight size={18} aria-hidden />
              </IconButton>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}
