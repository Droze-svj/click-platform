'use client'

import { useRef, useEffect, useState, useMemo } from 'react'
import { Player, PlayerRef } from '@remotion/player'
import { AbsoluteFill, Video as RemotionVideo, useCurrentFrame, useVideoConfig } from 'remotion'
import { getVideoMetadata } from '@remotion/media-utils'
import { AlertCircle } from 'lucide-react'

// --- Interface Definitions ---

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
  vibrance: number
}

export interface RealTimeVideoPreviewProps {
  videoUrl: string
  textOverlays?: TextOverlay[]
  videoFilters?: VideoFilter
  playbackSpeed?: number
  currentTime?: number
  isPlaying?: boolean
  volume?: number
  isMuted?: boolean
  onTimeUpdate?: (currentTime: number, duration: number) => void
  onVideoLoad?: (duration: number) => void
  className?: string
  showBeforeAfter?: boolean
  shapeOverlays?: any[]
  imageOverlays?: any[]
  svgOverlays?: any[]
  gradientOverlays?: any[]
  [key: string]: any // allow legacy props from parent container
}

const DEFAULT_FILTERS: VideoFilter = {
  brightness: 0, contrast: 0, saturation: 0, hue: 0,
  blur: 0, sepia: 0, vignette: 0, sharpen: 0,
  noise: 0, temperature: 0, tint: 0, highlights: 0,
  shadows: 0, clarity: 0, dehaze: 0, vibrance: 100
}

// --- Remotion Composition ---

const CompositionComponent: React.FC<{
  videoUrl: string
  textOverlays: TextOverlay[]
  videoFilters: VideoFilter
  bRollOverlays?: any[]
  shapeOverlays?: any[]
  imageOverlays?: any[]
  svgOverlays?: any[]
  gradientOverlays?: any[]
}> = ({ videoUrl, textOverlays, videoFilters, bRollOverlays = [], shapeOverlays = [], imageOverlays = [], svgOverlays = [], gradientOverlays = [] }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = frame / fps

  const visibleOverlays = textOverlays.filter(
    (overlay) => t >= overlay.startTime && t <= overlay.endTime
  )

  const visibleBRoll = bRollOverlays.filter(
    (roll) => t >= roll.startTime && t <= roll.endTime
  )

  const visibleShapes = shapeOverlays.filter(
    (shape) => t >= shape.startTime && t <= shape.endTime
  )

  const visibleImages = imageOverlays.filter(
    (img) => t >= img.startTime && t <= img.endTime
  )

  const visibleGradients = gradientOverlays.filter(
    (grad) => t >= grad.startTime && t <= grad.endTime
  )

  const visibleSvgs = svgOverlays.filter(
    (svg) => t >= svg.startTime && t <= svg.endTime
  )

  const filterString = useMemo(() => {
    const f = videoFilters
    if (!f) return ''
    return [
      f.brightness ? `brightness(${100 + f.brightness}%)` : '',
      f.contrast ? `contrast(${100 + f.contrast}%)` : '',
      f.saturation ? `saturate(${100 + f.saturation}%)` : '',
      f.hue ? `hue-rotate(${f.hue}deg)` : '',
      f.blur ? `blur(${f.blur / 10}px)` : '',
      f.sepia ? `sepia(${f.sepia}%)` : '',
    ].filter(Boolean).join(' ')
  }, [videoFilters])

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      <RemotionVideo
        src={videoUrl}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          filter: filterString || 'none',
        }}
      />

      {/* Magic B-Roll Interjections */}
      {visibleBRoll.map((roll, idx) => (
        <div
          key={`broll-${idx}`}
          style={{
            position: 'absolute',
            left: `${roll.x || 0}%`,
            top: `${roll.y || 0}%`,
            width: `${roll.width || 100}%`,
            height: `${roll.height || 100}%`,
            zIndex: 5,
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            borderRadius: roll.borderRadius || '0px',
            overflow: 'hidden'
          }}
        >
          <RemotionVideo
            src={roll.url}
            style={{ width: '100%', height: '100%', objectFit: roll.objectFit || 'cover' }}
          />
        </div>
      ))}

      {/* Shape/Graphic Overlays */}
      {visibleShapes.map((shape, idx) => (
        <div
          key={`shape-${idx}`}
          style={{
            position: 'absolute',
            left: `${shape.x || 0}%`,
            top: `${shape.y || 0}%`,
            width: `${shape.width || 100}px`,
            height: `${shape.height || 100}px`,
            backgroundColor: shape.fill || 'transparent',
            border: `${shape.borderWidth || 0}px solid ${shape.borderColor || 'transparent'}`,
            borderRadius: shape.borderRadius || '0px',
            transform: `rotate(${shape.rotation || 0}deg)`,
            opacity: shape.opacity || 1,
            zIndex: 8,
          }}
        />
      ))}

      {/* Image Overlays */}
      {visibleImages.map((img, idx) => (
        <img
          key={`img-${idx}`}
          src={img.url}
          alt="Overlay"
          style={{
            position: 'absolute',
            left: `${img.x || 0}%`,
            top: `${img.y || 0}%`,
            width: `${img.width || 100}px`,
            height: `${img.height || 100}px`,
            objectFit: img.objectFit || 'contain',
            transform: `rotate(${img.rotation || 0}deg)`,
            opacity: img.opacity || 1,
            zIndex: 9,
          }}
        />
      ))}

      {/* Gradient Overlays */}
      {visibleGradients.map((grad, idx) => (
        <div
          key={`grad-${idx}`}
          style={{
            position: 'absolute',
            left: `${grad.x || 0}%`,
            top: `${grad.y || 0}%`,
            width: `${grad.width || 100}%`,
            height: `${grad.height || 100}%`,
            background: grad.cssGradient || 'linear-gradient(to right, #000, #fff)',
            opacity: grad.opacity || 0.5,
            mixBlendMode: grad.blendMode || 'normal',
            zIndex: 7,
          }}
        />
      ))}

      {visibleOverlays.map((overlay) => (
        <div
          key={overlay.id}
          style={{
            position: 'absolute',
            left: `${Math.max(0, Math.min(100, overlay.x))}%`,
            top: `${Math.max(0, Math.min(100, overlay.y))}%`,
            fontSize: `${Math.max(8, Math.min(200, overlay.fontSize))}px`,
            color: overlay.color || '#ffffff',
            fontFamily: overlay.fontFamily || 'Arial, sans-serif',
            textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
            whiteSpace: 'nowrap',
            zIndex: 10,
          }}
        >
          {overlay.text}
        </div>
      ))}
    </AbsoluteFill>
  )
}

