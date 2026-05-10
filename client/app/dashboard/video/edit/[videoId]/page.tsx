'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet, apiPost, API_URL } from '../../../../../lib/api'
import { useAuth } from '../../../../../hooks/useAuth'
import { useSocket } from '../../../../../hooks/useSocket'
import { Sparkles, Edit3, Play, Loader2, AlertCircle, Settings, CheckCircle2, XCircle, Download, Eye, BarChart3, Award, Edit, Zap, ChevronDown, ChevronRight, ChevronLeft, Palette, Fingerprint, Cpu, RefreshCw, Activity, Brain, Terminal, Globe, LayoutGrid, Layers, ArrowLeft, ArrowRight, Sparkle, Video, TrendingUp, Layout, Moon, Sun, Wand2, Scissors } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { DynamicModernVideoEditor } from '../../../../../components/DynamicImports'
import VideoProgressTracker from '../../../../../components/VideoProgressTracker'
import { useTheme } from '../../../../../components/ThemeProvider'

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
} as const

export default function VideoEditPage({ params }: PageProps) {
  const router = useRouter()
  const videoId = params.videoId
  const { user } = useAuth()
  const { socket, connected, on, off } = useSocket(user?.id || null)
  const { resolvedTheme, toggle } = useTheme()
  const [video, setVideo] = useState<Video | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editMode, setEditMode] = useState<'selection' | 'manual' | 'ai-auto'>('selection')
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

        if (videoData.originalFile?.url) {
          let videoUrl = videoData.originalFile.url
          if (videoUrl.startsWith('/uploads/')) {
            const backendUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5001'
            videoUrl = `${backendUrl}${videoUrl}`
          } else if (videoUrl.startsWith('/')) {
            const baseUrl = typeof window !== 'undefined' ? window.location.origin : (API_URL.startsWith('http') ? new URL(API_URL).origin : 'http://localhost:5001')
            videoUrl = `${baseUrl}${videoUrl}`
          }
          videoData.originalFile.url = videoUrl
        }
        setVideo(videoData)
      } catch (error: any) {
        console.error('Failed to load video:', error)
        setError(error.message || 'Failed to load video. Please try again.')
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
    stabilizeVideo: false,
    hookDetection: true,
    beatMatchedCuts: false,
    brollAutoInsert: false,
    predictEngagement: true,
    viralOverlays: false,
    voiceCloneNarration: false,
  })
  const [captionStyle, setCaptionStyle] = useState<string>(() => (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.lastCaptionStyle) || 'modern' : 'modern'))
  const [outputFormat, setOutputFormat] = useState<'auto' | 'vertical' | 'square' | 'standard'>('auto')
  const [clipTargetLength, setClipTargetLength] = useState<'short' | 'mid-3-5' | 'mid-5-10' | 'full'>('short')
  const [clipCount, setClipCount] = useState(5)
  const [contentGenre, setContentGenre] = useState<string>('auto')
  const [prioritizeHook, setPrioritizeHook] = useState(true)
  const [exportFormats, setExportFormats] = useState<('9:16' | '1:1' | '16:9')[]>(['9:16'])
  const [pacingIntensity, setPacingIntensity] = useState<'gentle' | 'medium' | 'aggressive'>('medium')
  const [editPreset, setEditPreset] = useState<string>('')
  const [editJobId, setEditJobId] = useState<string | null>(null)
  const [newVideoScore, setNewVideoScore] = useState<{ score: number; factors?: { name: string; value: string; impact: string }[] } | null>(null)
  const videoPreviewRef = useRef<HTMLVideoElement>(null)

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

  const handleEditModeSelect = useCallback((mode: 'manual' | 'ai-auto') => {
    setEditMode(mode)
    setProcessingError('')
    setAiEditResult(null)
    setEditJobId(null)
  }, [])

  const handleAnalyzeVideo = async () => {
    setAnalyzing(true)
    setShowAnalysis(false)
    try {
      const analysis = await apiPost('/video/ai-editing/analyze', {
        videoId,
        videoMetadata: { url: video?.originalFile.url, title: video?.title }
      })
      setAiAnalysis(analysis.data || analysis)
      setShowAnalysis(true)
    } catch (error: any) {
      console.error(error)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleStartAIEdit = async () => {
    setProcessing(true)
    setAiEditResult(null)
    setLiveProgress(null)
    try {
      const backendOptions = {
        ...editingOptions,
        captionStyle,
        outputFormat,
        clipTargetLength,
        clipCount,
        contentGenre,
        prioritizeHook,
        aspectFormats: exportFormats,
        pacingIntensity
      }
      const result = await apiPost('/video/ai-editing/auto-edit', { videoId, editingOptions: backendOptions, outputFormat })
      const jobId = result.data?.jobId || result.jobId
      if (jobId) {
        setEditJobId(jobId)
      } else {
        // Synchronous success (no jobId) — capture the result so the
        // success UI renders, then redirect to the clip hub for this
        // video so the user lands on their fresh clips with the AI's
        // recommended captions + slots already populated.
        setAiEditResult(result)
        setProcessing(false)
        setTimeout(() => router.push(`/dashboard/clips/hub/${videoId}`), 1200)
      }
    } catch (error: any) {
      setProcessing(false)
    }
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 bg-surface-50 dark:bg-surface-950 min-h-screen">
      <Loader2 size={40} className="text-primary-500 animate-spin mb-6" />
      <p className="text-sm font-bold text-surface-500 uppercase tracking-widest animate-pulse">Loading Video...</p>
    </div>
  )

  const videoUrl = video?.originalFile?.url
  const editorVideoUrl = (aiEditResult?.data?.editedVideoUrl ?? aiEditResult?.editedVideoUrl) || videoUrl

  const selectionUI = (
    <div className="min-h-screen w-full bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-surface-50 overflow-x-hidden relative pb-24 transition-colors duration-500">
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-12 py-8 relative z-10">
        
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 border-b border-surface-200 dark:border-surface-800 pb-8">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl flex items-center justify-center shadow-sm">
              <Edit3 size={32} className="text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400 uppercase tracking-wide border border-primary-200 dark:border-primary-800">
                  Workflow Selection
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-surface-900 dark:text-white tracking-tight leading-none mt-1">Select Edit Mode</h1>
              <p className="text-surface-500 text-sm mt-2 font-medium max-w-lg truncate">{video?.title || 'Untitled Project'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggle} className="w-12 h-12 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 flex items-center justify-center text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors shadow-sm">
              {resolvedTheme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button onClick={() => router.push('/dashboard/video')} className="px-5 py-3 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors flex items-center gap-2 shadow-sm font-bold text-xs uppercase tracking-wider">
              <ChevronLeft size={16} />
              Return
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7">
            <div className="relative w-full aspect-video bg-surface-100 dark:bg-surface-950 rounded-3xl overflow-hidden shadow-sm border border-surface-200 dark:border-surface-800 flex items-center justify-center">
              <video src={videoUrl} controls className="w-full h-full object-contain" />
              <div className="absolute top-6 left-6 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 backdrop-blur-md">
                 <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                 <span className="text-[10px] font-bold text-white uppercase tracking-wider">Preview</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="flex items-center gap-4">
               <span className="flex h-px flex-1 bg-surface-200 dark:bg-surface-800" />
               <span className="text-xs font-bold text-surface-500 uppercase tracking-widest">Choose Option</span>
               <span className="flex h-px flex-1 bg-surface-200 dark:bg-surface-800" />
            </div>

            <div className="space-y-4">
              <button onClick={() => handleEditModeSelect('ai-auto')} className="w-full group relative flex items-start gap-6 p-8 rounded-3xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md transition-all text-left overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary-50 dark:bg-primary-900/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Wand2 className="w-7 h-7 text-primary-600 dark:text-primary-400" />
                </div>
                <div className="flex-1 relative z-10">
                  <div className="flex items-center gap-3 mb-1">
                     <h2 className="text-xl font-black text-surface-900 dark:text-white tracking-tight">AI Auto Edit</h2>
                     <span className="px-2 py-0.5 rounded-md bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400 text-[9px] font-bold uppercase tracking-wider border border-primary-200 dark:border-primary-800">RECOMMENDED</span>
                  </div>
                  <p className="text-sm text-surface-500 leading-relaxed font-medium">Use AI to automatically find hooks, remove silence, and generate high-retention clips.</p>
                  <div className="mt-4 flex items-center gap-2 text-primary-600 dark:text-primary-400 font-bold text-xs uppercase tracking-wider group-hover:gap-3 transition-all">
                    Start Auto Edit <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </button>

              <button onClick={() => handleEditModeSelect('manual')} className="w-full group relative flex items-start gap-6 p-8 rounded-3xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 hover:border-surface-300 dark:hover:border-surface-700 hover:shadow-md transition-all text-left overflow-hidden">
                <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Scissors className="w-7 h-7 text-surface-600 dark:text-surface-400" />
                </div>
                <div className="flex-1 relative z-10">
                  <h2 className="text-xl font-black text-surface-900 dark:text-white tracking-tight mb-1">Advanced Manual Editor</h2>
                  <p className="text-sm text-surface-500 leading-relaxed font-medium">Access the full timeline editor for precise manual cuts, transitions, and audio mixing.</p>
                  <div className="mt-4 flex items-center gap-2 text-surface-600 dark:text-surface-400 font-bold text-xs uppercase tracking-wider group-hover:gap-3 transition-all">
                    Open Editor <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  if (editMode === 'selection') return selectionUI

  if (editMode === 'manual') {
    const urlForEditor = editorVideoUrl || videoUrl
    if (!urlForEditor) return null
    return (
      <div className="fixed inset-0 bg-surface-50 dark:bg-surface-950 overflow-hidden transition-colors duration-500">
        <button type="button" onClick={() => setEditMode('selection')} className="absolute top-4 left-4 z-[100] flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 text-surface-700 dark:text-surface-300 text-xs font-bold uppercase tracking-wider shadow-sm hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">
          <ChevronLeft size={16} /> Workflow Selection
        </button>
        <DynamicModernVideoEditor videoId={videoId} videoUrl={urlForEditor} />
      </div>
    )
  }

  if (editMode === 'ai-auto') {
    return (
      <div className="min-h-screen w-full bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-surface-50 overflow-x-hidden relative pb-32 transition-colors duration-500">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-12 py-8 relative z-10">
          
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 border-b border-surface-200 dark:border-surface-800 pb-8">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-2xl flex items-center justify-center shadow-sm">
                <Sparkles size={32} className="text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400 uppercase tracking-wide border border-primary-200 dark:border-primary-800">
                    AI Auto Edit
                  </span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-surface-900 dark:text-white tracking-tight leading-none mt-1">Configure AI Rules</h1>
                <p className="text-surface-500 text-sm mt-2 font-medium max-w-lg truncate">{video?.title || 'Untitled Project'}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={toggle} className="w-12 h-12 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 flex items-center justify-center text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors shadow-sm">
                {resolvedTheme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button onClick={() => handleAnalyzeVideo()} disabled={analyzing} className="px-5 py-3 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors flex items-center gap-2 shadow-sm font-bold text-xs uppercase tracking-wider disabled:opacity-50">
                {analyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                {analyzing ? 'Analyzing...' : 'Analyze Video'}
              </button>
              <button onClick={() => setEditMode('selection')} className="px-5 py-3 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors flex items-center gap-2 shadow-sm font-bold text-xs uppercase tracking-wider">
                <ChevronLeft size={16} /> Return
              </button>
            </div>
          </header>

          <AnimatePresence mode="wait">
            {processing ? (
              <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-surface-900 rounded-3xl border border-surface-200 dark:border-surface-800 p-12 sm:p-20 text-center shadow-sm max-w-3xl mx-auto">
                <div className="w-20 h-20 rounded-2xl bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 flex items-center justify-center mx-auto mb-8 shadow-sm">
                  <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
                </div>
                <h2 className="text-3xl font-black text-surface-900 dark:text-white tracking-tight mb-4">Processing Video</h2>
                <p className="text-surface-500 font-medium mb-10 text-sm">Our AI is currently analyzing, cutting, and optimizing your video...</p>
                {editJobId ? (
                  <div className="p-6 rounded-2xl bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800">
                     <VideoProgressTracker jobId={editJobId} videoId={videoId} onComplete={(res) => { setAiEditResult(res); setProcessing(false); setTimeout(() => router.push(`/dashboard/clips/hub/${videoId}`), 1200); }} onError={() => { setProcessing(false); }} />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-end mb-2">
                       <span className="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider">{liveProgress?.stage || 'Initializing'}</span>
                       <span className="text-lg font-black text-surface-900 dark:text-white">{liveProgress?.percent || 0}%</span>
                    </div>
                    <div className="h-3 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
                      <motion.div className="h-full bg-primary-500" initial={{ width: 0 }} animate={{ width: `${liveProgress?.percent || 0}%` }} />
                    </div>
                  </div>
                )}
              </motion.div>
            ) : aiEditResult ? (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 max-w-4xl mx-auto">
                <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl p-10 flex flex-col md:flex-row items-center gap-10 shadow-sm relative overflow-hidden">
                  <div className="w-20 h-20 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={36} className="text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <h2 className="text-3xl font-black text-surface-900 dark:text-white tracking-tight mb-2">Processing Complete</h2>
                    <p className="text-surface-500 font-medium text-sm">Your video has been successfully processed and edited by AI.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                    <button onClick={() => handleEditModeSelect('manual')} className="px-8 py-4 rounded-xl bg-surface-900 dark:bg-white text-white dark:text-surface-900 font-bold text-xs uppercase tracking-wider hover:opacity-90 transition-colors shadow-sm flex items-center justify-center gap-3">
                      Open in Editor <ArrowRight size={16} />
                    </button>
                    <button onClick={() => { setAiEditResult(null); setEditMode('selection'); }} className="px-6 py-4 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 text-surface-600 dark:text-surface-400 font-bold text-xs uppercase tracking-wider hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors shadow-sm">
                      Dismiss
                    </button>
                  </div>
                </div>

                {newVideoScore && (
                  <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 p-10 rounded-3xl shadow-sm">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 gap-6">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                           <TrendingUp size={16} className="text-primary-600 dark:text-primary-400" />
                           <span className="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider">Engagement Prediction</span>
                        </div>
                        <h3 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">Predicted Score</h3>
                      </div>
                      <div className="text-6xl font-black text-primary-500 tabular-nums leading-none tracking-tighter">{newVideoScore.score}%</div>
                    </div>
                    {newVideoScore.factors && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {newVideoScore.factors.map((f, i) => (
                          <div key={i} className="p-6 rounded-2xl bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 flex justify-between items-center">
                            <div>
                               <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-1">{f.name}</p>
                               <p className="text-lg font-black text-surface-900 dark:text-white tracking-tight">{f.value}</p>
                            </div>
                            <div className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider ${f.impact.startsWith('+') ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50' : 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50'}`}>
                               {f.impact}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Left Col: Analysis Results */}
                <div className="lg:col-span-4 space-y-6">
                  {showAnalysis && aiAnalysis && (
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 p-8 rounded-3xl shadow-sm">
                       <div className="flex items-center gap-4 mb-6">
                          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center">
                            <Activity size={24} className="text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div>
                             <h3 className="text-lg font-black text-surface-900 dark:text-white tracking-tight">Diagnostics</h3>
                             <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mt-1">Analysis Complete</p>
                          </div>
                       </div>
                       <div className="p-5 rounded-2xl bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 flex justify-between items-center">
                         <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">Suggested Length</p>
                         <p className="text-2xl font-black text-surface-900 dark:text-white tabular-nums">{Math.round(aiAnalysis.suggestedLength || 0)}s</p>
                       </div>
                    </motion.div>
                  )}
                  
                  <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 p-8 rounded-3xl shadow-sm">
                     <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 flex items-center justify-center">
                          <Brain size={24} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                           <h3 className="text-lg font-black text-surface-900 dark:text-white tracking-tight">Content Strategy</h3>
                           <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mt-1">AI Recommendations</p>
                        </div>
                     </div>
                     <div className="space-y-3">
                        {[{ label: 'Hook Focus', val: 'First 3s' }, { label: 'Pacing Target', val: 'Dynamic' }].map((s, i) => (
                          <div key={i} className="flex justify-between items-center p-5 rounded-2xl bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800">
                            <span className="text-xs font-bold text-surface-500">{s.label}</span>
                            <span className="text-sm font-black text-surface-900 dark:text-white">{s.val}</span>
                          </div>
                        ))}
                     </div>
                  </div>
                </div>

                {/* Right Col: Edit Config */}
                <div className="lg:col-span-8">
                   <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 p-8 sm:p-12 rounded-3xl shadow-sm">
                      <div className="flex items-center gap-5 mb-10 pb-8 border-b border-surface-200 dark:border-surface-800">
                         <div className="w-14 h-14 rounded-xl bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 flex items-center justify-center">
                           <Settings size={28} className="text-surface-600 dark:text-surface-400" />
                         </div>
                         <div>
                            <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">Processing Rules</h2>
                            <p className="text-sm font-medium text-surface-500 mt-1">Configure how the AI will edit your video.</p>
                         </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        <div className="space-y-6">
                           <label className="text-[10px] font-bold text-surface-500 uppercase tracking-widest flex items-center gap-3">
                             <Scissors size={14} className="text-primary-500" /> 
                             AI Tasks
                           </label>
                           <div className="space-y-3">
                              {[
                                { id: 'removeSilence', label: 'Remove Silence', desc: 'Auto-cut dead air & pauses' }, 
                                { id: 'optimizePacing', label: 'Optimize Pacing', desc: 'Improve flow and retention' }, 
                                { id: 'enhanceAudio', label: 'Enhance Audio', desc: 'Reduce background noise' }, 
                                { id: 'generateClips', label: 'Generate Short Clips', desc: 'Extract viral moments' }, 
                                { id: 'addCaptions', label: 'Add Captions', desc: 'Burn-in dynamic text' }, 
                                { id: 'enhanceColor', label: 'Color Correction', desc: 'AI-driven color grading' }
                              ].map(node => (
                                <button key={node.id} onClick={() => setEditingOptions(prev => ({ ...prev, [node.id]: !prev[node.id as keyof typeof prev] }))} className={`w-full p-5 rounded-2xl border transition-all flex items-center justify-between text-left ${editingOptions[node.id as keyof typeof editingOptions] ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700 shadow-sm' : 'bg-surface-50 dark:bg-surface-950 border-surface-200 dark:border-surface-800 hover:border-surface-300 dark:hover:border-surface-700'}`}>
                                  <div>
                                    <p className={`text-sm font-bold mb-1 ${editingOptions[node.id as keyof typeof editingOptions] ? 'text-primary-900 dark:text-primary-50' : 'text-surface-900 dark:text-white'}`}>{node.label}</p>
                                    <p className={`text-xs font-medium ${editingOptions[node.id as keyof typeof editingOptions] ? 'text-primary-700 dark:text-primary-400' : 'text-surface-500'}`}>{node.desc}</p>
                                  </div>
                                  <div className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 ${editingOptions[node.id as keyof typeof editingOptions] ? 'bg-primary-500 border-primary-500 text-white' : 'bg-white dark:bg-surface-900 border-surface-300 dark:border-surface-700 text-transparent'}`}>
                                    <CheckCircle2 size={14} />
                                  </div>
                                </button>
                              ))}
                           </div>
                        </div>

                        <div className="space-y-8">
                           <div className="space-y-6">
                              <label className="text-[10px] font-bold text-surface-500 uppercase tracking-widest flex items-center gap-3">
                                <LayoutGrid size={14} className="text-primary-500" /> 
                                Format Settings
                              </label>
                              <div className="space-y-5">
                                 <div className="p-6 rounded-2xl bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 space-y-4">
                                    <p className="text-xs font-bold text-surface-900 dark:text-white">Output Aspect Ratio</p>
                                    <div className="flex flex-wrap gap-2">
                                      {[{ id: 'auto', label: 'Auto' }, { id: 'vertical', label: 'Vertical (9:16)' }, { id: 'square', label: 'Square (1:1)' }, { id: 'standard', label: 'Standard (16:9)' }].map(f => (
                                        <button key={f.id} onClick={() => setOutputFormat(f.id as "auto" | "vertical" | "square" | "standard")} className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors border ${outputFormat === f.id ? 'bg-surface-900 dark:bg-white text-white dark:text-surface-900 border-surface-900 dark:border-white shadow-sm' : 'bg-white dark:bg-surface-900 text-surface-600 dark:text-surface-400 border-surface-200 dark:border-surface-800 hover:bg-surface-100 dark:hover:bg-surface-800'}`}>
                                          {f.label}
                                        </button>
                                      ))}
                                    </div>
                                 </div>

                                 <div className="p-6 rounded-2xl bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 space-y-4">
                                    <p className="text-xs font-bold text-surface-900 dark:text-white">Caption Style</p>
                                    <select value={captionStyle} onChange={(e) => setCaptionStyle(e.target.value)} className="w-full bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl px-4 py-3 text-sm font-bold text-surface-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500/50">
                                       {['modern', 'bold', 'minimal', 'tiktok', 'youtube', 'neon', 'pill', 'cinematic'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                                    </select>
                                 </div>
                              </div>
                           </div>

                           <div className="pt-8">
                              <button onClick={handleStartAIEdit} disabled={processing} className="w-full py-5 rounded-2xl font-black text-sm uppercase tracking-wider transition-colors shadow-sm flex items-center justify-center gap-3 bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50">
                                {processing ? <RefreshCw size={20} className="animate-spin" /> : <Wand2 size={20} />} 
                                {processing ? 'Processing...' : 'Start AI Editing'}
                              </button>
                           </div>
                        </div>
                      </div>
                   </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    )
  }

  return null
}
