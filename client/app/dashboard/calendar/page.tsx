'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'
import { extractApiData, extractApiError } from '../../../utils/apiResponse'
import {
  Calendar, ChevronLeft, ChevronRight, Clock, Plus, Filter, X,
  AlertCircle, CheckCircle, Zap, Globe, Trash2, TrendingUp,
  RefreshCw, BarChart2, Eye, ArrowRight, Flame, Target,
  ChevronDown, Grid, List, Shield, Activity, Cpu, Radio,
  Fingerprint, Compass, Boxes, LayoutGrid, Timer, ArrowLeft,
  Workflow, Binary, Orbit, Scan, Command, Box, Wind, Ghost,
  Signal, ShieldAlert, UserCheck, Key, Anchor, Sparkle
} from 'lucide-react'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import ToastContainer from '../../../components/ToastContainer'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'
const glassStyle = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-3xl transition-all duration-1000'

interface ScheduledPost {
  _id: string
  platform: string
  content: { text: string; hashtags?: string[]; mediaUrl?: string }
  scheduledTime: string
  status: 'scheduled' | 'posted' | 'failed' | 'draft'
}

interface DragData { postId: string; platform: string; originalDate: Date }

const PC: Record<string, { label: string; gradient: string; dot: string; icon: string }> = {
  twitter:   { label: 'X_NODE',  gradient: 'from-slate-400 to-slate-900',         dot: 'bg-slate-500',     icon: '𝕏' },
  linkedin:  { label: 'B2B_NODE',   gradient: 'from-blue-600 to-blue-900',       dot: 'bg-blue-700',    icon: 'in' },
  instagram: { label: 'VISUAL_NODE',  gradient: 'from-pink-500 to-purple-600',     dot: 'bg-pink-500',    icon: '◎' },
  facebook:  { label: 'META_NODE',   gradient: 'from-indigo-600 to-indigo-900',   dot: 'bg-indigo-600',  icon: 'f' },
  tiktok:    { label: 'BYTE_NODE',     gradient: 'from-slate-800 to-black',       dot: 'bg-slate-800',    icon: '♪' },
  youtube:   { label: 'STREAM_NODE',    gradient: 'from-red-600 to-red-900',         dot: 'bg-red-600',     icon: '▶' },
}

