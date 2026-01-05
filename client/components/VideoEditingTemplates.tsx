'use client'

import { useState, useCallback } from 'react'
import {
  Film,
  Camera,
  Heart,
  Zap,
  Coffee,
  BookOpen,
  Briefcase,
  Music,
  Gamepad2,
  GraduationCap,
  Users,
  TrendingUp,
  Star,
  Sparkles,
  Palette,
  Type,
  Layout,
  Save,
  Upload,
  Trash2,
  Copy,
  Settings,
  Eye
} from 'lucide-react'
import {
  MovieClapperIcon,
  DSLRIcon,
  ColorPaletteIcon,
  TypographyIcon,
  TimelineIcon,
  AudioWaveIcon,
  EffectsIcon,
  AIIntelligenceIcon,
  ExportIcon
} from './icons/VideoIcons'
import { useToast } from '../contexts/ToastContext'
import { logTemplateError } from '../utils/errorHandler'

interface VideoTemplate {
  id: string
  name: string
  description: string
  category: string
  icon: any
  color: string
  bgGradient: string
  targetAudience: string
  useCase: string
  settings: {
    // Video Settings
    aspectRatio: '16:9' | '9:16' | '1:1' | '4:3' | '21:9'
    resolution: '1080p' | '4K' | '720p'
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
    }

    // Typography
    typography: {
      primaryFont: string
      secondaryFont: string
      textColor: string
      accentColor: string
      textStyle: 'minimal' | 'bold' | 'elegant' | 'playful'
    }

    // Layout & Effects
    layout: {
      textPosition: 'top' | 'center' | 'bottom' | 'lower-third'
      logoPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
      transitionStyle: 'fade' | 'slide' | 'wipe' | 'zoom' | 'none'
      backgroundStyle: 'solid' | 'gradient' | 'blur' | 'none'
    }

    // Audio
    audio: {
      backgroundMusic: boolean
      soundEffects: boolean
      voiceover: boolean
      musicStyle: 'upbeat' | 'calm' | 'dramatic' | 'corporate' | 'none'
    }

    // Effects & Filters
    effects: {
      vignette: boolean
      grain: boolean
      glow: boolean
      chromaticAberration: boolean
      colorPop: boolean
    }
  }

  // Pre-defined text overlays
  textOverlays: Array<{
    id: string
    text: string
    position: { x: number, y: number }
    fontSize: number
    color: string
    fontFamily: string
    startTime: number
    endTime: number
    animation: 'fade-in' | 'slide-up' | 'scale' | 'typewriter' | 'none'
  }>

  // Sample thumbnails
  thumbnail: string
  preview: string
}

interface VideoEditingTemplatesProps {
  onApplyTemplate: (template: VideoTemplate) => void
  currentTemplate?: VideoTemplate | null
  onSaveCustomTemplate?: (template: VideoTemplate) => void
  customTemplates?: VideoTemplate[]
}

