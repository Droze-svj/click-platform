'use client'

import { useState } from 'react'
import { Film, Moon, Sun, Sparkles, Zap, Heart, Camera, Palette, Star, Flame, Snowflake, Leaf } from 'lucide-react'

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

interface FilterPreset {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  filters: Partial<VideoFilter>
  category: 'cinematic' | 'creative' | 'vintage' | 'dramatic' | 'colorful' | 'moody'
  intensity?: number // 0-100 for preset strength
}

interface FilterPresetsProps {
  onApplyPreset: (filters: Partial<VideoFilter>) => void
  currentFilters: VideoFilter
}

export default function FilterPresets({ onApplyPreset, currentFilters }: FilterPresetsProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [hoveredPreset, setHoveredPreset] = useState<string | null>(null)

  const presets: FilterPreset[] = [
    // Cinematic
    {
      id: 'cinematic-movie',
      name: 'Cinematic',
      description: 'Hollywood-style dramatic look',
      icon: <Film className="w-5 h-5" />,
      category: 'cinematic',
      filters: {
        contrast: 120,
        saturation: 110,
        highlights: 15,
        shadows: -10,
        clarity: 20,
        vignette: 25,
        sharpen: 15,
        temperature: 105
      }
    },
    {
      id: 'dramatic-noir',
      name: 'Film Noir',
      description: 'High contrast black & white drama',
      icon: <Moon className="w-5 h-5" />,
      category: 'cinematic',
      filters: {
        contrast: 150,
        saturation: 0,
        brightness: 90,
        highlights: 30,
        shadows: -30,
        vignette: 35,
        sharpen: 20
      }
    },

    // Creative
    {
      id: 'vibrant-pop',
      name: 'Vibrant Pop',
      description: 'Bold, saturated colors',
      icon: <Sparkles className="w-5 h-5" />,
      category: 'creative',
      filters: {
        saturation: 140,
        vibrance: 120,
        contrast: 115,
        highlights: 10,
        clarity: 15
      }
    },
    {
      id: 'soft-dreamy',
      name: 'Soft Dreamy',
      description: 'Ethereal, gentle look',
      icon: <Heart className="w-5 h-5" />,
      category: 'creative',
      filters: {
        brightness: 105,
        contrast: 85,
        saturation: 90,
        highlights: 25,
        shadows: 10,
        clarity: -10,
        blur: 2
      }
    },
    {
      id: 'electric-vibe',
      name: 'Electric',
      description: 'High-energy vibrant look',
      icon: <Zap className="w-5 h-5" />,
      category: 'creative',
      filters: {
        saturation: 130,
        contrast: 125,
        highlights: 20,
        shadows: -15,
        clarity: 25,
        temperature: 110
      }
    },

    // Vintage
    {
      id: 'retro-vintage',
      name: 'Retro Vintage',
      description: 'Classic film nostalgia',
      icon: <Camera className="w-5 h-5" />,
      category: 'vintage',
      filters: {
        sepia: 30,
        contrast: 110,
        saturation: 85,
        highlights: 15,
        vignette: 30,
        noise: 5,
        temperature: 115
      }
    },
    {
      id: 'faded-film',
      name: 'Faded Film',
      description: 'Soft, washed-out vintage',
      icon: <Sun className="w-5 h-5" />,
      category: 'vintage',
      filters: {
        brightness: 110,
        contrast: 90,
        saturation: 70,
        highlights: 35,
        shadows: 15,
        sepia: 15,
        vignette: 20
      }
    },

    // Dramatic
    {
      id: 'high-drama',
      name: 'High Drama',
      description: 'Intense, moody atmosphere',
      icon: <Flame className="w-5 h-5" />,
      category: 'dramatic',
      filters: {
        contrast: 135,
        highlights: -20,
        shadows: -25,
        saturation: 95,
        clarity: 30,
        vignette: 40,
        temperature: 90
      }
    },
    {
      id: 'moody-dark',
      name: 'Moody Dark',
      description: 'Deep shadows, cinematic mood',
      icon: <Moon className="w-5 h-5" />,
      category: 'dramatic',
      filters: {
        brightness: 85,
        contrast: 140,
        highlights: -30,
        shadows: -35,
        saturation: 80,
        clarity: 25,
        vignette: 45,
        temperature: 85
      }
    },

    // Colorful
    {
      id: 'sunset-warm',
      name: 'Sunset Warm',
      description: 'Golden hour warmth',
      icon: <Sun className="w-5 h-5" />,
      category: 'colorful',
      filters: {
        temperature: 125,
        tint: 10,
        saturation: 115,
        highlights: 20,
        shadows: 5,
        clarity: 10
      }
    },
    {
      id: 'cool-blue',
      name: 'Cool Blue',
      description: 'Calming blue tones',
      icon: <Snowflake className="w-5 h-5" />,
      category: 'colorful',
      filters: {
        temperature: 80,
        tint: -15,
        saturation: 100,
        highlights: 15,
        shadows: 10
      }
    },
    {
      id: 'nature-vibrant',
      name: 'Nature Vibrant',
      description: 'Lush, natural colors',
      icon: <Leaf className="w-5 h-5" />,
      category: 'colorful',
      filters: {
        saturation: 125,
        vibrance: 115,
        contrast: 110,
        highlights: 10,
        shadows: 5,
        clarity: 20,
        temperature: 105
      }
    },

    // Moody
    {
      id: 'cinematic-teal',
      name: 'Cinematic Teal',
      description: 'Orange & teal cinematic look',
      icon: <Palette className="w-5 h-5" />,
      category: 'moody',
      filters: {
        temperature: 85,
        tint: -20,
        contrast: 120,
        saturation: 105,
        highlights: 10,
        shadows: -10,
        clarity: 15
      }
    },
    {
      id: 'muted-pastel',
      name: 'Muted Pastel',
      description: 'Soft, desaturated pastels',
      icon: <Heart className="w-5 h-5" />,
      category: 'moody',
      filters: {
        brightness: 105,
        contrast: 95,
        saturation: 75,
        highlights: 30,
        shadows: 15,
        clarity: -5,
        temperature: 105
      }
    }
  ]

  const categories = [
    { id: 'all', label: 'All Presets', icon: Star },
    { id: 'cinematic', label: 'Cinematic', icon: Film },
    { id: 'creative', label: 'Creative', icon: Sparkles },
    { id: 'vintage', label: 'Vintage', icon: Camera },
    { id: 'dramatic', label: 'Dramatic', icon: Flame },
    { id: 'colorful', label: 'Colorful', icon: Palette },
    { id: 'moody', label: 'Moody', icon: Moon }
  ]

  const filteredPresets = selectedCategory === 'all'
    ? presets
    : presets.filter(p => p.category === selectedCategory)

  const applyPreset = (preset: FilterPreset, intensity: number = 100) => {
    const intensityMultiplier = intensity / 100
    const baseFilters = { ...currentFilters }

    // Apply preset with intensity blending
    const newFilters: Partial<VideoFilter> = {}
    Object.entries(preset.filters).forEach(([key, value]) => {
      if (typeof value === 'number') {
        const filterKey = key as keyof VideoFilter
        const baseValue = baseFilters[filterKey]
        // Interpolate between current and preset value
        const delta = value - baseValue
        newFilters[filterKey as keyof VideoFilter] = baseValue + (delta * intensityMultiplier)
      }
    })

    onApplyPreset(newFilters)
  }

  return (
    <div className="space-y-6">
      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
        {categories.map(category => {
          const Icon = category.icon
          return (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${selectedCategory === category.id
                  ? 'bg-blue-500 text-white shadow-lg scale-105'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
            >
              <Icon className="w-4 h-4" />
              {category.label}
            </button>
          )
        })}
      </div>

      {/* Preset Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredPresets.map(preset => (
          <button
            key={preset.id}
            onClick={() => applyPreset(preset, 100)}
            onMouseEnter={() => setHoveredPreset(preset.id)}
            onMouseLeave={() => setHoveredPreset(null)}
            className="group relative bg-white dark:bg-gray-800 rounded-xl p-4 border-2 border-transparent hover:border-blue-500 transition-all duration-200 hover:shadow-xl text-left"
          >
            {/* Icon */}
            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg mb-3 group-hover:scale-110 transition-transform">
              <div className="text-white">
                {preset.icon}
              </div>
            </div>

            {/* Name & Description */}
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {preset.name}
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                {preset.description}
              </p>
            </div>

            {/* Hover Overlay */}
            {hoveredPreset === preset.id && (
              <div className="absolute inset-0 bg-blue-500/10 rounded-xl flex items-center justify-center">
                <div className="text-blue-600 dark:text-blue-400 font-semibold text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Apply Preset
                </div>
              </div>
            )}

            {/* Category Badge */}
            <div className="absolute top-2 right-2">
              <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full capitalize">
                {preset.category}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Quick Apply Section */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
        <p className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-500" />
          <span>
            Click any preset to apply instantly. Adjust filters manually for fine-tuning.
          </span>
        </p>
      </div>
    </div>
  )
}
