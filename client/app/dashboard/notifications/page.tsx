'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet, apiPut, apiDelete } from '../../../lib/api'
import ToastContainer from '../../../components/ToastContainer'
import NotificationPreferences from '../../../components/NotificationPreferences'
import { useToast } from '../../../contexts/ToastContext'
import { useAuth } from '../../../hooks/useAuth'
import { useTranslation } from '../../../hooks/useTranslation'
import { useSocket } from '../../../hooks/useSocket'
import {
  Search, CheckCircle2, Trash2, Zap, Sliders, Eye, X,
  AlertTriangle, Bell, RefreshCw, Cpu, Compass,
  ArrowRight, Signal, ShieldCheck, ShieldAlert, Timer,
} from 'lucide-react'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/form-field'
import { EmptyState } from '@/components/ui/empty-state'
import { SectionHeader } from '@/components/ui/section-header'
import { cn } from '@/lib/utils'

interface Notification {
  _id: string; type: 'info' | 'success' | 'warning' | 'error';
  title: string; message?: string; read: boolean; createdAt: string;
  link?: string | null; category?: string | null; aiSummary?: string | null; suggestion?: string | null;
}

interface LiveStatusItem {
  id: string; title: string; status: string; dueDate?: string | null; type: string;
}

interface LiveStatusJob {
  id: string; title: string; status: string; type: 'job'; queue?: string;
}

interface LiveStatusState {
  tasks: LiveStatusItem[]; jobs: LiveStatusJob[]; lastUpdated?: string | null;
}

const CATEGORIES = ['TASK_OPS', 'PROJECT_VINE', 'CONTENT_FORGE', 'APPROVAL_NODE', 'MENTION_SIGNAL', 'SYSTEM_CORE', 'WORKFLOW_LATTICE'] as const

