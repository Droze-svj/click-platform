'use client'

import { useEffect, useRef, useState } from 'react'

interface AudioWaveformGeneratorProps {
  audioUrl: string
  duration: number
  width: number
  height: number
  onWaveformGenerated?: (waveform: number[]) => void
}

export default function AudioWaveformGenerator({
  audioUrl,
  duration,
  width,
  height,
  onWaveformGenerated
}: AudioWaveformGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const [waveform, setWaveform] = useState<number[]>([])
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    if (!audioUrl || !duration || width === 0 || height === 0) return

    const generateWaveform = async () => {
      setIsGenerating(true)
      try {
        // Create audio context
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext
        if (!AudioContext) {
          console.warn('Web Audio API not supported')
          // Generate mock waveform
          const mockWaveform = Array.from({ length: Math.floor(width / 2) }, () => Math.random() * 0.5 + 0.25)
          setWaveform(mockWaveform)
          onWaveformGenerated?.(mockWaveform)
          setIsGenerating(false)
          return
        }

        const audioContext = new AudioContext()
        audioContextRef.current = audioContext

        // Fetch and decode audio
        const response = await fetch(audioUrl)
        const arrayBuffer = await response.arrayBuffer()
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

        // Get audio data
        const channelData = audioBuffer.getChannelData(0) // Use first channel
        const samples = Math.floor(width / 2) // Number of waveform bars
        const samplesPerBar = Math.floor(channelData.length / samples)

        // Generate waveform data
        const waveformData: number[] = []
        for (let i = 0; i < samples; i++) {
          const start = i * samplesPerBar
          const end = Math.min(start + samplesPerBar, channelData.length)
          
          // Calculate RMS (Root Mean Square) for this segment
          let sum = 0
          for (let j = start; j < end; j++) {
            sum += channelData[j] * channelData[j]
          }
          const rms = Math.sqrt(sum / (end - start))
          
          // Normalize to 0-1 range
          waveformData.push(Math.min(1, rms * 2))
        }

        setWaveform(waveformData)
        onWaveformGenerated?.(waveformData)
      } catch (error) {
        console.error('Waveform generation error:', error)
        // Fallback to mock waveform
        const mockWaveform = Array.from({ length: Math.floor(width / 2) }, () => Math.random() * 0.5 + 0.25)
        setWaveform(mockWaveform)
        onWaveformGenerated?.(mockWaveform)
      } finally {
        setIsGenerating(false)
      }
    }

    generateWaveform()

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
      }
    }
  }, [audioUrl, duration, width, height, onWaveformGenerated])

  // Draw waveform on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || waveform.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = width
    canvas.height = height

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Draw waveform
    const barWidth = width / waveform.length
    const centerY = height / 2

    ctx.fillStyle = '#10B981' // Green for audio
    ctx.strokeStyle = '#10B981'

    waveform.forEach((amplitude, i) => {
      const barHeight = amplitude * height * 0.8
      const x = i * barWidth
      
      // Draw bar
      ctx.fillRect(x, centerY - barHeight / 2, barWidth - 1, barHeight)
    })

    // Draw center line
    ctx.strokeStyle = '#6B7280'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, centerY)
    ctx.lineTo(width, centerY)
    ctx.stroke()
  }, [waveform, width, height])

  if (isGenerating) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-xs text-gray-400">Generating waveform...</div>
      </div>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: 'block' }}
    />
  )
}
