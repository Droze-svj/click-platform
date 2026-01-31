'use client'

import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import FileUpload from '../../../components/FileUpload'
import LoadingSpinner from '../../../components/LoadingSpinner'
import LoadingSkeleton from '../../../components/LoadingSkeleton'
import ErrorAlert from '../../../components/ErrorAlert'
import SuccessAlert from '../../../components/SuccessAlert'
import EmptyState from '../../../components/EmptyState'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import BatchVideoProcessor from '../../../components/BatchVideoProcessor'
import { extractApiData, extractApiError } from '../../../utils/apiResponse'
import { useSocket } from '../../../hooks/useSocket'
import { useAuth } from '../../../hooks/useAuth'
import { apiGet, API_URL } from '../../../lib/api'
import { DynamicModernVideoEditor, DynamicEnhancedVideoEditor } from '../../../components/DynamicImports'

// Lazy load heavy video components
const ModernVideoEditor = lazy(() => import('../../../components/ModernVideoEditor'))
const EnhancedVideoEditor = lazy(() => import('../../../components/EnhancedVideoEditor'))

interface Video {
  _id: string
  title: string
  status: string
  originalFile: {
    url: string
  }
  generatedContent?: {
    shortVideos: Array<{
      url: string
      thumbnail: string
      caption: string
      duration: number
      platform: string
    }>
  }
  createdAt: string
}

