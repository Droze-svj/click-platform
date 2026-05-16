'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'
import { extractApiData } from '../../../utils/apiResponse'
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, Plus,
  AlertCircle, CheckCircle, Trash2,
  RefreshCw, LayoutGrid, Timer, ArrowLeft, X, Focus
} from 'lucide-react'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import ToastContainer from '../../../components/ToastContainer'
import { API_URL } from '../../../lib/api'
import ClickLoadingState from '@/components/click/ClickLoadingState'

interface ScheduledPost {
  _id: string
  platform: string
  content: { text: string; hashtags?: string[]; mediaUrl?: string }
  scheduledTime: string
  status: 'scheduled' | 'posted' | 'failed' | 'draft'
}

interface DragData { postId: string; platform: string; originalDate: Date }

const PC: Record<string, { label: string; gradient: string; icon: string }> = {
  twitter:   { label: 'X (Twitter)', gradient: 'from-surface-700 to-surface-900', icon: '𝕏' },
  linkedin:  { label: 'LinkedIn',    gradient: 'from-blue-600 to-blue-800',   icon: 'in' },
  instagram: { label: 'Instagram',   gradient: 'from-pink-500 to-purple-600', icon: '◎' },
  facebook:  { label: 'Facebook',    gradient: 'from-indigo-600 to-indigo-800',icon: 'f' },
  tiktok:    { label: 'TikTok',      gradient: 'from-surface-800 to-black',     icon: '♪' },
  youtube:   { label: 'YouTube',     gradient: 'from-red-600 to-red-800',     icon: '▶' },
}

