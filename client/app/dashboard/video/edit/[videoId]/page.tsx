'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet, apiPost, API_URL } from '../../../../../lib/api'
import { Sparkles, Edit3, Play, Loader2, AlertCircle, Settings, CheckCircle2, XCircle, RefreshCw, Download, Eye, BarChart3, Award, Edit } from 'lucide-react'
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
  const [video, setVideo] = useState<Video | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editMode, setEditMode] = useState<EditMode>('selection')
  const [processing, setProcessing] = useState(false)

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
  const [editingOptions, setEditingOptions] = useState({
    removeSilence: true,
    optimizePacing: true,
    enhanceAudio: true,
    generateClips: true,
    addCaptions: false,
    enhanceColor: false,
    stabilizeVideo: false
  })
  const STORAGE_KEYS = { lastPreset: 'click-ai-edit-last-preset', lastCaptionStyle: 'click-ai-edit-last-caption-style', preciseScenes: 'click-ai-edit-precise-scenes', minSceneLength: 'click-ai-edit-min-scene-length' }

  const [editPreset, setEditPreset] = useState<string>(() => (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.lastPreset) || '' : ''))
  const [captionStyle, setCaptionStyle] = useState<string>(() => (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.lastCaptionStyle) || 'modern' : 'modern'))
  const [outputFormat, setOutputFormat] = useState<'auto' | 'vertical' | 'square' | 'standard'>('auto')
  const [showOptions, setShowOptions] = useState(true)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [usePreciseScenes, setUsePreciseScenes] = useState<boolean>(() => (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.preciseScenes) === 'true' : false))
  const [minSceneLength, setMinSceneLength] = useState<string>(() => (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.minSceneLength) || '1' : '1'))
  const [editJobId, setEditJobId] = useState<string | null>(null)
  const [newVideoScore, setNewVideoScore] = useState<{ score: number; factors?: { name: string; value: string; impact: string }[] } | null>(null)
  const videoPreviewRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (editPreset) localStorage.setItem(STORAGE_KEYS.lastPreset, editPreset)
    localStorage.setItem(STORAGE_KEYS.lastCaptionStyle, captionStyle)
    localStorage.setItem(STORAGE_KEYS.preciseScenes, String(usePreciseScenes))
    localStorage.setItem(STORAGE_KEYS.minSceneLength, minSceneLength)
  }, [editPreset, captionStyle, usePreciseScenes, minSceneLength])

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

  // Analyze video before editing (pass duration from video element when loaded for accuracy)
  const handleAnalyzeVideo = async () => {
    setAnalyzing(true)
    setShowAnalysis(false)
    setAiAnalysis(null)
    const durationFromVideo = videoPreviewRef.current?.duration
    const duration = Number.isFinite(durationFromVideo) && durationFromVideo > 0 ? durationFromVideo : 0

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
      // Don't block editing if analysis fails
    }
  }

  const handleEditModeSelect = async (mode: 'manual' | 'ai-auto') => {
    if (mode === 'ai-auto') {
      // Don't start editing immediately - let user configure options first
      setEditMode(mode)
      setProcessingError('')
      setAiEditResult(null)
      setEditJobId(null)
    } else {
      setEditMode(mode)
      setProcessingError('')
      setAiEditResult(null)
      setEditJobId(null)
    }
  }

  const handleStartAIEdit = async () => {
    setProcessing(true)
    setProcessingError('')
    setAiEditResult(null)
    setNewVideoScore(null)
    setEditJobId(null)

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

      // Store job ID if provided for progress tracking
      if (result.data?.jobId || result.jobId) {
        setEditJobId(result.data?.jobId || result.jobId)
      }

      // If result is immediate (not async), set it
      if (result.data?.editedVideoUrl || result.editedVideoUrl) {
        setAiEditResult(result)
        setProcessing(false)
      } else {
        // If async, we'll track progress
        // For now, simulate completion after a delay
        // In production, this would poll the progress endpoint
        setTimeout(() => {
          setAiEditResult(result)
          setProcessing(false)
        }, 3000)
      }
    } catch (error: any) {
      console.error('AI auto-edit failed:', error)
      setProcessingError(error.response?.data?.error || error.message || 'Failed to process video with AI')
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading video...</p>
        </div>
      </div>
    )
  }

  if (error || !video) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900 flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-8 text-center">
            <div className="flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full mb-4 mx-auto">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">Video Not Found</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              {error || 'The video you\'re looking for could not be loaded.'}
            </p>
            <button
              onClick={() => router.push('/dashboard/video')}
              className="btn-modern btn-modern-primary"
            >
              Back to Videos
            </button>
          </div>
        </div>
      </div>
    )
  }

  const videoUrl = video.originalFile?.url

  // Show selection screen
  if (editMode === 'selection') {
    return (
      <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900">
        <div className="container-readable py-8 sm:py-12">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Header */}
            <div className="text-center mb-10">
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-black mb-4 sm:mb-6 tracking-tight">
                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Power Your Creativity
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-400 font-medium max-w-2xl mx-auto px-2">
                Choose your workflow and transform your footage into professional content with ease
              </p>
            </div>

            {/* Video Preview */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden p-5 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-slate-900 dark:text-white">
                Video Preview
              </h3>
              <div className="aspect-video bg-gray-900 dark:bg-black rounded-xl overflow-hidden">
                <video src={videoUrl} controls className="w-full h-full object-contain" />
              </div>
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-400 truncate">
                <strong>Title:</strong> {video?.title || 'Untitled Video'}
              </p>
            </div>

            {/* Selection Cards */}
            <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
              {/* Manual Edit Card */}
              <button
                onClick={() => handleEditModeSelect('manual')}
                className="group relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-lg dark:shadow-xl p-6 sm:p-8 md:p-10 hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 border-2 border-slate-200 dark:border-slate-700 hover:border-purple-500/50 text-left overflow-hidden w-full"
              >
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl group-hover:bg-purple-500/20 transition-all duration-500"></div>
                <div className="flex items-center justify-center w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full mb-6 group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors">
                  <Edit3 className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                </div>
                <h2 className="text-2xl font-bold mb-3 text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                  Manual Edit
                </h2>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                  Take full control with our professional video editor. Trim, cut, add effects, captions, and customize every aspect of your video.
                </p>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400 mb-6">
                  <li className="flex items-center">
                    <span className="mr-2">✓</span>
                    Timeline-based editing
                  </li>
                  <li className="flex items-center">
                    <span className="mr-2">✓</span>
                    Advanced effects & transitions
                  </li>
                  <li className="flex items-center">
                    <span className="mr-2">✓</span>
                    Custom captions & text overlays
                  </li>
                  <li className="flex items-center">
                    <span className="mr-2">✓</span>
                    Audio mixing & enhancement
                  </li>
                </ul>
                <div className="flex items-center text-purple-600 dark:text-purple-400 font-semibold group-hover:translate-x-2 transition-transform">
                  Start Manual Edit
                  <Play className="w-5 h-5 ml-2" />
                </div>
              </button>

              {/* AI Auto Edit Card */}
              <button
                onClick={() => handleEditModeSelect('ai-auto')}
                disabled={processing}
                className="group relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-lg dark:shadow-xl p-6 sm:p-8 md:p-10 hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500/50 text-left overflow-hidden w-full disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all duration-500"></div>
                <div className="flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-6 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                  {processing ? (
                    <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
                  ) : (
                    <Sparkles className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
                <h2 className="text-2xl font-bold mb-3 text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  AI Auto Edit
                </h2>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                  Let AI automatically optimize your video. Remove silence, enhance audio, add transitions, and create engaging clips in seconds.
                </p>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400 mb-6">
                  <li className="flex items-center">
                    <span className="mr-2">✓</span>
                    Automatic silence removal
                  </li>
                  <li className="flex items-center">
                    <span className="mr-2">✓</span>
                    Smart pacing optimization
                  </li>
                  <li className="flex items-center">
                    <span className="mr-2">✓</span>
                    Auto-generated captions
                  </li>
                  <li className="flex items-center">
                    <span className="mr-2">✓</span>
                    AI-powered highlights
                  </li>
                </ul>
                <div className="flex items-center text-blue-600 dark:text-blue-400 font-semibold group-hover:translate-x-2 transition-transform">
                  {processing ? 'Processing...' : 'Start AI Auto Edit'}
                  {!processing && <Play className="w-5 h-5 ml-2" />}
                </div>
              </button>
            </div>

            {/* Back Button */}
            <div className="pt-4 text-center">
              <button
                onClick={() => router.push('/dashboard/video')}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors touch-target"
              >
                ← Back to Videos
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show manual edit interface
  if (editMode === 'manual') {
    console.log('🎬 [Video Edit] Rendering ModernVideoEditor with:', {
      videoId,
      videoUrl,
      hasVideoUrl: !!videoUrl,
      videoUrlLength: videoUrl?.length
    })

    if (!videoUrl) {
      return (
        <div className="fixed inset-0 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-slate-800 dark:to-indigo-900 flex items-center justify-center">
          <div className="text-center max-w-md p-8">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">Video URL Not Available</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              The video URL could not be loaded. Please check if the video was uploaded successfully.
            </p>
            <button
              onClick={() => router.push('/dashboard/video')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Videos
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900 overflow-hidden">
        {/* Use the actual ModernVideoEditor component - full screen */}
        <DynamicModernVideoEditor
          videoId={videoId}
          videoUrl={videoUrl}
        />
      </div>
    )
  }

  // Show AI auto edit interface
  if (editMode === 'ai-auto') {
    return (
      <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900">
        <div className="container-readable py-6 pb-10">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-1">
                  AI Auto Editor
                </h1>
                <p className="text-slate-600 dark:text-slate-400 truncate">{video?.title || 'Untitled Video'}</p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  onClick={() => handleAnalyzeVideo()}
                  disabled={analyzing}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4" />
                      Analyze Video
                    </>
                  )}
                </button>
                <button
                  onClick={() => setEditMode('selection')}
                  className="px-4 py-2 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                >
                  Change Mode
                </button>
              </div>
            </div>

            {/* Video Analysis Results */}
            {showAnalysis && aiAnalysis && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    Video Analysis Complete
                  </h2>
                  <button
                    onClick={() => setShowAnalysis(false)}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {((aiAnalysis.suggestedLength != null) || (aiAnalysis.recommendedCuts?.length > 0)) && (
                    <div className="md:col-span-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3">
                      <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1.5 text-sm">Quick suggestions</h3>
                      <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                        {aiAnalysis.suggestedLength != null && (
                          <li>Optimal length: <strong>{Math.round(Number(aiAnalysis.suggestedLength))}s</strong>. Consider enabling &quot;Remove silence&quot; and &quot;Optimize pacing&quot;.</li>
                        )}
                        {aiAnalysis.recommendedCuts?.length > 0 && (
                          <li><strong>{aiAnalysis.recommendedCuts.length}</strong> suggested cut(s) for dead air. Enable &quot;Remove silence&quot; to apply.</li>
                        )}
                        <li>Enable &quot;Add captions&quot; for better reach on Reels and TikTok.</li>
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
                </div>

                {/* Profile video analytics (when available) */}
                {aiAnalysis.profileInsights && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
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
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-500" />
                      Edit styles (ranked by potential score)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                      Current base score: <strong>{aiAnalysis.baseScore ?? '—'}</strong>/100. Choose a style to apply its preset and caption, then Start AI Auto Edit.
                    </p>
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
                            className="mt-3 w-full py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
                          >
                            Use this style
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Output Format */}
            {!processing && !aiEditResult && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-5">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">Output format</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Choose aspect ratio for the edited video</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'auto' as const, label: 'Auto (match source)', desc: 'Source' },
                    { id: 'vertical' as const, label: 'Vertical 9:16', desc: 'Reels · TikTok' },
                    { id: 'square' as const, label: 'Square 1:1', desc: 'Feed' },
                    { id: 'standard' as const, label: 'Standard 16:9', desc: 'YouTube' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setOutputFormat(f.id)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${outputFormat === f.id
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-100 dark:bg-gray-700 text-slate-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Editing Options */}
            {!processing && !aiEditResult && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
                <button
                  onClick={() => setShowOptions(!showOptions)}
                  className="w-full flex items-center justify-between p-5 hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                      <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="text-left">
                      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Editing Options</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Configure what the AI will apply to your video
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    {showOptions ? 'Collapse' : 'Expand'}
                  </span>
                </button>
                {showOptions && (
                  <div className="px-5 pb-5 pt-0 border-t border-gray-100 dark:border-gray-700/50">
                    {/* Preset bundles */}
                    <div className="pt-4 mb-4">
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Quick presets</p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { label: 'TikTok / Reels', opts: { removeSilence: true, optimizePacing: true, enhanceAudio: true, generateClips: true, addCaptions: true, enhanceColor: true, stabilizeVideo: false } },
                          { label: 'Podcast', opts: { removeSilence: true, optimizePacing: true, enhanceAudio: true, generateClips: false, addCaptions: true, enhanceColor: false, stabilizeVideo: false } },
                          { label: 'All-in-one', opts: { removeSilence: true, optimizePacing: true, enhanceAudio: true, generateClips: true, addCaptions: true, enhanceColor: true, stabilizeVideo: true } },
                        ].map((preset) => (
                          <button
                            key={preset.label}
                            onClick={() => { setEditingOptions(preset.opts); setOutputFormat(preset.label.includes('TikTok') ? 'vertical' : outputFormat) }}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-700 text-slate-700 dark:text-slate-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 transition-all"
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
                          { key: 'enhanceAudio', label: 'Enhance audio', hint: 'Clearer sound' },
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
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-12">
                <div className="text-center mb-6">
                  <Loader2 className="w-16 h-16 text-blue-600 dark:text-blue-400 animate-spin mx-auto mb-4" />
                  <h2 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">AI is Processing Your Video</h2>
                  <p className="text-slate-600 dark:text-slate-400 mb-4">
                    Applying your selected editing options...
                  </p>
                </div>

                {/* Progress Tracker */}
                {editJobId && (
                  <div className="mb-6">
                    <VideoProgressTracker
                      videoId={videoId}
                      operation="ai-auto-edit"
                      jobId={editJobId}
                      onComplete={(result: any) => {
                        setAiEditResult(result)
                        setProcessing(false)
                      }}
                    />
                  </div>
                )}

                {/* Manual Progress Indicator (fallback) */}
                {!editJobId && (
                  <div className="mb-6">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                      <div className="bg-blue-600 h-2.5 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                    </div>
                    <p className="text-center text-sm text-slate-600 dark:text-slate-400 mt-2">Processing your video...</p>
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
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6">
                <div className="flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full mb-4 mx-auto">
                  <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
                <h2 className="text-2xl font-bold mb-2 text-center text-slate-900 dark:text-white">Processing Failed</h2>
                <p className="text-slate-600 dark:text-slate-400 text-center mb-6">
                  {processingError}
                </p>
                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => handleEditModeSelect('ai-auto')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={() => setEditMode('selection')}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Back to Selection
                  </button>
                </div>
              </div>
            ) : aiEditResult ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    AI Auto-Edit Results
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        const url = aiEditResult.data?.editedVideoUrl || aiEditResult.editedVideoUrl || videoUrl
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `${video?.title || 'edited-video'}.mp4`
                        a.click()
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                    <button
                      onClick={() => {
                        setAiEditResult(null)
                        setNewVideoScore(null)
                        setProcessingError('')
                        setEditJobId(null)
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-2"
                    >
                      <Edit className="w-4 h-4" />
                      Edit further
                    </button>
                    <button
                      onClick={() => setEditMode('manual')}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
                    >
                      Open in editor
                    </button>
                    <button
                      onClick={() => setEditMode('selection')}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
                    >
                      Change mode
                    </button>
                  </div>
                </div>

                {/* Video Comparison */}
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Original</h3>
                    <div className="aspect-video bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
                      <video
                        src={videoUrl}
                        controls
                        className="w-full h-full"
                      />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Edited</h3>
                    <div className="aspect-video bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
                      <video
                        src={aiEditResult.data?.editedVideoUrl || aiEditResult.editedVideoUrl || videoUrl}
                        controls
                        className="w-full h-full"
                      />
                    </div>
                  </div>
                </div>

                {/* New video score (after edit) */}
                {newVideoScore != null && (
                  <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800">
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
                          <span key={f.name} className="text-xs px-2 py-1 rounded bg-white/60 dark:bg-black/20 text-slate-700 dark:text-slate-300">
                            {f.name}: {f.value}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-slate-50 dark:bg-gray-900 rounded-lg p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <p className="text-slate-900 dark:text-white font-semibold">
                      AI auto-editing completed successfully!
                    </p>
                  </div>
                  {aiEditResult.data?.editsApplied && aiEditResult.data.editsApplied.length > 0 && (
                    <div className="mb-4">
                      <p className="text-slate-700 dark:text-slate-300 mb-3 font-semibold">Applied edits:</p>
                      <ul className="space-y-2 text-slate-600 dark:text-slate-400">
                        {aiEditResult.data.editsApplied.map((edit: string, index: number) => (
                          <li key={index} className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                            <span>{edit}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {!aiEditResult.data?.editsApplied && (
                    <div className="space-y-2">
                      {Object.entries(editingOptions).filter(([_, enabled]) => enabled).map(([key, _]) => (
                        <div key={key} className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Video Preview - prominent card */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
                  <div className="p-5 border-b border-gray-100 dark:border-gray-700/50">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      Video Preview
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      Your source video — AI will process based on selected options
                    </p>
                  </div>
                  <div className="p-4 sm:p-6">
                    <div className="aspect-video bg-gray-900 dark:bg-black rounded-xl overflow-hidden">
                      <video
                        ref={videoPreviewRef}
                        src={videoUrl}
                        controls
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                </div>

                {/* Start Editing CTA */}
                <div className="bg-gradient-to-br from-blue-50 via-indigo-50/50 to-purple-50 dark:from-blue-900/20 dark:via-indigo-900/10 dark:to-purple-900/20 rounded-2xl shadow-xl p-6 sm:p-8 text-center border-2 border-blue-200/60 dark:border-blue-800/50">
                  <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-white mb-4">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold mb-2 text-slate-900 dark:text-white">
                    Ready to Process with AI
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-xl mx-auto text-sm sm:text-base">
                    Configure your editing options above, then start AI processing. The AI will optimize your video based on your preferences.
                  </p>
                  <button
                    onClick={handleStartAIEdit}
                    disabled={!Object.values(editingOptions).some(v => v)}
                    className="px-6 py-3.5 sm:px-8 sm:py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all font-semibold text-base shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto touch-target"
                  >
                    <Sparkles className="w-5 h-5" />
                    Start AI Auto Edit
                  </button>
                  {!Object.values(editingOptions).some(v => v) && (
                    <p className="text-sm text-amber-600 dark:text-amber-400 mt-3 flex items-center justify-center gap-2">
                      <span>⚠</span> Enable at least one editing option above
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}
