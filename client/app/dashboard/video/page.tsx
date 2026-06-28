'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import FileUpload from '../../../components/FileUpload'
import * as tus from 'tus-js-client'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { extractApiError } from '../../../utils/apiResponse'
import { useSocket } from '../../../hooks/useSocket'
import { useAuth } from '../../../hooks/useAuth'
import { apiGet } from '../../../lib/api'
import {
  Upload, UploadCloud, Play, Loader2, CheckCircle, AlertCircle,
  RefreshCw, Layers, Clock,
  Search, ActivitySquare, Sparkles, MoreVertical,
  Database, ShieldCheck, Zap
} from 'lucide-react'
import { SwarmConsensusHUD } from '../../../components/editor/SwarmConsensusHUD'
import { motion, AnimatePresence } from 'framer-motion'
import ToastContainer from '../../../components/ToastContainer'
import { useTranslation } from '../../../hooks/useTranslation'
import { getAssetUrl } from '../../../utils/url'
import { cn } from '../../../lib/utils'
import {
  Panel,
  StatCard,
  SectionHeader,
  Button,
  IconButton,
  Input,
} from '../../../components/ui'

interface VideoItem {
  _id: string
  title: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | string
  originalFile?: { url: string; filename?: string }
  generatedContent?: { shortVideos: Array<{ url: string; thumbnail: string; caption: string; duration: number; platform: string }> }
  createdAt: string
}

