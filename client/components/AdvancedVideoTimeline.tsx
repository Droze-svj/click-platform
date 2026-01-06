'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
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
  Download
} from 'lucide-react'

interface TimelineSegment {
  id: string
  startTime: number
  endTime: number
  duration: number
  type: 'video' | 'audio' | 'text' | 'transition'
  name: string
  color: string
  track: number
  properties?: {
    volume?: number
    speed?: number
    filters?: any
    text?: string
    transitionType?: string
  }
}

interface Keyframe {
  id: string
  time: number
  property: string
  value: any
  segmentId: string
}

interface AdvancedVideoTimelineProps {
  duration: number
  currentTime: number
  segments: TimelineSegment[]
  keyframes: Keyframe[]
  onTimeUpdate: (time: number) => void
  onSegmentUpdate: (segmentId: string, updates: Partial<TimelineSegment>) => void
  onSegmentDelete: (segmentId: string) => void
  onSegmentAdd: (segment: Omit<TimelineSegment, 'id'>) => void
  onKeyframeAdd: (keyframe: Omit<Keyframe, 'id'>) => void
  onKeyframeUpdate: (keyframeId: string, updates: Partial<Keyframe>) => void
  onKeyframeDelete: (keyframeId: string) => void
  className?: string
}

export default function AdvancedVideoTimeline({
  duration,
  currentTime,
  segments,
  keyframes,
  onTimeUpdate,
  onSegmentUpdate,
  onSegmentDelete,
  onSegmentAdd,
  onKeyframeAdd,
  onKeyframeUpdate,
  onKeyframeDelete,
  className = ''
}: AdvancedVideoTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null)
  const [dragging, setDragging] = useState<'segment' | 'playhead' | 'resize-left' | 'resize-right' | null>(null)
  const [dragStartX, setDragStartX] = useState(0)
  const [dragStartTime, setDragStartTime] = useState(0)
  const [showTrack, setShowTrack] = useState<{ [key: number]: boolean }>({})
  const [selectedTrack, setSelectedTrack] = useState<number>(0)

  // Timeline dimensions
  const TRACK_HEIGHT = 60
  const TIMELINE_HEIGHT = 40
  const totalHeight = segments.reduce((max, seg) => Math.max(max, seg.track + 1), 1) * TRACK_HEIGHT + TIMELINE_HEIGHT

  // Convert time to pixels and vice versa
  const timeToPixels = useCallback((time: number) => time * 50 * zoom, [zoom])
  const pixelsToTime = useCallback((pixels: number) => pixels / (50 * zoom), [zoom])

  // Handle timeline click for seeking
  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (!timelineRef.current) return

    const rect = timelineRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left + scrollLeft
    const time = pixelsToTime(x)

    onTimeUpdate(Math.max(0, Math.min(duration, time)))
  }, [scrollLeft, pixelsToTime, duration, onTimeUpdate])

  // Handle segment interactions
  const handleSegmentMouseDown = useCallback((e: React.MouseEvent, segmentId: string, action: 'move' | 'resize-left' | 'resize-right') => {
    e.stopPropagation()
    setDragging(action === 'move' ? 'segment' : action === 'resize-left' ? 'resize-left' : 'resize-right')
    setSelectedSegment(segmentId)
    setDragStartX(e.clientX)
    const segment = segments.find(s => s.id === segmentId)
    if (segment) {
      setDragStartTime(action === 'resize-left' ? segment.startTime : action === 'resize-right' ? segment.endTime : segment.startTime)
    }
  }, [segments])

  // Handle mouse move for dragging
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging || !selectedSegment) return

    const deltaX = e.clientX - dragStartX
    const deltaTime = pixelsToTime(deltaX)

    const segment = segments.find(s => s.id === selectedSegment)
    if (!segment) return

    if (dragging === 'segment') {
      // Move segment
      const newStartTime = Math.max(0, dragStartTime + deltaTime)
      const newEndTime = newStartTime + segment.duration
      if (newEndTime <= duration) {
        onSegmentUpdate(selectedSegment, {
          startTime: newStartTime,
          endTime: newEndTime
        })
      }
    } else if (dragging === 'resize-left') {
      // Resize from left
      const newStartTime = Math.max(0, dragStartTime + deltaTime)
      if (newStartTime < segment.endTime) {
        onSegmentUpdate(selectedSegment, {
          startTime: newStartTime,
          duration: segment.endTime - newStartTime
        })
      }
    } else if (dragging === 'resize-right') {
      // Resize from right
      const newEndTime = Math.min(duration, dragStartTime + deltaTime)
      if (newEndTime > segment.startTime) {
        onSegmentUpdate(selectedSegment, {
          endTime: newEndTime,
          duration: newEndTime - segment.startTime
        })
      }
    }
  }, [dragging, selectedSegment, dragStartX, dragStartTime, pixelsToTime, duration, segments, onSegmentUpdate])

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setDragging(null)
    setSelectedSegment(null)
  }, [])

  // Add event listeners for dragging
  useEffect(() => {
    if (dragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [dragging, handleMouseMove, handleMouseUp])

  // Zoom controls
  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.5, 5))
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.5, 0.1))
  const handleResetZoom = () => setZoom(1)

  // Add new segment
  const addSegment = (type: TimelineSegment['type']) => {
    const newSegment: Omit<TimelineSegment, 'id'> = {
      startTime: currentTime,
      endTime: Math.min(duration, currentTime + 10),
      duration: 10,
      type,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${segments.filter(s => s.type === type).length + 1}`,
      color: getSegmentColor(type),
      track: selectedTrack,
      properties: getDefaultProperties(type)
    }
    onSegmentAdd(newSegment)
  }

  // Get color for segment type
  const getSegmentColor = (type: TimelineSegment['type']) => {
    const colors = {
      video: '#3B82F6',
      audio: '#10B981',
      text: '#F59E0B',
      transition: '#8B5CF6'
    }
    return colors[type] || '#6B7280'
  }

  // Get default properties for segment type
  const getDefaultProperties = (type: TimelineSegment['type']) => {
    switch (type) {
      case 'audio':
        return { volume: 100 }
      case 'video':
        return { speed: 1, volume: 100 }
      case 'text':
        return { text: 'Sample Text' }
      case 'transition':
        return { transitionType: 'fade' }
      default:
        return {}
    }
  }

  // Format time for display
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    const milliseconds = Math.floor((time % 1) * 100)
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`
  }

  // Get segments for a specific track
  const getTrackSegments = (track: number) => segments.filter(s => s.track === track)

  // Get visible tracks
  const visibleTracks = Array.from(new Set(segments.map(s => s.track))).sort((a, b) => a - b)

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Timeline Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg text-gray-900 dark:text-white">Advanced Timeline</h3>
          <div className="flex items-center gap-2">
            <button onClick={handleZoomOut} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400 min-w-[60px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button onClick={handleZoomIn} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
              <ZoomIn className="w-4 h-4" />
            </button>
            <button onClick={handleResetZoom} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded ml-2">
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Add Segment Controls */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Track:</span>
            <select
              value={selectedTrack}
              onChange={(e) => setSelectedTrack(parseInt(e.target.value))}
              className="px-2 py-1 border rounded text-sm bg-white dark:bg-gray-900"
            >
              {visibleTracks.map(track => (
                <option key={track} value={track}>Track {track + 1}</option>
              ))}
              <option value={visibleTracks.length}>New Track</option>
            </select>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => addSegment('video')}
              className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
            >
              + Video
            </button>
            <button
              onClick={() => addSegment('audio')}
              className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
            >
              + Audio
            </button>
            <button
              onClick={() => addSegment('text')}
              className="px-3 py-1 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-600"
            >
              + Text
            </button>
            <button
              onClick={() => addSegment('transition')}
              className="px-3 py-1 bg-purple-500 text-white rounded text-sm hover:bg-purple-700"
            >
              + Transition
            </button>
          </div>
        </div>
      </div>

      {/* Timeline Container */}
      <div className="relative overflow-hidden" style={{ height: totalHeight + 20 }}>
        {/* Time Ruler */}
        <div
          ref={timelineRef}
          className="h-10 bg-gray-100 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-600 cursor-pointer relative"
          onClick={handleTimelineClick}
        >
          {/* Time markers */}
          {Array.from({ length: Math.ceil(duration / 10) + 1 }, (_, i) => {
            const time = i * 10
            const left = timeToPixels(time)
            return (
              <div
                key={i}
                className="absolute top-0 bottom-0 border-l border-gray-400 dark:border-gray-500"
                style={{ left }}
              >
                <span className="absolute -top-6 left-1 text-xs text-gray-600 dark:text-gray-400">
                  {formatTime(time).split('.')[0]}
                </span>
              </div>
            )
          })}

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 cursor-ew-resize"
            style={{ left: timeToPixels(currentTime) }}
            onMouseDown={(e) => {
              e.stopPropagation()
              setDragging('playhead')
              setDragStartX(e.clientX)
              setDragStartTime(currentTime)
            }}
          >
            <div className="absolute -top-2 -left-1 w-3 h-3 bg-red-500 rounded-full"></div>
          </div>
        </div>

        {/* Tracks */}
        {visibleTracks.map(track => (
          <div
            key={track}
            className="relative border-b border-gray-200 dark:border-gray-600"
            style={{ height: TRACK_HEIGHT }}
          >
            {/* Track Header */}
            <div className="absolute left-0 top-0 bottom-0 w-20 bg-gray-50 dark:bg-gray-800 border-r border-gray-300 dark:border-gray-600 flex items-center justify-between px-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Track {track + 1}
              </span>
              <button
                onClick={() => setShowTrack(prev => ({ ...prev, [track]: !prev[track] }))}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              >
                {showTrack[track] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>

            {/* Track Segments */}
            <div className="ml-20 relative h-full">
              {getTrackSegments(track).map(segment => (
                <div
                  key={segment.id}
                  className={`absolute top-1 bottom-1 rounded cursor-move border-2 transition-all ${
                    selectedSegment === segment.id
                      ? 'border-white shadow-lg ring-2 ring-blue-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                  style={{
                    left: timeToPixels(segment.startTime),
                    width: Math.max(20, timeToPixels(segment.duration)),
                    backgroundColor: segment.color + '80',
                    borderColor: selectedSegment === segment.id ? '#3B82F6' : segment.color
                  }}
                  onMouseDown={(e) => handleSegmentMouseDown(e, segment.id, 'move')}
                >
                  {/* Resize handles */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white bg-opacity-50 hover:bg-opacity-75"
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      handleSegmentMouseDown(e, segment.id, 'resize-left')
                    }}
                  />
                  <div
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white bg-opacity-50 hover:bg-opacity-75"
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      handleSegmentMouseDown(e, segment.id, 'resize-right')
                    }}
                  />

                  {/* Segment content */}
                  <div className="p-2 h-full flex flex-col justify-center overflow-hidden">
                    <div className="text-xs font-medium text-white truncate">
                      {segment.name}
                    </div>
                    <div className="text-xs text-white opacity-75">
                      {formatTime(segment.duration)}
                    </div>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onSegmentDelete(segment.id)
                    }}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Timeline Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Duration: {formatTime(duration)} | Segments: {segments.length} | Tracks: {visibleTracks.length}
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600">
              <Save className="w-4 h-4 inline mr-1" />
              Save Project
            </button>
            <button className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600">
              <Download className="w-4 h-4 inline mr-1" />
              Export
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}




