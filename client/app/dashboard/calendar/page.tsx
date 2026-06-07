'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { motion, useReducedMotion } from 'framer-motion'
import { useAuth } from '../../../hooks/useAuth'
import { useTranslation } from '../../../hooks/useTranslation'
import { useToast } from '../../../contexts/ToastContext'
import { extractApiData } from '../../../utils/apiResponse'
import {
  ChevronLeft, ChevronRight, Clock, Plus,
  AlertCircle, CheckCircle, Trash2,
  RefreshCw, LayoutGrid, Timer, Focus,
} from 'lucide-react'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import ToastContainer from '../../../components/ToastContainer'
import { API_URL } from '../../../lib/api'
import { CardSkeleton } from '../../../components/LoadingSkeleton'
import { cn } from '../../../lib/utils'
import {
  Panel,
  Button,
  IconButton,
  Modal,
  StatCard,
  SectionHeader,
  Badge,
} from '../../../components/ui'

interface ScheduledPost {
  _id: string
  platform: string
  content: { text: string; hashtags?: string[]; mediaUrl?: string }
  scheduledTime: string
  status: 'scheduled' | 'posted' | 'failed' | 'draft'
}

interface DragData { postId: string; platform: string; originalDate: Date }

const PC: Record<string, { label: string; gradient: string; icon: string }> = {
  twitter:   { label: 'X (Twitter)', gradient: 'from-slate-700 to-slate-900', icon: '𝕏' },
  linkedin:  { label: 'LinkedIn',    gradient: 'from-blue-600 to-blue-800',   icon: 'in' },
  instagram: { label: 'Instagram',   gradient: 'from-pink-500 to-purple-600', icon: '◎' },
  facebook:  { label: 'Facebook',    gradient: 'from-indigo-600 to-indigo-800',icon: 'f' },
  tiktok:    { label: 'TikTok',      gradient: 'from-slate-800 to-black',     icon: '♪' },
  youtube:   { label: 'YouTube',     gradient: 'from-red-600 to-red-800',     icon: '▶' },
}

