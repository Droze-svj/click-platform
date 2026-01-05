'use client'

import { useMemo, useState } from 'react'
import { Video, Minimize2, Scissors, Music, Image as ImageIcon, FileVideo } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import VideoProgressTracker from './VideoProgressTracker'
import { extractApiError } from '../utils/apiResponse'

// Simple logging function for video editing operations
const logVideoEdit = (action: string, data: any) => {
  if (process.env.NEXT_PUBLIC_DEBUG_VIDEO === 'true') {
    console.log(`[VideoEdit] ${action}:`, data)
  }
}

interface VideoAdvancedToolsProps {
  videoId?: string
  videoPath?: string
  // Preferred: pass a URL the backend can download (e.g. "/uploads/clips/xyz.mp4")
  videoUrl?: string
  onProcessed?: (result: any) => void
}

export default function VideoAdvancedTools({ videoId, videoPath, videoUrl, onProcessed }: VideoAdvancedToolsProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const [currentOperation, setCurrentOperation] = useState<string | null>(null)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<any | null>(null)

  // Simple option inputs
  const [trimStart, setTrimStart] = useState('00:00:00')
  const [trimDuration, setTrimDuration] = useState('10')
  const [convertFormat, setConvertFormat] = useState('mp4')
  const [compressQuality, setCompressQuality] = useState<'low' | 'medium' | 'high'>('medium')
  const [exportFormat, setExportFormat] = useState('mp4')
  const [exportQuality, setExportQuality] = useState<'low' | 'medium' | 'high'>('high')
  const { showToast } = useToast()

  const debugEnabled = useMemo(() => process.env.NEXT_PUBLIC_DEBUG_VIDEO === 'true', [])

  const handleProcess = async (tool: string, options: any = {}) => {
    logVideoEdit('process_start', {
      tool,
      hasVideoUrl: !!videoUrl,
      hasVideoPath: !!videoPath,
      videoId,
      options
    })

    if (!videoUrl && !videoPath) {
      logVideoEdit('process_error_no_video', { tool })
      showToast('Video is required', 'error')
      return
    }

    setIsProcessing(true)
    setActiveTool(tool)

    try {
      const token = localStorage.getItem('token')
      logVideoEdit('auth_check', {
        tool,
        hasToken: !!token,
        tokenLength: token?.length || 0
      })

      if (!token) {
        logVideoEdit('process_error_no_auth', { tool })
        showToast('You must be logged in to edit videos', 'error')
        return
      }

      let endpoint = ''

      switch (tool) {
        case 'compress':
          endpoint = '/api/video/advanced/compress'
          break
        case 'thumbnail':
          endpoint = '/api/video/advanced/thumbnail'
          break
        case 'metadata':
          endpoint = '/api/video/advanced/metadata'
          break
        case 'convert':
          endpoint = '/api/video/advanced/convert'
          break
        case 'trim':
          endpoint = '/api/video/advanced/trim'
          break
        case 'extract-audio':
          endpoint = '/api/video/advanced/extract-audio'
          break
        case 'export':
          endpoint = '/api/export'
          break
        default:
          showToast('Unknown tool', 'error')
          return
      }

      setCurrentOperation(tool)
      showToast(`${tool} started`, 'info')

      logVideoEdit('preparing_request', {
        tool,
        endpoint,
        videoId,
        hasVideoUrl: !!videoUrl,
        hasVideoPath: !!videoPath,
        options
      })

      let requestBody;
      let headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      let chosenUrl;

      if (tool === 'export') {
        // Export uses JSON, not FormData
        requestBody = JSON.stringify({
          type: 'video',
          format: options.format || exportFormat,
          quality: options.quality || exportQuality,
          videoId: options.videoId || videoId,
          videoUrl: options.videoUrl || videoUrl || videoPath,
          options: {
            source: 'video_editor',
          }
        });
        headers['Content-Type'] = 'application/json';
      } else {
        // Other operations use FormData for file uploads
        const formData = new FormData()
        if (videoId) formData.append('videoId', videoId)
        chosenUrl = options.videoUrl || videoUrl || videoPath
        if (chosenUrl) formData.append('videoUrl', chosenUrl)

        if (tool === 'trim') {
          formData.append('startTime', options.startTime || trimStart)
          formData.append('duration', options.duration || trimDuration)
        }
        if (tool === 'convert') {
          formData.append('format', options.format || convertFormat)
        }
        if (tool === 'compress') {
          formData.append('quality', options.quality || compressQuality)
          formData.append('format', 'mp4')
        }
        if (tool === 'extract-audio') {
          formData.append('format', options.format || 'mp3')
        }
        requestBody = formData;
      }

      logVideoEdit('making_api_call', {
        tool,
        endpoint,
        hasAuthHeader: true,
        contentType: headers['Content-Type'] || 'multipart/form-data',
        isFormData: requestBody instanceof FormData,
        bodySize: requestBody instanceof FormData ? 'FormData' : JSON.stringify(requestBody).length
      })

      if (debugEnabled) {
        // eslint-disable-next-line no-console
        console.debug('[VideoAdvancedTools] request', { tool, endpoint, videoId, chosenUrl })
      }

      const response = await fetch(endpoint, {
        headers,
      })

      logVideoEdit('api_response_received', {
        tool,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      })

      const json = await response.json().catch(() => null)

      if (!response.ok) {
        logVideoEdit('api_error_response', {
          tool,
          status: response.status,
          error: json?.error || 'Unknown error',
          responseData: json
        })
        throw new Error(json?.error || `Request failed (${response.status})`)
      }

      const data = json?.data || json
      logVideoEdit('api_success_response', {
        tool,
        hasData: !!data,
        dataKeys: data ? Object.keys(data) : []
      })

      // Capture jobId for export operations
      if (tool === 'export' && data?.jobId) {
        setCurrentJobId(data.jobId)
      }

      setLastResult(data)

      if (onProcessed) onProcessed({ tool, status: 'started', data })
    } catch (error: any) {
      logVideoEdit('process_error', {
        tool,
        errorName: error?.name || 'Unknown',
        errorMessage: error?.message || 'Unknown error',
        errorStack: error?.stack?.substring(0, 200) || 'No stack'
      })

      if (debugEnabled) {
        // eslint-disable-next-line no-console
        console.error('[VideoAdvancedTools] error', error)
      }
      const errorObj = extractApiError(error)
      showToast(typeof errorObj === 'string' ? errorObj : errorObj?.message || `Failed to process video: ${tool}`, 'error')
      setIsProcessing(false)
      setActiveTool(null)
      setCurrentOperation(null)
    } finally {
      // Keep processing state while progress tracker polls. We'll reset on completion.
      logVideoEdit('process_finally', { tool, isProcessing: false })
    }
  }

  const tools = [
    {
      id: 'compress',
      name: 'Minimize2 Video',
      icon: <Minimize2 className="w-5 h-5" />,
      description: 'Reduce file size while maintaining quality',
    },
    {
      id: 'thumbnail',
      name: 'Generate Thumbnail',
      icon: <ImageIcon className="w-5 h-5" />,
      description: 'Create video thumbnail',
    },
    {
      id: 'metadata',
      name: 'Get Metadata',
      icon: <FileVideo className="w-5 h-5" />,
      description: 'View video information',
    },
    {
      id: 'convert',
      name: 'Convert Format',
      icon: <Video className="w-5 h-5" />,
      description: 'Change video format',
    },
    {
      id: 'trim',
      name: 'Trim Video',
      icon: <Scissors className="w-5 h-5" />,
      description: 'Cut video segments',
    },
    {
      id: 'extract-audio',
      name: 'Extract Audio',
      icon: <Music className="w-5 h-5" />,
      description: 'Extract audio track',
    },
    {
      id: 'export',
      name: 'Export Video',
      icon: <FileVideo className="w-5 h-5" />,
      description: 'Export processed video',
    },
  ]

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-4">
        Advanced Video Tools
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">Trim</div>
          <div className="flex gap-2">
            <input
              value={trimStart}
              onChange={(e) => setTrimStart(e.target.value)}
              placeholder="00:00:00"
              className="w-1/2 rounded border px-2 py-1 text-sm bg-white dark:bg-gray-900"
            />
            <input
              value={trimDuration}
              onChange={(e) => setTrimDuration(e.target.value)}
              placeholder="10"
              className="w-1/2 rounded border px-2 py-1 text-sm bg-white dark:bg-gray-900"
            />
          </div>
          <div className="text-[11px] text-gray-500 mt-1">startTime (hh:mm:ss), duration (seconds)</div>
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">Convert</div>
          <select
            value={convertFormat}
            onChange={(e) => setConvertFormat(e.target.value)}
            className="w-full rounded border px-2 py-1 text-sm bg-white dark:bg-gray-900"
          >
            <option value="mp4">mp4</option>
            <option value="webm">webm</option>
            <option value="mov">mov</option>
            <option value="avi">avi</option>
          </select>
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">Compress</div>
          <select
            value={compressQuality}
            onChange={(e) => setCompressQuality(e.target.value as any)}
            className="w-full rounded border px-2 py-1 text-sm bg-white dark:bg-gray-900"
          >
            <option value="low">low (smallest)</option>
            <option value="medium">medium</option>
            <option value="high">high (best)</option>
          </select>
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">Export</div>
          <div className="space-y-2">
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              className="w-full rounded border px-2 py-1 text-sm bg-white dark:bg-gray-900"
            >
              <option value="mp4">mp4 (recommended)</option>
              <option value="webm">webm</option>
              <option value="mov">mov</option>
              <option value="avi">avi</option>
            </select>
            <select
              value={exportQuality}
              onChange={(e) => setExportQuality(e.target.value as any)}
              className="w-full rounded border px-2 py-1 text-sm bg-white dark:bg-gray-900"
            >
              <option value="high">High Quality</option>
              <option value="medium">Medium Quality</option>
              <option value="low">Low Quality (small file)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() =>
              handleProcess(tool.id, {
                startTime: trimStart,
                duration: trimDuration,
                format: tool.id === 'export' ? exportFormat : convertFormat,
                quality: tool.id === 'export' ? exportQuality : compressQuality,
                videoUrl: videoUrl || videoPath,
              })
            }
            disabled={isProcessing}
            className={`p-4 rounded-lg border transition-all text-left ${
              activeTool === tool.id
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600'
            } disabled:opacity-50`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="text-purple-600 dark:text-purple-400">{tool.icon}</div>
              <span className="font-medium text-sm text-gray-900 dark:text-white">
                {tool.name}
              </span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {tool.description}
            </p>
          </button>
        ))}
      </div>

      {isProcessing && currentOperation && videoId && (
        <div className="mt-4">
          <VideoProgressTracker
            videoId={videoId}
            operation={currentOperation}
            jobId={currentOperation === 'export' ? (currentJobId ?? undefined) : undefined}
            onComplete={(result) => {
              setIsProcessing(false)
              setCurrentOperation(null)
              setCurrentJobId(null)
              setActiveTool(null)
              setLastResult(result?.result || result)
              if (result?.status === 'failed') {
                showToast(result?.error || `${currentOperation} failed`, 'error')
              } else {
                showToast(`${currentOperation} completed`, 'success')
              }
              if (onProcessed) {
                onProcessed({ tool: currentOperation, status: 'completed', result })
              }
            }}
          />
        </div>
      )}

      {lastResult?.resultUrl && (
        <div className="mt-4 flex items-center justify-between rounded border border-gray-200 dark:border-gray-700 p-3">
          <div className="text-sm text-gray-700 dark:text-gray-200">Latest output</div>
          <a
            className="text-sm font-semibold text-purple-700 dark:text-purple-400 underline"
            href={lastResult.resultUrl}
            target="_blank"
            rel="noreferrer"
          >
            Download / View
          </a>
        </div>
      )}

      {lastResult?.thumbnailUrl && (
        <div className="mt-4 flex items-center justify-between rounded border border-gray-200 dark:border-gray-700 p-3">
          <div className="text-sm text-gray-700 dark:text-gray-200">Latest thumbnail</div>
          <a
            className="text-sm font-semibold text-purple-700 dark:text-purple-400 underline"
            href={lastResult.thumbnailUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open
          </a>
        </div>
      )}
    </div>
  )
}

