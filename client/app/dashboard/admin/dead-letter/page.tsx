'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { TableSkeleton } from '@/components/LoadingSkeleton'
import ToastContainer from '@/components/ToastContainer'
import { useToast } from '@/contexts/ToastContext'
import { useTranslation } from '@/hooks/useTranslation'
import { Skull, RefreshCw, RotateCw, Trash2, ShieldAlert, Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { SectionHeader } from '@/components/ui/section-header'

interface DeadLetterJob {
  _id: string
  originalQueueName: string
  originalJobId: string
  jobName?: string
  failedReason?: string
  attemptsMade?: number
  movedAt?: string
  retried?: boolean
}

export default function DeadLetterQueuePage() {
  const { showToast } = useToast()
  const { t } = useTranslation()
  const [jobs, setJobs] = useState<DeadLetterJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [queueFilter, setQueueFilter] = useState<string>('all')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = queueFilter !== 'all' ? `?queueName=${encodeURIComponent(queueFilter)}` : ''
      const res: any = await apiGet(`/jobs/dead-letter${qs}`, undefined, false)
      setJobs(Array.isArray(res?.data?.jobs) ? res.data.jobs : [])
    } catch (err: any) {
      setError(err?.response?.status === 403 ? t('deadLetterPage.adminAccessRequired') : (err?.message || t('deadLetterPage.failedToLoad')))
    } finally {
      setLoading(false)
    }
  }, [queueFilter])

  useEffect(() => { load() }, [load])

  const queues = Array.from(new Set(jobs.map(j => j.originalQueueName).filter(Boolean)))

  const retry = async (job: DeadLetterJob) => {
    setBusyId(job._id)
    try {
      await apiPost(`/jobs/dead-letter/${job._id}/retry`, { queueName: job.originalQueueName })
      showToast(t('deadLetterPage.requeued', { job: job.jobName || job.originalJobId }), 'success')
      await load()
    } catch (err: any) {
      showToast(t('deadLetterPage.retryFailed', { error: err?.message || 'error' }), 'error')
    } finally {
      setBusyId(null)
    }
  }

  const cleanup = async () => {
    if (!confirm(t('deadLetterPage.cleanupConfirm'))) return
    try {
      const res: any = await apiPost('/jobs/dead-letter/cleanup', { olderThanDays: 30 })
      showToast(t('deadLetterPage.cleanedUp', { count: res?.data?.deleted ?? 0 }), 'success')
      await load()
    } catch (err: any) {
      showToast(t('deadLetterPage.cleanupFailed', { error: err?.message || 'error' }), 'error')
    }
  }

  return (
    <ErrorBoundary>
      <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1600px] mx-auto text-theme-primary">
        <ToastContainer />

        <SectionHeader
          as="h1"
          title={
            <span className="inline-flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
                <Skull size={20} aria-hidden />
              </span>
              {t('deadLetterPage.title')}
            </span>
          }
          description={t('deadLetterPage.subtitle')}
          className="mb-6"
          actions={
            <>
              <label className="sr-only" htmlFor="dlq-queue">{t('deadLetterPage.filterByQueue')}</label>
              <select
                id="dlq-queue"
                value={queueFilter}
                onChange={(e) => setQueueFilter(e.target.value)}
                title={t('deadLetterPage.filterByQueue')}
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="all">{t('deadLetterPage.allQueues')}</option>
                {queues.map(q => <option key={q} value={q}>{q}</option>)}
              </select>
              <Button variant="secondary" size="md" onClick={load} title={t('deadLetterPage.refresh')} aria-label={t('deadLetterPage.refresh')}>
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden />
              </Button>
              <Button variant="destructive" size="md" onClick={cleanup} leftIcon={<Trash2 size={16} aria-hidden />}>
                {t('deadLetterPage.cleanup30d')}
              </Button>
            </>
          }
        />

        {loading ? (
          <TableSkeleton rows={6} />
        ) : error ? (
          <div className="ds-surface-card p-6">
            <EmptyState icon={ShieldAlert} title={error} />
          </div>
        ) : jobs.length === 0 ? (
          <div className="ds-surface-card p-6">
            <EmptyState
              icon={Inbox}
              title={t('deadLetterPage.emptyTitle')}
              description={t('deadLetterPage.emptySubtitle')}
            />
          </div>
        ) : (
          <div className="ds-surface-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] ds-text-label text-theme-muted">
                    <th className="px-5 py-3 font-medium">{t('deadLetterPage.colQueue')}</th>
                    <th className="px-5 py-3 font-medium">{t('deadLetterPage.colJob')}</th>
                    <th className="px-5 py-3 font-medium">{t('deadLetterPage.colReason')}</th>
                    <th className="px-5 py-3 font-medium text-center">{t('deadLetterPage.colAttempts')}</th>
                    <th className="px-5 py-3 font-medium">{t('deadLetterPage.colMoved')}</th>
                    <th className="px-5 py-3 font-medium text-right">{t('deadLetterPage.colAction')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {jobs.map(job => (
                    <tr key={job._id} className="hover:bg-accent/40 transition-colors">
                      <td className="px-5 py-4"><span className="text-xs font-medium text-primary">{job.originalQueueName}</span></td>
                      <td className="px-5 py-4"><span className="text-sm font-medium text-theme-primary">{job.jobName || job.originalJobId}</span></td>
                      <td className="px-5 py-4 max-w-[360px]"><span className="text-xs text-rose-500/90 font-mono line-clamp-2">{job.failedReason || '—'}</span></td>
                      <td className="px-5 py-4 text-center"><span className="text-sm tabular-nums text-theme-secondary">{job.attemptsMade ?? '—'}</span></td>
                      <td className="px-5 py-4"><span className="text-xs text-theme-muted">{job.movedAt ? new Date(job.movedAt).toLocaleString() : '—'}</span></td>
                      <td className="px-5 py-4 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => retry(job)}
                          disabled={busyId === job._id || job.retried}
                          loading={busyId === job._id}
                          leftIcon={busyId !== job._id ? <RotateCw size={14} aria-hidden /> : undefined}
                        >
                          {job.retried ? t('deadLetterPage.retried') : t('deadLetterPage.retry')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}
