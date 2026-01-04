'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../../../../../hooks/useAuth'
import { DynamicModernVideoEditor } from '../../../../../components/DynamicImports'
import LoadingSpinner from '../../../../../components/LoadingSpinner'
import ErrorAlert from '../../../../../components/ErrorAlert'
import { apiGet } from '../../../../../lib/api'
import { ErrorBoundary } from '../../../../../components/ErrorBoundary'

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

export default function VideoEditPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [video, setVideo] = useState<Video | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const videoId = params.videoId as string

  const loadVideo = useCallback(async () => {
    try {
      const response = await apiGet<any>(`/video/${videoId}`)
      const videoData = response?.data || response
      setVideo(videoData)
    } catch (error: any) {
      setError(error.response?.data?.error || error.message || 'Failed to load video')
    } finally {
      setLoading(false)
    }
  }, [videoId])

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }
    loadVideo()
  }, [user, loadVideo])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-slate-900 dark:to-indigo-900 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading video editor..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-slate-900 dark:to-indigo-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <ErrorAlert message={error} onClose={() => router.back()} />
          <button
            onClick={() => router.back()}
            className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-slate-900 dark:to-indigo-900 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Video Not Found</h1>
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

  // Use the first generated clip if available, otherwise use the original video
  const videoUrl = video.generatedContent?.shortVideos?.[0]?.url || video.originalFile?.url

  if (!videoUrl) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-slate-900 dark:to-indigo-900 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">No Video Available</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">This video doesn't have any playable content yet.</p>
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
    <ErrorBoundary>
      <div className="relative">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="fixed top-4 left-4 z-50 p-3 bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          aria-label="Go back"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>

        {/* Video Editor */}
        <DynamicModernVideoEditor
          videoId={videoId}
          videoUrl={videoUrl}
          onExport={(result) => {
            if (result?.status === 'completed') {
              // Could show a success message or redirect
              console.log('Video export completed:', result)
            }
          }}
        />
      </div>
    </ErrorBoundary>
  )
}
