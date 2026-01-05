'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Pause, SkipBack, SkipForward, Scissors, Download, Eye, EyeOff, RotateCcw, GitCompare } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import VideoAdvancedTools from './VideoAdvancedTools'
import VideoComparison from './VideoComparison'

interface VideoEditorProps {
  videoId?: string
  videoUrl?: string
  videoPath?: string
  onExport?: (result: any) => void
}

interface VideoState {
  duration: number
  currentTime: number
  isPlaying: boolean
  volume: number
  isMuted: boolean
}

export default function VideoEditor({ videoId, videoUrl, videoPath, onExport }: VideoEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const [videoState, setVideoState] = useState<VideoState>({
    duration: 0,
    currentTime: 0,
    isPlaying: false,
    volume: 1,
    isMuted: false,
  })

  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(0)
  const [isDragging, setIsDragging] = useState<'start' | 'end' | 'playhead' | null>(null)
  const [showOriginal, setShowOriginal] = useState(true)
  const [processedVideo, setProcessedVideo] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showComparison, setShowComparison] = useState(false)

  const { showToast } = useToast()

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const updateTime = () => {
      setVideoState(prev => ({
        ...prev,
        currentTime: video.currentTime,
        duration: video.duration || 0,
      }))
      if (trimEnd === 0 && video.duration) {
        setTrimEnd(video.duration)
      }
    }

    const updatePlaying = () => {
      setVideoState(prev => ({ ...prev, isPlaying: !video.paused }))
    }

    video.addEventListener('timeupdate', updateTime)
    video.addEventListener('loadedmetadata', updateTime)
    video.addEventListener('play', updatePlaying)
    video.addEventListener('pause', updatePlaying)

    return () => {
      video.removeEventListener('timeupdate', updateTime)
      video.removeEventListener('loadedmetadata', updateTime)
      video.removeEventListener('play', updatePlaying)
      video.removeEventListener('pause', updatePlaying)
    }
  }, [])

  // Timeline interactions
  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    const timeline = timelineRef.current
    if (!timeline || !videoRef.current) return

    const rect = timeline.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = clickX / rect.width
    const newTime = percentage * videoState.duration

    videoRef.current.currentTime = newTime
    setVideoState(prev => ({ ...prev, currentTime: newTime }))
  }, [videoState.duration])

  const handleTrimHandleMouseDown = useCallback((type: 'start' | 'end') => {
    setIsDragging(type)
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !timelineRef.current || !videoState.duration) return

    const rect = timelineRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const percentage = Math.max(0, Math.min(1, mouseX / rect.width))
    const time = percentage * videoState.duration

    if (isDragging === 'start') {
      setTrimStart(Math.min(time, trimEnd - 1))
    } else if (isDragging === 'end') {
      setTrimEnd(Math.max(time, trimStart + 1))
    }
  }, [isDragging, videoState.duration, trimStart, trimEnd])

  const handleMouseUp = useCallback(() => {
    setIsDragging(null)
  }, [])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // Video controls
  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return

    if (videoState.isPlaying) {
      video.pause()
    } else {
      video.play()
    }
  }

  const seekTo = (time: number) => {
    const video = videoRef.current
    if (!video) return

    video.currentTime = time
    setVideoState(prev => ({ ...prev, currentTime: time }))
  }

  const skip = (seconds: number) => {
    const video = videoRef.current
    if (!video) return

    const newTime = Math.max(0, Math.min(videoState.duration, videoState.currentTime + seconds))
    seekTo(newTime)
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const handleProcessed = (result: any) => {
    if (result?.status === 'completed' && result?.result?.resultUrl) {
      setProcessedVideo(result.result.resultUrl)
      showToast('Video processed successfully!', 'success')
      if (onExport) {
        onExport(result)
      }
    }
  }

  const resetTrim = () => {
    setTrimStart(0)
    setTrimEnd(videoState.duration || 0)
  }

  if (!videoUrl && !videoPath) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No video selected for editing</p>
      </div>
    )
  }

  const videoSrc = videoUrl || videoPath

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Video Editor</h3>

        {/* Video Preview */}
        <div className="relative bg-black rounded-lg overflow-hidden mb-4">
          <video
            ref={videoRef}
            src={videoSrc}
            className="w-full max-h-96 object-contain"
            onLoadedMetadata={() => {
              if (trimEnd === 0 && videoRef.current?.duration) {
                setTrimEnd(videoRef.current.duration)
              }
            }}
          />

          {/* Video Controls */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            <div className="flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => skip(-10)}
                  className="p-1 hover:bg-white/20 rounded"
                  title="Skip backward 10s"
                >
                  <SkipBack className="w-4 h-4" />
                </button>
                <button
                  onClick={togglePlay}
                  className="p-2 bg-white/20 hover:bg-white/30 rounded-full"
                >
                  {videoState.isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => skip(10)}
                  className="p-1 hover:bg-white/20 rounded"
                  title="Skip forward 10s"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>
              <div className="text-sm">
                {formatTime(videoState.currentTime)} / {formatTime(videoState.duration)}
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div
          ref={timelineRef}
          className="relative h-12 bg-gray-200 dark:bg-gray-700 rounded cursor-pointer mb-4"
          onClick={handleTimelineClick}
        >
          {/* Progress bar */}
          <div
            className="absolute top-0 left-0 h-full bg-blue-500 rounded-l"
            style={{ width: `${(videoState.currentTime / videoState.duration) * 100}%` }}
          />

          {/* Trim handles */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-red-500 cursor-ew-resize opacity-75 hover:opacity-100"
            style={{ left: `${(trimStart / videoState.duration) * 100}%` }}
            onMouseDown={(e) => {
              e.stopPropagation()
              handleTrimHandleMouseDown('start')
            }}
            title={`Trim start: ${formatTime(trimStart)}`}
          />
          <div
            className="absolute top-0 bottom-0 w-1 bg-red-500 cursor-ew-resize opacity-75 hover:opacity-100"
            style={{ left: `${(trimEnd / videoState.duration) * 100}%` }}
            onMouseDown={(e) => {
              e.stopPropagation()
              handleTrimHandleMouseDown('end')
            }}
            title={`Trim end: ${formatTime(trimEnd)}`}
          />

          {/* Trim overlay */}
          <div
            className="absolute top-0 bottom-0 bg-red-500/20 border-x border-red-500/50"
            style={{
              left: `${(trimStart / videoState.duration) * 100}%`,
              width: `${((trimEnd - trimStart) / videoState.duration) * 100}%`
            }}
          />
        </div>

        {/* Trim Controls */}
        <div className="flex items-center gap-4 mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded">
          <div className="flex items-center gap-2">
            <Scissors className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Trim:</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={Math.floor(trimStart)}
              onChange={(e) => setTrimStart(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-16 px-2 py-1 text-sm border rounded bg-white dark:bg-gray-800"
              placeholder="Start"
            />
            <span className="text-gray-500">-</span>
            <input
              type="number"
              value={Math.floor(trimEnd)}
              onChange={(e) => setTrimEnd(Math.min(videoState.duration, parseInt(e.target.value) || 0))}
              className="w-16 px-2 py-1 text-sm border rounded bg-white dark:bg-gray-800"
              placeholder="End"
            />
            <button
              onClick={resetTrim}
              className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              title="Reset trim"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Before/After Toggle */}
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => setShowOriginal(!showOriginal)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-sm"
          >
            {showOriginal ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {showOriginal ? 'Show Original' : 'Show Processed'}
          </button>

          {processedVideo && (
            <div className="flex items-center gap-2">
              <div className="text-sm text-green-600 dark:text-green-400">✓ Processed video available</div>
              <button
                onClick={() => setShowComparison(true)}
                className="flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 rounded text-blue-700 dark:text-blue-300 text-sm"
              >
                <GitCompare className="w-4 h-4" />
                Compare
              </button>
              <a
                href={processedVideo}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900 hover:bg-green-200 dark:hover:bg-green-800 rounded text-green-700 dark:text-green-300 text-sm"
              >
                <Download className="w-4 h-4" />
                Download
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Video Processing Tools */}
      <VideoAdvancedTools
        videoId={videoId}
        videoUrl={videoUrl}
        videoPath={videoPath}
        onProcessed={handleProcessed}
      />

      {/* Video Comparison Modal */}
      {showComparison && processedVideo && (
        <VideoComparison
          originalVideo={videoSrc}
          processedVideo={processedVideo}
          onClose={() => setShowComparison(false)}
        />
      )}
    </div>
  )
}
