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
  AlertCircle, CheckCircle, Zap, Trash2,
  RefreshCw, Eye, ArrowRight, LayoutGrid, Timer, ArrowLeft, Boxes, X, Network, Focus
} from 'lucide-react'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import ToastContainer from '../../../components/ToastContainer'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'
const glassStyle = 'backdrop-blur-3xl bg-white/[0.02] border border-white/5 shadow-2xl transition-all duration-300'

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
  linkedin:  { label: 'LinkedIn',    gradient: 'from-blue-600 to-blue-900',   icon: 'in' },
  instagram: { label: 'Instagram',   gradient: 'from-pink-500 to-purple-600', icon: '◎' },
  facebook:  { label: 'Facebook',    gradient: 'from-indigo-600 to-indigo-900',icon: 'f' },
  tiktok:    { label: 'TikTok',      gradient: 'from-slate-800 to-black',     icon: '♪' },
  youtube:   { label: 'YouTube',     gradient: 'from-red-600 to-red-900',     icon: '▶' },
}

const SC: Record<string, { label: string; bg: string; text: string; icon: any }> = {
  scheduled: { label: 'Scheduled', bg: 'bg-amber-500/10 border-amber-500/20',   text: 'text-amber-400', icon: Timer },
  posted:    { label: 'Published', bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400', icon: CheckCircle },
  failed:    { label: 'Failed',    bg: 'bg-rose-500/10 border-rose-500/20',        text: 'text-rose-400', icon: AlertCircle },
  draft:     { label: 'Draft',     bg: 'bg-slate-500/10 border-slate-500/20',         text: 'text-slate-400', icon: Focus },
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

export default function ContentCalendarPage() {
  const router = useRouter()
  const { user } = useAuth()
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

  useEffect(() => { if (!user) router.push('/login'); else loadCalendar() }, [user, currentDate, view, router, loadCalendar])

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
     <div className="flex flex-col items-center justify-center py-48 min-h-screen relative z-10">
        <Timer size={64} className="text-indigo-500 animate-spin mb-8" />
        <span className="text-sm font-medium text-slate-400">Loading Calendar...</span>
     </div>
  )

  return (
    <div className="min-h-screen relative z-10 pb-48 px-10 pt-16 max-w-[1700px] mx-auto space-y-12 font-inter">
      <ToastContainer />
      
      {/* Header */}
      <header className="flex flex-col lg:flex-row items-center justify-between gap-8 relative z-50">
        <div className="flex items-center gap-8">
          <button onClick={() => router.push('/dashboard')} className="w-14 h-14 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all hover:scale-105 active:scale-95 shadow-xl hover:border-white/20 backdrop-blur-3xl group">
            <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center shadow-lg relative overflow-hidden group">
             <CalendarIcon size={32} className="text-indigo-400 group-hover:scale-110 transition-transform duration-300" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-[var(--text-main)] tracking-tight drop-shadow-md">Content Calendar</h1>
            <p className="text-slate-400 text-sm mt-1 font-medium">Manage and review your cross-platform content schedule.</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
            <button onClick={() => loadCalendar(true)} className={`${glassStyle} w-14 h-14 rounded-full flex items-center justify-center group active:scale-95 hover:bg-white/[0.05]`}>
               <RefreshCw size={24} className={`text-slate-400 group-hover:text-indigo-400 transition-colors ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button 
              onClick={() => router.push('/dashboard/scheduler')}
              className="px-8 py-4 rounded-full text-sm font-bold bg-white text-black hover:bg-indigo-600 hover:text-white transition-all shadow-lg flex items-center gap-3 active:scale-95">
              <Plus size={20} /> Schedule Post
            </button>
        </div>
      </header>

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-6 relative z-10">
         {[
           { label: 'Total Scheduled', val: posts.length, icon: LayoutGrid, color: 'text-indigo-400' },
           { label: 'Upcoming', val: posts.filter(p => p.status === 'scheduled').length, icon: Timer, color: 'text-amber-400' },
           { label: 'Published', val: posts.filter(p => p.status === 'posted').length, icon: CheckCircle, color: 'text-emerald-400' },
           { label: 'Errors', val: posts.filter(p => p.status === 'failed').length, icon: AlertCircle, color: 'text-rose-400' },
         ].map((s, i) => (
           <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} key={i} className={`${glassStyle} rounded-3xl p-6 flex items-center gap-6 hover:bg-white/[0.04]`}>
              <div className="w-14 h-14 rounded-xl bg-white/[0.02] flex items-center justify-center border border-white/5">
                 <s.icon size={28} className={s.color} />
              </div>
              <div>
                 <p className="text-3xl font-bold text-white leading-none mb-1">{s.val}</p>
                 <p className="text-sm font-medium text-slate-400">{s.label}</p>
              </div>
           </motion.div>
         ))}
      </section>

      {/* Calendar Controls */}
      <section className={`${glassStyle} rounded-[2.5rem] overflow-hidden relative z-10 shadow-2xl`}>
         <div className="p-8 border-b border-white/5 flex flex-col md:flex-row items-center justify-between gap-8 bg-white/[0.01]">
            <div className="flex items-center gap-6 bg-black/40 p-2 rounded-full border border-white/5">
               <button onClick={() => navigateTime(-1)} className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-300 transition-colors"><ChevronLeft size={24} /></button>
               <button onClick={() => setCurrentDate(new Date())} className="px-4 text-sm font-bold text-white hover:text-indigo-400 transition-colors">Today</button>
               <button onClick={() => navigateTime(1)} className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-300 transition-colors"><ChevronRight size={24} /></button>
            </div>
            
            <h2 className="text-2xl font-bold text-[var(--text-main)]">
              {view === 'month' ? `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}` : view === 'week' ? 'This Week' : currentDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </h2>

            <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-full border border-white/5">
               {['month','week','day'].map(v => (
                 <button key={v} onClick={() => setView(v as any)} className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${view === v ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                   {v.charAt(0).toUpperCase() + v.slice(1)}
                 </button>
               ))}
            </div>
         </div>

         <div className="p-8 min-h-[600px] bg-black/20">
            {view === 'month' && (
              <div>
                 <div className="grid grid-cols-7 gap-4 mb-4">
                    {DAY_SHORT.map(d => (
                      <div key={d} className="text-center text-sm font-semibold text-slate-500 py-2">{d}</div>
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
                             className={`min-h-[140px] rounded-2xl p-4 border transition-all duration-200 relative group ${isTarget ? 'border-indigo-400 bg-indigo-500/10 z-10' : isToday ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-white/5 bg-white/[0.01] hover:border-white/10 hover:bg-white/[0.03]'} ${isPast && !isToday ? 'opacity-50' : ''}`}
                           >
                              <div className="flex justify-between items-center mb-3">
                                 <span className={`text-lg font-bold ${isToday ? 'text-indigo-400' : 'text-slate-400 group-hover:text-white'}`}>{date.getDate()}</span>
                                 {dp.length > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white">{dp.length} items</span>}
                              </div>
                              <div className="space-y-2">
                                 {dp.slice(0, 3).map(p => {
                                   const cfg = PC[p.platform] || { label: p.platform, gradient: 'from-slate-600 to-black', icon: '?' }
                                   return (
                                     <div key={p._id} draggable onDragStart={e => handleDragStart(e, p)} onClick={() => setSelectedPost(p)}
                                       className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r ${cfg.gradient} text-white cursor-pointer hover:scale-105 transition-transform text-xs font-medium shadow-sm`}
                                     >
                                        <span>{cfg.icon}</span>
                                        <span className="truncate">{p.content.text || cfg.label}</span>
                                     </div>
                                   )
                                 })}
                                 {dp.length > 3 && <p className="text-xs text-slate-500 font-medium text-center">+{dp.length - 3} more</p>}
                              </div>
                           </motion.div>
                         )
                       })
                    })()}
                 </div>
              </div>
            )}

            {/* Week & Day views can be expanded similarly if needed, simplifying here for cleanliness */}
            {(view === 'week' || view === 'day') && (
              <div className="flex items-center justify-center py-40 flex-col opacity-60">
                 <LayoutGrid size={48} className="text-slate-500 mb-6" />
                 <p className="text-lg text-slate-400 font-medium">{view === 'week' ? 'Week' : 'Day'} view is under optimization.</p>
                 <button onClick={() => setView('month')} className="mt-4 text-indigo-400 hover:text-white transition-colors font-medium">Return to Month View</button>
              </div>
            )}
         </div>
      </section>

      {/* Details Modal */}
      <AnimatePresence>
         {selectedPost && (() => {
           const cfg = PC[selectedPost.platform] || { label: selectedPost.platform, gradient: 'from-slate-600 to-black', icon: '?' }
           const scc = SC[selectedPost.status] || SC.draft
           const StatusIcon = scc.icon
           return (
             <div className="fixed inset-0 z-[100] flex items-center justify-center p-6" onClick={() => setSelectedPost(null)}>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
                
                <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="bg-[#050505] border border-white/10 rounded-3xl p-8 max-w-2xl w-full shadow-2xl relative z-10" onClick={e => e.stopPropagation()}
                >
                   <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-6">
                      <div className="flex items-center gap-4">
                         <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${cfg.gradient} flex items-center justify-center text-white text-2xl shadow-lg`}>{cfg.icon}</div>
                         <div>
                            <h3 className="text-2xl font-bold text-[var(--text-main)]">{cfg.label} Post</h3>
                            <div className="flex items-center gap-3 mt-1 text-sm font-medium">
                               <span className={`flex items-center gap-1.5 ${scc.text}`}><StatusIcon size={16} /> {scc.label}</span>
                               <span className="text-slate-500">•</span>
                               <span className="text-slate-400 flex items-center gap-1.5"><Clock size={16} /> {new Date(selectedPost.scheduledTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                            </div>
                         </div>
                      </div>
                      <button onClick={() => setSelectedPost(null)} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
                   </div>

                   <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 mb-8">
                      <p className="text-slate-200 text-lg leading-relaxed whitespace-pre-wrap">{selectedPost.content.text || 'No text content provided.'}</p>
                      {selectedPost.content.hashtags && selectedPost.content.hashtags.length > 0 && (
                         <div className="flex flex-wrap gap-2 mt-4">
                            {selectedPost.content.hashtags.map(h => (
                               <span key={h} className="text-xs font-medium text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full">#{h}</span>
                            ))}
                         </div>
                      )}
                   </div>

                   <div className="flex justify-between items-center">
                      <button onClick={() => handleDelete(selectedPost._id)} className="px-6 py-3 text-sm font-bold text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors flex items-center gap-2">
                         <Trash2 size={18} /> Delete Post
                      </button>
                      <button onClick={() => router.push('/dashboard/scheduler')} className="px-8 py-3 text-sm font-bold bg-white text-black hover:bg-indigo-600 hover:text-white rounded-xl transition-colors shadow-md">
                         Edit in Scheduler
                      </button>
                   </div>
                </motion.div>
             </div>
           )
         })()}
      </AnimatePresence>
    </div>
  )
}
