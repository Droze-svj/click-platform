'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet, apiPost, API_URL } from '../../../../../lib/api'
import { useAuth } from '../../../../../hooks/useAuth'
import { useSocket } from '../../../../../hooks/useSocket'
import { Sparkles, Edit3, Play, Loader2, AlertCircle, Settings, CheckCircle2, XCircle, Download, Eye, BarChart3, Award, Edit, Zap, ChevronDown, ChevronRight, ChevronLeft, Palette, Fingerprint, Cpu, RefreshCw, Activity, Brain, Terminal, Globe, LayoutGrid, Layers, ArrowLeft, ArrowRight, Sparkle, Video, TrendingUp, Layout, Moon, Sun } from 'lucide-react'
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
      if (jobId) setEditJobId(jobId)
    } catch (error: any) {
      setProcessing(false)
    }
  }

  if (loading) return null

  const videoUrl = video?.originalFile?.url
  const editorVideoUrl = (aiEditResult?.data?.editedVideoUrl ?? aiEditResult?.editedVideoUrl) || videoUrl

  const selectionUI = (
    <div className="min-h-screen w-full bg-[var(--page-bg)] text-[var(--text-main)] selection:bg-indigo-500/30 overflow-x-hidden font-inter relative pb-24 transition-colors duration-500">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[160px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-rose-600/10 blur-[160px] rounded-full animate-pulse" />
        <Fingerprint size={1000} className="text-[var(--text-main)] opacity-[0.02] absolute -bottom-40 -left-40 rotate-12" />
      </div>

      <div className="w-full max-w-[1600px] mx-auto px-6 lg:px-12 py-12 relative z-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
          <div className="flex items-center gap-8">
            <div className="w-20 h-20 bg-indigo-500/10 border-2 border-indigo-500/20 rounded-3xl flex items-center justify-center shadow-2xl relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <Edit3 size={40} className="text-indigo-400 relative z-10" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Cpu size={14} className="text-indigo-400 animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-[0.4em] text-indigo-400/80 italic">Neural Workflow Orchestrator</span>
              </div>
              <h1 className="text-[clamp(2.5rem,8vw,5rem)] font-black text-[var(--text-main)] tracking-tighter leading-none italic uppercase">Studio Selection</h1>
              <p className="text-[var(--text-dim)] text-sm mt-2 font-medium max-w-lg italic">{video?.title || 'Untitled Manifest'}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={toggle} className="w-14 h-14 rounded-2xl bg-[var(--glass-surface)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-main)] hover:scale-105 transition-all shadow-xl">
              {resolvedTheme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button onClick={() => router.push('/dashboard/video')} className="px-8 py-4 rounded-2xl bg-[var(--glass-surface)] border border-[var(--glass-border)] text-[var(--text-dim)] hover:text-[var(--text-main)] transition-all flex items-center gap-4 shadow-xl backdrop-blur-[var(--glass-blur)] group">
              <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <span className="text-[11px] font-black uppercase tracking-widest italic">Return to Vault</span>
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-7">
            <div className="relative w-full aspect-video bg-black/60 rounded-[3rem] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.5)] border border-[var(--glass-border)] ring-1 ring-white/5 group">
              <video src={videoUrl} controls className="w-full h-full object-contain grayscale group-hover:grayscale-0 transition-all duration-1000" />
              <div className="absolute inset-0 pointer-events-none border-[min(20px,4vw)] border-[var(--page-bg)] rounded-[3rem]" />
              <div className="absolute top-8 left-8 flex items-center gap-3 px-4 py-2 rounded-full bg-black/60 border border-white/10 backdrop-blur-md">
                 <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                 <span className="text-[9px] font-black text-white uppercase tracking-widest italic">Live_Preview_Manifest</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-8">
            <div className="flex items-center gap-4">
               <span className="flex h-[2px] flex-1 bg-gradient-to-r from-transparent to-[var(--glass-border)]" />
               <span className="text-[10px] font-black text-[var(--text-dim)] uppercase tracking-[0.5em] italic">Protocol_Inference</span>
               <span className="flex h-[2px] flex-1 bg-gradient-to-l from-transparent to-[var(--glass-border)]" />
            </div>

            <div className="space-y-6">
              <button onClick={() => handleEditModeSelect('ai-auto')} className="w-full group relative flex items-start gap-8 p-10 rounded-[3rem] bg-[var(--glass-surface)] border border-[var(--glass-border)] hover:bg-[var(--glass-surface-heavy)] hover:border-indigo-500/30 transition-all duration-500 text-left shadow-2xl overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[60px] opacity-0 group-hover:opacity-40 transition-opacity" />
                <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center group-hover:scale-110 transition-all shadow-inner">
                  <Sparkles className="w-8 h-8 text-indigo-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                     <h2 className="text-2xl font-black text-[var(--text-main)] italic uppercase tracking-tight">Neural Forge</h2>
                     <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[8px] font-black text-indigo-400 uppercase italic">RECOMMENDED</span>
                  </div>
                  <p className="text-sm text-[var(--text-dim)] font-medium italic opacity-70">Initialize the AI engine to synthesize rough clips and viral hooks automatically.</p>
                  <div className="mt-6 flex items-center gap-3 text-indigo-400 font-black text-[11px] uppercase tracking-widest italic group-hover:gap-5 transition-all">
                    Initialize Forge <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </button>

              <button onClick={() => handleEditModeSelect('manual')} className="w-full group relative flex items-start gap-8 p-10 rounded-[3rem] bg-[var(--glass-surface)] border border-[var(--glass-border)] hover:bg-[var(--glass-surface-heavy)] hover:border-rose-500/30 transition-all duration-500 text-left shadow-2xl overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 blur-[60px] opacity-0 group-hover:opacity-40 transition-opacity" />
                <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center group-hover:scale-110 transition-all shadow-inner">
                  <Video className="w-8 h-8 text-rose-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-black text-[var(--text-main)] italic uppercase tracking-tight mb-2">Spectral Studio</h2>
                  <p className="text-sm text-[var(--text-dim)] font-medium italic opacity-70">Access the full kinetic calibration matrix for manual timeline mastery.</p>
                  <div className="mt-6 flex items-center gap-3 text-rose-400 font-black text-[11px] uppercase tracking-widest italic group-hover:gap-5 transition-all">
                    Access Studio <ArrowRight className="w-4 h-4" />
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
      <div className="fixed inset-0 bg-[var(--page-bg)] overflow-hidden transition-colors duration-500">
        <button type="button" onClick={() => setEditMode('selection')} className="absolute top-[5px] left-[67px] z-[100] flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--glass-surface)] border border-[var(--glass-border)] text-[var(--text-main)] text-sm font-medium shadow-xl backdrop-blur-[var(--glass-blur)] hover:bg-[var(--glass-surface-heavy)] transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back to Workflow
        </button>
        <DynamicModernVideoEditor videoId={videoId} videoUrl={urlForEditor} />
      </div>
    )
  }

  if (editMode === 'ai-auto') {
    const enabledCount = Object.values(editingOptions).filter(Boolean).length
    return (
      <div className="min-h-screen w-full bg-[var(--page-bg)] text-[var(--text-main)] selection:bg-indigo-500/30 overflow-x-hidden font-inter relative pb-32 transition-colors duration-500">
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[160px] rounded-full animate-pulse" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[160px] rounded-full animate-pulse" />
        </div>

        <div className="w-full max-w-[1600px] mx-auto px-6 lg:px-12 py-12 relative z-10">
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
            <div className="flex items-center gap-8">
              <div className="w-20 h-20 bg-blue-500/10 border-2 border-blue-500/20 rounded-3xl flex items-center justify-center shadow-2xl relative">
                <Sparkles size={40} className="text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <Cpu size={14} className="text-blue-400 animate-pulse" />
                  <span className="text-[11px] font-black uppercase tracking-[0.4em] text-blue-400/80 italic">Neural Forge Controller</span>
                </div>
                <h1 className="text-[clamp(2rem,6vw,4rem)] font-black text-[var(--text-main)] tracking-tighter leading-none italic uppercase">Forge Configuration</h1>
                <p className="text-[var(--text-dim)] text-sm mt-2 font-medium max-w-lg italic">{video?.title || 'Untitled Manifest'}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={toggle} className="w-14 h-14 rounded-2xl bg-[var(--glass-surface)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-main)] hover:scale-105 transition-all shadow-xl">
                {resolvedTheme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button onClick={() => handleAnalyzeVideo()} disabled={analyzing} className="px-8 py-4 rounded-2xl bg-[var(--glass-surface)] border border-[var(--glass-border)] text-[var(--text-dim)] hover:text-[var(--text-main)] transition-all flex items-center gap-4 shadow-xl backdrop-blur-[var(--glass-blur)] disabled:opacity-40">
                {analyzing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Eye className="w-5 h-5" />}
                <span className="text-[11px] font-black uppercase tracking-widest italic">{analyzing ? 'DIAGNOSING...' : 'DIAGNOSE_MANIFEST'}</span>
              </button>
              <button onClick={() => setEditMode('selection')} className="px-8 py-4 rounded-2xl bg-[var(--glass-surface)] border border-[var(--glass-border)] text-[var(--text-dim)] hover:text-[var(--text-main)] transition-all flex items-center gap-4 shadow-xl backdrop-blur-[var(--glass-blur)]">
                <ChevronLeft className="w-5 h-5" />
                <span className="text-[11px] font-black uppercase tracking-widest italic">Switch Protocol</span>
              </button>
            </div>
          </header>

          <AnimatePresence mode="wait">
            {processing ? (
              <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="bg-[var(--glass-surface)] backdrop-blur-[var(--glass-blur)] rounded-[3rem] border border-[var(--glass-border)] p-16 text-center shadow-2xl overflow-hidden relative">
                <div className="absolute top-0 right-0 p-12 opacity-5 animate-spin-slow"><RefreshCw size={200} /></div>
                <div className="relative z-10 max-w-lg mx-auto">
                  <div className="w-24 h-24 rounded-[2rem] bg-blue-500/10 border-2 border-blue-500/20 flex items-center justify-center mx-auto mb-8 shadow-xl">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                  </div>
                  <h2 className="text-4xl font-black text-[var(--text-main)] italic uppercase tracking-tighter mb-4">Synthesizing Manifest</h2>
                  <p className="text-[var(--text-dim)] font-medium italic mb-10 text-xs opacity-60 uppercase tracking-tight">Establishing neural uplink... Processing creative vectors...</p>
                  {editJobId ? (
                    <div className="p-8 rounded-[2.5rem] bg-[var(--glass-surface)] border border-[var(--glass-border)]">
                       <VideoProgressTracker jobId={editJobId} videoId={videoId} onComplete={(res) => { setAiEditResult(res); setProcessing(false); }} onError={() => { setProcessing(false); }} />
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex justify-between items-end mb-2">
                         <span className="text-xs font-black text-blue-400 uppercase tracking-[0.4em] italic">{liveProgress?.stage || 'INITIALIZING'}</span>
                         <span className="text-xl font-black text-[var(--text-main)] italic tabular-nums">{liveProgress?.percent || 0}%</span>
                      </div>
                      <div className="h-4 bg-[var(--glass-surface)] rounded-full overflow-hidden border border-[var(--glass-border)] shadow-inner">
                        <motion.div className="h-full bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.8)]" initial={{ width: 0 }} animate={{ width: `${liveProgress?.percent || 0}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : aiEditResult ? (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-12">
                <div className="bg-emerald-500/5 border-2 border-emerald-500/20 rounded-[4rem] p-12 flex flex-col md:flex-row items-center gap-12 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.1] transition-opacity rotate-12"><CheckCircle2 size={300} className="text-emerald-400" /></div>
                  <div className="w-24 h-24 rounded-[3rem] bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center shadow-3xl relative z-10"><CheckCircle2 size={48} className="text-emerald-400" /></div>
                  <div className="flex-1 text-center md:text-left relative z-10">
                    <h2 className="text-5xl font-black text-[var(--text-main)] italic uppercase tracking-tighter mb-2">Manifest Stable</h2>
                    <p className="text-[var(--text-dim)] font-medium italic uppercase tracking-widest text-[11px] opacity-60">Neural forge synthesis complete. Temporal blueprint ready.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-6 relative z-10 w-full md:w-auto">
                    <button onClick={() => handleEditModeSelect('manual')} className="px-12 py-6 rounded-[2.5rem] bg-[var(--text-main)] text-[var(--page-bg)] font-black text-sm uppercase tracking-[0.5em] hover:opacity-90 transition-all flex items-center justify-center gap-6 italic">Open Studio <ArrowRight className="w-6 h-6" /></button>
                    <button onClick={() => { setAiEditResult(null); setEditMode('selection'); }} className="px-10 py-6 rounded-[2.5rem] bg-[var(--glass-surface)] border-2 border-[var(--glass-border)] text-[var(--text-main)] font-black text-xs uppercase tracking-widest italic hover:bg-[var(--glass-surface-heavy)] transition-all">Dismiss</button>
                  </div>
                </div>
                {newVideoScore && (
                  <div className="bg-[var(--glass-surface)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] p-12 rounded-[5rem] relative overflow-hidden group min-h-[500px] flex flex-col">
                    <div className="absolute top-0 right-0 p-12 opacity-[0.03] rotate-6"><TrendingUp size={400} className="text-blue-400" /></div>
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 relative z-10 gap-8">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                           <Activity size={14} className="text-blue-400" />
                           <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em] italic">Predictive_Engagement_Matrix</span>
                        </div>
                        <h3 className="text-4xl font-black text-[var(--text-main)] italic uppercase tracking-tighter">Resonance Score</h3>
                      </div>
                      <div className="text-[clamp(4rem,12vw,8rem)] font-black text-blue-500 italic tabular-nums drop-shadow-[0_0_40px_rgba(59,130,246,0.3)] leading-none">{newVideoScore.score}%</div>
                    </div>
                    {newVideoScore.factors && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10 flex-1">
                        {newVideoScore.factors.map((f, i) => (
                          <div key={i} className="p-8 rounded-[3rem] bg-[var(--glass-surface)] border border-[var(--glass-border)] flex justify-between items-center group/factor hover:border-blue-500/30 transition-all">
                            <div className="space-y-1">
                               <p className="text-[10px] font-black text-[var(--text-dim)] uppercase tracking-[0.3em] italic group-hover/factor:text-blue-400 transition-colors">{f.name}</p>
                               <p className="text-2xl font-black text-[var(--text-main)] italic uppercase tracking-tight">{f.value}</p>
                            </div>
                            <div className={`px-4 py-2 rounded-full text-[11px] font-black italic tracking-widest ${f.impact.startsWith('+') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
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
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                <div className="lg:col-span-4 space-y-8">
                  {showAnalysis && aiAnalysis && (
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="bg-[var(--glass-surface)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] p-10 rounded-[4rem] space-y-8 relative overflow-hidden">
                       <div className="absolute top-0 right-0 p-12 opacity-[0.05] pointer-events-none rotate-12"><Activity size={180} className="text-emerald-400" /></div>
                       <div className="flex items-center gap-6">
                          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center"><CheckCircle2 size={28} className="text-emerald-400" /></div>
                          <div>
                             <h3 className="text-2xl font-black text-[var(--text-main)] italic uppercase tracking-tight leading-none">Diagnostics</h3>
                             <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest italic mt-1">UPLINK_SUCCESSFUL</p>
                          </div>
                       </div>
                       <div className="space-y-4 relative z-10">
                          <div className="p-6 rounded-[2.5rem] bg-[var(--glass-surface)] border border-[var(--glass-border)] flex justify-between items-center"><p className="text-[10px] font-black text-[var(--text-dim)] uppercase tracking-widest italic">OPTIMAL_DURATION</p><p className="text-3xl font-black text-[var(--text-main)] italic tabular-nums">{Math.round(aiAnalysis.suggestedLength || 0)}S</p></div>
                       </div>
                    </motion.div>
                  )}
                  <div className="bg-[var(--glass-surface)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] p-10 rounded-[4rem] space-y-8 relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-12 opacity-[0.05] pointer-events-none -rotate-12"><Brain size={180} className="text-blue-400" /></div>
                     <div className="flex items-center gap-6">
                        <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border-blue-500/20 flex items-center justify-center"><Terminal size={28} className="text-blue-400" /></div>
                        <div>
                           <h3 className="text-2xl font-black text-[var(--text-main)] italic uppercase tracking-tight leading-none">Strategy Matrix</h3>
                           <p className="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest italic mt-1">SOVEREIGN_VECTORS</p>
                        </div>
                     </div>
                     <div className="space-y-4 relative z-10">
                        {[{ label: 'HOOK_FOCUS', val: 'FIRST 3S' }, { label: 'RETENTION_BPM', val: 'AUTO_SYNC' }].map((s, i) => (
                          <div key={i} className="flex justify-between items-center p-6 rounded-[2.5rem] bg-[var(--glass-surface)] border border-[var(--glass-border)] group/row"><span className="text-[10px] font-black text-[var(--text-dim)] uppercase tracking-widest italic">{s.label}</span><span className="text-sm font-black text-[var(--text-main)] italic uppercase tracking-widest tabular-nums">{s.val}</span></div>
                        ))}
                     </div>
                  </div>
                </div>

                <div className="lg:col-span-8 flex flex-col gap-8">
                   <div className="bg-[var(--glass-surface)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] p-12 rounded-[5rem] relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-24 opacity-[0.02] pointer-events-none rotate-45"><Settings size={500} className="text-[var(--text-main)]" /></div>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-8 mb-16 relative z-10">
                         <div className="w-16 h-16 rounded-[2rem] bg-[var(--glass-surface)] border-2 border-[var(--glass-border)] flex items-center justify-center"><Cpu size={32} className="text-blue-400" /></div>
                         <div>
                            <h2 className="text-5xl font-black text-[var(--text-main)] italic uppercase tracking-tighter leading-none">Neural Parameters</h2>
                            <p className="text-[11px] font-black text-[var(--text-dim)] uppercase tracking-[0.5em] italic mt-3 opacity-60">CALIBRATE_FORGE_SEQUENCE_V4.2</p>
                         </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 relative z-10">
                        <div className="space-y-8">
                           <div className="flex items-center justify-between px-4"><label className="text-[11px] font-black text-[var(--text-dim)] uppercase tracking-[0.6em] italic flex items-center gap-4"><Zap size={16} className="text-blue-400" /> SYNTHESIS_NODES</label></div>
                           <div className="space-y-4">
                              {[{ id: 'removeSilence', label: 'SILENCE_REMOVAL', desc: 'Auto-cut dead air & filler words.' }, { id: 'optimizePacing', label: 'PACING_SYNC', desc: 'Tighten kinetic flow.' }, { id: 'enhanceAudio', label: 'SPECTRAL_AUDIO', desc: 'Neural noise reduction.' }, { id: 'generateClips', label: 'SWARM_CLIPPING', desc: 'Synthesize viral nodes.' }, { id: 'addCaptions', label: 'DYNAMIC_CAPTIONS', desc: 'Burn-in high-fidelity captions.' }, { id: 'enhanceColor', label: 'COLOR_RESONANCE', desc: 'AI-driven color grading.' }].map(node => (
                                <button key={node.id} onClick={() => setEditingOptions(prev => ({ ...prev, [node.id]: !prev[node.id as keyof typeof prev] }))} className={`w-full p-6 rounded-[3rem] border-2 transition-all duration-500 flex items-center justify-between group/opt relative overflow-hidden ${editingOptions[node.id as keyof typeof editingOptions] ? 'bg-blue-500/10 border-blue-500/40 text-[var(--text-main)] shadow-xl' : 'bg-[var(--glass-surface)] border-[var(--glass-border)] text-[var(--text-dim)] hover:border-white/20'}`}>
                                  <div className="text-left relative z-10"><p className="text-lg font-black italic uppercase tracking-tight leading-none mb-1.5">{node.label}</p><p className="text-[10px] font-bold text-[var(--text-dim)] italic uppercase tracking-widest">{node.desc}</p></div>
                                  <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center relative z-10 ${editingOptions[node.id as keyof typeof editingOptions] ? 'bg-blue-500 border-blue-400 text-white scale-110' : 'bg-black/40 border-white/10'}`}>{editingOptions[node.id as keyof typeof editingOptions] && <CheckCircle2 size={16} />}</div>
                                </button>
                              ))}
                           </div>
                        </div>
                        <div className="space-y-10">
                           <div className="space-y-8">
                              <label className="text-[11px] font-black text-[var(--text-dim)] uppercase tracking-[0.6em] italic flex items-center gap-4 px-4"><LayoutGrid size={16} className="text-indigo-400" /> MATRIX_CALIBRATION</label>
                              <div className="space-y-6">
                                 <div className="p-8 rounded-[3.5rem] bg-black/40 border-2 border-white/5 space-y-6">
                                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic">TARGET_DOMAIN</p>
                                    <div className="flex flex-wrap gap-3">{[{ id: 'auto', label: 'AUTO' }, { id: 'vertical', label: '9:16' }, { id: 'square', label: '1:1' }, { id: 'standard', label: '16:9' }].map(f => (<button key={f.id} onClick={() => setOutputFormat(f.id as "auto" | "vertical" | "square" | "standard")} className={`px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest italic transition-all border-2 ${outputFormat === f.id ? 'bg-white text-black border-white shadow-2xl scale-110' : 'bg-white/5 text-slate-500 border-white/5 hover:text-white'}`}>{f.label}</button>)) }</div>
                                 </div>
                                 <div className="p-8 rounded-[3.5rem] bg-black/40 border-2 border-white/5 space-y-6">
                                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic">STYLE_DNA</p>
                                    <select value={captionStyle} onChange={(e) => setCaptionStyle(e.target.value)} className="w-full bg-black/80 border-2 border-white/5 rounded-[2rem] px-8 py-5 text-sm font-black italic uppercase text-white outline-none">
                                       {['modern', 'bold', 'minimal', 'tiktok', 'youtube', 'neon', 'pill', 'cinematic'].map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                                    </select>
                                 </div>
                              </div>
                           </div>
                           <div className="pt-12">
                              <button onClick={handleStartAIEdit} className={`w-full py-14 rounded-[4rem] font-black text-4xl uppercase tracking-[0.8em] transition-all duration-1000 italic active:scale-95 group relative overflow-hidden flex items-center justify-center gap-10 bg-blue-600 text-white hover:bg-blue-500 shadow-2xl`}>
                                {processing ? <RefreshCw size={48} className="animate-spin text-blue-300" /> : <Zap size={48} />} {processing ? 'SYNTHESIZING...' : 'Initialise Forge'}
                              </button>
                           </div>
                        </div>
                      </div>
                   </div>
                   <div className="pt-12 flex justify-center">
                      <button onClick={() => setEditMode('selection')} className="flex items-center gap-4 text-[10px] font-black text-[var(--text-dim)] uppercase tracking-[0.6em] italic hover:text-[var(--text-main)] transition-colors group"><ArrowLeft size={16} className="group-hover:-translate-x-2 transition-transform" /> Back to Selection Matrix</button>
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
