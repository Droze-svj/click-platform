'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import ToastContainer from '../../../components/ToastContainer'
import JobDetailsModal from '../../../components/JobDetailsModal'
import {
  Search, RefreshCw, Activity, Zap, Timer, X, Eye,
  Archive, Layers, ShieldCheck, ShieldAlert, Inbox,
} from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth'
import { useTranslation } from '@/hooks/useTranslation'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { API_URL } from '../../../lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/form-field'
import { StatCard } from '@/components/ui/stat-card'
import { EmptyState } from '@/components/ui/empty-state'
import { SectionHeader } from '@/components/ui/section-header'
import { cn } from '@/lib/utils'

interface Job {
  id: string; name: string; state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  progress: number; attemptsMade: number; failedReason?: string;
  processedOn?: Date; finishedOn?: Date; createdAt: Date; queue?: string;
}

interface QueueStats {
  waiting: number; active: number; completed: number; failed: number; delayed: number; total: number;
}

interface QueueMetrics {
  total: number; successful: number; failed: number; averageDuration: number;
  averageMemory: number; totalCost: number; totalRetries: number;
}

export default function JobsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [userJobs, setUserJobs] = useState<{ active: Job[]; completed: Job[]; failed: Job[] }>({ active: [], completed: [], failed: [] })
  const [, setQueueStats] = useState<Record<string, QueueStats>>({})
  const [userMetrics, setUserMetrics] = useState<QueueMetrics | null>(null)
  const [timeRange, setTimeRange] = useState('24h')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedJob, setSelectedJob] = useState<{ id: string; queue: string } | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadLattice = useCallback(async () => {
    setRefreshing(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) return router.push('/login')
      const headers = { Authorization: `Bearer ${token}` }

      const [jobsRes, metricsRes] = await Promise.all([
        axios.get(`${API_URL}/jobs/user`, { headers }),
        axios.get(`${API_URL}/jobs/metrics/user?timeRange=${timeRange}`, { headers }).catch(() => ({ data: { data: null } }))
      ])

      const jobsData = jobsRes.data.data || { active: [], completed: [], failed: [] }
      setUserJobs(jobsData)
      setUserMetrics(metricsRes.data.data)

      const isAdmin = !!user && (((user as any).role === 'admin') || !!(user as any).isAdmin)
      if (isAdmin) {
        const statsRes = await axios.get(`${API_URL}/jobs/dashboard/stats`, { headers }).catch(() => ({ data: { data: {} } }))
        setQueueStats(statsRes.data.data || {})
      }
    } catch {
      // best effort — keep existing state
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user, router, timeRange])

  useEffect(() => {
    loadLattice()
    if (autoRefresh) {
      const interval = setInterval(loadLattice, 10000)
      return () => clearInterval(interval)
    }
  }, [loadLattice, autoRefresh])

  const handleCancel = async (id: string) => {
    if (!confirm(t('jobsPage.cancelConfirm'))) return
    try {
      await axios.post(`${API_URL}/jobs/user/${id}/cancel`, {})
      loadLattice()
    } catch {
      // best effort
    }
  }

  if (loading) return (
    <div className="ds-bg-mesh-soft min-h-screen flex flex-col items-center justify-center py-48" aria-busy="true">
      <Activity size={40} className="text-theme-muted animate-pulse mb-4" aria-hidden />
      <span className="ds-text-caption">{t('jobsPage.loading')}</span>
    </div>
  )

  const filterJobs = (list: Job[]) =>
    list.filter(j => searchQuery === '' || j.name.toLowerCase().includes(searchQuery.toLowerCase()))

  return (
    <ErrorBoundary>
      <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1750px] mx-auto text-theme-primary space-y-6">
        <ToastContainer />

        <SectionHeader
          as="h1"
          title={
            <span className="inline-flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Activity size={20} aria-hidden />
              </span>
              {t('jobsPage.title')}
            </span>
          }
          description={t('jobsPage.subtitle')}
          actions={
            <>
              <Button variant="secondary" size="md" onClick={loadLattice} title={t('jobsPage.refreshQueue')} aria-label={t('jobsPage.refreshQueue')}>
                <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} aria-hidden />
              </Button>
              <Button
                variant={autoRefresh ? 'primary' : 'secondary'}
                size="md"
                onClick={() => setAutoRefresh(!autoRefresh)}
                leftIcon={<Timer size={16} aria-hidden />}
              >
                {autoRefresh ? t('jobsPage.liveStream') : t('jobsPage.staticMode')}
              </Button>
            </>
          }
        />

        {/* Real metrics from /jobs/metrics/user */}
        {userMetrics && (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Layers} label={t('jobsPage.metricAccumulatedCycles')} value={userMetrics.total} delta={t('jobsPage.metricAccumulatedCyclesSub')} direction="neutral" />
            <StatCard icon={ShieldCheck} label={t('jobsPage.metricSuccessResonance')} value={`${((userMetrics.successful / Math.max(userMetrics.total, 1)) * 100).toFixed(1)}%`} delta={t('jobsPage.metricSuccessResonanceSub')} direction="up" />
            <StatCard icon={ShieldAlert} label={t('jobsPage.metricFluxDiffractions')} value={userMetrics.failed} delta={t('jobsPage.metricFluxDiffractionsSub')} direction={userMetrics.failed > 0 ? 'down' : 'neutral'} />
            <StatCard icon={Zap} label={t('jobsPage.metricCumulativeCompute')} value={`$${userMetrics.totalCost.toFixed(4)}`} delta={t('jobsPage.metricCumulativeComputeSub')} direction="neutral" />
          </section>
        )}

        {/* Filters */}
        <div className="ds-surface-card p-4 flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" aria-hidden />
            <Input type="text" placeholder={t('jobsPage.searchPlaceholder')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" aria-label={t('jobsPage.searchPlaceholder')} />
          </div>
          <div className="flex items-center gap-1 p-1 rounded-lg ds-surface-subtle shrink-0">
            {['1h', '24h', '7d', '30d'].map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setTimeRange(r)}
                className={cn(
                  'rounded-md px-3 h-8 text-xs font-medium transition-colors',
                  timeRange === r ? 'bg-primary text-primary-foreground' : 'text-theme-secondary hover:text-theme-primary'
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <main className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-7 space-y-6">
            <div className="space-y-3">
              <SectionHeader as="h3" title={t('jobsPage.sectionActiveTitle')} description={t('jobsPage.sectionActiveSub')} />
              <div className="space-y-3">
                {filterJobs(userJobs.active).length === 0 ? (
                  <div className="ds-surface-card p-4"><EmptyState icon={Inbox} title={t('jobsPage.emptyActive')} /></div>
                ) : (
                  filterJobs(userJobs.active).map(j => (
                    <FluxCard key={j.id} job={j} onCancel={handleCancel} onView={() => setSelectedJob({ id: j.id, queue: j.queue || 'unknown' })} />
                  ))
                )}
              </div>
            </div>

            <div className="space-y-3">
              <SectionHeader as="h3" title={t('jobsPage.sectionArchiveTitle')} description={t('jobsPage.sectionArchiveSub')} />
              <div className="space-y-3">
                {filterJobs(userJobs.completed).length === 0 ? (
                  <div className="ds-surface-card p-4"><EmptyState icon={Archive} title={t('jobsPage.emptyArchive')} /></div>
                ) : (
                  filterJobs(userJobs.completed).slice(0, 15).map(j => (
                    <FluxCard key={j.id} job={j} onCancel={handleCancel} onView={() => setSelectedJob({ id: j.id, queue: j.queue || 'unknown' })} />
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="xl:col-span-5 space-y-3">
            <SectionHeader as="h3" title={t('jobsPage.sectionFailedTitle')} description={t('jobsPage.sectionFailedSub')} />
            <div className="space-y-3">
              {filterJobs(userJobs.failed).length === 0 ? (
                <div className="ds-surface-card p-4"><EmptyState icon={ShieldCheck} title={t('jobsPage.emptyFailed')} /></div>
              ) : (
                filterJobs(userJobs.failed).map(j => (
                  <FluxCard key={j.id} job={j} onCancel={handleCancel} onView={() => setSelectedJob({ id: j.id, queue: j.queue || 'unknown' })} isDiffracted />
                ))
              )}
            </div>
          </div>
        </main>

        {selectedJob && (
          <JobDetailsModal
            jobId={selectedJob.id}
            queueName={selectedJob.queue}
            isOpen={!!selectedJob}
            onClose={() => setSelectedJob(null)}
            onRefresh={loadLattice}
          />
        )}
      </div>
    </ErrorBoundary>
  )
}

function FluxCard({ job, onCancel, onView, isDiffracted }: { job: Job; onCancel: (id: string) => void; onView: () => void; isDiffracted?: boolean }) {
  const { t } = useTranslation()
  void isDiffracted
  const statusStyle = (state: string) => {
    switch (state) {
      case 'completed': return 'bg-emerald-500/10 text-emerald-500'
      case 'active': return 'bg-blue-500/10 text-blue-500'
      case 'failed': return 'bg-rose-500/10 text-rose-500'
      case 'delayed': return 'bg-amber-500/10 text-amber-500'
      default: return 'bg-accent text-theme-secondary'
    }
  }

  return (
    <div className="ds-surface-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0', statusStyle(job.state))}>
            {t(`jobsPage.state_${job.state}`)}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-theme-primary truncate">{job.name}</h3>
            <span className="ds-text-caption font-mono">{t('jobsPage.cycleHid', { hid: job.id.substring(0, 12) })}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {job.queue && <span className="hidden sm:inline rounded-md bg-accent px-2 py-0.5 text-xs text-theme-muted">{t('jobsPage.latticeQueue', { queue: job.queue })}</span>}
          <Button variant="ghost" size="sm" onClick={onView} title={t('jobsPage.viewJobDetails')} aria-label={t('jobsPage.viewJobDetails')}>
            <Eye size={16} aria-hidden />
          </Button>
          {(job.state === 'active' || job.state === 'waiting' || job.state === 'delayed') && (
            <Button variant="ghost" size="sm" onClick={() => onCancel(job.id)} title={t('jobsPage.cancelJob')} aria-label={t('jobsPage.cancelJob')} className="text-rose-500 hover:text-rose-600">
              <X size={16} aria-hidden />
            </Button>
          )}
        </div>
      </div>

      {job.state === 'active' && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-theme-secondary mb-1.5">
            <span>{t('jobsPage.synchronizingBuffer')}</span>
            <span className="tabular-nums">{job.progress}%</span>
          </div>
          <div className="w-full h-2 bg-accent rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${job.progress}%` }} />
          </div>
        </div>
      )}

      {job.failedReason && (
        <div className="mb-3 rounded-xl bg-rose-500/5 border border-rose-500/20 p-3 flex items-start gap-2">
          <ShieldAlert size={16} className="text-rose-500 shrink-0 mt-0.5" aria-hidden />
          <div className="min-w-0">
            <p className="text-xs font-medium text-rose-500">{t('jobsPage.anomalyIntercepted')}</p>
            <p className="text-sm text-theme-secondary break-words">{job.failedReason}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--border-subtle)]">
        <div className="flex items-center gap-2 text-theme-muted min-w-0">
          <Timer size={14} aria-hidden />
          <span className="ds-text-caption truncate">{new Date(job.createdAt).toLocaleString()}</span>
        </div>
        {job.attemptsMade > 1 && (
          <span className="inline-flex items-center gap-1 text-xs text-amber-500 shrink-0">
            <RefreshCw size={12} aria-hidden /> {t('jobsPage.retryThreshold', { attempts: job.attemptsMade })}
          </span>
        )}
      </div>
    </div>
  )
}
