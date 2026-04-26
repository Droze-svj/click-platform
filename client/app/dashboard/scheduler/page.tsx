'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar, Clock, Plus, Zap, Trash2, ChevronRight, CheckCircle,
  AlertCircle, Layers, Globe, Sparkles, BarChart2, X, Send, Hash,
  RefreshCw, ArrowRight, Eye, Flame, Filter, Target, TrendingUp,
  Moon, Sun, Edit3, Copy, MoreHorizontal, Shield, Activity, Cpu, Radio,
  Hexagon, Terminal, ArrowLeft, Gauge, Network, Database, ActivitySquare,
  Monitor, Boxes, Command, CircuitBoard, Fingerprint
} from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'
import { extractApiData, extractApiError } from '../../../utils/apiResponse'
import ToastContainer from '../../../components/ToastContainer'
import { ErrorBoundary } from '../../../components/ErrorBoundary'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'
const glassStyle = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl transition-all duration-500'

interface ScheduledPost {
  _id: string; platform: string;
  content: { text: string; mediaUrl?: string; hashtags?: string[] };
  scheduledTime: string; status: 'scheduled' | 'posted' | 'failed' | 'draft';
  contentId?: { _id: string; title: string };
}

const PLATFORMS = [
  { id: 'tiktok',    label: 'BYTE_NODE', short: 'TikTok',    gradient: 'from-slate-800 to-black',       charLimit: 2200, icon: '♪',  tips: 'Optimal frequency. Use trend saturation algorithms.' },
  { id: 'instagram', label: 'VISUAL_NODE', short: 'IG',        gradient: 'from-pink-500 to-purple-600',     charLimit: 2200, icon: '◎',  tips: 'Lead with visual saturation. High neural engagement.' },
  { id: 'youtube',   label: 'STREAM_NODE', short: 'YT',        gradient: 'from-red-600 to-red-900',         charLimit: 5000, icon: '▶',  tips: 'SEO-rich metadata converts high-tier traffic.' },
  { id: 'twitter',   label: 'X_NODE', short: 'X',         gradient: 'from-slate-400 to-slate-900',         charLimit: 280,  icon: '𝕏',  tips: 'Concise trajectory. Neural threads perform optimal.' },
  { id: 'linkedin',  label: 'B2B_NODE', short: 'LinkedIn',  gradient: 'from-blue-600 to-blue-900',       charLimit: 3000, icon: 'in', tips: 'Sovereign tone. Inject professional insights.' },
  { id: 'facebook',  label: 'META_NODE', short: 'FB',        gradient: 'from-indigo-600 to-indigo-900',   charLimit: 63206, icon: 'f', tips: 'Long-form synthesis performs well here.' },
]

