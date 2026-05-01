'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar, Clock, Zap, Trash2, Layers, CheckCircle,
  AlertCircle, RefreshCw, ArrowRight, Eye, Send, ArrowLeft, Image as ImageIcon
} from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'
import { extractApiData } from '../../../utils/apiResponse'
import ToastContainer from '../../../components/ToastContainer'
import { ErrorBoundary } from '../../../components/ErrorBoundary'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'
const glassStyle = 'backdrop-blur-3xl bg-white/[0.02] border border-white/5 shadow-2xl transition-all duration-300'

interface ScheduledPost {
  _id: string; platform: string;
  content: { text: string; mediaUrl?: string; hashtags?: string[] };
  scheduledTime: string; status: 'scheduled' | 'posted' | 'failed' | 'draft';
  contentId?: { _id: string; title: string };
}

const PLATFORMS = [
  { id: 'tiktok',    label: 'TikTok',    gradient: 'from-slate-800 to-black',       charLimit: 2200, icon: '♪' },
  { id: 'instagram', label: 'Instagram', gradient: 'from-pink-500 to-purple-600',   charLimit: 2200, icon: '◎' },
  { id: 'youtube',   label: 'YouTube',   gradient: 'from-red-600 to-red-900',       charLimit: 5000, icon: '▶' },
  { id: 'twitter',   label: 'X (Twitter)',gradient: 'from-slate-700 to-slate-900',  charLimit: 280,  icon: '𝕏' },
  { id: 'linkedin',  label: 'LinkedIn',  gradient: 'from-blue-600 to-blue-900',     charLimit: 3000, icon: 'in' },
  { id: 'facebook',  label: 'Facebook',  gradient: 'from-indigo-600 to-indigo-900', charLimit: 63206, icon: 'f' },
]

