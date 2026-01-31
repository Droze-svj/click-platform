'use client'

import { useEffect, useState, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

interface ProgressData {
  progress: number
  status: 'uploading' | 'processing' | 'completed' | 'failed' | 'cancelled'
  bytesUploaded?: number
  totalBytes?: number
  estimatedTimeRemaining?: number
  bytesPerSecond?: number
  error?: string
  [key: string]: any
}

interface UseRealtimeProgressOptions {
  uploadId?: string
  jobId?: string
  queueName?: string
  onComplete?: (data: ProgressData) => void
  onError?: (error: string) => void
  onProgress?: (data: ProgressData) => void
}

export function useRealtimeProgress({
  uploadId,
  jobId,
  queueName,
  onComplete,
  onError,
  onProgress,
}: UseRealtimeProgressOptions) {
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    // Initialize Socket.io connection
    const socket = io(process.env.NEXT_PUBLIC_API_URL || '', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setIsConnected(true)
      console.log('Socket connected')

      // Subscribe to upload progress if uploadId provided
      if (uploadId) {
        socket.emit('subscribe:upload', { uploadId })
      }

      // Subscribe to job progress if jobId and queueName provided
      if (jobId && queueName) {
        socket.emit('subscribe:job', { jobId, queueName })
      }
    })

    socket.on('disconnect', () => {
      setIsConnected(false)
      console.log('Socket disconnected')
    })

    // Listen for upload progress updates
    if (uploadId) {
      socket.on(`upload:progress:${uploadId}`, (data: ProgressData) => {
        setProgress(data)
        if (onProgress) {
          onProgress(data)
        }

        if (data.status === 'completed' && onComplete) {
          onComplete(data)
        } else if (data.status === 'failed' && onError) {
          onError(data.error || 'Upload failed')
        }
      })
    }

    // Listen for job progress updates
    if (jobId && queueName) {
      socket.on(`job:progress:${queueName}:${jobId}`, (data: ProgressData) => {
        setProgress(data)
        if (onProgress) {
          onProgress(data)
        }

        if (data.status === 'completed' && onComplete) {
          onComplete(data)
        } else if (data.status === 'failed' && onError) {
          onError(data.error || 'Job failed')
        }
      })
    }

    return () => {
      if (uploadId) {
        socket.emit('unsubscribe:upload', { uploadId })
      }
      if (jobId && queueName) {
        socket.emit('unsubscribe:job', { jobId, queueName })
      }
      socket.disconnect()
    }
  }, [uploadId, jobId, queueName, onComplete, onError, onProgress])

  // Fallback to polling if WebSocket not available
  useEffect(() => {
    if (!isConnected && (uploadId || (jobId && queueName))) {
      const pollInterval = setInterval(async () => {
        try {
          if (uploadId) {
            const response = await fetch(`/api/upload/progress/${uploadId}`, {
              credentials: 'include',
            })
            if (response.ok) {
              const data = await response.json()
              if (data.data) {
                setProgress(data.data)
                if (data.data.status === 'completed' && onComplete) {
                  onComplete(data.data)
                } else if (data.data.status === 'failed' && onError) {
                  onError(data.data.error || 'Upload failed')
                }
              }
            }
          } else if (jobId && queueName) {
            const response = await fetch(`/api/jobs/${queueName}/${jobId}/progress`, {
              credentials: 'include',
            })
            if (response.ok) {
              const data = await response.json()
              if (data.data) {
                setProgress(data.data)
                if (data.data.state === 'completed' && onComplete) {
                  onComplete(data.data)
                } else if (data.data.state === 'failed' && onError) {
                  onError(data.data.failedReason || 'Job failed')
                }
              }
            }
          }
        } catch (error) {
          console.error('Failed to poll progress:', error)
        }
      }, 1000) // Poll every second

      return () => clearInterval(pollInterval)
    }
  }, [isConnected, uploadId, jobId, queueName, onComplete, onError])

  return {
    progress,
    isConnected,
    socket: socketRef.current,
  }
}