const STATUS_CFG: Record<string, { label: string; bg: string; text: string; icon: any }> = {
  completed:  { label: 'Completed',  bg: 'bg-emerald-500', text: 'text-emerald-500', icon: CheckCircle },
  processing: { label: 'Processing', bg: 'bg-indigo-500', text: 'text-indigo-500', icon: Loader2 },
  pending:    { label: 'Queued',     bg: 'bg-amber-500', text: 'text-amber-500', icon: Clock },
  failed:     { label: 'Failed',     bg: 'bg-rose-500', text: 'text-rose-500', icon: AlertCircle },
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
    // Ask the editor to auto-generate captions (snapped to speech) on first open
    // for a just-uploaded video, so the creator lands ready to edit.
    const base = editLink(contentId)
    router.push(`${base}${base.includes('?') ? '&' : '?'}autoCaptions=1`)
  }, [loadVideos, router, editLink, tr])

  // Classic multipart upload — used as the fallback when resumable (tus) fails.
  const xhrUpload = useCallback((file: File, token: string | null) => {
    const fd = new FormData()
    fd.append('video', file)
    fd.append('title', file.name.replace(/\.[^.]+$/, ''))
    const xhr = new XMLHttpRequest()
    return new Promise<any>((resolve, reject) => {
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
  }, [])

  // Resumable upload via tus — survives connection drops on large files AND
  // full page reloads / tab closes: tus-js-client persists the upload URL by
  // file fingerprint, so we look for a previous upload of the same file and
  // resume from its last acknowledged offset instead of restarting at zero.
  const tusUpload = useCallback((file: File, token: string | null) => {
    return new Promise<any>((resolve, reject) => {
      let contentId: string | null = null
      const upload = new tus.Upload(file, {
        endpoint: '/api/upload/tus',
        chunkSize: 8 * 1024 * 1024, // 8MB chunks → real resume points
        retryDelays: [0, 1000, 3000, 5000, 10000],
        removeFingerprintOnSuccess: true,
        metadata: { filename: file.name, filetype: file.type, title: file.name.replace(/\.[^.]+$/, '') },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        onError: (err: Error) => reject(err),
        onProgress: (sent: number, total: number) => { if (total) setPageDropProgress(Math.round((sent / total) * 100)) },
        onAfterResponse: (_req: any, res: any) => {
          try { const id = res.getHeader('X-Content-Id'); if (id) contentId = id } catch { /* header optional */ }
        },
        onSuccess: () => resolve({ data: { contentId } }),
      })
      // Resume a prior interrupted upload of this exact file if one exists,
      // otherwise start fresh. findPreviousUploads can reject if storage is
      // unavailable (private mode) — fall back to a clean start in that case.
      upload.findPreviousUploads()
        .then((prev: any[]) => {
          if (prev && prev.length > 0) upload.resumeFromPreviousUpload(prev[0])
          upload.start()
        })
        .catch(() => upload.start())
    })
  }, [])

  const uploadFromPageDrop = useCallback(async (file: File) => {
    if (!/^video\//.test(file.type)) { setError(tr('studio.invalidVideo', 'MIME_ERR: INVALID_VIDEO_FORMAT')); return }
    setError('')
    setPageDropProgress(0)
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    try {
      let result: any
      try {
        result = await tusUpload(file, token)
      } catch (tusErr) {
        // Resumable path failed (endpoint/network) — fall back to classic upload.
        result = await xhrUpload(file, token)
      }
      if (result?.data?.contentId || result?.contentId) {
        await handleUploadResponse(file, result)
      } else {
        // Upload succeeded but no contentId surfaced (tus header missing); refresh list.
        setSuccess(tr('studio.uploadStable', '✓ UPLOAD_STABLE: ANALYZING_VECTORS...'))
        await loadVideos()
      }
    } catch (e: any) {
      setError(e?.message || 'Upload failed')
    } finally {
      setPageDropProgress(null)
    }
  }, [handleUploadResponse, xhrUpload, tusUpload, loadVideos, tr])

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
    <div className="ds-bg-mesh-soft flex flex-col items-center justify-center py-48 min-h-screen">
       <Loader2 size={48} className="text-indigo-500 animate-spin mb-6" />
       <p className="ds-text-label text-theme-muted">{tr('studio.syncingStudio', 'Syncing Neural Studio...')}</p>
    </div>
  )

  return (
    <ErrorBoundary>
      <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 max-w-[1700px] mx-auto space-y-8 text-theme-primary overflow-x-hidden">
        <ToastContainer />

        <AnimatePresence>
          {(pageDragOver || pageDropProgress !== null) && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] bg-background/90 backdrop-blur-xl flex items-center justify-center border-4 border-dashed border-indigo-500/50"
            >
              <Panel variant="elevated" className="p-12 text-center max-w-md w-[90%]">
                <span className="flex h-16 w-16 mx-auto mb-6 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
                  <Upload size={32} aria-hidden />
                </span>
                <h2 className="ds-text-h2 text-theme-primary mb-2">
                  {pageDropProgress !== null ? tr('studio.syncingPayload', 'Syncing Payload...') : tr('studio.dropPayload', 'Drop Payload Here')}
                </h2>
                <p className="ds-text-caption mb-6">{tr('studio.neuralIngestionReady', 'NEURAL_STUDIO_INGESTION_READY')}</p>
                {pageDropProgress !== null && (
                  <div className="h-2 w-full rounded-full bg-accent overflow-hidden">
                    <div className="h-full bg-indigo-500 transition-all duration-200" style={{ width: `${pageDropProgress}%` }} />
                  </div>
                )}
              </Panel>
            </motion.div>
          )}
        </AnimatePresence>

        <SwarmConsensusHUD isVisible={showSwarmHUD} taskName={swarmHUDTask} onComplete={() => setShowSwarmHUD(false)} />

        {/* Header */}
        <SectionHeader
          as="h1"
          title={tr('studio.videoStudio', 'Video Studio')}
          description={tr('studio.payloadsDetected', '{count} PAYLOADS_DETECTED', { count: videos.length })}
          actions={
            <Button
              variant="secondary"
              size="md"
              leftIcon={<RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden />}
              onClick={() => { setSwarmHUDTask('Refreshing inventory'); setShowSwarmHUD(true); loadVideos() }}
            >
              {tr('studio.syncArchive', 'Sync Archive')}
            </Button>
          }
        />

        {/* Performance stats — real counts from loaded videos */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard className="ds-hover-lift ds-anim-rise" label={tr('studio.payloadInventory', 'Payload Inventory')} value={videos.length} icon={Layers} />
          <StatCard className="ds-hover-lift ds-anim-rise" label={tr('studio.neuralProcessed', 'Neural Processed')} value={completedCount} icon={ActivitySquare} />
          <StatCard className="ds-hover-lift ds-anim-rise" label={tr('studio.syntheticYields', 'Synthetic Yields')} value={totalClips} icon={Sparkles} />
        </section>

        {/* Intake module */}
        <Panel variant="bento" className="ds-anim-rise overflow-hidden p-0 flex flex-col xl:flex-row">
          <div className="p-8 sm:p-10 xl:w-1/3 border-b xl:border-b-0 xl:border-r border-[var(--border-subtle)] flex flex-col justify-center">
            <span className="flex h-14 w-14 mb-5 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
              <UploadCloud size={28} aria-hidden />
            </span>
            <h2 className="ds-text-h2 text-theme-primary mb-2">{tr('studio.initializeIntake', 'Initialize Intake')}</h2>
            <p className="ds-text-body text-theme-muted">
              {tr('studio.intakeHint', 'Inject raw footage or multi-track sequences into the neural matrix. A/B Swarm will auto-calibrate vectors for optimal high-velocity synthesis.')}
            </p>
          </div>
          <div className="p-8 sm:p-10 xl:w-2/3 flex items-center justify-center">
            <div className="w-full max-w-2xl">
              <FileUpload onUpload={(file, res) => { setSwarmHUDTask('Analyzing your video'); setShowSwarmHUD(true); handleUploadResponse(file, res) }} uploadUrl="/api/video/upload" />
            </div>
          </div>
        </Panel>

        {/* Archive */}
        {videos.length > 0 && (
          <section className="space-y-6">
            <header className="flex flex-col md:flex-row items-stretch md:items-center gap-4 justify-between">
               <SectionHeader
                 as="h2"
                 title={tr('studio.payloadArchive', 'Payload Archive')}
                 description={tr('studio.secureStorage', 'SECURE_STORAGE_NODES')}
                 className="min-w-0"
               />
               <div className="flex flex-col sm:flex-row items-center gap-3 flex-1 justify-end max-w-3xl">
                 <div className="relative w-full sm:w-72">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" aria-hidden />
                    <Input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={tr('studio.searchArchive', 'SEARCH_ARCHIVE...')} aria-label={tr('studio.searchArchive', 'SEARCH_ARCHIVE...')} className="pl-9" />
                 </div>
                 <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    {['all', 'completed', 'processing', 'failed'].map(opt => (
                      <Button type="button" key={opt} variant={statusFilter === opt ? 'primary' : 'secondary'} size="sm" onClick={() => setStatusFilter(opt as any)}>
                        {tr(`studio.${opt}`, opt)}
                      </Button>
                    ))}
                 </div>
               </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {visibleVideos.map((video) => {
                const cfg = getStatusCfg(video.status)
                return (
                  <Panel key={video._id} variant="bento" className="ds-anim-rise overflow-hidden p-0 group flex flex-col">
                    <div className="aspect-video relative bg-accent overflow-hidden border-b border-[var(--border-subtle)]">
                      <video src={getAssetUrl(video.originalFile?.url || '')} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" preload="metadata" muted onMouseEnter={e => e.currentTarget.play()} onMouseLeave={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0 }} />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                        <button type="button" onClick={() => router.push(editLink(video._id))} aria-label={`Open ${video.title || 'video'} in editor`} title={`Open ${video.title || 'video'} in editor`} className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-black shadow-lg transition-transform active:scale-95">
                          <Play size={28} className="ml-0.5 fill-current" aria-hidden />
                        </button>
                      </div>
                      <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-lg ds-text-caption backdrop-blur-md bg-background/80 border border-[var(--border-subtle)]">
                        <span className={cn('h-2 w-2 rounded-full', cfg.bg)} aria-hidden />
                        <span className="text-theme-primary font-medium">{cfg.label}</span>
                      </div>
                    </div>
                    <div className="p-5 flex-1 flex flex-col justify-between gap-5">
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <h3 className="ds-text-h3 text-theme-primary truncate" title={video.title}>{video.title}</h3>
                          <IconButton variant="ghost" size="sm" aria-label="More Options" className="flex-shrink-0">
                            <MoreVertical size={18} aria-hidden />
                          </IconButton>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 ds-text-caption">
                          <span className="inline-flex items-center gap-1.5"><Clock size={13} aria-hidden /> {new Date(video.createdAt).toLocaleDateString()}</span>
                          <span className="inline-flex items-center gap-1.5"><Sparkles size={13} aria-hidden /> {video.generatedContent?.shortVideos?.length || 0} {tr('studio.yields', 'YIELDS')}</span>
                        </div>
                      </div>
                      <Button variant="primary" size="md" className="w-full" onClick={() => router.push(editLink(video._id))}>
                        {tr('studio.open', 'Open')}
                      </Button>
                    </div>
                  </Panel>
                )
              })}
            </div>
          </section>
        )}
        
        <Panel variant="subtle" className="flex flex-wrap items-center justify-between gap-4">
           <p className="ds-text-caption">
             <span className="text-indigo-500 font-medium">{tr('studio.tip', 'TUTORIAL_CORE:')}</span> {tr('studio.tipPaste', 'PASTE_URL (⌘V) ON THIS HUD FOR AUTO-SYNC.')}
           </p>
           <div className="flex items-center gap-5">
              <span className="ds-text-caption inline-flex items-center gap-1.5">
                 <ShieldCheck size={13} className="text-emerald-500" aria-hidden /> {tr('studio.secureTunnel', 'SECURE_TUNNEL')}
              </span>
              <span className="ds-text-caption inline-flex items-center gap-1.5">
                 <Zap size={13} className="text-amber-500" aria-hidden /> {tr('studio.highVelocity', 'HIGH_VELOCITY')}
              </span>
           </div>
        </Panel>
      </div>
    </ErrorBoundary>
  )
}

