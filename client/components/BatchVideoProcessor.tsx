'use client'

import { useState } from 'react'
import { Play, Pause, CheckCircle, XCircle, Clock, Trash2 } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { useTranslation } from '@/hooks/useTranslation'

interface BatchJob {
  id: string
  videoId: string
  videoName: string
  operation: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  resultUrl?: string
  error?: string
}

interface BatchVideoProcessorProps {
  videos: Array<{
    id: string
    name: string
    url: string
  }>
  onBatchComplete?: (results: BatchJob[]) => void
}

export default function BatchVideoProcessor({ videos, onBatchComplete }: BatchVideoProcessorProps) {
  const [jobs, setJobs] = useState<BatchJob[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedOperation, setSelectedOperation] = useState('compress')
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set())

  const { showToast } = useToast()
  const { t } = useTranslation()

  const operations = [
    { id: 'compress', name: t('batchVideoProcessor.opCompressName'), description: t('batchVideoProcessor.opCompressDesc') },
    { id: 'convert', name: t('batchVideoProcessor.opConvertName'), description: t('batchVideoProcessor.opConvertDesc') },
    { id: 'thumbnail', name: t('batchVideoProcessor.opThumbnailName'), description: t('batchVideoProcessor.opThumbnailDesc') },
    { id: 'extract-audio', name: t('batchVideoProcessor.opExtractAudioName'), description: t('batchVideoProcessor.opExtractAudioDesc') },
  ]

  const addBatchJob = () => {
    if (selectedVideos.size === 0) {
      showToast(t('batchVideoProcessor.selectAtLeastOne'), 'error')
      return
    }

    const newJobs: BatchJob[] = Array.from(selectedVideos).map(videoId => {
      const video = videos.find(v => v.id === videoId)
      return {
        id: `${videoId}-${Date.now()}-${Math.random()}`,
        videoId,
        videoName: video?.name || t('batchVideoProcessor.videoFallbackName', { videoId }),
        operation: selectedOperation,
        status: 'pending' as const,
        progress: 0,
      }
    })

    setJobs(prev => [...prev, ...newJobs])
    setSelectedVideos(new Set())
  }

  const removeJob = (jobId: string) => {
    setJobs(prev => prev.filter(job => job.id !== jobId))
  }

  const startBatchProcessing = async () => {
    if (jobs.length === 0) {
      showToast(t('batchVideoProcessor.noJobsToProcess'), 'error')
      return
    }

    setIsProcessing(true)
    const token = localStorage.getItem('token')

    if (!token) {
      showToast(t('batchVideoProcessor.authRequired'), 'error')
      setIsProcessing(false)
      return
    }

    // Process jobs sequentially to avoid overwhelming the server
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i]

      // Update job status to processing
      setJobs(prev => prev.map(j =>
        j.id === job.id ? { ...j, status: 'processing' as const, progress: 10 } : j
      ))

      try {
        const video = videos.find(v => v.id === job.videoId)
        if (!video) continue

        let endpoint = ''
        switch (job.operation) {
          case 'compress':
            endpoint = '/api/video/advanced/compress'
            break
          case 'convert':
            endpoint = '/api/video/advanced/convert'
            break
          case 'thumbnail':
            endpoint = '/api/video/advanced/thumbnail'
            break
          case 'extract-audio':
            endpoint = '/api/video/advanced/extract-audio'
            break
          default:
            continue
        }

        const formData = new FormData()
        formData.append('videoId', job.videoId)
        formData.append('videoUrl', video.url)

        // Add operation-specific parameters
        if (job.operation === 'convert') {
          formData.append('format', 'mp4')
        }

        // Update progress
        setJobs(prev => prev.map(j =>
          j.id === job.id ? { ...j, progress: 30 } : j
        ))

        const response = await fetch(endpoint, {
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const result = await response.json()

        // Update job as completed
        setJobs(prev => prev.map(j =>
          j.id === job.id ? {
            ...j,
            status: 'completed' as const,
            progress: 100,
            resultUrl: result.resultUrl || result.url
          } : j
        ))

      } catch (error: any) {
        // Update job as failed
        setJobs(prev => prev.map(j =>
          j.id === job.id ? {
            ...j,
            status: 'failed' as const,
            progress: 100,
            error: error.message
          } : j
        ))
      }
    }

    setIsProcessing(false)
    showToast(t('batchVideoProcessor.batchCompleted', { successful: jobs.filter(j => j.status === 'completed').length, failed: jobs.filter(j => j.status === 'failed').length }), 'success')

    if (onBatchComplete) {
      onBatchComplete(jobs)
    }
  }

  const clearCompletedJobs = () => {
    setJobs(prev => prev.filter(job => job.status !== 'completed'))
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-gray-400" />
      case 'processing':
        return <Play className="w-4 h-4 text-blue-500" />
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-gray-600'
      case 'processing':
        return 'text-blue-600'
      case 'completed':
        return 'text-green-600'
      case 'failed':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-[var(--text-main)]">{t('batchVideoProcessor.title')}</h3>

        {/* Operation Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('batchVideoProcessor.selectOperation')}
          </label>
          <select
            value={selectedOperation}
            onChange={(e) => setSelectedOperation(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {operations.map(op => (
              <option key={op.id} value={op.id}>
                {op.name} - {op.description}
              </option>
            ))}
          </select>
        </div>

        {/* Video Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('batchVideoProcessor.selectVideos', { count: selectedVideos.size })}
          </label>
          <div className="max-h-40 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-md">
            {videos.map(video => (
              <label key={video.id} className="flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedVideos.has(video.id)}
                  onChange={(e) => {
                    const newSelected = new Set(selectedVideos)
                    if (e.target.checked) {
                      newSelected.add(video.id)
                    } else {
                      newSelected.delete(video.id)
                    }
                    setSelectedVideos(newSelected)
                  }}
                  className="mr-3"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                  {video.name}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={addBatchJob}
            disabled={selectedVideos.size === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('batchVideoProcessor.addToQueue')}
          </button>

          <button
            type="button"
            onClick={startBatchProcessing}
            disabled={jobs.length === 0 || isProcessing}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? t('batchVideoProcessor.processing') : t('batchVideoProcessor.startBatch')}
          </button>

          {jobs.some(job => job.status === 'completed') && (
            <button
              type="button"
              onClick={clearCompletedJobs}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              {t('batchVideoProcessor.clearCompleted')}
            </button>
          )}
        </div>
      </div>

      {/* Job Queue */}
      {jobs.length > 0 && (
        <div>
          <h4 className="text-md font-medium mb-3 text-gray-900 dark:text-[var(--text-main)]">
            {t('batchVideoProcessor.processingQueue', { count: jobs.length })}
          </h4>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {jobs.map(job => (
              <div
                key={job.id}
                className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {getStatusIcon(job.status)}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {job.videoName}
                    </div>
                    <div className={`text-xs ${getStatusColor(job.status)}`}>
                      {job.operation} - {job.status}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {job.status === 'processing' && (
                    <div className="w-20 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                  )}

                  {job.resultUrl && (
                    <a
                      href={job.resultUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      {t('batchVideoProcessor.download')}
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => removeJob(job.id)}
                    className="text-gray-400 hover:text-red-500"
                    title={t('batchVideoProcessor.removeJob')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}













