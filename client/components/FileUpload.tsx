'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { useAuth } from '../hooks/useAuth'
import { sendDebugLog } from '../utils/debugLog'

interface FileUploadProps {
  onUpload: (file: File, uploadResponse?: any) => void | Promise<void>
  accept?: Record<string, string[]>
  maxSize?: number
  disabled?: boolean
  uploadUrl?: string
  onProgress?: (progress: number) => void
}

export default function FileUpload({
  onUpload,
  accept,
  maxSize = 1073741824,
  disabled,
  uploadUrl,
  onProgress
}: FileUploadProps) {
  const { user } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const xhrRef = useRef<XMLHttpRequest | null>(null)

  const uploadWithProgress = useCallback((file: File, url: string): Promise<any> => {
    console.log('FileUpload: Upload started', { userExists: !!user, userId: user?.id })
    sendDebugLog('FileUpload', 'upload_started', {
      userExists: !!user,
      userId: user?.id,
      userEmail: user?.email,
      tokenExists: !!localStorage.getItem('token'),
      sessionId: 'debug-session',
      runId: 'debug-userid',
    })

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhrRef.current = xhr

      const token = localStorage.getItem('token')
      const formData = new FormData()
      formData.append('video', file)
      formData.append('title', file.name)

      console.log('FileUpload: FormData created', { userIdValue: user?.id })
      sendDebugLog('FileUpload', 'formdata_created', { userIdValue: user?.id, userExists: !!user, sessionId: 'debug-session', runId: 'debug-userid' })

      // Add userId - required field for backend validation
      if (user?.id) {
        sendDebugLog('FileUpload', 'using_user_id', { userId: user.id, sessionId: 'debug-session', runId: 'debug-userid' })
        formData.append('userId', user.id)
      } else {
        sendDebugLog('FileUpload', 'user_id_fallback', {
          storedUserId: localStorage.getItem('userId'),
          willUseMock: true,
          sessionId: 'debug-session',
          runId: 'debug-userid',
        })

        // Fallback to localStorage userId if user object not loaded yet
        const storedUserId = localStorage.getItem('userId')
        if (storedUserId) {
          formData.append('userId', storedUserId)
        } else {
          // Use development mock user ID as last resort
          console.warn('No userId available, using dev mock ID')
          formData.append('userId', 'dev-user-123')
        }
      }

      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100)
          setProgress(percentComplete)
          if (onProgress) {
            onProgress(percentComplete)
          }
        }
      })

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText)
            resolve(response)
          } catch (e) {
            resolve(xhr.responseText)
          }
        } else {
          try {
            const errBody = JSON.parse(xhr.responseText)
            // Detect disk-full (507) specifically
            if (xhr.status === 507 || errBody.code === 'DISK_FULL') {
              reject(new Error('💾 The server has no storage space left. Please clear old uploads or contact support.'))
            } else if (xhr.status === 413) {
              reject(new Error('📦 File is too large. Maximum size is 1GB.'))
            } else if (xhr.status === 415) {
              reject(new Error('🎬 Only video files are supported (MP4, MOV, AVI, MKV, WEBM).'))
            } else {
              reject(new Error(errBody.error || errBody.message || 'Upload failed'))
            }
          } catch (e) {
            reject(new Error(`Upload failed with status ${xhr.status}`))
          }
        }
        xhrRef.current = null
      })

      // Handle errors
      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'))
        xhrRef.current = null
      })

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload cancelled'))
        xhrRef.current = null
      })

      // Start upload
      xhr.open('POST', url)
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      }
      xhr.send(formData)
    })
  }, [onProgress, user?.id])

  // Cancel upload function
  const cancelUpload = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort()
      xhrRef.current = null
      setUploading(false)
      setProgress(0)
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (xhrRef.current) {
        xhrRef.current.abort()
        xhrRef.current = null
      }
    }
  }, [])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return

    const file = acceptedFiles[0]
    setUploading(true)
    setProgress(0)
    setUploadError(null)

    try {
      // If uploadUrl is provided, use XMLHttpRequest for real progress tracking
      if (uploadUrl) {
        const uploadResponse = await uploadWithProgress(file, uploadUrl)
        // Pass the upload response to the callback for additional handling
        await onUpload(file, uploadResponse)
      } else {
        // Fallback to callback-based upload (progress will be simulated)
        // For real progress, provide uploadUrl prop
        await onUpload(file)
        setProgress(100)
      }
    } catch (error: any) {
      console.error('Upload error:', error)
      setProgress(0)
      setUploadError(error?.message || 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
      setTimeout(() => setProgress(0), 2000)
    }
  }, [onUpload, uploadUrl, uploadWithProgress])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize,
    disabled: disabled || uploading,
    multiple: false
  })

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive
          ? 'border-purple-500 bg-purple-50'
          : 'border-gray-300 hover:border-purple-400'
          } ${disabled || uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
        role="button"
        aria-label="File upload area"
        aria-disabled={disabled || uploading}
        tabIndex={disabled || uploading ? -1 : 0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled && !uploading) {
            e.preventDefault()
            e.currentTarget.click()
          }
        }}
      >
        <input {...getInputProps()} aria-label="File input" />
        <div className="space-y-4">
          <div className="text-4xl">📁</div>
          {uploading ? (
            <>
              <p className="text-lg font-semibold">Uploading...</p>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-purple-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600">{progress}%</p>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold">
                {isDragActive ? 'Drop the file here' : 'Drag & drop a file here, or click to select'}
              </p>
              <p className="text-sm text-gray-500">
                {accept ? Object.values(accept).flat().join(', ') : 'Any file'} (max {Math.round(maxSize / 1024 / 1024)}MB)
              </p>
            </>
          )}
        </div>
      </div>

      {/* Upload error display */}
      {uploadError && (
        <div className="mt-3 flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          <span className="shrink-0 text-base">⚠️</span>
          <div>
            <p className="font-semibold">Upload Failed</p>
            <p className="text-red-300 text-xs mt-0.5">{uploadError}</p>
            <button
              onClick={() => setUploadError(null)}
              className="text-xs text-red-400 underline mt-1 hover:text-red-300"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  )
}







