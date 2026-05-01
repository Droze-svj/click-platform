'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import FileUpload from '../../../components/FileUpload'
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
  Monitor, Sun, Moon
} from 'lucide-react'
import { SwarmConsensusHUD } from '../../../components/editor/SwarmConsensusHUD'
import { motion, AnimatePresence } from 'framer-motion'
import ToastContainer from '../../../components/ToastContainer'
import { useTheme } from '../../../components/ThemeProvider'

interface VideoItem {
  _id: string
  title: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | string
  originalFile?: { url: string; filename?: string }
  generatedContent?: { shortVideos: Array<{ url: string; thumbnail: string; caption: string; duration: number; platform: string }> }
  createdAt: string
}

const STATUS_CFG: Record<string, { label: string; dot: string; badge: string; icon: any; color: string }> = {
  completed:  { label: 'COMPLETED',    dot: 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]', badge: 'bg-[var(--tint-emerald-bg)] text-[var(--tint-emerald-fg)] border-[var(--tint-emerald-edge)]', icon: CheckCircle, color: 'text-[var(--tint-emerald-fg)]' },
  processing: { label: 'PROCESSING',     dot: 'bg-indigo-500 animate-pulse shadow-[0_0_20px_rgba(99,102,241,0.5)]', badge: 'bg-[var(--tint-indigo-bg)] text-[var(--tint-indigo-fg)] border-[var(--tint-indigo-edge)]', icon: Loader2, color: 'text-[var(--tint-indigo-fg)]' },
  pending:    { label: 'QUEUED',      dot: 'bg-amber-500 animate-pulse shadow-[0_0_20px_rgba(245,158,11,0.5)]', badge: 'bg-[var(--tint-amber-bg)] text-[var(--tint-amber-fg)] border-[var(--tint-amber-edge)]', icon: Clock, color: 'text-[var(--tint-amber-fg)]' },
  failed:     { label: 'FAILED',      dot: 'bg-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.5)]', badge: 'bg-[var(--tint-rose-bg)] text-[var(--tint-rose-fg)] border-[var(--tint-rose-edge)]', icon: AlertCircle, color: 'text-[var(--tint-rose-fg)]' },
}

const glassStyle = 'backdrop-blur-[var(--glass-blur)] bg-[var(--glass-surface)] border border-[var(--glass-border)] shadow-[var(--glass-glow)] transition-all duration-300'

