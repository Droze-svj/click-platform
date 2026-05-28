'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import FileUpload from '../../../components/FileUpload'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { extractApiError } from '../../../utils/apiResponse'
import { useSocket } from '../../../hooks/useSocket'
import { useAuth } from '../../../hooks/useAuth'
import { apiGet } from '../../../lib/api'
import {
  Video, Upload, UploadCloud, Play, Loader2, CheckCircle, AlertCircle,
  RefreshCw, Layers, Clock, ArrowLeft,
  Search, Target, FileVideo, ActivitySquare, Sparkles, Filter, MoreVertical,
  ChevronRight, LayoutDashboard, BrainCircuit, PlayCircle, Eye, Trash2, Download,
  Share2, Edit3, Settings2, Database, History, Cloud, Activity, Box, Monitor, Signal,
  ShieldCheck, Zap
} from 'lucide-react'
import { SwarmConsensusHUD } from '../../../components/editor/SwarmConsensusHUD'
import { motion, AnimatePresence } from 'framer-motion'
import ToastContainer from '../../../components/ToastContainer'
import { useTheme } from '../../../components/ThemeProvider'
import { useTranslation } from '../../../hooks/useTranslation'

interface VideoItem {
  _id: string
  title: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | string
  originalFile?: { url: string; filename?: string }
  generatedContent?: { shortVideos: Array<{ url: string; thumbnail: string; caption: string; duration: number; platform: string }> }
  createdAt: string
}

const STATUS_CFG: Record<string, { label: string; bg: string; text: string; icon: any }> = {
  completed:  { label: 'Completed',  bg: 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]', text: 'text-emerald-500', icon: CheckCircle },
  processing: { label: 'Processing', bg: 'bg-primary-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]', text: 'text-primary-500', icon: Loader2 },
  pending:    { label: 'Queued',     bg: 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]', text: 'text-amber-500', icon: Clock },
  failed:     { label: 'Failed',     bg: 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.5)]', text: 'text-rose-500', icon: AlertCircle },
}

