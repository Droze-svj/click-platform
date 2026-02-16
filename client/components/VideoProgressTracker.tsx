'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react'

interface Progress {
  videoId: string
  operation: string
  progress: number
  status: 'processing' | 'completed' | 'failed'
  message?: string
  estimatedTimeRemaining?: number
}

interface VideoProgressTrackerProps {
  videoId: string
  operation?: string
  jobId?: string // For export operations
  onComplete?: (result: any) => void
}

export default function VideoProgressTracker({ videoId, operation, jobId, onComplete }: VideoProgressTrackerProps) {
  const [progress, setProgress] = useState<Progress | null>(null)
  const [isPolling, setIsPolling] = useState(true)
  const [failures, setFailures] = useState(0)

  useEffect(() => {
    if (!isPolling) return

    const pollProgress = async () => {
      try {
        const token = localStorage.getItem('token')

        // Use different endpoints based on operation type
        let endpoint: string;
        if (operation === 'export' && jobId) {
          // Export operations use the export job status endpoint
          endpoint = `/api/export/${jobId}`;
        } else {
          // Video operations use the video progress endpoint
          endpoint = operation
            ? `/api/video/progress/${videoId}?operation=${operation}`
            : `/api/video/progress/${videoId}`;
        }

        const response = await fetch(endpoint, {
          credentials: 'include',
        })

        if (!response.ok) {
          setFailures((n) => n + 1)
          return
        }

        const data = await response.json()
        if (data?.data) {
          setFailures(0)
          setProgress(data.data)

          if (data.data.status === 'completed' || data.data.status === 'failed') {
            setIsPolling(false)
            if (onComplete) {
              onComplete(data.data)
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch progress:', error)
        setFailures((n) => n + 1)
      }
    }

    pollProgress()
    const interval = setInterval(pollProgress, 2000) // Poll every 2 seconds

    return () => clearInterval(interval)
  }, [videoId, operation, jobId, isPolling, onComplete])

  useEffect(() => {
    // Stop polling after repeated failures (backend down, auth expired, etc.)
    if (failures >= 5) {
      setIsPolling(false)
      setProgress({
        videoId,
        operation: operation || 'processing',
        progress: 0,
        status: 'failed',
      })
    }
  }, [failures, videoId, operation])

  if (!progress) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span>Initializing...</span>
      </div>
    )
  }

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    return `${minutes}m ${seconds % 60}s`
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {progress.status === 'processing' && (
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
          )}
          {progress.status === 'completed' && (
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          )}
          {progress.status === 'failed' && (
            <XCircle className="w-4 h-4 text-red-600" />
          )}
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {progress.operation}
          </span>
        </div>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {Math.round(progress.progress)}%
        </span>
      </div>

      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
        <div
          className={`h-2 rounded-full transition-all ${progress.status === 'completed'
              ? 'bg-green-500'
              : progress.status === 'failed'
                ? 'bg-red-500'
                : 'bg-blue-500'
            }`}
          style={{ width: `${progress.progress}%` }}
        />
      </div>

      {progress.message && (
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
          {progress.message}
        </p>
      )}

      {progress.estimatedTimeRemaining && progress.status === 'processing' && (
        <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
          <Clock className="w-3 h-3" />
          <span>~{formatTime(progress.estimatedTimeRemaining)} remaining</span>
        </div>
      )}
    </div>
  )
}






