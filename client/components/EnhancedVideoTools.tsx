'use client'

import { useState, useMemo } from 'react'
import {
  Video,
  Minimize2,
  Scissors,
  Music,
  Image as ImageIcon,
  FileVideo,
  Type,
  Palette,
  Volume2,
  Zap,
  Crop,
  Split,
  Merge,
  Wand2,
  Filter,
  Sliders,
  Eye,
  Mic,
  Speaker,
  Download
} from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import VideoProgressTracker from './VideoProgressTracker'
import { extractApiError } from '../utils/apiResponse'
import { useTranslation } from '@/hooks/useTranslation'

interface TextOverlay {
  id: string
  text: string
  x: number
  y: number
  fontSize: number
  color: string
  fontFamily: string
  startTime: number
  endTime: number
}

interface VideoFilter {
  brightness: number
  contrast: number
  saturation: number
  hue: number
  blur: number
  sepia: number
  vignette: number
  sharpen: number
  noise: number
}

interface VideoSegment {
  start: number
  end: number
  id: string
}

interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

interface EnhancedVideoToolsProps {
  videoId?: string
  videoPath?: string
  videoUrl?: string
  textOverlays: TextOverlay[]
  videoFilters: VideoFilter
  videoSegments: VideoSegment[]
  trimStart: number
  trimEnd: number
  playbackSpeed: number
  cropArea: CropArea
  onProcessed?: (result: any) => void
}

