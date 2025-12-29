'use client'

import { useState, useCallback, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, CheckCircle, AlertCircle, FileVideo, Loader2 } from 'lucide-react'
import ProgressBar from './ProgressBar'

interface EnhancedFileUploadProps {
  onUpload: (file: File) => Promise<void>
  accept?: Record<string, string[]>
  maxSize?: number
  disabled?: boolean
  multiple?: boolean
  showPreview?: boolean
  onError?: (error: Error) => void
  onSuccess?: () => void
}

export default function EnhancedFileUpload({
  onUpload,
  accept,
  maxSize = 1073741824,
  disabled = false,
  multiple = false,
  showPreview = true,
  onError,
  onSuccess
}: EnhancedFileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ file: File; status: 'uploading' | 'success' | 'error'; progress: number }>>([])
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const handleUpload = useCallback(async (file: File) => {
    // Validate file size
    if (file.size > maxSize) {
      const errorMsg = `File size exceeds maximum allowed size of ${formatFileSize(maxSize)}`
      setError(errorMsg)
      if (onError) onError(new Error(errorMsg))
      return
    }

    // Add file to upload queue
    const fileEntry = { file, status: 'uploading' as const, progress: 0 }
    setUploadedFiles(prev => [...prev, fileEntry])
    setUploading(true)
    setError(null)
    setProgress(0)

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController()

    let progressInterval: NodeJS.Timeout | null = null
    try {
      // Simulate progress (in real implementation, use XMLHttpRequest for real progress)
      progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            if (progressInterval) clearInterval(progressInterval)
            return 90
          }
          return prev + 5
        })
        setUploadedFiles(prev => 
          prev.map(f => f.file === file ? { ...f, progress: Math.min(f.progress + 5, 90) } : f)
        )
      }, 200)

      await onUpload(file)
      
      if (progressInterval) clearInterval(progressInterval)
      setProgress(100)
      setUploadedFiles(prev => 
        prev.map(f => f.file === file ? { ...f, status: 'success', progress: 100 } : f)
      )
      
      if (onSuccess) onSuccess()
      
      // Clear success state after 3 seconds
      setTimeout(() => {
        setUploadedFiles(prev => prev.filter(f => f.file !== file))
      }, 3000)
    } catch (err: any) {
      if (progressInterval) clearInterval(progressInterval)
      const errorMsg = err.message || 'Upload failed'
      setError(errorMsg)
      setUploadedFiles(prev => 
        prev.map(f => f.file === file ? { ...f, status: 'error', progress: 0 } : f)
      )
      if (onError) onError(err)
    } finally {
      setUploading(false)
      abortControllerRef.current = null
    }
  }, [onUpload, maxSize, onError, onSuccess])

  const onDrop = useCallback(async (acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0]
      if (rejection.errors[0]?.code === 'file-too-large') {
        setError(`File is too large. Maximum size is ${formatFileSize(maxSize)}`)
      } else if (rejection.errors[0]?.code === 'file-invalid-type') {
        setError('File type not supported')
      } else {
        setError(rejection.errors[0]?.message || 'File rejected')
      }
      return
    }

    if (acceptedFiles.length === 0) return

    if (multiple) {
      for (const file of acceptedFiles) {
        await handleUpload(file)
      }
    } else {
      await handleUpload(acceptedFiles[0])
    }
  }, [handleUpload, multiple, maxSize])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize,
    disabled: disabled || uploading,
    multiple
  })

  const removeFile = (file: File) => {
    setUploadedFiles(prev => prev.filter(f => f.file !== file))
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  const retryUpload = (file: File) => {
    handleUpload(file)
  }

  return (
    <div className="w-full space-y-4">
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer 
          transition-all duration-200
          ${isDragActive
            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 scale-[1.02]'
            : 'border-gray-300 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-500'
          }
          ${disabled || uploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}
        `}
      >
        <input {...getInputProps()} />
        <div className="space-y-4">
          <div className="flex justify-center">
            {uploading ? (
              <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
            ) : (
              <Upload className="w-12 h-12 text-gray-400" />
            )}
          </div>
          
          {uploading ? (
            <div className="space-y-2">
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                Uploading...
              </p>
              <ProgressBar 
                progress={progress} 
                showPercentage 
                color="purple"
                size="lg"
              />
            </div>
          ) : (
            <>
              <div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  or <span className="text-purple-600 dark:text-purple-400 font-medium">browse</span> to choose files
                </p>
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500 space-y-1">
                {accept && (
                  <p>Accepted: {Object.values(accept).flat().join(', ')}</p>
                )}
                <p>Max size: {formatFileSize(maxSize)}</p>
                {multiple && <p>Multiple files allowed</p>}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
          <AlertCircle size={18} />
          <span className="text-sm">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Uploaded files list */}
      {showPreview && uploadedFiles.length > 0 && (
        <div className="space-y-2">
          {uploadedFiles.map((fileEntry, index) => (
            <div
              key={index}
              className={`
                flex items-center gap-3 p-3 rounded-lg border
                ${fileEntry.status === 'success' 
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : fileEntry.status === 'error'
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                  : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }
              `}
            >
              <div className="flex-shrink-0">
                {fileEntry.status === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : fileEntry.status === 'error' ? (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                ) : (
                  <FileVideo className="w-5 h-5 text-gray-400" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {fileEntry.file.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatFileSize(fileEntry.file.size)}
                </p>
                {fileEntry.status === 'uploading' && (
                  <ProgressBar 
                    progress={fileEntry.progress} 
                    size="sm"
                    color="purple"
                  />
                )}
              </div>

              <div className="flex items-center gap-2">
                {fileEntry.status === 'error' && (
                  <button
                    onClick={() => retryUpload(fileEntry.file)}
                    className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                  >
                    Retry
                  </button>
                )}
                <button
                  onClick={() => removeFile(fileEntry.file)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  aria-label="Remove file"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}




