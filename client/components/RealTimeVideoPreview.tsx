'use client'

import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { Play, Pause, SkipBack, SkipForward, AlertCircle } from 'lucide-react'
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
  vibrance: number
}

interface RealTimeVideoPreviewProps {
  videoUrl: string
  textOverlays?: TextOverlay[]
  videoFilters?: VideoFilter
  playbackSpeed?: number
  onTimeUpdate?: (currentTime: number, duration: number) => void
  onVideoLoad?: (duration: number) => void
  className?: string
  showBeforeAfter?: boolean
}

const DEFAULT_FILTERS: VideoFilter = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
  blur: 0,
  sepia: 0,
  vignette: 0,
  sharpen: 0,
  noise: 0,
  temperature: 0,
  tint: 0,
  highlights: 0,
  shadows: 0,
  clarity: 0,
  dehaze: 0,
  vibrance: 100
}

export default function RealTimeVideoPreview({
  videoUrl,
  textOverlays = [],
  videoFilters = DEFAULT_FILTERS,
  playbackSpeed = 1,
  onTimeUpdate,
  onVideoLoad,
  className,
  showBeforeAfter = false
}: RealTimeVideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastUpdateTimeRef = useRef(0)
  const isMountedRef = useRef(true)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  const [dimensions, setDimensions] = useState({ width: 640, height: 360 })
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Use refs for callbacks to prevent unnecessary re-renders
  const onTimeUpdateRef = useRef(onTimeUpdate)
  const onVideoLoadRef = useRef(onVideoLoad)

  // Update refs when callbacks change
  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate
    onVideoLoadRef.current = onVideoLoad
  }, [onTimeUpdate, onVideoLoad])

  // Track mount state
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Update dimensions based on container with ResizeObserver for better performance
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateDimensions = () => {
      if (!isMountedRef.current) return
      const rect = container.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setDimensions({ width: rect.width, height: rect.height })
      }
    }

    // Initial update
    updateDimensions()

    // Use ResizeObserver for better performance than window resize
    resizeObserverRef.current = new ResizeObserver(updateDimensions)
    resizeObserverRef.current.observe(container)

    // Fallback to window resize for older browsers
    window.addEventListener('resize', updateDimensions)

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
        resizeObserverRef.current = null
      }
      window.removeEventListener('resize', updateDimensions)
    }
  }, [])

  // Handle video URL changes
  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoUrl) {
      return
    }

    // Only update if URL actually changed
    const currentSrc = video.src || video.getAttribute('src') || ''
    if (currentSrc === videoUrl) {
      return
    }

    // Reset state when URL changes
    setIsReady(false)
    setIsLoading(true)
    setError(null)
    setCurrentTime(0)
    setDuration(0)
    setIsPlaying(false)

    try {
      video.src = videoUrl
      video.load()
    } catch (err) {
      console.error('RealTimeVideoPreview: Error setting video source:', err)
      setError('Failed to load video source')
      setIsLoading(false)
    }
  }, [videoUrl])

  // Handle video events with proper cleanup
  useEffect(() => {
    const video = videoRef.current
    if (!video) {
      return
    }

    let isCleanedUp = false

    const handleLoadedMetadata = () => {
      if (isCleanedUp || !isMountedRef.current) return

      const currentVideo = videoRef.current
      if (!currentVideo || !currentVideo.duration || !isFinite(currentVideo.duration)) {
        return
      }

      const videoDuration = currentVideo.duration
      setDuration(videoDuration)
      setIsReady(true)
      setIsLoading(false)
      setIsPlaying(false)

      if (onVideoLoadRef.current) {
        onVideoLoadRef.current(videoDuration)
      }

      // Set playback speed after metadata is loaded
      if (currentVideo.playbackRate !== playbackSpeed) {
        currentVideo.playbackRate = playbackSpeed
      }
    }

    // Throttled time update handler
    const handleTimeUpdate = () => {
      if (isCleanedUp || !isMountedRef.current) return

      const currentVideo = videoRef.current
      if (!currentVideo) return

      const now = Date.now()
      // Update at most every 100ms (10fps) for smoother performance
      if (now - lastUpdateTimeRef.current < 100) return
      lastUpdateTimeRef.current = now

      const time = currentVideo.currentTime
      const dur = currentVideo.duration || duration

      if (isFinite(time) && isFinite(dur)) {
        setCurrentTime(time)
        if (onTimeUpdateRef.current) {
          onTimeUpdateRef.current(time, dur)
        }
      }
    }

    const handlePlay = () => {
      if (isCleanedUp || !isMountedRef.current) return
      setIsPlaying(true)
    }

    const handlePause = () => {
      if (isCleanedUp || !isMountedRef.current) return
      setIsPlaying(false)
    }

    const handleWaiting = () => {
      if (isCleanedUp || !isMountedRef.current) return
      setIsLoading(true)
    }

    const handleCanPlay = () => {
      if (isCleanedUp || !isMountedRef.current) return
      setIsLoading(false)
    }

    const handleError = (e: Event) => {
      if (isCleanedUp || !isMountedRef.current) return

      const currentVideo = videoRef.current
      if (!currentVideo) return

      const videoError = (e.target as HTMLVideoElement)?.error
      if (videoError) {
        let errorMessage = 'Video loading error'
        switch (videoError.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = 'Video playback was aborted'
            break
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = 'Network error while loading video. Check CORS settings and ensure the video URL is accessible.'
            break
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = 'Video decoding error. The video format may be corrupted or unsupported.'
            break
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = 'Video format not supported. Try converting to MP4.'
            break
          default:
            errorMessage = `Video error (code: ${videoError.code})`
        }

        setError(errorMessage)
        setIsReady(false)
        setIsLoading(false)

        console.error('RealTimeVideoPreview: Video error:', {
          errorMessage,
          errorCode: videoError.code,
          videoUrl: currentVideo.src,
          networkState: currentVideo.networkState,
          readyState: currentVideo.readyState
        })
      }
    }

    const handleLoadStart = () => {
      if (isCleanedUp || !isMountedRef.current) return
      setIsLoading(true)
      setError(null)
    }

    const handleLoadedData = () => {
      if (isCleanedUp || !isMountedRef.current) return
      setIsLoading(false)
    }

    // Add all event listeners
    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('waiting', handleWaiting)
    video.addEventListener('canplay', handleCanPlay)
    video.addEventListener('canplaythrough', handleCanPlay)
    video.addEventListener('error', handleError)
    video.addEventListener('loadstart', handleLoadStart)
    video.addEventListener('loadeddata', handleLoadedData)

    return () => {
      isCleanedUp = true
      const currentVideo = videoRef.current
      if (currentVideo) {
        currentVideo.removeEventListener('loadedmetadata', handleLoadedMetadata)
        currentVideo.removeEventListener('timeupdate', handleTimeUpdate)
        currentVideo.removeEventListener('play', handlePlay)
        currentVideo.removeEventListener('pause', handlePause)
        currentVideo.removeEventListener('waiting', handleWaiting)
        currentVideo.removeEventListener('canplay', handleCanPlay)
        currentVideo.removeEventListener('canplaythrough', handleCanPlay)
        currentVideo.removeEventListener('error', handleError)
        currentVideo.removeEventListener('loadstart', handleLoadStart)
        currentVideo.removeEventListener('loadeddata', handleLoadedData)
      }
    }
  }, [playbackSpeed, duration])

  // Update playback speed when it changes
  useEffect(() => {
    const video = videoRef.current
    if (video && isReady && video.playbackRate !== playbackSpeed) {
      try {
        video.playbackRate = playbackSpeed
      } catch (err) {
        console.warn('RealTimeVideoPreview: Could not set playback speed:', err)
      }
    }
  }, [playbackSpeed, isReady])

  // Playback controls
  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video || !isReady) return

    try {
      if (video.paused) {
        video.play().catch(err => {
          console.error('RealTimeVideoPreview: Play error:', err)
          setError('Failed to play video')
        })
      } else {
        video.pause()
      }
    } catch (err) {
      console.error('RealTimeVideoPreview: Toggle play error:', err)
    }
  }, [isReady])

  const seekTo = useCallback((time: number) => {
    const video = videoRef.current
    if (!video || !isReady || !isFinite(time)) return

    try {
      const clampedTime = Math.max(0, Math.min(duration || 0, time))
      video.currentTime = clampedTime
      setCurrentTime(clampedTime)
    } catch (err) {
      console.error('RealTimeVideoPreview: Seek error:', err)
    }
  }, [isReady, duration])

  const skip = useCallback((seconds: number) => {
    const video = videoRef.current
    if (!video || !isReady) return

    try {
      const newTime = Math.max(0, Math.min(duration || 0, currentTime + seconds))
      video.currentTime = newTime
      setCurrentTime(newTime)
    } catch (err) {
      console.error('RealTimeVideoPreview: Skip error:', err)
    }
  }, [isReady, duration, currentTime])

  const formatTime = useCallback((time: number) => {
    if (!isFinite(time) || time < 0) return '0:00'
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }, [])

  // Memoize visible text overlays to prevent unnecessary re-renders
  const visibleOverlays = useMemo(() => {
    if (!videoRef.current || !isFinite(currentTime)) return []

    return textOverlays.filter(overlay =>
      isFinite(overlay.startTime) &&
      isFinite(overlay.endTime) &&
      currentTime >= overlay.startTime &&
      currentTime <= overlay.endTime
    )
  }, [textOverlays, currentTime])

  // Preserve playback state when filters change - ensure video continues playing
  useEffect(() => {
    const video = videoRef.current
    if (!video || !isReady) return

    // Store current playback state
    const wasPlaying = !video.paused
    const currentTimeBefore = video.currentTime

    // If video was playing, ensure it continues after filter update
    // This effect runs when videoFilters change, but we don't want to interrupt playback
    if (wasPlaying && video.paused) {
      // Video was paused unexpectedly, resume if it should be playing
      video.play().catch(err => {
        console.warn('RealTimeVideoPreview: Could not resume playback after filter change:', err)
      })
    }
  }, [videoFilters, isReady])

  // Show error state if video failed to load
  if (error && !isLoading) {
    return (
      <div
        ref={containerRef}
        className={`relative w-full h-full bg-gray-900 rounded-xl overflow-hidden flex items-center justify-center ${className || ''}`}
      >
        <div className="text-center text-white p-6 max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <div className="text-red-400 text-lg font-semibold mb-2">Video Error</div>
          <div className="text-gray-300 text-sm mb-4">{error}</div>
          {videoUrl && (
            <div className="text-gray-400 text-xs break-all">URL: {videoUrl}</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full bg-transparent rounded-xl overflow-hidden group ${className || ''}`}
    >
      {/* Loading indicator */}
      {isLoading && !error && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
          <div className="text-white text-center">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <div className="text-sm">Loading video...</div>
          </div>
        </div>
      )}

      {/* Video Element - hidden when WebGL is active, but still in DOM for WebGL to use as texture source */}
      <video
        ref={videoRef}
        src={videoUrl}
        className="preview-video"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          backgroundColor: '#000',
          display: 'block',
          visibility: isReady && !error ? 'hidden' : 'visible',
          opacity: isReady && !error ? 0 : 1,
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 1,
          pointerEvents: 'none'
        }}
        preload="auto"
        playsInline
        muted
        crossOrigin="anonymous"
        controls={false}
        onPlay={() => {
          // Ensure video continues playing when filters change
          setIsPlaying(true)
        }}
        onPause={() => {
          // Only update state if pause was intentional (not from filter changes)
          setIsPlaying(false)
        }}
      />

      {/* WebGL Renderer - only render if video is ready */}
      {isReady && videoRef.current && !error && dimensions.width > 0 && dimensions.height > 0 && (
        <>
          {showBeforeAfter ? (
            /* Split Screen Before/After */
            <div className="absolute inset-0 flex" style={{ zIndex: 2 }}>
              {/* Before (Left) - Original Video */}
              <div className="w-1/2 h-full relative overflow-hidden bg-black">
                <video
                  src={videoUrl}
                  className="preview-video-split-before"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    backgroundColor: '#000',
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    pointerEvents: 'none'
                  }}
                  ref={(beforeEl) => {
                    if (beforeEl && videoRef.current) {
                      // Sync with main video
                      const syncInterval = setInterval(() => {
                        if (beforeEl && videoRef.current) {
                          const diff = Math.abs(beforeEl.currentTime - videoRef.current.currentTime)
                          if (diff > 0.1) {
                            beforeEl.currentTime = videoRef.current.currentTime
                          }
                          if (videoRef.current.paused && !beforeEl.paused) {
                            beforeEl.pause()
                          } else if (!videoRef.current.paused && beforeEl.paused) {
                            beforeEl.play().catch(() => { })
                          }
                          beforeEl.playbackRate = videoRef.current.playbackRate
                        }
                      }, 100)

                      // Cleanup
                      return () => clearInterval(syncInterval)
                    }
                  }}
                  muted
                  crossOrigin="anonymous"
                  onLoadedMetadata={() => {
                    const beforeEl = document.querySelector('.preview-video-split-before') as HTMLVideoElement
                    if (beforeEl && videoRef.current) {
                      beforeEl.currentTime = videoRef.current.currentTime
                    }
                  }}
                />
                <div className="absolute top-2 left-2 text-white text-xs bg-black/70 px-2 py-1 rounded z-10">
                  Before
                </div>
              </div>

              {/* Divider Line */}
              <div className="absolute top-0 left-1/2 w-0.5 h-full bg-white/50 z-10 pointer-events-none"></div>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-12 bg-white/90 rounded-full z-20 flex items-center justify-center shadow-lg pointer-events-none">
                <div className="text-black text-xs font-bold">|</div>
              </div>

              {/* After (Right) - Filtered Video */}
              <div className="w-1/2 h-full relative overflow-hidden bg-black">
                <WebGLVideoRenderer
                  videoElement={videoRef.current}
                  filters={videoFilters}
                  width={Math.floor(dimensions.width / 2)}
                  height={dimensions.height}
                />
                <div className="absolute top-2 right-2 text-white text-xs bg-black/70 px-2 py-1 rounded z-10">
                  After
                </div>
              </div>
            </div>
          ) : (
            /* Normal Full Screen Preview */
            <div className="absolute inset-0" style={{ zIndex: 2 }}>
              <WebGLVideoRenderer
                videoElement={videoRef.current}
                filters={videoFilters}
                width={dimensions.width}
                height={dimensions.height}
              />
            </div>
          )}
        </>
      )}

      {/* Text Overlays (rendered on top of WebGL) */}
      {visibleOverlays.map(overlay => (
        <div
          key={overlay.id}
          className="absolute pointer-events-none"
          style={{
            left: `${Math.max(0, Math.min(100, overlay.x))}%`,
            top: `${Math.max(0, Math.min(100, overlay.y))}%`,
            fontSize: `${Math.max(8, Math.min(200, overlay.fontSize))}px`,
            color: overlay.color || '#ffffff',
            fontFamily: overlay.fontFamily || 'Arial, sans-serif',
            textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
            whiteSpace: 'nowrap',
            zIndex: 3
          }}
        >
          {overlay.text}
        </div>
      ))}

      {/* Video Controls Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
        {/* Top Bar */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center pointer-events-auto">
          <div className="flex items-center gap-2">
            <div className="text-white text-sm font-medium bg-black/50 px-2 py-1 rounded backdrop-blur-sm">
              {isReady ? 'WebGL Enhanced' : 'Loading...'}
            </div>
            {isReady && (
              <div className="flex items-center gap-1.5 text-white text-xs bg-green-500/80 px-2 py-1 rounded backdrop-blur-sm animate-pulse">
                <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                Live Preview
              </div>
            )}
          </div>
          <div className="text-white text-xs bg-black/50 px-2 py-1 rounded backdrop-blur-sm">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        {/* Center Play Button */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
          <button
            onClick={togglePlay}
            disabled={!isReady}
            className="w-16 h-16 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-all duration-200 backdrop-blur-sm hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
          </button>
        </div>

        {/* Bottom Controls */}
        <div className="absolute bottom-4 left-4 right-4 pointer-events-auto">
          {/* Progress bar */}
          <div className="mb-4">
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={(e) => seekTo(parseFloat(e.target.value))}
              className="w-full h-2 bg-white/30 rounded-lg appearance-none cursor-pointer slider accent-white disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!isReady || !duration}
              aria-label="Video progress"
            />
          </div>

          {/* Control buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => skip(-10)}
                disabled={!isReady}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Skip back 10 seconds"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                onClick={togglePlay}
                disabled={!isReady}
                className="p-3 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>

              <button
                onClick={() => skip(10)}
                disabled={!isReady}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Skip forward 10 seconds"
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
