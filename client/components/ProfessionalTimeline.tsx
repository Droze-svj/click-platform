'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Scissors,
  Trash2,
  Copy,
  Move,
  ZoomIn,
  ZoomOut,
  Layers,
  Clock,
  ChevronUp,
  ChevronDown,
  Plus,
  Minus,
  RotateCcw,
  Save,
  Download,
  Frame,
  Maximize2,
  Settings,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  MousePointer2,
  Split,
  Volume2,
  Radio,
  Flag,
  VolumeX,
  Headphones,
  Key,
  Image as ImageIcon,
  Film,
  Zap,
  Sparkles
} from 'lucide-react'
import AudioWaveformGenerator from './AudioWaveformGenerator'
import ClipPropertiesPanel from './ClipPropertiesPanel'

interface TimelineClip {
  id: string
  startTime: number // Timeline position
  endTime: number
  duration: number
  sourceStartTime: number // Source video time (for trimming)
  sourceEndTime: number
  type: 'video' | 'audio' | 'text' | 'transition' | 'image'
  name: string
  color: string
  track: number // Track index
  sourceUrl?: string // Video URL for this clip
  properties?: {
    volume?: number
    speed?: number
    opacity?: number
    filters?: any
    text?: string
    fontSize?: number
    fontColor?: string
    position?: { x: number; y: number }
    transitionType?: string
    transitionDuration?: number
  }
  keyframes?: Array<{
    id: string
    time: number // Relative to clip start
    property: string
    value: any
  }>
}

interface Marker {
  id: string
  time: number
  color: string
  label?: string
}

interface ProfessionalTimelineProps {
  duration: number
  currentTime: number
  isPlaying: boolean
  clips: TimelineClip[]
  onTimeUpdate: (time: number) => void
  onPlayPause: () => void
  onClipUpdate: (clipId: string, updates: Partial<TimelineClip>) => void
  onClipDelete: (clipId: string) => void
  onClipAdd: (clip: Omit<TimelineClip, 'id'>) => void
  onClipSplit: (clipId: string, splitTime: number) => void
  aiSuggestions?: Array<{
    id: string
    time: number
    type: 'cut' | 'transition' | 'effect' | 'text' | 'audio'
    description: string
    confidence: number
    data?: any
  }>
  showAiPreviews?: boolean
  onApplyAiSuggestion?: (suggestion: any) => void
  videoUrl?: string
  className?: string
}

type Tool = 'select' | 'razor' | 'hand'
type EditMode = 'ripple' | 'roll' | 'slip' | 'normal'

const FRAMES_PER_SECOND = 30
const PIXELS_PER_SECOND = 60
const MIN_ZOOM = 0.1
const MAX_ZOOM = 10

