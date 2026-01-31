'use client'

import { useRef, useEffect, useState } from 'react'
import { Eye, BarChart3, Circle } from 'lucide-react'

interface ColorScopesProps {
  videoElement: HTMLVideoElement | null
  filters?: {
    brightness?: number
    contrast?: number
    saturation?: number
    temperature?: number
  }
}

export default function ColorScopes({ videoElement, filters }: ColorScopesProps) {
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null)
  const vectorscopeCanvasRef = useRef<HTMLCanvasElement>(null)
  const histogramCanvasRef = useRef<HTMLCanvasElement>(null)
  const [activeScope, setActiveScope] = useState<'waveform' | 'vectorscope' | 'histogram'>('waveform')

  useEffect(() => {
    if (!videoElement || videoElement.readyState < 2) return

    const updateScopes = () => {
      const canvas = document.createElement('canvas')
      canvas.width = videoElement.videoWidth || 640
      canvas.height = videoElement.videoHeight || 360
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data

      // Draw Waveform
      if (waveformCanvasRef.current) {
        drawWaveform(waveformCanvasRef.current, data, canvas.width, canvas.height)
      }

      // Draw Vectorscope
      if (vectorscopeCanvasRef.current) {
        drawVectorscope(vectorscopeCanvasRef.current, data)
      }

      // Draw Histogram
      if (histogramCanvasRef.current) {
        drawHistogram(histogramCanvasRef.current, data)
      }
    }

    const interval = setInterval(updateScopes, 100) // Update every 100ms
    updateScopes()

    return () => clearInterval(interval)
  }, [videoElement, filters])

  const drawWaveform = (canvas: HTMLCanvasElement, data: Uint8ClampedArray, width: number, height: number) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = 400
    canvas.height = 200
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw grid
    ctx.strokeStyle = '#374151'
    ctx.lineWidth = 1
    for (let i = 0; i <= 10; i++) {
      const y = (i / 10) * canvas.height
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(canvas.width, y)
      ctx.stroke()
    }

    // Draw luminance waveform
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 1
    ctx.beginPath()

    const samples = canvas.width
    for (let x = 0; x < samples; x++) {
      const sampleX = Math.floor((x / samples) * width)
      let sum = 0
      let count = 0

      for (let y = 0; y < height; y += 4) {
        const idx = (y * width + sampleX) * 4
        const r = data[idx]
        const g = data[idx + 1]
        const b = data[idx + 2]
        const luminance = (r * 0.299 + g * 0.587 + b * 0.114) / 255
        sum += luminance
        count++
      }

      const avgLuminance = sum / count
      const waveformY = canvas.height - (avgLuminance * canvas.height)

      if (x === 0) {
        ctx.moveTo(x, waveformY)
      } else {
        ctx.lineTo(x, waveformY)
      }
    }

    ctx.stroke()
  }

  const drawVectorscope = (canvas: HTMLCanvasElement, data: Uint8ClampedArray) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = 300
    canvas.height = 300
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const radius = Math.min(centerX, centerY) - 10

    // Draw circle
    ctx.strokeStyle = '#374151'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
    ctx.stroke()

    // Draw color vectors
    const pixelCount = data.length / 4
    const sampleRate = Math.max(1, Math.floor(pixelCount / 10000))

    for (let i = 0; i < pixelCount; i += sampleRate) {
      const r = data[i * 4] / 255
      const g = data[i * 4 + 1] / 255
      const b = data[i * 4 + 2] / 255

      // Convert RGB to YUV
      const luma = 0.299 * r + 0.587 * g + 0.114 * b
      const u = -0.14713 * r - 0.28886 * g + 0.436 * b
      const v = 0.615 * r - 0.51499 * g - 0.10001 * b

      const angle = Math.atan2(v, u)
      const magnitude = Math.sqrt(u * u + v * v)

      const x = centerX + Math.cos(angle) * magnitude * radius
      const y = centerY + Math.sin(angle) * magnitude * radius

      ctx.fillStyle = `rgba(${data[i * 4]}, ${data[i * 4 + 1]}, ${data[i * 4 + 2]}, 0.3)`
      ctx.fillRect(x - 1, y - 1, 2, 2)
    }
  }

  const drawHistogram = (canvas: HTMLCanvasElement, data: Uint8ClampedArray) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = 400
    canvas.height = 200
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Calculate histogram
    const rHist = new Array(256).fill(0)
    const gHist = new Array(256).fill(0)
    const bHist = new Array(256).fill(0)

    for (let i = 0; i < data.length; i += 4) {
      rHist[data[i]]++
      gHist[data[i + 1]]++
      bHist[data[i + 2]]++
    }

    const maxCount = Math.max(...rHist, ...gHist, ...bHist)

    // Draw histograms
    const drawChannel = (hist: number[], color: string) => {
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.beginPath()

      for (let i = 0; i < 256; i++) {
        const x = (i / 256) * canvas.width
        const height = (hist[i] / maxCount) * canvas.height
        const y = canvas.height - height

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }

      ctx.stroke()
    }

    drawChannel(rHist, '#EF4444')
    drawChannel(gHist, '#10B981')
    drawChannel(bHist, '#3B82F6')
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
          <Eye className="w-4 h-4" />
          Color Scopes
        </h4>
        <div className="flex gap-1">
          {[
            { id: 'waveform', label: 'Waveform', icon: BarChart3 },
            { id: 'vectorscope', label: 'Vectorscope', icon: Circle },
            { id: 'histogram', label: 'Histogram', icon: BarChart3 }
          ].map(scope => {
            const Icon = scope.icon
            return (
              <button
                key={scope.id}
                onClick={() => setActiveScope(scope.id as any)}
                className={`px-2 py-1 text-xs rounded transition-colors ${activeScope === scope.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
              >
                <Icon className="w-3 h-3 inline mr-1" />
                {scope.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="bg-gray-900 rounded p-2">
        {activeScope === 'waveform' && (
          <canvas ref={waveformCanvasRef} className="w-full" style={{ height: '200px' }} />
        )}
        {activeScope === 'vectorscope' && (
          <canvas ref={vectorscopeCanvasRef} className="w-full mx-auto" style={{ height: '300px', width: '300px' }} />
        )}
        {activeScope === 'histogram' && (
          <canvas ref={histogramCanvasRef} className="w-full" style={{ height: '200px' }} />
        )}
      </div>
    </div>
  )
}
