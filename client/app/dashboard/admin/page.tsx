'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useTranslation } from '@/hooks/useTranslation'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import ToastContainer from '@/components/ToastContainer'
import {
  Users,
  FileText,
  BarChart3,
  Shield,
  UserCheck,
  RefreshCw,
  ShieldAlert,
  Database,
  Orbit,
  Activity,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/ui/stat-card'
import { EmptyState } from '@/components/ui/empty-state'
import { SectionHeader } from '@/components/ui/section-header'
import { cn } from '@/lib/utils'

interface AdminOverview {
  users: { total: number; verified: number; unverified: number }
  posts: { total: number; published: number; drafts: number }
  social: { connected_accounts: number }
}

interface RecentUser {
  id: string
  email: string
  first_name: string
  last_name: string
  created_at: string
}

interface RecentPost {
  id: string
  title: string
  status: string
  author_id: string
  created_at: string
  users: { email: string }
}

interface SystemHealth {
  database: string
  api: string
  uptime: number
  memory: any
}

interface DashboardData {
  overview: AdminOverview
  recent_activity: { users: RecentUser[]; posts: RecentPost[] }
  system_health: SystemHealth
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiGet<DashboardData>('/admin/dashboard')
      setData(response)
    } catch (err: any) {
      console.error('Failed to load admin dashboard:', err)
      setError(err.message || t('adminPage.failedToLoad'))
    } finally {
      setLoading(false)
    }
  }

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  const formatMemory = (bytes: number) => `${Math.round(bytes / 1024 / 1024)}MB`

  if (loading) return (
    <div className="ds-bg-mesh-soft min-h-screen flex flex-col items-center justify-center py-48" aria-busy="true">
      <Shield size={40} className="text-theme-muted animate-pulse mb-4" aria-hidden />
      <span className="ds-text-caption">{t('adminPage.loading')}</span>
    </div>
  )

  if (error || !data) return (
    <div className="ds-bg-mesh-soft min-h-screen flex items-center justify-center p-6">
      <div className="ds-surface-card p-8 max-w-lg w-full">
        <EmptyState
          icon={ShieldAlert}
          title={t('adminPage.errorTitle')}
          description={error || t('adminPage.unauthorized')}
          action={
            <Button variant="primary" leftIcon={<RefreshCw size={16} aria-hidden />} onClick={loadDashboard}>
              {t('adminPage.retrySync')}
            </Button>
          }
        />
      </div>
    </div>
  )

  const isHealthy = data.system_health.database === 'healthy'
  const memUsed = data.system_health.memory?.heapUsed ?? 0
  const memTotal = data.system_health.memory?.heapTotal ?? 0
  const memPct = memTotal > 0 ? Math.min(100, (memUsed / memTotal) * 100) : 0

  return (
    <ErrorBoundary>
      <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1700px] mx-auto text-theme-primary space-y-8">
        <ToastContainer />

        <SectionHeader
          as="h1"
          title={
            <span className="inline-flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Shield size={20} aria-hidden />
              </span>
              {t('adminPage.title')}
            </span>
          }
          description={t('adminPage.subtitle')}
          actions={
            <Button variant="secondary" size="md" onClick={loadDashboard} leftIcon={<RefreshCw size={16} aria-hidden />}>
              {t('adminPage.refreshLattice')}
            </Button>
          }
        />

        {/* Real overview metrics from /admin/dashboard */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Users}
            label={t('adminPage.nodeOperatives')}
            value={data.overview.users.total}
            delta={t('adminPage.verifiedCount', { count: data.overview.users.verified })}
            direction="neutral"
          />
          <StatCard
            icon={FileText}
            label={t('adminPage.contentPayloads')}
            value={data.overview.posts.total}
            delta={t('adminPage.publishedCount', { count: data.overview.posts.published })}
            direction="neutral"
          />
          <StatCard
            icon={Orbit}
            label={t('adminPage.neuralSyncNodes')}
            value={data.overview.social.connected_accounts}
            delta={t('adminPage.latticeActive')}
            direction="neutral"
          />
          <StatCard
            icon={Activity}
            label={t('adminPage.latticeVitality')}
            value={isHealthy ? t('adminPage.optimal') : t('adminPage.anomaly')}
            delta={t('adminPage.uptimeTrend', { uptime: formatUptime(data.system_health.uptime) })}
            direction={isHealthy ? 'up' : 'down'}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent activity */}
          <div className="lg:col-span-2 space-y-6">
            <div className="ds-surface-card p-5 sm:p-6">
              <SectionHeader as="h3" title={t('adminPage.resonanceFeed')} className="mb-5" />

              <div className="space-y-6">
                <div>
                  <p className="ds-text-label text-theme-muted mb-3">{t('adminPage.newOperativeSignatures')}</p>
                  <div className="space-y-2">
                    {data.recent_activity.users.slice(0, 4).map((u) => (
                      <div key={u.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] p-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary inline-flex items-center justify-center shrink-0">
                            <UserCheck size={16} aria-hidden />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-theme-primary truncate">{u.first_name} {u.last_name}</p>
                            <p className="ds-text-caption truncate">{u.email}</p>
                          </div>
                        </div>
                        <span className="ds-text-caption shrink-0">{new Date(u.created_at).toLocaleTimeString()}</span>
                      </div>
                    ))}
                    {data.recent_activity.users.length === 0 && (
                      <p className="ds-text-caption px-1 py-2">—</p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="ds-text-label text-theme-muted mb-3">{t('adminPage.pendingContentPayloads')}</p>
                  <div className="space-y-2">
                    {data.recent_activity.posts.slice(0, 4).map((post) => (
                      <div key={post.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] p-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary inline-flex items-center justify-center shrink-0">
                            <FileText size={16} aria-hidden />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-theme-primary truncate">{post.title || t('adminPage.nullTitle')}</p>
                            <p className="ds-text-caption truncate">{post.users.email}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={cn(
                            'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium',
                            post.status === 'published'
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : 'bg-amber-500/10 text-amber-500'
                          )}>
                            {t(`adminPage.status_${post.status}`)}
                          </span>
                          <p className="ds-text-caption mt-1">{new Date(post.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                    {data.recent_activity.posts.length === 0 && (
                      <p className="ds-text-caption px-1 py-2">—</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* System health (real) + quick commands */}
          <div className="space-y-6">
            <div className="ds-surface-card p-5 sm:p-6">
              <SectionHeader as="h3" title={t('adminPage.coreVitality')} className="mb-5" />
              <div className="space-y-3">
                <HealthRow label={t('adminPage.coreLedger')} status={data.system_health.database} />
                <HealthRow label={t('adminPage.uplinkApi')} status={data.system_health.api} />

                <div className="pt-3 border-t border-[var(--border-subtle)]">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-theme-secondary">{t('adminPage.cognitiveBuffer')}</span>
                    <span className="text-sm font-mono text-theme-primary tabular-nums">
                      {formatMemory(memUsed)} / {formatMemory(memTotal)}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-accent rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${memPct}%` }} />
                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-[var(--border-subtle)]">
                  <span className="text-sm text-theme-secondary">{t('adminPage.totalUptime')}</span>
                  <span className="text-sm font-medium text-theme-primary">{formatUptime(data.system_health.uptime)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="ds-text-label text-theme-muted px-1">{t('adminPage.quickOversightCommands')}</p>
              <CommandButton icon={Users} label={t('adminPage.cmdManageOperatives')} desc={t('adminPage.cmdManageOperativesDesc')} onClick={() => router.push('/dashboard/admin/users')} />
              <CommandButton icon={FileText} label={t('adminPage.cmdModeratePayloads')} desc={t('adminPage.cmdModeratePayloadsDesc')} onClick={() => router.push('/dashboard/admin/posts')} />
              <CommandButton icon={BarChart3} label={t('adminPage.cmdGlobalAnalytics')} desc={t('adminPage.cmdGlobalAnalyticsDesc')} onClick={() => router.push('/dashboard/admin/analytics')} />
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}

function HealthRow({ label, status }: { label: string; status: string }) {
  const isHealthy = status === 'healthy' || status === 'up' || status === 'ok'
  return (
    <div className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] p-3">
      <span className="text-sm text-theme-primary">{label}</span>
      <div className="flex items-center gap-2">
        <span className={cn('h-2 w-2 rounded-full', isHealthy ? 'bg-emerald-500' : 'bg-rose-500')} />
        <span className={cn('text-xs font-medium', isHealthy ? 'text-emerald-500' : 'text-rose-500')}>{status}</span>
      </div>
    </div>
  )
}

function CommandButton({ icon: Icon, label, desc, onClick }: { icon: any; label: string; desc: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ds-surface-card ds-hover-lift w-full p-4 text-left flex items-center gap-4"
    >
      <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary inline-flex items-center justify-center shrink-0">
        <Icon size={18} aria-hidden />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-theme-primary">{label}</p>
        <p className="ds-text-caption truncate">{desc}</p>
      </div>
      <ChevronRight size={16} className="text-theme-muted shrink-0" aria-hidden />
    </button>
  )
}
