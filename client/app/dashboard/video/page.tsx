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
  Video, Upload, Play, Loader2, CheckCircle, AlertCircle,
  RefreshCw, Layers, Clock, ArrowLeft,
  Search, Target, FileVideo, ActivitySquare, Sparkles, Filter, MoreVertical
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

const STATUS_CFG: Record<string, { label: string; bg: string; text: string; icon: any }> = {
  completed:  { label: 'Completed',  bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle },
  processing: { label: 'Processing', bg: 'bg-indigo-100 dark:bg-indigo-900/40', text: 'text-indigo-700 dark:text-indigo-400', icon: Loader2 },
  pending:    { label: 'Queued',     bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-400', icon: Clock },
  failed:     { label: 'Failed',     bg: 'bg-rose-100 dark:bg-rose-900/40', text: 'text-rose-700 dark:text-rose-400', icon: AlertCircle },
}

export default function VideoStudioPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
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
      if (data.status === 'completed') { setSuccess(`Analysis Complete: ${data.clips || 0} clips generated`); setTimeout(loadVideos, 500) }
      else if (data.status === 'failed') { setError('Video processing failed'); setTimeout(loadVideos, 500) }
    }
    on('video-processed', handler)
    return () => off('video-processed', handler)
  }, [socket, connected, on, off, loadVideos])

  const [pageDragOver, setPageDragOver] = useState(false)
  const [pageDropProgress, setPageDropProgress] = useState<number | null>(null)

  const handleUploadResponse = useCallback(async (_file: File, uploadResponse?: any) => {
    setError(''); setSuccess('')
    if (!uploadResponse) { setError('Upload failed — empty response'); return }
    const contentId = uploadResponse.data?.contentId || uploadResponse.contentId
    if (!contentId) { setError('Upload failed — missing video ID'); return }
    setSuccess('Upload successful — analyzing your video...')
    await loadVideos()
    router.push(`/dashboard/video/edit/${contentId}`)
  }, [loadVideos, router])

  const uploadFromPageDrop = useCallback(async (file: File) => {
    if (!/^video\//.test(file.type)) { setError('Please upload a valid video file (.mp4, .mov, .webm)'); return }
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
  }, [handleUploadResponse])

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
    <div className="flex flex-col items-center justify-center py-24 bg-surface-50 dark:bg-surface-950 min-h-screen">
       <Loader2 size={40} className="text-primary-500 animate-spin mb-6" />
       <p className="text-sm font-bold text-surface-500 uppercase tracking-widest animate-pulse">Loading Video Studio...</p>
    </div>
  )

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-24 px-4 sm:px-6 lg:px-12 pt-8 max-w-[1900px] mx-auto space-y-8 bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-surface-50 transition-colors duration-500">
        <ToastContainer />

        <AnimatePresence>
          {(pageDragOver || pageDropProgress !== null) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] bg-surface-900/80 backdrop-blur-sm flex items-center justify-center border-[12px] border-dashed border-primary-500/50"
            >
              <div className="bg-white dark:bg-surface-900 p-12 rounded-[3rem] shadow-2xl border border-surface-200 dark:border-surface-800 text-center">
                <Upload className="w-16 h-16 text-primary-500 mx-auto mb-6" />
                <h2 className="text-3xl font-black text-surface-900 dark:text-white tracking-tight mb-3">
                  {pageDropProgress !== null ? 'Uploading Video...' : 'Drop video here'}
                </h2>
                {pageDropProgress !== null && (
                  <div className="mt-6 h-2 w-full max-w-sm mx-auto rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden">
                    <div className="h-full bg-primary-500 transition-all duration-200" style={{ width: `${pageDropProgress}%` }} />
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <SwarmConsensusHUD isVisible={showSwarmHUD} taskName={swarmHUDTask} onComplete={() => setShowSwarmHUD(false)} />

        {/* Header */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-surface-200 dark:border-surface-800">
           <div className="flex items-center gap-5 w-full md:w-auto">
              <button type="button" onClick={() => router.push('/dashboard')} className="w-12 h-12 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 flex items-center justify-center text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors shadow-sm">
                <ArrowLeft size={20} />
              </button>
              <div className="w-16 h-16 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-2xl flex items-center justify-center shadow-sm">
                <FileVideo size={32} className="text-primary-600 dark:text-primary-400" />
              </div>
              <div className="flex-1">
                 <div className="flex items-center gap-2 mb-1">
                   <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400 uppercase tracking-wide border border-primary-200 dark:border-primary-800">
                     Advanced Editor
                   </span>
                 </div>
                 <h1 className="text-3xl sm:text-4xl font-black text-surface-900 dark:text-white tracking-tight leading-none mt-2">Video Studio</h1>
              </div>
           </div>

           <div className="flex items-center gap-3 w-full md:w-auto justify-end">
             <button type="button" onClick={() => { setSwarmHUDTask('Refreshing inventory'); setShowSwarmHUD(true); loadVideos() }} className="px-5 py-3 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-colors flex items-center gap-2">
               <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
               <span>Refresh</span>
             </button>
           </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 relative z-10">
          {[
            { label: 'Total Videos', value: videos.length, icon: Layers, colors: 'bg-primary-50 text-primary-600 border-primary-200 dark:bg-primary-900/20 dark:text-primary-400 dark:border-primary-800/50' },
            { label: 'Processed', value: completedCount, icon: ActivitySquare, colors: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50' },
            { label: 'Generated Clips', value: totalClips, icon: Sparkles, colors: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800/50' },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl p-6 shadow-sm flex items-center gap-4">
               <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${s.colors}`}>
                  <s.icon size={20} />
               </div>
               <div>
                 <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-1">{s.label}</p>
                 <h4 className="text-2xl font-black text-surface-900 dark:text-surface-50 tracking-tight">{s.value}</h4>
               </div>
            </div>
          ))}
        </div>

        {/* Upload Zone */}
        <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl overflow-hidden relative z-10 shadow-sm flex flex-col xl:flex-row">
          <div className="bg-primary-50 dark:bg-primary-900/10 p-8 sm:p-12 xl:w-1/3 border-b xl:border-b-0 xl:border-r border-surface-200 dark:border-surface-800 flex flex-col justify-center">
            <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/40 rounded-2xl flex items-center justify-center border border-primary-200 dark:border-primary-800 mb-6">
              <Upload size={28} className="text-primary-600 dark:text-primary-400" />
            </div>
            <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight mb-2">Upload Raw Footage</h2>
            <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
              Drop your long-form video or raw clips here. Our AI will automatically analyze the content, identify key moments, and prepare it for advanced editing.
            </p>
          </div>
          <div className="p-8 sm:p-12 xl:w-2/3 flex items-center justify-center bg-surface-50 dark:bg-surface-950">
            <div className="w-full max-w-2xl">
              <FileUpload onUpload={(file, res) => { setSwarmHUDTask('Analyzing your video'); setShowSwarmHUD(true); handleUploadResponse(file, res) }} uploadUrl="/api/video/upload" />
            </div>
          </div>
        </div>

        {/* Library */}
        {videos.length > 0 && (
          <div className="space-y-6 relative z-10">
            <div className="flex flex-col md:flex-row items-stretch lg:items-center gap-4 justify-between">
               <h3 className="text-lg font-black text-surface-900 dark:text-white">Recent Projects</h3>
               <div className="flex flex-col sm:flex-row items-center gap-4">
                 <div className="relative w-full sm:w-64">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400" />
                    <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search projects..." className="w-full bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500/50" />
                 </div>
                 <div className="flex items-center gap-2 w-full sm:w-auto bg-white dark:bg-surface-900 p-1 rounded-xl border border-surface-200 dark:border-surface-800 overflow-x-auto">
                    {['all', 'completed', 'processing', 'failed'].map(opt => (
                      <button key={opt} onClick={() => setStatusFilter(opt as any)} className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors whitespace-nowrap ${statusFilter === opt ? 'bg-surface-100 dark:bg-surface-800 text-surface-900 dark:text-white' : 'text-surface-500 hover:text-surface-900 dark:hover:text-white'}`}>
                        {opt}
                      </button>
                    ))}
                 </div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {visibleVideos.map(video => {
                const cfg = getStatusCfg(video.status)
                return (
                  <div key={video._id} className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl overflow-hidden group flex flex-col hover:border-primary-300 dark:hover:border-primary-700 transition-colors shadow-sm">
                    <div className="aspect-video relative bg-surface-100 dark:bg-surface-950 overflow-hidden border-b border-surface-200 dark:border-surface-800">
                      <video src={video.originalFile?.url} className="w-full h-full object-cover" preload="metadata" muted onMouseEnter={e => e.currentTarget.play()} onMouseLeave={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0 }} />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button onClick={() => router.push(`/dashboard/video/edit/${video._id}`)} className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-all">
                          <Play size={20} className="ml-1" />
                        </button>
                      </div>
                      <div className="absolute top-4 left-4 flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider backdrop-blur-md bg-white/90 dark:bg-surface-900/90 shadow-sm">
                        <div className={`w-1.5 h-1.5 rounded-full ${cfg.bg} border border-current ${cfg.text}`} /> 
                        <span className="text-surface-900 dark:text-white">{cfg.label}</span>
                      </div>
                    </div>
                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <h3 className="text-lg font-black text-surface-900 dark:text-white truncate" title={video.title}>{video.title}</h3>
                          <button className="text-surface-400 hover:text-surface-900 dark:hover:text-white transition-colors shrink-0">
                            <MoreVertical size={18} />
                          </button>
                        </div>
                        <div className="flex items-center text-[11px] font-medium text-surface-500 gap-4">
                          <span className="flex items-center gap-1.5"><Clock size={12} /> {new Date(video.createdAt).toLocaleDateString()}</span>
                          <span className="flex items-center gap-1.5"><Sparkles size={12} /> {video.generatedContent?.shortVideos?.length || 0} Clips</span>
                        </div>
                      </div>
                      <button onClick={() => router.push(`/dashboard/video/edit/${video._id}`)} className="w-full mt-6 py-2.5 bg-surface-900 dark:bg-white text-white dark:text-surface-900 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-surface-800 dark:hover:bg-surface-100 transition-colors shadow-sm">
                        Open Editor
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}
