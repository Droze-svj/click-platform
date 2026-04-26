'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import FileUpload from '../../../components/FileUpload'
import LoadingSkeleton from '../../../components/LoadingSkeleton'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { extractApiError } from '../../../utils/apiResponse'
import { useSocket } from '../../../hooks/useSocket'
import { useAuth } from '../../../hooks/useAuth'
import { apiGet } from '../../../lib/api'
import {
  Video, Upload, Edit, Play, Loader2, CheckCircle, AlertCircle,
  RefreshCw, Layers, Clock, ArrowLeft, ArrowRight, ChevronRight,
  Scissors, Zap, Sparkles, Activity, Fingerprint, Terminal, Cpu,
  Globe, Target, Radio, Hexagon, X, ZapOff, Film, Gauge, ActivitySquare,
  Monitor
} from 'lucide-react'
import { SwarmConsensusHUD } from '../../../components/editor/SwarmConsensusHUD'
import { motion, AnimatePresence } from 'framer-motion'
import ToastContainer from '../../../components/ToastContainer'

interface VideoItem {
  _id: string
  title: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | string
  originalFile?: { url: string; filename?: string }
  generatedContent?: { shortVideos: Array<{ url: string; thumbnail: string; caption: string; duration: number; platform: string }> }
  createdAt: string
}

