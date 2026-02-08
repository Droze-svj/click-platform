'use client'

import { useState } from 'react'
import { Upload, CheckCircle2, XCircle, RefreshCw, Wifi, WifiOff, X } from 'lucide-react'
import { useRealtimeProgress } from '../hooks/useRealtimeProgress'

interface UploadProgressProps {
  uploadId: string
  onComplete?: (result: any) => void
  onError?: (error: any) => void
  onCancel?: () => void
  showCancel?: boolean
}

export default function UploadProgress({
  uploadId,
  onComplete,
  onError,
  onCancel,
  showCancel = true
}: UploadProgressProps) {
  const { progress, isConnected } = useRealtimeProgress({
    uploadId,
    onComplete,
    onError,
  })
  const [isCancelling, setIsCancelling] = useState(false)

  const handleCancel = async () => {
    setIsCancelling(true)
    try {
      const response = await fetch(`/api/upload/progress/${uploadId}/cancel`, {
        method: 'POST',
        credentials: 'include',
      })

      if (response.ok) {
        if (onCancel) {
          onCancel()
        }
      }
    } catch (error) {
      console.error('Failed to cancel upload:', error)
    } finally {
      setIsCancelling(false)
    }
  }

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

  if (!progress) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span>Initializing upload...</span>
      </div>
    )
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
          {progress.status === 'cancelled' && (
            <XCircle className="w-4 h-4 text-gray-600" />
          )}
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {progress.status === 'uploading' ? 'Uploading...' :
              progress.status === 'completed' ? 'Upload Complete' :
                progress.status === 'failed' ? 'Upload Failed' :
                  progress.status === 'cancelled' ? 'Upload Cancelled' :
                    'Processing...'}
          </span>
          {/* Connection Status */}
          <div className="flex items-center gap-1 ml-2" title={isConnected ? 'Real-time updates active' : 'Polling mode'}>
            {isConnected ? (
              <Wifi className="w-3 h-3 text-green-500" aria-hidden />
            ) : (
              <WifiOff className="w-3 h-3 text-gray-400" aria-hidden />
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {Math.round(progress.progress || 0)}%
          </span>
          {showCancel && progress.status === 'uploading' && (
            <button
              onClick={handleCancel}
              disabled={isCancelling}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
              title="Cancel upload"
            >
              <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
          )}
        </div>
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

      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
        <span>
          {formatBytes(progress.bytesUploaded ?? 0)} / {formatBytes(progress.totalBytes ?? 0)}
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






