'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Scissors,
  Download,
  Eye,
  EyeOff,
  RotateCcw,
  Type,
  Palette,
  Music,
  Volume2,
  Zap,
  Crop,
  Split,
  Merge,
  Wand2,
  Filter,
  Sliders,
  Image as ImageIcon,
  Mic,
  Speaker,
  Layers,
  Sparkles,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Monitor,
  Smartphone,
  Tablet,
  Edit3,
  Video,
  Share,
  Brain
} from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import EnhancedVideoTools from './EnhancedVideoTools'
import RealTimeVideoPreview from './RealTimeVideoPreview'
import VideoTemplates from './VideoTemplates'
import AIContentAnalysis from './AIContentAnalysis'
import AdvancedVideoTimeline from './AdvancedVideoTimeline'
import SocialMediaExporter from './SocialMediaExporter'

interface VideoEditorProps {
  videoId?: string
  videoUrl?: string
  videoPath?: string
  onExport?: (result: any) => void
}

interface VideoState {
  duration: number
  currentTime: number
  isPlaying: boolean
  volume: number
  isMuted: boolean
}

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

export default function EnhancedVideoEditor({ videoId, videoUrl, videoPath, onExport }: VideoEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [videoState, setVideoState] = useState<VideoState>({
    duration: 0,
    currentTime: 0,
    isPlaying: false,
    volume: 1,
    isMuted: false,
  })

  // Enhanced editing features
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([])
  const [videoFilters, setVideoFilters] = useState<VideoFilter>({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    hue: 0,
    blur: 0,
    sepia: 0,
    vignette: 0,
    sharpen: 0,
    noise: 0
  })
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(0)
  const [isDragging, setIsDragging] = useState<'start' | 'end' | 'playhead' | null>(null)
  const [showOriginal, setShowOriginal] = useState(true)
  const [processedVideo, setProcessedVideo] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 100, height: 100 })

  // Advanced timeline state
  const [timelineSegments, setTimelineSegments] = useState<Array<{
    id: string
    startTime: number
    endTime: number
    duration: number
    type: 'video' | 'audio' | 'text' | 'transition'
    name: string
    color: string
    track: number
    properties?: any
  }>>([])
  const [timelineKeyframes, setTimelineKeyframes] = useState<Array<{
    id: string
    time: number
    property: string
    value: any
    segmentId: string
  }>>([])

  // New editing features
  const [activeTool, setActiveTool] = useState<'select' | 'text' | 'crop' | 'filter' | 'templates' | 'ai-analysis' | 'timeline' | 'export'>('select')
  const [selectedOverlay, setSelectedOverlay] = useState<string | null>(null)
  const [showTextEditor, setShowTextEditor] = useState(false)
  const [audioTracks, setAudioTracks] = useState<Array<{ url: string, startTime: number, volume: number }>>([])
  const [videoSegments, setVideoSegments] = useState<Array<{ start: number, end: number, id: string }>>([])

  const showToast = useToast()

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const updateTime = () => {
      setVideoState(prev => ({
        ...prev,
        currentTime: video.currentTime,
        duration: video.duration || 0,
      }))
      if (trimEnd === 0 && video.duration) {
        setTrimEnd(video.duration)
      }
    }

    const updatePlaying = () => {
      setVideoState(prev => ({ ...prev, isPlaying: !video.paused }))
    }

    video.addEventListener('timeupdate', updateTime)
    video.addEventListener('loadedmetadata', updateTime)
    video.addEventListener('play', updatePlaying)
    video.addEventListener('pause', updatePlaying)

    return () => {
      video.removeEventListener('timeupdate', updateTime)
      video.removeEventListener('loadedmetadata', updateTime)
      video.removeEventListener('play', updatePlaying)
      video.removeEventListener('pause', updatePlaying)
    }
  }, [])

  // Timeline interactions
  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    const timeline = timelineRef.current
    if (!timeline || !videoRef.current) return

    const rect = timeline.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = clickX / rect.width
    const newTime = percentage * videoState.duration

    videoRef.current.currentTime = newTime
    setVideoState(prev => ({ ...prev, currentTime: newTime }))
  }, [videoState.duration])

  // Text overlay management
  const addTextOverlay = () => {
    const newOverlay: TextOverlay = {
      id: Date.now().toString(),
      text: 'Your Text Here',
      x: 50,
      y: 50,
      fontSize: 24,
      color: '#ffffff',
      fontFamily: 'Arial',
      startTime: videoState.currentTime,
      endTime: videoState.currentTime + 5
    }
    setTextOverlays(prev => [...prev, newOverlay])
    setSelectedOverlay(newOverlay.id)
    setShowTextEditor(true)
  }

  const updateTextOverlay = (id: string, updates: Partial<TextOverlay>) => {
    setTextOverlays(prev =>
      prev.map(overlay =>
        overlay.id === id ? { ...overlay, ...updates } : overlay
      )
    )
  }

  const deleteTextOverlay = (id: string) => {
    setTextOverlays(prev => prev.filter(overlay => overlay.id !== id))
    setSelectedOverlay(null)
    setShowTextEditor(false)
  }

  // Video controls
  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return

    if (videoState.isPlaying) {
      video.pause()
    } else {
      video.play()
    }
  }

  const seekTo = (time: number) => {
    const video = videoRef.current
    if (!video) return

    video.currentTime = time
    setVideoState(prev => ({ ...prev, currentTime: time }))
  }

  const skip = (seconds: number) => {
    const video = videoRef.current
    if (!video) return

    const newTime = Math.max(0, Math.min(videoState.duration, videoState.currentTime + seconds))
    seekTo(newTime)
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Split video at current time
  const splitVideo = () => {
    const currentTime = videoState.currentTime
    const newSegment = {
      start: currentTime,
      end: videoState.duration,
      id: Date.now().toString()
    }
    setVideoSegments(prev => [...prev, newSegment])
    showToast('Video split at current position', 'success')
  }

  // Apply filters to canvas
  const applyFilters = () => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    ctx.filter = `
      brightness(${videoFilters.brightness}%)
      contrast(${videoFilters.contrast}%)
      saturate(${videoFilters.saturation}%)
      hue-rotate(${videoFilters.hue}deg)
      blur(${videoFilters.blur}px)
      sepia(${videoFilters.sepia}%)
    `

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Draw text overlays
    textOverlays.forEach(overlay => {
      if (videoState.currentTime >= overlay.startTime && videoState.currentTime <= overlay.endTime) {
        ctx.font = `${overlay.fontSize}px ${overlay.fontFamily}`
        ctx.fillStyle = overlay.color
        ctx.textAlign = 'center'
        ctx.fillText(overlay.text, (overlay.x / 100) * canvas.width, (overlay.y / 100) * canvas.height)
      }
    })
  }

  useEffect(() => {
    const video = videoRef.current
    if (video && videoState.isPlaying) {
      applyFilters()
    }
  }, [videoState.currentTime, videoFilters, textOverlays])

  if (!videoUrl && !videoPath) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No video selected for editing</p>
      </div>
    )
  }

  const videoSrc = videoUrl || videoPath

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Enhanced Video Editor</h3>

        {/* Tool Selection */}
        <div className="flex flex-wrap gap-2 mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded">
          <button
            onClick={() => setActiveTool('select')}
            className={`px-3 py-1 rounded text-sm ${activeTool === 'select' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}
          >
            Select
          </button>
          <button
            onClick={() => setActiveTool('text')}
            className={`px-3 py-1 rounded text-sm ${activeTool === 'text' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}
          >
            <Type className="w-4 h-4 inline mr-1" />
            Text
          </button>
          <button
            onClick={() => setActiveTool('crop')}
            className={`px-3 py-1 rounded text-sm ${activeTool === 'crop' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}
          >
            <Crop className="w-4 h-4 inline mr-1" />
            Crop
          </button>
          <button
            onClick={() => setActiveTool('filter')}
            className={`px-3 py-1 rounded text-sm ${activeTool === 'filter' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}
          >
            <Filter className="w-4 h-4 inline mr-1" />
            Filters
          </button>
          <button
            onClick={() => setActiveTool('templates')}
            className={`px-3 py-1 rounded text-sm ${activeTool === 'templates' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}
          >
            <Palette className="w-4 h-4 inline mr-1" />
            Templates
          </button>
          <button
            onClick={() => setActiveTool('ai-analysis')}
            className={`px-3 py-1 rounded text-sm ${activeTool === 'ai-analysis' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}
          >
            <Wand2 className="w-4 h-4 inline mr-1" />
            AI Analysis
          </button>
          <button
            onClick={() => setActiveTool('timeline')}
            className={`px-3 py-1 rounded text-sm ${activeTool === 'timeline' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}
          >
            <Layers className="w-4 h-4 inline mr-1" />
            Timeline
          </button>
          <button
            onClick={() => setActiveTool('export')}
            className={`px-3 py-1 rounded text-sm ${activeTool === 'export' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}
          >
            <Download className="w-4 h-4 inline mr-1" />
            Export
          </button>
        </div>

        {/* Real-time Video Preview */}
        <RealTimeVideoPreview
          videoUrl={videoSrc}
          textOverlays={textOverlays}
          videoFilters={videoFilters}
          playbackSpeed={playbackSpeed}
          onTimeUpdate={(currentTime, duration) => {
            setVideoState(prev => ({ ...prev, currentTime, duration }))
            if (trimEnd === 0 && duration > 0) {
              setTrimEnd(duration)
            }
          }}
          onVideoLoad={(duration) => {
            setVideoState(prev => ({ ...prev, duration }))
            if (trimEnd === 0) {
              setTrimEnd(duration)
            }
          }}
          className="mb-4"
        />

        {/* Playback Speed Control */}
        <div className="flex items-center justify-center gap-2 mb-4 p-2 bg-gray-50 dark:bg-gray-700 rounded">
          <span className="text-sm text-gray-600 dark:text-gray-400">Speed:</span>
          <select
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
            className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm"
          >
            <option value="0.25">0.25x</option>
            <option value="0.5">0.5x</option>
            <option value="1">1x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2x</option>
          </select>
          <button
            onClick={splitVideo}
            className="flex items-center gap-1 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
            title="Split video at current time"
          >
            <Scissors className="w-4 h-4" />
            Split
          </button>
        </div>

        {/* Timeline */}
        <div
          ref={timelineRef}
          className="relative h-12 bg-gray-200 dark:bg-gray-700 rounded cursor-pointer mb-4"
          onClick={handleTimelineClick}
        >
          {/* Progress bar */}
          <div
            className="absolute top-0 left-0 h-full bg-blue-500 rounded-l"
            style={{ width: `${(videoState.currentTime / videoState.duration) * 100}%` }}
          />

          {/* Trim handles */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-red-500 cursor-ew-resize opacity-75 hover:opacity-100"
            style={{ left: `${(trimStart / videoState.duration) * 100}%` }}
            onMouseDown={(e) => {
              e.stopPropagation()
              setIsDragging('start')
            }}
            title={`Trim start: ${formatTime(trimStart)}`}
          />
          <div
            className="absolute top-0 bottom-0 w-1 bg-red-500 cursor-ew-resize opacity-75 hover:opacity-100"
            style={{ left: `${(trimEnd / videoState.duration) * 100}%` }}
            onMouseDown={(e) => {
              e.stopPropagation()
              setIsDragging('end')
            }}
            title={`Trim end: ${formatTime(trimEnd)}`}
          />

          {/* Trim overlay */}
          <div
            className="absolute top-0 bottom-0 bg-red-500/20 border-x border-red-500/50"
            style={{
              left: `${(trimStart / videoState.duration) * 100}%`,
              width: `${((trimEnd - trimStart) / videoState.duration) * 100}%`
            }}
          />

          {/* Video segments */}
          {videoSegments.map(segment => (
            <div
              key={segment.id}
              className="absolute top-0 bottom-0 bg-green-500/30 border-x border-green-500"
              style={{
                left: `${(segment.start / videoState.duration) * 100}%`,
                width: `${((segment.end - segment.start) / videoState.duration) * 100}%`
              }}
              title={`Segment: ${formatTime(segment.start)} - ${formatTime(segment.end)}`}
            />
          ))}
        </div>

        {/* Text Overlays List */}
        {textOverlays.length > 0 && (
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded">
            <h4 className="font-medium mb-2">Text Overlays</h4>
            <div className="space-y-2">
              {textOverlays.map(overlay => (
                <div key={overlay.id} className="flex items-center justify-between bg-white dark:bg-gray-800 p-2 rounded">
                  <span className="text-sm">{overlay.text}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedOverlay(overlay.id)
                        setShowTextEditor(true)
                      }}
                      className="text-blue-500 hover:text-blue-700 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteTextOverlay(overlay.id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 mb-4">
          {activeTool === 'text' && (
            <button
              onClick={addTextOverlay}
              className="flex items-center gap-1 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              <Type className="w-4 h-4" />
              Add Text
            </button>
          )}

          {activeTool === 'templates' && (
            <div className="mt-4">
              <VideoTemplates
                onApplyTemplate={(filters, textOverlays) => {
                  setVideoFilters(prev => ({ ...prev, ...filters }))
                  if (textOverlays) {
                    setTextOverlays(prev => [...prev, ...textOverlays])
                  }
                  showToast('Template applied successfully!', 'success')
                }}
                currentFilters={videoFilters}
              />
            </div>
          )}

          {activeTool === 'ai-analysis' && (
            <div className="mt-4">
              <AIContentAnalysis
                videoUrl={videoSrc}
                videoId={videoId}
                onAnalysisComplete={(results) => {
                  showToast('AI analysis complete! Check suggestions.', 'success')
                }}
                onApplySuggestion={(suggestion) => {
                  // Apply the suggestion to the video editor
                  showToast(`Applied AI suggestion: ${suggestion.description}`, 'success')
                }}
              />
            </div>
          )}

          {activeTool === 'timeline' && (
            <div className="mt-4">
              <AdvancedVideoTimeline
                duration={videoState.duration || 0}
                currentTime={videoState.currentTime}
                segments={timelineSegments}
                keyframes={timelineKeyframes}
                onTimeUpdate={(time) => {
                  // Update the video playback time
                  setVideoState(prev => ({ ...prev, currentTime: time }))
                }}
                onSegmentUpdate={(segmentId, updates) => {
                  setTimelineSegments(prev =>
                    prev.map(seg => seg.id === segmentId ? { ...seg, ...updates } : seg)
                  )
                }}
                onSegmentDelete={(segmentId) => {
                  setTimelineSegments(prev => prev.filter(seg => seg.id !== segmentId))
                  showToast('Segment deleted', 'success')
                }}
                onSegmentAdd={(segment) => {
                  const newSegment = {
                    ...segment,
                    id: Date.now().toString()
                  }
                  setTimelineSegments(prev => [...prev, newSegment])
                  showToast(`Added ${segment.type} segment`, 'success')
                }}
                onKeyframeAdd={(keyframe) => {
                  const newKeyframe = {
                    ...keyframe,
                    id: Date.now().toString()
                  }
                  setTimelineKeyframes(prev => [...prev, newKeyframe])
                }}
                onKeyframeUpdate={(keyframeId, updates) => {
                  setTimelineKeyframes(prev =>
                    prev.map(kf => kf.id === keyframeId ? { ...kf, ...updates } : kf)
                  )
                }}
                onKeyframeDelete={(keyframeId) => {
                  setTimelineKeyframes(prev => prev.filter(kf => kf.id !== keyframeId))
                }}
              />
            </div>
          )}

          {activeTool === 'export' && (
            <div className="mt-4">
              <SocialMediaExporter
                videoUrl={videoSrc}
                videoId={videoId}
                onExport={(preset, options) => {
                  // Handle social media export
                  showToast(`Starting export for ${preset.platform}...`, 'info')
                  // This would integrate with the enhanced export endpoint
                  console.log('Export config:', { preset, options, textOverlays, videoFilters })
                }}
              />
            </div>
          )}

          <button
            onClick={() => setShowOriginal(!showOriginal)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-sm"
          >
            {showOriginal ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {showOriginal ? 'Show Original' : 'Show Processed'}
          </button>
        </div>
      </div>

      {/* Enhanced Video Tools */}
      <EnhancedVideoTools
        videoId={videoId}
        videoUrl={videoUrl}
        videoPath={videoPath}
        textOverlays={textOverlays}
        videoFilters={videoFilters}
        videoSegments={videoSegments}
        trimStart={trimStart}
        trimEnd={trimEnd}
        playbackSpeed={playbackSpeed}
        cropArea={cropArea}
        onProcessed={(result) => {
          if (result?.status === 'completed' && result?.result?.resultUrl) {
            setProcessedVideo(result.result.resultUrl)
            showToast('Video processed successfully!', 'success')
            if (onExport) {
              onExport(result)
            }
          }
        }}
      />

      {/* Text Editor Modal */}
      {showTextEditor && selectedOverlay && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Edit Text Overlay</h3>
            {(() => {
              const overlay = textOverlays.find(o => o.id === selectedOverlay)
              if (!overlay) return null

              return (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Text</label>
                    <input
                      type="text"
                      value={overlay.text}
                      onChange={(e) => updateTextOverlay(overlay.id, { text: e.target.value })}
                      className="w-full px-3 py-2 border rounded"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Font Size</label>
                      <input
                        type="number"
                        value={overlay.fontSize}
                        onChange={(e) => updateTextOverlay(overlay.id, { fontSize: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Color</label>
                      <input
                        type="color"
                        value={overlay.color}
                        onChange={(e) => updateTextOverlay(overlay.id, { color: e.target.value })}
                        className="w-full h-10 border rounded"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">X Position (%)</label>
                      <input
                        type="number"
                        value={overlay.x}
                        onChange={(e) => updateTextOverlay(overlay.id, { x: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Y Position (%)</label>
                      <input
                        type="number"
                        value={overlay.y}
                        onChange={(e) => updateTextOverlay(overlay.id, { y: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border rounded"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-6">
                    <button
                      onClick={() => setShowTextEditor(false)}
                      className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
