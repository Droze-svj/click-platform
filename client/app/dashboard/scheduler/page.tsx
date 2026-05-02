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

interface ScheduledPost {
  _id: string; platform: string;
  content: { text: string; mediaUrl?: string; hashtags?: string[] };
  scheduledTime: string; status: 'scheduled' | 'posted' | 'failed' | 'draft';
  contentId?: { _id: string; title: string };
}

const PLATFORMS = [
  { id: 'tiktok',    label: 'TikTok',    gradient: 'from-surface-900 to-black',       charLimit: 2200, icon: '♪' },
  { id: 'instagram', label: 'Instagram', gradient: 'from-pink-500 to-purple-600',   charLimit: 2200, icon: '◎' },
  { id: 'youtube',   label: 'YouTube',   gradient: 'from-rose-500 to-rose-700',       charLimit: 5000, icon: '▶' },
  { id: 'twitter',   label: 'X (Twitter)',gradient: 'from-surface-700 to-surface-900',  charLimit: 280,  icon: '𝕏' },
  { id: 'linkedin',  label: 'LinkedIn',  gradient: 'from-blue-500 to-blue-700',     charLimit: 3000, icon: 'in' },
  { id: 'facebook',  label: 'Facebook',  gradient: 'from-indigo-500 to-indigo-700', charLimit: 63206, icon: 'f' },
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
      <div className="min-h-screen bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-surface-50 transition-colors duration-500 font-inter pb-32">
        <ToastContainer />

        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 py-8 relative z-10 space-y-10">
          
          {/* Header */}
          <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 border-b border-surface-200 dark:border-surface-800 pb-8">
             <div className="flex items-center gap-6">
                <button onClick={() => router.push('/dashboard')} className="w-12 h-12 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 flex items-center justify-center text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors shadow-sm">
                  <ArrowLeft size={20} />
                </button>
                <div className="w-16 h-16 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-2xl flex items-center justify-center shadow-sm">
                  <Send size={32} className="text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                   <div className="flex items-center gap-2 mb-1">
                     <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400 uppercase tracking-wide border border-primary-200 dark:border-primary-800">
                       Distribution Hub
                     </span>
                   </div>
                   <h1 className="text-3xl sm:text-4xl font-black text-surface-900 dark:text-white tracking-tight leading-none mt-1">Multi-Platform Scheduler</h1>
                   <p className="text-surface-500 text-sm mt-2 font-medium">Compose once, distribute everywhere. Let AI pick the best time to post.</p>
                </div>
             </div>

             <div className="flex items-center gap-4">
                <button onClick={() => loadSchedule(true)} disabled={refreshing} className="w-12 h-12 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 flex items-center justify-center text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors shadow-sm disabled:opacity-50">
                  <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
                </button>
                <button onClick={() => router.push('/dashboard/calendar')} className="px-6 py-3 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-colors flex items-center gap-2">
                  <Calendar size={18} /> View Calendar
                </button>
             </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
             {/* Composer */}
             <div className="lg:col-span-3 space-y-8">
                <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl p-8 sm:p-10 shadow-sm">
                   <h3 className="text-sm font-bold text-surface-900 dark:text-white mb-6 flex items-center gap-2 uppercase tracking-wider"><Layers size={18} className="text-primary-600 dark:text-primary-400" /> Select Platforms</h3>
                   <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-10">
                      {PLATFORMS.map(p => {
                        const active = selectedPlatforms.includes(p.id)
                        return (
                          <button key={p.id} onClick={() => setSelectedPlatforms(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}
                            className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${active ? `border-transparent bg-gradient-to-br ${p.gradient} shadow-md scale-105` : 'bg-surface-50 dark:bg-surface-950 border-surface-200 dark:border-surface-800 text-surface-400 hover:border-surface-300 dark:hover:border-surface-700'}`}
                          >
                            <span className={`text-2xl ${active ? 'text-white drop-shadow-md' : 'opacity-60'}`}>{p.icon}</span>
                          </button>
                        )
                      })}
                   </div>

                   <h3 className="text-sm font-bold text-surface-900 dark:text-white mb-6 flex items-center gap-2 uppercase tracking-wider"><Edit3 size={18} className="text-primary-600 dark:text-primary-400" /> Compose Post</h3>
                   <div className="relative mb-10">
                      <textarea
                        ref={textareaRef}
                        value={postText}
                        onChange={e => { setPostText(e.target.value); autoResize() }}
                        placeholder="Write your caption here..."
                        className={`w-full bg-surface-50 dark:bg-surface-950 border rounded-2xl p-6 text-base font-medium text-surface-900 dark:text-white placeholder:text-surface-400 focus:outline-none focus:ring-2 transition-all resize-none min-h-[160px] ${charCount > currentLimit ? 'border-rose-300 dark:border-rose-700/50 ring-rose-500/20' : 'border-surface-200 dark:border-surface-800 focus:ring-primary-500/30 focus:border-primary-500/50'}`}
                      />
                      <div className={`absolute bottom-4 right-4 text-[10px] font-bold px-3 py-1.5 rounded-lg border ${charCount > currentLimit ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800/50' : 'bg-white dark:bg-surface-900 text-surface-500 border-surface-200 dark:border-surface-800'}`}>
                         {charCount} / {currentLimit}
                      </div>
                   </div>

                   <h3 className="text-sm font-bold text-surface-900 dark:text-white mb-6 flex items-center gap-2 uppercase tracking-wider"><Clock size={18} className="text-primary-600 dark:text-primary-400" /> Schedule Time</h3>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                      <button onClick={() => setUseOptimalTime(true)} className={`p-6 rounded-2xl border-2 flex flex-col items-start gap-2 transition-all text-left ${useOptimalTime ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700 shadow-sm' : 'bg-surface-50 dark:bg-surface-950 border-surface-200 dark:border-surface-800 hover:border-surface-300 dark:hover:border-surface-700'}`}>
                         <Zap size={24} className={useOptimalTime ? 'text-primary-600 dark:text-primary-400' : 'text-surface-400'} />
                         <div>
                            <span className={`block text-sm font-bold mb-1 ${useOptimalTime ? 'text-primary-900 dark:text-primary-50' : 'text-surface-900 dark:text-white'}`}>Optimal AI Time</span>
                            <span className={`text-xs font-medium ${useOptimalTime ? 'text-primary-700 dark:text-primary-400' : 'text-surface-500'}`}>Posts when followers are most active</span>
                         </div>
                      </button>
                      <button onClick={() => setUseOptimalTime(false)} className={`p-6 rounded-2xl border-2 flex flex-col items-start gap-2 transition-all text-left ${!useOptimalTime ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700 shadow-sm' : 'bg-surface-50 dark:bg-surface-950 border-surface-200 dark:border-surface-800 hover:border-surface-300 dark:hover:border-surface-700'}`}>
                         <Calendar size={24} className={!useOptimalTime ? 'text-primary-600 dark:text-primary-400' : 'text-surface-400'} />
                         <div>
                            <span className={`block text-sm font-bold mb-1 ${!useOptimalTime ? 'text-primary-900 dark:text-primary-50' : 'text-surface-900 dark:text-white'}`}>Custom Time</span>
                            <span className={`text-xs font-medium ${!useOptimalTime ? 'text-primary-700 dark:text-primary-400' : 'text-surface-500'}`}>Select a specific date and exact time</span>
                         </div>
                      </button>
                   </div>

                   <AnimatePresence>
                     {!useOptimalTime && (
                       <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-10 overflow-hidden">
                          <input type="datetime-local" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)}
                            className="w-full bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 rounded-2xl px-6 py-4 text-sm font-bold text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
                          />
                       </motion.div>
                     )}
                   </AnimatePresence>

                   <div className="pt-4 border-t border-surface-200 dark:border-surface-800">
                     <button onClick={handleSchedulePost} disabled={submitting || charCount > currentLimit || selectedPlatforms.length === 0}
                       className="w-full py-5 bg-primary-600 text-white rounded-2xl text-sm font-bold uppercase tracking-wider hover:bg-primary-700 transition-colors shadow-sm flex items-center justify-center gap-3 disabled:opacity-50"
                     >
                       {submitting ? <RefreshCw className="animate-spin" size={20} /> : <Send size={20} />}
                       {submitting ? 'Scheduling...' : 'Schedule to Multiple Platforms'}
                     </button>
                   </div>
                </div>
             </div>

             {/* Queue Sidebar */}
             <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between mb-2">
                   <h3 className="text-xl font-black text-surface-900 dark:text-white tracking-tight">Upcoming Queue</h3>
                   <span className="px-3 py-1 bg-surface-100 dark:bg-surface-800 rounded-lg text-[10px] font-bold text-surface-600 dark:text-surface-400 uppercase tracking-wider">{upcomingPosts.length} Posts</span>
                </div>
                <p className="text-surface-500 text-sm font-medium mb-6">Your next posts scheduled for delivery.</p>
                
                {loading ? (
                  <div className="py-24 flex flex-col items-center justify-center text-center gap-4 bg-white dark:bg-surface-900 rounded-3xl border border-surface-200 dark:border-surface-800 shadow-sm">
                     <RefreshCw size={32} className="text-primary-500 animate-spin" />
                     <p className="text-xs font-bold text-surface-500 uppercase tracking-wider">Loading queue...</p>
                  </div>
                ) : upcomingPosts.length === 0 ? (
                  <div className="bg-white dark:bg-surface-900 p-12 rounded-3xl text-center border border-dashed border-surface-300 dark:border-surface-700 flex flex-col items-center gap-4 shadow-sm">
                     <div className="w-16 h-16 bg-surface-50 dark:bg-surface-950 rounded-2xl flex items-center justify-center border border-surface-200 dark:border-surface-800">
                        <Calendar size={32} className="text-surface-400" />
                     </div>
                     <div>
                        <p className="text-lg font-black text-surface-900 dark:text-white tracking-tight mb-1">Queue Empty</p>
                        <p className="text-sm font-medium text-surface-500">No posts scheduled yet. Use the composer to schedule your first post.</p>
                     </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                     {upcomingPosts.slice(0, 8).map((post) => {
                       const pl = PLATFORMS.find(p => p.id === post.platform)
                       return (
                         <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={post._id}
                           className="bg-white dark:bg-surface-900 p-6 rounded-2xl flex items-start gap-4 border border-surface-200 dark:border-surface-800 shadow-sm group hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
                         >
                            <div className={`w-12 h-12 rounded-xl shrink-0 bg-gradient-to-br ${pl?.gradient || 'from-surface-600 to-surface-800'} flex items-center justify-center text-white text-xl shadow-sm border border-black/10`}>
                              {pl?.icon}
                            </div>
                            <div className="flex-1 min-w-0 pt-1">
                               <p className="text-sm font-bold text-surface-900 dark:text-white truncate mb-2">{post.content.text || 'No text content'}</p>
                               <div className="flex items-center gap-2 text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider">
                                  <Clock size={14} /> {new Date(post.scheduledTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                               </div>
                            </div>
                            <button onClick={() => handleDelete(post._id)} className="w-8 h-8 flex items-center justify-center text-surface-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors self-center md:opacity-0 md:group-hover:opacity-100">
                               <Trash2 size={16} />
                            </button>
                         </motion.div>
                       )
                     })}
                     {upcomingPosts.length > 8 && (
                       <button onClick={() => router.push('/dashboard/calendar')} className="w-full py-4 text-xs font-bold text-surface-600 dark:text-surface-400 uppercase tracking-wider hover:text-surface-900 dark:hover:text-white transition-colors bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm hover:bg-surface-50 dark:hover:bg-surface-800">
                         View all {upcomingPosts.length} posts in Calendar
                       </button>
                     )}
                  </div>
                )}
             </div>
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
