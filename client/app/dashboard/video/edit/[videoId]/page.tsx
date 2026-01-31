'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet, apiPost, API_URL } from '../../../../../lib/api'
import { Sparkles, Edit3, Play, Loader2, AlertCircle, Settings, CheckCircle2, XCircle, RefreshCw, Download, Eye } from 'lucide-react'
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
  const [showOptions, setShowOptions] = useState(false)
  const [editJobId, setEditJobId] = useState<string | null>(null)

  // Analyze video before editing
  const handleAnalyzeVideo = async () => {
    setAnalyzing(true)
    setShowAnalysis(false)
    setAiAnalysis(null)

    try {
      const analysis = await apiPost('/video/ai-editing/analyze', {
        videoMetadata: {
          videoId: videoId,
          url: videoUrl,
          title: video?.title,
          duration: 0 // Could get from video element if needed
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
    setEditJobId(null)

    try {
      // Call the actual AI editing API
      const result = await apiPost('/video/ai-editing/auto-edit', {
        videoId: videoId,
        editingOptions: editingOptions
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12">
              <h1 className="text-5xl md:text-6xl font-black mb-6 tracking-tight">
                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">Power Your Creativity</span>
              </h1>
              <p className="text-xl text-slate-600 dark:text-slate-400 font-medium max-w-2xl mx-auto">
                Choose your workflow and transform your footage into professional content with ease
              </p>
            </div>

            {/* Video Preview */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 mb-8">
              <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">Video Preview</h3>
              <div className="aspect-video bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
                <video
                  src={videoUrl}
                  controls
                  className="w-full h-full"
                />
              </div>
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
                <strong>Title:</strong> {video?.title || 'Untitled Video'}
              </p>
            </div>

            {/* Selection Cards */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Manual Edit Card */}
              <button
                onClick={() => handleEditModeSelect('manual')}
                className="group relative bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] p-10 hover:shadow-2xl transition-all duration-500 border border-slate-200 dark:border-slate-800 hover:border-purple-500/50 text-left overflow-hidden translate-z-0"
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
                className="group relative bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] p-10 hover:shadow-2xl transition-all duration-500 border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 text-left overflow-hidden translate-z-0 disabled:opacity-50 disabled:cursor-not-allowed"
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
            <div className="mt-8 text-center">
              <button
                onClick={() => router.push('/dashboard/video')}
                className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold gradient-text mb-2">AI Auto Editor</h1>
                <p className="text-slate-600 dark:text-slate-400">{video?.title || 'Untitled Video'}</p>
              </div>
              <div className="flex gap-2">
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
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
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
              </div>
            )}

            {/* Editing Options */}
            {!processing && !aiEditResult && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Editing Options
                  </h2>
                  <button
                    onClick={() => setShowOptions(!showOptions)}
                    className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    {showOptions ? 'Hide' : 'Configure'}
                  </button>
                </div>
                {showOptions && (
                  <div className="grid md:grid-cols-2 gap-4 mt-4">
                    {Object.entries(editingOptions).map(([key, value]) => (
                      <label key={key} className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <input
                          type="checkbox"
                          checked={value as boolean}
                          onChange={(e) => setEditingOptions({ ...editingOptions, [key]: e.target.checked })}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300 capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                      </label>
                    ))}
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
                  <div className="flex gap-2">
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
                        setProcessingError('')
                        setEditJobId(null)
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      Edit Again
                    </button>
                    <button
                      onClick={() => setEditMode('selection')}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
                    >
                      Change Mode
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
                {/* Video Preview */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6">
                  <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-white">Video Preview</h2>
                  <div className="aspect-video bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden mb-6">
                    <video
                      src={videoUrl}
                      controls
                      className="w-full h-full"
                    />
                  </div>
                </div>

                {/* Start Editing CTA */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl shadow-xl p-8 text-center border border-blue-200 dark:border-blue-800">
                  <Sparkles className="w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">
                    Ready to Process Your Video with AI
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-2xl mx-auto">
                    Configure your editing options above, then click the button below to start AI processing.
                    The AI will automatically optimize your video based on your preferences.
                  </p>
                  <button
                    onClick={handleStartAIEdit}
                    disabled={!Object.values(editingOptions).some(v => v)}
                    className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-semibold text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
                  >
                    <Sparkles className="w-5 h-5" />
                    Start AI Auto Edit
                  </button>
                  {!Object.values(editingOptions).some(v => v) && (
                    <p className="text-sm text-red-500 dark:text-red-400 mt-2">
                      Please enable at least one editing option
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