const STATUS_CFG: Record<string, { label: string; dot: string; badge: string; icon: any; color: string }> = {
  completed:  { label: 'COMPLETED',    dot: 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle, color: 'text-emerald-400' },
  processing: { label: 'PROCESSING',     dot: 'bg-indigo-500 animate-pulse shadow-[0_0_20px_rgba(99,102,241,0.5)]', badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', icon: Loader2, color: 'text-indigo-400' },
  pending:    { label: 'QUEUED',      dot: 'bg-amber-500 animate-pulse shadow-[0_0_20px_rgba(245,158,11,0.5)]', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: Clock, color: 'text-amber-400' },
  failed:     { label: 'FAILED',      dot: 'bg-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.5)]', badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20', icon: AlertCircle, color: 'text-rose-400' },
}

const glassStyle = 'backdrop-blur-3xl bg-white/[0.02] border-2 border-white/10 shadow-[0_50px_150px_rgba(0,0,0,0.8)] transition-all duration-300'

export default function KineticSynthesisHubPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { socket, connected, on, off } = useSocket(user?.id || null)
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [showSwarmHUD, setShowSwarmHUD] = useState(false)
  const [swarmHUDTask, setSwarmHUDTask] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'processing' | 'pending' | 'failed'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const loadSpectralInventory = useCallback(async () => {
    try {
      const res = await apiGet<any>('/video')
      const body = res?.data ?? res
      const videosData = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : []
      setVideos(videosData)
      setError('')
      setRetryCount(0)
    } catch (err: any) {
      const e = extractApiError(err)
      if (err?.response?.status === 401) { router.push('/login'); return }
      setError(typeof e === 'string' ? e : e?.message || 'Failed to load videos')
      setVideos([])
    } finally { setLoading(false) }
  }, [router])

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    loadSpectralInventory()
  }, [user, authLoading, loadSpectralInventory, router])

  useEffect(() => {
    if (!loading) return
    const t = setTimeout(() => {
      setLoading(false)
      if (videos.length === 0) {
        setError('Loading is taking longer than expected. Try refreshing.')
      }
    }, 20000)
    return () => clearTimeout(t)
  }, [loading, videos.length])

  useEffect(() => {
    if (!socket || !connected) return
    const handler = (data: any) => {
      if (data.status === 'completed') { setSuccess(`AXIOM_MANIFEST_COMPLETE: ${data.clips || 0} SPECTRAL_FRAGMENTS`); setTimeout(loadSpectralInventory, 500) }
      else if (data.status === 'failed') { setError('Video processing failed'); setTimeout(loadSpectralInventory, 500) }
    }
    on('video-processed', handler)
    return () => off('video-processed', handler)
  }, [socket, connected, on, off, loadSpectralInventory])

  useEffect(() => {
    if (!videos.some(v => v.status === 'processing')) return
    const id = setInterval(() => loadSpectralInventory(), 15000)
    return () => clearInterval(id)
  }, [videos, loadSpectralInventory])

  const pollSpectralStatus = useCallback(async (contentId: string, onComplete?: () => void) => {
    let polls = 0; let active = true
    const iv = setInterval(async () => {
      if (!active || polls >= 100) { clearInterval(iv); return }
      polls++
      try {
        const res = await apiGet<any>(`/video/${contentId}/status`)
        const status = res?.status || res?.data?.status
        const progress = res?.progress || res?.data?.progress || 0
        if (status === 'completed') {
          clearInterval(iv); active = false
          setSuccess(`MANIFEST_COMPLETE: ${res?.data?.clipsCount || 0} FRAGMENTS READY`)
          setTimeout(loadSpectralInventory, 500)
          if (onComplete) setTimeout(onComplete, 1500)
        } else if (status === 'failed') {
          clearInterval(iv); active = false; setError('Processing failed — please retry')
          loadSpectralInventory()
        } else if (progress > 0) { setSuccess(`SPECTRAL_TUNING: ${progress}%_ALIGNMENT…`) }
      } catch (err: any) { if (err?.response?.status === 404) { clearInterval(iv); active = false } }
    }, 3000)
    setTimeout(() => { active = false; clearInterval(iv); loadSpectralInventory() }, 300000)
  }, [loadSpectralInventory])

  const handleForgePayload = useCallback(async (_file: File, uploadResponse?: any) => {
    setError(''); setSuccess('')
    if (!uploadResponse) { setError('Upload failed — empty response'); return }
    const contentId = uploadResponse.data?.contentId || uploadResponse.contentId
    if (!contentId) { setError('Upload failed — missing video ID'); return }
    setSuccess('Upload received — processing your video…')
    await loadSpectralInventory()
    pollSpectralStatus(contentId, () => router.push(`/dashboard/video/edit/${contentId}`))
    if (socket && connected) {
      const handler = (data: any) => {
        if (data.contentId !== contentId) return
        if (data.status === 'completed') { setSuccess('Ready — opening editor…'); setTimeout(() => router.push(`/dashboard/video/edit/${contentId}`), 1500); off('video-processed', handler) }
        else if (data.status === 'failed') { setError('Processing was cancelled'); loadSpectralInventory(); off('video-processed', handler) }
      }
      on('video-processed', handler)
      setTimeout(() => off('video-processed', handler), 300000)
    }
  }, [socket, connected, on, off, loadSpectralInventory, pollSpectralStatus, router])

  const getStatusCfg = (status: string) => STATUS_CFG[status as keyof typeof STATUS_CFG] || STATUS_CFG.pending

  const completedCount = videos.filter(v => v.status === 'completed').length
  const processingCount = videos.filter(v => v.status === 'processing' || v.status === 'pending').length
  const failedCount = videos.filter(v => v.status === 'failed').length
  const totalClips = videos.reduce((sum, v) => sum + (v.generatedContent?.shortVideos?.length || 0), 0)

  const visibleVideos = videos.filter(v => {
    if (statusFilter !== 'all') {
      if (statusFilter === 'processing') {
        if (v.status !== 'processing' && v.status !== 'pending') return false
      } else if (v.status !== statusFilter) return false
    }
    if (!searchQuery) return true
    return (v.title || '').toLowerCase().includes(searchQuery.toLowerCase())
  })

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 bg-[#020205] min-h-screen gap-12 backdrop-blur-3xl">
       <div className="relative">
          <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-20 animate-pulse" />
          <RefreshCw size={80} className="text-indigo-500 animate-spin relative z-10" />
       </div>
       <div className="space-y-4 text-center">
          <p className="text-[14px] font-bold text-indigo-400 uppercase tracking-[0.4em] animate-pulse leading-none">Loading videos…</p>
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-[0.3em] leading-none">Please wait</p>
       </div>
    </div>
  )

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-24 px-8 pt-12 max-w-[1700px] mx-auto space-y-20">
        <ToastContainer />
        <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
           <Video size={800} className="text-white absolute -bottom-40 -left-40 rotate-12" />
        </div>

        <SwarmConsensusHUD 
          isVisible={showSwarmHUD} 
          taskName={swarmHUDTask} 
          onComplete={() => setShowSwarmHUD(false)} 
        />

        {/* Kinetic Header */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-16 relative z-50">
           <div className="flex items-center gap-8">
              <button type="button"
                onClick={() => router.push('/dashboard')}
                title="Back to dashboard"
                className="w-16 h-16 rounded-[1.8rem] bg-white/[0.02] border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors active:scale-95 hover:border-rose-500/50">
                <ArrowLeft size={28} />
              </button>
              <div className="w-20 h-20 bg-indigo-500/10 border-2 border-indigo-500/20 rounded-[2.5rem] flex items-center justify-center shadow-xl relative">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent" />
                <Film size={36} className="text-indigo-400 relative z-10" />
              </div>
              <div>
                 <div className="flex items-center gap-3 mb-3">
                   <Cpu size={14} className="text-indigo-400 animate-pulse" />
                   <span className="text-[11px] font-bold uppercase tracking-[0.4em] text-indigo-400 leading-none">Click · Video Studio</span>
                   <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-white/5">
                       <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                       <span className="text-[10px] font-bold text-slate-300 tracking-[0.2em] uppercase leading-none">Online</span>
                   </div>
                 </div>
                 <h1 className="text-6xl font-black text-white tracking-tighter leading-none mb-3">Video Library</h1>
                 <p className="text-slate-400 text-[14px] font-medium tracking-wide leading-relaxed">Upload long-form video, get short clips, then refine in the editor.</p>
              </div>
           </div>

           <button type="button"
             onClick={() => {
               setSwarmHUDTask('Refreshing video inventory')
               setShowSwarmHUD(true)
               loadSpectralInventory()
             }}
             title="Refresh inventory"
             className="px-7 py-3.5 bg-white/[0.02] border-2 border-white/10 text-slate-300 hover:text-white hover:bg-white/[0.05] rounded-[1.5rem] text-[12px] font-bold uppercase tracking-[0.2em] shadow-lg transition-colors flex items-center gap-3 group active:scale-95"
           >
             <RefreshCw size={16} className={loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-300'} />
             Refresh
           </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
          {[
            { label: 'Videos',          value: videos.length,    icon: Layers,          color: 'text-indigo-400',  bg: 'bg-indigo-500/5' },
            { label: 'Completed',       value: completedCount,   icon: ActivitySquare,  color: 'text-emerald-400', bg: 'bg-emerald-500/5' },
            { label: 'Total Clips',     value: totalClips,       icon: Sparkles,        color: 'text-rose-400',    bg: 'bg-rose-500/5' },
          ].map(s => (
            <div key={s.label} className={`${glassStyle} rounded-[2rem] p-7 flex items-center gap-5 group hover:bg-white/[0.04] shadow-lg relative overflow-hidden`}>
               <div className={`w-14 h-14 ${s.bg} rounded-[1.4rem] flex items-center justify-center border border-white/10 shrink-0`}>
                  <s.icon size={26} className={s.color} />
               </div>
               <div className="flex-1 min-w-0">
                 <div className={`text-4xl font-black tabular-nums leading-none tracking-tighter mb-2 ${s.color}`}>{s.value}</div>
                 <div className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.3em] leading-none">{s.label}</div>
               </div>
            </div>
          ))}
        </div>

        {/* Global Alerts Terminal */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative z-50 flex items-start gap-10 p-12 bg-rose-500/5 border border-rose-500/20 rounded-[4rem] shadow-2xl backdrop-blur-3xl overflow-hidden group">
              <div className="absolute inset-x-0 bottom-0 h-1 bg-rose-500 group-hover:h-2 transition-all" />
              <div className="w-20 h-20 rounded-[2rem] bg-rose-500/20 flex items-center justify-center flex-shrink-0 animate-pulse text-rose-500 shadow-2xl">
                <AlertCircle size={40} />
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-[11px] font-bold text-rose-400 uppercase tracking-[0.3em] leading-none">Error</p>
                <p className="text-xl font-bold text-white tracking-tight leading-tight">{error}</p>
                <p className="text-[12px] text-slate-400 font-medium leading-relaxed">Try refreshing the page or check your connection.</p>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => { setError(''); loadSpectralInventory() }} className="px-7 py-3 bg-rose-600 text-white rounded-full text-[12px] font-bold uppercase tracking-[0.2em] hover:bg-rose-500 transition-colors shadow-lg active:scale-95">Retry</button>
                <button type="button" title="Dismiss error" aria-label="Dismiss error" onClick={() => setError('')} className="w-11 h-11 bg-white/5 border border-white/10 text-slate-400 hover:text-white rounded-full flex items-center justify-center transition-colors"><X size={18} /></button>
              </div>
            </motion.div>
          )}
          {success && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative z-50 flex items-start gap-10 p-12 bg-emerald-500/5 border border-emerald-500/20 rounded-[4rem] shadow-2xl backdrop-blur-3xl overflow-hidden group">
              <div className="absolute inset-x-0 bottom-0 h-1 bg-emerald-500 group-hover:h-2 transition-all" />
              <div className="w-20 h-20 rounded-[2rem] bg-emerald-500/20 flex items-center justify-center flex-shrink-0 text-emerald-500 shadow-2xl">
                <CheckCircle size={40} />
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-[0.3em] leading-none">Success</p>
                <p className="text-xl font-bold text-white tracking-tight leading-tight">{success}</p>
                <p className="text-[12px] text-slate-400 font-medium leading-relaxed">Your video is being processed in the background.</p>
              </div>
              <button type="button" title="Dismiss notification" aria-label="Dismiss notification" onClick={() => setSuccess('')} className="w-11 h-11 bg-white/5 border border-white/10 text-slate-400 hover:text-white rounded-full flex items-center justify-center transition-colors"><X size={18} /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Kinetic Ingress Terminal */}
        <div className={`${glassStyle} rounded-[6rem] overflow-hidden relative z-10 border-indigo-500/10 group shadow-[0_100px_300px_rgba(0,0,0,0.8)]`}>
          <div className="bg-indigo-600 p-20 relative overflow-hidden">
             <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, white, transparent 60%)' }} />
             <div className="absolute -top-40 -right-40 opacity-[0.05] pointer-events-none group-hover:rotate-180 transition-transform duration-700"><Upload size={600} /></div>
             
             <div className="relative flex flex-col xl:flex-row items-center justify-between gap-8 z-10">
                <div className="flex items-center gap-6">
                   <div className="w-20 h-20 bg-white/10 rounded-[2rem] flex items-center justify-center shadow-lg border-2 border-white/20"><Upload size={36} className="text-white" /></div>
                   <div>
                      <p className="text-white/60 text-[11px] font-bold uppercase tracking-[0.3em] mb-2 leading-none">Upload</p>
                      <h2 className="text-white font-black tracking-tighter text-4xl leading-tight mb-2">Drop a video to get started</h2>
                      <p className="text-white/70 text-[13px] font-medium leading-relaxed">We&apos;ll process it and generate short clips automatically.</p>
                   </div>
                </div>
                <div className="hidden lg:flex flex-col items-start gap-2 text-white/70 text-[11px] font-bold uppercase tracking-[0.2em] border-l-2 border-white/10 pl-8">
                   <div className="flex items-center gap-2"><Fingerprint size={14} className="text-indigo-200" /> Encrypted upload</div>
                   <div className="flex items-center gap-2"><Monitor size={14} className="text-indigo-200" /> Max 1 GB · MP4 / MOV / WebM</div>
                </div>
             </div>
          </div>
          <div className="p-10 bg-black/40 backdrop-blur-3xl">
            <FileUpload
              onUpload={(file, res) => {
                setSwarmHUDTask('Analyzing your video')
                setShowSwarmHUD(true)
                handleForgePayload(file, res)
              }}
              uploadUrl="/api/video/upload"
              accept={{ 'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.webm'] }}
              maxSize={1073741824}
            />
          </div>
        </div>

        {/* Library */}
        {videos.length > 0 && (
          <div className="space-y-10 relative z-10 pt-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-white/5 pb-8">
              <div className="flex items-center gap-5">
                 <div className="w-14 h-14 rounded-[1.4rem] bg-indigo-500/10 border-2 border-indigo-500/20 flex items-center justify-center shadow-md"><Layers size={24} className="text-indigo-400" /></div>
                 <div>
                    <h2 className="text-3xl font-black text-white tracking-tighter leading-tight mb-2">Your videos</h2>
                    <p className="text-slate-400 text-[13px] font-medium leading-none">{visibleVideos.length} of {videos.length} {videos.length === 1 ? 'video' : 'videos'} shown</p>
                 </div>
              </div>
              {processingCount > 0 && (
                <div className="px-5 py-2.5 rounded-full bg-indigo-500/5 border border-indigo-500/20 text-indigo-400 text-[11px] font-bold uppercase tracking-[0.2em] animate-pulse flex items-center gap-3">
                  <ActivitySquare size={14} /> {processingCount} processing
                </div>
              )}
            </div>

            {/* Search + Status Filter */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4">
               <div className="relative flex-1 group/search">
                  <Target size={20} className="absolute left-7 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/search:text-indigo-400 transition-colors" />
                  <input
                     type="text"
                     value={searchQuery}
                     onChange={e => setSearchQuery(e.target.value)}
                     placeholder="SCAN_INVENTORY_BY_TITLE..."
                     className="w-full bg-black/60 border-2 border-white/5 rounded-full pl-16 pr-12 py-4 text-[13px] font-black text-white uppercase tracking-[0.4em] italic focus:outline-none focus:border-indigo-500/50 transition-colors placeholder:text-slate-600"
                  />
                  {searchQuery && (
                     <button type="button" onClick={() => setSearchQuery('')} title="Clear scan" className="absolute right-5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-rose-500/20 transition-colors">
                        <X size={14} />
                     </button>
                  )}
               </div>
               <div className="flex items-center gap-2 flex-wrap">
                  {([
                     { id: 'all',        label: 'ALL',        count: videos.length,     color: 'border-white/20 text-slate-300' },
                     { id: 'completed',  label: 'MANIFESTED', count: completedCount,    color: 'border-emerald-500/40 text-emerald-400' },
                     { id: 'processing', label: 'SYNTHESIS',  count: processingCount,   color: 'border-indigo-500/40 text-indigo-400' },
                     { id: 'failed',     label: 'COLLAPSE',   count: failedCount,       color: 'border-rose-500/40 text-rose-400' },
                  ] as const).map(opt => {
                     const active = statusFilter === opt.id
                     return (
                        <button
                           key={opt.id}
                           type="button"
                           onClick={() => setStatusFilter(opt.id as any)}
                           className={`px-4 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.3em] italic border-2 transition-colors flex items-center gap-2 ${active ? 'bg-white text-black border-transparent' : `bg-white/[0.02] ${opt.color} hover:bg-white/[0.05]`}`}
                        >
                           {opt.label}
                           <span className={`tabular-nums ${active ? 'text-black/60' : 'opacity-60'}`}>{opt.count}</span>
                        </button>
                     )
                  })}
               </div>
            </div>

            {visibleVideos.length === 0 ? (
              <div className={`${glassStyle} rounded-[5rem] p-20 flex flex-col items-center text-center gap-6`}>
                 <Target size={48} className="text-slate-500" />
                 <h3 className="text-3xl font-black text-white italic uppercase tracking-tight">No Particles Match Filter</h3>
                 <p className="text-[12px] font-black text-slate-400 uppercase tracking-[0.4em] italic">Adjust status or clear search.</p>
                 <button type="button" onClick={() => { setSearchQuery(''); setStatusFilter('all') }} className="px-8 py-3 bg-white/5 border-2 border-white/10 text-slate-300 rounded-full text-[11px] font-black uppercase tracking-[0.4em] hover:text-white hover:border-indigo-500/50 transition-colors italic">
                    RESET_FILTER
                 </button>
              </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-16">
              {visibleVideos.map(video => {
                const cfg = getStatusCfg(video.status)
                const clips = video.generatedContent?.shortVideos || []
                const videoSrc = video.originalFile?.url

                return (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ y: -20, scale: 1.02 }}
                    key={video._id}
                    className={`${glassStyle} rounded-[5rem] overflow-hidden group hover:bg-white/[0.05] flex flex-col hover:border-indigo-500/30 shadow-[0_100px_300px_rgba(0,0,0,1)] relative`}
                  >
                    <div className="aspect-video relative bg-[#020205] overflow-hidden border-b-2 border-white/5">
                      {videoSrc ? (
                        <video
                          src={videoSrc}
                          className="w-full h-full object-cover grayscale-[0.5] group-hover:grayscale-0 group-hover:scale-110 transition-all duration-500 opacity-60 group-hover:opacity-100"
                          preload="metadata"
                          playsInline
                          muted
                          onMouseEnter={e => (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
                          onMouseLeave={e => { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = 0 }}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center opacity-[0.05]">
                          <Film size={160} className="text-white" />
                        </div>
                      )}

                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-indigo-950/20 backdrop-blur-3xl">
                        <div className="w-28 h-28 rounded-[3rem] bg-white text-black flex items-center justify-center shadow-[0_50px_150px_rgba(255,255,255,0.2)] scale-90 group-hover:scale-100 transition-transform duration-300">
                          <Play size={48} className="fill-current ml-2" />
                        </div>
                      </div>

                      <div className="absolute top-10 left-10">
                        <div className={`flex items-center gap-5 px-8 py-4 rounded-[2rem] border-2 text-[12px] font-black uppercase tracking-[0.3em] backdrop-blur-3xl shadow-3xl ${cfg.badge}`}>
                          <div className={`w-3.5 h-3.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </div>
                      </div>

                      {clips.length > 0 && (
                        <div className="absolute top-10 right-10 flex items-center gap-5 px-8 py-4 rounded-[2rem] bg-black/80 backdrop-blur-3xl border-2 border-white/10 text-white text-[12px] font-black uppercase tracking-[0.3em] shadow-3xl">
                          <Scissors size={24} className="text-indigo-400 animate-pulse" /> {clips.length} FRAGMENTS
                        </div>
                      )}
                    </div>

                    <div className="p-16 space-y-12 flex-1 flex flex-col justify-between relative z-10">
                      <div className="space-y-6">
                        <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter truncate leading-none group-hover:text-indigo-400 transition-colors duration-300">
                          {video.title.toUpperCase() || 'UNTITLED_PARTICLE'}
                        </h3>
                        <div className="flex items-center justify-between border-t border-white/5 pt-8">
                           <div className="flex items-center gap-4 text-[12px] font-black text-slate-500 uppercase tracking-widest italic leading-none">
                             <Clock size={20} className="text-indigo-400" /> {new Date(video.createdAt).toLocaleDateString()}
                           </div>
                           <div className="flex items-center gap-4 text-[12px] font-black text-slate-500 uppercase tracking-widest italic leading-none opacity-40">
                             ID: {video._id.slice(-8).toUpperCase()}
                           </div>
                        </div>
                      </div>

                      {(video.status === 'processing' || video.status === 'pending') && (
                        <div className="space-y-8 p-10 rounded-[3rem] bg-indigo-500/[0.05] border-2 border-indigo-500/20 shadow-inner">
                          <div className="flex justify-between items-center mb-4">
                             <p className="text-[12px] font-black text-indigo-400 uppercase tracking-[0.5em] italic leading-none animate-pulse">Kinetic Alignment Mapping...</p>
                             <Loader2 size={24} className="text-indigo-400 animate-spin" />
                          </div>
                          <div className="h-3 bg-black/80 rounded-full overflow-hidden border-2 border-white/10 shadow-inner">
                              <motion.div 
                                animate={{ x: ['-100%', '100%'] }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                                className="h-full bg-gradient-to-r from-transparent via-indigo-500 to-transparent w-full shadow-[0_0_30px_rgba(99,102,241,0.8)]" 
                              />
                          </div>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic leading-none text-center">Neural weights manifesting temporal logic clusters...</p>
                        </div>
                      )}

                      <div className="flex gap-8 pt-12 border-t-2 border-white/5">
                        <button type="button"
                          onClick={() => {
                            setSwarmHUDTask('Inference Matrix Startup')
                            setShowSwarmHUD(true)
                            setTimeout(() => router.push(`/dashboard/video/edit/${video._id}`), 1000)
                          }}
                          title="Initialize Forge Chamber"
                          className="flex-1 flex items-center justify-center gap-6 py-8 bg-white text-black hover:bg-indigo-500 hover:text-white rounded-[2.5rem] text-[15px] font-black uppercase tracking-[0.5em] transition-all duration-300 shadow-[0_50px_100px_rgba(255,255,255,0.1)] italic active:scale-95 group relative overflow-hidden"
                        >
                          <Terminal size={32} className="group-hover:scale-125 transition-transform duration-300 relative z-10" /> 
                          <span className="relative z-10">OPEN_FORGE_CHAMBER</span>
                        </button>
                        {clips.length > 0 && (
                          <button type="button"
                            onClick={() => router.push(`/dashboard/video/edit/${video._id}?tab=clips`)}
                            className="w-24 h-24 bg-white/[0.03] border-2 border-white/10 text-slate-500 hover:bg-emerald-500 hover:text-white rounded-[2.5rem] flex items-center justify-center transition-all duration-300 shadow-3xl group"
                            title="Extract Kinetic Fragments"
                          >
                            <Target size={40} className="group-hover:rotate-180 transition-transform duration-300" />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
            )}
          </div>
        )}

        {/* Empty Horizon Chamber */}
        {videos.length === 0 && !loading && (
          <div className="py-32 text-center bg-white/[0.01] border-2 border-white/5 rounded-[8rem] shadow-3xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="w-64 h-64 mx-auto bg-white/[0.02] border-2 border-white/10 rounded-[5rem] flex items-center justify-center mb-16 shadow-inner group-hover:scale-110 group-hover:rotate-180 transition-all duration-500">
              <Film size={120} className="text-slate-500 opacity-20 group-hover:opacity-100 group-hover:text-indigo-500 transition-all duration-300" />
            </div>
            <h3 className="text-7xl font-black text-white italic uppercase tracking-tighter mb-8 leading-none">Synthesis Void Occupied</h3>
            <p className="text-[18px] text-slate-500 font-black uppercase tracking-[0.5em] max-w-3xl mx-auto leading-tight italic opacity-60">Your sovereign cinematic matrix is awaiting source payloads. Ingest a cinematic object to initialize synthesis.</p>
          </div>
        )}

        {/* Kinetic Heuristic Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-16 relative z-10 pt-32">
          {[
            { icon: Zap,      color: 'text-amber-400',  title: 'Neural Detection',    desc: 'Swarm consensus identifying peak retention clusters via logic heatmaps.' },
            { icon: Scissors, color: 'text-indigo-400', title: 'Kinetic Synthesis',    desc: 'AI-driven temporal slicing for max-saturation platform dominance.' },
            { icon: Sparkles, color: 'text-rose-400', title: 'Sovereign Audio',   desc: 'Recursive regional dubbing & lip-sync for infinite resonance.' },
          ].map(f => (
            <div key={f.title} className={`${glassStyle} rounded-[5rem] p-16 flex flex-col items-center text-center group hover:border-indigo-500/30 shadow-inner relative overflow-hidden`}>
               <div className="absolute inset-x-0 bottom-0 h-2 bg-indigo-500/20 scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
              <div className={`w-28 h-28 rounded-[3rem] flex items-center justify-center bg-white/5 border-2 border-white/10 mb-12 group-hover:scale-110 group-hover:rotate-180 transition-all duration-300 shadow-3xl`}>
                <f.icon size={56} className={f.color} />
              </div>
              <p className="text-4xl font-black text-white italic uppercase tracking-tighter mb-6 leading-none group-hover:text-indigo-400 transition-colors duration-300">{f.title}</p>
              <p className="text-[14px] text-slate-500 font-black uppercase tracking-[0.4em] leading-tight italic opacity-40 group-hover:opacity-100 transition-opacity duration-300 px-8">{f.desc}</p>
            </div>
          ))}
        </div>

        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');
          
          body {
            font-family: 'Outfit', sans-serif;
            background: #020205;
            color: white;
            overflow-x: hidden;
          }

          video::-webkit-media-controls {
            display: none !important;
          }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}
