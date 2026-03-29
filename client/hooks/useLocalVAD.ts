import { useEffect, useRef, useState, useCallback } from 'react'

export interface VadSegment {
  start: number
  end: number
  isSpeech: boolean
}

export function useLocalVAD() {
  const workerRef = useRef<Worker | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [vadSegments, setVadSegments] = useState<VadSegment[]>([])

  useEffect(() => {
    // Instantiate the edge-AI worker
    const worker = new Worker(new URL('../lib/ai/localVAD.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker

    worker.onmessage = (e) => {
      if (e.data.type === 'READY') {
        setIsReady(true)
      } else if (e.data.type === 'VAD_RESULT') {
        setVadSegments(e.data.segments)
        setIsProcessing(false)
      } else if (e.data.type === 'ERROR') {
        console.error('Local VAD Error:', e.data.error)
        setIsProcessing(false)
      }
    }

    worker.postMessage({ type: 'INIT' })

    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  const processAudio = useCallback((audioBuffer: Float32Array) => {
    if (!workerRef.current || !isReady) return

    setIsProcessing(true)
    workerRef.current.postMessage({
      type: 'PROCESS_AUDIO',
      payload: { audioData: audioBuffer }
    }, [audioBuffer.buffer]) // Transfer ownership to zero-copy
  }, [isReady])

  return {
    isReady,
    isProcessing,
    vadSegments,
    processAudio
  }
}
