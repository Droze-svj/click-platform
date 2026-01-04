'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Sliders, RotateCcw, Download, Upload, Palette, Eye, EyeOff } from 'lucide-react'

interface ColorGradeSettings {
  brightness: number
  contrast: number
  saturation: number
  hue: number
  temperature: number
  tint: number
  highlights: number
  shadows: number
  clarity: number
  dehaze: number
  vibrance: number
  exposure: number
  gamma: number
  blacks: number
  whites: number
  lift: { r: number, g: number, b: number }
  gammaLift: { r: number, g: number, b: number }
  gain: { r: number, g: number, b: number }
  offset: { r: number, g: number, b: number }
  curves: {
    master: number[]
    red: number[]
    green: number[]
    blue: number[]
  }
}

interface AdvancedColorGradingProps {
  currentSettings: Partial<ColorGradeSettings>
  onSettingsChange: (settings: Partial<ColorGradeSettings>) => void
  previewImage?: string
}

export default function AdvancedColorGrading({
  currentSettings,
  onSettingsChange,
  previewImage
}: AdvancedColorGradingProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [activeTab, setActiveTab] = useState<'basic' | 'advanced' | 'curves' | 'scopes'>('basic')
  const [showPreview, setShowPreview] = useState(true)
  const [draggedPoint, setDraggedPoint] = useState<{ curve: keyof ColorGradeSettings['curves'], index: number } | null>(null)

  const defaultSettings: ColorGradeSettings = {
    brightness: 100,
    contrast: 100,
    saturation: 100,
    hue: 0,
    temperature: 100,
    tint: 0,
    highlights: 0,
    shadows: 0,
    clarity: 0,
    dehaze: 0,
    vibrance: 100,
    exposure: 0,
    gamma: 100,
    blacks: 0,
    whites: 100,
    lift: { r: 0, g: 0, b: 0 },
    gammaLift: { r: 100, g: 100, b: 100 },
    gain: { r: 100, g: 100, b: 100 },
    offset: { r: 0, g: 0, b: 0 },
    curves: {
      master: [0, 25, 50, 75, 100],
      red: [0, 25, 50, 75, 100],
      green: [0, 25, 50, 75, 100],
      blue: [0, 25, 50, 75, 100]
    }
  }

  const settings = { ...defaultSettings, ...currentSettings }

  const updateSetting = useCallback((key: keyof ColorGradeSettings, value: any) => {
    onSettingsChange({ ...settings, [key]: value })
  }, [settings, onSettingsChange])

  const updateNestedSetting = useCallback((key: keyof ColorGradeSettings, subKey: string, value: number) => {
    const current = settings[key] as any
    onSettingsChange({
      ...settings,
      [key]: { ...current, [subKey]: value }
    })
  }, [settings, onSettingsChange])

  const resetSettings = useCallback(() => {
    onSettingsChange(defaultSettings)
  }, [onSettingsChange])

  const exportSettings = useCallback(() => {
    const dataStr = JSON.stringify(settings, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)

    const exportFileDefaultName = 'color-grade-settings.json'

    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }, [settings])

  const importSettings = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const importedSettings = JSON.parse(e.target?.result as string)
        onSettingsChange({ ...defaultSettings, ...importedSettings })
      } catch (error) {
        console.error('Failed to import settings:', error)
      }
    }
    reader.readAsText(file)
  }, [onSettingsChange])

  // Draw curves on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Draw grid
    ctx.strokeStyle = '#374151'
    ctx.lineWidth = 1
    for (let i = 0; i <= 10; i++) {
      const x = (i / 10) * width
      const y = (i / 10) * height
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    // Draw diagonal line
    ctx.strokeStyle = '#6B7280'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, height)
    ctx.lineTo(width, 0)
    ctx.stroke()

    // Draw curves
    const drawCurve = (points: number[], color: string) => {
      ctx.strokeStyle = color
      ctx.lineWidth = 3
      ctx.beginPath()

      points.forEach((point, index) => {
        const x = (index / (points.length - 1)) * width
        const y = height - (point / 100) * height

        if (index === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })

      ctx.stroke()

      // Draw points
      points.forEach((point, index) => {
        const x = (index / (points.length - 1)) * width
        const y = height - (point / 100) * height

        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(x, y, 6, 0, 2 * Math.PI)
        ctx.fill()

        ctx.strokeStyle = '#FFFFFF'
        ctx.lineWidth = 2
        ctx.stroke()
      })
    }

    drawCurve(settings.curves.master, '#FFFFFF')
    drawCurve(settings.curves.red, '#EF4444')
    drawCurve(settings.curves.green, '#10B981')
    drawCurve(settings.curves.blue, '#3B82F6')
  }, [settings.curves, activeTab])

  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    const curveIndex = Math.round((x / canvas.width) * 4)
    const curveValue = Math.round(((canvas.height - y) / canvas.height) * 100)

    const curveNames: (keyof ColorGradeSettings['curves'])[] = ['master', 'red', 'green', 'blue']
    const currentCurve = curveNames[activeTab === 'curves' ? 0 : 1] // Simplified for demo

    if (curveIndex >= 0 && curveIndex <= 4) {
      const newCurves = { ...settings.curves }
      newCurves[currentCurve][curveIndex] = Math.max(0, Math.min(100, curveValue))
      updateSetting('curves', newCurves)
    }
  }, [settings.curves, activeTab, updateSetting])

  const tabs = [
    { id: 'basic', label: 'Basic', icon: Sliders },
    { id: 'advanced', label: 'Advanced', icon: Palette },
    { id: 'curves', label: 'Curves', icon: Palette },
    { id: 'scopes', label: 'Scopes', icon: Eye }
  ]

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Advanced Color Grading
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Professional color correction and grading tools
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`p-2 rounded-lg transition-colors ${
                showPreview
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              {showPreview ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
            <button
              onClick={resetSettings}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-600 dark:text-gray-400"
              title="Reset all settings"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <label className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-600 dark:text-gray-400 cursor-pointer">
              <Upload className="w-4 h-4" />
              <input
                type="file"
                accept=".json"
                onChange={importSettings}
                className="hidden"
              />
            </label>
            <button
              onClick={exportSettings}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-600 dark:text-gray-400"
              title="Export settings"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 p-4 text-center transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-b-2 border-blue-500 text-blue-700 dark:text-blue-300'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              <Icon className="w-5 h-5 mx-auto mb-1" />
              <div className="text-sm font-medium">{tab.label}</div>
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'basic' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {/* Brightness & Contrast */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 dark:text-white">Brightness & Contrast</h4>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Brightness: {settings.brightness}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={settings.brightness}
                  onChange={(e) => updateSetting('brightness', parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Contrast: {settings.contrast}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={settings.contrast}
                  onChange={(e) => updateSetting('contrast', parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>

            {/* Color */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 dark:text-white">Color</h4>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Saturation: {settings.saturation}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={settings.saturation}
                  onChange={(e) => updateSetting('saturation', parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Hue: {settings.hue}°
                </label>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  value={settings.hue}
                  onChange={(e) => updateSetting('hue', parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>

            {/* Temperature */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 dark:text-white">White Balance</h4>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Temperature: {settings.temperature}K
                </label>
                <input
                  type="range"
                  min="2000"
                  max="12000"
                  value={settings.temperature}
                  onChange={(e) => updateSetting('temperature', parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Tint: {settings.tint}
                </label>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={settings.tint}
                  onChange={(e) => updateSetting('tint', parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'advanced' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {/* Tone */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 dark:text-white">Tone</h4>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Highlights: {settings.highlights}
                </label>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={settings.highlights}
                  onChange={(e) => updateSetting('highlights', parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Shadows: {settings.shadows}
                </label>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={settings.shadows}
                  onChange={(e) => updateSetting('shadows', parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Clarity: {settings.clarity}
                </label>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={settings.clarity}
                  onChange={(e) => updateSetting('clarity', parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>

            {/* Detail */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 dark:text-white">Detail</h4>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Dehaze: {settings.dehaze}
                </label>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={settings.dehaze}
                  onChange={(e) => updateSetting('dehaze', parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Vibrance: {settings.vibrance}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={settings.vibrance}
                  onChange={(e) => updateSetting('vibrance', parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>

            {/* Exposure */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 dark:text-white">Exposure</h4>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Exposure: {settings.exposure}
                </label>
                <input
                  type="range"
                  min="-4"
                  max="4"
                  step="0.1"
                  value={settings.exposure}
                  onChange={(e) => updateSetting('exposure', parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Gamma: {settings.gamma}%
                </label>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={settings.gamma}
                  onChange={(e) => updateSetting('gamma', parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'curves' && (
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-lg p-4">
              <canvas
                ref={canvasRef}
                width={400}
                height={300}
                onClick={handleCanvasClick}
                className="w-full h-auto border border-gray-700 rounded cursor-crosshair"
              />
              <div className="flex justify-center gap-4 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-white rounded"></div>
                  <span className="text-gray-300">Master</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span className="text-gray-300">Red</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span className="text-gray-300">Green</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                  <span className="text-gray-300">Blue</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'scopes' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-900 rounded-lg p-4">
                <h4 className="text-white font-medium mb-2">Waveform</h4>
                <div className="h-32 bg-gray-800 rounded flex items-end justify-center">
                  <div className="text-gray-500 text-sm">Waveform Monitor</div>
                </div>
              </div>
              <div className="bg-gray-900 rounded-lg p-4">
                <h4 className="text-white font-medium mb-2">Vectorscope</h4>
                <div className="h-32 bg-gray-800 rounded flex items-center justify-center">
                  <div className="text-gray-500 text-sm">Vectorscope</div>
                </div>
              </div>
              <div className="bg-gray-900 rounded-lg p-4">
                <h4 className="text-white font-medium mb-2">Histogram</h4>
                <div className="h-32 bg-gray-800 rounded flex items-end justify-center">
                  <div className="text-gray-500 text-sm">RGB Histogram</div>
                </div>
              </div>
              <div className="bg-gray-900 rounded-lg p-4">
                <h4 className="text-white font-medium mb-2">RGB Parade</h4>
                <div className="h-32 bg-gray-800 rounded flex items-end justify-center">
                  <div className="text-gray-500 text-sm">RGB Parade</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}