export default function EnhancedVideoTools({
  videoId,
  videoPath,
  videoUrl,
  textOverlays,
  videoFilters,
  videoSegments,
  trimStart,
  trimEnd,
  playbackSpeed,
  cropArea,
  onProcessed
}: EnhancedVideoToolsProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const [currentOperation, setCurrentOperation] = useState<string | null>(null)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<any | null>(null)

  // Advanced processing options
  const [exportFormat, setExportFormat] = useState('mp4')
  const [exportQuality, setExportQuality] = useState<'low' | 'medium' | 'high'>('high')
  const [audioUrl, setAudioUrl] = useState('')
  const [audioVolume, setAudioVolume] = useState(50)
  const [transitionType, setTransitionType] = useState('fade')
  const [backgroundMusic, setBackgroundMusic] = useState('')
  const [voiceoverText, setVoiceoverText] = useState('')
  const [voiceoverVoice, setVoiceoverVoice] = useState('alloy')

  const { showToast } = useToast()
  const { t } = useTranslation()

  const debugEnabled = useMemo(() => process.env.NEXT_PUBLIC_DEBUG_VIDEO === 'true', [])

  const handleProcess = async (tool: string, options: any = {}) => {
    if (!videoUrl && !videoPath) {
      showToast(t('enhancedVideoTools.videoRequired'), 'error')
      return
    }

    setIsProcessing(true)
    setActiveTool(tool)

    try {
      const token = localStorage.getItem('token')
      if (!token) {
        showToast(t('enhancedVideoTools.mustBeLoggedIn'), 'error')
        return
      }

      let endpoint = ''
      let requestBody;

      switch (tool) {
        case 'add-text':
          endpoint = '/api/video/enhanced/add-text'
          break
        case 'apply-filters':
          endpoint = '/api/video/enhanced/apply-filters'
          break
        case 'add-audio':
          endpoint = '/api/video/enhanced/add-audio'
          break
        case 'crop-video':
          endpoint = '/api/video/enhanced/crop'
          break
        case 'split-merge':
          endpoint = '/api/video/enhanced/split-merge'
          break
        case 'add-transitions':
          endpoint = '/api/video/enhanced/transitions'
          break
        case 'generate-voiceover':
          endpoint = '/api/video/enhanced/voiceover'
          break
        case 'stabilize':
          endpoint = '/api/video/enhanced/stabilize'
          break
        case 'color-correct':
          endpoint = '/api/video/enhanced/color-correct'
          break
        case 'export-enhanced':
          endpoint = '/api/export'
          break
        default:
          showToast(t('enhancedVideoTools.unknownTool'), 'error')
          return
      }

      setCurrentOperation(tool)
      showToast(t('enhancedVideoTools.toolStarted', { tool: tool.replace('-', ' ') }), 'info')

      // Prepare request body based on tool
      const formData = new FormData()
      if (videoId) formData.append('videoId', videoId)
      const chosenUrl = options.videoUrl || videoUrl || videoPath
      if (chosenUrl) formData.append('videoUrl', chosenUrl)

      // Add tool-specific parameters
      if (tool === 'add-text') {
        formData.append('textOverlays', JSON.stringify(textOverlays))
      }
      if (tool === 'apply-filters') {
        formData.append('filters', JSON.stringify(videoFilters))
      }
      if (tool === 'add-audio') {
        if (audioUrl) formData.append('audioUrl', audioUrl)
        formData.append('audioVolume', audioVolume.toString())
      }
      if (tool === 'crop-video') {
        formData.append('cropArea', JSON.stringify(cropArea))
      }
      if (tool === 'split-merge') {
        formData.append('segments', JSON.stringify(videoSegments))
      }
      if (tool === 'add-transitions') {
        formData.append('transitionType', transitionType)
      }
      if (tool === 'generate-voiceover') {
        formData.append('text', voiceoverText)
        formData.append('voice', voiceoverVoice)
      }
      if (tool === 'export-enhanced') {
        // Export uses JSON
        requestBody = JSON.stringify({
          type: 'video',
          format: exportFormat,
          quality: exportQuality,
          videoId: options.videoId || videoId,
          videoUrl: chosenUrl,
          enhancements: {
            textOverlays,
            filters: videoFilters,
            segments: videoSegments,
            trimStart,
            trimEnd,
            playbackSpeed,
            cropArea,
            audioUrl,
            audioVolume,
            backgroundMusic,
            transitionType
          },
          options: {
            source: 'enhanced_video_editor',
          }
        });
      } else {
        requestBody = formData;
      }

      const headers: any = { Authorization: `Bearer ${token}` };
      if (tool === 'export-enhanced') {
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetch(endpoint, {
        headers,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()

      if (result.success || result.status === 'completed') {
        setLastResult(result.result || result)
        showToast(t('enhancedVideoTools.toolCompleted', { tool: tool.replace('-', ' ') }), 'success')

        if (result.result?.resultUrl) {
          // Create download link
          const link = document.createElement('a')
          link.href = result.result.resultUrl
          link.download = `enhanced-${tool}-${Date.now()}.${exportFormat}`
          link.click()
        }

        if (onProcessed) {
          onProcessed({ tool, status: 'completed', result })
        }
      } else {
        throw new Error(result.error || result.message || t('enhancedVideoTools.processingFailed'))
      }

    } catch (error: any) {
      console.error('Enhanced video processing error:', error)
      const errorObj = extractApiError(error)
      showToast(typeof errorObj === 'string' ? errorObj : errorObj?.message || t('enhancedVideoTools.failedToProcess', { tool }), 'error')
    } finally {
      setIsProcessing(false)
      setActiveTool(null)
      setCurrentOperation(null)
    }
  }

  const tools = [
    {
      id: 'add-text',
      name: t('enhancedVideoTools.addTextName'),
      icon: <Type className="w-5 h-5" />,
      description: t('enhancedVideoTools.addTextDesc'),
      category: 'visual'
    },
    {
      id: 'apply-filters',
      name: t('enhancedVideoTools.applyFiltersName'),
      icon: <Filter className="w-5 h-5" />,
      description: t('enhancedVideoTools.applyFiltersDesc'),
      category: 'visual'
    },
    {
      id: 'add-audio',
      name: t('enhancedVideoTools.addAudioName'),
      icon: <Music className="w-5 h-5" />,
      description: t('enhancedVideoTools.addAudioDesc'),
      category: 'audio'
    },
    {
      id: 'generate-voiceover',
      name: t('enhancedVideoTools.voiceoverName'),
      icon: <Mic className="w-5 h-5" />,
      description: t('enhancedVideoTools.voiceoverDesc'),
      category: 'audio'
    },
    {
      id: 'crop-video',
      name: t('enhancedVideoTools.cropName'),
      icon: <Crop className="w-5 h-5" />,
      description: t('enhancedVideoTools.cropDesc'),
      category: 'editing'
    },
    {
      id: 'split-merge',
      name: t('enhancedVideoTools.splitMergeName'),
      icon: <Split className="w-5 h-5" />,
      description: t('enhancedVideoTools.splitMergeDesc'),
      category: 'editing'
    },
    {
      id: 'add-transitions',
      name: t('enhancedVideoTools.transitionsName'),
      icon: <Zap className="w-5 h-5" />,
      description: t('enhancedVideoTools.transitionsDesc'),
      category: 'editing'
    },
    {
      id: 'stabilize',
      name: t('enhancedVideoTools.stabilizeName'),
      icon: <Wand2 className="w-5 h-5" />,
      description: t('enhancedVideoTools.stabilizeDesc'),
      category: 'effects'
    },
    {
      id: 'color-correct',
      name: t('enhancedVideoTools.colorCorrectName'),
      icon: <Palette className="w-5 h-5" />,
      description: t('enhancedVideoTools.colorCorrectDesc'),
      category: 'effects'
    },
    {
      id: 'export-enhanced',
      name: t('enhancedVideoTools.exportName'),
      icon: <Download className="w-5 h-5" />,
      description: t('enhancedVideoTools.exportDesc'),
      category: 'export'
    }
  ]

  const categoryLabels: Record<string, string> = {
    visual: t('enhancedVideoTools.categoryVisual'),
    audio: t('enhancedVideoTools.categoryAudio'),
    editing: t('enhancedVideoTools.categoryEditing'),
    effects: t('enhancedVideoTools.categoryEffects'),
    export: t('enhancedVideoTools.categoryExport')
  }

  const categories = ['visual', 'audio', 'editing', 'effects', 'export']
  const categoryIcons = {
    visual: <Eye className="w-4 h-4" />,
    audio: <Volume2 className="w-4 h-4" />,
    editing: <Scissors className="w-4 h-4" />,
    effects: <Sliders className="w-4 h-4" />,
    export: <FileVideo className="w-4 h-4" />
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="font-semibold text-lg text-gray-900 dark:text-[var(--text-main)] mb-4">
        {t('enhancedVideoTools.title')}
      </h3>

      {/* Tool Categories */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2 mb-4">
          {categories.map(category => (
            <button
              type="button"
              key={category}
              className="flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-sm capitalize"
            >
              {categoryIcons[category as keyof typeof categoryIcons]}
              {categoryLabels[category]}
            </button>
          ))}
        </div>
      </div>

      {/* Advanced Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Audio Options */}
        <div className="space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <Music className="w-4 h-4" />
            {t('enhancedVideoTools.audioSettings')}
          </h4>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">{t('enhancedVideoTools.backgroundMusicUrl')}</label>
            <input
              type="url"
              value={backgroundMusic}
              onChange={(e) => setBackgroundMusic(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 border rounded text-sm bg-white dark:bg-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">{t('enhancedVideoTools.audioVolume', { value: audioVolume })}</label>
            <input
              type="range"
              min="0"
              max="100"
              value={audioVolume}
              onChange={(e) => setAudioVolume(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        {/* Voiceover Options */}
        <div className="space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <Mic className="w-4 h-4" />
            {t('enhancedVideoTools.aiVoiceover')}
          </h4>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">{t('enhancedVideoTools.voice')}</label>
            <select
              value={voiceoverVoice}
              onChange={(e) => setVoiceoverVoice(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm bg-white dark:bg-gray-900"
            >
              <option value="alloy">{t('enhancedVideoTools.voiceAlloy')}</option>
              <option value="echo">{t('enhancedVideoTools.voiceEcho')}</option>
              <option value="fable">{t('enhancedVideoTools.voiceFable')}</option>
              <option value="onyx">{t('enhancedVideoTools.voiceOnyx')}</option>
              <option value="nova">{t('enhancedVideoTools.voiceNova')}</option>
              <option value="shimmer">{t('enhancedVideoTools.voiceShimmer')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">{t('enhancedVideoTools.scriptText')}</label>
            <textarea
              value={voiceoverText}
              onChange={(e) => setVoiceoverText(e.target.value)}
              placeholder={t('enhancedVideoTools.scriptTextPlaceholder')}
              rows={3}
              className="w-full px-3 py-2 border rounded text-sm bg-white dark:bg-gray-900"
            />
          </div>
        </div>

        {/* Transition Options */}
        <div className="space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <Zap className="w-4 h-4" />
            {t('enhancedVideoTools.transitionsHeading')}
          </h4>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">{t('enhancedVideoTools.transitionType')}</label>
            <select
              value={transitionType}
              onChange={(e) => setTransitionType(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm bg-white dark:bg-gray-900"
            >
              <option value="fade">{t('enhancedVideoTools.transitionFade')}</option>
              <option value="wipe">{t('enhancedVideoTools.transitionWipe')}</option>
              <option value="slide">{t('enhancedVideoTools.transitionSlide')}</option>
              <option value="dissolve">{t('enhancedVideoTools.transitionDissolve')}</option>
              <option value="pixelate">{t('enhancedVideoTools.transitionPixelate')}</option>
            </select>
          </div>
        </div>

        {/* Export Options */}
        <div className="space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <Download className="w-4 h-4" />
            {t('enhancedVideoTools.exportSettings')}
          </h4>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">{t('enhancedVideoTools.format')}</label>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm bg-white dark:bg-gray-900"
            >
              <option value="mp4">{t('enhancedVideoTools.formatMp4')}</option>
              <option value="webm">{t('enhancedVideoTools.formatWebm')}</option>
              <option value="mov">{t('enhancedVideoTools.formatMov')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">{t('enhancedVideoTools.quality')}</label>
            <select
              value={exportQuality}
              onChange={(e) => setExportQuality(e.target.value as any)}
              className="w-full px-3 py-2 border rounded text-sm bg-white dark:bg-gray-900"
            >
              <option value="high">{t('enhancedVideoTools.qualityHigh')}</option>
              <option value="medium">{t('enhancedVideoTools.qualityMedium')}</option>
              <option value="low">{t('enhancedVideoTools.qualityLow')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tool Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {tools.map((tool) => (
          <button
            type="button"
            key={tool.id}
            onClick={() =>
              handleProcess(tool.id, {
                format: exportFormat,
                quality: exportQuality,
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
            <div className="mt-1">
              <span className="inline-block px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded capitalize">
                {categoryLabels[tool.category]}
              </span>
            </div>
          </button>
        ))}
      </div>

      {isProcessing && currentOperation && videoId && (
        <div className="mt-4">
          <VideoProgressTracker
            videoId={videoId}
            operation={currentOperation}
            jobId={currentOperation === 'export-enhanced' ? (currentJobId ?? undefined) : undefined}
            onComplete={(result) => {
              setIsProcessing(false)
              setCurrentOperation(null)
              setCurrentJobId(null)
              setActiveTool(null)
              setLastResult(result?.result || result)
              if (result?.status === 'failed') {
                showToast(result?.error || t('enhancedVideoTools.operationFailed', { operation: currentOperation }), 'error')
              } else {
                showToast(t('enhancedVideoTools.operationCompleted', { operation: currentOperation }), 'success')
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
          <div className="text-sm text-gray-700 dark:text-gray-200">{t('enhancedVideoTools.latestOutput')}</div>
          <a
            className="text-sm font-semibold text-purple-700 dark:text-purple-400 underline"
            href={lastResult.resultUrl}
            target="_blank"
            rel="noreferrer"
          >
            {t('enhancedVideoTools.downloadView')}
          </a>
        </div>
      )}
    </div>
  )
}