const predefinedTemplates: VideoTemplate[] = [
  // Cinematic & Professional
  {
    id: 'cinematic-drama',
    name: 'Cinematic Drama',
    description: 'Hollywood-style color grading with dramatic lighting and elegant typography',
    category: 'Cinematic',
    icon: MovieClapperIcon,
    color: 'from-purple-600 to-blue-600',
    bgGradient: 'from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20',
    targetAudience: 'Film enthusiasts, storytellers',
    useCase: 'Movie trailers, dramatic content, artistic videos',
    settings: {
      aspectRatio: '21:9',
      resolution: '4K',
      frameRate: 24,
      colorGrade: {
        brightness: 95,
        contrast: 115,
        saturation: 110,
        temperature: 5500,
        tint: -5,
        vibrance: 15,
        highlights: -10,
        shadows: 15
      },
      typography: {
        primaryFont: 'Cinzel',
        secondaryFont: 'Montserrat',
        textColor: '#FFFFFF',
        accentColor: '#FFD700',
        textStyle: 'elegant'
      },
      layout: {
        textPosition: 'lower-third',
        logoPosition: 'bottom-right',
        transitionStyle: 'fade',
        backgroundStyle: 'blur'
      },
      audio: {
        backgroundMusic: true,
        soundEffects: true,
        voiceover: false,
        musicStyle: 'dramatic'
      },
      effects: {
        vignette: true,
        grain: true,
        glow: true,
        chromaticAberration: false,
        colorPop: false
      }
    },
    textOverlays: [
      {
        id: 'title',
        text: 'YOUR TITLE HERE',
        position: { x: 50, y: 40 },
        fontSize: 48,
        color: '#FFFFFF',
        fontFamily: 'Cinzel',
        startTime: 0,
        endTime: 5,
        animation: 'fade-in'
      },
      {
        id: 'subtitle',
        text: 'Epic cinematic experience',
        position: { x: 50, y: 60 },
        fontSize: 24,
        color: '#FFD700',
        fontFamily: 'Montserrat',
        startTime: 1,
        endTime: 5,
        animation: 'slide-up'
      }
    ],
    thumbnail: '/templates/cinematic-drama.jpg',
    preview: '/previews/cinematic-drama.mp4'
  },

  // Social Media & Viral
  {
    id: 'social-viral',
    name: 'Viral Social Media',
    description: 'Bright, energetic style optimized for TikTok, Instagram, and YouTube Shorts',
    category: 'Social Media',
    icon: TrendingUp,
    color: 'from-pink-500 to-orange-500',
    bgGradient: 'from-pink-50 to-orange-50 dark:from-pink-900/20 dark:to-orange-900/20',
    targetAudience: 'Content creators, influencers',
    useCase: 'Short-form content, viral videos, social media',
    settings: {
      aspectRatio: '9:16',
      resolution: '1080p',
      frameRate: 30,
      colorGrade: {
        brightness: 110,
        contrast: 120,
        saturation: 130,
        temperature: 6500,
        tint: 0,
        vibrance: 25,
        highlights: 15,
        shadows: -10
      },
      typography: {
        primaryFont: 'Poppins',
        secondaryFont: 'Inter',
        textColor: '#FFFFFF',
        accentColor: '#FF6B6B',
        textStyle: 'bold'
      },
      layout: {
        textPosition: 'center',
        logoPosition: 'top-right',
        transitionStyle: 'slide',
        backgroundStyle: 'gradient'
      },
      audio: {
        backgroundMusic: true,
        soundEffects: true,
        voiceover: true,
        musicStyle: 'upbeat'
      },
      effects: {
        vignette: false,
        grain: false,
        glow: true,
        chromaticAberration: false,
        colorPop: true
      }
    },
    textOverlays: [
      {
        id: 'hook',
        text: 'YOU WON\'T BELIEVE THIS!',
        position: { x: 50, y: 30 },
        fontSize: 36,
        color: '#FFFFFF',
        fontFamily: 'Poppins',
        startTime: 0,
        endTime: 3,
        animation: 'scale'
      },
      {
        id: 'cta',
        text: 'LIKE & SUBSCRIBE!',
        position: { x: 50, y: 80 },
        fontSize: 28,
        color: '#FF6B6B',
        fontFamily: 'Inter',
        startTime: 2,
        endTime: 5,
        animation: 'slide-up'
      }
    ],
    thumbnail: '/templates/social-viral.jpg',
    preview: '/previews/social-viral.mp4'
  },

  // Business & Corporate
  {
    id: 'corporate-professional',
    name: 'Corporate Professional',
    description: 'Clean, trustworthy aesthetic perfect for business presentations and explainer videos',
    category: 'Business',
    icon: Briefcase,
    color: 'from-blue-600 to-gray-600',
    bgGradient: 'from-blue-50 to-gray-50 dark:from-blue-900/20 dark:to-gray-900/20',
    targetAudience: 'Businesses, professionals',
    useCase: 'Presentations, tutorials, corporate videos',
    settings: {
      aspectRatio: '16:9',
      resolution: '1080p',
      frameRate: 30,
      colorGrade: {
        brightness: 100,
        contrast: 105,
        saturation: 95,
        temperature: 5500,
        tint: 0,
        vibrance: 5,
        highlights: -5,
        shadows: 5
      },
      typography: {
        primaryFont: 'Inter',
        secondaryFont: 'Open Sans',
        textColor: '#1F2937',
        accentColor: '#3B82F6',
        textStyle: 'minimal'
      },
      layout: {
        textPosition: 'lower-third',
        logoPosition: 'bottom-left',
        transitionStyle: 'fade',
        backgroundStyle: 'solid'
      },
      audio: {
        backgroundMusic: false,
        soundEffects: false,
        voiceover: true,
        musicStyle: 'corporate'
      },
      effects: {
        vignette: false,
        grain: false,
        glow: false,
        chromaticAberration: false,
        colorPop: false
      }
    },
    textOverlays: [
      {
        id: 'title',
        text: 'Professional Presentation',
        position: { x: 50, y: 75 },
        fontSize: 32,
        color: '#1F2937',
        fontFamily: 'Inter',
        startTime: 0,
        endTime: 5,
        animation: 'fade-in'
      },
      {
        id: 'company',
        text: 'Your Company Name',
        position: { x: 50, y: 85 },
        fontSize: 18,
        color: '#3B82F6',
        fontFamily: 'Open Sans',
        startTime: 0,
        endTime: 5,
        animation: 'fade-in'
      }
    ],
    thumbnail: '/templates/corporate-professional.jpg',
    preview: '/previews/corporate-professional.mp4'
  },

  // Vlog & Personal
  {
    id: 'vlog-authentic',
    name: 'Authentic Vlog',
    description: 'Warm, personal style that feels natural and approachable for vlogging',
    category: 'Vlog',
    icon: DSLRIcon,
    color: 'from-orange-500 to-red-500',
    bgGradient: 'from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20',
    targetAudience: 'Vloggers, content creators',
    useCase: 'Daily vlogs, travel videos, personal stories',
    settings: {
      aspectRatio: '9:16',
      resolution: '1080p',
      frameRate: 30,
      colorGrade: {
        brightness: 105,
        contrast: 110,
        saturation: 115,
        temperature: 6000,
        tint: 5,
        vibrance: 20,
        highlights: 5,
        shadows: 0
      },
      typography: {
        primaryFont: 'Nunito',
        secondaryFont: 'Quicksand',
        textColor: '#FFFFFF',
        accentColor: '#FF8A65',
        textStyle: 'playful'
      },
      layout: {
        textPosition: 'top',
        logoPosition: 'bottom-right',
        transitionStyle: 'slide',
        backgroundStyle: 'none'
      },
      audio: {
        backgroundMusic: true,
        soundEffects: true,
        voiceover: true,
        musicStyle: 'calm'
      },
      effects: {
        vignette: true,
        grain: true,
        glow: false,
        chromaticAberration: false,
        colorPop: false
      }
    },
    textOverlays: [
      {
        id: 'location',
        text: '📍 Amazing Location',
        position: { x: 10, y: 10 },
        fontSize: 20,
        color: '#FFFFFF',
        fontFamily: 'Nunito',
        startTime: 0,
        endTime: 3,
        animation: 'slide-up'
      },
      {
        id: 'day',
        text: 'Day 5 of Adventure',
        position: { x: 10, y: 15 },
        fontSize: 16,
        color: '#FF8A65',
        fontFamily: 'Quicksand',
        startTime: 0,
        endTime: 3,
        animation: 'fade-in'
      }
    ],
    thumbnail: '/templates/vlog-authentic.jpg',
    preview: '/previews/vlog-authentic.mp4'
  },

  // Gaming & Entertainment
  {
    id: 'gaming-dynamic',
    name: 'Gaming Dynamic',
    description: 'High-energy style with neon effects perfect for gaming content and entertainment',
    category: 'Gaming',
    icon: Gamepad2,
    color: 'from-cyan-500 to-purple-500',
    bgGradient: 'from-cyan-50 to-purple-50 dark:from-cyan-900/20 dark:to-purple-900/20',
    targetAudience: 'Gamers, entertainers',
    useCase: 'Gameplay videos, entertainment content',
    settings: {
      aspectRatio: '16:9',
      resolution: '1080p',
      frameRate: 60,
      colorGrade: {
        brightness: 115,
        contrast: 125,
        saturation: 140,
        temperature: 7000,
        tint: -10,
        vibrance: 30,
        highlights: 20,
        shadows: -15
      },
      typography: {
        primaryFont: 'Orbitron',
        secondaryFont: 'Rajdhani',
        textColor: '#00FFFF',
        accentColor: '#FF0080',
        textStyle: 'bold'
      },
      layout: {
        textPosition: 'center',
        logoPosition: 'top-left',
        transitionStyle: 'wipe',
        backgroundStyle: 'gradient'
      },
      audio: {
        backgroundMusic: true,
        soundEffects: true,
        voiceover: true,
        musicStyle: 'upbeat'
      },
      effects: {
        vignette: false,
        grain: false,
        glow: true,
        chromaticAberration: true,
        colorPop: true
      }
    },
    textOverlays: [
      {
        id: 'game-title',
        text: 'EPIC GAMEPLAY',
        position: { x: 50, y: 45 },
        fontSize: 42,
        color: '#00FFFF',
        fontFamily: 'Orbitron',
        startTime: 0,
        endTime: 4,
        animation: 'scale'
      },
      {
        id: 'score',
        text: 'HIGH SCORE: 999999',
        position: { x: 50, y: 55 },
        fontSize: 24,
        color: '#FF0080',
        fontFamily: 'Rajdhani',
        startTime: 1,
        endTime: 4,
        animation: 'slide-up'
      }
    ],
    thumbnail: '/templates/gaming-dynamic.jpg',
    preview: '/previews/gaming-dynamic.mp4'
  },

  // Wedding & Romantic
  {
    id: 'romantic-wedding',
    name: 'Romantic Wedding',
    description: 'Soft, romantic aesthetic with warm tones perfect for weddings and love stories',
    category: 'Wedding',
    icon: Heart,
    color: 'from-rose-500 to-pink-500',
    bgGradient: 'from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20',
    targetAudience: 'Couples, wedding planners',
    useCase: 'Wedding videos, love stories, romantic content',
    settings: {
      aspectRatio: '16:9',
      resolution: '4K',
      frameRate: 30,
      colorGrade: {
        brightness: 105,
        contrast: 108,
        saturation: 120,
        temperature: 4500,
        tint: 15,
        vibrance: 25,
        highlights: -5,
        shadows: 10
      },
      typography: {
        primaryFont: 'Great Vibes',
        secondaryFont: 'Playfair Display',
        textColor: '#FFFFFF',
        accentColor: '#FFB3BA',
        textStyle: 'elegant'
      },
      layout: {
        textPosition: 'center',
        logoPosition: 'bottom-left',
        transitionStyle: 'fade',
        backgroundStyle: 'blur'
      },
      audio: {
        backgroundMusic: true,
        soundEffects: false,
        voiceover: false,
        musicStyle: 'calm'
      },
      effects: {
        vignette: true,
        grain: true,
        glow: true,
        chromaticAberration: false,
        colorPop: false
      }
    },
    textOverlays: [
      {
        id: 'couple-names',
        text: 'Sarah & Michael',
        position: { x: 50, y: 40 },
        fontSize: 48,
        color: '#FFFFFF',
        fontFamily: 'Great Vibes',
        startTime: 0,
        endTime: 5,
        animation: 'fade-in'
      },
      {
        id: 'date',
        text: 'Forever Starts Today',
        position: { x: 50, y: 60 },
        fontSize: 24,
        color: '#FFB3BA',
        fontFamily: 'Playfair Display',
        startTime: 1,
        endTime: 5,
        animation: 'slide-up'
      }
    ],
    thumbnail: '/templates/romantic-wedding.jpg',
    preview: '/previews/romantic-wedding.mp4'
  },

  // Educational & Tutorial
  {
    id: 'educational-clear',
    name: 'Educational Clear',
    description: 'Clean, readable style optimized for learning with high contrast and clear typography',
    category: 'Educational',
    icon: BookOpen,
    color: 'from-green-600 to-teal-600',
    bgGradient: 'from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20',
    targetAudience: 'Educators, students',
    useCase: 'Tutorials, courses, educational content',
    settings: {
      aspectRatio: '16:9',
      resolution: '1080p',
      frameRate: 30,
      colorGrade: {
        brightness: 100,
        contrast: 105,
        saturation: 90,
        temperature: 5500,
        tint: 0,
        vibrance: 0,
        highlights: 0,
        shadows: 0
      },
      typography: {
        primaryFont: 'Roboto',
        secondaryFont: 'Open Sans',
        textColor: '#FFFFFF',
        accentColor: '#10B981',
        textStyle: 'minimal'
      },
      layout: {
        textPosition: 'lower-third',
        logoPosition: 'bottom-right',
        transitionStyle: 'fade',
        backgroundStyle: 'solid'
      },
      audio: {
        backgroundMusic: false,
        soundEffects: false,
        voiceover: true,
        musicStyle: 'none'
      },
      effects: {
        vignette: false,
        grain: false,
        glow: false,
        chromaticAberration: false,
        colorPop: false
      }
    },
    textOverlays: [
      {
        id: 'lesson-title',
        text: 'Introduction to Machine Learning',
        position: { x: 50, y: 75 },
        fontSize: 28,
        color: '#FFFFFF',
        fontFamily: 'Roboto',
        startTime: 0,
        endTime: 5,
        animation: 'fade-in'
      },
      {
        id: 'lesson-number',
        text: 'Lesson 1 of 10',
        position: { x: 50, y: 85 },
        fontSize: 18,
        color: '#10B981',
        fontFamily: 'Open Sans',
        startTime: 0,
        endTime: 5,
        animation: 'fade-in'
      }
    ],
    thumbnail: '/templates/educational-clear.jpg',
    preview: '/previews/educational-clear.mp4'
  },

  // Vintage & Retro
  {
    id: 'vintage-retro',
    name: 'Vintage Retro',
    description: 'Nostalgic 70s/80s aesthetic with warm colors and retro typography',
    category: 'Vintage',
    icon: Coffee,
    color: 'from-amber-600 to-orange-600',
    bgGradient: 'from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20',
    targetAudience: 'Nostalgia lovers, retro enthusiasts',
    useCase: 'Throwback content, retro aesthetics',
    settings: {
      aspectRatio: '4:3',
      resolution: '1080p',
      frameRate: 24,
      colorGrade: {
        brightness: 95,
        contrast: 110,
        saturation: 85,
        temperature: 3000,
        tint: 20,
        vibrance: 10,
        highlights: -15,
        shadows: 20
      },
      typography: {
        primaryFont: 'Courier Prime',
        secondaryFont: 'Comfortaa',
        textColor: '#FFFFFF',
        accentColor: '#F59E0B',
        textStyle: 'minimal'
      },
      layout: {
        textPosition: 'lower-third',
        logoPosition: 'bottom-left',
        transitionStyle: 'fade',
        backgroundStyle: 'blur'
      },
      audio: {
        backgroundMusic: true,
        soundEffects: false,
        voiceover: true,
        musicStyle: 'calm'
      },
      effects: {
        vignette: true,
        grain: true,
        glow: false,
        chromaticAberration: false,
        colorPop: false
      }
    },
    textOverlays: [
      {
        id: 'retro-title',
        text: 'RETRO VIBES',
        position: { x: 50, y: 75 },
        fontSize: 36,
        color: '#FFFFFF',
        fontFamily: 'Courier Prime',
        startTime: 0,
        endTime: 5,
        animation: 'typewriter'
      },
      {
        id: 'subtitle',
        text: 'Back to the Future',
        position: { x: 50, y: 85 },
        fontSize: 20,
        color: '#F59E0B',
        fontFamily: 'Comfortaa',
        startTime: 1,
        endTime: 5,
        animation: 'fade-in'
      }
    ],
    thumbnail: '/templates/vintage-retro.jpg',
    preview: '/previews/vintage-retro.mp4'
  }
]

