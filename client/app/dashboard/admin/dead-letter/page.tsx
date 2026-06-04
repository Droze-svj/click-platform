'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { TableSkeleton } from '@/components/LoadingSkeleton'
import ToastContainer from '@/components/ToastContainer'
import { useToast } from '@/contexts/ToastContext'
import { useTranslation } from '@/hooks/useTranslation'
import { Skull, RefreshCw, RotateCw, Trash2, AlertTriangle, ShieldAlert } from 'lucide-react'

const glass = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl'

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
      <div className="min-h-screen bg-[var(--page-bg)] text-[var(--text-main)] px-4 sm:px-6 lg:px-12 pt-8 pb-24 max-w-[1600px] mx-auto">
        <ToastContainer />

        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-8 border-b-2 border-white/5 mb-10">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-[2rem] bg-rose-500/10 border-2 border-rose-500/20 flex items-center justify-center">
              <Skull size={32} className="text-rose-400" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black italic uppercase tracking-tighter leading-none">{t('deadLetterPage.title')}</h1>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-black uppercase tracking-[0.4em] italic mt-2">{t('deadLetterPage.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={queueFilter}
              onChange={(e) => setQueueFilter(e.target.value)}
              title={t('deadLetterPage.filterByQueue')}
              className="px-4 py-3 rounded-xl bg-black/40 border-2 border-white/10 text-[11px] font-black uppercase tracking-widest italic focus:outline-none focus:border-rose-500"
            >
              <option value="all">{t('deadLetterPage.allQueues')}</option>
              {queues.map(q => <option key={q} value={q}>{q}</option>)}
            </select>
            <button type="button" onClick={load} title={t('deadLetterPage.refresh')} className="w-12 h-12 rounded-xl bg-black/40 border-2 border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all active:scale-90">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button type="button" onClick={cleanup} className="px-5 py-3 rounded-xl bg-rose-500/10 border-2 border-rose-500/20 text-rose-300 text-[11px] font-black uppercase tracking-widest italic hover:bg-rose-500/20 transition-all flex items-center gap-2">
              <Trash2 size={16} /> {t('deadLetterPage.cleanup30d')}
            </button>
          </div>
        </header>

        {loading ? (
          <TableSkeleton rows={6} />
        ) : error ? (
          <div className={`${glass} p-16 rounded-[3rem] border-rose-500/20 text-center`}>
            <ShieldAlert size={56} className="text-rose-500 mx-auto mb-6" />
            <p className="text-[13px] font-black uppercase tracking-widest italic text-slate-300">{error}</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className={`${glass} p-20 rounded-[3rem] text-center`}>
            <AlertTriangle size={56} className="text-emerald-500/40 mx-auto mb-6" />
            <p className="text-2xl font-black uppercase tracking-widest italic text-slate-600">{t('deadLetterPage.emptyTitle')}</p>
            <p className="text-[11px] font-black uppercase tracking-[0.3em] italic text-slate-700 mt-3">{t('deadLetterPage.emptySubtitle')}</p>
          </div>
        ) : (
          <div className={`${glass} rounded-[2.5rem] overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b-2 border-white/5 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">
                    <th className="px-6 py-5">{t('deadLetterPage.colQueue')}</th>
                    <th className="px-6 py-5">{t('deadLetterPage.colJob')}</th>
                    <th className="px-6 py-5">{t('deadLetterPage.colReason')}</th>
                    <th className="px-6 py-5 text-center">{t('deadLetterPage.colAttempts')}</th>
                    <th className="px-6 py-5">{t('deadLetterPage.colMoved')}</th>
                    <th className="px-6 py-5 text-right">{t('deadLetterPage.colAction')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {jobs.map(job => (
                    <tr key={job._id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-5"><span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 italic">{job.originalQueueName}</span></td>
                      <td className="px-6 py-5"><span className="text-[12px] font-bold text-white italic">{job.jobName || job.originalJobId}</span></td>
                      <td className="px-6 py-5 max-w-[360px]"><span className="text-[11px] text-rose-300/80 font-mono line-clamp-2">{job.failedReason || '—'}</span></td>
                      <td className="px-6 py-5 text-center"><span className="text-[12px] font-black tabular-nums text-slate-400">{job.attemptsMade ?? '—'}</span></td>
                      <td className="px-6 py-5"><span className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic">{job.movedAt ? new Date(job.movedAt).toLocaleString() : '—'}</span></td>
                      <td className="px-6 py-5 text-right">
                        <button
                          type="button"
                          onClick={() => retry(job)}
                          disabled={busyId === job._id || job.retried}
                          className="px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-black uppercase tracking-widest italic hover:bg-emerald-500/20 transition-all disabled:opacity-40 inline-flex items-center gap-2"
                        >
                          <RotateCw size={14} className={busyId === job._id ? 'animate-spin' : ''} />
                          {job.retried ? t('deadLetterPage.retried') : t('deadLetterPage.retry')}
                        </button>
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
