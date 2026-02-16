'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet, apiPost, API_URL } from '../../../../../lib/api'
import { useAuth } from '../../../../../hooks/useAuth'
import { useSocket } from '../../../../../hooks/useSocket'
import { Sparkles, Edit3, Play, Loader2, AlertCircle, Settings, CheckCircle2, XCircle, Download, Eye, BarChart3, Award, Edit, Zap, ChevronDown, ChevronRight, ChevronLeft, Palette } from 'lucide-react'
import { DynamicModernVideoEditor } from '../../../../../components/DynamicImports'
import VideoProgressTracker from '../../../../../components/VideoProgressTracker'

interface PageProps {
  params: {
    videoId: string
  }
}

interface Video {
  _id: string
  title: string
  status: string
  originalFile: { url: string }
  createdAt: string
  generatedContent?: {
    shortVideos?: Array<{
      url: string
      thumbnail: string
      caption: string
      duration: number
      platform: string
    }>
  }
}

type EditMode = 'selection' | 'manual' | 'ai-auto'

export default function VideoEditPage({ params }: PageProps) {
  const router = useRouter()
  const videoId = params.videoId
  const { user } = useAuth()
  const { socket, connected, on, off } = useSocket(user?.id || null)
  const [video, setVideo] = useState<Video | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editMode, setEditMode] = useState<EditMode>('selection')
  const [processing, setProcessing] = useState(false)
  const [liveProgress, setLiveProgress] = useState<{ stage: string; percent: number; message: string } | null>(null)

  useEffect(() => {
    const loadVideo = async () => {
      setLoading(true)
      setError('')
      try {
        const response = await apiGet<any>(`/video/${videoId}`)
        const videoData = response?.data || response

        if (!videoData || !videoData._id) {
          throw new Error('Video data not found in response')
        }

        // Ensure video URL is absolute (if it's relative, make it absolute)
        if (videoData.originalFile?.url) {
          let videoUrl = videoData.originalFile.url

          console.log('🔍 [Video Edit] Initial video URL from API:', videoUrl)

          // If it's a relative URL starting with /uploads, convert to backend URL directly
          if (videoUrl.startsWith('/uploads/')) {
            // Use backend URL directly since Next.js API route isn't being recognized
            const backendUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5001'
            videoUrl = `${backendUrl}${videoUrl}`
            console.log('🔍 [Video Edit] Converted /uploads/ to backend URL:', videoUrl)
          }
          // If it's a relative URL (but not /uploads), make it absolute
          else if (videoUrl.startsWith('/')) {
            const baseUrl = typeof window !== 'undefined'
              ? window.location.origin
              : (API_URL.startsWith('http') ? new URL(API_URL).origin : 'http://localhost:5001')
            videoUrl = `${baseUrl}${videoUrl}`
            console.log('🔍 [Video Edit] Converted relative URL to absolute:', videoUrl)
          }
          // If it's already a full URL but from API_URL, ensure it uses the correct origin
          else if (videoUrl.startsWith('http') && typeof window !== 'undefined') {
            // If it's already pointing to the backend, keep it as is
            if (videoUrl.includes('localhost:5001/uploads/') || videoUrl.includes(':5001/uploads/')) {
              console.log('🔍 [Video Edit] Video URL already points to backend:', videoUrl)
            } else {
              console.log('🔍 [Video Edit] Video URL is already absolute:', videoUrl)
            }
          }
          // If it doesn't start with http, try to construct from API_URL
          else if (!videoUrl.startsWith('http')) {
            const baseUrl = typeof window !== 'undefined'
              ? window.location.origin
              : (API_URL.startsWith('http') ? new URL(API_URL).origin : 'http://localhost:5001')
            videoUrl = `${baseUrl}${videoUrl.startsWith('/') ? '' : '/'}${videoUrl}`
            console.log('🔍 [Video Edit] Constructed absolute URL:', videoUrl)
          }

          console.log('✅ [Video Edit] Final video URL to pass to editor:', videoUrl)
          videoData.originalFile.url = videoUrl
        } else {
          console.error('❌ [Video Edit] No video URL found in videoData.originalFile:', videoData)
        }

        setVideo(videoData)
      } catch (error: any) {
        console.error('Failed to load video:', error)
        const errorMessage = error.response?.status === 404
          ? 'Video not found. It may have been deleted.'
          : error.response?.status === 401
            ? 'Authentication required. Please log in again.'
            : error.message || 'Failed to load video. Please try again.'
        setError(errorMessage)
        setVideo(null)
      } finally {
        setLoading(false)
      }
    }

    loadVideo()
  }, [videoId])

  const [aiEditResult, setAiEditResult] = useState<any>(null)
  const [processingError, setProcessingError] = useState<string>('')
  const [aiAnalysis, setAiAnalysis] = useState<any>(null)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [editingOptions, setEditingOptions] = useState({
    removeSilence: true,
    optimizePacing: true,
    enhanceAudio: true,
    generateClips: true,
    addCaptions: false,
    enhanceColor: false,
    stabilizeVideo: false
  })
  const STORAGE_KEYS = {
    lastPreset: 'click-ai-edit-last-preset',
    lastCaptionStyle: 'click-ai-edit-last-caption-style',
    preciseScenes: 'click-ai-edit-precise-scenes',
    minSceneLength: 'click-ai-edit-min-scene-length',
    clipTargetLength: 'click-ai-edit-clip-target-length',
    clipCount: 'click-ai-edit-clip-count',
    contentGenre: 'click-ai-edit-content-genre',
    prioritizeHook: 'click-ai-edit-prioritize-hook',
    exportFormats: 'click-ai-edit-export-formats',
    pacingIntensity: 'click-ai-edit-pacing-intensity',
  }

  const [editPreset, setEditPreset] = useState<string>(() => (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.lastPreset) || '' : ''))
  const [captionStyle, setCaptionStyle] = useState<string>(() => (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.lastCaptionStyle) || 'modern' : 'modern'))
  const [outputFormat, setOutputFormat] = useState<'auto' | 'vertical' | 'square' | 'standard'>('auto')
  const [clipTargetLength, setClipTargetLength] = useState<'short' | 'mid-3-5' | 'mid-5-10' | 'full'>(() => {
    if (typeof window === 'undefined') return 'short'
    const v = localStorage.getItem(STORAGE_KEYS.clipTargetLength) as 'short' | 'mid-3-5' | 'mid-5-10' | 'full' | null
    return (v && ['short', 'mid-3-5', 'mid-5-10', 'full'].includes(v)) ? v : 'short'
  })
  const [clipCount, setClipCount] = useState(() => {
    if (typeof window === 'undefined') return 5
    const v = parseInt(localStorage.getItem(STORAGE_KEYS.clipCount) ?? '5', 10)
    return [1, 3, 5, 10].includes(v) ? v : 5
  })
  const [contentGenre, setContentGenre] = useState<string>(() => (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.contentGenre) || 'auto' : 'auto'))
  const [prioritizeHook, setPrioritizeHook] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem(STORAGE_KEYS.prioritizeHook) !== 'false'
  })
  const [exportFormats, setExportFormats] = useState<('9:16' | '1:1' | '16:9')[]>(() => {
    if (typeof window === 'undefined') return ['9:16']
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.exportFormats)
      if (!raw) return ['9:16']
      const arr = JSON.parse(raw)
      return Array.isArray(arr) && arr.every((f: string) => ['9:16', '1:1', '16:9'].includes(f)) ? arr as ('9:16' | '1:1' | '16:9')[] : ['9:16']
    } catch { return ['9:16'] }
  })
  const [pacingIntensity, setPacingIntensity] = useState<'gentle' | 'medium' | 'aggressive'>(() => {
    if (typeof window === 'undefined') return 'medium'
    const v = localStorage.getItem(STORAGE_KEYS.pacingIntensity) as 'gentle' | 'medium' | 'aggressive' | null
    return (v && ['gentle', 'medium', 'aggressive'].includes(v)) ? v : 'medium'
  })
  const [showOptions, setShowOptions] = useState(true)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [usePreciseScenes, setUsePreciseScenes] = useState<boolean>(() => (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.preciseScenes) === 'true' : false))
  const [minSceneLength, setMinSceneLength] = useState<string>(() => (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.minSceneLength) || '1' : '1'))
  const [editJobId, setEditJobId] = useState<string | null>(null)
  const [newVideoScore, setNewVideoScore] = useState<{ score: number; factors?: { name: string; value: string; impact: string }[] } | null>(null)
  const [tipsExpanded, setTipsExpanded] = useState(false)
  const videoPreviewRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (editPreset) localStorage.setItem(STORAGE_KEYS.lastPreset, editPreset)
    localStorage.setItem(STORAGE_KEYS.lastCaptionStyle, captionStyle)
    localStorage.setItem(STORAGE_KEYS.preciseScenes, String(usePreciseScenes))
    localStorage.setItem(STORAGE_KEYS.minSceneLength, minSceneLength)
    localStorage.setItem(STORAGE_KEYS.clipTargetLength, clipTargetLength)
    localStorage.setItem(STORAGE_KEYS.clipCount, String(clipCount))
    localStorage.setItem(STORAGE_KEYS.contentGenre, contentGenre)
    localStorage.setItem(STORAGE_KEYS.prioritizeHook, String(prioritizeHook))
    localStorage.setItem(STORAGE_KEYS.exportFormats, JSON.stringify(exportFormats))
    localStorage.setItem(STORAGE_KEYS.pacingIntensity, pacingIntensity)
  }, [editPreset, captionStyle, usePreciseScenes, minSceneLength, clipTargetLength, clipCount, contentGenre, prioritizeHook, exportFormats, pacingIntensity])

  // Live progress from backend socket during AI auto-edit (when no jobId)
  useEffect(() => {
    if (!processing || !socket || !connected || !videoId) {
      if (!processing) setLiveProgress(null)
      return
    }
    const handler = (payload: { videoId?: string; stage?: string; percent?: number; message?: string }) => {
      if (payload.videoId && payload.videoId !== videoId) return
      setLiveProgress({
        stage: payload.stage || 'editing',
        percent: typeof payload.percent === 'number' ? payload.percent : 0,
        message: payload.message || 'Processing…',
      })
    }
    on('video:edit:progress', handler)
    return () => {
      off('video:edit:progress', handler)
    }
  }, [processing, socket, connected, videoId, on, off])

  // Refetch video after AI edit success so state has updated originalFile.url (edited file)
  const loadVideoOnce = useRef(false)
  useEffect(() => {
    if (!aiEditResult || !videoId || loadVideoOnce.current) return
    loadVideoOnce.current = true
    apiGet<any>(`/video/${videoId}`)
      .then((res) => {
        const data = res?.data || res
        if (!data?.originalFile?.url) return
        let url = data.originalFile.url
        if (url.startsWith('/uploads/')) {
          const backendUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5001'
          url = `${backendUrl}${url}`
        } else if (url.startsWith('/') && !url.startsWith('http')) {
          const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5001'
          url = `${baseUrl}${url}`
        }
        setVideo((prev) => (prev ? { ...prev, originalFile: { ...prev.originalFile, url } } : null))
      })
      .catch(() => { })
  }, [aiEditResult, videoId])

  // Fetch new video score when we have a successful edit result (backend has updated content)
  useEffect(() => {
    if (!aiEditResult || !videoId) return
    setNewVideoScore(null)
    apiPost('/video/ai-editing/score', { videoId })
      .then((res: any) => {
        const data = res?.data ?? res
        if (data?.score != null) setNewVideoScore({ score: data.score, factors: data.factors })
      })
      .catch(() => { })
  }, [aiEditResult, videoId])

  // Keyboard shortcuts on selection screen: M = manual, A = AI auto (must be before any early return)
  const handleEditModeSelect = useCallback((mode: 'manual' | 'ai-auto') => {
    setEditMode(mode)
    setProcessingError('')
    setAiEditResult(null)
    setEditJobId(null)
  }, [])
  useEffect(() => {
    if (editMode !== 'selection' || !video) return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const key = e.key?.toLowerCase()
      if (key === 'm') {
        e.preventDefault()
        handleEditModeSelect('manual')
      } else if (key === 'a') {
        e.preventDefault()
        handleEditModeSelect('ai-auto')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editMode, video, handleEditModeSelect])

  // Analyze video before editing (pass duration from video element when loaded for accuracy)
  const handleAnalyzeVideo = async () => {
    setAnalyzing(true)
    setShowAnalysis(false)
    setAiAnalysis(null)
    setAnalysisError(null)
    const durationFromVideo = videoPreviewRef.current?.duration
    const duration = (typeof durationFromVideo === 'number' && Number.isFinite(durationFromVideo) && durationFromVideo > 0) ? durationFromVideo : 0

    try {
      const analysis = await apiPost('/video/ai-editing/analyze', {
        videoId,
        videoMetadata: {
          url: videoUrl,
          title: video?.title,
          duration
        }
      })

      setAiAnalysis(analysis.data || analysis)
      setShowAnalysis(true)
      setAnalyzing(false)
    } catch (error: any) {
      console.error('Video analysis failed:', error)
      setAnalyzing(false)
      setAnalysisError(error.response?.data?.error || error.message || 'Analysis failed. You can still configure and run AI edit.')
    }
  }

  const handleStartAIEdit = async () => {
    setProcessing(true)
    setProcessingError('')
    setAiEditResult(null)
    setNewVideoScore(null)
    setEditJobId(null)
    setLiveProgress(null)
    loadVideoOnce.current = false

    try {
      // Map simple toggles to full backend options and include style/preset
      const backendOptions: Record<string, unknown> = {
        removeSilence: editingOptions.removeSilence,
        removePauses: editingOptions.removeSilence,
        optimizePacing: editingOptions.optimizePacing,
        enhanceAudio: editingOptions.enhanceAudio,
        addTransitions: true,
        enableColorGrading: editingOptions.enhanceColor,
        enableStabilization: editingOptions.stabilizeVideo,
        enableSmartCaptions: editingOptions.addCaptions,
        captionStyle: captionStyle,
        outputFormat,
        clipTargetLength,
        clipCount: editingOptions.generateClips ? clipCount : 1,
        contentGenre: contentGenre !== 'auto' ? contentGenre : undefined,
        prioritizeHook,
        aspectFormats: exportFormats.length > 0 ? exportFormats : undefined,
        pacingIntensity,
      }
      if (editPreset) {
        backendOptions.preset = editPreset
      }
      if (usePreciseScenes) {
        backendOptions.useMultiModalScenes = true
        const minSec = parseFloat(minSceneLength)
        if (!Number.isNaN(minSec) && minSec > 0) {
          backendOptions.minSceneLength = minSec
        }
      }
      const result = await apiPost('/video/ai-editing/auto-edit', {
        videoId: videoId,
        editingOptions: backendOptions,
        outputFormat
      })

      // Store job ID if provided for progress tracking (async flow)
      const jobId = result.data?.jobId || result.jobId
      if (jobId) {
        setEditJobId(jobId)
        // Leave processing true; VideoProgressTracker onComplete will set result and setProcessing(false)
      }

      // If result is immediate (sync), set it and stop loading
      const editedUrl = result.data?.editedVideoUrl ?? result.editedVideoUrl
      if (editedUrl) {
        setAiEditResult(result)
        setProcessing(false)
      } else if (!jobId) {
        // No video URL and no job ID: unexpected response
        setProcessingError(result.data?.error || result.message || 'No result from server. Please try again.')
        setProcessing(false)
      }
    } catch (error: any) {
      console.error('AI auto-edit failed:', error)
      setProcessingError(error.response?.data?.error || error.message || 'Failed to process video with AI')
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-page flex items-center justify-center transition-colors duration-300">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[var(--border-default)] border-t-blue-500 dark:border-t-blue-400 mx-auto mb-4" />
          <p className="text-sm text-theme-secondary">Loading video…</p>
        </div>
      </div>
    )
  }

  if (error || !video) {
    return (
      <div className="min-h-screen bg-surface-page flex items-center justify-center p-4 transition-colors duration-300">
        <div className="max-w-sm w-full bg-surface-card radius-card-lg border border-subtle shadow-theme-card p-8 text-center">
          <div className="flex items-center justify-center w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-2xl mb-4 mx-auto">
            <AlertCircle className="w-7 h-7 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-lg font-bold mb-2 text-theme-primary">Video not found</h2>
          <p className="text-sm text-theme-secondary mb-6">
            {error || 'This video could not be loaded.'}
          </p>
          <button
            onClick={() => router.push('/dashboard/video')}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium text-sm hover:opacity-90 transition-opacity"
          >
            Back to library
          </button>
        </div>
      </div>
    )
  }

  const videoUrl = video.originalFile?.url
  // After AI edit, open the edited video in the manual editor (or refetched video URL)
  const editorVideoUrl = (aiEditResult?.data?.editedVideoUrl ?? aiEditResult?.editedVideoUrl) || videoUrl

  // Show selection screen — theme-aware modern creative
  if (editMode === 'selection') {
    return (
      <div className="min-h-screen w-full bg-surface-page transition-colors duration-300">
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-theme-muted mb-2">
                <span className="w-1 h-3 rounded-full bg-violet-500 dark:bg-violet-400" aria-hidden />
                Edit
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-theme-primary tracking-tight">
                Edit video
              </h1>
              <p className="text-theme-secondary mt-1 truncate max-w-md">
                {video?.title || 'Untitled Video'}
              </p>
            </div>
            <button
              onClick={() => router.push('/dashboard/video')}
              className="inline-flex items-center gap-2 text-sm font-medium text-theme-secondary hover:text-theme-primary transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500 focus:ring-offset-2 dark:focus:ring-offset-[#0f172a] rounded-xl px-4 py-2.5 bg-surface-card border border-subtle hover:border-default shadow-theme-card"
            >
              <ChevronDown className="w-4 h-4 rotate-90" aria-hidden />
              Back to library
            </button>
          </div>

          <div className="relative w-full min-h-[500px] h-[70vh] max-h-[840px] bg-slate-900 dark:bg-black rounded-[var(--radius-card-lg)] overflow-hidden mb-10 shadow-theme-card-hover ring-1 border-subtle">
            <video src={videoUrl} controls className="w-full h-full object-contain" />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent pointer-events-none rounded-b-[var(--radius-card-lg)]" aria-hidden />
          </div>

          <div className="flex items-center gap-3 mb-3">
            <span className="flex h-px flex-1 bg-divider" />
            <span className="text-xs font-semibold text-theme-muted uppercase tracking-wider">Choose workflow</span>
            <span className="flex h-px flex-1 bg-divider" />
          </div>
          <p className="text-sm text-theme-secondary mb-6 text-center max-w-lg mx-auto">
            Try <strong className="text-theme-primary">AI Auto Edit</strong> for a quick polish, then <strong className="text-theme-primary">Manual Edit</strong> to refine cuts, captions, and style.
          </p>
          <p className="text-[10px] text-theme-muted text-center mb-6" aria-hidden>Press <kbd className="px-1.5 py-0.5 rounded bg-surface-card border border-subtle font-mono text-theme-secondary">M</kbd> for Manual · <kbd className="px-1.5 py-0.5 rounded bg-surface-card border border-subtle font-mono text-theme-secondary">A</kbd> for AI</p>
          <div className="grid sm:grid-cols-2 gap-5">
            <button
              onClick={() => handleEditModeSelect('manual')}
              className="group flex items-start gap-5 p-7 radius-card-lg bg-surface-card border border-subtle hover:border-violet-400 dark:hover:border-violet-500/60 hover:shadow-theme-card-hover hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 text-left focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:ring-offset-2 dark:focus:ring-offset-[var(--surface-page-color)] shadow-theme-card animate-in fade-in slide-in-from-bottom-4 duration-300"
            >
              <div className="flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-inner bg-accent-violet group-hover:opacity-90">
                <Edit3 className="w-7 h-7 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-semibold text-theme-primary mb-1.5">Manual edit</h2>
                <p className="text-sm text-theme-secondary leading-relaxed">
                  Full timeline, effects, captions, and export control. Best when you know exactly what you want.
                </p>
                <span className="inline-flex items-center mt-4 text-sm font-semibold text-violet-600 dark:text-violet-400 group-hover:gap-2 gap-1.5 transition-all">
                  Open editor
                  <Play className="w-4 h-4" />
                </span>
              </div>
            </button>

            <button
              onClick={() => handleEditModeSelect('ai-auto')}
              disabled={processing}
              className="group relative flex items-start gap-5 p-7 radius-card-lg bg-surface-card border border-subtle hover:border-blue-400 dark:hover:border-blue-500/60 hover:shadow-theme-card-hover hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 text-left disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:scale-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 dark:focus:ring-offset-[var(--surface-page-color)] shadow-theme-card animate-in fade-in slide-in-from-bottom-4 duration-300"
              style={{ animationDelay: '75ms' }}
            >
              <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent-blue text-blue-600 dark:text-blue-400">
                Recommended
              </span>
              <div className="flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-inner bg-accent-blue group-hover:opacity-90">
                {processing ? (
                  <Loader2 className="w-7 h-7 text-blue-600 dark:text-blue-400 animate-spin" />
                ) : (
                  <Sparkles className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-semibold text-theme-primary mb-1.5">AI auto edit</h2>
                <p className="text-sm text-theme-secondary leading-relaxed">
                  AI generates rough clips and a starting point—then refine cuts, framing, captions, and B-roll in the editor.
                </p>
                <span className="inline-flex items-center mt-4 text-sm font-semibold text-blue-600 dark:text-blue-400 group-hover:gap-2 gap-1.5 transition-all">
                  {processing ? 'Processing…' : 'Configure & run'}
                  {!processing && <Play className="w-4 h-4" />}
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Show manual edit interface
  if (editMode === 'manual') {
    const urlForEditor = editorVideoUrl || videoUrl
    console.log('🎬 [Video Edit] Rendering ModernVideoEditor with:', {
      videoId,
      videoUrl: urlForEditor,
      hasVideoUrl: !!urlForEditor,
      isEditedVersion: !!aiEditResult?.data?.editedVideoUrl,
    })

    if (!urlForEditor) {
      return (
        <div className="fixed inset-0 bg-surface-page flex items-center justify-center p-4 transition-colors duration-300">
          <div className="text-center max-w-md w-full bg-surface-card radius-card-lg border border-subtle shadow-theme-card-hover p-8 sm:p-10">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center mx-auto mb-5">
              <AlertCircle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-xl font-bold mb-2 text-theme-primary">Video not available</h2>
            <p className="text-sm text-theme-secondary mb-6 leading-relaxed">
              The video could not be loaded. Check that it was uploaded correctly or try again from the library.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => setEditMode('selection')}
                className="py-2.5 px-5 rounded-xl border border-subtle text-theme-primary font-medium text-sm bg-surface-elevated hover:opacity-90 transition-opacity"
              >
                Choose workflow
              </button>
              <button
                onClick={() => router.push('/dashboard/video')}
                className="py-2.5 px-5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium text-sm hover:opacity-90 transition-opacity shadow-theme-card"
              >
                Back to library
              </button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="fixed inset-0 bg-surface-page-color overflow-hidden transition-colors duration-300">
        {/* Floating back to workflow — doesn't block editor */}
        <button
          type="button"
          onClick={() => setEditMode('selection')}
          className="absolute top-[5px] left-[67px] z-[100] flex items-center gap-2 px-[1px] py-[11px] rounded-xl bg-surface-card border border-subtle text-theme-primary text-sm font-medium shadow-theme-card backdrop-blur-sm hover:bg-surface-card-hover transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:ring-offset-2 dark:focus:ring-offset-[#0f172a] rotate-[360deg]"
          aria-label="Back to workflow selection"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to workflow
        </button>
        <DynamicModernVideoEditor
          videoId={videoId}
          videoUrl={urlForEditor}
        />
      </div>
    )
  }

  // Show AI auto edit interface — modern single-column flow
  if (editMode === 'ai-auto') {
    const enabledCount = Object.values(editingOptions).filter(Boolean).length
    const enableRecommended = () => {
      setEditingOptions({
        removeSilence: true,
        optimizePacing: true,
        enhanceAudio: true,
        generateClips: true,
        addCaptions: true,
        enhanceColor: false,
        stabilizeVideo: false
      })
    }
    const jsx = (
      <div className="min-h-screen w-full bg-surface-page pb-28 transition-colors duration-300">
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                AI Auto Edit
              </span>
              <h1 className="text-2xl font-bold text-theme-primary tracking-tight">Configure & run</h1>
              <p className="text-sm text-theme-secondary truncate mt-0.5">{video?.title || 'Untitled Video'}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => handleAnalyzeVideo()}
                disabled={analyzing}
                className="px-4 py-2.5 rounded-xl bg-surface-card border border-subtle text-theme-primary text-sm font-medium hover:bg-surface-card-hover disabled:opacity-50 flex items-center gap-2 transition-colors shadow-theme-card"
              >
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                {analyzing ? 'Analyzing…' : 'Analyze'}
              </button>
              <button
                onClick={() => setEditMode('selection')}
                className="px-4 py-2.5 rounded-xl bg-surface-card border border-subtle text-theme-secondary text-sm font-medium hover:bg-surface-card-hover transition-colors shadow-theme-card"
              >
                Change mode
              </button>
            </div>
          </div>

          {/* Step indicator: Configure → Run → Result */}
          <div className="flex items-center gap-2 mb-6">
            <span className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${!processing && !aiEditResult ? 'bg-accent-blue text-blue-700 dark:text-blue-300' : 'bg-surface-elevated border border-subtle text-theme-muted'}`}>
              <span className="w-5 h-5 rounded-full bg-blue-500 dark:bg-blue-400 text-white flex items-center justify-center text-[10px] font-bold">1</span>
              Configure
            </span>
            <ChevronRight className="w-4 h-4 text-theme-muted flex-shrink-0" />
            <span className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${processing ? 'bg-accent-blue text-blue-700 dark:text-blue-300' : 'bg-surface-elevated border border-subtle text-theme-muted'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${processing ? 'bg-blue-500 dark:bg-blue-400 text-white' : 'bg-slate-300 dark:bg-slate-600 text-slate-600 dark:text-slate-300'}`}>2</span>
              Run
            </span>
            <ChevronRight className="w-4 h-4 text-theme-muted flex-shrink-0" />
            <span className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${aiEditResult ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' : 'bg-surface-elevated border border-subtle text-theme-muted'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${aiEditResult ? 'bg-emerald-500 dark:bg-emerald-400 text-white' : 'bg-slate-300 dark:bg-slate-600 text-slate-600 dark:text-slate-300'}`}>3</span>
              Result
            </span>
          </div>

          {analysisError && !processing && !aiEditResult && (
            <div className="mb-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{analysisError}</span>
              <button type="button" onClick={() => setAnalysisError(null)} className="ml-auto text-amber-600 dark:text-amber-400 hover:underline" aria-label="Dismiss">Dismiss</button>
            </div>
          )}
          {!processing && !aiEditResult && (
            <>
              {/* Analyze first callout — when user hasn't run analysis yet */}
              {!showAnalysis && !aiAnalysis && !analyzing && (
                <div className="mb-4 p-4 radius-card-lg border border-[var(--accent-blue-border)] bg-accent-blue flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-accent-blue flex items-center justify-center flex-shrink-0">
                      <Eye className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-theme-primary">Get suggestions before you run</p>
                      <p className="text-xs text-theme-secondary mt-0.5">Analyze your video for clip length, cuts, and style recommendations.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAnalyzeVideo()}
                    className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium transition-colors flex-shrink-0"
                  >
                    Analyze video
                  </button>
                </div>
              )}

              <p className="text-sm text-theme-secondary mb-4">Configure options below, then run. Expand tips for best-practice checklists.</p>
              <div className="radius-card-lg border border-subtle bg-surface-card overflow-hidden mb-4 shadow-theme-card">
                <button
                  type="button"
                  onClick={() => setTipsExpanded((v) => !v)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-surface-card-hover transition-colors"
                >
                  <span className="text-sm font-semibold text-theme-primary flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-500" />
                    Tips for better edits
                  </span>
                  {tipsExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                </button>
                {tipsExpanded && (
                  <div className="px-3 pb-3 space-y-3 border-t border-slate-200 dark:border-slate-700 pt-3">
                    <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/80 p-3">
                      <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Content sharpening</p>
                      <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                        <li><strong>Hooks (1–3s):</strong> Niche-specific opening—not generic &quot;You won&apos;t believe…&quot;</li>
                        <li><strong>Outcome per clip:</strong> One thing they learn, feel, or do—cut everything else.</li>
                        <li><strong>Pacing:</strong> Intentional silence and pauses; avoid wall-to-wall noise.</li>
                      </ul>
                    </div>
                    <div className="rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50/60 dark:bg-violet-900/20 p-3 mb-3">
                      <p className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-2">Visual polish</p>
                      <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                        <li><strong>Brand:</strong> Lock in colors, fonts, lower-third style, logo placement, caption style in <a href="/dashboard/settings?tab=brand" className="text-violet-600 dark:text-violet-400 underline hover:no-underline">Settings → Brand kit</a>.</li>
                        <li><strong>Motion:</strong> Use subtle zooms and push-ins to emphasize key words or reactions—not constant random movement.</li>
                        <li><strong>Framing:</strong> 9:16 for short-form; keep key action in center 80% and text in safe area (avoid bottom 20%).</li>
                        <li><strong>Transitions:</strong> Keep them simple and clean; minimalist edits that serve the message.</li>
                      </ul>
                    </div>
                    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/20 p-3 mb-3">
                      <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2">Premium audio</p>
                      <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                        <li><strong>Clean voice:</strong> Reduce noise, tame harsh frequencies; keep speech clearly louder than music (use ducking).</li>
                        <li><strong>Music + beat:</strong> Choose music that fits the emotion; cut visuals to the beat—don’t just let tracks run under everything.</li>
                        <li><strong>SFX:</strong> Use sparingly but precisely—whooshes on cuts, hits on key words or transitions; intentional, not spammy.</li>
                        <li><strong>Mix for mobile:</strong> Check clarity on a phone speaker; short-form is consumed there.</li>
                      </ul>
                    </div>
                    <div className="rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50/60 dark:bg-sky-900/20 p-3 mb-3">
                      <p className="text-[10px] font-semibold text-sky-700 dark:text-sky-400 uppercase tracking-wider mb-2">AI as assistant, not replacement</p>
                      <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                        <li><strong>Rough clips first:</strong> Let AI generate a draft, then manually fix awkward cuts/pacing, framing/crops, captions/colors/overlays, and replace generic B-roll with relevant or custom footage.</li>
                        <li><strong>Transcripts + strategy:</strong> Use AI transcripts to find moments quickly—but choose segments by your strategy, not only &quot;viral score&quot;.</li>
                        <li><strong>Test variants:</strong> Try multiple versions (hook variants, different captions or first 3s) and keep what actually performs.</li>
                      </ul>
                    </div>
                    <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/20 p-3 mb-6">
                      <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-2">Platform-native</p>
                      <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                        <li><strong>Per platform:</strong> Export for each (TikTok / Reels / Shorts), not one generic export.</li>
                        <li><strong>Format:</strong> 9:16 vertical, 1080p, 30 fps; keep file sizes reasonable so uploads don’t get compressed badly.</li>
                        <li><strong>First frame + thumbnail:</strong> Scroll-stopping—bold text and a clear visual of what’s happening, not random frames.</li>
                        <li><strong>Captions:</strong> Burned-in, concise, key words emphasized, enough time to read (silent viewing).</li>
                        <li><strong>Tweaks:</strong> Slightly different cuts, titles, or CTAs per platform to feel native (TikTok vs Reels vs Shorts).</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-fuchsia-200 dark:border-fuchsia-800 bg-fuchsia-50/60 dark:bg-fuchsia-900/20 p-3 mb-6 flex items-start gap-3">
                <div className="flex-shrink-0 p-1.5 rounded-lg bg-fuchsia-100 dark:bg-fuchsia-900/40">
                  <Palette className="w-4 h-4 text-fuchsia-600 dark:text-fuchsia-400" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-fuchsia-700 dark:text-fuchsia-400 uppercase tracking-wider mb-1">Creativity &amp; content</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">Refine hooks and captions in <strong>Manual Edit</strong> — use text presets, style bundles, and motion graphics for a consistent, scroll-stopping look.</p>
                  <button type="button" onClick={() => setEditMode('manual')} className="mt-2 text-xs font-semibold text-fuchsia-600 dark:text-fuchsia-400 hover:underline">Open in editor →</button>
                </div>
              </div>
            </>
          )}

          {/* Analysis */}
          {showAnalysis && aiAnalysis && (
            <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 mb-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </span>
                  Analysis
                </h2>
                <button onClick={() => setShowAnalysis(false)} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" aria-label="Close">
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                {((aiAnalysis.suggestedLength != null) || (aiAnalysis.recommendedCuts?.length > 0)) && (
                  <div className="md:col-span-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3">
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1.5 text-sm">Quick suggestions</h3>
                    <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                      {aiAnalysis.suggestedLength != null && (
                        <li>Optimal length: <strong>{Math.round(Number(aiAnalysis.suggestedLength))}s</strong>. Use &quot;Remove silence&quot; and &quot;Optimize pacing&quot; with intentional pauses—not wall-to-wall noise.</li>
                      )}
                      {aiAnalysis.recommendedCuts?.length > 0 && (
                        <li><strong>{aiAnalysis.recommendedCuts.length}</strong> suggested cut(s) for dead air. Enable &quot;Remove silence&quot; to apply.</li>
                      )}
                      <li>Hooks: refine the <strong>first 1–3 seconds</strong> for your niche (avoid generic &quot;You won&apos;t believe…&quot;). One clear outcome per clip—what they learn, feel, or do.</li>
                      <li>Captions: burned-in, concise, key words emphasized, enough time to read (silent viewing). Enable &quot;Add captions&quot; for Reels and TikTok.</li>
                    </ul>
                  </div>
                )}
                {aiAnalysis.suggestedEdits && aiAnalysis.suggestedEdits.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Suggested Edits</h3>
                    <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                      {aiAnalysis.suggestedEdits.slice(0, 5).map((edit: any, index: number) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-blue-500 mt-1">•</span>
                          <span>{edit.reason || edit.type || edit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {aiAnalysis.contentType && (
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Content Type</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 capitalize">{aiAnalysis.contentType}</p>
                  </div>
                )}
                {(aiAnalysis.hookSuggestion || aiAnalysis.clipOutcome) && (
                  <div className="md:col-span-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
                    <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-1.5 text-sm">Sharpening ideas</h3>
                    {aiAnalysis.hookSuggestion && <p className="text-sm text-amber-800 dark:text-amber-200 mb-1"><strong>Hook (1–3s):</strong> {aiAnalysis.hookSuggestion}</p>}
                    {aiAnalysis.clipOutcome && <p className="text-sm text-amber-800 dark:text-amber-200"><strong>Outcome for this clip:</strong> {aiAnalysis.clipOutcome}</p>}
                  </div>
                )}
              </div>

              {/* Profile video analytics (when available) */}
              {aiAnalysis.profileInsights && (
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-500" />
                    Your profile insights
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">{aiAnalysis.profileInsights.message}</p>
                  <div className="flex flex-wrap gap-3 text-xs">
                    {aiAnalysis.profileInsights.averageCompletionRate != null && (
                      <span className="px-2 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200">
                        Avg completion: {Number(aiAnalysis.profileInsights.averageCompletionRate).toFixed(1)}%
                      </span>
                    )}
                    {aiAnalysis.profileInsights.averageRetention != null && (
                      <span className="px-2 py-1 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200">
                        Avg retention: {Number(aiAnalysis.profileInsights.averageRetention).toFixed(1)}%
                      </span>
                    )}
                    {aiAnalysis.profileInsights.totalVideos != null && (
                      <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {aiAnalysis.profileInsights.totalVideos} video(s) in workspace
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Edit styles ranked with potential scores */}
              {aiAnalysis.editStyles && aiAnalysis.editStyles.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                    <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-500" />
                      Edit styles (ranked by potential score)
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        const top = aiAnalysis.editStyles[0]
                        if (top) {
                          setEditPreset(top.preset)
                          setCaptionStyle(top.captionStyle || 'modern')
                          setEditingOptions({
                            removeSilence: true,
                            optimizePacing: true,
                            enhanceAudio: true,
                            generateClips: true,
                            addCaptions: true,
                            enhanceColor: top.preset === 'tiktok' || top.preset === 'youtube',
                            stabilizeVideo: top.preset === 'tiktok' || top.preset === 'youtube'
                          })
                          setOutputFormat(top.preset === 'tiktok' ? 'vertical' : top.preset === 'youtube' ? 'standard' : outputFormat)
                          setPrioritizeHook(true)
                          if (aiAnalysis.contentType) {
                            const map: Record<string, string> = { tutorial: 'tutorial', vlog: 'vlog', podcast: 'podcast', webinar: 'webinar', product: 'product' }
                            setContentGenre(map[String(aiAnalysis.contentType).toLowerCase()] || 'auto')
                          }
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:from-violet-600 hover:to-purple-700 shadow-md transition-all"
                    >
                      Apply suggested for this video
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                    Current base score: <strong>{aiAnalysis.baseScore ?? '—'}</strong>/100. Pick a style below, then Start AI Auto Edit.
                  </p>
                  <p className="text-[10px] text-sky-600 dark:text-sky-400 mb-3">Choose segments by <strong>strategy</strong> (your goal, platform, message), not only score—then refine in the editor.</p>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {aiAnalysis.editStyles.map((style: { id: string; name: string; description: string; preset: string; captionStyle: string; potentialScore: number; rank: number }, idx: number) => (
                      <div
                        key={style.id}
                        className="rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-900/30 p-4 hover:border-blue-300 dark:hover:border-blue-700 transition-all"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">#{style.rank ?? idx + 1}</span>
                          <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{style.potentialScore}</span>
                        </div>
                        <h4 className="font-semibold text-slate-900 dark:text-white text-sm">{style.name}</h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{style.description}</p>
                        <button
                          type="button"
                          onClick={() => {
                            setEditPreset(style.preset)
                            setCaptionStyle(style.captionStyle)
                            setEditingOptions({
                              removeSilence: true,
                              optimizePacing: true,
                              enhanceAudio: true,
                              generateClips: true,
                              addCaptions: true,
                              enhanceColor: true,
                              stabilizeVideo: style.preset === 'tiktok' || style.preset === 'youtube'
                            })
                          }}
                          className="mt-3 w-full py-2 rounded-xl bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
                        >
                          Use style
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Configure — single card: output, options, style */}
          {!processing && !aiEditResult && (
            <div className="bg-surface-card radius-card-lg border border-subtle overflow-hidden mb-6 shadow-theme-card border-l-4 border-l-blue-500 dark:border-l-blue-400">
              <div className="p-4 sm:p-5 border-b border-subtle bg-surface-elevated">
                <h2 className="text-base font-semibold text-theme-primary flex items-center gap-2">
                  <Settings className="w-4 h-4 text-theme-muted" />
                  Configure
                </h2>
                <p className="text-xs text-theme-secondary mt-0.5">Output, clips, pacing, and style</p>
              </div>
              <div className="p-4 space-y-5">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Output format</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'auto' as const, label: 'Auto' },
                      { id: 'vertical' as const, label: '9:16' },
                      { id: 'square' as const, label: '1:1' },
                      { id: 'standard' as const, label: '16:9' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setOutputFormat(f.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium ${outputFormat === f.id ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Clip length</label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { id: 'short' as const, label: 'Short' },
                        { id: 'mid-3-5' as const, label: '3–5 min' },
                        { id: 'mid-5-10' as const, label: '5–10 min' },
                        { id: 'full' as const, label: 'Full' },
                      ].map((o) => (
                        <button key={o.id} onClick={() => setClipTargetLength(o.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium ${clipTargetLength === o.id ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {editingOptions.generateClips && (
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Max clips</label>
                      <select value={clipCount} onChange={(e) => setClipCount(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2">
                        {[1, 3, 5, 10].map((n) => <option key={n} value={n}>{n} clip{n > 1 ? 's' : ''}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 -mt-2 mb-1">One clear outcome per clip: what they learn, feel, or do—cut ruthlessly around it.</p>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Pacing</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {([
                      { id: 'gentle' as const, label: 'Gentle', hint: 'More breathing room, longer pauses' },
                      { id: 'medium' as const, label: 'Medium', hint: 'Balanced; silence where it lands' },
                      { id: 'aggressive' as const, label: 'Aggressive', hint: 'Tight cuts, still intentional' },
                    ]).map(({ id, label, hint }) => (
                      <button key={id} onClick={() => setPacingIntensity(id)} title={hint} className={`px-2.5 py-1 rounded-lg text-xs font-medium ${pacingIntensity === id ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/50' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Intentional silence and pauses—not wall-to-wall noise.</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Content type</label>
                  <select value={contentGenre} onChange={(e) => setContentGenre(e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2">
                    <option value="auto">Auto</option>
                    <option value="tutorial">Tutorial</option>
                    <option value="vlog">Vlog</option>
                    <option value="podcast">Podcast</option>
                    <option value="webinar">Webinar</option>
                    <option value="product">Product</option>
                  </select>
                </div>
                <label className="flex items-center gap-3 cursor-pointer" title="Refine the first 1–3 seconds for your niche—not generic clickbait.">
                  <input type="checkbox" checked={prioritizeHook} onChange={(e) => setPrioritizeHook(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">Niche hooks (first 1–3s)</span>
                </label>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 -mt-1">Refine opening for your niche; avoid generic &quot;You won&apos;t believe…&quot;</p>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Export formats</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(['9:16', '1:1', '16:9'] as const).map((fmt) => {
                      const active = exportFormats.includes(fmt)
                      return (
                        <button key={fmt} onClick={() => setExportFormats(active ? exportFormats.filter((f) => f !== fmt) : [...exportFormats, fmt])}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium ${active ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/50' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}
                        >
                          {fmt} {active && '✓'}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Editing Options (collapsible) */}
          {!processing && !aiEditResult && (
            <div className="bg-surface-card radius-card-lg border border-subtle overflow-hidden mb-6 shadow-theme-card">
              <button
                onClick={() => setShowOptions(!showOptions)}
                className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-surface-card-hover transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-surface-elevated border border-subtle flex items-center justify-center">
                    <Settings className="w-4 h-4 text-theme-muted" />
                  </div>
                  <span className="text-sm font-semibold text-theme-primary">Options & presets</span>
                </div>
                <span className="text-xs font-medium text-theme-muted">{showOptions ? 'Hide' : 'Show'}</span>
              </button>
              {showOptions && (
                <div className="px-4 pb-4 pt-0 border-t border-slate-100 dark:border-slate-700">
                  {/* Preset bundles */}
                  <div className="pt-4 mb-4">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Quick presets</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: 'TikTok / Reels', opts: { removeSilence: true, optimizePacing: true, enhanceAudio: true, generateClips: true, addCaptions: true, enhanceColor: true, stabilizeVideo: false }, output: 'vertical' as const, clipLength: 'short' as const, genre: 'auto', hook: true, pacing: 'medium' as const },
                        { label: 'Podcast', opts: { removeSilence: true, optimizePacing: true, enhanceAudio: true, generateClips: false, addCaptions: true, enhanceColor: false, stabilizeVideo: false }, output: 'auto' as const, clipLength: 'full' as const, genre: 'podcast', hook: false, pacing: 'gentle' as const },
                        { label: 'All-in-one', opts: { removeSilence: true, optimizePacing: true, enhanceAudio: true, generateClips: true, addCaptions: true, enhanceColor: true, stabilizeVideo: true }, output: outputFormat, clipLength: 'short' as const, genre: 'auto', hook: true, pacing: 'medium' as const },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          onClick={() => {
                            setEditingOptions(preset.opts)
                            setOutputFormat(preset.output)
                            setClipTargetLength(preset.clipLength)
                            setContentGenre(preset.genre)
                            setPrioritizeHook(preset.hook)
                            setPacingIntensity(preset.pacing)
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-700 text-slate-700 dark:text-slate-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 transition-all"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2 mb-1">Creative presets (Opus+) — export per platform (TikTok / Reels / Shorts) for native feel.</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: 'Viral Hooks', opts: { removeSilence: true, optimizePacing: true, enhanceAudio: true, generateClips: true, addCaptions: true, enhanceColor: true, stabilizeVideo: false }, output: 'vertical' as const, clipLength: 'short' as const, genre: 'auto', hook: true, pacing: 'aggressive' as const },
                        { label: 'Sharp & Niche', opts: { removeSilence: true, optimizePacing: true, enhanceAudio: true, generateClips: true, addCaptions: true, enhanceColor: false, stabilizeVideo: false }, output: 'vertical' as const, clipLength: 'short' as const, genre: 'auto', hook: true, pacing: 'medium' as const },
                        { label: 'Educational', opts: { removeSilence: true, optimizePacing: true, enhanceAudio: true, generateClips: true, addCaptions: true, enhanceColor: false, stabilizeVideo: false }, output: 'vertical' as const, clipLength: 'mid-3-5' as const, genre: 'tutorial', hook: false, pacing: 'gentle' as const },
                        { label: 'Storytelling', opts: { removeSilence: true, optimizePacing: true, enhanceAudio: true, generateClips: false, addCaptions: true, enhanceColor: true, stabilizeVideo: false }, output: 'auto' as const, clipLength: 'full' as const, genre: 'vlog', hook: true, pacing: 'gentle' as const },
                        { label: 'Punchy Ads', opts: { removeSilence: true, optimizePacing: true, enhanceAudio: true, generateClips: true, addCaptions: true, enhanceColor: true, stabilizeVideo: true }, output: 'square' as const, clipLength: 'short' as const, genre: 'product', hook: true, pacing: 'aggressive' as const },
                        { label: 'Cinematic Recap', opts: { removeSilence: true, optimizePacing: true, enhanceAudio: true, generateClips: true, addCaptions: true, enhanceColor: true, stabilizeVideo: true }, output: 'standard' as const, clipLength: 'mid-5-10' as const, genre: 'auto', hook: true, pacing: 'medium' as const },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          onClick={() => {
                            setEditingOptions(preset.opts)
                            setOutputFormat(preset.output)
                            setClipTargetLength(preset.clipLength)
                            setContentGenre(preset.genre)
                            setPrioritizeHook(preset.hook)
                            setPacingIntensity(preset.pacing)
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-700/50 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-all"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-700/50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Style preset</label>
                        <select
                          value={editPreset}
                          onChange={(e) => setEditPreset(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2"
                        >
                          <option value="">Custom (use toggles below)</option>
                          <option value="cinematic">Cinematic</option>
                          <option value="vlog">Vlog Style</option>
                          <option value="podcast">Podcast</option>
                          <option value="tiktok">TikTok Ready</option>
                          <option value="youtube">YouTube Optimized</option>
                        </select>
                        <p className="text-[10px] text-slate-500 mt-1">One-click professional style (overrides some toggles)</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Caption style</label>
                        <select
                          value={captionStyle}
                          onChange={(e) => setCaptionStyle(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2"
                        >
                          <option value="modern">Modern</option>
                          <option value="bold">Bold</option>
                          <option value="minimal">Minimal</option>
                          <option value="tiktok">TikTok</option>
                          <option value="youtube">YouTube</option>
                          <option value="outline">Outline</option>
                          <option value="professional">Professional</option>
                          <option value="neon">Neon</option>
                          <option value="pill">Pill</option>
                          <option value="cinematic">Cinematic</option>
                          <option value="retro">Retro</option>
                          <option value="subtitle">Subtitle</option>
                          <option value="karaoke">Karaoke</option>
                          <option value="gradient">Gradient</option>
                          <option value="serif">Serif</option>
                          <option value="high-contrast">High contrast</option>
                        </select>
                        <p className="text-[10px] text-slate-500 mt-1">Used when &quot;Add captions&quot; is on</p>
                        <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">Tip: Set a font in Profile → Brand to use it for captions.</p>
                        <div className="mt-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-900/80 p-2 flex items-center justify-center min-h-[36px]">
                          <span
                            className="text-sm font-medium max-w-full truncate px-2"
                            style={
                              captionStyle === 'bold'
                                ? { color: '#FFD700', textShadow: '0 0 2px #000' }
                                : captionStyle === 'minimal'
                                  ? { color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }
                                  : captionStyle === 'tiktok' || captionStyle === 'youtube'
                                    ? { color: '#fff', textShadow: '0 2px 0 #000' }
                                    : captionStyle === 'outline'
                                      ? { color: '#fff', WebkitTextStroke: '2px #000' }
                                      : captionStyle === 'professional'
                                        ? { color: '#fff', fontFamily: 'Georgia, serif' }
                                        : captionStyle === 'neon'
                                          ? { color: '#00FFFF', textShadow: '0 0 8px #00FFFF' }
                                          : captionStyle === 'pill'
                                            ? { color: '#fff', background: 'rgba(0,0,0,0.85)', padding: '4px 10px', borderRadius: 9999 }
                                            : captionStyle === 'cinematic'
                                              ? { color: '#E5E5E5', fontFamily: 'Georgia, serif', background: 'rgba(0,0,0,0.5)' }
                                              : captionStyle === 'retro'
                                                ? { color: '#FFE4B5', fontFamily: 'Georgia, serif', background: 'rgba(40,20,0,0.7)' }
                                                : captionStyle === 'subtitle'
                                                  ? { color: '#fff', WebkitTextStroke: '2px #000', background: 'transparent' }
                                                  : captionStyle === 'karaoke'
                                                    ? { color: '#fff', fontFamily: 'Impact, sans-serif', background: 'rgba(0,0,0,0.8)' }
                                                    : captionStyle === 'gradient'
                                                      ? { color: '#fff', background: 'rgba(128,0,128,0.75)' }
                                                      : captionStyle === 'serif'
                                                        ? { color: '#FFF8DC', fontFamily: 'Georgia, serif', background: 'rgba(0,0,0,0.65)' }
                                                        : captionStyle === 'high-contrast'
                                                          ? { color: '#fff', background: '#000', border: '2px solid #fff' }
                                                          : { color: '#fff', background: 'rgba(0,0,0,0.75)', padding: '2px 8px', borderRadius: 4 }
                            }
                          >
                            Sample caption
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-gray-100 dark:border-gray-700/50 pt-4">
                      <button
                        type="button"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-2"
                      >
                        {showAdvanced ? '▼' : '▶'} Advanced (scene detection)
                      </button>
                      {showAdvanced && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-900/30">
                            <input
                              type="checkbox"
                              checked={usePreciseScenes}
                              onChange={(e) => setUsePreciseScenes(e.target.checked)}
                              className="w-4 h-4 text-blue-600 rounded"
                            />
                            <div>
                              <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">Precise scene detection</span>
                              <span className="block text-[10px] text-slate-500">Visual + audio (slower, better cuts)</span>
                            </div>
                          </label>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Min scene length (sec)</label>
                            <input
                              type="number"
                              min="0.5"
                              max="5"
                              step="0.5"
                              value={minSceneLength}
                              onChange={(e) => setMinSceneLength(e.target.value)}
                              className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {[
                        { key: 'removeSilence', label: 'Remove silence', hint: 'Cut dead air' },
                        { key: 'optimizePacing', label: 'Optimize pacing', hint: 'Smoother cuts' },
                        { key: 'enhanceAudio', label: 'Enhance audio', hint: 'Clean voice, mobile-friendly level' },
                        { key: 'generateClips', label: 'Generate clips', hint: 'Short-form ready' },
                        { key: 'addCaptions', label: 'Add captions', hint: 'Auto transcript' },
                        { key: 'enhanceColor', label: 'Enhance color', hint: 'Better look' },
                        { key: 'stabilizeVideo', label: 'Stabilize video', hint: 'Smoother motion' },
                      ].map(({ key, label, hint }) => (
                        <label
                          key={key}
                          className={`flex items-center gap-3 cursor-pointer p-4 rounded-xl border-2 transition-all ${(editingOptions as any)[key]
                            ? 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-gray-50/50 dark:bg-gray-900/30'
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={(editingOptions as any)[key] as boolean}
                            onChange={(e) => setEditingOptions({ ...editingOptions, [key]: e.target.checked })}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                          <div>
                            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
                            <span className="block text-[10px] text-slate-500 dark:text-slate-400">{hint}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {processing ? (
            <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 sm:p-10 shadow-lg">
              <div className="text-center mb-6">
                <div className="inline-flex p-5 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-200/80 dark:from-blue-900/40 dark:to-blue-800/30 mb-5 shadow-inner">
                  <Loader2 className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin" />
                </div>
                <h2 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">Processing your video</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Applying your options. Don’t close this page.
                </p>
              </div>

              {/* Progress Tracker */}
              {editJobId && (
                <div className="mb-6">
                  <VideoProgressTracker
                    videoId={videoId}
                    operation="ai-auto-edit"
                    jobId={editJobId ?? undefined}
                    onComplete={(result: any) => {
                      if (result?.status === 'failed') {
                        setProcessingError(result?.message || result?.error || 'Processing failed. Try again or use Manual Editor.')
                        setProcessing(false)
                        return
                      }
                      // Normalize: progress API may return { editedVideoUrl, editsApplied }; success UI expects result.data or result
                      const normalized = result?.data ? result : { data: { editedVideoUrl: result?.editedVideoUrl, editsApplied: result?.editsApplied } }
                      setAiEditResult(normalized)
                      setProcessing(false)
                    }}
                  />
                </div>
              )}

              {/* Live progress (socket) or indeterminate fallback when no jobId */}
              {!editJobId && (
                <div className="mb-6">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                      style={{ width: liveProgress ? `${Math.min(100, Math.max(0, liveProgress.percent))}%` : '50%' }}
                    />
                  </div>
                  <p className="text-center text-sm text-slate-600 dark:text-slate-400 mt-2">
                    {liveProgress?.message || 'Processing your video…'}
                  </p>
                  {liveProgress?.stage && (
                    <p className="text-center text-xs text-slate-500 dark:text-slate-500 mt-1 capitalize">
                      {liveProgress.stage.replace(/-/g, ' ')}
                    </p>
                  )}
                </div>
              )}

              {/* Active Editing Options */}
              <div className="mt-6">
                <p className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Active Editing Options:</p>
                <div className="grid md:grid-cols-2 gap-2">
                  {Object.entries(editingOptions).filter(([_, enabled]) => enabled).map(([key, _]) => (
                    <div key={key} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
                <p>This may take a few minutes depending on video length</p>
                <p className="mt-1">Please don't close this page</p>
              </div>
            </div>
          ) : processingError ? (
            <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-red-200 dark:border-red-900/50 p-8 shadow-lg" role="alert" aria-live="polite">
              <div className="flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/40 rounded-2xl mb-5 mx-auto">
                <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-xl font-bold mb-2 text-center text-slate-900 dark:text-white" id="processing-failed-heading">Processing failed</h2>
              <p className="text-slate-600 dark:text-slate-400 text-center mb-6 max-w-md mx-auto">
                {processingError}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 text-center">Try again with fewer options or switch to Manual Edit for full control.</p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => { setProcessingError('') }}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-sm font-medium"
                  aria-label="Dismiss and show options"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => handleEditModeSelect('ai-auto')}
                  className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Try again
                </button>
                <button
                  onClick={() => setEditMode('manual')}
                  className="px-4 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors text-sm font-medium"
                >
                  Open Manual Editor
                </button>
                <button
                  onClick={() => setEditMode('selection')}
                  className="px-4 py-2.5 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors text-sm font-medium"
                >
                  Back to selection
                </button>
              </div>
            </div>
          ) : aiEditResult ? (
            <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-lg border-t-4 border-t-emerald-500 dark:border-t-emerald-400 animate-in fade-in slide-in-from-bottom-4 duration-300" role="region" aria-label="Edit complete">
              {/* Header + What's next */}
              <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-emerald-50/80 to-transparent dark:from-emerald-900/10 dark:to-transparent">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 shadow-inner" aria-hidden="true">
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white" id="edit-complete-heading">Edit complete</h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5" id="edit-complete-desc">Your video is ready. Choose what to do next.</p>
                    </div>
                  </div>
                </div>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-4 mb-3 uppercase tracking-wider">What&apos;s next?</p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => {
                      const url = aiEditResult.data?.editedVideoUrl || aiEditResult.editedVideoUrl || videoUrl
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `${video?.title || 'edited-video'}.mp4`
                      a.click()
                    }}
                    className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                  <button
                    onClick={() => setEditMode('manual')}
                    className="px-4 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors text-sm font-medium"
                  >
                    Open in editor
                  </button>
                  <button
                    onClick={() => {
                      setAiEditResult(null)
                      setNewVideoScore(null)
                      setProcessingError('')
                      setEditJobId(null)
                    }}
                    className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2"
                    title="Re-run AI edit with different settings"
                  >
                    <Edit className="w-4 h-4" />
                    Try different options
                  </button>
                  <button
                    onClick={() => setEditMode('selection')}
                    className="px-4 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-sm font-medium"
                  >
                    Change mode
                  </button>
                </div>
                <p className="text-[10px] text-sky-600 dark:text-sky-400 mt-2">Refine in the editor: fix cuts, framing, captions, and B-roll—AI is your assistant, not replacement.</p>
              </div>

              <div className="p-5 sm:p-6 space-y-6">
                {/* Video comparison */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Eye className="w-3.5 h-3.5" />
                    Compare
                  </h3>
                  <div className="grid md:grid-cols-2 gap-5">
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-900 dark:bg-black shadow-inner">
                      <div className="px-4 py-2.5 border-b border-slate-700 bg-slate-800/60 dark:bg-slate-800/40">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Original</span>
                      </div>
                      <div className="w-full min-h-[400px] h-[52vh] max-h-[640px] bg-slate-900">
                        <video src={videoUrl} controls className="w-full h-full object-contain" />
                      </div>
                    </div>
                    <div className="rounded-2xl border-2 border-emerald-500/50 dark:border-emerald-400/50 overflow-hidden bg-slate-900 dark:bg-black shadow-lg shadow-emerald-500/10">
                      <div className="px-4 py-2.5 border-b border-slate-700 bg-emerald-900/30 dark:bg-emerald-900/40">
                        <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Edited</span>
                      </div>
                      <div className="w-full min-h-[400px] h-[52vh] max-h-[640px] bg-slate-900">
                        <video
                          src={aiEditResult.data?.editedVideoUrl || aiEditResult.editedVideoUrl || videoUrl}
                          controls
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* New video score */}
                {newVideoScore != null && (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200/80 dark:border-amber-800/50">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-500" />
                      New video score
                    </h3>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-amber-600 dark:text-amber-400">{newVideoScore.score}</span>
                      <span className="text-slate-500 dark:text-slate-400">/ 100</span>
                    </div>
                    {newVideoScore.factors && newVideoScore.factors.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {newVideoScore.factors.map((f: { name: string; value: string; impact: string }) => (
                          <span key={f.name} className="text-xs px-2 py-1 rounded-lg bg-white/70 dark:bg-black/20 text-slate-700 dark:text-slate-300 border border-amber-200/50 dark:border-amber-700/30">
                            {f.name}: {f.value}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Success summary */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
                  <p className="text-sm font-medium text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    Applied to your video
                  </p>
                  {aiEditResult.data?.editsApplied && aiEditResult.data.editsApplied.length > 0 ? (
                    <ul className="space-y-2 text-slate-600 dark:text-slate-400 text-sm">
                      {aiEditResult.data.editsApplied.map((edit: string, index: number) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-emerald-500 mt-0.5">•</span>
                          <span>{edit}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <ul className="space-y-1.5 text-slate-600 dark:text-slate-400 text-sm">
                      {Object.entries(editingOptions).filter(([_, enabled]) => enabled).map(([key]) => (
                        <li key={key} className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                          <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Source video preview */}
              <div className="bg-surface-card radius-card-lg border border-subtle overflow-hidden mb-6 shadow-theme-card">
                <div className="px-4 py-2.5 border-b border-subtle bg-surface-elevated flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden />
                  <span className="text-xs font-semibold text-theme-secondary uppercase tracking-wider">Source video</span>
                </div>
                <div className="w-full min-h-[560px] bg-slate-900 dark:bg-black h-[72vh] max-h-[900px]">
                  <video ref={videoPreviewRef} src={videoUrl} controls className="w-full h-full object-contain" />
                </div>
              </div>

              {/* Sticky CTA */}
              <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-surface-card border-t border-subtle backdrop-blur-md shadow-theme-card-hover">
                <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row items-center justify-center gap-4">
                  {enabledCount === 0 ? (
                    <>
                      <button
                        type="button"
                        onClick={enableRecommended}
                        className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 transition-all"
                      >
                        <Zap className="w-5 h-5" />
                        Enable recommended options
                      </button>
                      <button
                        onClick={handleStartAIEdit}
                        disabled
                        className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500 text-sm font-medium cursor-not-allowed"
                      >
                        Start AI auto edit
                      </button>
                      <span className="text-sm text-slate-500 dark:text-slate-400 text-center sm:text-left">Turn on at least one option above, or enable recommended.</span>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleStartAIEdit}
                        className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30"
                      >
                        <Sparkles className="w-5 h-5" />
                        Start AI auto edit
                        <span className="opacity-90 text-sm">({enabledCount} on)</span>
                      </button>
                      <button
                        type="button"
                        onClick={enableRecommended}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        Reset to recommended
                      </button>
                    </>
                  )}
                  {enabledCount > 0 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center w-full mt-1">
                      AI will apply: silence removal, pacing, {editingOptions.addCaptions ? 'captions, ' : ''}{editingOptions.enhanceAudio ? 'audio enhancement, ' : ''}{editingOptions.enhanceColor ? 'color, ' : ''}{editingOptions.generateClips ? 'clip generation' : 'single export'}.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    )
    return jsx
  }

  return null
}
