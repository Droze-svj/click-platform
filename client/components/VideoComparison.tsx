'use client'

import { useState, useRef } from 'react'
import { Play, Pause, Volume2, VolumeX } from 'lucide-react'

interface VideoComparisonProps {
  originalVideo: string
  processedVideo: string
  onClose?: () => void
}

export default function VideoComparison({ originalVideo, processedVideo, onClose }: VideoComparisonProps) {
  const [isPlayingOriginal, setIsPlayingOriginal] = useState(false)
  const [isPlayingProcessed, setIsPlayingProcessed] = useState(false)
  const [isMutedOriginal, setIsMutedOriginal] = useState(true)
  const [isMutedProcessed, setIsMutedProcessed] = useState(true)

  const originalRef = useRef<HTMLVideoElement>(null)
  const processedRef = useRef<HTMLVideoElement>(null)

  const togglePlay = (video: 'original' | 'processed') => {
    const originalVideo = originalRef.current
    const processedVideo = processedRef.current

    if (video === 'original') {
      if (originalVideo?.paused) {
        originalVideo.play()
        processedVideo?.pause()
        setIsPlayingOriginal(true)
        setIsPlayingProcessed(false)
      } else {
        originalVideo?.pause()
        setIsPlayingOriginal(false)
      }
    } else {
      if (processedVideo?.paused) {
        processedVideo.play()
        originalVideo?.pause()
        setIsPlayingProcessed(true)
        setIsPlayingOriginal(false)
      } else {
        processedVideo?.pause()
        setIsPlayingProcessed(false)
      }
    }
  }

  const toggleMute = (video: 'original' | 'processed') => {
    const videoElement = video === 'original' ? originalRef.current : processedRef.current
    const setMuted = video === 'original' ? setIsMutedOriginal : setIsMutedProcessed

    if (videoElement) {
      videoElement.muted = !videoElement.muted
      setMuted(videoElement.muted)
    }
  }

  const syncTime = (sourceVideo: HTMLVideoElement, targetVideo: HTMLVideoElement) => {
    targetVideo.currentTime = sourceVideo.currentTime
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Video Comparison</h3>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ✕
            </button>
          )}
        </div>

        <div className="p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Original Video */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-white text-center">Original</h4>
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={originalRef}
                  src={originalVideo}
                  className="w-full h-64 object-contain"
                  muted={isMutedOriginal}
                  onTimeUpdate={() => syncTime(originalRef.current!, processedRef.current!)}
                  onPlay={() => setIsPlayingOriginal(true)}
                  onPause={() => setIsPlayingOriginal(false)}
                />
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                  <button
                    onClick={() => togglePlay('original')}
                    className="bg-black/50 text-white p-2 rounded-full hover:bg-black/70"
                  >
                    {isPlayingOriginal ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => toggleMute('original')}
                    className="bg-black/50 text-white p-2 rounded-full hover:bg-black/70"
                  >
                    {isMutedOriginal ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Processed Video */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-white text-center">Processed</h4>
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={processedRef}
                  src={processedVideo}
                  className="w-full h-64 object-contain"
                  muted={isMutedProcessed}
                  onTimeUpdate={() => syncTime(processedRef.current!, originalRef.current!)}
                  onPlay={() => setIsPlayingProcessed(true)}
                  onPause={() => setIsPlayingProcessed(false)}
                />
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                  <button
                    onClick={() => togglePlay('processed')}
                    className="bg-black/50 text-white p-2 rounded-full hover:bg-black/70"
                  >
                    {isPlayingProcessed ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => toggleMute('processed')}
                    className="bg-black/50 text-white p-2 rounded-full hover:bg-black/70"
                  >
                    {isMutedProcessed ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Comparison Controls */}
          <div className="mt-6 flex items-center justify-center gap-4">
            <button
              onClick={() => {
                const original = originalRef.current
                const processed = processedRef.current
                if (original && processed) {
                  original.currentTime = 0
                  processed.currentTime = 0
                  original.pause()
                  processed.pause()
                  setIsPlayingOriginal(false)
                  setIsPlayingProcessed(false)
                }
              }}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-sm font-medium"
            >
              Reset Both
            </button>

            <div className="text-sm text-gray-600 dark:text-gray-400">
              Videos sync automatically - play one to control both
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}