export default function ProfessionalTimeline({
  duration,
  currentTime,
  isPlaying,
  clips,
  onTimeUpdate,
  onPlayPause,
  onClipUpdate,
  onClipDelete,
  onClipAdd,
  onClipSplit,
  aiSuggestions = [],
  showAiPreviews = false,
  onApplyAiSuggestion,
  videoUrl,
  className = ''
}: ProfessionalTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [selectedClips, setSelectedClips] = useState<Set<string>>(new Set())
  const [selectedTool, setSelectedTool] = useState<Tool>('select')
  const [editMode, setEditMode] = useState<EditMode>('normal')
  const [activeTool, setActiveTool] = useState<'move' | 'resize-left' | 'resize-right' | 'playhead' | null>(null)
  const [dragStartX, setDragStartX] = useState(0)
  const [dragStartTime, setDragStartTime] = useState(0)
  const [inPoint, setInPoint] = useState<number | null>(null)
  const [outPoint, setOutPoint] = useState<number | null>(null)
  const [markers, setMarkers] = useState<Marker[]>([])
  const [snapToGrid, setSnapToGrid] = useState(true)
  const [showWaveforms, setShowWaveforms] = useState(true)
  const [lockedTracks, setLockedTracks] = useState<Set<number>>(new Set())
  const [hiddenTracks, setHiddenTracks] = useState<Set<number>>(new Set())
  const [soloTracks, setSoloTracks] = useState<Set<number>>(new Set())
  const [mutedTracks, setMutedTracks] = useState<Set<number>>(new Set())
  const [trackHeights, setTrackHeights] = useState<{ [key: number]: number }>({})
  const [trackVolumes, setTrackVolumes] = useState<{ [key: number]: number }>({})
  const [selectedClipForKeyframes, setSelectedClipForKeyframes] = useState<string | null>(null)
  const [selectedClipForProperties, setSelectedClipForProperties] = useState<string | null>(null)
  const [clipThumbnails, setClipThumbnails] = useState<{ [clipId: string]: string }>({})
  const [prefetechedAssets, setPrefetechedAssets] = useState<Set<string>>(new Set())
  const [versionHistory, setVersionHistory] = useState<Array<{ id: string, timestamp: number, clips: TimelineClip[] }>>([])
  const [showVersionHistory, setShowVersionHistory] = useState(false)

  // Track configuration
  const [tracks, setTracks] = useState<Array<{ id: number; name: string; type: 'video' | 'audio' }>>([
    { id: 0, name: 'V1', type: 'video' },
    { id: 1, name: 'A1', type: 'audio' },
    { id: 2, name: 'A2', type: 'audio' }
  ])

  const TRACK_HEIGHT = 70
  const TIMELINE_RULER_HEIGHT = 35

  // Convert time to pixels and vice versa
  const timeToPixels = useCallback((time: number) => {
    return time * PIXELS_PER_SECOND * zoom
  }, [zoom])

  const pixelsToTime = useCallback((pixels: number) => {
    return pixels / (PIXELS_PER_SECOND * zoom)
  }, [zoom])

  // Frame-accurate snapping
  const snapTime = useCallback((time: number) => {
    if (!snapToGrid) return time
    const frameTime = 1 / FRAMES_PER_SECOND
    return Math.round(time / frameTime) * frameTime
  }, [snapToGrid])

  // Format time with frames
  const formatTime = useCallback((time: number) => {
    const hours = Math.floor(time / 3600)
    const minutes = Math.floor((time % 3600) / 60)
    const seconds = Math.floor(time % 60)
    const frames = Math.floor((time % 1) * FRAMES_PER_SECOND)
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`
  }, [])

  // Handle timeline click for seeking
  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (!timelineRef.current || activeTool) return

    if (selectedTool === 'razor') {
      // Split clip at click position
      const rect = timelineRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left + scrollLeft
      const clickedTime = snapTime(pixelsToTime(x))

      // Find clip at this time
      const clickedClip = clips.find(clip =>
        clickedTime >= clip.startTime && clickedTime <= clip.endTime
      )

      if (clickedClip && clickedTime > clickedClip.startTime && clickedTime < clickedClip.endTime) {
        onClipSplit(clickedClip.id, clickedTime)
        setSelectedTool('select')
      }
    } else {
      // Seek to clicked position
      const rect = timelineRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left + scrollLeft
      const clickedTime = snapTime(pixelsToTime(x))
      onTimeUpdate(Math.max(0, Math.min(duration, clickedTime)))
    }
  }, [scrollLeft, pixelsToTime, snapTime, duration, onTimeUpdate, clips, selectedTool, activeTool, onClipSplit])

  // Handle clip interactions
  const handleClipMouseDown = useCallback((
    e: React.MouseEvent,
    clipId: string,
    action: 'move' | 'resize-left' | 'resize-right'
  ) => {
    e.stopPropagation()
    const clip = clips.find(c => c.id === clipId)
    if (!clip || lockedTracks.has(clip.track)) return

    setActiveTool(action)
    setSelectedClips(prev => new Set(prev).add(clipId))
    setDragStartX(e.clientX)

    if (action === 'move') {
      setDragStartTime(clip.startTime)
    } else if (action === 'resize-left') {
      setDragStartTime(clip.startTime)
    } else {
      setDragStartTime(clip.endTime)
    }
  }, [clips, lockedTracks])

  // Handle mouse move for dragging
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!activeTool) return

    const deltaX = e.clientX - dragStartX
    const deltaTime = snapTime(pixelsToTime(deltaX))

    if (activeTool === 'playhead') {
      const newTime = snapTime(Math.max(0, Math.min(duration, dragStartTime + deltaTime)))
      onTimeUpdate(newTime)
      return
    }

    const clipIds = Array.from(selectedClips)
    clipIds.forEach(clipId => {
      const clip = clips.find(c => c.id === clipId)
      if (!clip || lockedTracks.has(clip.track)) return

      if (activeTool === 'move') {
        // Move clip
        const newStartTime = snapTime(Math.max(0, dragStartTime + deltaTime))
        const newEndTime = newStartTime + clip.duration

        if (newEndTime <= duration) {
          if (editMode === 'ripple') {
            // Ripple edit: move following clips
            const followingClips = clips.filter(c =>
              c.track === clip.track && c.startTime >= clip.endTime
            )
            const timeShift = newStartTime - clip.startTime

            onClipUpdate(clipId, {
              startTime: newStartTime,
              endTime: newEndTime
            })

            // Move following clips
            followingClips.forEach(followingClip => {
              onClipUpdate(followingClip.id, {
                startTime: followingClip.startTime + timeShift,
                endTime: followingClip.endTime + timeShift
              })
            })
          } else {
            // Normal move
            onClipUpdate(clipId, {
              startTime: newStartTime,
              endTime: newEndTime
            })
          }
        }
      } else if (activeTool === 'resize-left') {
        // Trim from left (move start)
        const newStartTime = snapTime(Math.max(0, dragStartTime + deltaTime))
        if (newStartTime < clip.endTime && newStartTime >= 0) {
          const newDuration = clip.endTime - newStartTime
          const newSourceStartTime = clip.sourceStartTime + (clip.startTime - newStartTime)
          const timeShift = newStartTime - clip.startTime

          if (editMode === 'ripple') {
            // Ripple: shift following clips
            const followingClips = clips.filter(c =>
              c.track === clip.track && c.startTime >= clip.endTime
            )

            onClipUpdate(clipId, {
              startTime: newStartTime,
              duration: newDuration,
              sourceStartTime: Math.max(0, newSourceStartTime)
            })

            followingClips.forEach(followingClip => {
              onClipUpdate(followingClip.id, {
                startTime: followingClip.startTime + timeShift,
                endTime: followingClip.endTime + timeShift
              })
            })
          } else if (editMode === 'roll') {
            // Roll: adjust adjacent clip
            const previousClip = clips.find(c =>
              c.track === clip.track && c.endTime === clip.startTime
            )

            onClipUpdate(clipId, {
              startTime: newStartTime,
              duration: newDuration,
              sourceStartTime: Math.max(0, newSourceStartTime)
            })

            if (previousClip) {
              const prevNewEndTime = newStartTime
              const prevNewDuration = prevNewEndTime - previousClip.startTime
              onClipUpdate(previousClip.id, {
                endTime: prevNewEndTime,
                duration: prevNewDuration,
                sourceEndTime: previousClip.sourceEndTime + (prevNewDuration - previousClip.duration)
              })
            }
          } else if (editMode === 'slip') {
            // Slip: change source in/out without moving timeline position
            onClipUpdate(clipId, {
              sourceStartTime: Math.max(0, newSourceStartTime),
              sourceEndTime: clip.sourceEndTime + (newDuration - clip.duration)
            })
          } else {
            // Normal trim
            onClipUpdate(clipId, {
              startTime: newStartTime,
              duration: newDuration,
              sourceStartTime: Math.max(0, newSourceStartTime)
            })
          }
        }
      } else if (activeTool === 'resize-right') {
        // Trim from right (move end)
        const newEndTime = snapTime(Math.min(duration, dragStartTime + deltaTime))
        if (newEndTime > clip.startTime && newEndTime <= duration) {
          const newDuration = newEndTime - clip.startTime
          const timeShift = newEndTime - clip.endTime

          if (editMode === 'ripple') {
            // Ripple: shift following clips
            const followingClips = clips.filter(c =>
              c.track === clip.track && c.startTime >= clip.endTime
            )

            onClipUpdate(clipId, {
              endTime: newEndTime,
              duration: newDuration,
              sourceEndTime: clip.sourceEndTime + (newDuration - clip.duration)
            })

            followingClips.forEach(followingClip => {
              onClipUpdate(followingClip.id, {
                startTime: followingClip.startTime + timeShift,
                endTime: followingClip.endTime + timeShift
              })
            })
          } else if (editMode === 'roll') {
            // Roll: adjust adjacent clip
            const nextClip = clips.find(c =>
              c.track === clip.track && c.startTime === clip.endTime
            )

            onClipUpdate(clipId, {
              endTime: newEndTime,
              duration: newDuration,
              sourceEndTime: clip.sourceEndTime + (newDuration - clip.duration)
            })

            if (nextClip) {
              const nextNewStartTime = newEndTime
              const nextNewDuration = nextClip.endTime - nextNewStartTime
              onClipUpdate(nextClip.id, {
                startTime: nextNewStartTime,
                duration: nextNewDuration,
                sourceStartTime: nextClip.sourceStartTime - (nextClip.duration - nextNewDuration)
              })
            }
          } else if (editMode === 'slip') {
            // Slip: change source in/out without moving timeline position
            onClipUpdate(clipId, {
              sourceStartTime: clip.sourceStartTime - (newDuration - clip.duration),
              sourceEndTime: clip.sourceEndTime
            })
          } else {
            // Normal trim
            onClipUpdate(clipId, {
              endTime: newEndTime,
              duration: newDuration,
              sourceEndTime: clip.sourceEndTime + (newDuration - clip.duration)
            })
          }
        }
      }
    })
  }, [activeTool, dragStartX, dragStartTime, pixelsToTime, snapTime, duration, selectedClips, clips, lockedTracks, onClipUpdate, onTimeUpdate])

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setActiveTool(null)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Prevent shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault()
          onPlayPause()
          break
        case 'c':
          if (e.ctrlKey || e.metaKey) {
            // Copy selected clips
            e.preventDefault()
            // Copy logic here
          }
          break
        case 'v':
          if (e.ctrlKey || e.metaKey) {
            // Paste clips
            e.preventDefault()
            // Paste logic here
          }
          break
        case 'i':
          e.preventDefault()
          setInPoint(currentTime)
          break
        case 'o':
          e.preventDefault()
          setOutPoint(currentTime)
          break
        case 'm':
          e.preventDefault()
          // Add marker
          setMarkers(prev => [...prev, {
            id: `marker-${Date.now()}`,
            time: currentTime,
            color: '#FFD700',
            label: `Marker ${prev.length + 1}`
          }])
          break
        case 's':
          setSelectedTool(prev => prev === 'select' ? 'razor' : 'select')
          break
        case 'arrowleft':
          e.preventDefault()
          // Step backward one frame
          onTimeUpdate(Math.max(0, snapTime(currentTime - (1 / FRAMES_PER_SECOND))))
          break
        case 'arrowright':
          e.preventDefault()
          // Step forward one frame
          onTimeUpdate(Math.min(duration, snapTime(currentTime + (1 / FRAMES_PER_SECOND))))
          break
      }

      // JKL shuttle controls
      if (e.key === 'j' || e.key === 'k' || e.key === 'l') {
        // J = backward, K = stop, L = forward
        // Can be extended for variable speed
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [currentTime, onTimeUpdate, onPlayPause, snapTime, duration])

  // Add event listeners for dragging
  useEffect(() => {
    if (activeTool) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [activeTool, handleMouseMove, handleMouseUp])

  // Auto-scroll timeline to keep playhead visible
  useEffect(() => {
    if (!timelineRef.current || !isPlaying) return

    const playheadX = timeToPixels(currentTime)
    const visibleLeft = scrollLeft
    const visibleRight = scrollLeft + (timelineRef.current.clientWidth || 0)

    if (playheadX < visibleLeft || playheadX > visibleRight) {
      setScrollLeft(Math.max(0, playheadX - (timelineRef.current.clientWidth || 0) / 2))
    }
  }, [currentTime, isPlaying, timeToPixels, scrollLeft])

  // Get clips for a track
  const getTrackClips = (trackId: number) => {
    return clips.filter(c => c.track === trackId)
  }

  // Generate clip thumbnail
  const generateClipThumbnail = useCallback(async (clip: TimelineClip) => {
    if (!clip.sourceUrl || clip.type !== 'video') return null

    try {
      const video = document.createElement('video')
      video.crossOrigin = 'anonymous'
      video.src = clip.sourceUrl

      return new Promise<string | null>((resolve) => {
        video.onloadedmetadata = () => {
          video.currentTime = clip.sourceStartTime + (clip.duration / 2) // Middle of clip
          video.onseeked = () => {
            const canvas = document.createElement('canvas')
            canvas.width = 160
            canvas.height = 90
            const ctx = canvas.getContext('2d')
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
              const thumbnail = canvas.toDataURL('image/jpeg', 0.7)
              resolve(thumbnail)
            } else {
              resolve(null)
            }
          }
        }
        video.onerror = () => resolve(null)
      })
    } catch (error) {
      console.error('Thumbnail generation error:', error)
      return null
    }
  }, [])

  // Load thumbnails for visible clips
  useEffect(() => {
    clips.forEach(clip => {
      if (clip.type === 'video' && clip.sourceUrl && !clipThumbnails[clip.id]) {
        generateClipThumbnail(clip).then(thumbnail => {
          if (thumbnail) {
            setClipThumbnails(prev => ({ ...prev, [clip.id]: thumbnail }))
          }
        })
      }
    })
  }, [clips, clipThumbnails, generateClipThumbnail])
  const totalHeight = tracks.reduce((sum, track) => {
    return sum + (trackHeights[track.id] || TRACK_HEIGHT)
  }, TIMELINE_RULER_HEIGHT)

  // Asset Pre-fetching logic: Preload assets within 30 seconds of playhead
  useEffect(() => {
    const prefetchRadius = 30; // seconds
    const nearbyClips = clips.filter(c =>
      c.startTime >= currentTime - prefetchRadius &&
      c.startTime <= currentTime + prefetchRadius
    );

    nearbyClips.forEach(clip => {
      if (clip.sourceUrl && !prefetechedAssets.has(clip.id)) {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = clip.sourceUrl;
        document.head.appendChild(link);
        setPrefetechedAssets(prev => new Set(prev).add(clip.id));
      }
    });
  }, [currentTime, clips, prefetechedAssets]);

  // Snapshot version history every 5 minutes or on large changes
  useEffect(() => {
    if (clips.length === 0) return;
    const interval = setInterval(() => {
      setVersionHistory(prev => [
        { id: `ver-${Date.now()}`, timestamp: Date.now(), clips: [...clips] },
        ...prev.slice(0, 9) // Keep last 10 versions
      ]);
    }, 300000);
    return () => clearInterval(interval);
  }, [clips]);

  return (
    <div className={`bg-gray-900 text-white rounded-lg shadow-2xl border border-gray-700 ${className}`}>
      {/* Toolbar */}
      <div className="p-2 border-b border-gray-700 bg-gray-800 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          {/* Playback Controls */}
          <button
            onClick={onPlayPause}
            className="p-2 hover:bg-gray-700 rounded transition-colors"
            title="Play/Pause (Space)"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
          <button
            onClick={() => onTimeUpdate(Math.max(0, snapTime(currentTime - (1 / FRAMES_PER_SECOND))))}
            className="p-2 hover:bg-gray-700 rounded transition-colors"
            title="Step Back (←)"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={() => onTimeUpdate(Math.min(duration, snapTime(currentTime + (1 / FRAMES_PER_SECOND))))}
            className="p-2 hover:bg-gray-700 rounded transition-colors"
            title="Step Forward (→)"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-gray-600 mx-2" />

          <button
            onClick={() => setShowVersionHistory(!showVersionHistory)}
            className={`p-2 rounded transition-colors ${showVersionHistory ? 'bg-indigo-600' : 'hover:bg-gray-700'}`}
            title="Project History"
          >
            <Clock className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-gray-600 mx-2" />

          {/* Tools */}
          <button
            onClick={() => setSelectedTool('select')}
            className={`p-2 rounded transition-colors ${selectedTool === 'select' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
            title="Selection Tool (V)"
          >
            <MousePointer2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setSelectedTool('razor')}
            className={`p-2 rounded transition-colors ${selectedTool === 'razor' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
            title="Razor Tool (S)"
          >
            <Scissors className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-gray-600 mx-2" />

          {/* Edit Modes */}
          <select
            value={editMode}
            onChange={(e) => setEditMode(e.target.value as EditMode)}
            className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
          >
            <option value="normal">Normal</option>
            <option value="ripple">Ripple</option>
            <option value="roll">Roll</option>
            <option value="slip">Slip</option>
          </select>

          <div className="w-px h-6 bg-gray-600 mx-2" />

          {/* In/Out Points */}
          <button
            onClick={() => setInPoint(currentTime)}
            className={`p-2 rounded transition-colors ${inPoint !== null ? 'bg-green-600' : 'hover:bg-gray-700'}`}
            title="Set In Point (I)"
          >
            I
          </button>
          <button
            onClick={() => setOutPoint(currentTime)}
            className={`p-2 rounded transition-colors ${outPoint !== null ? 'bg-red-600' : 'hover:bg-gray-700'}`}
            title="Set Out Point (O)"
          >
            O
          </button>
          {(inPoint !== null || outPoint !== null) && (
            <button
              onClick={() => {
                setInPoint(null)
                setOutPoint(null)
              }}
              className="p-2 hover:bg-gray-700 rounded transition-colors text-xs"
              title="Clear In/Out"
            >
              Clear
            </button>
          )}

          <div className="w-px h-6 bg-gray-600 mx-2" />

          {/* Zoom Controls */}
          <button
            onClick={() => setZoom(prev => Math.max(MIN_ZOOM, prev / 1.5))}
            className="p-2 hover:bg-gray-700 rounded transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-sm px-2 min-w-[60px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(prev => Math.min(MAX_ZOOM, prev * 1.5))}
            className="p-2 hover:bg-gray-700 rounded transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          {/* Snap to Grid */}
          <div className="w-px h-6 bg-gray-600 mx-2" />
          <button
            onClick={() => setSnapToGrid(!snapToGrid)}
            className={`p-2 rounded transition-colors ${snapToGrid ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
            title="Snap to Grid"
          >
            <Radio className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span>{formatTime(currentTime)}</span>
          <span className="text-gray-500">/</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Timeline Container */}
      <div className="relative overflow-x-auto overflow-y-auto h-full">
        {/* Time Ruler */}
        <div
          ref={timelineRef}
          className="sticky top-0 z-20 h-10 bg-gray-800 border-b-2 border-gray-600 cursor-pointer"
          onClick={handleTimelineClick}
          style={{ width: Math.max(2000, timeToPixels(duration)) }}
        >
          {/* Frame markers */}
          {Array.from({ length: Math.ceil(duration * FRAMES_PER_SECOND / 10) + 1 }, (_, i) => {
            const frame = i * 10
            const time = frame / FRAMES_PER_SECOND
            const left = timeToPixels(time)
            const isMajorFrame = frame % (FRAMES_PER_SECOND * 10) === 0

            if (left < scrollLeft - 100 || left > scrollLeft + (timelineRef.current?.clientWidth || 0) + 100) {
              return null
            }

            return (
              <div
                key={i}
                className={`absolute top-0 border-l ${isMajorFrame ? 'border-gray-400 h-full' : 'border-gray-600 h-1/2'}`}
                style={{ left }}
              >
                {isMajorFrame && (
                  <span className="absolute -top-6 left-1 text-xs text-gray-400">
                    {formatTime(time).split(':').slice(-2).join(':')}
                  </span>
                )}
              </div>
            )
          })}

          {/* In/Out Point Indicators */}
          {inPoint !== null && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-green-500 z-10"
              style={{ left: timeToPixels(inPoint) }}
            >
              <div className="absolute -top-6 left-0 text-xs text-green-400 font-bold">IN</div>
            </div>
          )}
          {outPoint !== null && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
              style={{ left: timeToPixels(outPoint) }}
            >
              <div className="absolute -top-6 left-0 text-xs text-red-400 font-bold">OUT</div>
            </div>
          )}

          {/* Markers */}
          {markers.map(marker => (
            <div
              key={marker.id}
              className="absolute top-0 bottom-0 w-0.5 z-10"
              style={{ left: timeToPixels(marker.time), backgroundColor: marker.color }}
              title={marker.label}
            >
              <div className="absolute -top-5 left-0 w-0 h-0 border-l-4 border-r-4 border-t-8 border-transparent"
                style={{ borderTopColor: marker.color }}
              />
            </div>
          ))}

          {/* AI Suggestion Markers */}
          {showAiPreviews && aiSuggestions.map(suggestion => (
            <div
              key={suggestion.id}
              className="absolute top-0 bottom-0 w-1 z-20 group"
              style={{ left: timeToPixels(suggestion.time), backgroundColor: '#10B981' }}
            >
              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 hidden group-hover:block z-50">
                <div className="bg-gray-900 border border-emerald-500 p-2 rounded-lg shadow-2xl min-w-[150px]">
                  <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">AI Suggestion: {suggestion.type}</p>
                  <p className="text-xs text-white leading-tight mb-2">{suggestion.description}</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onApplyAiSuggestion?.(suggestion);
                    }}
                    className="w-full py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] rounded font-semibold transition-colors"
                  >
                    Apply Edit
                  </button>
                </div>
              </div>
              <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white shadow-lg cursor-pointer">
                <Sparkles className="w-2.5 h-2.5 text-white" />
              </div>
            </div>
          ))}

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30 cursor-ew-resize pointer-events-auto"
            style={{ left: timeToPixels(currentTime) }}
            onMouseDown={(e) => {
              e.stopPropagation()
              setActiveTool('playhead')
              setDragStartX(e.clientX)
              setDragStartTime(currentTime)
            }}
          >
            <div className="absolute -top-2 -left-2 w-5 h-5 bg-red-500 rounded-full border-2 border-white"></div>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 text-xs bg-red-500 px-1 rounded whitespace-nowrap">
              {formatTime(currentTime)}
            </div>
          </div>
        </div>

        {/* Tracks */}
        <div style={{ width: Math.max(2000, timeToPixels(duration)) }}>
          {tracks.map(track => {
            const trackClips = getTrackClips(track.id)
            const isLocked = lockedTracks.has(track.id)
            const isHidden = hiddenTracks.has(track.id)

            if (isHidden) return null

            return (
              <div
                key={track.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  try {
                    const data = JSON.parse(e.dataTransfer.getData('application/json'));
                    if (data.type === 'asset') {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.clientX - rect.left + scrollLeft;
                      const dropTime = snapTime(pixelsToTime(x));

                      onClipAdd({
                        startTime: dropTime,
                        endTime: dropTime + (data.asset.duration || 5),
                        duration: data.asset.duration || 5,
                        type: data.asset.type === 'music' ? 'audio' : data.asset.type === 'image' ? 'image' : 'video',
                        name: data.asset.title || 'New Asset',
                        color: data.asset.type === 'music' ? '#8B5CF6' : data.asset.type === 'image' ? '#10B981' : '#3B82F6',
                        track: track.id,
                        sourceStartTime: 0,
                        sourceEndTime: data.asset.duration || 5,
                        sourceUrl: data.asset.url
                      });
                    }
                  } catch (err) {
                    console.error('Drop error:', err);
                  }
                }}
                className="relative border-b border-gray-700 bg-gray-800/50 hover:bg-gray-800 transition-colors"
                style={{ height: trackHeights[track.id] || TRACK_HEIGHT }}
              >
                {/* Track Header */}
                <div className="absolute left-0 top-0 bottom-0 w-32 bg-gray-850 border-r border-gray-700 flex flex-col z-10">
                  <div className="flex flex-col h-full">
                    {/* Track Controls */}
                    <div className="flex items-center justify-between p-2 border-b border-gray-700">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            if (isLocked) {
                              setLockedTracks(prev => {
                                const next = new Set(prev)
                                next.delete(track.id)
                                return next
                              })
                            } else {
                              setLockedTracks(prev => new Set(prev).add(track.id))
                            }
                          }}
                          className="p-1 hover:bg-gray-700 rounded transition-colors"
                          title={isLocked ? 'Unlock Track' : 'Lock Track'}
                        >
                          {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        </button>
                        <button
                          onClick={() => {
                            if (isHidden) {
                              setHiddenTracks(prev => {
                                const next = new Set(prev)
                                next.delete(track.id)
                                return next
                              })
                            } else {
                              setHiddenTracks(prev => new Set(prev).add(track.id))
                            }
                          }}
                          className="p-1 hover:bg-gray-700 rounded transition-colors"
                          title={isHidden ? 'Show Track' : 'Hide Track'}
                        >
                          {isHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                        {track.type === 'audio' && (
                          <>
                            <button
                              onClick={() => {
                                if (soloTracks.has(track.id)) {
                                  setSoloTracks(prev => {
                                    const next = new Set(prev)
                                    next.delete(track.id)
                                    return next
                                  })
                                } else {
                                  setSoloTracks(prev => new Set(prev).add(track.id))
                                  setMutedTracks(prev => {
                                    const next = new Set(prev)
                                    next.delete(track.id)
                                    return next
                                  })
                                }
                              }}
                              className={`p-1 rounded transition-colors ${soloTracks.has(track.id) ? 'bg-yellow-600' : 'hover:bg-gray-700'
                                }`}
                              title="Solo Track"
                            >
                              <Headphones className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => {
                                if (mutedTracks.has(track.id)) {
                                  setMutedTracks(prev => {
                                    const next = new Set(prev)
                                    next.delete(track.id)
                                    return next
                                  })
                                } else {
                                  setMutedTracks(prev => new Set(prev).add(track.id))
                                  setSoloTracks(prev => {
                                    const next = new Set(prev)
                                    next.delete(track.id)
                                    return next
                                  })
                                }
                              }}
                              className={`p-1 rounded transition-colors ${mutedTracks.has(track.id) ? 'bg-red-600' : 'hover:bg-gray-700'
                                }`}
                              title="Mute Track"
                            >
                              <VolumeX className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-xs font-semibold text-gray-300">{track.name}</span>
                        <span className="text-xs text-gray-500 capitalize">{track.type}</span>
                      </div>
                    </div>

                    {/* Volume Fader */}
                    <div className="flex-1 flex items-center justify-center p-2">
                      <div className="flex flex-col items-center gap-1 w-full">
                        <Volume2 className="w-3 h-3 text-gray-400" />
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={trackVolumes[track.id] ?? 100}
                          onChange={(e) => {
                            setTrackVolumes(prev => ({
                              ...prev,
                              [track.id]: parseInt(e.target.value)
                            }))
                          }}
                          className="w-16 h-32 accent-blue-500"
                          style={{ writingMode: 'vertical-rl', direction: 'rtl' }}
                          title={`Volume: ${trackVolumes[track.id] ?? 100}%`}
                        />
                        <span className="text-xs text-gray-500">{trackVolumes[track.id] ?? 100}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Track Content */}
                <div className="ml-32 relative h-full" style={{ minHeight: TRACK_HEIGHT }}>
                  {trackClips.map(clip => {
                    const isSelected = selectedClips.has(clip.id)
                    const thumbnail = clipThumbnails[clip.id]
                    const isMuted = mutedTracks.has(track.id)
                    const isSoloed = soloTracks.has(track.id) && soloTracks.size > 0
                    const shouldShow = !isSoloed || soloTracks.has(track.id)

                    return (
                      <div
                        key={clip.id}
                        className={`absolute top-1 bottom-1 rounded border-2 transition-all cursor-move ${isSelected
                          ? 'border-blue-400 shadow-lg ring-2 ring-blue-500/50'
                          : 'border-gray-600 hover:border-gray-500'
                          } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''} ${!shouldShow ? 'opacity-30' : ''}`}
                        style={{
                          left: timeToPixels(clip.startTime),
                          width: Math.max(40, timeToPixels(clip.duration)),
                          backgroundColor: clip.color + 'CC',
                        }}
                        onMouseDown={(e) => !isLocked && handleClipMouseDown(e, clip.id, 'move')}
                        onDoubleClick={() => setSelectedClipForKeyframes(clip.id)}
                      >
                        {/* Video Thumbnail */}
                        {thumbnail && clip.type === 'video' && timeToPixels(clip.duration) > 80 && (
                          <div className="absolute inset-0 overflow-hidden rounded">
                            <img
                              src={thumbnail}
                              alt={clip.name}
                              className="w-full h-full object-cover opacity-60"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                          </div>
                        )}

                        {/* Audio Waveform */}
                        {track.type === 'audio' && showWaveforms && clip.sourceUrl && (
                          <div className="absolute inset-0 opacity-70">
                            <AudioWaveformGenerator
                              audioUrl={clip.sourceUrl}
                              duration={clip.duration}
                              width={Math.max(40, timeToPixels(clip.duration))}
                              height={TRACK_HEIGHT - 8}
                            />
                          </div>
                        )}

                        {/* Resize Handles */}
                        {!isLocked && (
                          <>
                            <div
                              className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/30 hover:bg-white/50 rounded-l"
                              onMouseDown={(e) => {
                                e.stopPropagation()
                                handleClipMouseDown(e, clip.id, 'resize-left')
                              }}
                            />
                            <div
                              className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/30 hover:bg-white/50 rounded-r"
                              onMouseDown={(e) => {
                                e.stopPropagation()
                                handleClipMouseDown(e, clip.id, 'resize-right')
                              }}
                            />
                          </>
                        )}

                        {/* Clip Info */}
                        <div className="absolute inset-0 p-1.5 flex flex-col justify-between pointer-events-none z-10">
                          <div className="flex items-start justify-between">
                            <div className="text-xs font-semibold text-white truncate drop-shadow-lg flex-1">
                              {clip.name}
                            </div>
                            {clip.keyframes && clip.keyframes.length > 0 && (
                              <Key className="w-3 h-3 text-yellow-400 drop-shadow-lg" />
                            )}
                          </div>
                          <div className="flex items-center justify-between text-xs text-white/90 drop-shadow-lg">
                            <span>{formatTime(clip.duration)}</span>
                            <div className="flex items-center gap-1">
                              {clip.properties?.speed && clip.properties.speed !== 1 && (
                                <span className="bg-yellow-500/90 px-1 rounded text-[10px] font-semibold">
                                  {clip.properties.speed.toFixed(2)}x
                                </span>
                              )}
                              {clip.properties?.volume !== undefined && clip.properties.volume !== 100 && (
                                <span className="bg-green-500/90 px-1 rounded text-[10px] font-semibold flex items-center gap-0.5">
                                  <Volume2 className="w-2.5 h-2.5" />
                                  {clip.properties.volume}%
                                </span>
                              )}
                              {isMuted && (
                                <VolumeX className="w-3 h-3 text-red-400" />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Delete button (on hover) */}
                        {isSelected && !isLocked && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onClipDelete(clip.id)
                              setSelectedClips(prev => {
                                const next = new Set(prev)
                                next.delete(clip.id)
                                return next
                              })
                            }}
                            className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors z-20 shadow-lg"
                            title="Delete Clip"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}

                        {/* Keyframe indicators */}
                        {clip.keyframes && clip.keyframes.length > 0 && (
                          <div className="absolute -bottom-1 left-0 right-0 flex gap-0.5 px-1">
                            {clip.keyframes.map(kf => (
                              <div
                                key={kf.id}
                                className="w-1 h-1 bg-yellow-400 rounded-full"
                                style={{ left: `${((kf.time / clip.duration) * 100)}%` }}
                                title={`${kf.property}: ${kf.value}`}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Clip Properties Panel */}
      {
        selectedClipForProperties && (
          <ClipPropertiesPanel
            clip={clips.find(c => c.id === selectedClipForProperties) || null}
            onUpdate={(updates) => {
              if (selectedClipForProperties) {
                onClipUpdate(selectedClipForProperties, updates)
              }
            }}
            onClose={() => setSelectedClipForProperties(null)}
          />
        )
      }

      {/* Keyframe Editor Panel */}
      {
        selectedClipForKeyframes && !selectedClipForProperties && (
          <div className="border-t border-gray-700 bg-gray-800 p-4 max-h-64 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-white">
                Keyframe Editor - {clips.find(c => c.id === selectedClipForKeyframes)?.name}
              </h4>
              <button
                onClick={() => setSelectedClipForKeyframes(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ×
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {/* Opacity Keyframes */}
              <div className="bg-gray-900 rounded p-3">
                <div className="text-xs font-semibold text-gray-300 mb-2">Opacity</div>
                <div className="space-y-2">
                  {clips.find(c => c.id === selectedClipForKeyframes)?.keyframes
                    ?.filter(kf => kf.property === 'opacity')
                    .map(kf => (
                      <div key={kf.id} className="flex items-center gap-2 text-xs">
                        <span className="text-gray-400 w-16">{kf.time.toFixed(2)}s</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={kf.value}
                          onChange={(e) => {
                            const clip = clips.find(c => c.id === selectedClipForKeyframes)
                            if (clip) {
                              const updatedKeyframes = clip.keyframes?.map(k =>
                                k.id === kf.id ? { ...k, value: parseFloat(e.target.value) } : k
                              ) || []
                              onClipUpdate(selectedClipForKeyframes, { keyframes: updatedKeyframes })
                            }
                          }}
                          className="flex-1"
                        />
                        <span className="text-gray-300 w-12">{kf.value}%</span>
                      </div>
                    ))}
                  <button
                    onClick={() => {
                      const clip = clips.find(c => c.id === selectedClipForKeyframes)
                      if (clip) {
                        const relativeTime = currentTime - clip.startTime
                        if (relativeTime >= 0 && relativeTime <= clip.duration) {
                          const newKeyframe = {
                            id: `kf-${Date.now()}`,
                            time: relativeTime,
                            property: 'opacity',
                            value: clip.properties?.opacity ?? 100
                          }
                          const updatedKeyframes = [...(clip.keyframes || []), newKeyframe]
                          onClipUpdate(selectedClipForKeyframes, { keyframes: updatedKeyframes })
                        }
                      }
                    }}
                    className="w-full px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs transition-colors"
                  >
                    + Add Opacity Keyframe
                  </button>
                </div>
              </div>

              {/* Volume Keyframes */}
              <div className="bg-gray-900 rounded p-3">
                <div className="text-xs font-semibold text-gray-300 mb-2">Volume</div>
                <div className="space-y-2">
                  {clips.find(c => c.id === selectedClipForKeyframes)?.keyframes
                    ?.filter(kf => kf.property === 'volume')
                    .map(kf => (
                      <div key={kf.id} className="flex items-center gap-2 text-xs">
                        <span className="text-gray-400 w-16">{kf.time.toFixed(2)}s</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={kf.value}
                          onChange={(e) => {
                            const clip = clips.find(c => c.id === selectedClipForKeyframes)
                            if (clip) {
                              const updatedKeyframes = clip.keyframes?.map(k =>
                                k.id === kf.id ? { ...k, value: parseFloat(e.target.value) } : k
                              ) || []
                              onClipUpdate(selectedClipForKeyframes, { keyframes: updatedKeyframes })
                            }
                          }}
                          className="flex-1"
                        />
                        <span className="text-gray-300 w-12">{kf.value}%</span>
                      </div>
                    ))}
                  <button
                    onClick={() => {
                      const clip = clips.find(c => c.id === selectedClipForKeyframes)
                      if (clip) {
                        const relativeTime = currentTime - clip.startTime
                        if (relativeTime >= 0 && relativeTime <= clip.duration) {
                          const newKeyframe = {
                            id: `kf-${Date.now()}`,
                            time: relativeTime,
                            property: 'volume',
                            value: clip.properties?.volume ?? 100
                          }
                          const updatedKeyframes = [...(clip.keyframes || []), newKeyframe]
                          onClipUpdate(selectedClipForKeyframes, { keyframes: updatedKeyframes })
                        }
                      }
                    }}
                    className="w-full px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs transition-colors"
                  >
                    + Add Volume Keyframe
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Timeline Footer */}
      <div className="p-2 border-t border-gray-700 bg-gray-800 flex items-center justify-between text-xs flex-shrink-0">
        <div className="flex items-center gap-4 text-gray-400">
          <span>Clips: {clips.length}</span>
          <span>Tracks: {tracks.length}</span>
          {inPoint !== null && <span className="text-green-400">IN: {formatTime(inPoint)}</span>}
          {outPoint !== null && <span className="text-red-400">OUT: {formatTime(outPoint)}</span>}
          <span>Mode: {editMode}</span>
          {soloTracks.size > 0 && <span className="text-yellow-400">Solo: {soloTracks.size}</span>}
          {mutedTracks.size > 0 && <span className="text-red-400">Muted: {mutedTracks.size}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors">
            <Save className="w-4 h-4 inline mr-1" />
            Save
          </button>
          <button className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors">
            <Download className="w-4 h-4 inline mr-1" />
            Export
          </button>
        </div>
      </div>
    </div >
  )
}