export default function NotificationsPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const { user } = useAuth()
  const { socket } = useSocket(user?.id ?? null)
  const { showToast } = useToast()
  void showToast

  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [category, setCategory] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showPreferences, setShowPreferences] = useState(false)
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set())
  const [liveStatus, setLiveStatus] = useState<LiveStatusState>({ tasks: [], jobs: [], lastUpdated: null })
  const [refreshing, setRefreshing] = useState(false)
  const [busy, setBusy] = useState(false)

  const loadSignals = useCallback(async () => {
    setRefreshing(true)
    try {
      const u = filter === 'unread' ? '&unread=true' : filter === 'read' ? '&read=true' : ''
      const c = category ? `&category=${category}` : ''
      const res: any = await apiGet(`/notifications?limit=100${u}${c}`)
      const data = res?.data || res
      setNotifications(Array.isArray(data?.notifications) ? data.notifications : [])
      setUnreadCount(data?.unreadCount || 0)
    } catch {
      setNotifications([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [filter, category])

  const loadLiveStatus = useCallback(async () => {
    try {
      const res: any = await apiGet('/notifications/live-status')
      const data = res?.data || res
      setLiveStatus({
        tasks: data?.tasks || [],
        jobs: data?.jobs || [],
        lastUpdated: data?.lastUpdated || null
      })
    } catch {
      setLiveStatus({ tasks: [], jobs: [], lastUpdated: null })
    }
  }, [])

  useEffect(() => {
    if (!user) { router.push('/login'); return }
    loadSignals()
    loadLiveStatus()
  }, [user, loadSignals, loadLiveStatus, router])

  useEffect(() => {
    if (socket) {
      socket.on('notification', () => loadSignals())
      socket.on('live_status:update', () => loadLiveStatus())
      return () => {
        socket.off('notification')
        socket.off('live_status:update')
      }
    }
  }, [socket, loadSignals, loadLiveStatus])

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success': return <ShieldCheck className="text-emerald-500" size={18} aria-hidden />
      case 'warning': return <AlertTriangle className="text-amber-500" size={18} aria-hidden />
      case 'error': return <ShieldAlert className="text-rose-500" size={18} aria-hidden />
      default: return <Signal className="text-primary" size={18} aria-hidden />
    }
  }

  const filteredNotifications = notifications.filter(n => {
    const s = searchQuery === '' || n.title.toLowerCase().includes(searchQuery.toLowerCase()) || (n.message && n.message.toLowerCase().includes(searchQuery.toLowerCase()))
    return s
  })

  const selectClass = 'h-10 rounded-lg border border-input bg-background px-3 text-sm text-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

  if (loading) return (
    <div className="ds-bg-mesh-soft min-h-screen flex flex-col items-center justify-center py-48" aria-busy="true">
      <Bell size={40} className="text-theme-muted animate-pulse mb-4" aria-hidden />
      <span className="ds-text-caption">{t('notificationsPage.decodingSignalSpectrum')}</span>
    </div>
  )

  return (
    <ErrorBoundary>
      <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1750px] mx-auto text-theme-primary space-y-6">
        <ToastContainer />

        <SectionHeader
          as="h1"
          title={
            <span className="inline-flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Bell size={20} aria-hidden />
              </span>
              {t('notificationsPage.title')}
              {unreadCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium">
                  {t('notificationsPage.activeSignalsDetected', { count: unreadCount })}
                </span>
              )}
            </span>
          }
          description={t('notificationsPage.subtitle')}
          actions={
            <>
              <Button variant="secondary" size="md" onClick={loadSignals} title={t('notificationsPage.refreshSignals')} aria-label={t('notificationsPage.refreshSignals')}>
                <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} aria-hidden />
              </Button>
              <Button
                variant={showPreferences ? 'primary' : 'secondary'}
                size="md"
                onClick={() => setShowPreferences(!showPreferences)}
                leftIcon={<Sliders size={16} aria-hidden />}
              >
                {t('notificationsPage.sensorFusionCalibration')}
              </Button>
            </>
          }
        />

        {/* Live status (real data from /notifications/live-status) */}
        {(liveStatus.tasks.length > 0 || liveStatus.jobs.length > 0) && (
          <section className="ds-surface-card p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="ds-text-h3 text-theme-primary">{t('notificationsPage.missionTelemetry')}</h2>
              {liveStatus.lastUpdated && (
                <span className="ds-text-caption">{t('notificationsPage.lastSignalBurst', { time: new Date(liveStatus.lastUpdated).toLocaleTimeString() })}</span>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <p className="ds-text-label text-theme-muted">{t('notificationsPage.activeOperationsResonance')}</p>
                <div className="space-y-2">
                  {liveStatus.tasks.length === 0 ? (
                    <p className="ds-text-caption">{t('notificationsPage.noKineticTrajectories')}</p>
                  ) : liveStatus.tasks.map(task => (
                    <div key={task.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] p-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Zap size={16} className="text-amber-500 shrink-0" aria-hidden />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-theme-primary truncate">{task.title}</p>
                          <p className="ds-text-caption">{t('notificationsPage.taskStatusDirective', { status: task.status })}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/tasks?open=${task.id}`)} title={t('notificationsPage.viewTask', { title: task.title })} aria-label={t('notificationsPage.viewTask', { title: task.title })}>
                        <Eye size={16} aria-hidden />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <p className="ds-text-label text-theme-muted">{t('notificationsPage.backgroundAsyncCycles')}</p>
                <div className="space-y-2">
                  {liveStatus.jobs.length === 0 ? (
                    <p className="ds-text-caption">{t('notificationsPage.asyncLatticeQuiescent')}</p>
                  ) : liveStatus.jobs.map(j => (
                    <div key={j.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] p-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <RefreshCw size={16} className="text-primary shrink-0" aria-hidden />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-theme-primary truncate">{j.title}</p>
                          <p className="ds-text-caption">{t('notificationsPage.jobStatusQueue', { status: j.status, queue: j.queue ?? '' })}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/jobs')} title={t('notificationsPage.viewJob', { title: j.title })} aria-label={t('notificationsPage.viewJob', { title: j.title })}>
                        <Cpu size={16} aria-hidden />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Preferences */}
        {showPreferences && (
          <section className="ds-surface-card p-5 ds-anim-fade-in">
            <NotificationPreferences onUpdate={loadSignals} />
          </section>
        )}

        {/* Feed */}
        <section className="ds-surface-card p-4 sm:p-5">
          <header className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 mb-5">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" aria-hidden />
              <Input
                type="text"
                aria-label={t('notificationsPage.scanMatrixAria')}
                placeholder={t('notificationsPage.scanMatrixPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 p-1 rounded-lg ds-surface-subtle">
                {(['all', 'unread', 'read'] as const).map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={cn(
                      'rounded-md px-3 h-8 text-xs font-medium transition-colors',
                      filter === f ? 'bg-primary text-primary-foreground' : 'text-theme-secondary hover:text-theme-primary'
                    )}
                  >
                    {t(`notificationsPage.filter_${f}`)}
                  </button>
                ))}
              </div>
              <select aria-label={t('notificationsPage.signalSectorCategory')} value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
                <option value="">{t('notificationsPage.allSignalSectors')}</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </header>

          {/* Bulk actions */}
          {selectedNotifications.size > 0 && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 mb-4">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground">{selectedNotifications.size}</span>
                <p className="text-sm text-theme-secondary truncate">{t('notificationsPage.burstsBuffered')}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="primary" size="sm" loading={busy}
                  leftIcon={!busy ? <CheckCircle2 size={16} aria-hidden /> : undefined}
                  onClick={async () => { if (busy) return; setBusy(true); try { await Promise.all(Array.from(selectedNotifications).map(id => apiPut(`/notifications/${id}/read`, {}).catch(() => null))); await loadSignals(); setSelectedNotifications(new Set()) } finally { setBusy(false) } }}
                >
                  {t('notificationsPage.synchronizeSignals')}
                </Button>
                <Button
                  variant="destructive" size="sm" loading={busy}
                  leftIcon={!busy ? <Trash2 size={16} aria-hidden /> : undefined}
                  onClick={async () => { if (busy) return; if (!confirm(t('notificationsPage.confirmPurgeSelected'))) return; setBusy(true); try { await Promise.all(Array.from(selectedNotifications).map(id => apiDelete(`/notifications/${id}`).catch(() => null))); await loadSignals(); setSelectedNotifications(new Set()) } finally { setBusy(false) } }}
                >
                  {t('notificationsPage.purgeLedgerData')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedNotifications(new Set())} title={t('notificationsPage.cancelSelection')} aria-label={t('notificationsPage.cancelSelection')}>
                  <X size={16} aria-hidden />
                </Button>
              </div>
            </div>
          )}

          {filteredNotifications.length === 0 ? (
            <EmptyState
              icon={Bell}
              title={t('notificationsPage.signalSpectrumVoid')}
              description={t('notificationsPage.signalSpectrumVoidDesc')}
            />
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map((n) => (
                <div
                  key={n._id}
                  className={cn(
                    'rounded-xl border p-4 transition-colors',
                    !n.read ? 'border-primary/30 bg-primary/[0.03]' : 'border-[var(--border-subtle)]',
                    selectedNotifications.has(n._id) && 'border-primary bg-primary/10'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedNotifications.has(n._id)}
                      aria-label={t('notificationsPage.selectSignal', { title: n.title })}
                      onChange={() => setSelectedNotifications(prev => { const nS = new Set(prev); nS.has(n._id) ? nS.delete(n._id) : nS.add(n._id); return nS })}
                      className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring cursor-pointer"
                    />
                    <div className="h-9 w-9 rounded-lg bg-accent inline-flex items-center justify-center shrink-0">
                      {getTypeIcon(n.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {n.category && (
                          <span className="inline-block rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">{n.category.replace('_', ' ')}</span>
                        )}
                        <span className="inline-flex items-center gap-1 ds-text-caption">
                          <Timer size={12} aria-hidden /> {new Date(n.createdAt).toLocaleString()}
                        </span>
                        {!n.read && <span className="h-2 w-2 rounded-full bg-primary" aria-label={t('notificationsPage.activeResonance')} />}
                      </div>

                      <h3 className="text-sm font-semibold text-theme-primary">{n.title}</h3>
                      <p className="text-sm text-theme-secondary mt-0.5">{n.message || n.aiSummary || t('notificationsPage.nullSignalPayload')}</p>

                      {n.suggestion && (
                        <div className="mt-2 flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/20 p-2.5">
                          <Zap size={14} className="text-primary shrink-0 mt-0.5" aria-hidden />
                          <div className="min-w-0">
                            <p className="ds-text-caption text-primary">{t('notificationsPage.directiveResynthesisAdvice')}</p>
                            <p className="text-sm text-theme-primary">{n.suggestion}</p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border-subtle)]">
                        {n.link && (
                          <Button
                            variant="ghost" size="sm"
                            leftIcon={<Compass size={14} aria-hidden />}
                            rightIcon={<ArrowRight size={14} aria-hidden />}
                            onClick={() => { if (!n.read) apiPut(`/notifications/${n._id}/read`, {}); router.push(n.link!) }}
                          >
                            {t('notificationsPage.accessOriginNode')}
                          </Button>
                        )}
                        <div className="ml-auto flex items-center gap-2">
                          {!n.read && (
                            <Button variant="secondary" size="sm" onClick={() => { apiPut(`/notifications/${n._id}/read`, {}); loadSignals() }}>
                              {t('notificationsPage.resonanceAck')}
                            </Button>
                          )}
                          <Button
                            variant="ghost" size="sm"
                            className="text-rose-500 hover:text-rose-600"
                            title={t('notificationsPage.purgeSignal')} aria-label={t('notificationsPage.purgeSignal')}
                            onClick={() => { if (confirm(t('notificationsPage.confirmPurgeSignal'))) { apiDelete(`/notifications/${n._id}`); loadSignals() } }}
                          >
                            <Trash2 size={16} aria-hidden />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </ErrorBoundary>
  )
}