const SC: Record<string, { label: string; bg: string; text: string }> = {
  scheduled: { label: 'LOCKED', bg: 'bg-amber-500/10 border-amber-500/20',   text: 'text-amber-400' },
  posted:    { label: 'SYNCHRONOUS',    bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400' },
  failed:    { label: 'DIFFRACTED',    bg: 'bg-rose-500/10 border-rose-500/20',        text: 'text-rose-400' },
  draft:     { label: 'CACHED_NODE',     bg: 'bg-slate-500/10 border-slate-500/20',         text: 'text-slate-400' },
}

const MONTH_NAMES = ['JAN_CYCLE','FEB_CYCLE','MAR_CYCLE','APR_CYCLE','MAY_CYCLE','JUN_CYCLE','JUL_CYCLE','AUG_CYCLE','SEP_CYCLE','OCT_CYCLE','NOV_CYCLE','DEC_CYCLE']
const DAY_SHORT = ['SUN','MON','TUE','WED','THU','FRI','SAT']

export default function ChronosLatticePage() {
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

  const loadLattice = useCallback(async (isRefresh = false) => {
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
    } catch { showToast('CHRONOS_SYNC_ERR: LATTICE_OFFLINE', 'error') }
    finally { setLoading(false); setRefreshing(false) }
  }, [currentDate, view, showToast])

  useEffect(() => { if (!user) router.push('/login'); else loadLattice() }, [user, currentDate, view, router, loadLattice])

  const navigateCycle = (dir: number) => {
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
      showToast('✓ TRAJECTORY_RE-SYNCHRONIZED_SUCCESS', 'success'); loadLattice()
    } catch { showToast('RE-SYNC_FAIL: TEMPORAL_REJECTION', 'error') }
    finally { setDraggedPost(null) }
  }

  const handlePurge = async (postId: string) => {
    if (!confirm('PURGE_TEMPORAL_TRAJECTORY?')) return
    try {
      await axios.delete(`${API_URL}/scheduler/posts/${postId}`)
      showToast('✓ TRAJECTORY_PURGED_FROM_CHRONOS', 'success')
      setSelectedPost(null); setPosts(prev => prev.filter(p => p._id !== postId))
    } catch { showToast('PURGE_FAIL: NODE_LOCKED', 'error') }
  }

  const getHeatmap = () => {
    const map: Record<string, number> = {}
    posts.forEach(p => { const k = new Date(p.scheduledTime).toISOString().split('T')[0]; map[k] = (map[k] || 0) + 1 })
    return map
  }

  if (loading) return (
     <div className="flex flex-col items-center justify-center py-48 bg-[#020205] min-h-screen">
        <Timer size={64} className="text-indigo-500 animate-spin mb-8" />
        <span className="text-[12px] font-black text-slate-800 uppercase tracking-[0.6em] animate-pulse italic">Synchronizing Chronos Lattice...</span>
     </div>
  )

  const heatmap = getHeatmap()
  const maxPosts = Math.max(...Object.values(heatmap), 1)

  return (
    <div className="min-h-screen relative z-10 pb-48 px-10 pt-16 max-w-[1700px] mx-auto space-y-24 font-inter">
      <ToastContainer />
      
      {/* Background Matrix Layer */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
          <Compass size={1200} className="text-white absolute -bottom-40 -left-60 rotate-12 blur-[1px]" />
          <Timer size={1000} className="text-white absolute -top-80 -right-60 rotate-[32deg] blur-[2px]" />
      </div>

      {/* Chronos Header HUD */}
      <header className="flex flex-col lg:flex-row items-center justify-between gap-12 relative z-50">
        <div className="flex items-center gap-10">
          <button onClick={() => router.push('/dashboard')} title="Abort"
            className="w-20 h-20 rounded-[2.5rem] bg-white/[0.03] border-2 border-white/10 flex items-center justify-center text-slate-800 hover:text-white transition-all duration-700 hover:scale-110 active:scale-90 shadow-3xl hover:border-indigo-500/50 backdrop-blur-3xl group">
            <ArrowLeft size={36} className="group-hover:-translate-x-2 transition-transform duration-700" />
          </button>
          <div className="w-24 h-24 bg-indigo-500/5 border-2 border-indigo-500/20 rounded-[3rem] flex items-center justify-center shadow-[0_40px_150px_rgba(99,102,241,0.3)] relative group overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-100" />
             <Calendar size={48} className="text-indigo-400 relative z-10 group-hover:scale-125 transition-transform duration-1000 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-6 mb-4">
              <div className="flex items-center gap-3">
                <Fingerprint size={16} className="text-indigo-400 animate-pulse" />
                <span className="text-[12px] font-black uppercase tracking-[0.8em] text-indigo-400 italic leading-none">Chronos Lattice v24.8.12</span>
              </div>
              <div className="px-6 py-2 rounded-full bg-black/60 border-2 border-white/5 shadow-inner">
                <span className="text-[10px] font-black text-emerald-400 tracking-widest uppercase italic leading-none">TEMPORAL_SYNC_STABLE</span>
              </div>
            </div>
            <h1 className="text-7xl font-black text-white italic uppercase tracking-tighter leading-none drop-shadow-2xl">Chronos</h1>
            <p className="text-slate-800 text-[13px] uppercase font-black tracking-[0.6em] mt-5 italic leading-none">Comprehensive chronological mapping of sovereign content trajectories and temporal clusters.</p>
          </div>
        </div>

        <div className="flex items-center gap-12">
            <button onClick={() => loadLattice(true)} className={`${glassStyle} w-20 h-20 rounded-[2.5rem] border-2 flex items-center justify-center group shadow-3xl active:scale-90 border-white/5 bg-black/40 backdrop-blur-3xl`}>
               <RefreshCw size={32} className={`text-slate-900 group-hover:text-indigo-400 transition-colors duration-700 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button 
              onClick={() => router.push('/dashboard/scheduler')}
              className="px-16 py-8 rounded-[3.5rem] text-[15px] font-black uppercase tracking-[0.6em] shadow-[0_60px_150px_rgba(255,255,255,0.1)] transition-all duration-1000 flex items-center gap-8 italic bg-white text-black hover:bg-indigo-600 hover:text-white hover:scale-110 active:scale-95 group relative overflow-hidden outline-none border-none">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-[2s]" />
              <Plus size={32} className="group-hover:rotate-90 transition-transform duration-1000" /> INITIALIZE_TRAJECTORY
            </button>
        </div>
      </header>

      {/* Temporal Heuristics Matrix */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-10 relative z-10">
         {[
           { label: 'Sync Cycle Load', val: posts.length, icon: Activity, color: 'text-white' },
           { label: 'Locked Nodes', val: posts.filter(p => p.status === 'scheduled').length, icon: Shield, color: 'text-amber-400' },
           { label: 'Synchronous', val: posts.filter(p => p.status === 'posted').length, icon: CheckCircle, color: 'text-emerald-400' },
           { label: 'Diffractions', val: posts.filter(p => p.status === 'failed').length, icon: AlertCircle, color: 'text-rose-400' },
           { label: 'Neural Flux', val: Math.round(posts.length * 1.4).toString()+'M', icon: Zap, color: 'text-purple-400' }
         ].map((s, i) => (
           <motion.div 
             initial={{ opacity: 0, scale: 0.9, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.8, delay: i * 0.1 }}
             key={i} className={`${glassStyle} rounded-[4rem] p-12 relative overflow-hidden group bg-black/40 border-white/5 hover:bg-white/[0.04] shadow-inner flex flex-col items-center text-center`}
           >
              <div className="w-20 h-20 rounded-[2.5rem] bg-white/[0.02] flex items-center justify-center border-2 border-white/10 group-hover:scale-110 group-hover:rotate-12 transition-all duration-1000 mb-8 shadow-3xl">
                 <s.icon size={36} className={s.color} />
              </div>
              <div className="space-y-4">
                 <p className={`text-5xl font-black italic tracking-tighter leading-none drop-shadow-2xl ${s.color}`}>{s.val}</p>
                 <p className="text-[11px] font-black text-slate-900 uppercase tracking-[0.5em] italic leading-none">{s.label}</p>
              </div>
           </motion.div>
         ))}
      </section>

      {/* Main Lattice Interface */}
      <section className={`${glassStyle} rounded-[6rem] overflow-hidden relative z-10 shadow-[0_100px_300px_rgba(0,0,0,1)] border-white/5 bg-black/40`}>
         <div className="p-16 border-b border-white/5 flex flex-col xl:flex-row items-center justify-between gap-16 bg-white/[0.02] relative overflow-hidden backdrop-blur-3xl">
            <div className="absolute top-0 right-0 p-16 opacity-[0.03] pointer-events-none group-hover:opacity-[0.08] transition-opacity duration-[3s]"><LayoutGrid size={800} className="text-white" /></div>
            
            <div className="flex items-center gap-16 relative z-10 w-full xl:w-auto">
               <div className="flex items-center gap-8 p-3 bg-black/60 rounded-[3rem] border-2 border-white/10 shadow-inner">
                  <button onClick={() => navigateCycle(-1)} className="w-16 h-16 rounded-[1.8rem] bg-white/5 border-2 border-white/10 text-white hover:text-indigo-400 transition-all duration-700 active:scale-75 flex items-center justify-center shadow-3xl"><ChevronLeft size={36} /></button>
                  <button onClick={() => setCurrentDate(new Date())} className="px-12 text-[13px] font-black text-slate-700 uppercase tracking-[0.4em] hover:text-white transition-colors duration-700 italic">PRIME_NODE</button>
                  <button onClick={() => navigateCycle(1)} className="w-16 h-16 rounded-[1.8rem] bg-white/5 border-2 border-white/10 text-white hover:text-indigo-400 transition-all duration-700 active:scale-75 flex items-center justify-center shadow-3xl"><ChevronRight size={36} /></button>
               </div>
               <div className="relative group">
                  <div className="absolute inset-0 bg-indigo-500 blur-[80px] opacity-0 group-hover:opacity-20 transition-opacity duration-[2s]" />
                  <h2 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none px-6 drop-shadow-2xl">{view === 'month' ? `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}` : view === 'week' ? 'CURRENT_WEEK_CYCLE' : 'NODE_RESIDENCE'}</h2>
               </div>
            </div>

            <nav className="flex items-center gap-6 p-3 bg-black/60 rounded-[3rem] border-2 border-white/5 shadow-[0_40px_100px_rgba(0,0,0,0.8)] relative z-10">
               {['month','week','day'].map(v => (
                 <button
                   key={v}
                   onClick={() => setView(v as any)}
                   className={`px-14 py-6 rounded-[2.5rem] text-[13px] font-black uppercase tracking-[0.5em] transition-all duration-1000 italic active:scale-90 border-2 ${view === v ? 'bg-white text-black border-white shadow-[0_40px_100px_rgba(255,255,255,0.2)] scale-110' : 'text-slate-800 border-transparent hover:text-white hover:bg-white/[0.04]'}`}
                 >
                   {v === 'month' ? 'LATTICE_EPOCH' : v === 'week' ? 'SYNC_CYCLE' : 'CHRONOS_NODE'}
                 </button>
               ))}
            </nav>
         </div>

         <div className="p-16 min-h-[900px] flex flex-col bg-black/20">
            {view === 'month' && (
              <div className="flex-1">
                 <div className="grid grid-cols-7 gap-6 mb-12 border-b-2 border-white/5 pb-8">
                    {DAY_SHORT.map(d => (
                      <div key={d} className="text-center text-[12px] font-black text-slate-900 uppercase tracking-[1em] py-8 italic border-l border-white/5 last:border-r">{d}</div>
                    ))}
                 </div>
                 <div className="grid grid-cols-7 gap-8">
                    {(() => {
                       const y = currentDate.getFullYear(), m = currentDate.getMonth()
                       const first = new Date(y, m, 1), last = new Date(y, m + 1, 0)
                       const days: (Date | null)[] = []
                       for (let i = 0; i < first.getDay(); i++) days.push(null)
                       for (let d = 1; d <= last.getDate(); d++) days.push(new Date(y, m, d))
                       while (days.length % 7 !== 0) days.push(null)
                       
                       return days.map((date, i) => {
                         if (!date) return <div key={i} className="min-h-[200px] opacity-0 pointer-events-none" />
                         const ds = date.toISOString().split('T')[0]
                         const dp = posts.filter(p => new Date(p.scheduledTime).toISOString().split('T')[0] === ds)
                         const isToday = date.toDateString() === new Date().toDateString()
                         const isPast = date < new Date(new Date().setHours(0,0,0,0))
                         const isTarget = dragOverDate?.toDateString() === date.toDateString()

                         return (
                           <motion.div
                             key={i}
                             onDragOver={e => { e.preventDefault(); setDragOverDate(date) }}
                             onDragLeave={() => setDragOverDate(null)}
                             onDrop={e => handleDrop(e, date)}
                             whileHover={{ scale: 1.05, y: -15, zIndex: 100 }}
                             className={`min-h-[220px] rounded-[4.5rem] p-10 border-2 transition-all duration-1000 relative group overflow-hidden shadow-3xl ${
                               isTarget ? 'border-indigo-400 bg-indigo-500/20 shadow-[0_0_100px_rgba(99,102,241,0.4)] z-50' :
                               isToday ? 'border-indigo-500/60 bg-indigo-500/10 shadow-[0_0_60px_rgba(99,102,241,0.2)]' :
                               'border-white/5 bg-white/[0.01] hover:border-white/20 hover:bg-white/[0.04]'
                             } ${isPast && !isToday ? 'opacity-30 grayscale' : ''}`}
                           >
                              <div className="absolute -top-4 -right-4 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-transparent blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                              <div className="flex justify-between items-start mb-8 relative z-10">
                                 <span className={`text-4xl font-black italic tabular-nums transition-all duration-1000 leading-none drop-shadow-2xl ${isToday ? 'text-indigo-400' : 'text-slate-900 group-hover:text-white'}`}>{date.getDate()}</span>
                                 {dp.length > 0 && (
                                   <div className="px-4 py-1.5 rounded-full bg-indigo-500/10 border-2 border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-widest italic animate-pulse shadow-3xl">LATTICE_{dp.length}</div>
                                 )}
                              </div>
                              <div className="space-y-4 relative z-10">
                                 {dp.slice(0, 3).map(p => {
                                   const cfg = PC[p.platform] || { label: p.platform, gradient: 'from-slate-600 to-black', icon: '?' }
                                   return (
                                     <div
                                       key={p._id}
                                       draggable
                                       onDragStart={e => handleDragStart(e, p)}
                                       onClick={() => setSelectedPost(p)}
                                       className={`flex items-center gap-4 px-4 py-3 rounded-2xl bg-gradient-to-r ${cfg.gradient} text-white cursor-grab active:cursor-grabbing hover:scale-105 transition-all duration-700 shadow-2xl group/chip border-2 border-white/10 overflow-hidden relative group/chip`}
                                     >
                                        <div className="absolute inset-0 bg-white/10 translate-x-full group-hover/chip:translate-x-0 transition-transform duration-700" />
                                        <span className="text-xl font-black flex-shrink-0 group-hover/chip:rotate-12 transition-transform duration-700 relative z-10">{cfg.icon}</span>
                                        <span className="text-[10px] font-black uppercase tracking-tighter truncate italic text-white/90 relative z-10">{p.content.text || cfg.label}</span>
                                     </div>
                                   )
                                 })}
                                 {dp.length > 3 && <p className="text-[11px] font-black text-slate-950 italic text-center uppercase tracking-[0.4em] opacity-40">+{dp.length - 3} OVERFLOW</p>}
                              </div>
                           </motion.div>
                         )
                       })
                    })()}
                 </div>
              </div>
            )}

            {view === 'week' && (
              <div className="flex-1 grid grid-cols-7 gap-10">
                 {(() => {
                    const start = new Date(currentDate); start.setDate(start.getDate() - start.getDay())
                    const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d })
                    return week.map((date, i) => {
                       const ds = date.toISOString().split('T')[0]
                       const dp = posts.filter(p => new Date(p.scheduledTime).toISOString().split('T')[0] === ds)
                       const isToday = date.toDateString() === new Date().toDateString()
                       return (
                         <div key={i} className={`min-h-[700px] rounded-[5rem] p-12 border-2 transition-all duration-1000 shadow-3xl ${isToday ? 'border-indigo-500/60 bg-indigo-500/10 shadow-[0_40px_100px_rgba(99,102,241,0.2)]' : 'border-white/5 bg-white/[0.01]'}`}>
                            <div className="text-center mb-16 border-b-2 border-white/5 pb-10 relative overflow-hidden group">
                               <div className="absolute inset-0 bg-indigo-500/5 translate-y-full group-hover:translate-y-0 transition-transform duration-1000" />
                               <p className="text-[14px] font-black text-slate-950 uppercase tracking-[0.8em] mb-4 italic transition-colors leading-none relative z-10">{DAY_SHORT[date.getDay()]}</p>
                               <p className={`text-6xl font-black italic tabular-nums relative z-10 drop-shadow-2xl transition-colors duration-1000 ${isToday ? 'text-indigo-400' : 'text-white'}`}>{date.getDate()}</p>
                            </div>
                            <div className="space-y-6">
                               {dp.map(p => {
                                 const cfg = PC[p.platform] || { label: p.platform, gradient: 'from-slate-600 to-black', icon: '?' }
                                 return (
                                   <motion.div whileHover={{ y: -15, scale: 1.02 }} key={p._id} onClick={() => setSelectedPost(p)} className={`p-8 rounded-[3rem] bg-gradient-to-br ${cfg.gradient} text-white cursor-pointer shadow-3xl transition-all duration-1000 border-2 border-white/10 group/w relative overflow-hidden`}>
                                      <div className="absolute inset-0 bg-white/5 opacity-0 group-hover/w:opacity-100 transition-opacity duration-1000" />
                                      <div className="flex items-center gap-6 mb-6">
                                         <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 shadow-inner group-hover/w:rotate-12 transition-transform duration-1000">
                                            <span className="text-3xl">{cfg.icon}</span>
                                         </div>
                                         <span className="text-[11px] font-black uppercase tracking-[0.5em] italic opacity-60 group-hover:opacity-100 transition-opacity">{cfg.label}</span>
                                      </div>
                                      <p className="text-[16px] font-bold italic line-clamp-5 leading-relaxed text-slate-100 uppercase tracking-tighter drop-shadow-2xl">{p.content.text}</p>
                                      <div className="flex items-center justify-between pt-8 mt-6 border-t border-white/10">
                                         <div className="flex items-center gap-4">
                                            <Clock size={16} className="text-white/40 group-hover/w:text-indigo-400 transition-colors" />
                                            <p className="text-[12px] font-black text-white/60 tabular-nums italic">{new Date(p.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                         </div>
                                         <ChevronRight size={20} className="text-white/20 group-hover/w:translate-x-2 transition-all" />
                                      </div>
                                   </motion.div>
                                 )
                               })}
                            </div>
                         </div>
                       )
                    })
                 })()}
              </div>
            )}

            {view === 'day' && (
              <div className="flex-1 max-w-6xl mx-auto w-full pt-20">
                 <div className="flex items-center justify-between mb-24 border-b-2 border-white/5 pb-16 px-10">
                    <div className="flex items-center gap-12">
                       <div className="w-24 h-24 bg-indigo-500/10 rounded-[2.5rem] border-2 border-indigo-500/20 flex items-center justify-center shadow-3xl animate-pulse"><Timer size={48} className="text-indigo-400" /></div>
                       <div>
                          <h3 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-none mb-4 drop-shadow-2xl">Terminal Residency: {currentDate.toLocaleDateString().toUpperCase()}</h3>
                          <p className="text-[13px] font-black text-slate-800 uppercase tracking-[0.6em] italic leading-none border-l-4 border-indigo-500/20 pl-8 ml-4">Temporal core scan of scheduled particle diffractions.</p>
                       </div>
                    </div>
                    <div className="flex flex-col items-end gap-5">
                       <div className="px-10 py-4 bg-indigo-500/10 text-indigo-400 text-[13px] font-black uppercase tracking-[0.5em] rounded-[2.5rem] border-2 border-indigo-500/20 shadow-3xl italic transition-all active:scale-90 cursor-default">
                          {posts.filter(p => new Date(p.scheduledTime).toDateString() === currentDate.toDateString()).length} PARTICLE DETECTIONS
                       </div>
                    </div>
                 </div>
                 <div className="space-y-10 px-6">
                    {posts.filter(p => new Date(p.scheduledTime).toDateString() === currentDate.toDateString()).sort((a,b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime()).map(p => {
                      const cfg = PC[p.platform] || { label: p.platform, gradient: 'from-slate-600 to-black', icon: '?' }
                      const scc = SC[p.status] || SC.draft
                      return (
                        <motion.div whileHover={{ x: 30, scale: 1.02 }} key={p._id} onClick={() => setSelectedPost(p)} className="p-14 rounded-[5rem] bg-[#050505] border-2 border-white/5 hover:border-indigo-500/40 transition-all duration-1000 flex items-center gap-16 group cursor-pointer relative overflow-hidden backdrop-blur-3xl shadow-[0_60px_150px_rgba(0,0,0,0.8)]">
                           <div className="absolute top-0 left-0 w-3 h-full bg-indigo-500/50 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 shadow-[0_0_30px_rgba(99,102,241,0.5)]" />
                           <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                           
                           <div className="w-32 text-center flex-shrink-0 border-r-2 border-white/5 pr-16 relative z-10">
                              <p className="text-[28px] font-black text-white italic tabular-nums leading-none drop-shadow-2xl">{new Date(p.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                              <p className="text-[10px] font-black text-slate-950 uppercase tracking-[0.4em] mt-3 italic leading-none opacity-40">UTC_SYNC</p>
                           </div>
                           
                           <div className={`w-24 h-24 rounded-[2.5rem] bg-gradient-to-br ${cfg.gradient} flex items-center justify-center text-white text-5xl shadow-3xl group-hover:rotate-12 transition-transform duration-1000 border-2 border-white/20 relative z-10 flex-shrink-0`}>{cfg.icon}</div>
                           
                           <div className="flex-1 min-w-0 relative z-10">
                              <h4 className="text-3xl font-black text-white uppercase italic truncate mb-6 group-hover:text-indigo-400 transition-colors duration-1000 drop-shadow-2xl">{p.content.text?.toUpperCase() || 'NULL_PAYLOAD'}</h4>
                              <div className="flex items-center gap-8">
                                 <div className={`px-6 py-2.5 rounded-2xl text-[12px] font-black uppercase tracking-[0.4em] border-2 shadow-inner transition-all duration-1000 italic ${scc.bg} ${scc.text}`}>
                                   {scc.label}
                                 </div>
                                 <div className="px-6 py-2.5 rounded-2xl bg-white/[0.03] border-2 border-white/5">
                                   <span className="text-[11px] font-black text-slate-800 uppercase tracking-[0.6em] italic">{cfg.label} NODE ARCHEADYNE</span>
                                 </div>
                              </div>
                           </div>
                           
                           <div className="relative z-10 opacity-0 group-hover:opacity-100 transition-all duration-1000 translate-x-20 group-hover:translate-x-0 pr-6">
                              <div className="w-20 h-20 rounded-[2.5rem] bg-indigo-500/10 border-2 border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-3xl active:scale-75 transition-all">
                                <ArrowRight size={40} className="group-hover:translate-x-2 transition-transform duration-700" />
                              </div>
                           </div>
                        </motion.div>
                      )
                    })}
                    {posts.filter(p => new Date(p.scheduledTime).toDateString() === currentDate.toDateString()).length === 0 && (
                      <div className="py-64 text-center border-[6px] border-dashed border-white/[0.02] rounded-[7rem] opacity-[0.05] group hover:opacity-[0.1] transition-opacity duration-1000">
                         <Radio size={160} className="text-white mx-auto mb-16 animate-pulse" />
                         <p className="text-5xl font-black text-white uppercase tracking-[1em] italic drop-shadow-2xl">NULL_TEMPORAL_ACTIVITY</p>
                      </div>
                    )}
                 </div>
              </div>
            )}
         </div>
      </section>

      {/* Pulse Flux Ledger Visualizer */}
      <section className={`${glassStyle} rounded-[6rem] p-24 bg-black/60 shadow-[0_100px_300px_rgba(0,0,0,1)] border-white/5 relative overflow-hidden group`}>
         <div className="absolute inset-0 bg-indigo-500/[0.01] opacity-0 group-hover:opacity-100 transition-opacity duration-[3s] pointer-events-none" />
         <div className="flex flex-col lg:flex-row items-center justify-between mb-20 gap-12 px-10 pt-4 relative z-10">
            <div className="flex items-center gap-10">
               <div className="w-20 h-20 rounded-[2.5rem] bg-indigo-500/5 border-2 border-indigo-500/20 flex items-center justify-center shadow-3xl group-hover:rotate-[30deg] transition-transform duration-1000 backdrop-blur-3xl"><Activity size={40} className="text-indigo-400 animate-pulse" /></div>
               <div>
                 <h3 className="text-4xl font-black text-white uppercase tracking-tighter italic leading-none mb-4 drop-shadow-2xl">Synchronous Flux Ledger</h3>
                 <p className="text-[13px] font-black text-slate-800 uppercase tracking-[0.5em] italic leading-none border-l-4 border-indigo-500/20 pl-8 ml-4">Real-time meta-data visualization of historical trajectory clusters.</p>
               </div>
            </div>
            <div className="flex items-center gap-10">
               <div className="px-10 py-4 rounded-[2.5rem] bg-black/60 border-2 border-white/5 shadow-inner backdrop-blur-3xl">
                  <span className="text-[11px] font-black text-slate-900 uppercase tracking-[0.6em] italic leading-none">LATTICE_HEURISTICS_SCANNING_v18</span>
               </div>
               <div className="w-3 h-3 rounded-full bg-indigo-500 animate-ping shadow-[0_0_20px_rgba(99,102,241,0.8)]" />
            </div>
         </div>
         
         <div className="overflow-x-auto custom-scrollbar pb-16 relative z-10">
            <div className="flex gap-4 min-w-max px-14">
               {Array.from({ length: 120 }, (_, i) => {
                 const d = new Date(); d.setDate(d.getDate() - (119 - i))
                 const ds = d.toISOString().split('T')[0]
                 const n = heatmap[ds] || 0
                 const pct = n / maxPosts
                 const color = n === 0 ? 'bg-white/5' : pct < 0.25 ? 'bg-indigo-950/50' : pct < 0.5 ? 'bg-indigo-700/70' : pct < 0.75 ? 'bg-indigo-500/90 shadow-[0_0_20px_rgba(99,102,241,0.2)]' : 'bg-indigo-400 shadow-[0_0_40px_rgba(129,140,248,0.6)] border-white/20'
                 return (
                   <motion.div 
                     whileHover={{ scale: 1.8, y: -10, zIndex: 100, rotate: 12 }}
                     transition={{ duration: 0.5, type: "spring", stiffness: 300 }}
                     key={i} title={`${ds}: ${n} Particles Synchronized`}
                     className={`w-8 h-8 rounded-xl ${color} transition-all cursor-pointer border-2 border-white/5 relative group/bit overflow-hidden shadow-2xl`}
                   >
                      <div className="absolute inset-0 bg-white/20 opacity-0 group-hover/bit:opacity-100 transition-opacity duration-700" />
                   </motion.div>
                 )
               })}
            </div>
         </div>
         <div className="flex justify-between items-center px-14 text-[11px] font-black text-slate-900 tracking-[0.8em] italic border-t-2 border-white/5 pt-12 relative z-10 bg-black/40 -mx-24 px-36 -mb-4 pb-12 rounded-b-[6rem]">
            <span className="opacity-40">TEMPORAL_WAVE_OFFSET: 0x882_ALPHA</span>
            <div className="flex items-center gap-12">
               <span className="opacity-30">SCANNING_EPOCH_90D</span>
               <div className="w-[2px] h-6 bg-white/10" />
               <span className="text-white/60">LATTICE_DENSITY: <span className="text-indigo-400">OPTIMIZED</span></span>
            </div>
         </div>
      </section>

      {/* Node Resonance Detail Overlay */}
      <AnimatePresence>
         {selectedPost && (() => {
           const cfg = PC[selectedPost.platform] || { label: selectedPost.platform, gradient: 'from-slate-600 to-black', icon: '?' }
           const scc = SC[selectedPost.status] || SC.draft
           return (
             <div className="fixed inset-0 z-[2000] flex items-center justify-center p-12 overflow-hidden" onClick={() => setSelectedPost(null)}>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/98 backdrop-blur-[150px]" />
                
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 150, rotateX: 45 }}
                  animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: 150, rotateX: 45 }}
                  transition={{ type: "spring", damping: 25, stiffness: 100 }}
                  className={`${glassStyle} rounded-[7rem] p-32 max-w-5xl w-full border-white/20 relative overflow-hidden shadow-[0_150px_400px_rgba(0,0,0,1)] bg-[#050505]`}
                  onClick={e => e.stopPropagation()}
                >
                   <div className="absolute top-0 right-0 p-32 opacity-[0.05] pointer-events-none -translate-y-1/2 translate-x-1/2 scale-150 group-hover:rotate-12 transition-transform duration-[5s]"><Boxes size={800} className="text-white" /></div>
                   
                   <div className="flex items-center gap-16 mb-24 relative z-10 border-b-2 border-white/5 pb-16">
                      <div className={`w-32 h-32 rounded-[3.5rem] bg-gradient-to-br ${cfg.gradient} flex items-center justify-center text-white text-6xl shadow-3xl border-4 border-white/20 group-hover:rotate-[30deg] transition-transform duration-1000`}>{cfg.icon}</div>
                      <div>
                         <h2 className="text-7xl font-black text-white italic uppercase tracking-tighter leading-none mb-4 drop-shadow-2xl">Trajectory Parameters</h2>
                         <div className="flex items-center gap-6">
                            <div className={`px-8 py-2 rounded-2xl ${scc.bg} ${scc.text} border-2 border-white/5 text-[12px] font-black uppercase tracking-[0.5em] italic shadow-2xl shadow-black/80`}>{scc.label}</div>
                            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping shadow-[0_0_20px_rgba(99,102,241,0.5)]" />
                            <p className="text-[12px] font-black text-slate-800 uppercase tracking-[0.6em] italic leading-none">{cfg.label} NODE RESIDENCE</p>
                         </div>
                      </div>
                      <button onClick={() => setSelectedPost(null)} className="ml-auto w-24 h-24 rounded-[3rem] bg-white/[0.03] border-4 border-white/10 flex items-center justify-center text-slate-900 hover:text-white hover:bg-rose-600 hover:border-rose-400 transition-all duration-700 hover:scale-110 active:scale-75 shadow-3xl group/close">
                         <X size={48} className="group-hover/close:rotate-180 transition-transform duration-1000" />
                      </button>
                   </div>

                   <div className="space-y-20 relative z-10">
                      <div className="p-16 rounded-[5rem] bg-black/60 border-4 border-white/5 shadow-inner group hover:border-indigo-500/30 transition-all duration-1000 relative overflow-hidden">
                         <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                         <p className="text-[13px] font-black text-slate-900 uppercase tracking-[0.8em] mb-10 italic leading-none ml-6 border-l-2 border-white/5 pl-8">PAYLOAD_BUFFER_LOGIC</p>
                         <p className="text-4xl font-black italic text-white leading-relaxed uppercase tracking-tighter group-hover:text-indigo-400 transition-colors duration-1000 drop-shadow-2xl">{selectedPost.content.text || 'NULL_PAYLOAD_DETECTED'}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-20 px-16">
                         <div className="space-y-8 border-l-8 border-indigo-500/20 pl-12 group/param">
                            <p className="text-[13px] font-black text-slate-900 uppercase tracking-[0.8em] italic leading-none group-hover/param:text-indigo-400 transition-colors duration-700">SYNCHRONIZED_NODAL_TIME</p>
                            <p className="text-6xl font-black text-white italic tabular-nums group-hover/param:scale-105 transition-transform duration-1000 origin-left drop-shadow-2xl">{new Date(selectedPost.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                         </div>
                         <div className="space-y-8 border-l-8 border-indigo-500/20 pl-12 group/param">
                            <p className="text-[13px] font-black text-slate-900 uppercase tracking-[0.8em] italic leading-none group-hover/param:text-indigo-400 transition-colors duration-700">TEMPORAL_EPOCH_REFERENCE</p>
                            <p className="text-6xl font-black text-white italic tabular-nums group-hover/param:scale-105 transition-transform duration-1000 origin-left drop-shadow-2xl">{new Date(selectedPost.scheduledTime).toLocaleDateString().toUpperCase()}</p>
                         </div>
                      </div>

                      <div className="flex items-center justify-between gap-16 pt-20 border-t-2 border-white/5">
                         <button onClick={() => handlePurge(selectedPost._id)} className="px-16 py-8 text-[15px] font-black text-rose-500/30 hover:text-rose-600 uppercase tracking-[1em] italic transition-all duration-1000 hover:scale-110 active:scale-75 group/purge flex items-center gap-6">
                            <Trash2 size={24} className="group-hover/purge:rotate-12 transition-transform" /> TERMINATE_PARTICLE
                         </button>
                         <button onClick={() => setSelectedPost(null)} className="px-28 py-10 bg-white text-black rounded-[4rem] text-[20px] font-black uppercase tracking-[0.8em] shadow-[0_60px_150px_rgba(255,255,255,0.1)] hover:bg-indigo-600 hover:text-white transition-all duration-1000 italic active:scale-95 group/seal relative overflow-hidden border-none outline-none">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/seal:translate-x-full transition-transform duration-[1.5s]" />
                            SEAL_NODE_RESIDENCE
                         </button>
                      </div>
                   </div>
                </motion.div>
             </div>
           )
         })()}
      </AnimatePresence>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        
        body { font-family: 'Inter', sans-serif; background: #020205; color: white; overflow-x: hidden; }
        .custom-scrollbar::-webkit-scrollbar { height: 10px; width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.4); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.3); border-radius: 10px; border: 2px solid #020205; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.5); }
        
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 40s linear infinite; }
        .shadow-3xl { filter: drop-shadow(0 40px 100px rgba(0,0,0,0.8)); }
      `}</style>
    </div>
  )
}