export default function VideoEditingTemplates({
  onApplyTemplate,
  currentTemplate,
  onSaveCustomTemplate,
  customTemplates = []
}: VideoEditingTemplatesProps) {

  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showTemplateDetails, setShowTemplateDetails] = useState<string | null>(null)
  const [showCustomTemplates, setShowCustomTemplates] = useState(false)
  const { showToast } = useToast()

  const categories = [
    { id: 'all', name: 'All Templates', icon: Sparkles },
    { id: 'Cinematic', name: 'Cinematic', icon: MovieClapperIcon },
    { id: 'Social Media', name: 'Social Media', icon: TrendingUp },
    { id: 'Business', name: 'Business', icon: Briefcase },
    { id: 'Vlog', name: 'Vlog', icon: DSLRIcon },
    { id: 'Gaming', name: 'Gaming', icon: Gamepad2 },
    { id: 'Wedding', name: 'Wedding', icon: Heart },
    { id: 'Educational', name: 'Educational', icon: BookOpen },
    { id: 'Vintage', name: 'Vintage', icon: Coffee }
  ]

  const allTemplates = [...predefinedTemplates, ...customTemplates]

  const filteredTemplates = allTemplates.filter(template => {
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.targetAudience.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const handleApplyTemplate = useCallback((template: VideoTemplate) => {
    try {

      onApplyTemplate(template)
      showToast(`Applied "${template.name}" template`, 'success')
    } catch (error) {
      logTemplateError(template.id, 'apply', error)
      showToast('Failed to apply template. Please try again.', 'error')
    }
  }, [onApplyTemplate, showToast])

  const handleDuplicateTemplate = useCallback((template: VideoTemplate) => {
    const duplicatedTemplate = {
      ...template,
      id: `${template.id}-copy-${Date.now()}`,
      name: `${template.name} (Copy)`,
      category: 'Custom'
    }
    onSaveCustomTemplate?.(duplicatedTemplate)
    showToast('Template duplicated', 'success')
  }, [onSaveCustomTemplate, showToast])

  const handleDeleteTemplate = useCallback((templateId: string) => {
    // This would typically call an API to delete the template
    showToast('Template deleted', 'success')
  }, [showToast])

  const TemplateCard = ({ template, isCustom = false }: { template: VideoTemplate, isCustom?: boolean }) => {
    const Icon = template.icon

    return (
      <div className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${template.bgGradient} border border-gray-200/50 dark:border-gray-700/50 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105`}>
        {/* Template Image/Preview */}
        <div className="aspect-video bg-gray-200 dark:bg-gray-700 rounded-t-2xl overflow-hidden relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon className="w-16 h-16 text-gray-400" />
          </div>
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />

          {/* Overlay with quick actions */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 flex items-center justify-center gap-2">
            <button
              onClick={() => setShowTemplateDetails(template.id)}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
              title="View details"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDuplicateTemplate(template)}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
              title="Duplicate template"
            >
              <Copy className="w-4 h-4" />
            </button>
            {isCustom && (
              <button
                onClick={() => handleDeleteTemplate(template.id)}
                className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-full text-white transition-colors"
                title="Delete template"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Template Info */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">{template.name}</h3>
            {isCustom && (
              <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs rounded-full">
                Custom
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
            {template.description}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-500">
              {template.targetAudience}
            </span>
            <button
              onClick={() => handleApplyTemplate(template)}
              className={`px-4 py-2 bg-gradient-to-r ${template.color} text-white rounded-lg font-medium transition-all duration-200 transform hover:scale-105 shadow-md`}
            >
              Apply
            </button>
          </div>
        </div>

        {/* Category Badge */}
        <div className="absolute top-3 left-3">
          <span className="px-2 py-1 bg-white/90 dark:bg-gray-800/90 text-gray-700 dark:text-gray-300 text-xs rounded-full font-medium backdrop-blur-sm">
            {template.category}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Video Editing Templates
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Choose from professional templates or create your own custom styles
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCustomTemplates(!showCustomTemplates)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              showCustomTemplates
                ? 'bg-purple-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            My Templates
          </button>
          <button
            onClick={() => onSaveCustomTemplate?.({
              id: `custom-${Date.now()}`,
              name: 'Custom Template',
              description: 'Create your own template',
              category: 'Custom',
              icon: Sparkles,
              color: 'from-gray-600 to-gray-700',
              bgGradient: 'from-gray-50 to-gray-100 dark:from-gray-900/20 dark:to-gray-800/20',
              targetAudience: 'Custom',
              useCase: 'Custom use case',
              settings: {
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
                  shadows: 0
                },
                typography: {
                  primaryFont: 'Inter',
                  secondaryFont: 'Open Sans',
                  textColor: '#FFFFFF',
                  accentColor: '#3B82F6',
                  textStyle: 'minimal'
                },
                layout: {
                  textPosition: 'center',
                  logoPosition: 'bottom-right',
                  transitionStyle: 'fade',
                  backgroundStyle: 'none'
                },
                audio: {
                  backgroundMusic: false,
                  soundEffects: false,
                  voiceover: false,
                  musicStyle: 'none'
                },
                effects: {
                  vignette: false,
                  grain: false,
                  glow: false,
                  chromaticAberration: false,
                  colorPop: false
                }
              },
              textOverlays: [],
              thumbnail: '/templates/custom.jpg',
              preview: '/previews/custom.mp4'
            })}
            className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-medium hover:from-green-600 hover:to-emerald-700 transition-all duration-200 transform hover:scale-105 shadow-md"
          >
            <Save className="w-4 h-4 inline mr-2" />
            Create Custom
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <div className="flex gap-2">
          {categories.map(category => {
            const Icon = category.icon
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  selectedCategory === category.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                {category.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredTemplates.map(template => (
          <TemplateCard
            key={template.id}
            template={template}
            isCustom={customTemplates.some(ct => ct.id === template.id)}
          />
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <Sparkles className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No templates found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Try adjusting your search or create a custom template
          </p>
        </div>
      )}

      {/* Template Details Modal */}
      {showTemplateDetails && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {(() => {
              const template = allTemplates.find(t => t.id === showTemplateDetails)
              if (!template) return null

              const Icon = template.icon

              return (
                <>
                  {/* Header */}
                  <div className={`p-6 bg-gradient-to-r ${template.color}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-xl">
                          <Icon className="w-8 h-8 text-white" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold text-white">{template.name}</h2>
                          <p className="text-white/80">{template.description}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowTemplateDetails(null)}
                        className="p-2 hover:bg-white/20 rounded-lg text-white transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6 overflow-y-auto max-h-96">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Settings Overview */}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                          Template Settings
                        </h3>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Aspect Ratio:</span>
                            <span className="font-medium">{template.settings.aspectRatio}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Resolution:</span>
                            <span className="font-medium">{template.settings.resolution}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Frame Rate:</span>
                            <span className="font-medium">{template.settings.frameRate}fps</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Color Style:</span>
                            <span className="font-medium">{template.settings.typography.textStyle}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Transition:</span>
                            <span className="font-medium capitalize">{template.settings.layout.transitionStyle}</span>
                          </div>
                        </div>
                      </div>

                      {/* Text Overlays Preview */}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                          Text Overlays
                        </h3>
                        <div className="space-y-3">
                          {template.textOverlays.map(overlay => (
                            <div key={overlay.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                              <div className="font-medium text-sm mb-1">"{overlay.text}"</div>
                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                {overlay.fontSize}px • {overlay.fontFamily} • {overlay.animation}
                              </div>
                            </div>
                          ))}
                          {template.textOverlays.length === 0 && (
                            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                              No text overlays in this template
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => handleDuplicateTemplate(template)}
                        className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        <Copy className="w-4 h-4 inline mr-2" />
                        Duplicate
                      </button>
                      <button
                        onClick={() => {
                          handleApplyTemplate(template)
                          setShowTemplateDetails(null)
                        }}
                        className={`px-6 py-2 bg-gradient-to-r ${template.color} text-white rounded-lg font-medium hover:shadow-lg transition-all duration-200 transform hover:scale-105`}
                      >
                        Apply Template
                      </button>
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