// --- Main Player Component ---

export default function RealTimeVideoPreview({
  videoUrl,
  textOverlays = [],
  videoFilters = DEFAULT_FILTERS,
  playbackSpeed = 1,
  currentTime = 0,
  isPlaying = false,
  volume = 1,
  isMuted = false,
  onTimeUpdate,
  onVideoLoad,
  className,
  shapeOverlays = [],
  imageOverlays = [],
  svgOverlays = [],
  gradientOverlays = [],
}: RealTimeVideoPreviewProps) {
  const [metadata, setMetadata] = useState<{ durationInSeconds: number, fps: number, width: number, height: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const playerRef = useRef<PlayerRef>(null)
  const isSyncing = useRef(false)

  // 1. Fetch metadata on load
  useEffect(() => {
    if (!videoUrl) return
    let mounted = true
    getVideoMetadata(videoUrl)
      .then((meta) => {
        if (!mounted) return
        setMetadata({
          durationInSeconds: meta.durationInSeconds,
          fps: (meta as any).fps || 30,
          width: (meta as any).width || 1920,
          height: (meta as any).height || 1080
        })
        if (onVideoLoad) onVideoLoad(meta.durationInSeconds)
      })
      .catch((err) => {
        if (!mounted) return
        console.error('Failed to get video metadata:', err)
        setError('Failed to load video metadata. Check CORS or URL validity.')
      })
    return () => { mounted = false }
  }, [videoUrl, onVideoLoad])

  // 2. Sync Time Tracking (Player -> Parent)
  useEffect(() => {
    if (!playerRef.current || !metadata || !onTimeUpdate) return
    const interval = setInterval(() => {
      const currentFrame = playerRef.current?.getCurrentFrame() || 0
      const cTime = currentFrame / metadata.fps

      // Notify parent of actual time if it drifted (don't cause a loop)
      if (Math.abs(cTime - currentTime) > 0.5) {
        onTimeUpdate(cTime, metadata.durationInSeconds)
      }
    }, 100)
    return () => clearInterval(interval)
  }, [metadata, onTimeUpdate, currentTime])

  // 3. Sync Props -> Player
  useEffect(() => {
    if (!playerRef.current) return

    // Play/Pause
    if (isPlaying) {
      playerRef.current.play()
    } else {
      playerRef.current.pause()
    }
  }, [isPlaying])

  useEffect(() => {
    if (!playerRef.current || !metadata) return
    const targetFrame = Math.floor(currentTime * metadata.fps)
    const currentFrame = playerRef.current.getCurrentFrame() || 0
    if (Math.abs(targetFrame - currentFrame) > metadata.fps * 0.5) {
      playerRef.current.seekTo(targetFrame)
    }
  }, [currentTime, metadata])

  if (error) {
    return (
      <div className={`relative w-full h-full bg-black/90 flex flex-col items-center justify-center p-8 rounded-2xl border border-red-500/20 backdrop-blur-xl ${className || ''}`}>
        <div className="absolute inset-0 bg-red-500/5 pulse-slow" />
        <AlertCircle className="w-14 h-14 text-red-400 mb-6 drop-shadow-[0_0_15px_rgba(248,113,113,0.5)]" />
        <p className="text-red-300 font-semibold text-center text-lg">{error}</p>
        <p className="text-red-400/50 text-xs mt-4 text-center break-all max-w-[80%] bg-red-950/30 p-3 rounded-lg border border-red-500/10">
          <code className="font-mono">{videoUrl}</code>
        </p>
      </div>
    )
  }

  if (!metadata) {
    return (
      <div className={`relative w-full h-full bg-black flex flex-col items-center justify-center rounded-2xl border border-white/5 overflow-hidden ${className || ''}`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent_70%)]" />
        <div className="relative flex flex-col items-center justify-center space-y-6">
          <div className="relative">
            <div className="absolute inset-0 border-2 border-indigo-500/30 rounded-full scale-150 animate-ping" style={{ animationDuration: '3s' }} />
            <div className="w-12 h-12 border border-indigo-500 border-t-white/80 rounded-full animate-spin shadow-[0_0_30px_rgba(99,102,241,0.5)]" />
          </div>
          <span className="text-xs font-black text-indigo-400/80 uppercase tracking-[0.3em] font-mono blur-[0.2px]">
            Booting Render Engine...
          </span>
        </div>
      </div>
    )
  }

  const durationInFrames = Math.max(1, Math.floor(metadata.durationInSeconds * metadata.fps))

  return (
    <div className={`relative w-full h-full bg-[#050505] rounded-[2rem] overflow-hidden group shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/10 transition-all duration-700 hover:shadow-[0_0_80px_rgba(99,102,241,0.15)] hover:border-indigo-500/30 ${className || ''}`}>
      {/* Dynamic Edge Glow & Vignette */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/0 to-black/40 z-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-[2rem] z-30 pointer-events-none" />
      <Player
        ref={playerRef}
        component={CompositionComponent}
        inputProps={{
          videoUrl,
          textOverlays,
          videoFilters,
          bRollOverlays: [], // Will be passed from parent context eventually
          shapeOverlays: shapeOverlays || [],
          imageOverlays: imageOverlays || [],
          svgOverlays: svgOverlays || [],
          gradientOverlays: gradientOverlays || []
        }}
        durationInFrames={durationInFrames}
        fps={metadata.fps}
        compositionWidth={metadata.width}
        compositionHeight={metadata.height}
        style={{ width: '100%', height: '100%' }}
        controls={true}
        allowFullscreen={true}
        autoPlay={isPlaying}
        playbackRate={playbackSpeed}
        spaceKeyToPlayOrPause={true}
      />
      {/* Premium Engine Tag & Glass Controls Container */}
      <div className="absolute top-6 left-6 z-40 pointer-events-none transform transition-transform duration-500 group-hover:scale-105 group-hover:translate-x-1 group-hover:translate-y-1">
        <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-xl shadow-2xl relative overflow-hidden group/tag">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 opacity-0 group-hover/tag:opacity-100 transition-opacity duration-500" />
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 bg-indigo-500 rounded-full blur-sm opacity-50 animate-pulse" />
            <div className="w-2 h-2 rounded-full bg-indigo-400 relative z-10" />
          </div>
          <span className="text-[9px] uppercase font-black tracking-[0.3em] text-white/90">
            Remotion Engine
          </span>
        </div>
      </div>
    </div>
  )
}