export default function KineticSynthesisHubPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { socket, connected, on, off } = useSocket(user?.id || null)
  const { resolvedTheme, toggle } = useTheme()
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
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
    if (!socket || !connected) return
    const handler = (data: any) => {
      if (data.status === 'completed') { setSuccess(`AXIOM_MANIFEST_COMPLETE: ${data.clips || 0} SPECTRAL_FRAGMENTS`); setTimeout(loadSpectralInventory, 500) }
      else if (data.status === 'failed') { setError('Video processing failed'); setTimeout(loadSpectralInventory, 500) }
    }
    on('video-processed', handler)
    return () => off('video-processed', handler)
  }, [socket, connected, on, off, loadSpectralInventory])

  const [pageDragOver, setPageDragOver] = useState(false)
  const [pageDropProgress, setPageDropProgress] = useState<number | null>(null)

  const handleForgePayload = useCallback(async (_file: File, uploadResponse?: any) => {
    setError(''); setSuccess('')
    if (!uploadResponse) { setError('Upload failed — empty response'); return }
    const contentId = uploadResponse.data?.contentId || uploadResponse.contentId
    if (!contentId) { setError('Upload failed — missing video ID'); return }
    setSuccess('Upload received — processing your video…')
    await loadSpectralInventory()
    router.push(`/dashboard/video/edit/${contentId}`)
  }, [loadSpectralInventory, router])

  const uploadFromPageDrop = useCallback(async (file: File) => {
    if (!/^video\//.test(file.type)) { setError('Drop a video file (.mp4 / .mov / .webm)'); return }
    setError('')
    setPageDropProgress(0)
    try {
      const fd = new FormData()
      fd.append('video', file)
      fd.append('title', file.name.replace(/\.[^.]+$/, ''))
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const xhr = new XMLHttpRequest()
      const result: any = await new Promise((resolve, reject) => {
        xhr.open('POST', '/api/video/upload')
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setPageDropProgress(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () => {
          try {
            const json = JSON.parse(xhr.responseText)
            if (xhr.status >= 200 && xhr.status < 300 && json.success !== false) resolve(json)
            else reject(new Error(json.error || json.message || `HTTP ${xhr.status}`))
          } catch (e) { reject(e) }
        }
        xhr.onerror = () => reject(new Error('Network error during upload'))
        xhr.send(fd)
      })
      await handleForgePayload(file, result)
    } catch (e: any) {
      setError(e?.message || 'Upload failed')
    } finally {
      setPageDropProgress(null)
    }
  }, [handleForgePayload])

  useEffect(() => {
    let dragDepth = 0
    const onDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes('Files')) return
      dragDepth++
      setPageDragOver(true)
    }
    const onDragLeave = () => {
      dragDepth = Math.max(0, dragDepth - 1)
      if (dragDepth === 0) setPageDragOver(false)
    }
    const onDragOver = (e: DragEvent) => { e.preventDefault() }
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      dragDepth = 0
      setPageDragOver(false)
      const f = e.dataTransfer?.files?.[0]
      if (f) void uploadFromPageDrop(f)
    }
    document.addEventListener('dragenter', onDragEnter)
    document.addEventListener('dragleave', onDragLeave)
    document.addEventListener('dragover', onDragOver)
    document.addEventListener('drop', onDrop)
    return () => {
      document.removeEventListener('dragenter', onDragEnter)
      document.removeEventListener('dragleave', onDragLeave)
      document.removeEventListener('dragover', onDragOver)
      document.removeEventListener('drop', onDrop)
    }
  }, [uploadFromPageDrop])

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
    <div className="flex flex-col items-center justify-center py-24 bg-[var(--page-bg)] min-h-screen gap-12 transition-colors duration-500">
       <div className="relative">
          <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-20 animate-pulse" />
          <RefreshCw size={80} className="text-indigo-500 animate-spin relative z-10" />
       </div>
       <div className="space-y-4 text-center">
          <p className="text-[14px] font-bold text-[var(--tint-indigo-fg)] uppercase tracking-[0.4em] animate-pulse leading-none">Loading videos…</p>
       </div>
    </div>
  )

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-24 px-4 sm:px-8 pt-12 max-w-[1700px] mx-auto space-y-20 bg-[var(--page-bg)] text-[var(--text-main)] transition-colors duration-500">
        <ToastContainer />

        <AnimatePresence>
          {(pageDragOver || pageDropProgress !== null) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center"
            >
              <div className="absolute inset-0 bg-indigo-950/85 backdrop-blur-sm" />
              <motion.div
                initial={{ scale: 0.92 }}
                animate={{ scale: 1 }}
                className="relative z-10 px-8 sm:px-12 py-12 sm:py-16 rounded-[2rem] sm:rounded-[3rem] border-2 border-dashed border-indigo-400/60 bg-[var(--tint-indigo-bg)] max-w-xl mx-auto text-center"
              >
                <Upload className="w-12 h-12 sm:w-16 sm:h-16 text-indigo-300 mx-auto mb-6" />
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-3">
                  {pageDropProgress !== null ? 'Uploading…' : 'Drop your video to start'}
                </h2>
                {pageDropProgress !== null && (
                  <div className="mt-6 h-2 w-full rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-indigo-400 to-fuchsia-400 transition-all duration-200" style={{ width: `${pageDropProgress}%` }} />
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
           <Video size={800} className="text-[var(--text-main)] absolute -bottom-40 -left-40 rotate-12" />
        </div>

        <SwarmConsensusHUD isVisible={showSwarmHUD} taskName={swarmHUDTask} onComplete={() => setShowSwarmHUD(false)} />

        <div className="flex flex-col lg:flex-row items-center justify-between gap-12 relative z-50">
           <div className="flex items-center gap-4 sm:gap-8 w-full md:w-auto">
              <button type="button" onClick={() => router.push('/dashboard')} className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl sm:rounded-[1.8rem] bg-[var(--glass-surface)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-main)] transition-colors active:scale-95">
                <ArrowLeft size={24} />
              </button>
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[var(--tint-indigo-bg)] border-2 border-[var(--tint-indigo-edge)] rounded-2xl sm:rounded-[2.5rem] flex items-center justify-center shadow-xl">
                <Film size={32} className="text-[var(--tint-indigo-fg)]" />
              </div>
              <div className="flex-1">
                 <div className="flex items-center gap-3 mb-2 flex-wrap">
                   <Cpu size={14} className="text-[var(--tint-indigo-fg)] animate-pulse" />
                   <span className="text-[9px] sm:text-[11px] font-bold uppercase tracking-[0.4em] text-[var(--tint-indigo-fg)]">Click · Video Studio</span>
                 </div>
                 <h1 className="text-[clamp(1.5rem,6vw,4rem)] font-black text-[var(--text-main)] tracking-tighter leading-none mb-2">Video Library</h1>
              </div>
           </div>

           <div className="flex items-center gap-3 sm:gap-4 w-full md:w-auto justify-end">
             <button onClick={toggle} className="w-12 h-12 rounded-2xl bg-[var(--glass-surface)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-main)] hover:scale-105 transition-all shadow-xl">
               {resolvedTheme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
             </button>
             <button type="button" onClick={() => { setSwarmHUDTask('Refreshing video inventory'); setShowSwarmHUD(true); loadSpectralInventory() }} className="px-5 sm:px-7 py-3 bg-[var(--glass-surface)] border border-[var(--glass-border)] text-[var(--text-dim)] hover:text-[var(--text-main)] rounded-2xl text-[10px] sm:text-[12px] font-bold uppercase tracking-[0.2em] shadow-lg transition-colors flex items-center gap-3">
               <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
               <span>Refresh</span>
             </button>
           </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 relative z-10">
          {[
            { label: 'Videos',          value: videos.length,    icon: Layers,          color: 'text-[var(--tint-indigo-fg)]',  bg: 'bg-indigo-500/5' },
            { label: 'Completed',       value: completedCount,   icon: ActivitySquare,  color: 'text-[var(--tint-emerald-fg)]', bg: 'bg-emerald-500/5' },
            { label: 'Total Clips',     value: totalClips,       icon: Sparkles,        color: 'text-[var(--tint-rose-fg)]',    bg: 'bg-rose-500/5' },
          ].map(s => (
            <div key={s.label} className={`${glassStyle} rounded-[2rem] p-6 sm:p-7 flex items-center gap-5 group hover:bg-[var(--glass-surface-heavy)]`}>
               <div className={`w-12 h-12 sm:w-14 sm:h-14 ${s.bg} rounded-2xl flex items-center justify-center border border-[var(--glass-border)]`}>
                  <s.icon size={22} className={s.color} />
               </div>
               <div>
                 <div className={`text-3xl sm:text-4xl font-black tabular-nums leading-none tracking-tighter mb-2 ${s.color}`}>{s.value}</div>
                 <div className="text-[10px] text-[var(--text-dim)] font-bold uppercase tracking-[0.3em] leading-none">{s.label}</div>
               </div>
            </div>
          ))}
        </div>

        <div className={`${glassStyle} rounded-[3rem] sm:rounded-[6rem] overflow-hidden relative z-10 group`}>
          <div className="bg-indigo-600 p-8 sm:p-20 relative overflow-hidden">
             <div className="absolute -top-40 -right-40 opacity-[0.05] pointer-events-none group-hover:rotate-180 transition-transform duration-700"><Upload size={600} /></div>
             <div className="relative flex flex-col xl:flex-row items-center justify-between gap-8 z-10 text-center xl:text-left">
                <div className="flex flex-col xl:flex-row items-center gap-6">
                   <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/10 rounded-2xl sm:rounded-[2rem] flex items-center justify-center shadow-lg border-2 border-[var(--glass-border-strong)]"><Upload size={32} className="text-white" /></div>
                   <div>
                      <h2 className="text-white font-black tracking-tighter text-3xl sm:text-4xl leading-tight mb-2">Drop a video to get started</h2>
                      <p className="text-white/70 text-[13px] font-medium leading-relaxed">Synthesize viral fragments automatically.</p>
                   </div>
                </div>
             </div>
          </div>
          <div className="p-6 sm:p-10 bg-[var(--glass-surface)] backdrop-blur-[var(--glass-blur)]">
            <FileUpload onUpload={(file, res) => { setSwarmHUDTask('Analyzing your video'); setShowSwarmHUD(true); handleForgePayload(file, res) }} uploadUrl="/api/video/upload" />
          </div>
        </div>

        {videos.length > 0 && (
          <div className="space-y-10 relative z-10">
            <div className="flex flex-col md:flex-row items-stretch lg:items-center gap-6">
               <div className="relative flex-1">
                  <Target size={20} className="absolute left-6 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="SCAN_INVENTORY..." className="w-full bg-[var(--glass-surface)] border border-[var(--glass-border)] rounded-full pl-14 pr-6 py-4 text-[13px] font-black text-[var(--text-main)] uppercase tracking-[0.4em] italic focus:outline-none focus:border-indigo-500/50" />
               </div>
               <div className="flex items-center gap-2 flex-wrap">
                  {['all', 'completed', 'processing', 'failed'].map(opt => (
                    <button key={opt} onClick={() => setStatusFilter(opt as any)} className={`px-4 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.3em] italic border transition-all ${statusFilter === opt ? 'bg-[var(--text-main)] text-[var(--page-bg)]' : 'bg-[var(--glass-surface)] border-[var(--glass-border)] text-[var(--text-dim)]'}`}>
                      {opt.toUpperCase()}
                    </button>
                  ))}
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 sm:gap-16">
              {visibleVideos.map(video => {
                const cfg = getStatusCfg(video.status)
                const clips = video.generatedContent?.shortVideos || []
                return (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} key={video._id} className={`${glassStyle} rounded-[3rem] sm:rounded-[5rem] overflow-hidden group flex flex-col hover:border-[var(--tint-indigo-edge)]`}>
                    <div className="aspect-video relative bg-black/60 overflow-hidden border-b border-[var(--glass-border)]">
                      <video src={video.originalFile?.url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" preload="metadata" muted onMouseEnter={e => e.currentTarget.play()} onMouseLeave={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0 }} />
                      <div className="absolute top-6 left-6 flex items-center gap-3 px-4 py-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-black text-white">
                        <div className={`w-2 h-2 rounded-full ${cfg.dot}`} /> {cfg.label}
                      </div>
                    </div>
                    <div className="p-8 sm:p-12 space-y-8 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="text-2xl sm:text-3xl font-black text-[var(--text-main)] italic uppercase tracking-tighter truncate mb-4">{video.title}</h3>
                        <div className="flex items-center justify-between text-[10px] font-black text-[var(--text-dim)] uppercase tracking-widest italic">
                          <span className="flex items-center gap-2"><Clock size={14} /> {new Date(video.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <button onClick={() => router.push(`/dashboard/video/edit/${video._id}`)} className="w-full py-5 sm:py-6 bg-[var(--text-main)] text-[var(--page-bg)] rounded-[2rem] text-sm font-black uppercase tracking-[0.4em] italic hover:opacity-90 transition-all flex items-center justify-center gap-4 group/btn">
                        <Terminal size={20} className="group-hover/btn:translate-x-1 transition-transform" /> OPEN_FORGE
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        )}

        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');
          body { font-family: 'Outfit', sans-serif; transition: background 0.5s; }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}
