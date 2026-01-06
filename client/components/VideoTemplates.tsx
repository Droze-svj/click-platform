'use client'

import { useState } from 'react'
import {
  Film,
  Heart,
  Zap,
  Camera,
  Music,
  Coffee,
  Sun,
  Moon,
  Palette,
  Sparkles,
  Crown,
  Star,
  Flame,
  Snowflake,
  Leaf,
  Zap as Lightning
} from 'lucide-react'

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
}

interface TextOverlay {
  id: string
  text: string
  x: number
  y: number
  fontSize: number
  color: string
  fontFamily: string
  startTime: number
  endTime: number
}

interface VideoTemplate {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  category: string
  filters: Partial<VideoFilter>
  textOverlays?: TextOverlay[]
  recommendedFor: string[]
  tags: string[]
}

interface VideoTemplatesProps {
  onApplyTemplate: (filters: Partial<VideoFilter>, textOverlays?: TextOverlay[]) => void
  currentFilters: VideoFilter
}

export default function VideoTemplates({ onApplyTemplate, currentFilters }: VideoTemplatesProps) {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  const templates: VideoTemplate[] = [
    // Cinematic Templates
    {
      id: 'hollywood-blockbuster',
      name: 'Hollywood Blockbuster',
      description: 'High contrast, vibrant colors for dramatic cinematic feel',
      icon: <Film className="w-5 h-5" />,
      category: 'cinematic',
      filters: {
        contrast: 120,
        saturation: 110,
        vignette: 15,
        sharpen: 20
      },
      recommendedFor: ['movies', 'trailers', 'dramatic content'],
      tags: ['cinematic', 'dramatic', 'hollywood']
    },
    {
      id: 'moody-noir',
      name: 'Film Noir',
      description: 'High contrast black & white with dramatic shadows',
      icon: <Moon className="w-5 h-5" />,
      category: 'cinematic',
      filters: {
        contrast: 150,
        saturation: 0,
        brightness: 90,
        vignette: 25,
        sharpen: 15
      },
      recommendedFor: ['thrillers', 'mysteries', 'dramatic scenes'],
      tags: ['noir', 'black and white', 'dramatic']
    },
    {
      id: 'vintage-film',
      name: 'Vintage Film',
      description: 'Sepia tones with film grain for nostalgic look',
      icon: <Camera className="w-5 h-5" />,
      category: 'cinematic',
      filters: {
        sepia: 40,
        contrast: 110,
        brightness: 95,
        noise: 8,
        vignette: 10
      },
      recommendedFor: ['memories', 'historical content', 'nostalgic videos'],
      tags: ['vintage', 'sepia', 'grain']
    },

    // Social Media Templates
    {
      id: 'instagram-vibes',
      name: 'Instagram Aesthetic',
      description: 'Bright, vibrant colors with slight warmth',
      icon: <Heart className="w-5 h-5" />,
      category: 'social',
      filters: {
        brightness: 105,
        contrast: 105,
        saturation: 115,
        hue: 5,
        vignette: 8
      },
      recommendedFor: ['instagram', 'lifestyle', 'beauty'],
      tags: ['instagram', 'bright', 'vibrant']
    },
    {
      id: 'tiktok-trendy',
      name: 'TikTok Trendy',
      description: 'High saturation with cool blue tint',
      icon: <Zap className="w-5 h-5" />,
      category: 'social',
      filters: {
        saturation: 125,
        contrast: 110,
        hue: -10,
        brightness: 102,
        sharpen: 10
      },
      recommendedFor: ['tiktok', 'trending', 'viral content'],
      tags: ['tiktok', 'trendy', 'viral']
    },
    {
      id: 'linkedin-professional',
      name: 'LinkedIn Professional',
      description: 'Clean, professional look with subtle enhancements',
      icon: <Coffee className="w-5 h-5" />,
      category: 'social',
      filters: {
        contrast: 108,
        brightness: 103,
        saturation: 105,
        sharpen: 8
      },
      recommendedFor: ['business', 'professional', 'corporate'],
      tags: ['professional', 'business', 'clean']
    },

    // Mood Templates
    {
      id: 'sunny-vibrant',
      name: 'Sunny & Vibrant',
      description: 'Warm, cheerful colors perfect for happy content',
      icon: <Sun className="w-5 h-5" />,
      category: 'mood',
      filters: {
        brightness: 108,
        saturation: 120,
        contrast: 105,
        hue: 8
      },
      recommendedFor: ['lifestyle', 'travel', 'happy moments'],
      tags: ['sunny', 'warm', 'cheerful']
    },
    {
      id: 'cool-minimalist',
      name: 'Cool Minimalist',
      description: 'Desaturated, clean aesthetic with blue tones',
      icon: <Snowflake className="w-5 h-5" />,
      category: 'mood',
      filters: {
        saturation: 85,
        contrast: 115,
        brightness: 98,
        hue: -15,
        vignette: 5
      },
      recommendedFor: ['minimalist', 'tech', 'modern'],
      tags: ['cool', 'minimalist', 'clean']
    },
    {
      id: 'romantic-warm',
      name: 'Romantic Warm',
      description: 'Soft, warm tones with gentle vignette',
      icon: <Heart className="w-5 h-5" />,
      category: 'mood',
      filters: {
        brightness: 102,
        saturation: 95,
        contrast: 98,
        hue: 12,
        vignette: 20,
        blur: 1
      },
      recommendedFor: ['romantic', 'weddings', 'intimate moments'],
      tags: ['romantic', 'warm', 'soft']
    },

    // Creative Templates
    {
      id: 'cyberpunk-neon',
      name: 'Cyberpunk Neon',
      description: 'High contrast with vibrant blue hues',
      icon: <Lightning className="w-5 h-5" />,
      category: 'creative',
      filters: {
        contrast: 130,
        saturation: 140,
        hue: -30,
        brightness: 95,
        vignette: 15,
        sharpen: 25
      },
      recommendedFor: ['sci-fi', 'gaming', 'futuristic content'],
      tags: ['cyberpunk', 'neon', 'futuristic']
    },
    {
      id: 'dreamy-soft',
      name: 'Dreamy Soft',
      description: 'Soft focus with pastel color palette',
      icon: <Sparkles className="w-5 h-5" />,
      category: 'creative',
      filters: {
        blur: 2,
        saturation: 90,
        contrast: 95,
        brightness: 105,
        vignette: 25
      },
      recommendedFor: ['artistic', 'dreamy', 'fantasy'],
      tags: ['dreamy', 'soft', 'artistic']
    },
    {
      id: 'luxury-gold',
      name: 'Luxury Gold',
      description: 'Warm golden tones with elegant contrast',
      icon: <Crown className="w-5 h-5" />,
      category: 'creative',
      filters: {
        hue: 25,
        saturation: 110,
        contrast: 115,
        brightness: 100,
        vignette: 12,
        sharpen: 15
      },
      recommendedFor: ['luxury', 'elegant', 'premium content'],
      tags: ['luxury', 'gold', 'elegant']
    },

    // Nature Templates
    {
      id: 'forest-fresh',
      name: 'Forest Fresh',
      description: 'Natural greens with fresh, vibrant look',
      icon: <Leaf className="w-5 h-5" />,
      category: 'nature',
      filters: {
        saturation: 108,
        contrast: 102,
        brightness: 104,
        hue: -5,
        sharpen: 5
      },
      recommendedFor: ['nature', 'outdoor', 'adventure'],
      tags: ['nature', 'fresh', 'green']
    },
    {
      id: 'ocean-deep',
      name: 'Ocean Deep',
      description: 'Cool blue tones for underwater or ocean content',
      icon: <Palette className="w-5 h-5" />,
      category: 'nature',
      filters: {
        saturation: 115,
        contrast: 105,
        hue: -25,
        brightness: 98,
        vignette: 8
      },
      recommendedFor: ['ocean', 'beach', 'water sports'],
      tags: ['ocean', 'blue', 'deep']
    }
  ]

  const categories = [
    { id: 'all', name: 'All Templates', count: templates.length },
    { id: 'cinematic', name: 'Cinematic', count: templates.filter(t => t.category === 'cinematic').length },
    { id: 'social', name: 'Social Media', count: templates.filter(t => t.category === 'social').length },
    { id: 'mood', name: 'Mood', count: templates.filter(t => t.category === 'mood').length },
    { id: 'creative', name: 'Creative', count: templates.filter(t => t.category === 'creative').length },
    { id: 'nature', name: 'Nature', count: templates.filter(t => t.category === 'nature').length }
  ]

  const filteredTemplates = templates.filter(template => {
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    return matchesCategory && matchesSearch
  })

  const applyTemplate = (template: VideoTemplate) => {
    // Merge template filters with current filters
    const newFilters = { ...currentFilters, ...template.filters }
    onApplyTemplate(newFilters, template.textOverlays)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-4">
        Video Templates
      </h3>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search templates..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
        />
      </div>

      {/* Categories */}
      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map(category => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === category.id
                ? 'bg-purple-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {category.name} ({category.count})
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map(template => (
          <div
            key={template.id}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-purple-300 dark:hover:border-purple-600 transition-colors cursor-pointer"
            onClick={() => applyTemplate(template)}
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="text-purple-600 dark:text-purple-400 mt-1">
                {template.icon}
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                  {template.name}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {template.description}
                </p>
                <div className="flex flex-wrap gap-1">
                  {template.tags.slice(0, 3).map(tag => (
                    <span
                      key={tag}
                      className="inline-block px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400">
              Recommended for: {template.recommendedFor.join(', ')}
            </div>
          </div>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Palette className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No templates found matching your criteria</p>
          <p className="text-sm mt-1">Try adjusting your search or category filter</p>
        </div>
      )}
    </div>
  )
}