export default function VideoPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { socket, connected, on, off } = useSocket(user?.id || null)
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [isRetrying, setIsRetrying] = useState(false)

  const loadVideos = useCallback(async (isRetry = false) => {
    if (isRetry) {
      setIsRetrying(true)
      setRetryCount(prev => prev + 1)
    }

    try {
      const response = await apiGet<any>('/video')
      const videos = response?.data || response || []
      setVideos(Array.isArray(videos) ? videos : [])
      setError('') // Clear any previous errors on success
      setRetryCount(0) // Reset retry count on success
    } catch (error: any) {
      const errorObj = extractApiError(error)

      // Handle different error types
      if (error.name === 'DatabaseTimeoutError') {
        setError('The server is temporarily unavailable. Videos will load automatically when the service is back online.')
        // Try to reload after a delay if not already retrying too much
        if (retryCount < 3) {
          setTimeout(() => loadVideos(true), 10000)
        }
      } else if (error.response?.status === 500) {
        setError('Server temporarily unavailable. You can try again or refresh the page.')
      } else if (error.response?.status === 401) {
        setError('Authentication expired. Please log in again.')
        router.push('/login')
      } else {
        setError(typeof errorObj === 'string' ? errorObj : errorObj?.message || 'Failed to load videos')
      }

      // Still show empty state even on error
      setVideos([])
    } finally {
      setLoading(false)
      setIsRetrying(false)
    }
  }, [router, retryCount])

  const handleRetry = useCallback(() => {
    setLoading(true)
    setError('')
    loadVideos(true)
  }, [loadVideos])

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }
    loadVideos()
  }, [user, loadVideos])

  // Listen for real-time video processing updates (global listener for any video)
  // Note: This is a fallback for videos not currently being tracked in handleUpload
  useEffect(() => {
    if (!socket || !connected) return

    const handleVideoProcessed = (data: any) => {
      if (data.status === 'completed') {
        setSuccess(`Video processing complete! ${data.clips || 0} clips generated.`)
        // Reload videos after a short delay
        setTimeout(() => {
          loadVideos()
        }, 500)
      } else if (data.status === 'failed') {
        setError('Video processing failed')
        setTimeout(() => {
          loadVideos()
        }, 500)
      }
    }

    on('video-processed', handleVideoProcessed)

    return () => {
      off('video-processed', handleVideoProcessed)
    }
  }, [socket, connected, on, off, loadVideos])

  // Auto-refresh videos every 30 seconds if there are processing videos
  useEffect(() => {
    const hasProcessingVideos = videos.some(v => v.status === 'processing')
    
    if (!hasProcessingVideos) return

    const refreshInterval = setInterval(() => {
      loadVideos()
    }, 30000) // Refresh every 30 seconds

    return () => clearInterval(refreshInterval)
  }, [videos, loadVideos])

  // Define pollVideoStatus BEFORE handleUpload since handleUpload depends on it
  const pollVideoStatus = useCallback(async (contentId: string, onComplete?: () => void) => {
    let pollCount = 0
    const maxPolls = 100 // Stop after 100 polls (5 minutes at 3s interval)
    let isPolling = true

    const interval = setInterval(async () => {
      if (!isPolling || pollCount >= maxPolls) {
        clearInterval(interval)
        return
      }

      pollCount++
      
      try {
        const response = await apiGet<any>(`/video/${contentId}/status`)
        
        const status = response?.status || response?.data?.status
        const progress = response?.progress || response?.data?.progress || 0
        
        if (status === 'completed') {
          clearInterval(interval)
          isPolling = false
          setSuccess(`Video processing complete! ${response?.data?.clipsCount || 0} clips generated.`)
          // Reload videos after a short delay to ensure backend has updated
          setTimeout(() => {
            loadVideos()
          }, 500)
          // Call onComplete callback if provided (for redirect)
          if (onComplete) {
            setTimeout(() => {
              onComplete()
            }, 1500)
          }
        } else if (status === 'failed') {
          clearInterval(interval)
          isPolling = false
          setError('Video processing failed. Please try uploading again.')
          await loadVideos()
        } else if (status === 'processing') {
          // Update success message with progress
          if (progress > 0) {
            setSuccess(`Video processing: ${progress}% complete...`)
          }
        }
      } catch (error: any) {
        // Log error but continue polling unless it's a 404 (video not found)
        if (error.response?.status === 404) {
          clearInterval(interval)
          isPolling = false
          setError('Video not found. Please try uploading again.')
        } else if (pollCount >= 10) {
          // After 10 failed polls, log warning but continue
          console.warn('Video status polling encountered errors:', error)
        }
      }
    }, 3000) // Poll every 3 seconds

    // Stop polling after 5 minutes
    setTimeout(() => {
      if (isPolling) {
        clearInterval(interval)
        isPolling = false
        // Final check and reload
        loadVideos()
      }
    }, 300000)
  }, [loadVideos, setSuccess, setError])

  const handleUpload = useCallback(async (file: File, uploadResponse?: any) => {
    setError('')
    setSuccess('')

    try {
      // uploadResponse is provided from XMLHttpRequest in FileUpload component
      if (uploadResponse) {
        const contentId = uploadResponse.data?.contentId || uploadResponse.contentId
        
        if (!contentId) {
          setError('Upload response missing content ID')
          return
        }

        setSuccess('Video uploaded! Processing will begin shortly...')
        
        // Reload videos immediately to show the new upload
        await loadVideos()
        
        // Always start polling, socket.io will supplement it if connected
        // Poll until video is ready, then redirect to edit page
        pollVideoStatus(contentId, () => {
          // Redirect to edit page after processing completes
          router.push(`/dashboard/video/edit/${contentId}`)
        })
        
        // Also set up socket listener for this specific video if connected
        if (socket && connected) {
          const handleVideoProcessed = (data: any) => {
            if (data.contentId === contentId) {
              if (data.status === 'completed') {
                setSuccess(`Video processing complete! Redirecting to editor...`)
                // Redirect to edit page after short delay
                setTimeout(() => {
                  router.push(`/dashboard/video/edit/${contentId}`)
                }, 1500)
                // Clean up listener when completed
                off('video-processed', handleVideoProcessed)
              } else if (data.status === 'failed') {
                setError('Video processing failed')
                loadVideos()
                // Clean up listener on failure
                off('video-processed', handleVideoProcessed)
              }
            }
          }
          
          on('video-processed', handleVideoProcessed)
          
          // Clean up listener after 5 minutes as a safety measure
          setTimeout(() => {
            off('video-processed', handleVideoProcessed)
          }, 300000)
        }
      } else {
        // This should not happen when uploadUrl is provided to FileUpload
        // But keep as fallback
        setError('Upload response not received')
      }
    } catch (error: any) {
      setError(error.response?.data?.error || error.message || 'Upload failed')
    }
  }, [socket, connected, on, off, loadVideos, pollVideoStatus, router])

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900">
        <div className="container mx-auto px-4 py-8">
          {loading ? (
            <div className="mb-8">
              <LoadingSkeleton type="card" count={3} />
            </div>
          ) : (
            <>
        {/* Hero Section */}
        <div className="mb-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="gradient-text">Video Processing</span>
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
              Upload long-form videos and get optimized short-form clips with AI-powered editing
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4">
            <ErrorAlert message={error} onClose={() => setError('')} />
            {(error.includes('temporarily unavailable') || error.includes('Server temporarily unavailable')) && (
              <div className="mt-4 text-center">
                <button
                  onClick={handleRetry}
                  disabled={isRetrying || loading}
                  className="btn-modern btn-modern-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRetrying ? 'Retrying...' : 'Try Again'}
                </button>
                {retryCount > 0 && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                    Retry attempt {retryCount}/3
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {success && (
          <div className="mb-4">
            <SuccessAlert message={success} onClose={() => setSuccess('')} />
          </div>
        )}

        <div className="card-modern p-6 md:p-8 mb-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-2 gradient-text">Upload Video</h2>
            <p className="text-slate-600 dark:text-slate-400">
              {uploading ? 'Uploading video...' : 'Drag and drop a video file or click to select'}
            </p>
          </div>
          <FileUpload
            onUpload={handleUpload}
            uploadUrl="/api/video/upload"
            accept={{ 'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.webm'] }}
            maxSize={1073741824}
            disabled={uploading}
          />
          <div className="mt-4 flex justify-center">
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <span>Supports MP4, MOV, AVI, MKV, WebM</span>
              <span>•</span>
              <span>Max 1GB</span>
            </div>
          </div>
        </div>

        <div className="card-modern p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold gradient-text">Your Videos</h2>
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <span>{videos.length} videos</span>
            </div>
          </div>

          {videos.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎥</div>
              <h3 className="text-xl font-semibold mb-2 text-slate-900 dark:text-slate-100">No videos uploaded yet</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                Upload your first video to get started with automatic clip generation
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {videos.map((video) => (
                <div
                  key={video._id}
                  className="card-modern group cursor-pointer animate-fade-in"
                  onClick={() => router.push(`/dashboard/video/edit/${video._id}`)}
                >
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        video.status === 'completed'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : video.status === 'processing'
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                          : video.status === 'failed'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        {video.status}
                      </span>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>

                    <h3 className="font-semibold text-lg mb-2 text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {video.title || 'Untitled Video'}
                    </h3>

                    {video.generatedContent?.shortVideos && (
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 mb-4">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span>{video.generatedContent.shortVideos.length} clips generated</span>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/dashboard/video/edit/${video._id}`)
                        }}
                        className="flex-1 btn-modern btn-modern-primary"
                      >
                        <span>Edit Video</span>
                        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>


        {/* Batch Processing Section */}
        {videos.length > 0 && (
          <div className="mt-8">
            <BatchVideoProcessor
              videos={videos.map(v => ({
                id: v._id,
                name: v.title,
                url: `${v.originalFile?.url || ''}`
              }))}
              onBatchComplete={(results) => {
                const successful = results.filter(r => r.status === 'completed').length
                const failed = results.filter(r => r.status === 'failed').length
                setSuccess(`Batch processing completed: ${successful} successful, ${failed} failed`)
                loadVideos() // Refresh the video list
              }}
            />
          </div>
        )}
            </>
          )}
      </div>
      </div>
    </ErrorBoundary>
  )
}

