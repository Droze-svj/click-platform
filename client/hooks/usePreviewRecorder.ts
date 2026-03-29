'use client'

import { useState, useRef, useCallback } from 'react'

const MAX_DURATION_MS = 30_000

/**
 * Record a video element (or canvas) via captureStream() + MediaRecorder.
 * Use for client-side "record preview" download (e.g. 30s WebM).
 */
export function usePreviewRecorder(mediaRef: React.RefObject<HTMLVideoElement | HTMLCanvasElement | null>) {
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stop = useCallback(() => {
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current)
      stopTimeoutRef.current = null
    }
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') {
      rec.stop()
      recorderRef.current = null
    }
    setRecording(false)
  }, [])

  const start = useCallback(() => {
    const el = mediaRef.current
    if (!el) {
      setError('No video or canvas ref')
      return
    }
    if (typeof (el as any).captureStream !== 'function') {
      setError('captureStream not supported')
      return
    }
    setError(null)
    chunksRef.current = []
    const stream = (el as any).captureStream?.()
    if (!stream) {
      setError('Could not capture stream')
      return
    }
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm'
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2500000 })
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `click-preview-${Date.now()}.webm`
      a.click()
      URL.revokeObjectURL(url)
    }
    recorder.start(1000)
    recorderRef.current = recorder
    setRecording(true)
    stopTimeoutRef.current = setTimeout(() => {
      stopTimeoutRef.current = null
      stop()
    }, MAX_DURATION_MS)
  }, [mediaRef, stop])

  const toggle = useCallback(() => {
    if (recording) stop()
    else start()
  }, [recording, start, stop])

  return { recording, error, start, stop, toggle }
}
