'use client'

import { useState, useRef } from 'react'
import { Upload, CheckCircle2, XCircle, Pause, Play } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'

interface ChunkedUploadProps {
  file: File
  onComplete?: (filePath: string) => void
  onError?: (error: string) => void
  chunkSize?: number
}

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024 // 5MB

export default function ChunkedUpload({
  file,
  onComplete,
  onError,
  chunkSize = DEFAULT_CHUNK_SIZE,
}: ChunkedUploadProps) {
  const [uploadId, setUploadId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'paused' | 'completed' | 'failed'>('idle')
  const [uploadedChunks, setUploadedChunks] = useState(0)
  const [totalChunks, setTotalChunks] = useState(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const { showToast } = useToast()

  const totalChunksCount = Math.ceil(file.size / chunkSize)

  const initUpload = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/upload/chunked/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          totalSize: file.size,
          totalChunks: totalChunksCount,
          filename: file.name,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setUploadId(data.data.uploadId)
        setTotalChunks(totalChunksCount)
        return data.data.uploadId
      } else {
        throw new Error('Failed to initialize upload')
      }
    } catch (error: any) {
      showToast('Failed to initialize upload', 'error')
      if (onError) onError(error.message)
      return null
    }
  }

  const uploadChunk = async (chunkNumber: number, chunkData: Blob, uploadId: string) => {
    const formData = new FormData()
    formData.append('chunk', chunkData)
    formData.append('chunkNumber', chunkNumber.toString())

    const token = localStorage.getItem('token')
    const response = await fetch(`/api/upload/chunked/${uploadId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
      body: formData,
      signal: abortControllerRef.current?.signal,
    })

    if (response.ok) {
      const data = await response.json()
      setUploadedChunks(data.data.uploadedChunks)
      setProgress(data.data.progress)
      return true
    } else {
      throw new Error('Failed to upload chunk')
    }
  }

  const assembleChunks = async (uploadId: string) => {
    const token = localStorage.getItem('token')
    const response = await fetch(`/api/upload/chunked/${uploadId}/assemble`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
      body: JSON.stringify({
        outputPath: `/uploads/${file.name}`,
      }),
    })

    if (response.ok) {
      const data = await response.json()
      return data.data.filePath
    } else {
      throw new Error('Failed to assemble chunks')
    }
  }

  const startUpload = async () => {
    if (status === 'uploading') return

    setStatus('uploading')
    abortControllerRef.current = new AbortController()

    try {
      const id = await initUpload()
      if (!id) return

      // Upload chunks sequentially
      for (let i = 0; i < totalChunksCount; i++) {
        if (status === 'paused') {
          break
        }

        const start = i * chunkSize
        const end = Math.min(start + chunkSize, file.size)
        const chunk = file.slice(start, end)

        await uploadChunk(i, chunk, id)
      }

      // Assemble chunks
      if (uploadedChunks === totalChunksCount) {
        const filePath = await assembleChunks(id)
        setStatus('completed')
        showToast('Upload completed', 'success')
        if (onComplete) onComplete(filePath)
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        setStatus('failed')
        showToast('Upload failed', 'error')
        if (onError) onError(error.message)
      }
    }
  }

  const pauseUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setStatus('paused')
  }

  const resumeUpload = () => {
    startUpload()
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Upload className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{file.name}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {formatBytes(file.size)} • {totalChunksCount} chunks
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status === 'idle' && (
            <button
              onClick={startUpload}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Start Upload
            </button>
          )}
          {status === 'uploading' && (
            <button
              onClick={pauseUpload}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors flex items-center gap-2"
            >
              <Pause className="w-4 h-4" />
              Pause
            </button>
          )}
          {status === 'paused' && (
            <button
              onClick={resumeUpload}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Resume
            </button>
          )}
        </div>
      </div>

      {status !== 'idle' && (
        <>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
            <div
              className={`h-2 rounded-full transition-all ${
                status === 'completed'
                  ? 'bg-green-500'
                  : status === 'failed'
                  ? 'bg-red-500'
                  : 'bg-blue-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
            <span>
              Chunk {uploadedChunks} of {totalChunksCount}
            </span>
            <span>{progress}%</span>
          </div>
        </>
      )}
    </div>
  )
}






