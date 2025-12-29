'use client'

import { useState } from 'react'
import { Video, Minimize2, Scissors, GitMerge, Music, Image as ImageIcon, FileVideo } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import VideoProgressTracker from './VideoProgressTracker'

interface VideoAdvancedToolsProps {
  videoId?: string
  videoPath?: string
  onProcessed?: (result: any) => void
}

export default function VideoAdvancedTools({ videoId, videoPath, onProcessed }: VideoAdvancedToolsProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const [currentOperation, setCurrentOperation] = useState<string | null>(null)
  const { showToast } = useToast()

  const handleProcess = async (tool: string, options: any = {}) => {
    if (!videoPath && !videoId) {
      showToast('Video is required', 'error')
      return
    }

    setIsProcessing(true)
    setActiveTool(tool)

    try {
      const token = localStorage.getItem('token')
      const formData = new FormData()
      
      // If we have a video path, we'd need to fetch it first
      // For now, assume videoId is used to get the video
      
      let endpoint = ''
      let body: any = {}

      switch (tool) {
        case 'compress':
          endpoint = '/api/video/advanced/compress'
          body = { quality: options.quality || 'medium', format: 'mp4' }
          break
        case 'thumbnail':
          endpoint = '/api/video/advanced/thumbnail'
          body = { time: options.time || '00:00:01', width: 1280, height: 720 }
          break
        case 'metadata':
          endpoint = '/api/video/advanced/metadata'
          break
        case 'convert':
          endpoint = '/api/video/advanced/convert'
          body = { format: options.format || 'mp4' }
          break
        case 'trim':
          endpoint = '/api/video/advanced/trim'
          body = { startTime: options.startTime, duration: options.duration }
          break
        case 'extract-audio':
          endpoint = '/api/video/advanced/extract-audio'
          body = { format: options.format || 'mp3' }
          break
      }

      // Note: In production, you'd need to upload the video file
      // For now, this is a placeholder structure
      setCurrentOperation(tool)
      showToast(`${tool} processing started`, 'info')
      
      if (onProcessed) {
        onProcessed({ tool, status: 'processing' })
      }
    } catch (error) {
      showToast(`Failed to process video: ${tool}`, 'error')
    } finally {
      setIsProcessing(false)
      setActiveTool(null)
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
  ]

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-4">
        Advanced Video Tools
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => handleProcess(tool.id)}
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
            onComplete={(result) => {
              setIsProcessing(false)
              setCurrentOperation(null)
              showToast(`${currentOperation} completed`, 'success')
              if (onProcessed) {
                onProcessed({ tool: currentOperation, status: 'completed', result })
              }
            }}
          />
        </div>
      )}
    </div>
  )
}