export default function VideoStudioPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const aiTool = searchParams?.get('aiTool') || ''
  const editLink = useCallback(
    (id: string) => `/dashboard/video/edit/${id}${aiTool ? `?aiTool=${aiTool}` : ''}`,
    [aiTool]
  )
  const { user, loading: authLoading } = useAuth()
  const { t } = useTranslation()
  const tRef = useRef(t)
  useEffect(() => { tRef.current = t }, [t])
  const tr = useCallback((key: string, fallback: string, vars?: Record<string, string | number>) => {
    let v = tRef.current(key); if (v === key) v = fallback
    if (vars) for (const [k, val] of Object.entries(vars)) v = v.replace(new RegExp(`\\{${k}\\}`, 'g'), String(val))
    return v
  }, [])

  const getStatusCfg = useCallback((status: string) => {
    const cfg = STATUS_CFG[status as keyof typeof STATUS_CFG] || STATUS_CFG.pending
    return {
      ...cfg,
      label: tr(`studio.${status === 'pending' ? 'queued' : status}`, cfg.label)
    }
  }, [tr])
  const { socket, connected, on, off } = useSocket(user?.id || null)
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showSwarmHUD, setShowSwarmHUD] = useState(false)
  const [swarmHUDTask, setSwarmHUDTask] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'processing' | 'pending' | 'failed'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const loadVideos = useCallback(async () => {
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
    loadVideos()
  }, [user, authLoading, loadVideos, router])

  useEffect(() => {
    if (!socket || !connected) return
    const handler = (data: any) => {
      if (data.status === 'completed') { setSuccess(tr('studio.analysisComplete', '✓ ANALYSIS_COMPLETE: {count} CLIPS_GENERATED', { count: data.clips || 0 })); setTimeout(loadVideos, 500) }
      else if (data.status === 'failed') { setError(tr('studio.processingFailure', 'PROCESSING_FAILURE: SEQUENCE_ABORTED')); setTimeout(loadVideos, 500) }
    }
    on('video-processed', handler)
    return () => off('video-processed', handler)
  }, [socket, connected, on, off, loadVideos, tr])

  const [pageDragOver, setPageDragOver] = useState(false)
  const [pageDropProgress, setPageDropProgress] = useState<number | null>(null)

  const handleUploadResponse = useCallback(async (_file: File, uploadResponse?: any) => {
    setError(''); setSuccess('')
    if (!uploadResponse) { setError(tr('studio.uploadFailed', 'WRITE_ERR: UPLOAD_FAILED')); return }
    const contentId = uploadResponse.data?.contentId || uploadResponse.contentId
    if (!contentId) { setError(tr('studio.missingContentId', 'PARAM_ERR: MISSING_CONTENT_ID')); return }
    setSuccess(tr('studio.uploadStable', '✓ UPLOAD_STABLE: ANALYZING_VECTORS...'))
    await loadVideos()
    router.push(editLink(contentId))
  }, [loadVideos, router, editLink, tr])

  const uploadFromPageDrop = useCallback(async (file: File) => {
    if (!/^video\//.test(file.type)) { setError(tr('studio.invalidVideo', 'MIME_ERR: INVALID_VIDEO_FORMAT')); return }
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
      await handleUploadResponse(file, result)
    } catch (e: any) {
      setError(e?.message || 'Upload failed')
    } finally {
      setPageDropProgress(null)
    }
  }, [handleUploadResponse, tr])

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
    document.addEventListener('dragenter', onDragEnter as any)
    document.addEventListener('dragleave', onDragLeave as any)
    document.addEventListener('dragover', onDragOver as any)
    document.addEventListener('drop', onDrop as any)
    return () => {
      document.removeEventListener('dragenter', onDragEnter as any)
      document.removeEventListener('dragleave', onDragLeave as any)
      document.removeEventListener('dragover', onDragOver as any)
      document.removeEventListener('drop', onDrop as any)
    }
  }, [uploadFromPageDrop])


  const completedCount = videos.filter(v => v.status === 'completed').length
  const processingCount = videos.filter(v => v.status === 'processing' || v.status === 'pending').length
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
    <div className="flex flex-col items-center justify-center py-48 bg-surface-page min-h-screen transition-colors duration-500">
       <Loader2 size={80} className="text-primary-500 animate-spin mb-12" />
       <p className="text-sm font-black text-surface-500 uppercase tracking-widest animate-pulse italic leading-none">{tr('studio.syncingStudio', 'Syncing Neural Studio...')}</p>
    </div>
  )

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-4 sm:px-6 lg:px-12 pt-10 max-w-[1900px] mx-auto space-y-16 bg-surface-page text-surface-900 dark:text-surface-50 transition-colors duration-500 font-inter overflow-x-hidden">
        <ToastContainer />

        <AnimatePresence>
          {(pageDragOver || pageDropProgress !== null) && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] bg-surface-950/90 backdrop-blur-3xl flex items-center justify-center border-[12px] border-dashed border-primary-500/50"
            >
              <div className="bg-surface-card p-16 rounded-[4rem] shadow-[0_100px_300px_rgba(0,0,0,0.8)] border-2 border-surface-100 dark:border-surface-800 text-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-primary-500/5 animate-pulse pointer-events-none" />
                <Upload className="w-24 h-24 text-primary-500 mx-auto mb-10 animate-bounce relative z-10" />
                <h2 className="text-6xl font-black text-surface-900 dark:text-white tracking-tighter italic uppercase mb-6 relative z-10">
                  {pageDropProgress !== null ? tr('studio.syncingPayload', 'Syncing Payload...') : tr('studio.dropPayload', 'Drop Payload Here')}
                </h2>
                <p className="text-[12px] font-black text-surface-400 uppercase tracking-[0.6em] italic mb-10 relative z-10">{tr('studio.neuralIngestionReady', 'NEURAL_STUDIO_INGESTION_READY')}</p>
                {pageDropProgress !== null && (
                  <div className="mt-10 h-4 w-full max-w-md mx-auto rounded-full bg-surface-page dark:bg-surface-950 overflow-hidden shadow-inner border border-surface-100 dark:border-surface-800 relative z-10">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pageDropProgress}%` }} className="h-full bg-primary-500 shadow-[0_0_30px_rgba(99,102,241,0.6)] transition-all duration-200" />
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <SwarmConsensusHUD isVisible={showSwarmHUD} taskName={swarmHUDTask} onComplete={() => setShowSwarmHUD(false)} />

        {/* Tactical Header HUD */}
        <header className="flex flex-col lg:flex-row items-center justify-between gap-12 pb-12 border-b-2 border-surface-100 dark:border-surface-800 relative z-50">
           <div className="flex items-center gap-8 w-full lg:w-auto min-w-0">
              <button type="button" onClick={() => router.push('/dashboard')} title="Back to Dashboard" aria-label="Back to Dashboard"
                className="w-16 h-16 rounded-2xl bg-surface-card dark:bg-surface-900 border-2 border-surface-100 dark:border-surface-800 flex items-center justify-center text-surface-400 hover:text-primary-500 hover:border-primary-500/30 transition-all shadow-xl active:scale-90 group">
                <ArrowLeft size={28} className="group-hover:-translate-x-1 transition-transform" />
              </button>
              <div className="w-24 h-24 rounded-[2.5rem] bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center shadow-2xl flex-shrink-0 group hover:rotate-12 transition-transform duration-700">
                <FileVideo size={48} className="text-primary-600 dark:text-primary-400" />
              </div>
              <div className="flex-1 min-w-0">
                 <div className="flex items-center gap-4 mb-3 flex-wrap">
                    <span className="px-4 py-1.5 rounded-xl text-[10px] font-black bg-primary-500/10 text-primary-600 dark:text-primary-400 uppercase tracking-[0.3em] border-2 border-primary-500/20 shadow-inner italic leading-none">
                      {tr('studio.advancedStudio', 'Advanced Studio')}
                    </span>
                    <div className="flex items-center gap-3 px-4 py-1.5 rounded-xl bg-surface-card dark:bg-surface-900 text-surface-500 border-2 border-surface-100 dark:border-surface-800 text-[10px] font-black italic shadow-inner">
                        <div className="w-2.5 h-2.5 rounded-full bg-primary-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                        {tr('studio.payloadsDetected', '{count} PAYLOADS_DETECTED', { count: videos.length })}
                    </div>
                 </div>
                 <h1 className="text-5xl sm:text-6xl font-black tracking-tighter leading-none mt-4 truncate uppercase italic drop-shadow-2xl">{tr('studio.videoStudio', 'Video Studio')}</h1>
              </div>
           </div>

           <div className="flex items-center gap-6 w-full lg:w-auto justify-end">
              <button type="button" onClick={() => { setSwarmHUDTask('Refreshing inventory'); setShowSwarmHUD(true); loadVideos() }} 
                className="px-10 py-5 bg-surface-card dark:bg-surface-900 border-2 border-primary-500/20 text-surface-900 dark:text-white hover:bg-surface-page dark:hover:bg-primary-500/5 rounded-2xl text-[12px] font-black uppercase tracking-[0.5em] shadow-2xl transition-all flex items-center gap-5 active:scale-95 italic group/sync"
              >
                <RefreshCw size={24} className={`group-hover/sync:rotate-180 transition-transform duration-700 ${loading ? 'animate-spin' : ''}`} />
                <span>{tr('studio.syncArchive', 'Sync Archive')}</span>
              </button>
           </div>
        </header>

        {/* Performance Matrix Stats */}
        <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-10 relative z-10">
          {[
            { label: tr('studio.payloadInventory', 'Payload Inventory'), value: videos.length, icon: Layers, colors: 'bg-primary-500/10 text-primary-600 dark:text-primary-400 border-primary-500/20' },
            { label: tr('studio.neuralProcessed', 'Neural Processed'), value: completedCount, icon: ActivitySquare, colors: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
            { label: tr('studio.syntheticYields', 'Synthetic Yields'), value: totalClips, icon: Sparkles, colors: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
          ].map((s, idx) => (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }} key={s.label} className="bg-surface-card backdrop-blur-3xl border-2 border-surface-100 dark:border-surface-800 rounded-[3rem] p-10 shadow-2xl flex items-center gap-8 group hover:bg-surface-page transition-all duration-700 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none group-hover:opacity-[0.05] transition-opacity duration-1000"><s.icon size={150} /></div>
               <div className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center shrink-0 shadow-lg group-hover:rotate-12 transition-all duration-500 relative z-10 ${s.colors}`}>
                  <s.icon size={32} />
               </div>
               <div className="relative z-10">
                 <p className="text-[11px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-[0.5em] italic mb-3 leading-none">{s.label}</p>
                 <h4 className="text-5xl font-black text-surface-900 dark:text-white tracking-tighter leading-none italic">{s.value}</h4>
               </div>
            </motion.div>
          ))}
        </section>

        {/* Intake Module */}
        <section className="bg-surface-card backdrop-blur-3xl border-2 border-surface-100 dark:border-surface-800 rounded-[4rem] sm:rounded-[5rem] overflow-hidden relative z-10 shadow-2xl flex flex-col xl:flex-row transition-all duration-700 hover:shadow-[0_80px_150px_rgba(0,0,0,0.5)] group">
          <div className="bg-primary-500/5 dark:bg-primary-900/10 p-12 sm:p-20 xl:w-1/3 border-b-2 xl:border-b-0 xl:border-r-2 border-surface-100 dark:border-surface-800 flex flex-col justify-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-[0.02] pointer-events-none group-hover:opacity-[0.05] transition-opacity duration-1000"><UploadCloud size={300} className="text-primary-500" /></div>
            <div className="w-24 h-24 bg-surface-page dark:bg-surface-950 rounded-[2rem] flex items-center justify-center border-2 border-surface-100 dark:border-surface-800 mb-10 shadow-2xl relative z-10 group-hover:rotate-12 transition-transform duration-1000">
              <Upload size={40} className="text-primary-600 dark:text-primary-400" />
            </div>
            <h2 className="text-4xl font-black text-surface-900 dark:text-white tracking-tighter italic uppercase leading-none mb-6 relative z-10">{tr('studio.initializeIntake', 'Initialize Intake')}</h2>
            <p className="text-[13px] font-bold text-surface-400 dark:text-slate-600 leading-relaxed italic uppercase tracking-tight relative z-10">
              {tr('studio.intakeHint', 'Inject raw footage or multi-track sequences into the neural matrix. A/B Swarm will auto-calibrate vectors for optimal high-velocity synthesis.')}
            </p>
          </div>
          <div className="p-12 sm:p-20 xl:w-2/3 flex items-center justify-center bg-surface-page/20 dark:bg-white/[0.01] backdrop-blur-3xl relative">
            <div className="absolute inset-0 bg-primary-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />
            <div className="w-full max-w-2xl relative z-10">
              <FileUpload onUpload={(file, res) => { setSwarmHUDTask('Analyzing your video'); setShowSwarmHUD(true); handleUploadResponse(file, res) }} uploadUrl="/api/video/upload" />
            </div>
          </div>
        </section>

        {/* Archive Lattices */}
        {videos.length > 0 && (
          <section className="space-y-12 relative z-10">
            <header className="flex flex-col md:flex-row items-stretch lg:items-center gap-8 justify-between border-b-2 border-surface-100 dark:border-surface-800 pb-10">
               <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-[1.5rem] bg-surface-card dark:bg-surface-900 border-2 border-surface-100 dark:border-surface-800 flex items-center justify-center shadow-xl group hover:border-primary-500/30 transition-all">
                    <Database size={32} className="text-surface-300 dark:text-slate-800 group-hover:text-primary-500 transition-colors" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-surface-900 dark:text-white tracking-tighter italic uppercase leading-none mb-2">{tr('studio.payloadArchive', 'Payload Archive')}</h3>
                    <p className="text-[10px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-[0.5em] italic leading-none">{tr('studio.secureStorage', 'SECURE_STORAGE_NODES')}</p>
                  </div>
               </div>
               <div className="flex flex-col sm:flex-row items-center gap-8 flex-1 justify-end max-w-4xl">
                 <div className="relative w-full sm:w-96 group">
                    <Search size={24} className="absolute left-8 top-1/2 -translate-y-1/2 text-surface-200 dark:text-slate-800 group-focus-within:text-primary-500 transition-colors" />
                    <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={tr('studio.searchArchive', 'SEARCH_ARCHIVE...')} className="w-full bg-surface-card dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 rounded-3xl pl-20 pr-8 py-5 text-base font-black text-surface-900 dark:text-white uppercase italic tracking-widest focus:outline-none focus:border-primary-500 transition-all shadow-inner backdrop-blur-xl" />
                 </div>
                 <div className="flex items-center gap-3 w-full sm:w-auto bg-surface-card dark:bg-surface-950/60 p-2.5 rounded-[2rem] border-2 border-surface-100 dark:border-surface-800 shadow-inner overflow-x-auto custom-scrollbar">
                    {['all', 'completed', 'processing', 'failed'].map(opt => (
                      <button type="button" key={opt} onClick={() => setStatusFilter(opt as any)} className={`px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all italic whitespace-nowrap ${statusFilter === opt ? 'bg-surface-900 dark:bg-white text-white dark:text-black shadow-2xl scale-105 z-10' : 'text-surface-400 dark:text-slate-700 hover:text-surface-900 dark:hover:text-white'}`}>
                        {tr(`studio.${opt}`, opt)}
                      </button>
                    ))}
                 </div>
               </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-12">
              {visibleVideos.map((video, idx) => {
                const cfg = getStatusCfg(video.status)
                return (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.05 }} layout key={video._id} className="bg-surface-card backdrop-blur-3xl border-2 border-surface-100 dark:border-surface-800 rounded-[3.5rem] overflow-hidden group flex flex-col hover:border-primary-500/50 transition-all duration-700 shadow-2xl relative">
                    <div className="aspect-video relative bg-surface-page dark:bg-surface-950 overflow-hidden border-b-2 border-surface-100 dark:border-surface-800">
                      <video src={video.originalFile?.url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[2s]" preload="metadata" muted onMouseEnter={e => e.currentTarget.play()} onMouseLeave={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0 }} />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center backdrop-blur-sm">
                        <button type="button" onClick={() => router.push(editLink(video._id))} aria-label={`Open ${video.title || 'video'} in editor`} title={`Open ${video.title || 'video'} in editor`} className="w-20 h-20 bg-white text-black rounded-[2rem] flex items-center justify-center shadow-[0_40px_100px_rgba(255,255,255,0.4)] transform translate-y-12 group-hover:translate-y-0 transition-all duration-700 active:scale-90 border-none group/play">
                          <Play size={36} className="ml-1 fill-current group-hover:scale-125 transition-transform" />
                        </button>
                      </div>
                      <div className="absolute top-8 left-8 flex items-center gap-3.5 px-6 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest italic backdrop-blur-3xl bg-white/90 dark:bg-surface-900/90 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-2 border-white/20 dark:border-white/5">
                        <div className={`w-3.5 h-3.5 rounded-full ${cfg.bg} animate-pulse`} /> 
                        <span className="text-surface-900 dark:text-white">{cfg.label}</span>
                      </div>
                    </div>
                    <div className="p-10 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-8 mb-6">
                          <h3 className="text-2xl font-black text-surface-900 dark:text-white truncate uppercase italic tracking-tighter leading-none group-hover:text-primary-500 transition-colors" title={video.title}>{video.title}</h3>
                          <button title="More Options" aria-label="More Options" className="text-surface-200 dark:text-slate-900 hover:text-surface-900 dark:hover:text-white transition-all shrink-0 active:scale-90 border-none bg-transparent">
                            <MoreVertical size={28} />
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center text-[10px] font-black text-surface-300 dark:text-slate-800 gap-10 italic uppercase tracking-[0.3em]">
                          <span className="flex items-center gap-3.5 group/meta hover:text-primary-500 transition-colors"><Clock size={18} className="text-primary-500 group-hover/meta:scale-110 transition-transform" /> {new Date(video.createdAt).toLocaleDateString().toUpperCase()}</span>
                          <span className="flex items-center gap-3.5 group/meta hover:text-primary-500 transition-colors"><Sparkles size={18} className="text-primary-500 group-hover/meta:scale-110 transition-transform" /> {video.generatedContent?.shortVideos?.length || 0} {tr('studio.yields', 'YIELDS')}</span>
                        </div>
                      </div>
                      <button type="button" onClick={() => router.push(editLink(video._id))} className="w-full mt-12 py-6 bg-surface-900 dark:bg-white text-white dark:text-black rounded-[1.8rem] text-[13px] font-black uppercase tracking-[0.6em] italic hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white transition-all shadow-[0_30px_70px_rgba(0,0,0,0.4)] active:scale-95 border-none">
                        {tr('studio.open', 'Open')}
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </section>
        )}
        
        <div className="px-8 py-5 bg-surface-page dark:bg-surface-950/60 border-t-2 border-surface-100 dark:border-surface-800 flex flex-wrap items-center justify-between gap-6">
           <div className="flex items-center gap-4">
              <div className="w-2.5 h-2.5 rounded-full bg-primary-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
              <p className="text-[10px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-[0.4em] italic leading-none">
                <span className="text-primary-500">{tr('studio.tip', 'TUTORIAL_CORE:')}</span> {tr('studio.tipPaste', 'PASTE_URL (⌘V) ON THIS HUD FOR AUTO-SYNC.')}
              </p>
           </div>
           <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                 <ShieldCheck size={14} className="text-emerald-500" />
                 <span className="text-[9px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-[0.3em] italic">{tr('studio.secureTunnel', 'SECURE_TUNNEL')}</span>
              </div>
              <div className="flex items-center gap-3">
                 <Zap size={14} className="text-amber-500" />
                 <span className="text-[9px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-[0.3em] italic">{tr('studio.highVelocity', 'HIGH_VELOCITY')}</span>
              </div>
           </div>
        </div>
        
        <style jsx global>{`
          .custom-scrollbar::-webkit-scrollbar { width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.1); border-radius: 20px; }
          .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.2); }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}