export default function ContentSchedulerPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [posts, setPosts] = useState<ScheduledPost[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [postText, setPostText] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['tiktok'])
  const [scheduledTime, setScheduledTime] = useState('')
  const [useOptimalTime, setUseOptimalTime] = useState(true)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const loadSchedule = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await axios.get(`${API_URL}/scheduler`)
      const data = extractApiData<ScheduledPost[]>(res) || []
      setPosts(Array.isArray(data) ? data : [])
    } catch (err) {
      showToast('Failed to load scheduled posts', 'error')
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }, [showToast])

  useEffect(() => {
    if (!user) { router.push('/login'); return }
    loadSchedule()
    const next = new Date()
    next.setHours(next.getHours() + 1, 0, 0, 0)
    setScheduledTime(next.toISOString().slice(0, 16))
  }, [user, router, loadSchedule])

  const handleSchedulePost = async () => {
    if (!postText.trim()) { showToast('Please enter post content', 'warning'); return }
    if (selectedPlatforms.length === 0) { showToast('Select at least one platform', 'warning'); return }
    setSubmitting(true)
    try {
      await Promise.all(selectedPlatforms.map(platform => {
        const body = {
          platform,
          content: { text: postText },
          ...(useOptimalTime ? {} : { scheduledTime: new Date(scheduledTime).toISOString() }),
        }
        return axios.post(useOptimalTime ? `${API_URL}/scheduling/optimal` : `${API_URL}/scheduler`, body)
      }))
      showToast('Post scheduled successfully', 'success')
      setPostText('')
      loadSchedule()
    } catch (err: any) {
      showToast('Failed to schedule post', 'error')
    } finally { setSubmitting(false) }
  }

  const handleDelete = async (id: string) => {
    try {
      await axios.delete(`${API_URL}/scheduler/posts/${id}`)
      showToast('Post deleted', 'success')
      setPosts(prev => prev.filter(p => p._id !== id))
    } catch { showToast('Failed to delete post', 'error') }
  }

  const autoResize = () => {
    const el = textareaRef.current
    if (el) { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 400)}px` }
  }

  const currentLimit = useMemo(() => {
    const limits = selectedPlatforms.map(id => PLATFORMS.find(p => p.id === id)?.charLimit || 9999)
    return Math.min(...limits)
  }, [selectedPlatforms])
  
  const charCount = postText.length
  const upcomingPosts = posts.filter(p => p.status === 'scheduled')

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-10 pt-16 max-w-[1500px] mx-auto space-y-16 font-inter">
        <ToastContainer />

        {/* Header */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 relative z-50">
           <div className="flex items-center gap-8">
              <button onClick={() => router.push('/dashboard')} className="w-14 h-14 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all hover:scale-105 active:scale-95 shadow-xl hover:border-white/20 backdrop-blur-3xl group">
                <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
              </button>
              <div className="w-16 h-16 bg-[var(--tint-emerald-bg)] border border-[var(--tint-emerald-edge)] rounded-2xl flex items-center justify-center shadow-lg relative">
                <Send size={32} className="text-[var(--tint-emerald-fg)]" />
              </div>
              <div>
                 <h1 className="text-4xl font-bold text-white tracking-tight drop-shadow-md">Multi-Platform Scheduler</h1>
                 <p className="text-slate-400 text-sm mt-1 font-medium">Compose once, distribute everywhere. Let AI pick the best time to post.</p>
              </div>
           </div>

           <div className="flex items-center gap-6">
              <button onClick={() => loadSchedule(true)} className={`${glassStyle} w-14 h-14 rounded-full flex items-center justify-center group active:scale-95 hover:bg-white/[0.05]`}>
                <RefreshCw size={24} className={`text-slate-400 group-hover:text-[var(--tint-emerald-fg)] transition-colors ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={() => router.push('/dashboard/calendar')} className="px-8 py-4 bg-white/[0.02] border border-white/5 text-slate-300 hover:text-white hover:bg-white/[0.05] rounded-full text-sm font-bold shadow-lg transition-all flex items-center gap-3">
                <Calendar size={20} /> View Calendar
              </button>
           </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 relative z-10">
           {/* Composer */}
           <div className="lg:col-span-3 space-y-8">
              <div className={`${glassStyle} rounded-3xl p-10 bg-[#050505]`}>
                 <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-3"><Layers size={20} className="text-[var(--tint-emerald-fg)]" /> Select Platforms</h3>
                 <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 mb-10">
                    {PLATFORMS.map(p => {
                      const active = selectedPlatforms.includes(p.id)
                      return (
                        <button key={p.id} onClick={() => setSelectedPlatforms(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}
                          className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${active ? `border-transparent bg-gradient-to-br ${p.gradient} shadow-lg scale-105` : 'bg-black/40 border-white/5 opacity-50 hover:opacity-100 hover:border-white/20'}`}
                        >
                          <span className="text-2xl text-white drop-shadow-md">{p.icon}</span>
                        </button>
                      )
                    })}
                 </div>

                 <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-3"><Edit3 size={20} className="text-[var(--tint-emerald-fg)]" /> Compose Post</h3>
                 <div className="relative mb-10">
                    <textarea
                      ref={textareaRef}
                      value={postText}
                      onChange={e => { setPostText(e.target.value); autoResize() }}
                      placeholder="Write your caption here..."
                      className={`w-full bg-black/60 border rounded-2xl p-6 text-lg text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 transition-all resize-none min-h-[160px] ${charCount > currentLimit ? 'border-rose-500/50 ring-rose-500/20' : 'border-white/10 focus:ring-emerald-500/20 focus:border-emerald-500/50'}`}
                    />
                    <div className={`absolute bottom-4 right-4 text-xs font-bold px-3 py-1 rounded-full backdrop-blur-md ${charCount > currentLimit ? 'bg-[var(--tint-rose-bg)] text-[var(--tint-rose-fg)]' : 'bg-white/10 text-slate-400'}`}>
                       {charCount} / {currentLimit}
                    </div>
                 </div>

                 <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-3"><Clock size={20} className="text-[var(--tint-emerald-fg)]" /> Schedule Time</h3>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                    <button onClick={() => setUseOptimalTime(true)} className={`p-6 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${useOptimalTime ? 'bg-[var(--tint-emerald-bg)] border-emerald-500/50 text-[var(--tint-emerald-fg)]' : 'bg-black/40 border-white/5 text-slate-400 hover:border-white/20'}`}>
                       <Zap size={28} />
                       <span className="font-bold">Optimal AI Time</span>
                       <span className="text-xs opacity-60">Posts when followers are active</span>
                    </button>
                    <button onClick={() => setUseOptimalTime(false)} className={`p-6 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${!useOptimalTime ? 'bg-[var(--tint-indigo-bg)] border-indigo-500/50 text-[var(--tint-indigo-fg)]' : 'bg-black/40 border-white/5 text-slate-400 hover:border-white/20'}`}>
                       <Calendar size={28} />
                       <span className="font-bold">Custom Time</span>
                       <span className="text-xs opacity-60">Select a specific date and time</span>
                    </button>
                 </div>

                 {!useOptimalTime && (
                   <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-10">
                      <input type="datetime-local" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)}
                        className="w-full bg-black/80 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-indigo-500/50 transition-all color-scheme-dark"
                      />
                   </motion.div>
                 )}

                 <button onClick={handleSchedulePost} disabled={submitting || charCount > currentLimit || selectedPlatforms.length === 0}
                   className="w-full py-5 bg-white text-black rounded-2xl font-bold hover:bg-emerald-500 hover:text-white transition-all shadow-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   {submitting ? <RefreshCw className="animate-spin" size={24} /> : <Send size={24} />}
                   {submitting ? 'Scheduling...' : 'Schedule to Multiple Platforms'}
                 </button>
              </div>
           </div>

           {/* Queue Sidebar */}
           <div className="lg:col-span-2 space-y-6">
              <h3 className="text-2xl font-bold text-white mb-2">Upcoming Queue</h3>
              <p className="text-slate-400 text-sm mb-6">Your next posts scheduled for delivery.</p>
              
              {loading ? (
                <div className="py-20 text-center"><RefreshCw size={40} className="text-indigo-500 animate-spin mx-auto" /></div>
              ) : upcomingPosts.length === 0 ? (
                <div className={`${glassStyle} p-12 rounded-3xl text-center border-dashed`}>
                   <Calendar size={48} className="text-slate-600 mx-auto mb-4" />
                   <p className="text-slate-400 font-medium">No posts scheduled yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                   {upcomingPosts.slice(0, 8).map((post) => {
                     const pl = PLATFORMS.find(p => p.id === post.platform)
                     return (
                       <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} key={post._id}
                         className={`${glassStyle} p-6 rounded-2xl flex gap-4 bg-black/40 hover:bg-white/[0.04] group`}
                       >
                          <div className={`w-12 h-12 rounded-xl shrink-0 bg-gradient-to-br ${pl?.gradient || 'from-gray-600 to-black'} flex items-center justify-center text-white text-xl shadow-md`}>
                            {pl?.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                             <p className="text-white font-medium truncate mb-1">{post.content.text || 'No text content'}</p>
                             <div className="flex items-center gap-2 text-xs text-[var(--tint-amber-fg)]/80 font-medium">
                                <Clock size={14} /> {new Date(post.scheduledTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                             </div>
                          </div>
                          <button onClick={() => handleDelete(post._id)} className="p-2 text-slate-500 hover:text-[var(--tint-rose-fg)] hover:bg-[var(--tint-rose-bg)] rounded-lg transition-colors self-center opacity-0 group-hover:opacity-100">
                             <Trash2 size={18} />
                          </button>
                       </motion.div>
                     )
                   })}
                   {upcomingPosts.length > 8 && (
                     <button onClick={() => router.push('/dashboard/calendar')} className="w-full py-4 text-sm font-bold text-[var(--tint-indigo-fg)] hover:text-indigo-300 transition-colors bg-indigo-500/5 rounded-2xl border border-indigo-500/10">
                       View all {upcomingPosts.length} posts in Calendar
                     </button>
                   )}
                </div>
              )}
           </div>
        </div>

      </div>
    </ErrorBoundary>
  )
}

// Ensure Edit3 is available
const Edit3 = ({ className, size }: { className?: string; size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
)