const SC: Record<string, { label: string; bg: string; text: string; icon: any }> = {
  scheduled: { label: 'Scheduled', bg: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800/50',   text: 'text-amber-700 dark:text-amber-400', icon: Timer },
  posted:    { label: 'Published', bg: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800/50', text: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle },
  failed:    { label: 'Failed',    bg: 'bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800/50',        text: 'text-rose-700 dark:text-rose-400', icon: AlertCircle },
  draft:     { label: 'Draft',     bg: 'bg-surface-50 dark:bg-surface-800 border-surface-200 dark:border-surface-700',         text: 'text-surface-700 dark:text-surface-400', icon: Focus },
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

export default function ContentCalendarPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth() as any
  const { showToast } = useToast()

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
    } catch { showToast('Failed to sync calendar data', 'error') }
    finally { setLoading(false); setRefreshing(false) }
  }, [currentDate, view, showToast])

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
      const t = new Date(targetDate)
      t.setHours(draggedPost.originalDate.getHours(), draggedPost.originalDate.getMinutes(), 0)
      await axios.put(`${API_URL}/scheduler/posts/${draggedPost.postId}`, { scheduledTime: t.toISOString() })
      showToast('Post successfully rescheduled', 'success'); loadCalendar()
    } catch { showToast('Failed to reschedule post', 'error') }
    finally { setDraggedPost(null) }
  }

  const handleDelete = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this scheduled post?')) return
    try {
      await axios.delete(`${API_URL}/scheduler/posts/${postId}`)
      showToast('Post deleted', 'success')
      setSelectedPost(null); setPosts(prev => prev.filter(p => p._id !== postId))
    } catch { showToast('Failed to delete post', 'error') }
  }

  if (loading) return (
     <div className="flex items-center justify-center py-48 min-h-screen bg-surface-50 dark:bg-surface-950 relative z-10">
        <ClickLoadingState intent="loading" />
     </div>
  )

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-surface-50 transition-colors duration-500 font-inter pb-32">
        <ToastContainer />
        
        <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-10 py-8 relative z-10 space-y-10">
          {/* Header */}
          <header className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 border-b border-surface-200 dark:border-surface-800 pb-8">
            <div className="flex items-center gap-6">
              <button type="button" onClick={() => router.push('/dashboard')} title="Back to Dashboard" aria-label="Back to Dashboard" className="w-12 h-12 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 flex items-center justify-center text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors shadow-sm">
                <ArrowLeft size={20} />
              </button>
              <div className="w-16 h-16 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-2xl flex items-center justify-center shadow-sm">
                 <CalendarIcon size={32} className="text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400 uppercase tracking-wide border border-primary-200 dark:border-primary-800">
                    Planning
                  </span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-surface-900 dark:text-white tracking-tight leading-none mt-1">Content Calendar</h1>
                <p className="text-surface-500 text-sm mt-2 font-medium">Manage and review your cross-platform content schedule.</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
                <button onClick={() => loadCalendar(true)} className="w-12 h-12 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 flex items-center justify-center text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors shadow-sm" aria-label="Refresh">
                   <RefreshCw size={20} className={refreshing ? 'animate-spin text-primary-500' : ''} />
                </button>
                <button 
                  onClick={() => router.push('/dashboard/scheduler')}
                  className="px-6 py-3 rounded-xl text-xs font-bold bg-primary-600 text-white hover:bg-primary-700 transition-colors shadow-sm flex items-center gap-2 uppercase tracking-wider">
                  <Plus size={16} /> Schedule Post
                </button>
            </div>
          </header>

          {/* Stats */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-6">
             {[
               { label: 'Total Scheduled', val: posts.length, icon: LayoutGrid },
               { label: 'Upcoming', val: posts.filter(p => p.status === 'scheduled').length, icon: Timer },
               { label: 'Published', val: posts.filter(p => p.status === 'posted').length, icon: CheckCircle },
               { label: 'Errors', val: posts.filter(p => p.status === 'failed').length, icon: AlertCircle },
             ].map((s, i) => (
               <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} key={i} className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl p-6 flex items-center gap-4 shadow-sm">
                  <div className="w-12 h-12 rounded-xl bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 flex items-center justify-center">
                     <s.icon size={20} className="text-surface-600 dark:text-surface-400" />
                  </div>
                  <div>
                     <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-1 leading-none">{s.label}</p>
                     <p className="text-2xl font-black text-surface-900 dark:text-white tabular-nums leading-none">{s.val}</p>
                  </div>
               </motion.div>
             ))}
          </section>

          {/* Calendar Controls */}
          <section className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl overflow-hidden shadow-sm">
             <div className="p-6 md:p-8 border-b border-surface-200 dark:border-surface-800 flex flex-col md:flex-row items-center justify-between gap-6 bg-surface-50 dark:bg-surface-900">
                <div className="flex items-center gap-2 bg-white dark:bg-surface-950 p-1.5 rounded-xl border border-surface-200 dark:border-surface-800 shadow-sm">
                   <button type="button" onClick={() => navigateTime(-1)} title="Previous period" aria-label="Previous period" className="w-9 h-9 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 flex items-center justify-center text-surface-600 dark:text-surface-400 transition-colors"><ChevronLeft size={20} /></button>
                   <button type="button" onClick={() => setCurrentDate(new Date())} title="Go to today" aria-label="Go to today" className="px-4 text-xs font-bold text-surface-700 dark:text-surface-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Today</button>
                   <button type="button" onClick={() => navigateTime(1)} title="Next period" aria-label="Next period" className="w-9 h-9 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 flex items-center justify-center text-surface-600 dark:text-surface-400 transition-colors"><ChevronRight size={20} /></button>
                </div>
                
                <h2 className="text-xl md:text-2xl font-black text-surface-900 dark:text-white tracking-tight">
                  {view === 'month' ? `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}` : view === 'week' ? 'This Week' : currentDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                </h2>

                <div className="flex items-center gap-1 bg-white dark:bg-surface-950 p-1 rounded-xl border border-surface-200 dark:border-surface-800 shadow-sm">
                   {['month','week','day'].map(v => (
                     <button key={v} onClick={() => setView(v as any)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${view === v ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 shadow-sm border border-primary-200 dark:border-primary-800/50' : 'text-surface-500 hover:text-surface-900 dark:hover:text-white hover:bg-surface-50 dark:hover:bg-surface-800'}`}>
                       {v.charAt(0).toUpperCase() + v.slice(1)}
                     </button>
                   ))}
                </div>
             </div>

             <div className="p-4 md:p-8 min-h-[600px] bg-white dark:bg-surface-950">
                {view === 'month' && (
                  <div className="overflow-x-auto">
                     <div className="min-w-[800px]">
                       <div className="grid grid-cols-7 gap-4 mb-4">
                          {DAY_SHORT.map(d => (
                            <div key={d} className="text-center text-xs font-bold text-surface-500 uppercase tracking-wider py-2">{d}</div>
                          ))}
                       </div>
                       <div className="grid grid-cols-7 gap-4">
                          {(() => {
                             const y = currentDate.getFullYear(), m = currentDate.getMonth()
                             const first = new Date(y, m, 1), last = new Date(y, m + 1, 0)
                             const days: (Date | null)[] = []
                             for (let i = 0; i < first.getDay(); i++) days.push(null)
                             for (let d = 1; d <= last.getDate(); d++) days.push(new Date(y, m, d))
                             while (days.length % 7 !== 0) days.push(null)
                             
                             return days.map((date, i) => {
                               if (!date) return <div key={i} className="min-h-[140px] opacity-0 pointer-events-none" />
                               const ds = date.toISOString().split('T')[0]
                               const dp = posts.filter(p => new Date(p.scheduledTime).toISOString().split('T')[0] === ds)
                               const isToday = date.toDateString() === new Date().toDateString()
                               const isPast = date < new Date(new Date().setHours(0,0,0,0))
                               const isTarget = dragOverDate?.toDateString() === date.toDateString()

                               return (
                                 <motion.div key={i} onDragOver={e => { e.preventDefault(); setDragOverDate(date) }} onDragLeave={() => setDragOverDate(null)} onDrop={e => handleDrop(e, date)}
                                   className={`min-h-[140px] rounded-2xl p-3 md:p-4 border transition-all duration-200 relative group ${isTarget ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20 shadow-sm z-10' : isToday ? 'border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-900/10' : 'border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 hover:border-surface-300 dark:hover:border-surface-700 hover:shadow-sm'} ${isPast && !isToday ? 'opacity-50 hover:opacity-100' : ''}`}
                                 >
                                    <div className="flex justify-between items-center mb-3">
                                       <span className={`text-sm md:text-base font-bold ${isToday ? 'text-primary-600 dark:text-primary-400' : 'text-surface-700 dark:text-surface-300'}`}>{date.getDate()}</span>
                                       {dp.length > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 border border-surface-200 dark:border-surface-700">{dp.length}</span>}
                                    </div>
                                    <div className="space-y-2">
                                       {dp.slice(0, 3).map(p => {
                                         const cfg = PC[p.platform] || { label: p.platform, gradient: 'from-surface-600 to-surface-800', icon: '?' }
                                         return (
                                           <div key={p._id} draggable onDragStart={e => handleDragStart(e, p)} onClick={() => setSelectedPost(p)}
                                             className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gradient-to-r ${cfg.gradient} text-white cursor-pointer hover:scale-105 transition-transform text-[10px] md:text-xs font-bold shadow-sm border border-black/10`}
                                           >
                                              <span>{cfg.icon}</span>
                                              <span className="truncate">{p.content.text || cfg.label}</span>
                                           </div>
                                         )
                                       })}
                                       {dp.length > 3 && <p className="text-[10px] text-surface-500 font-bold text-center mt-2">+{dp.length - 3} more</p>}
                                    </div>
                                 </motion.div>
                               )
                             })
                          })()}
                       </div>
                     </div>
                  </div>
                )}

                {(view === 'week' || view === 'day') && (
                  <div className="flex items-center justify-center py-32 flex-col opacity-60">
                     <LayoutGrid size={40} className="text-surface-400 mb-6" />
                     <p className="text-base text-surface-600 font-medium">{view === 'week' ? 'Week' : 'Day'} view is under optimization.</p>
                     <button onClick={() => setView('month')} className="mt-4 px-4 py-2 bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors">Return to Month View</button>
                  </div>
                )}
             </div>
          </section>

          {/* Details Modal */}
          <AnimatePresence>
             {selectedPost && (() => {
               const cfg = PC[selectedPost.platform] || { label: selectedPost.platform, gradient: 'from-surface-600 to-surface-800', icon: '?' }
               const scc = SC[selectedPost.status] || SC.draft
               const StatusIcon = scc.icon
               return (
                 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/50 backdrop-blur-sm" onClick={() => setSelectedPost(null)}>
                    <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                      className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-xl relative z-10" onClick={e => e.stopPropagation()}
                    >
                       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-surface-200 dark:border-surface-800 pb-6">
                          <div className="flex items-center gap-4">
                             <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${cfg.gradient} flex items-center justify-center text-white text-xl shadow-sm border border-black/10 shrink-0`}>{cfg.icon}</div>
                             <div>
                                <h3 className="text-xl font-black text-surface-900 dark:text-white tracking-tight">{cfg.label} Post</h3>
                                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs font-bold">
                                   <span className={`flex items-center gap-1.5 px-2 py-1 rounded-md border ${scc.bg} ${scc.text}`}><StatusIcon size={14} /> {scc.label}</span>
                                   <span className="text-surface-500 flex items-center gap-1.5"><Clock size={14} /> {new Date(selectedPost.scheduledTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                </div>
                             </div>
                          </div>
                          <button type="button" onClick={() => setSelectedPost(null)} title="Close post details" aria-label="Close post details" className="absolute top-6 right-6 p-2 text-surface-400 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800 rounded-xl transition-colors"><X size={20} /></button>
                       </div>

                       <div className="bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 rounded-2xl p-6 mb-8">
                          <p className="text-surface-700 dark:text-surface-300 text-sm leading-relaxed whitespace-pre-wrap font-medium">{selectedPost.content.text || 'No text content provided.'}</p>
                          {selectedPost.content.hashtags && selectedPost.content.hashtags.length > 0 && (
                             <div className="flex flex-wrap gap-2 mt-4">
                                {selectedPost.content.hashtags.map(h => (
                                   <span key={h} className="text-[10px] font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800/50 px-2.5 py-1 rounded-md">#{h}</span>
                                ))}
                             </div>
                          )}
                       </div>

                       <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                          <button onClick={() => handleDelete(selectedPost._id)} className="w-full sm:w-auto px-6 py-3 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/10 hover:bg-rose-100 dark:hover:bg-rose-900/20 border border-rose-200 dark:border-rose-800/50 rounded-xl transition-colors flex items-center justify-center gap-2 uppercase tracking-wider">
                             <Trash2 size={16} /> Delete Post
                          </button>
                          <button onClick={() => router.push('/dashboard/scheduler')} className="w-full sm:w-auto px-8 py-3 text-xs font-bold bg-primary-600 text-white hover:bg-primary-700 rounded-xl transition-colors shadow-sm uppercase tracking-wider text-center">
                             Edit in Scheduler
                          </button>
                       </div>
                    </motion.div>
                 </div>
               )
             })()}
          </AnimatePresence>
        </div>
      </div>
    </ErrorBoundary>
  )
}
