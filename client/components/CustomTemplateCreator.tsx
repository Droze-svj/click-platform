'use client'

import { useState, useCallback } from 'react'
import {
  Palette,
  Type,
  Layout,
  Music,
  Zap,
  Save,
  Eye,
  RotateCcw,
  Upload,
  Download,
  Sparkles
} from 'lucide-react'
import {
  ColorPaletteIcon,
  TypographyIcon,
  TimelineIcon,
  AudioWaveIcon,
  EffectsIcon
} from './icons/VideoIcons'
import { useToast } from '../contexts/ToastContext'

interface CustomTemplateSettings {
  // Basic Info
  name: string
  description: string
  category: string
  targetAudience: string
  useCase: string

  // Technical Settings
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3' | '21:9'
  resolution: '720p' | '1080p' | '4K'
  frameRate: 24 | 30 | 60

  // Color Grading
  colorGrade: {
    brightness: number
    contrast: number
    saturation: number
    temperature: number
    tint: number
    vibrance: number
    highlights: number
    shadows: number
    clarity: number
    dehaze: number
  }

  // Typography
  typography: {
    primaryFont: string
    secondaryFont: string
    textColor: string
    accentColor: string
    textStyle: 'minimal' | 'bold' | 'elegant' | 'playful'
    fontSize: {
      title: number
      subtitle: number
    }
  }

  // Layout & Effects
  layout: {
    textPosition: 'top' | 'center' | 'bottom' | 'lower-third'
    logoPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
    transitionStyle: 'fade' | 'slide' | 'wipe' | 'zoom' | 'none'
    backgroundStyle: 'solid' | 'gradient' | 'blur' | 'none'
    backgroundColor: string
    gradientStart: string
    gradientEnd: string
  }

  // Audio
  audio: {
    backgroundMusic: boolean
    soundEffects: boolean
    voiceover: boolean
    musicStyle: 'upbeat' | 'calm' | 'dramatic' | 'corporate' | 'none'
    musicVolume: number
  }

  // Effects & Filters
  effects: {
    vignette: boolean
    vignetteIntensity: number
    grain: boolean
    grainIntensity: number
    glow: boolean
    glowIntensity: number
    chromaticAberration: boolean
    colorPop: boolean
    colorPopColor: string
  }

  // Text Overlays
  textOverlays: Array<{
    id: string
    text: string
    position: { x: number, y: number }
    fontSize: number
    color: string
    fontFamily: string
    startTime: number
    endTime: number
    animation: 'fade-in' | 'slide-up' | 'scale' | 'typewriter' | 'bounce' | 'none'
    style: 'normal' | 'bold' | 'italic' | 'uppercase'
  }>
}

const fontOptions = [
  'Inter', 'Roboto', 'Open Sans', 'Poppins', 'Montserrat',
  'Playfair Display', 'Cinzel', 'Great Vibes', 'Orbitron',
  'Courier Prime', 'Comfortaa', 'Nunito', 'Quicksand'
]