const SC: Record<string, { label: string; cls: string; icon: any }> = {
  scheduled: { label: 'Scheduled', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',   icon: Timer },
  posted:    { label: 'Published', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', icon: CheckCircle },
  failed:    { label: 'Failed',    cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',        icon: AlertCircle },
  draft:     { label: 'Draft',     cls: 'ds-surface-subtle text-theme-muted',         icon: Focus },
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

export default function ContentCalendarPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth() as any
  const { t } = useTranslation()
  const { showToast } = useToast()
  const reduceMotion = useReducedMotion()

  const [posts, setPosts] = useState<ScheduledPost[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<'month' | 'week' | 'day'>('month')
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null)
  const [draggedPost, setDraggedPost] = useState<DragData | null>(null)
  const [dragOverDate, setDragOverDate] = useState<Date | null>(null)

  const loadCalendar = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true)
    try {
      const getRange = () => {
        const start = new Date(currentDate)
        const end = new Date(currentDate)
        if (view === 'month') { start.setDate(1); end.setMonth(end.getMonth() + 1); end.setDate(0) }
        else if (view === 'week') { start.setDate(start.getDate() - start.getDay()); end.setDate(start.getDate() + 6) }
        return { start, end }
      }
      const { start, end } = getRange()
      const res = await axios.get(`${API_URL}/scheduler?startDate=${start.toISOString()}&endDate=${end.toISOString()}`)
      const data = extractApiData<ScheduledPost[]>(res) || []
      setPosts(Array.isArray(data) ? data : [])
    } catch { showToast(t('calendarPage.syncFailed'), 'error') }
    finally { setLoading(false); setRefreshing(false) }
  }, [currentDate, view, showToast, t])

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    loadCalendar()
  }, [user, authLoading, currentDate, view, router, loadCalendar])

  const navigateTime = (dir: number) => {
    const d = new Date(currentDate)
    if (view === 'month') d.setMonth(d.getMonth() + dir)
    else if (view === 'week') d.setDate(d.getDate() + dir * 7)
    else d.setDate(d.getDate() + dir)
    setCurrentDate(d)
  }

  const handleDragStart = (e: React.DragEvent, post: ScheduledPost) => {
    setDraggedPost({ postId: post._id, platform: post.platform, originalDate: new Date(post.scheduledTime) })
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDrop = async (e: React.DragEvent, targetDate: Date | null) => {
    e.preventDefault(); setDragOverDate(null)
    if (!draggedPost || !targetDate) return
    try {
      const targetDt = new Date(targetDate)
      targetDt.setHours(draggedPost.originalDate.getHours(), draggedPost.originalDate.getMinutes(), 0)
      await axios.put(`${API_URL}/scheduler/posts/${draggedPost.postId}`, { scheduledTime: targetDt.toISOString() })
      showToast(t('calendarPage.rescheduled'), 'success'); loadCalendar()
    } catch { showToast(t('calendarPage.rescheduleFailed'), 'error') }
    finally { setDraggedPost(null) }
  }

  const handleDelete = async (postId: string) => {
    if (!confirm(t('calendarPage.deleteConfirm'))) return
    try {
      await axios.delete(`${API_URL}/scheduler/posts/${postId}`)
      showToast(t('calendarPage.postDeleted'), 'success')
      setSelectedPost(null); setPosts(prev => prev.filter(p => p._id !== postId))
    } catch { showToast(t('calendarPage.deleteFailed'), 'error') }
  }

  if (loading) return (
    <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 max-w-[1700px] mx-auto" aria-busy="true" aria-label={t('calendarPage.loading')}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    </div>
  )

  return (
    <ErrorBoundary>
      <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1700px] mx-auto overflow-x-hidden text-theme-primary space-y-8">
        <ToastContainer />

        <SectionHeader
          as="h1"
          title={t('calendarPage.title')}
          description={t('calendarPage.subtitle')}
          actions={
            <>
              <IconButton variant="secondary" size="md" onClick={() => loadCalendar(true)} aria-label={t('calendarPage.refresh')} title={t('calendarPage.refresh')}>
                <RefreshCw size={16} className={refreshing ? 'animate-spin text-primary' : ''} aria-hidden />
              </IconButton>
              <Button variant="primary" size="md" leftIcon={<Plus size={16} aria-hidden />} onClick={() => router.push('/dashboard/scheduler')}>
                {t('calendarPage.schedulePost')}
              </Button>
            </>
          }
        />

        {/* Stats (real counts) */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label={t('calendarPage.statTotalScheduled')} value={posts.length} icon={LayoutGrid} />
          <StatCard label={t('calendarPage.statUpcoming')} value={posts.filter(p => p.status === 'scheduled').length} icon={Timer} />
          <StatCard label={t('calendarPage.statPublished')} value={posts.filter(p => p.status === 'posted').length} icon={CheckCircle} />
          <StatCard label={t('calendarPage.statErrors')} value={posts.filter(p => p.status === 'failed').length} icon={AlertCircle} />
        </section>

        {/* Calendar */}
        <Panel variant="bento" className="p-0 overflow-hidden">
          <div className="p-5 md:p-6 border-b border-[var(--border-subtle)] flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-1 p-1 rounded-lg ds-surface-subtle">
              <IconButton variant="ghost" size="sm" onClick={() => navigateTime(-1)} title={t('calendarPage.refresh')} aria-label="Previous period"><ChevronLeft size={18} aria-hidden /></IconButton>
              <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())}>{t('calendarPage.today') || 'Today'}</Button>
              <IconButton variant="ghost" size="sm" onClick={() => navigateTime(1)} title={t('calendarPage.refresh')} aria-label="Next period"><ChevronRight size={18} aria-hidden /></IconButton>
            </div>

            <h2 className="ds-text-h3 text-theme-primary">
              {view === 'month' ? `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}` : view === 'week' ? (t('calendarPage.thisWeek') || 'This Week') : currentDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </h2>

            <div className="flex items-center gap-1 p-1 rounded-lg ds-surface-subtle">
              {(['month','week','day'] as const).map(v => (
                <button type="button" key={v} onClick={() => setView(v)}
                  className={cn(
                    'rounded-md px-3 h-8 text-xs font-medium transition-colors',
                    view === v ? 'bg-primary text-primary-foreground' : 'text-theme-secondary hover:text-theme-primary'
                  )}
                >
                  {t(`calendarPage.view_${v}`) || (v.charAt(0).toUpperCase() + v.slice(1))}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 md:p-6 min-h-[560px]">
            {view === 'month' && (
              <div className="overflow-x-auto">
                <div className="min-w-[760px]">
                  <div className="grid grid-cols-7 gap-3 mb-3">
                    {DAY_SHORT.map(d => (
                      <div key={d} className="text-center ds-text-caption py-1">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-3">
                    {(() => {
                      const y = currentDate.getFullYear(), m = currentDate.getMonth()
                      const first = new Date(y, m, 1), last = new Date(y, m + 1, 0)
                      const days: (Date | null)[] = []
                      for (let i = 0; i < first.getDay(); i++) days.push(null)
                      for (let d = 1; d <= last.getDate(); d++) days.push(new Date(y, m, d))
                      while (days.length % 7 !== 0) days.push(null)

                      return days.map((date, i) => {
                        if (!date) return <div key={i} className="min-h-[130px] opacity-0 pointer-events-none" />
                        const ds = date.toISOString().split('T')[0]
                        const dp = posts.filter(p => new Date(p.scheduledTime).toISOString().split('T')[0] === ds)
                        const isToday = date.toDateString() === new Date().toDateString()
                        const isPast = date < new Date(new Date().setHours(0,0,0,0))
                        const isTarget = dragOverDate?.toDateString() === date.toDateString()

                        return (
                          <div key={i} onDragOver={e => { e.preventDefault(); setDragOverDate(date) }} onDragLeave={() => setDragOverDate(null)} onDrop={e => handleDrop(e, date)}
                            className={cn(
                              'min-h-[130px] rounded-xl p-3 border transition-colors',
                              isTarget ? 'border-primary bg-primary/5'
                                : isToday ? 'border-primary/40 bg-primary/5'
                                : 'border-[var(--border-subtle)] ds-surface-subtle hover:bg-accent',
                              isPast && !isToday && 'opacity-50 hover:opacity-100'
                            )}
                          >
                            <div className="flex justify-between items-center mb-2">
                              <span className={cn('text-sm font-semibold', isToday ? 'text-primary' : 'text-theme-secondary')}>{date.getDate()}</span>
                              {dp.length > 0 && <Badge variant="secondary" className="tabular-nums">{dp.length}</Badge>}
                            </div>
                            <div className="space-y-1.5">
                              {dp.slice(0, 3).map(p => {
                                const cfg = PC[p.platform] || { label: p.platform, gradient: 'from-slate-600 to-slate-800', icon: '?' }
                                return (
                                  <button type="button" key={p._id} draggable onDragStart={e => handleDragStart(e, p)} onClick={() => setSelectedPost(p)}
                                    className={cn('w-full flex items-center gap-1.5 px-2 py-1 rounded-md bg-gradient-to-r text-white cursor-pointer text-[11px] font-medium text-left', cfg.gradient)}
                                  >
                                    <span aria-hidden>{cfg.icon}</span>
                                    <span className="truncate">{p.content.text || cfg.label}</span>
                                  </button>
                                )
                              })}
                              {dp.length > 3 && <p className="ds-text-caption text-center mt-1">+{dp.length - 3}</p>}
                            </div>
                          </div>
                        )
                      })
                    })()}
                  </div>
                </div>
              </div>
            )}

            {(view === 'week' || view === 'day') && (
              <div className="flex items-center justify-center py-28 flex-col gap-4">
                <LayoutGrid size={36} className="text-theme-muted" aria-hidden />
                <p className="ds-text-body text-theme-muted">{view === 'week' ? (t('calendarPage.weekUnavailable') || 'Week view is under optimization.') : (t('calendarPage.dayUnavailable') || 'Day view is under optimization.')}</p>
                <Button variant="secondary" size="md" onClick={() => setView('month')}>{t('calendarPage.returnToMonth') || 'Return to Month View'}</Button>
              </div>
            )}
          </div>
        </Panel>

        {/* Details Modal */}
        {selectedPost && (() => {
          const cfg = PC[selectedPost.platform] || { label: selectedPost.platform, gradient: 'from-slate-600 to-slate-800', icon: '?' }
          const scc = SC[selectedPost.status] || SC.draft
          const StatusIcon = scc.icon
          return (
            <Modal open onClose={() => setSelectedPost(null)} className="max-w-2xl">
              <div className="space-y-6">
                <div className="flex items-center gap-4 pr-8 border-b border-[var(--border-subtle)] pb-5">
                  <div className={cn('h-12 w-12 rounded-xl bg-gradient-to-br flex items-center justify-center text-white text-xl shrink-0', cfg.gradient)} aria-hidden>{cfg.icon}</div>
                  <div>
                    <h3 className="ds-text-h3 text-theme-primary">{cfg.label}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <Badge className={cn('gap-1.5', scc.cls)}><StatusIcon size={13} aria-hidden /> {t(`calendarPage.status_${selectedPost.status}`) || scc.label}</Badge>
                      <span className="ds-text-caption inline-flex items-center gap-1.5"><Clock size={13} aria-hidden /> {new Date(selectedPost.scheduledTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </div>
                  </div>
                </div>

                <div className="ds-surface-subtle rounded-xl p-5">
                  <p className="ds-text-body text-theme-secondary whitespace-pre-wrap">{selectedPost.content.text || (t('calendarPage.noContent') || 'No text content provided.')}</p>
                  {selectedPost.content.hashtags && selectedPost.content.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-4">
                      {selectedPost.content.hashtags.map(h => (
                        <Badge key={h} className="bg-primary/10 text-primary">#{h}</Badge>
                      ))}
                    </div>
                  )}
                </div>

                <footer className="flex flex-col sm:flex-row justify-between items-center gap-3">
                  <Button variant="ghost" size="md" onClick={() => handleDelete(selectedPost._id)} className="text-rose-500 w-full sm:w-auto" leftIcon={<Trash2 size={16} aria-hidden />}>
                    {t('calendarPage.deletePost') || 'Delete Post'}
                  </Button>
                  <Button variant="primary" size="md" onClick={() => router.push('/dashboard/scheduler')} className="w-full sm:w-auto">
                    {t('calendarPage.editInScheduler') || 'Edit in Scheduler'}
                  </Button>
                </footer>
              </div>
            </Modal>
          )
        })()}
      </div>
    </ErrorBoundary>
  )
}