const SC: Record<string, { label: string; bg: string; text: string }> = {
  scheduled: { label: 'Sync_Locked', bg: 'bg-amber-500/10 border-amber-500/20',   text: 'text-amber-400' },
  posted:    { label: 'Manifested',  bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400' },
  failed:    { label: 'Diffraction', bg: 'bg-rose-500/10 border-rose-500/20',        text: 'text-rose-400' },
  draft:     { label: 'Cached', bg: 'bg-slate-500/10 border-slate-500/20',         text: 'text-slate-400' },
}

const SATURATION_WINDOWS = [
  { time: '09:00', days: 'Mon – Fri', score: 95, label: '🔥 Peak_Flux' },
  { time: '12:00', days: 'Tue – Thu', score: 88, label: '⚡ High_Resonance' },
  { time: '17:30', days: 'Mon – Wed', score: 81, label: '⚡ High_Resonance' },
  { time: '20:00', days: 'Thu – Sat', score: 76, label: '✨ Stable_Axiom' },
]

export default function TemporalOrchestratorPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [posts, setPosts] = useState<ScheduledPost[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<'compose' | 'queue'>('compose')
  const [postText, setPostText] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['tiktok'])
  const [scheduledTime, setScheduledTime] = useState('')
  const [useOptimalTime, setUseOptimalTime] = useState(true)
  const [hashtags, setHashtags] = useState('')
  const [contentId, setContentId] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const loadManifests = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await axios.get(`${API_URL}/scheduler`)
      const data = extractApiData<ScheduledPost[]>(res) || []
      setPosts(Array.isArray(data) ? data : [])
    } catch (err) {
      showToast('SYNC_ERR: ORCHESTRATOR_VOID', 'error')
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }, [showToast])

  useEffect(() => {
    if (!user) { router.push('/login'); return }
    loadManifests()
    const next = new Date()
    next.setHours(next.getHours() + 1, 0, 0, 0)
    setScheduledTime(next.toISOString().slice(0, 16))
  }, [user, router, loadManifests])

  const handleManifestTrajector = async () => {
    if (!postText.trim() && !contentId) { showToast('UPLINK_ERR: TRAJECTORY_VOID', 'warning'); return }
    if (selectedPlatforms.length === 0) { showToast('UPLINK_ERR: NODE_UNDEFINED', 'warning'); return }
    setSubmitting(true)
    try {
      const tags = hashtags.split(/[\s,#]+/).filter(h => h.trim())
      await Promise.all(selectedPlatforms.map(platform => {
        const body = {
          platform,
          content: { text: postText, hashtags: tags },
          ...(contentId ? { contentId } : {}),
          ...(useOptimalTime ? {} : { scheduledTime: new Date(scheduledTime).toISOString() }),
        }
        return axios.post(useOptimalTime ? `${API_URL}/scheduling/optimal` : `${API_URL}/scheduler`, body)
      }))
      showToast('✓ TRAJECTORY_MANIFESTED: CHRONOS_LOCKED', 'success')
      setPostText(''); setHashtags(''); setContentId('')
      loadManifests(); setActiveTab('queue')
    } catch (err: any) {
      showToast('SYNC_ERR: MANIFESTATION_ABORTED', 'error')
    } finally { setSubmitting(false) }
  }

  const handleDeManifest = async (id: string) => {
    try {
      await axios.delete(`${API_URL}/scheduler/posts/${id}`)
      showToast('✓ TRAJECTORY_PURGED', 'success')
      setPosts(prev => prev.filter(p => p._id !== id))
    } catch { showToast('PURGE_ERR: DELETION_FAILED', 'error') }
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
  const filteredManifests = posts.filter(p => filterStatus === 'all' || p.status === filterStatus)

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-10 pt-16 max-w-[1750px] mx-auto space-y-24">
        <ToastContainer />
        <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
           <Fingerprint size={800} className="text-white absolute -bottom-40 -right-40 rotate-12" />
        </div>

        {/* Orchestrator Header */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-16 relative z-50">
           <div className="flex items-center gap-12">
              <button onClick={() => router.push('/dashboard')} title="Abort"
                className="w-16 h-16 rounded-[1.8rem] bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-2xl">
                <ArrowLeft size={32} />
              </button>
              <div className="w-24 h-24 bg-amber-500/5 border border-amber-500/20 rounded-[3rem] flex items-center justify-center shadow-2xl relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-transparent opacity-100" />
                <Calendar size={44} className="text-amber-400 relative z-10 group-hover:rotate-12 transition-transform duration-300" />
              </div>
              <div>
                 <div className="flex items-center gap-6 mb-3">
                   <div className="flex items-center gap-3">
                      <Network size={16} className="text-amber-400 animate-pulse" />
                      <span className="text-[12px] font-black uppercase tracking-[0.6em] text-amber-400 italic leading-none">Orchestrator v6.2.4</span>
                   </div>
                   <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-black/40 border border-white/5 shadow-inner">
                       <ActivitySquare size={12} className="text-amber-400 animate-pulse" />
                       <span className="text-[9px] font-black text-slate-400 tracking-widest uppercase italic leading-none">CHRONOS_SYNC_STABLE</span>
                   </div>
                 </div>
                 <h1 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none mb-2">Temporal Orchestrator</h1>
                 <p className="text-slate-400 text-[14px] uppercase font-black tracking-[0.4em] italic leading-none">Autonomous manifestation orchestrator for chronos-aligned delivery.</p>
              </div>
           </div>

           <div className="flex items-center gap-8">
              <button onClick={() => loadManifests(true)} title="Synchronize"
                className="w-20 h-20 rounded-[2.5rem] bg-white text-black flex items-center justify-center hover:bg-amber-500 hover:text-white transition-all shadow-2xl group active:scale-95">
                <RefreshCw size={36} className={refreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-300'} />
              </button>
              <button 
                onClick={() => router.push('/dashboard/calendar')}
                className="px-16 py-6 bg-white/[0.02] border border-white/10 text-slate-400 hover:text-white hover:bg-white/[0.05] rounded-[3rem] text-[14px] font-black uppercase tracking-[0.6em] shadow-2xl transition-all flex items-center gap-8 italic"
              >
                <Layers size={28} />
                OPEN_TEMPORAL_GRID
              </button>
           </div>
        </header>

        {/* View Selection */}
        <div className="flex gap-8 p-4 rounded-[4rem] bg-black/40 border border-white/10 w-fit relative z-10 backdrop-blur-xl shadow-2xl">
           {[
             { id: 'compose', label: 'Chronos Synthesizer', icon: Edit3 },
             { id: 'queue', label: 'Manifest Queue Matrix', icon: Target }
           ].map(t => (
             <button key={t.id} onClick={() => setActiveTab(t.id as any)}
               className={`px-16 py-6 rounded-[3rem] text-[13px] font-black uppercase tracking-[0.4em] transition-all duration-700 flex items-center gap-6 italic ${activeTab === t.id ? 'bg-white text-black shadow-2xl scale-105' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'}`}
             >
               <t.icon size={24} className={activeTab === t.id ? 'text-black' : 'text-slate-400'} /> {t.label}
             </button>
           ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'compose' ? (
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} key="compose" transition={{ duration: 0.7 }}
              className="grid grid-cols-1 xl:grid-cols-3 gap-20 relative z-10"
            >
              <div className="xl:col-span-2 space-y-16">
                 <div className={`${glassStyle} rounded-[6rem] p-20 relative overflow-hidden border-indigo-500/10 group shadow-[0_60px_150px_rgba(0,0,0,0.6)] min-h-[1000px] flex flex-col justify-between bg-black/40`}>
                    <div className="absolute top-0 right-0 p-24 opacity-[0.02] pointer-events-none group-hover:opacity-[0.1] transition-opacity duration-300">
                       <Sparkles size={500} className="text-white" />
                    </div>
                    
                    <div className="space-y-24 relative z-10">
                       {/* Operational Nodes */}
                       <div className="space-y-12">
                          <div className="flex items-center gap-6 mb-4 border-b border-white/5 pb-6">
                             <Cpu size={24} className="text-indigo-400" />
                             <label className="text-[14px] font-black text-slate-400 uppercase tracking-[0.6em] italic leading-none">Target Operational Nodes</label>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-8">
                             {PLATFORMS.map(p => {
                               const active = selectedPlatforms.includes(p.id)
                               return (
                                 <button key={p.id} onClick={() => setSelectedPlatforms(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}
                                   className={`p-10 rounded-[3.5rem] border-2 flex flex-col items-center gap-6 transition-all duration-300 shadow-2xl group/node ${active ? `border-transparent bg-gradient-to-br ${p.gradient} scale-110 shadow-[0_40px_80px_rgba(0,0,0,0.6)]` : 'bg-black/20 border-white/5 grayscale group-hover:grayscale-0 opacity-40 hover:opacity-100 hover:border-white/20'}`}
                                 >
                                   <span className={`text-5xl transition-transform duration-300 ${active ? 'scale-125' : 'group-hover/node:scale-110'}`}>{p.icon}</span>
                                   <span className="text-[11px] font-black text-white uppercase italic tracking-widest">{p.short}</span>
                                 </button>
                               )
                             })}
                          </div>
                       </div>

                       {/* Synthesis Area */}
                       <div className="space-y-12">
                          <div className="flex items-center justify-between border-b border-white/5 pb-6">
                             <div className="flex items-center gap-6">
                                <Terminal size={24} className="text-indigo-400" />
                                <label className="text-[14px] font-black text-slate-400 uppercase tracking-[0.6em] italic leading-none">Manifest Payload Synthesis</label>
                             </div>
                             <div className="scale-125 pr-6"><CharRing used={charCount} limit={currentLimit} /></div>
                          </div>
                          <textarea
                            ref={textareaRef}
                            value={postText}
                            onChange={e => { setPostText(e.target.value); autoResize() }}
                            placeholder="Initialize manifest trajectory..."
                            className={`w-full bg-black/60 border-2 rounded-[5rem] p-16 text-5xl font-black italic text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all duration-300 resize-none overflow-hidden tracking-tighter leading-[1.1] uppercase shadow-[inset_0_0_100px_rgba(0,0,0,0.6)] ${charCount > currentLimit ? 'border-rose-500/50' : 'border-white/5'}`}
                          />
                       </div>

                       {/* Heuristic Flags */}
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-12">
                          <div className="space-y-8">
                             <div className="flex items-center gap-6 mb-2 pl-4 border-l-4 border-indigo-500/40">
                                <Hash size={24} className="text-indigo-400" />
                                <label className="text-[14px] font-black text-slate-400 uppercase tracking-[0.5em] italic leading-none">Lattice Trajectory Tags</label>
                             </div>
                             <input type="text" value={hashtags} onChange={e => setHashtags(e.target.value)} placeholder="SOVEREIGN_GROWTH, NEURAL_SYNC"
                               className="w-full bg-black/80 border border-white/5 rounded-[3rem] px-12 py-8 text-[16px] font-black text-indigo-400 uppercase tracking-[0.4em] focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-600 italic shadow-inner"
                               title="Tags"
                             />
                          </div>
                          <div className="space-y-8">
                             <div className="flex items-center gap-6 mb-2 pl-4 border-l-4 border-indigo-500/40">
                                <Hexagon size={24} className="text-indigo-400" />
                                <label className="text-[14px] font-black text-slate-400 uppercase tracking-[0.5em] italic leading-none">Node Origin Reference</label>
                             </div>
                             <input type="text" value={contentId} onChange={e => setContentId(e.target.value)} placeholder="NODE_UUID_XXXX_0000"
                               className="w-full bg-black/80 border border-white/5 rounded-[3rem] px-12 py-8 text-[16px] font-black text-indigo-400 uppercase tracking-[0.4em] focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-600 italic shadow-inner"
                               title="UUID"
                             />
                          </div>
                       </div>

                       {/* Temporal Orchestration */}
                       <div className="p-16 rounded-[5rem] bg-indigo-500/5 border border-indigo-500/20 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center shadow-[inset_0_0_80px_rgba(0,0,0,0.5)] mt-12 relative overflow-hidden group/opt">
                          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover/opt:opacity-100 transition-opacity duration-300" />
                          <div className="space-y-6 relative z-10">
                             <h3 className="text-4xl font-black text-white uppercase tracking-tighter italic flex items-center gap-8 leading-none">
                               <Zap size={44} className="text-amber-400 animate-pulse" /> Temporal Alignment
                             </h3>
                             <p className="text-[14px] font-black text-slate-400 uppercase tracking-[0.4em] italic leading-relaxed">Autonomous chronos-sync for global resonance saturation.</p>
                          </div>
                          <div className="flex bg-black/80 p-4 rounded-[3.5rem] border border-white/10 shadow-2xl relative z-10">
                             <button onClick={() => setUseOptimalTime(true)}
                               className={`flex-1 py-8 rounded-[2.5rem] text-[14px] font-black uppercase tracking-[0.4em] transition-all duration-300 italic flex items-center justify-center gap-6 ${useOptimalTime ? 'bg-white text-black shadow-[0_30px_60px_rgba(255,255,255,0.1)] scale-105' : 'text-slate-400 hover:text-white'}`}
                             >
                                {useOptimalTime && <Gauge size={24} className="animate-pulse" />} PREDICTIVE_SYNC
                             </button>
                             <button onClick={() => setUseOptimalTime(false)}
                               className={`flex-1 py-8 rounded-[2.5rem] text-[14px] font-black uppercase tracking-[0.4em] transition-all duration-300 italic ${!useOptimalTime ? 'bg-white text-black shadow-[0_30px_60px_rgba(255,255,255,0.1)] scale-105' : 'text-slate-400 hover:text-white'}`}
                             >
                                VECTOR_SHIFT
                             </button>
                          </div>
                       </div>

                       {!useOptimalTime && (
                         <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-12 pt-12">
                            <div className="flex items-center gap-8 mb-4 border-l-8 border-indigo-500 pl-8">
                               <Clock size={32} className="text-indigo-400" />
                               <div>
                                  <label className="text-[16px] font-black text-white uppercase tracking-[0.5em] italic leading-none">Target Temporal Coordinate</label>
                                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2 italic leading-none">MANUAL_CHRONOS_CALIBRATION_REQUIRED</p>
                               </div>
                            </div>
                            <input type="datetime-local" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)}
                              className="w-full bg-black/80 border-2 border-white/10 rounded-[4rem] px-16 py-12 text-6xl font-black text-white uppercase tracking-tighter focus:outline-none focus:border-indigo-500/50 transition-all color-scheme-dark tabular-nums shadow-[inset_0_0_100px_rgba(0,0,0,0.6)] italic"
                              title="Time"
                            />
                         </motion.div>
                       )}
                    </div>

                    <div className="pt-24 border-t border-white/5 mt-24 relative z-10">
                       <button onClick={handleManifestTrajector} disabled={submitting || charCount > currentLimit || selectedPlatforms.length === 0}
                         className="w-full py-16 bg-white text-black rounded-[5.5rem] text-[20px] font-black uppercase tracking-[0.8em] hover:bg-emerald-500 hover:text-white transition-all duration-300 flex items-center justify-center gap-12 disabled:opacity-10 shadow-[0_60px_150px_rgba(255,255,255,0.1)] italic group active:scale-95 border-none"
                       >
                         {submitting ? <RefreshCw className="animate-spin" size={44} /> : <Send size={44} className="group-hover:translate-x-8 group-hover:-translate-y-8 transition-transform duration-300" />}
                         {submitting ? 'SYNCHRONIZING_GRID_NODES...' : 'MANIFEST_CONTENT_TRAJECTORY'}
                       </button>
                    </div>
                 </div>
              </div>

              {/* Right: Heuristic Preview & Saturation Windows */}
              <div className="space-y-20">
                 <div className="space-y-10 group/preview">
                    <div className="flex items-center gap-6 mb-4 border-b border-white/5 pb-6">
                       <Eye size={24} className="text-indigo-400" />
                       <label className="text-[14px] font-black text-slate-400 uppercase tracking-[0.6em] italic leading-none">Temporal Manifest Preview</label>
                    </div>
                    <TemporalPreview platform={PLATFORMS.find(p => p.id === selectedPlatforms[0])} text={postText} hashtags={hashtags.split(/[\s,#]+/).filter(h => h.trim())} />
                 </div>

                 <div className={`${glassStyle} rounded-[6rem] p-16 border-teal-500/10 shadow-[0_60px_100px_rgba(0,0,0,0.6)] group/windows bg-black/40`}>
                    <div className="flex items-center gap-8 mb-16 border-b border-white/5 pb-10">
                      <div className="w-16 h-16 rounded-[2rem] bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shadow-2xl group-hover/windows:rotate-12 transition-transform duration-300"><Activity size={32} className="text-teal-400" /></div>
                      <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic leading-none">Resonance Windows</h3>
                    </div>
                    <div className="space-y-10">
                       {SATURATION_WINDOWS.map((bt, i) => (
                         <div key={i} onClick={() => {setUseOptimalTime(false); setScheduledTime(new Date().toISOString().split('T')[0] + 'T' + bt.time)}}
                           className="flex items-center justify-between p-10 rounded-[3.5rem] bg-black/20 border border-white/5 hover:bg-teal-500/5 hover:border-teal-500/30 transition-all duration-300 cursor-pointer group shadow-[inset_0_0_40px_rgba(0,0,0,0.4)]" 
                         >
                            <div className="space-y-3">
                               <p className="text-5xl font-black text-white uppercase italic leading-none group-hover:text-teal-400 transition-colors drop-shadow-2xl">{bt.time}</p>
                               <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest italic leading-none opacity-60 pl-1">{bt.days}</p>
                            </div>
                            <div className="text-right flex flex-col items-end gap-5">
                               <p className="text-[12px] font-black text-teal-400 uppercase tracking-[0.3em] italic leading-none">{bt.label}</p>
                               <div className="h-2.5 w-32 bg-black/60 rounded-full overflow-hidden border border-white/5 shadow-inner">
                                  <motion.div initial={{ width: 0 }} animate={{ width: `${bt.score}%` }} transition={{ duration: 1.5 }} className="h-full bg-teal-500 shadow-[0_0_20px_rgba(20,184,166,0.6)]" />
                                </div>
                            </div>
                         </div>
                       ))}
                    </div>
                    <div className="mt-16 p-12 rounded-[4rem] bg-teal-500/5 border border-teal-500/10 shadow-[inset_0_0_40px_rgba(0,0,0,0.3)] relative overflow-hidden group/intel">
                       <div className="absolute top-0 right-0 p-12 opacity-[0.02] group-hover/intel:opacity-[0.1] transition-opacity duration-300"><Shield size={100} /></div>
                       <p className="text-[13px] font-black text-teal-500/60 uppercase tracking-[0.3em] leading-relaxed italic text-center relative z-10 px-8">Spectral heuristics confirmed: these windows provide +45% neural resonance depth for current mission architecture.</p>
                    </div>
                 </div>
              </div>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} key="queue" transition={{ duration: 0.7 }}
              className={`${glassStyle} rounded-[7rem] p-24 relative overflow-hidden z-10 border-indigo-500/10 shadow-[0_80px_200px_rgba(0,0,0,0.8)] min-h-[900px] bg-black/40`}
            >
               <div className="absolute top-0 right-0 p-32 opacity-[0.01] pointer-events-none border-none"><Monitor size={600} /></div>
               
               <div className="flex flex-col md:flex-row items-center justify-between gap-12 mb-20 border-b border-white/5 pb-16 relative z-10">
                  <div className="flex items-center gap-12">
                     <div className="w-24 h-24 rounded-[3.5rem] bg-indigo-500/5 border border-indigo-500/20 flex items-center justify-center shadow-2xl relative overflow-hidden group/tg">
                        <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover/tg:opacity-100 transition-opacity duration-700" />
                        <Target size={44} className="text-indigo-400 relative z-10" />
                     </div>
                     <div>
                        <h2 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none mb-4">Manifest Queue Matrix</h2>
                        <p className="text-slate-400 text-[16px] font-black uppercase tracking-[0.8em] italic leading-none">({filteredManifests.length}_ACTIVE_CHANNELS_SYNCHRONIZED)</p>
                     </div>
                  </div>
                  <div className="relative group p-4 bg-black/60 rounded-[3.5rem] border border-white/10 shadow-[inset_0_0_40px_rgba(0,0,0,0.6)] flex items-center min-w-[350px]">
                     <Filter size={28} className="absolute left-10 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                     <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} title="Filter"
                       className="bg-transparent border-none rounded-full pl-24 pr-16 py-8 text-[14px] font-black text-slate-400 uppercase tracking-[0.5em] focus:outline-none appearance-none hover:bg-white/5 transition-all italic hover:text-white cursor-pointer w-full"
                     >
                       <option value="all" className="bg-[#020205]">ALL_NODES</option>
                       <option value="scheduled" className="bg-[#020205]">SYNC_LOCKED</option>
                       <option value="posted" className="bg-[#020205]">MANIFESTED</option>
                       <option value="failed" className="bg-[#020205]">DIFFRACTION</option>
                     </select>
                  </div>
               </div>

               {loading ? (
                 <div className="py-80 text-center">
                    <RefreshCw size={120} className="text-indigo-500 animate-spin mx-auto mb-16 drop-shadow-[0_0_50px_rgba(99,102,241,0.5)]" />
                    <p className="text-3xl font-black text-slate-400 uppercase tracking-[1em] animate-pulse italic">CALIBRATING_GRID...</p>
                 </div>
               ) : filteredManifests.length === 0 ? (
                 <div className="py-80 text-center bg-white/[0.01] border-2 border-dashed border-white/5 rounded-[6rem] shadow-inner group transition-all hover:border-indigo-500/20">
                    <Radio size={200} className="text-slate-500 mx-auto mb-16 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-300 opacity-20" />
                    <h3 className="text-6xl font-black text-white italic uppercase tracking-tighter mb-8 leading-none opacity-40">Horizon Quiescent</h3>
                    <p className="text-[18px] text-slate-400 font-black uppercase tracking-[0.6em] max-w-2xl mx-auto leading-relaxed italic opacity-20 px-12">No active content trajectories detected across the neural mesh. Initialise a manifest via the synthesizer.</p>
                 </div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-16 relative z-10">
                    {filteredManifests
                      .sort((a, b) => new Date(b.scheduledTime).getTime() - new Date(a.scheduledTime).getTime())
                      .map((post, idx) => {
                        const pl = PLATFORMS.find(p => p.id === post.platform)
                        const scc = SC[post.status] || SC.draft
                        return (
                          <motion.div initial={{ opacity: 0, scale: 0.9, y: 50 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                            key={post._id}
                            className={`${glassStyle} p-12 rounded-[5.5rem] bg-black/40 hover:bg-white/[0.03] border-white/5 hover:border-indigo-500/40 transition-all duration-300 group flex flex-col justify-between min-h-[500px] shadow-[inset_0_0_60px_rgba(0,0,0,0.6)] relative overflow-hidden`}
                          >
                             <div className="absolute top-0 right-0 p-16 opacity-[0.02] group-hover:opacity-[0.1] transition-opacity duration-300 rotate-45"><CircuitBoard size={200} /></div>
                             
                             <div>
                                <div className="flex justify-between items-start mb-12 relative z-10">
                                   <div className="flex items-center gap-8">
                                      <div className={`w-20 h-20 rounded-[2rem] bg-gradient-to-br ${pl?.gradient || 'from-gray-600 to-black'} flex items-center justify-center text-white text-3xl font-black shadow-2xl group-hover:scale-110 group-hover:rotate-12 transition-all duration-300 border border-white/20`}>{pl?.icon || '?'}</div>
                                      <div>
                                         <p className="text-[16px] font-black text-white uppercase tracking-[0.4em] italic leading-none mb-3">{pl?.label || post.platform}</p>
                                         <div className="flex items-center gap-4 text-[12px] font-black text-slate-400 uppercase tracking-widest italic leading-none opacity-60">
                                            <Clock size={20} className="text-indigo-400" /> {new Date(post.scheduledTime).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                                         </div>
                                      </div>
                                   </div>
                                   <div className={`px-8 py-3 rounded-full border-2 text-[11px] font-black uppercase tracking-[0.3em] italic backdrop-blur-3xl shadow-2xl ${scc.bg} ${scc.text}`}>
                                     {scc.label}
                                   </div>
                                </div>
                                <p className="text-4xl font-black text-slate-200 leading-[1.15] italic mb-12 line-clamp-4 uppercase tracking-tighter group-hover:text-white transition-colors duration-300 relative z-10 drop-shadow-2xl">{post.content.text || post.contentId?.title || 'NULL_CONTENT_PAYLOAD'}</p>
                             </div>

                             <div className="flex items-center justify-between pt-10 border-t border-white/5 relative z-10">
                                <div className="flex items-center gap-4 text-[11px] font-black text-slate-500 uppercase tracking-widest italic opacity-40">
                                   <Database size={16} /> ID_{post._id.slice(-8).toUpperCase()}
                                </div>
                                <div className="flex items-center gap-6 opacity-0 group-hover:opacity-100 transition-all translate-y-8 group-hover:translate-y-0 duration-300">
                                   <button onClick={() => handleDeManifest(post._id)} className="p-6 rounded-[2rem] bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-2xl border border-rose-500/20 active:scale-90 group/purge" title="Purge Manifest">
                                      <Trash2 size={32} className="group-hover/purge:rotate-12 transition-transform duration-700" />
                                   </button>
                                   <button className="p-6 rounded-[2rem] bg-white text-black hover:bg-indigo-500 hover:text-white transition-all shadow-2xl active:scale-90 group/link" title="Open Stream">
                                      <ArrowRight size={32} className="group-hover/link:translate-x-4 transition-transform duration-700" />
                                   </button>
                                </div>
                             </div>
                          </motion.div>
                        )
                      })}
                 </div>
               )}
            </motion.div>
          )}
        </AnimatePresence>

        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { font-family: 'Inter', sans-serif; background: #020205; color: white; overflow-x: hidden; }
          .color-scheme-dark { color-scheme: dark; }
          select { background-color: transparent; border: none; outline: none; appearance: none; }
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); }
          ::-webkit-scrollbar-thumb { background: rgba(245, 158, 11, 0.2); border-radius: 10px; }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}

function CharRing({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min(used / limit, 1)
  const r = 20, circ = 2 * Math.PI * r
  const over = used > limit
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="rotate-[-90deg] drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]">
      <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-white/5" />
      <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="4"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round"
        className={`transition-all duration-300 ${over ? 'text-rose-500 animate-pulse' : pct > 0.8 ? 'text-amber-400' : 'text-indigo-500'}`} />
    </svg>
  )
}

function TemporalPreview({ platform, text, hashtags }: { platform: any; text: string; hashtags: string[] }) {
  if (!platform || !text) return (
    <div className={`${glassStyle} rounded-[5rem] flex flex-col items-center justify-center h-80 border-dashed border-white/5 bg-black/40 shadow-inner group transition-all hover:border-indigo-500/20`}>
      <Eye size={64} className="text-slate-500 mb-10 group-hover:scale-125 transition-transform duration-300 opacity-20" />
      <p className="text-[18px] font-black text-slate-500 uppercase tracking-[1em] italic leading-none opacity-20">Awaiting Signal</p>
    </div>
  )
  const tags = hashtags.length > 0 ? hashtags : (SUGGESTED_HASHTAGS[platform.id] || []).slice(0, 3)

  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
      className={`${glassStyle} rounded-[5.5rem] p-16 overflow-hidden relative group border-indigo-500/10 shadow-[0_60px_100px_rgba(0,0,0,0.6)] hover:border-indigo-500/40 bg-black/40 min-h-[400px] flex flex-col justify-between`}
    >
      <div className="absolute top-0 right-0 p-16 opacity-[0.02] group-hover:opacity-[0.1] transition-opacity duration-300">
         <Radio size={150} className="text-white" />
      </div>
      <div>
        <div className="flex items-center gap-10 mb-12 relative z-10">
          <div className={`w-20 h-20 rounded-[2rem] bg-gradient-to-br ${platform.gradient} flex items-center justify-center text-white text-3xl font-black shadow-2xl shrink-0 border border-white/20 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300`}>{platform.icon}</div>
          <div>
             <p className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none mb-3">{platform.label}</p>
             <p className="text-[12px] font-black text-slate-400 uppercase tracking-[0.4em] italic leading-none">TEMPORAL_PREVIEW_v6.2</p>
          </div>
        </div>
        <p className="text-4xl font-black text-slate-200 leading-[1.1] italic mb-12 line-clamp-6 uppercase tracking-tighter group-hover:text-white transition-colors duration-300 relative z-10 drop-shadow-2xl">{text}</p>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-5 relative z-10">
           {tags.slice(0, 5).map(h => (
              <span key={h} className="text-[12px] font-black text-indigo-400 uppercase tracking-[0.4em] italic bg-indigo-500/10 px-6 py-3 rounded-full border border-indigo-500/20 shadow-2xl">#{h.toUpperCase()}</span>
           ))}
        </div>
      )}
    </motion.div>
  )
}

const SUGGESTED_HASHTAGS: Record<string, string[]> = {
  twitter:   ['sovereign','agentic','click','web3','future'],
  linkedin:  ['AI','Automation','Leadership','Efficiency','Growth'],
  instagram: ['lifestyle','creator','luxury','tech','design'],
  facebook:  ['community','social','business','trends'],
  tiktok:    ['fyp','trending','viral','creative'],
  youtube:   ['vlog','tech','review','education'],
}