const colorPresets = [
  { name: 'White', value: '#FFFFFF' },
  { name: 'Black', value: '#000000' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Green', value: '#10B981' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Orange', value: '#F59E0B' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Cyan', value: '#06B6D4' },
  { name: 'Teal', value: '#14B8A6' }
]

const gradientPresets = [
  { name: 'Sunset', start: '#FF6B6B', end: '#FFA500' },
  { name: 'Ocean', start: '#00FFFF', end: '#0080FF' },
  { name: 'Forest', start: '#228B22', end: '#32CD32' },
  { name: 'Royal', start: '#4169E1', end: '#8A2BE2' },
  { name: 'Fire', start: '#FF4500', end: '#FFD700' },
  { name: 'Ice', start: '#87CEEB', end: '#FFFFFF' }
]

interface CustomTemplateCreatorProps {
  initialTemplate?: Partial<CustomTemplateSettings>
  onSave: (template: CustomTemplateSettings) => void
  onPreview?: (template: CustomTemplateSettings) => void
  onCancel?: () => void
}

export default function CustomTemplateCreator({
  initialTemplate,
  onSave,
  onPreview,
  onCancel
}: CustomTemplateCreatorProps) {
  const [activeTab, setActiveTab] = useState('basic')
  const [template, setTemplate] = useState<CustomTemplateSettings>({
    name: initialTemplate?.name || '',
    description: initialTemplate?.description || '',
    category: initialTemplate?.category || 'Custom',
    targetAudience: initialTemplate?.targetAudience || '',
    useCase: initialTemplate?.useCase || '',
    aspectRatio: initialTemplate?.aspectRatio || '16:9',
    resolution: initialTemplate?.resolution || '1080p',
    frameRate: initialTemplate?.frameRate || 30,
    colorGrade: initialTemplate?.colorGrade || {
      brightness: 100,
      contrast: 100,
      saturation: 100,
      temperature: 5500,
      tint: 0,
      vibrance: 0,
      highlights: 0,
      shadows: 0,
      clarity: 0,
      dehaze: 0
    },
    typography: initialTemplate?.typography || {
      primaryFont: 'Inter',
      secondaryFont: 'Open Sans',
      textColor: '#FFFFFF',
      accentColor: '#3B82F6',
      textStyle: 'minimal',
      fontSize: { title: 48, subtitle: 24 }
    },
    layout: initialTemplate?.layout || {
      textPosition: 'center',
      logoPosition: 'bottom-right',
      transitionStyle: 'fade',
      backgroundStyle: 'none',
      backgroundColor: '#000000',
      gradientStart: '#000000',
      gradientEnd: '#FFFFFF'
    },
    audio: initialTemplate?.audio || {
      backgroundMusic: false,
      soundEffects: false,
      voiceover: false,
      musicStyle: 'none',
      musicVolume: 50
    },
    effects: initialTemplate?.effects || {
      vignette: false,
      vignetteIntensity: 50,
      grain: false,
      grainIntensity: 50,
      glow: false,
      glowIntensity: 50,
      chromaticAberration: false,
      colorPop: false,
      colorPopColor: '#FF6B6B'
    },
    textOverlays: initialTemplate?.textOverlays || []
  })

  const { showToast } = useToast()

  const updateTemplate = useCallback((updates: Partial<CustomTemplateSettings>) => {
    setTemplate(prev => ({ ...prev, ...updates }))
  }, [])

  const updateNestedTemplate = useCallback((path: string, value: any) => {
    setTemplate(prev => {
      const keys = path.split('.')
      const newTemplate = { ...prev }
      let current = newTemplate as any

      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {}
        current = current[keys[i]]
      }

      current[keys[keys.length - 1]] = value
      return newTemplate
    })
  }, [])

  const addTextOverlay = useCallback(() => {
    const newOverlay = {
      id: `overlay-${Date.now()}`,
      text: 'Your Text Here',
      position: { x: 50, y: 50 },
      fontSize: template.typography.fontSize.subtitle,
      color: template.typography.textColor,
      fontFamily: template.typography.primaryFont,
      startTime: 0,
      endTime: 5,
      animation: 'fade-in' as const,
      style: 'normal' as const
    }

    setTemplate(prev => ({
      ...prev,
      textOverlays: [...prev.textOverlays, newOverlay]
    }))
  }, [template.typography])

  const removeTextOverlay = useCallback((id: string) => {
    setTemplate(prev => ({
      ...prev,
      textOverlays: prev.textOverlays.filter(overlay => overlay.id !== id)
    }))
  }, [])

  const updateTextOverlay = useCallback((id: string, updates: Partial<CustomTemplateSettings['textOverlays'][0]>) => {
    setTemplate(prev => ({
      ...prev,
      textOverlays: prev.textOverlays.map(overlay =>
        overlay.id === id ? { ...overlay, ...updates } : overlay
      )
    }))
  }, [])

  const handleSave = useCallback(() => {
    if (!template.name.trim()) {
      showToast('Please enter a template name', 'error')
      return
    }

    onSave(template)
    showToast('Custom template saved successfully!', 'success')
  }, [template, onSave, showToast])

  const handlePreview = useCallback(() => {
    onPreview?.(template)
  }, [template, onPreview])

  const resetToDefaults = useCallback(() => {
    setTemplate({
      name: '',
      description: '',
      category: 'Custom',
      targetAudience: '',
      useCase: '',
      aspectRatio: '16:9',
      resolution: '1080p',
      frameRate: 30,
      colorGrade: {
        brightness: 100,
        contrast: 100,
        saturation: 100,
        temperature: 5500,
        tint: 0,
        vibrance: 0,
        highlights: 0,
        shadows: 0,
        clarity: 0,
        dehaze: 0
      },
      typography: {
        primaryFont: 'Inter',
        secondaryFont: 'Open Sans',
        textColor: '#FFFFFF',
        accentColor: '#3B82F6',
        textStyle: 'minimal',
        fontSize: { title: 48, subtitle: 24 }
      },
      layout: {
        textPosition: 'center',
        logoPosition: 'bottom-right',
        transitionStyle: 'fade',
        backgroundStyle: 'none',
        backgroundColor: '#000000',
        gradientStart: '#000000',
        gradientEnd: '#FFFFFF'
      },
      audio: {
        backgroundMusic: false,
        soundEffects: false,
        voiceover: false,
        musicStyle: 'none',
        musicVolume: 50
      },
      effects: {
        vignette: false,
        vignetteIntensity: 50,
        grain: false,
        grainIntensity: 50,
        glow: false,
        glowIntensity: 50,
        chromaticAberration: false,
        colorPop: false,
        colorPopColor: '#FF6B6B'
      },
      textOverlays: []
    })
    showToast('Template reset to defaults', 'info')
  }, [showToast])

  const tabs = [
    { id: 'basic', label: 'Basic', icon: Save },
    { id: 'colors', label: 'Colors', icon: ColorPaletteIcon },
    { id: 'typography', label: 'Text', icon: TypographyIcon },
    { id: 'layout', label: 'Layout', icon: TimelineIcon },
    { id: 'audio', label: 'Audio', icon: AudioWaveIcon },
    { id: 'effects', label: 'Effects', icon: EffectsIcon }
  ]

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Custom Template Creator
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Design your perfect video editing style with complete customization
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={resetToDefaults}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <RotateCcw className="w-4 h-4 inline mr-2" />
              Reset
            </button>
            <button
              onClick={handlePreview}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Eye className="w-4 h-4 inline mr-2" />
              Preview
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-200 transform hover:scale-105 shadow-lg"
            >
              <Save className="w-4 h-4 inline mr-2" />
              Save Template
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 mb-8 bg-gray-100 dark:bg-gray-800 p-2 rounded-xl">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-gray-700 shadow-md text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-700/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-8">
          {activeTab === 'basic' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Template Name *
                    </label>
                    <input
                      type="text"
                      value={template.name}
                      onChange={(e) => updateTemplate({ name: e.target.value })}
                      placeholder="My Custom Template"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Description
                    </label>
                    <textarea
                      value={template.description}
                      onChange={(e) => updateTemplate({ description: e.target.value })}
                      placeholder="Describe your template style..."
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Category
                    </label>
                    <select
                      value={template.category}
                      onChange={(e) => updateTemplate({ category: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="Custom">Custom</option>
                      <option value="Cinematic">Cinematic</option>
                      <option value="Social Media">Social Media</option>
                      <option value="Business">Business</option>
                      <option value="Vlog">Vlog</option>
                      <option value="Gaming">Gaming</option>
                      <option value="Wedding">Wedding</option>
                      <option value="Educational">Educational</option>
                      <option value="Vintage">Vintage</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Target Audience
                    </label>
                    <input
                      type="text"
                      value={template.targetAudience}
                      onChange={(e) => updateTemplate({ targetAudience: e.target.value })}
                      placeholder="e.g., Content creators, businesses"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Use Case
                    </label>
                    <input
                      type="text"
                      value={template.useCase}
                      onChange={(e) => updateTemplate({ useCase: e.target.value })}
                      placeholder="e.g., Product demos, tutorials"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Aspect Ratio
                      </label>
                      <select
                        value={template.aspectRatio}
                        onChange={(e) => updateTemplate({ aspectRatio: e.target.value as any })}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="16:9">16:9</option>
                        <option value="9:16">9:16</option>
                        <option value="1:1">1:1</option>
                        <option value="4:3">4:3</option>
                        <option value="21:9">21:9</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Resolution
                      </label>
                      <select
                        value={template.resolution}
                        onChange={(e) => updateTemplate({ resolution: e.target.value as any })}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="720p">720p</option>
                        <option value="1080p">1080p</option>
                        <option value="4K">4K</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Frame Rate
                      </label>
                      <select
                        value={template.frameRate}
                        onChange={(e) => updateTemplate({ frameRate: parseInt(e.target.value) as any })}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value={24}>24fps</option>
                        <option value={30}>30fps</option>
                        <option value={60}>60fps</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'colors' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Basic Adjustments</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Brightness: {template.colorGrade.brightness}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="200"
                        value={template.colorGrade.brightness}
                        onChange={(e) => updateNestedTemplate('colorGrade.brightness', parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Contrast: {template.colorGrade.contrast}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="200"
                        value={template.colorGrade.contrast}
                        onChange={(e) => updateNestedTemplate('colorGrade.contrast', parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Saturation: {template.colorGrade.saturation}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="200"
                        value={template.colorGrade.saturation}
                        onChange={(e) => updateNestedTemplate('colorGrade.saturation', parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Vibrance: {template.colorGrade.vibrance}%
                      </label>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        value={template.colorGrade.vibrance}
                        onChange={(e) => updateNestedTemplate('colorGrade.vibrance', parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Advanced Color</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Temperature: {template.colorGrade.temperature}K
                      </label>
                      <input
                        type="range"
                        min="2000"
                        max="12000"
                        value={template.colorGrade.temperature}
                        onChange={(e) => updateNestedTemplate('colorGrade.temperature', parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Tint: {template.colorGrade.tint}
                      </label>
                      <input
                        type="range"
                        min="-50"
                        max="50"
                        value={template.colorGrade.tint}
                        onChange={(e) => updateNestedTemplate('colorGrade.tint', parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Highlights: {template.colorGrade.highlights}
                      </label>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        value={template.colorGrade.highlights}
                        onChange={(e) => updateNestedTemplate('colorGrade.highlights', parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Shadows: {template.colorGrade.shadows}
                      </label>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        value={template.colorGrade.shadows}
                        onChange={(e) => updateNestedTemplate('colorGrade.shadows', parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Clarity: {template.colorGrade.clarity}
                      </label>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        value={template.colorGrade.clarity}
                        onChange={(e) => updateNestedTemplate('colorGrade.clarity', parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Dehaze: {template.colorGrade.dehaze}
                      </label>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        value={template.colorGrade.dehaze}
                        onChange={(e) => updateNestedTemplate('colorGrade.dehaze', parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'typography' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Font Selection</h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Primary Font
                    </label>
                    <select
                      value={template.typography.primaryFont}
                      onChange={(e) => updateNestedTemplate('typography.primaryFont', e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {fontOptions.map(font => (
                        <option key={font} value={font} style={{ fontFamily: font }}>
                          {font}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Secondary Font
                    </label>
                    <select
                      value={template.typography.secondaryFont}
                      onChange={(e) => updateNestedTemplate('typography.secondaryFont', e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {fontOptions.map(font => (
                        <option key={font} value={font} style={{ fontFamily: font }}>
                          {font}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Text Style
                    </label>
                    <select
                      value={template.typography.textStyle}
                      onChange={(e) => updateNestedTemplate('typography.textStyle', e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="minimal">Minimal</option>
                      <option value="bold">Bold</option>
                      <option value="elegant">Elegant</option>
                      <option value="playful">Playful</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Colors & Sizes</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Primary Color
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={template.typography.textColor}
                          onChange={(e) => updateNestedTemplate('typography.textColor', e.target.value)}
                          className="w-12 h-10 rounded border border-gray-200 dark:border-gray-600"
                        />
                        <input
                          type="text"
                          value={template.typography.textColor}
                          onChange={(e) => updateNestedTemplate('typography.textColor', e.target.value)}
                          className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Accent Color
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={template.typography.accentColor}
                          onChange={(e) => updateNestedTemplate('typography.accentColor', e.target.value)}
                          className="w-12 h-10 rounded border border-gray-200 dark:border-gray-600"
                        />
                        <input
                          type="text"
                          value={template.typography.accentColor}
                          onChange={(e) => updateNestedTemplate('typography.accentColor', e.target.value)}
                          className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Font Sizes
                    </label>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Title</label>
                        <input
                          type="number"
                          min="12"
                          max="120"
                          value={template.typography.fontSize.title}
                          onChange={(e) => updateNestedTemplate('typography.fontSize.title', parseInt(e.target.value))}
                          className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Subtitle</label>
                        <input
                          type="number"
                          min="8"
                          max="80"
                          value={template.typography.fontSize.subtitle}
                          onChange={(e) => updateNestedTemplate('typography.fontSize.subtitle', parseInt(e.target.value))}
                          className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Body</label>
                        <input
                          type="number"
                          min="8"
                          max="60"
                          value={template.typography.fontSize.subtitle}
                          onChange={(e) => updateNestedTemplate('typography.fontSize.subtitle', parseInt(e.target.value))}
                          className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Text Overlays Section */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Text Overlays</h3>
                  <button
                    onClick={addTextOverlay}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    Add Text Overlay
                  </button>
                </div>

                <div className="space-y-4">
                  {template.textOverlays.map((overlay, index) => (
                    <div key={overlay.id} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Text
                          </label>
                          <input
                            type="text"
                            value={overlay.text}
                            onChange={(e) => updateTextOverlay(overlay.id, { text: e.target.value })}
                            className="w-full px-3 py-2 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Font Size
                          </label>
                          <input
                            type="number"
                            min="8"
                            max="120"
                            value={overlay.fontSize}
                            onChange={(e) => updateTextOverlay(overlay.id, { fontSize: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Animation
                          </label>
                          <select
                            value={overlay.animation}
                            onChange={(e) => updateTextOverlay(overlay.id, { animation: e.target.value as any })}
                            className="w-full px-3 py-2 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="none">None</option>
                            <option value="fade-in">Fade In</option>
                            <option value="slide-up">Slide Up</option>
                            <option value="scale">Scale</option>
                            <option value="typewriter">Typewriter</option>
                            <option value="bounce">Bounce</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Style
                          </label>
                          <select
                            value={overlay.style}
                            onChange={(e) => updateTextOverlay(overlay.id, { style: e.target.value as any })}
                            className="w-full px-3 py-2 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="normal">Normal</option>
                            <option value="bold">Bold</option>
                            <option value="italic">Italic</option>
                            <option value="uppercase">Uppercase</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div>
                            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                              Position (X: {overlay.position.x}%, Y: {overlay.position.y}%)
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={overlay.position.x}
                                onChange={(e) => updateTextOverlay(overlay.id, {
                                  position: { ...overlay.position, x: parseInt(e.target.value) }
                                })}
                                className="w-20"
                              />
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={overlay.position.y}
                                onChange={(e) => updateTextOverlay(overlay.id, {
                                  position: { ...overlay.position, y: parseInt(e.target.value) }
                                })}
                                className="w-20"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                              Color
                            </label>
                            <input
                              type="color"
                              value={overlay.color}
                              onChange={(e) => updateTextOverlay(overlay.id, { color: e.target.value })}
                              className="w-8 h-8 rounded border border-gray-200 dark:border-gray-500"
                            />
                          </div>
                        </div>

                        <button
                          onClick={() => removeTextOverlay(overlay.id)}
                          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}

                  {template.textOverlays.length === 0 && (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <Type className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No text overlays added yet</p>
                      <p className="text-sm">Click "Add Text Overlay" to create custom text elements</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'layout' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Layout Settings</h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Text Position
                    </label>
                    <select
                      value={template.layout.textPosition}
                      onChange={(e) => updateNestedTemplate('layout.textPosition', e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="top">Top</option>
                      <option value="center">Center</option>
                      <option value="bottom">Bottom</option>
                      <option value="lower-third">Lower Third</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Logo Position
                    </label>
                    <select
                      value={template.layout.logoPosition}
                      onChange={(e) => updateNestedTemplate('layout.logoPosition', e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="top-left">Top Left</option>
                      <option value="top-right">Top Right</option>
                      <option value="bottom-left">Bottom Left</option>
                      <option value="bottom-right">Bottom Right</option>
                      <option value="center">Center</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Transition Style
                    </label>
                    <select
                      value={template.layout.transitionStyle}
                      onChange={(e) => updateNestedTemplate('layout.transitionStyle', e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="none">None</option>
                      <option value="fade">Fade</option>
                      <option value="slide">Slide</option>
                      <option value="wipe">Wipe</option>
                      <option value="zoom">Zoom</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Background</h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Background Style
                    </label>
                    <select
                      value={template.layout.backgroundStyle}
                      onChange={(e) => updateNestedTemplate('layout.backgroundStyle', e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="none">None</option>
                      <option value="solid">Solid Color</option>
                      <option value="gradient">Gradient</option>
                      <option value="blur">Blur</option>
                    </select>
                  </div>

                  {template.layout.backgroundStyle === 'solid' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Background Color
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={template.layout.backgroundColor}
                          onChange={(e) => updateNestedTemplate('layout.backgroundColor', e.target.value)}
                          className="w-12 h-10 rounded border border-gray-200 dark:border-gray-600"
                        />
                        <input
                          type="text"
                          value={template.layout.backgroundColor}
                          onChange={(e) => updateNestedTemplate('layout.backgroundColor', e.target.value)}
                          className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  )}

                  {template.layout.backgroundStyle === 'gradient' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Gradient Start
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={template.layout.gradientStart}
                            onChange={(e) => updateNestedTemplate('layout.gradientStart', e.target.value)}
                            className="w-12 h-10 rounded border border-gray-200 dark:border-gray-600"
                          />
                          <input
                            type="text"
                            value={template.layout.gradientStart}
                            onChange={(e) => updateNestedTemplate('layout.gradientStart', e.target.value)}
                            className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Gradient End
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={template.layout.gradientEnd}
                            onChange={(e) => updateNestedTemplate('layout.gradientEnd', e.target.value)}
                            className="w-12 h-10 rounded border border-gray-200 dark:border-gray-600"
                          />
                          <input
                            type="text"
                            value={template.layout.gradientEnd}
                            onChange={(e) => updateNestedTemplate('layout.gradientEnd', e.target.value)}
                            className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'audio' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Audio Settings</h3>

                  <div className="space-y-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={template.audio.backgroundMusic}
                        onChange={(e) => updateNestedTemplate('audio.backgroundMusic', e.target.checked)}
                        className="mr-3 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Background Music</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={template.audio.soundEffects}
                        onChange={(e) => updateNestedTemplate('audio.soundEffects', e.target.checked)}
                        className="mr-3 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Sound Effects</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={template.audio.voiceover}
                        onChange={(e) => updateNestedTemplate('audio.voiceover', e.target.checked)}
                        className="mr-3 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Voiceover</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Music Preferences</h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Music Style
                    </label>
                    <select
                      value={template.audio.musicStyle}
                      onChange={(e) => updateNestedTemplate('audio.musicStyle', e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="none">None</option>
                      <option value="upbeat">Upbeat</option>
                      <option value="calm">Calm</option>
                      <option value="dramatic">Dramatic</option>
                      <option value="corporate">Corporate</option>
                    </select>
                  </div>

                  {template.audio.backgroundMusic && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Music Volume: {template.audio.musicVolume}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={template.audio.musicVolume}
                        onChange={(e) => updateNestedTemplate('audio.musicVolume', parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'effects' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Visual Effects</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Vignette</span>
                        <input
                          type="checkbox"
                          checked={template.effects.vignette}
                          onChange={(e) => updateNestedTemplate('effects.vignette', e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                        />
                      </label>
                      {template.effects.vignette && (
                        <div className="mt-2">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={template.effects.vignetteIntensity}
                            onChange={(e) => updateNestedTemplate('effects.vignetteIntensity', parseInt(e.target.value))}
                            className="w-full"
                          />
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Intensity: {template.effects.vignetteIntensity}%
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Grain</span>
                        <input
                          type="checkbox"
                          checked={template.effects.grain}
                          onChange={(e) => updateNestedTemplate('effects.grain', e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                        />
                      </label>
                      {template.effects.grain && (
                        <div className="mt-2">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={template.effects.grainIntensity}
                            onChange={(e) => updateNestedTemplate('effects.grainIntensity', parseInt(e.target.value))}
                            className="w-full"
                          />
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Intensity: {template.effects.grainIntensity}%
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Glow</span>
                        <input
                          type="checkbox"
                          checked={template.effects.glow}
                          onChange={(e) => updateNestedTemplate('effects.glow', e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                        />
                      </label>
                      {template.effects.glow && (
                        <div className="mt-2">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={template.effects.glowIntensity}
                            onChange={(e) => updateNestedTemplate('effects.glowIntensity', parseInt(e.target.value))}
                            className="w-full"
                          />
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Intensity: {template.effects.glowIntensity}%
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Advanced Effects</h3>

                  <div className="space-y-4">
                    <label className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Chromatic Aberration</span>
                      <input
                        type="checkbox"
                        checked={template.effects.chromaticAberration}
                        onChange={(e) => updateNestedTemplate('effects.chromaticAberration', e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                    </label>

                    <div>
                      <label className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Color Pop</span>
                        <input
                          type="checkbox"
                          checked={template.effects.colorPop}
                          onChange={(e) => updateNestedTemplate('effects.colorPop', e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                        />
                      </label>
                      {template.effects.colorPop && (
                        <div className="mt-2">
                          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                            Pop Color
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={template.effects.colorPopColor}
                              onChange={(e) => updateNestedTemplate('effects.colorPopColor', e.target.value)}
                              className="w-12 h-10 rounded border border-gray-200 dark:border-gray-600"
                            />
                            <input
                              type="text"
                              value={template.effects.colorPopColor}
                              onChange={(e) => updateNestedTemplate('effects.colorPopColor', e.target.value)}
                              className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
