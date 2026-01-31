'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Palette, Eye, EyeOff, RotateCcw, Sliders, Upload } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'

interface ChromaKeySettings {
  keyColor: { r: number, g: number, b: number }
  similarity: number
  smoothness: number
  spillSuppression: number
  edgeFeather: number
  despillBalance: number
  matteBlur: number
  enable: boolean
}

interface ChromaKeyProps {
  videoUrl: string
  backgroundImage?: string
  settings: ChromaKeySettings
  onSettingsChange: (settings: ChromaKeySettings) => void
  onProcessed?: (resultUrl: string) => void
}

export default function ChromaKey({
  videoUrl,
  backgroundImage,
  settings,
  onSettingsChange,
  onProcessed
}: ChromaKeyProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showOriginal, setShowOriginal] = useState(false)
  const [colorPickerActive, setColorPickerActive] = useState(false)
  // Use placeholder gradients instead of missing image files
  const [backgroundImages, setBackgroundImages] = useState<string[]>([
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImEiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiM0QzUxRjYiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMxRTQwNUEiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2EpIi8+PC9zdmc+', // Studio gradient
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImIiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiM2QjcyODAiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMzNDQ3NTkiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2IpIi8+PC9zdmc+', // City gradient
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImMiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMxMEI5ODEiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMwNTk2NjkiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2MpIi8+PC9zdmc+', // Nature gradient
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImQiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMxRTE3MkYiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMwMDAwMDAiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2QpIi8+PC9zdmc+' // Space gradient
  ])

  const { showToast } = useToast()

  // Pick color from video frame
  const pickColorFromVideo = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!colorPickerActive || !canvasRef.current) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const imageData = ctx.getImageData(x, y, 1, 1)
    const r = imageData.data[0]
    const g = imageData.data[1]
    const b = imageData.data[2]

    onSettingsChange({
      ...settings,
      keyColor: { r, g, b }
    })

    setColorPickerActive(false)
    showToast(`Picked color: RGB(${r}, ${g}, ${b})`, 'success')
  }, [colorPickerActive, settings, onSettingsChange, showToast])

  // Apply chroma key effect
  const applyChromaKey = useCallback(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

    // Draw video frame
    ctx.drawImage(video, 0, 0, width, height)

    if (!settings.enable) return

    // Get image data
    const imageData = ctx.getImageData(0, 0, width, height)
    const data = imageData.data

    const keyR = settings.keyColor.r
    const keyG = settings.keyColor.g
    const keyB = settings.keyColor.b

    // Apply chroma key algorithm
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]

      // Calculate color distance from key color
      const dr = r - keyR
      const dg = g - keyG
      const db = b - keyB
      const distance = Math.sqrt(dr * dr + dg * dg + db * db)

      // Calculate alpha based on similarity
      let alpha = 1.0
      if (distance < settings.similarity) {
        alpha = Math.max(0, (distance - settings.smoothness) / (settings.similarity - settings.smoothness))
      }

      // Apply edge feathering
      if (settings.edgeFeather > 0) {
        alpha = Math.min(1, alpha + settings.edgeFeather / 100)
      }

      // Spill suppression (reduce green spill)
      if (settings.spillSuppression > 0) {
        const greenExcess = Math.max(0, g - Math.max(r, b))
        const spillFactor = settings.spillSuppression / 100
        data[i] = Math.max(0, r - greenExcess * spillFactor)     // Red
        data[i + 1] = Math.max(0, g - greenExcess * spillFactor) // Green
        data[i + 2] = Math.max(0, b - greenExcess * spillFactor) // Blue
      }

      data[i + 3] = Math.floor(alpha * 255) // Alpha
    }

    // Apply matte blur
    if (settings.matteBlur > 0) {
      const blurredData = new ImageData(width, height)
      const blurRadius = Math.floor(settings.matteBlur / 10)

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let alphaSum = 0
          let count = 0

          for (let by = Math.max(0, y - blurRadius); by <= Math.min(height - 1, y + blurRadius); by++) {
            for (let bx = Math.max(0, x - blurRadius); bx <= Math.min(width - 1, x + blurRadius); bx++) {
              const idx = (by * width + bx) * 4
              alphaSum += data[idx + 3]
              count++
            }
          }

          const blurredIdx = (y * width + x) * 4
          blurredData.data[blurredIdx] = data[blurredIdx]
          blurredData.data[blurredIdx + 1] = data[blurredIdx + 1]
          blurredData.data[blurredIdx + 2] = data[blurredIdx + 2]
          blurredData.data[blurredIdx + 3] = alphaSum / count
        }
      }

      ctx.putImageData(blurredData, 0, 0)
    } else {
      ctx.putImageData(imageData, 0, 0)
    }

    // Draw background if provided
    if (backgroundImage && !showOriginal) {
      const bgImg = new Image()
      bgImg.onload = () => {
        // Save current composite operation
        ctx.globalCompositeOperation = 'destination-over'
        ctx.drawImage(bgImg, 0, 0, width, height)
        ctx.globalCompositeOperation = 'source-over'
      }
      bgImg.src = backgroundImage
    }
  }, [settings, backgroundImage, showOriginal])

  // Animation loop
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let animationId: number

    const animate = () => {
      if (video.readyState >= 2) { // HAVE_CURRENT_DATA or better
        applyChromaKey()
      }
      animationId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId)
      }
    }
  }, [applyChromaKey])

  // Handle video load
  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const handleLoadedMetadata = () => {
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 360
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    return () => video.removeEventListener('loadedmetadata', handleLoadedMetadata)
  }, [])

  const resetSettings = useCallback(() => {
    onSettingsChange({
      keyColor: { r: 0, g: 255, b: 0 }, // Default green
      similarity: 50,
      smoothness: 10,
      spillSuppression: 50,
      edgeFeather: 5,
      despillBalance: 50,
      matteBlur: 2,
      enable: true
    })
    showToast('Chroma key settings reset', 'info')
  }, [onSettingsChange, showToast])

  const uploadBackground = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      setBackgroundImages(prev => [...prev, result])
      showToast('Background uploaded successfully', 'success')
    }
    reader.readAsDataURL(file)
  }, [showToast])

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Chroma Key (Green Screen)
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Remove backgrounds and composite videos
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowOriginal(!showOriginal)}
              className={`p-2 rounded-lg transition-colors ${
                showOriginal
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}
              title={showOriginal ? 'Show composited' : 'Show original'}
            >
              {showOriginal ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
            <button
              onClick={resetSettings}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-600 dark:text-gray-400"
              title="Reset settings"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Preview Area */}
          <div className="lg:col-span-2 space-y-4">
            <div className="relative bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                src={videoUrl}
                className="hidden"
                autoPlay
                loop
                muted
                playsInline
              />
              <canvas
                ref={canvasRef}
                className={`w-full h-auto ${colorPickerActive ? 'cursor-crosshair' : 'cursor-default'}`}
                onClick={colorPickerActive ? pickColorFromVideo : undefined}
              />
              {settings.enable && (
                <div className="absolute top-4 right-4 bg-green-500 text-white px-2 py-1 rounded text-xs font-medium">
                  Chroma Key Active
                </div>
              )}
              {colorPickerActive && (
                <div className="absolute top-4 left-4 bg-blue-500 text-white px-2 py-1 rounded text-xs font-medium">
                  Click to pick key color
                </div>
              )}
            </div>

            {/* Background Selection */}
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">Background</h4>
              <div className="grid grid-cols-4 gap-3 mb-4">
                {backgroundImages.map((bg, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      // This would typically update the background image
                      showToast('Background selected', 'success')
                    }}
                    className="aspect-video bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all"
                  >
                    <img
                      src={bg}
                      alt={`Background ${index + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback to gradient if image fails to load
                        const target = e.target as HTMLImageElement
                        const gradients = [
                          'linear-gradient(135deg, #4C51F6 0%, #1E405A 100%)',
                          'linear-gradient(135deg, #6B7280 0%, #344759 100%)',
                          'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                          'linear-gradient(135deg, #1E172F 0%, #000000 100%)'
                        ]
                        target.style.background = gradients[index] || gradients[0]
                        target.style.display = 'none'
                      }}
                    />
                  </button>
                ))}
                <label className="aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                  <Upload className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={uploadBackground}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-6">
            {/* Enable/Disable */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="font-medium text-gray-900 dark:text-white">Enable Chroma Key</span>
              <button
                onClick={() => onSettingsChange({ ...settings, enable: !settings.enable })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.enable ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.enable ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Key Color Picker */}
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Key Color
              </h4>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-lg border-2 border-gray-300 dark:border-gray-600 cursor-pointer"
                    style={{ backgroundColor: `rgb(${settings.keyColor.r}, ${settings.keyColor.g}, ${settings.keyColor.b})` }}
                    onClick={() => setColorPickerActive(!colorPickerActive)}
                  />
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    RGB({settings.keyColor.r}, {settings.keyColor.g}, {settings.keyColor.b})
                  </div>
                </div>
                <button
                  onClick={() => setColorPickerActive(!colorPickerActive)}
                  className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                    colorPickerActive
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {colorPickerActive ? 'Cancel Color Picker' : 'Pick Color from Video'}
                </button>
              </div>
            </div>

            {/* Chroma Key Settings */}
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Sliders className="w-4 h-4" />
                Key Settings
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Similarity: {settings.similarity}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="255"
                    value={settings.similarity}
                    onChange={(e) => onSettingsChange({ ...settings, similarity: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Smoothness: {settings.smoothness}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={settings.smoothness}
                    onChange={(e) => onSettingsChange({ ...settings, smoothness: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Spill Suppression: {settings.spillSuppression}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={settings.spillSuppression}
                    onChange={(e) => onSettingsChange({ ...settings, spillSuppression: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Edge Feather: {settings.edgeFeather}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    value={settings.edgeFeather}
                    onChange={(e) => onSettingsChange({ ...settings, edgeFeather: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Matte Blur: {settings.matteBlur}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={settings.matteBlur}
                    onChange={(e) => onSettingsChange({ ...settings, matteBlur: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Preset Buttons */}
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">Presets</h4>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onSettingsChange({
                    ...settings,
                    keyColor: { r: 0, g: 255, b: 0 },
                    similarity: 50,
                    smoothness: 10
                  })}
                  className="px-3 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-sm font-medium hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                >
                  Green Screen
                </button>
                <button
                  onClick={() => onSettingsChange({
                    ...settings,
                    keyColor: { r: 0, g: 0, b: 255 },
                    similarity: 50,
                    smoothness: 10
                  })}
                  className="px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                >
                  Blue Screen
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

