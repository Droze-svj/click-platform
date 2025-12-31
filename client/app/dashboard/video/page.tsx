'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import FileUpload from '../../../components/FileUpload'
import LoadingSpinner from '../../../components/LoadingSpinner'
import LoadingSkeleton from '../../../components/LoadingSkeleton'
import ErrorAlert from '../../../components/ErrorAlert'
import SuccessAlert from '../../../components/SuccessAlert'
import EmptyState from '../../../components/EmptyState'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { extractApiData, extractApiError } from '../../../utils/apiResponse'
import { useSocket } from '../../../hooks/useSocket'
import { useAuth } from '../../../hooks/useAuth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'

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
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null)

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }
    loadVideos()
  }, [user, loadVideos])

  // Listen for real-time video processing updates
  useEffect(() => {
    if (!socket || !connected) return

    const handleVideoProcessed = (data: any) => {
      if (data.status === 'completed') {
        setSuccess(`Video processing complete! ${data.clips} clips generated.`)
        loadVideos()
      } else if (data.status === 'failed') {
        setError('Video processing failed')
        loadVideos()
      }
    }

    on('video-processed', handleVideoProcessed)

    return () => {
      off('video-processed', handleVideoProcessed)
    }
  }, [socket, connected, on, off])


  const loadVideos = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/video`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const videos = extractApiData<Video[]>(response) || []
      setVideos(Array.isArray(videos) ? videos : [])
    } catch (error: any) {
      setError(extractApiError(error) || 'Failed to load videos')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleUpload = async (file: File, uploadResponse?: any) => {
    setError('')
    setSuccess('')

    try {
      // uploadResponse is provided from XMLHttpRequest in FileUpload component
      if (uploadResponse) {
        setSuccess('Video uploaded! Processing will begin shortly.')
        await loadVideos()
        
        // Real-time updates via Socket.io, fallback to polling if not connected
        const contentId = uploadResponse.data?.contentId || uploadResponse.contentId
        if (contentId && !connected) {
          pollVideoStatus(contentId)
        }
      } else {
        // This should not happen when uploadUrl is provided to FileUpload
        // But keep as fallback
        setError('Upload response not received')
      }
    } catch (error: any) {
      setError(error.response?.data?.error || error.message || 'Upload failed')
    }
  }

  const pollVideoStatus = async (contentId: string) => {
    const token = localStorage.getItem('token')
    const interval = setInterval(async () => {
      try {
        const response = await axios.get(`${API_URL}/video/${contentId}/status`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        
        if (response.data.status === 'completed') {
          clearInterval(interval)
          setSuccess('Video processing complete!')
          await loadVideos()
        } else if (response.data.status === 'failed') {
          clearInterval(interval)
          setError('Video processing failed')
          clearInterval(interval)
        }
      } catch (error) {
        clearInterval(interval)
      }
    }, 3000) // Poll every 3 seconds

    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(interval), 300000)
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          {loading ? (
            <div className="mb-8">
              <LoadingSkeleton type="card" count={3} />
            </div>
          ) : (
            <>
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Video Upload & Processing</h1>
          <p className="text-sm md:text-base text-gray-600">Upload long-form videos and get optimized short-form clips</p>
        </div>

        {error && (
          <div className="mb-4">
            <ErrorAlert message={error} onClose={() => setError('')} />
          </div>
        )}

        {success && (
          <div className="mb-4">
            <SuccessAlert message={success} onClose={() => setSuccess('')} />
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-4 md:p-6 mb-6 md:mb-8">
          <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">Upload Video</h2>
          <FileUpload
            onUpload={handleUpload}
            uploadUrl={`${API_URL}/video/upload`}
            accept={{ 'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.webm'] }}
            maxSize={1073741824}
            disabled={uploading}
          />
          <p className="mt-2 text-sm text-gray-500" aria-live="polite" aria-atomic="true">
            {uploading ? 'Uploading video...' : 'Drag and drop a video file or click to select'}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-4 md:p-6">
          <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">Your Videos</h2>
          {videos.length === 0 ? (
            <EmptyState
              title="No videos uploaded yet"
              description="Upload your first video to get started with automatic clip generation"
              icon="🎥"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {videos.map((video) => (
                <div
                  key={video._id}
                  className="border rounded-lg p-4 hover:shadow-lg transition cursor-pointer"
                  onClick={() => setSelectedVideo(video)}
                >
                  <div className="mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      video.status === 'completed' ? 'bg-green-100 text-green-800' :
                      video.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                      video.status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {video.status}
                    </span>
                  </div>
                  <h3 className="font-semibold mb-2">{video.title || 'Untitled'}</h3>
                  {video.generatedContent?.shortVideos && (
                    <p className="text-sm text-gray-600">
                      {video.generatedContent.shortVideos.length} clips generated
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedVideo && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-4 md:p-6">
              <div className="flex justify-between items-center mb-3 md:mb-4">
                <h2 className="text-xl md:text-2xl font-bold pr-2">{selectedVideo.title}</h2>
                <button
                  onClick={() => setSelectedVideo(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl md:text-3xl touch-target flex-shrink-0"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              
              {selectedVideo.generatedContent?.shortVideos && selectedVideo.generatedContent.shortVideos.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedVideo.generatedContent.shortVideos.map((clip, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <video
                        src={`${API_URL.replace('/api', '')}${clip.url}`}
                        controls
                        className="w-full rounded mb-2"
                      />
                      <p className="text-sm font-semibold mb-1">{clip.caption}</p>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{clip.platform}</span>
                        <span>{Math.round(clip.duration)}s</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  {selectedVideo.status === 'processing' ? (
                    <>
                      <LoadingSpinner size="lg" text="Processing video..." />
                      <p className="mt-4">This may take a few minutes</p>
                    </>
                  ) : (
                    <p>No clips generated yet</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
            </>
          )}
      </div>
      </div>
    </ErrorBoundary>
  )
}

