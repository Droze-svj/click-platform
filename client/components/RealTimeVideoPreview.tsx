'use client'

import { useRef, useEffect, useState } from 'react'
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react'
import WebGLVideoRenderer from './WebGLVideoRenderer'

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
  temperature: number
  tint: number
  highlights: number
  shadows: number
  clarity: number
  dehaze: number
}

interface RealTimeVideoPreviewProps {
  videoUrl: string
  textOverlays: TextOverlay[]
  videoFilters: VideoFilter
  playbackSpeed: number
  onTimeUpdate: (currentTime: number, duration: number) => void
  onVideoLoad: (duration: number) => void
  className?: string
}

export default function RealTimeVideoPreview({
  videoUrl,
  textOverlays,
  videoFilters,
  playbackSpeed,
  onTimeUpdate,
  onVideoLoad,
  className
}: RealTimeVideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 640, height: 360 })
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isReady, setIsReady] = useState(false)

  // Update dimensions based on container
  useEffect(() => {
    const updateDimensions = () => {
      const container = containerRef.current
      if (container) {
        const rect = container.getBoundingClientRect()
        setDimensions({ width: rect.width, height: rect.height })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  // Handle video events
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleLoadedMetadata = () => {
      setDuration(video.duration)
      setIsReady(true)
      onVideoLoad(video.duration)
      video.playbackRate = playbackSpeed
    }

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
      onTimeUpdate(video.currentTime, video.duration)
    }

    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
    }
  }, [onTimeUpdate, onVideoLoad, playbackSpeed])

  // Update playback speed
  useEffect(() => {
    const video = videoRef.current
    if (video) {
      video.playbackRate = playbackSpeed
    }
  }, [playbackSpeed])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      video.play()
    } else {
      video.pause()
    }
  }

  const seekTo = (time: number) => {
    const video = videoRef.current
    if (video) {
      video.currentTime = time
    }
  }

  const skip = (seconds: number) => {
    const video = videoRef.current
    if (video) {
      video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds))
    }
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div ref={containerRef} className={`relative bg-black rounded-xl overflow-hidden group ${className}`}>
      {/* Video Element (hidden, used for WebGL texture) */}
      <video
        ref={videoRef}
        src={videoUrl}
        className="hidden"
        preload="auto"
        playsInline
        muted
        loop
      />

      {/* WebGL Renderer */}
      <WebGLVideoRenderer
        videoElement={videoRef.current}
        filters={videoFilters}
        width={dimensions.width}
        height={dimensions.height}
      />

      {/* Text Overlays (rendered on top of WebGL) */}
      {textOverlays.map(overlay => {
        const video = videoRef.current
        if (!video || !(currentTime >= overlay.startTime && currentTime <= overlay.endTime)) {
          return null
        }

        return (
          <div
            key={overlay.id}
            className="absolute pointer-events-none"
            style={{
              left: `${overlay.x}%`,
              top: `${overlay.y}%`,
              fontSize: `${overlay.fontSize}px`,
              color: overlay.color,
              fontFamily: overlay.fontFamily || 'Arial',
              textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
              whiteSpace: 'nowrap'
            }}
          >
            {overlay.text}
          </div>
        )
      })}

      {/* Video Controls Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300">
        {/* Top Bar */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
          <div className="text-white text-sm font-medium bg-black/50 px-2 py-1 rounded backdrop-blur-sm">
            WebGL Enhanced
          </div>
          <div className="text-white text-xs bg-black/50 px-2 py-1 rounded backdrop-blur-sm">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        {/* Center Play Button */}
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            onClick={togglePlay}
            className="w-16 h-16 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-all duration-200 backdrop-blur-sm hover:scale-110"
          >
            {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
          </button>
        </div>

        {/* Bottom Controls */}
        <div className="absolute bottom-4 left-4 right-4">
          {/* Progress bar */}
          <div className="mb-4">
            <input
              type="range"
              min="0"
              max={duration}
              value={currentTime}
              onChange={(e) => seekTo(parseFloat(e.target.value))}
              className="w-full h-2 bg-white/30 rounded-lg appearance-none cursor-pointer slider accent-white"
              disabled={!isReady}
            />
          </div>

          {/* Control buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => skip(-10)}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-sm"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                onClick={togglePlay}
                className="p-3 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors backdrop-blur-sm"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>

              <button
                onClick={() => skip(10)}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-sm"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            <div className="text-white text-sm font-mono bg-black/50 px-2 py-1 rounded backdrop-blur-sm">
              {playbackSpeed}x
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
