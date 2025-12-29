'use client'

import { useState, useEffect } from 'react'
import { Upload, CheckCircle2, XCircle, RefreshCw } from 'lucide-react'

interface UploadProgressProps {
  uploadId: string
  onComplete?: (result: any) => void
  onError?: (error: any) => void
}

export default function UploadProgress({ uploadId, onComplete, onError }: UploadProgressProps) {
  const [progress, setProgress] = useState<any>(null)
  const [isPolling, setIsPolling] = useState(true)

  useEffect(() => {
    if (!isPolling || !uploadId) return

    const pollProgress = async () => {
      try {
        const token = localStorage.getItem('token')
        const response = await fetch(`/api/upload/progress/${uploadId}`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        })

        if (response.ok) {
          const data = await response.json()
          if (data.data) {
            setProgress(data.data)

            if (data.data.status === 'completed') {
              setIsPolling(false)
              if (onComplete) {
                onComplete(data.data)
              }
            } else if (data.data.status === 'failed') {
              setIsPolling(false)
              if (onError) {
                onError(data.data.error)
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch upload progress:', error)
      }
    }

    pollProgress()
    const interval = setInterval(pollProgress, 1000) // Poll every second

    return () => clearInterval(interval)
  }, [uploadId, isPolling, onComplete, onError])

  if (!progress) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span>Initializing upload...</span>
      </div>
    )
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
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
          {progress.status === 'uploading' && (
            <Upload className="w-4 h-4 animate-bounce text-blue-600" />
          )}
          {progress.status === 'completed' && (
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          )}
          {progress.status === 'failed' && (
            <XCircle className="w-4 h-4 text-red-600" />
          )}
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {progress.status === 'uploading' ? 'Uploading...' :
             progress.status === 'completed' ? 'Upload Complete' :
             'Upload Failed'}
          </span>
        </div>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {Math.round(progress.progress)}%
        </span>
      </div>

      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
        <div
          className={`h-2 rounded-full transition-all ${
            progress.status === 'completed'
              ? 'bg-green-500'
              : progress.status === 'failed'
              ? 'bg-red-500'
              : 'bg-blue-500'
          }`}
          style={{ width: `${progress.progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
        <span>
          {formatBytes(progress.bytesUploaded)} / {formatBytes(progress.totalBytes)}
        </span>
        {progress.estimatedTimeRemaining && progress.status === 'uploading' && (
          <span>~{formatTime(progress.estimatedTimeRemaining)} remaining</span>
        )}
      </div>

      {progress.error && (
        <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-600 dark:text-red-400">
          {progress.error}
        </div>
      )}
    </div>
  )
}






