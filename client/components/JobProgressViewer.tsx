'use client'

import { useState, useEffect } from 'react'
import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Play,
  Pause,
  RefreshCw,
  Wifi,
  WifiOff
} from 'lucide-react'
import { useRealtimeProgress } from '../hooks/useRealtimeProgress'
import { extractApiData } from '../utils/apiResponse'

interface JobProgress {
  jobId: string
  queue: string
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed'
  progress: number
  returnvalue?: any
  failedReason?: string
  data?: any
  timestamp?: number
  processedOn?: number
  finishedOn?: number
}

interface JobProgressViewerProps {
  jobId: string
  queueName: string
  onComplete?: (job: JobProgress) => void
  onError?: (error: string) => void
  showDetails?: boolean
}

export default function JobProgressViewer({
  jobId,
  queueName,
  onComplete,
  onError,
  showDetails = true
}: JobProgressViewerProps) {
  const [job, setJob] = useState<JobProgress | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { progress: realtimeProgress, isConnected } = useRealtimeProgress({
    jobId,
    queueName,
    onComplete: (data) => {
      if (onComplete && job) {
        onComplete(job)
      }
    },
    onError: (error) => {
      if (onError) {
        onError(error)
      }
    },
  })

  useEffect(() => {
    loadJobProgress()
  }, [jobId, queueName])

  const loadJobProgress = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/jobs/${queueName}/${jobId}/progress`, {
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        const jobData = extractApiData<JobProgress>(data)
        if (jobData) {
          setJob(jobData)
        }
      }
    } catch (error) {
      console.error('Failed to load job progress:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Update job with realtime progress
  useEffect(() => {
    if (realtimeProgress && job) {
      setJob({
        ...job,
        progress: realtimeProgress.progress || job.progress,
        state: realtimeProgress.status === 'completed' ? 'completed' :
               realtimeProgress.status === 'failed' ? 'failed' :
               realtimeProgress.status === 'processing' ? 'active' : job.state,
      })
    }
  }, [realtimeProgress])

  if (isLoading && !job) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading job status...</span>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Job not found
      </div>
    )
  }

  const getStateColor = (state: string) => {
    switch (state) {
      case 'completed':
        return 'text-green-600 dark:text-green-400'
      case 'failed':
        return 'text-red-600 dark:text-red-400'
      case 'active':
        return 'text-blue-600 dark:text-blue-400'
      case 'waiting':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'delayed':
        return 'text-gray-600 dark:text-gray-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  const getStateBg = (state: string) => {
    switch (state) {
      case 'completed':
        return 'bg-green-100 dark:bg-green-900/30'
      case 'failed':
        return 'bg-red-100 dark:bg-red-900/30'
      case 'active':
        return 'bg-blue-100 dark:bg-blue-900/30'
      case 'waiting':
        return 'bg-yellow-100 dark:bg-yellow-900/30'
      case 'delayed':
        return 'bg-gray-100 dark:bg-gray-700/50'
      default:
        return 'bg-gray-100 dark:bg-gray-700/50'
    }
  }

  const getStateIcon = (state: string) => {
    switch (state) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4" />
      case 'failed':
        return <XCircle className="w-4 h-4" />
      case 'active':
        return <Loader2 className="w-4 h-4 animate-spin" />
      case 'waiting':
        return <Clock className="w-4 h-4" />
      case 'delayed':
        return <Pause className="w-4 h-4" />
      default:
        return <AlertCircle className="w-4 h-4" />
    }
  }

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    }
    return `${minutes}m ${seconds % 60}s`
  }

  const getElapsedTime = () => {
    if (!job.timestamp) return null
    const now = Date.now()
    const elapsed = now - job.timestamp
    return formatDuration(elapsed)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded ${getStateBg(job.state)} ${getStateColor(job.state)}`}>
            {getStateIcon(job.state)}
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white capitalize">
              {job.state}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {queueName} • {jobId.slice(0, 8)}...
            </div>
          </div>
          {/* Connection Status */}
          <div className="flex items-center gap-1 ml-2">
            {isConnected ? (
              <Wifi className="w-3 h-3 text-green-500" title="Real-time updates active" />
            ) : (
              <WifiOff className="w-3 h-3 text-gray-400" title="Polling mode" />
            )}
          </div>
        </div>
        <button
          onClick={loadJobProgress}
          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {/* Progress Bar */}
      {job.state === 'active' && (
        <div className="mb-3">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${job.progress || 0}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1 text-xs text-gray-600 dark:text-gray-400">
            <span>{job.progress || 0}%</span>
            {getElapsedTime() && <span>{getElapsedTime()} elapsed</span>}
          </div>
        </div>
      )}

      {/* Details */}
      {showDetails && (
        <div className="space-y-2 text-sm">
          {job.processedOn && (
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Started:</span>
              <span className="text-gray-900 dark:text-white">
                {new Date(job.processedOn).toLocaleTimeString()}
              </span>
            </div>
          )}
          {job.finishedOn && (
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Finished:</span>
              <span className="text-gray-900 dark:text-white">
                {new Date(job.finishedOn).toLocaleTimeString()}
              </span>
            </div>
          )}
          {job.failedReason && (
            <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-600 dark:text-red-400">
              <div className="font-medium mb-1">Error:</div>
              <div>{job.failedReason}</div>
            </div>
          )}
          {job.returnvalue && job.state === 'completed' && (
            <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded text-xs text-green-600 dark:text-green-400">
              <div className="font-medium mb-1">Result:</div>
              <div className="font-mono text-xs">
                {typeof job.returnvalue === 'object'
                  ? JSON.stringify(job.returnvalue, null, 2)
                  : String(job.returnvalue)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
