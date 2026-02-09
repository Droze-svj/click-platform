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
  Zap as Lightning,
  Type,
  X
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
  clarity?: number
  temperature?: number
  highlights?: number
  shadows?: number
  vibrance?: number
  tint?: number
  dehaze?: number
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
  accentColor?: string
  brandFont?: string
}

const LAST_TEMPLATE_KEY = 'click-video-last-template-id'

export default function VideoTemplates({ onApplyTemplate, currentFilters }: VideoTemplatesProps) {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [personalizeId, setPersonalizeId] = useState<string | null>(null)
  const [customColor, setCustomColor] = useState('#8B5CF6')
  const [customFont, setCustomFont] = useState('Inter')
  const [lastUsedId, setLastUsedId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(LAST_TEMPLATE_KEY)
  })

  const templates: VideoTemplate[] = [
    // Click-Style Professional Templates - Social Media
    {
      id: 'click-viral-hook',
      name: 'Viral Hook Style',
      description: 'High-energy, attention-grabbing style perfect for opening hooks',
      icon: <Zap className="w-5 h-5" />,
      category: 'social',
      filters: {
        brightness: 108,
        contrast: 115,
        saturation: 125,
        sharpen: 25,
        hue: -5
      },
      textOverlays: [{
        id: 'hook-text',
        text: 'YOU NEED TO SEE THIS',
        x: 50,
        y: 20,
        fontSize: 48,
        color: '#FFFFFF',
        fontFamily: 'Impact, Arial Black, sans-serif',
        startTime: 0,
        endTime: 3
      }],
      recommendedFor: ['tiktok', 'reels', 'shorts', 'viral content'],
      tags: ['viral', 'hook', 'attention', 'click-style']
    },
    {
      id: 'click-educational-clean',
      name: 'Educational Clean',
      description: 'Professional, clean look perfect for tutorials and educational content',
      icon: <Sparkles className="w-5 h-5" />,
      category: 'social',
      filters: {
        brightness: 105,
        contrast: 110,
        saturation: 100,
        sharpen: 15,
        clarity: 10
      },
      textOverlays: [{
        id: 'edu-title',
        text: 'How it works',
        x: 50,
        y: 15,
        fontSize: 36,
        color: '#FFFFFF',
        fontFamily: 'Inter, system-ui, sans-serif',
        startTime: 0,
        endTime: 4
      }],
      recommendedFor: ['youtube', 'tutorials', 'educational', 'how-to'],
      tags: ['educational', 'clean', 'professional', 'tutorial']
    },
    {
      id: 'click-lifestyle-vibrant',
      name: 'Lifestyle Vibrant',
      description: 'Bright, warm tones perfect for lifestyle and vlog content',
      icon: <Sun className="w-5 h-5" />,
      category: 'social',
      filters: {
        brightness: 110,
        contrast: 105,
        saturation: 120,
        temperature: 110,
        hue: 8
      },
      recommendedFor: ['instagram', 'lifestyle', 'vlogs', 'day-in-life'],
      tags: ['lifestyle', 'vibrant', 'warm', 'instagram']
    },
    {
      id: 'click-gaming-dynamic',
      name: 'Gaming Dynamic',
      description: 'High contrast, cool tones perfect for gaming content',
      icon: <Zap className="w-5 h-5" />,
      category: 'social',
      filters: {
        brightness: 102,
        contrast: 125,
        saturation: 130,
        hue: -20,
        sharpen: 30
      },
      recommendedFor: ['gaming', 'streaming', 'twitch', 'youtube gaming'],
      tags: ['gaming', 'dynamic', 'cool', 'high-contrast']
    },
    {
      id: 'click-business-professional',
      name: 'Business Professional',
      description: 'Clean, corporate look perfect for business and LinkedIn content',
      icon: <Coffee className="w-5 h-5" />,
      category: 'social',
      filters: {
        brightness: 103,
        contrast: 108,
        saturation: 105,
        sharpen: 10,
        clarity: 5
      },
      textOverlays: [{
        id: 'biz-lower-third',
        text: 'Your Name · Title',
        x: 10,
        y: 75,
        fontSize: 28,
        color: '#FFFFFF',
        fontFamily: 'Georgia, Times New Roman, serif',
        startTime: 0,
        endTime: 5
      }],
      recommendedFor: ['linkedin', 'business', 'corporate', 'professional'],
      tags: ['business', 'professional', 'corporate', 'linkedin']
    },
    {
      id: 'click-product-showcase',
      name: 'Product Showcase',
      description: 'Enhanced colors and clarity perfect for product reviews and showcases',
      icon: <Sparkles className="w-5 h-5" />,
      category: 'social',
      filters: {
        brightness: 107,
        contrast: 112,
        saturation: 115,
        sharpen: 20,
        clarity: 15,
        highlights: 5
      },
      recommendedFor: ['product reviews', 'unboxing', 'shopping', 'amazon'],
      tags: ['product', 'showcase', 'review', 'shopping']
    },
    {
      id: 'click-trending-reels',
      name: 'Trending Reels Style',
      description: 'Ultra-vibrant, high-energy style optimized for Instagram Reels',
      icon: <Zap className="w-5 h-5" />,
      category: 'social',
      filters: {
        brightness: 112,
        contrast: 120,
        saturation: 135,
        sharpen: 30,
        hue: 5,
        clarity: 20
      },
      textOverlays: [{
        id: 'reels-text',
        text: 'TRENDING NOW',
        x: 50,
        y: 15,
        fontSize: 42,
        color: '#FFFFFF',
        fontFamily: 'Montserrat, Arial Black, sans-serif',
        startTime: 0,
        endTime: 2.5
      }],
      recommendedFor: ['instagram reels', 'trending', 'viral', 'short-form'],
      tags: ['reels', 'trending', 'viral', 'instagram']
    },
    {
      id: 'click-podcast-intro',
      name: 'Podcast Intro Style',
      description: 'Professional, clean look perfect for podcast intros and outros',
      icon: <Music className="w-5 h-5" />,
      category: 'social',
      filters: {
        brightness: 104,
        contrast: 110,
        saturation: 100,
        sharpen: 12,
        clarity: 8,
        temperature: 105
      },
      recommendedFor: ['podcasts', 'intros', 'outros', 'audio content'],
      tags: ['podcast', 'professional', 'clean', 'intro']
    },
    {
      id: 'click-meme-style',
      name: 'Meme Style',
      description: 'High contrast, saturated look perfect for meme content',
      icon: <Flame className="w-5 h-5" />,
      category: 'social',
      filters: {
        brightness: 110,
        contrast: 130,
        saturation: 140,
        sharpen: 35,
        hue: -8
      },
      recommendedFor: ['memes', 'comedy', 'viral', 'tiktok'],
      tags: ['meme', 'comedy', 'viral', 'high-contrast']
    },
    {
      id: 'click-news-style',
      name: 'News & Breaking',
      description: 'Professional news-style look with enhanced clarity',
      icon: <Star className="w-5 h-5" />,
      category: 'social',
      filters: {
        brightness: 106,
        contrast: 115,
        saturation: 105,
        sharpen: 18,
        clarity: 12,
        temperature: 98
      },
      recommendedFor: ['news', 'breaking', 'journalism', 'reporting'],
      tags: ['news', 'professional', 'breaking', 'journalism']
    },
    {
      id: 'click-fitness-energy',
      name: 'Fitness Energy',
      description: 'High-energy, vibrant style perfect for fitness and workout content',
      icon: <Zap className="w-5 h-5" />,
      category: 'social',
      filters: {
        brightness: 108,
        contrast: 118,
        saturation: 125,
        sharpen: 25,
        clarity: 15,
        temperature: 108
      },
      recommendedFor: ['fitness', 'workout', 'gym', 'health'],
      tags: ['fitness', 'energy', 'workout', 'health']
    },
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
    {
      id: 'retro-revival',
      name: 'Retro Revival',
      description: 'Warm vintage look with lifted blacks and soft contrast',
      icon: <Palette className="w-5 h-5" />,
      category: 'cinematic',
      filters: {
        sepia: 25,
        saturation: 88,
        contrast: 105,
        temperature: 115,
        vignette: 20,
        noise: 5
      },
      recommendedFor: ['retro', 'throwback', 'aesthetic'],
      tags: ['retro', 'vintage', 'warm', 'aesthetic']
    },
    {
      id: 'cinematic-drama',
      name: 'Cinematic Drama',
      description: 'Deep shadows and rich contrast for dramatic storytelling',
      icon: <Film className="w-5 h-5" />,
      category: 'cinematic',
      filters: {
        contrast: 128,
        saturation: 92,
        brightness: 88,
        vignette: 45,
        shadows: 15,
        sharpen: 18
      },
      recommendedFor: ['drama', 'trailers', 'short films'],
      tags: ['cinematic', 'drama', 'moody', 'film']
    },
    {
      id: 'documentary-natural',
      name: 'Documentary Natural',
      description: 'Neutral, immersive look that keeps focus on the story',
      icon: <Camera className="w-5 h-5" />,
      category: 'cinematic',
      filters: {
        sepia: 10,
        contrast: 108,
        saturation: 95,
        vignette: 22,
        clarity: 8,
        sharpen: 12
      },
      recommendedFor: ['documentary', 'interview', 'real-life'],
      tags: ['documentary', 'natural', 'immersive']
    },
    {
      id: 'comedy-punch',
      name: 'Comedy Punch',
      description: 'Bright, punchy colors for comedy and sketch content',
      icon: <Sparkles className="w-5 h-5" />,
      category: 'creative',
      filters: {
        brightness: 110,
        saturation: 132,
        contrast: 112,
        vibrance: 120,
        sharpen: 20
      },
      recommendedFor: ['comedy', 'sketch', 'fun', 'viral'],
      tags: ['comedy', 'bright', 'punchy', 'fun']
    },
    {
      id: 'sports-action',
      name: 'Sports Action',
      description: 'High clarity and contrast for fast-paced action',
      icon: <Zap className="w-5 h-5" />,
      category: 'social',
      filters: {
        contrast: 118,
        saturation: 118,
        sharpen: 35,
        clarity: 18,
        brightness: 102
      },
      recommendedFor: ['sports', 'action', 'fitness', 'highlights'],
      tags: ['sports', 'action', 'dynamic', 'sharp']
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
    { id: 'social', name: 'Click Style', count: templates.filter(t => t.category === 'social').length },
    { id: 'cinematic', name: 'Cinematic', count: templates.filter(t => t.category === 'cinematic').length },
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
    if (typeof window !== 'undefined') {
      localStorage.setItem(LAST_TEMPLATE_KEY, template.id)
      setLastUsedId(template.id)
    }
    // Merge template filters with current filters
    const newFilters = { ...currentFilters, ...template.filters }

    // Apply personalization if this template is being personalized
    let personalizedOverlays = template.textOverlays?.map(overlay => ({
      ...overlay,
      color: personalizeId === template.id ? customColor : overlay.color,
      fontFamily: personalizeId === template.id ? customFont : overlay.fontFamily
    }))

    onApplyTemplate(newFilters, personalizedOverlays)
  }

  return (
    <div className="bg-gradient-to-br from-white to-purple-50/30 dark:from-gray-800 dark:to-purple-900/20 rounded-xl shadow-xl p-6 border border-purple-200/50 dark:border-purple-700/50">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-bold text-xl text-gray-900 dark:text-white mb-1 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-500" />
            Professional Templates
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Click-style templates for viral content
          </p>
        </div>
        <div className="px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full text-xs font-semibold">
          PRO
        </div>
      </div>

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
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${selectedCategory === category.id
              ? 'bg-purple-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
          >
            {category.name} ({category.count})
          </button>
        ))}
      </div>

      {/* Personalization Sidebar/Modal (Dynamic) */}
      {personalizeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-sm">
          <div className="w-96 h-full bg-white dark:bg-gray-900 shadow-2xl p-8 transform transition-transform duration-500 animate-slide-in-right border-l border-purple-500/20">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-bold text-2xl bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Personalize Design</h3>
              <button onClick={() => setPersonalizeId(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"><X className="w-6 h-6" /></button>
            </div>

            <div className="space-y-8">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">Primary Brand Color</label>
                <div className="flex flex-wrap gap-3 mb-4">
                  {['#8B5CF6', '#EC4899', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#000000', '#FFFFFF'].map(color => (
                    <button
                      key={color}
                      onClick={() => setCustomColor(color)}
                      className={`w-10 h-10 rounded-xl border-2 transition-all transform hover:scale-110 ${customColor === color ? 'border-purple-500 ring-4 ring-purple-500/20' : 'border-transparent shadow-md'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                  className="w-full h-12 rounded-xl cursor-pointer bg-gray-50 border-none px-1"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">Typography / Font</label>
                <div className="space-y-2">
                  {['Inter', 'Impact', 'Montserrat', 'Playfair Display', 'Oswald', 'Roboto'].map(font => (
                    <button
                      key={font}
                      onClick={() => setCustomFont(font)}
                      className={`w-full text-left px-5 py-4 rounded-2xl border-2 transition-all ${customFont === font ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 shadow-lg' : 'border-gray-100 dark:border-gray-800 hover:border-purple-200 dark:hover:border-purple-800'}`}
                      style={{ fontFamily: font }}
                    >
                      {font} Selection
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-8 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => {
                    const template = templates.find(t => t.id === personalizeId);
                    if (template) applyTemplate(template);
                    setPersonalizeId(null);
                  }}
                  className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-purple-500/20 hover:shadow-purple-500/40 transition-all transform hover:scale-102 flex items-center justify-center gap-2"
                >
                  <Zap className="w-5 h-5 fill-white" />
                  Save & Apply to Video
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map(template => (
          <div
            key={template.id}
            className="group relative bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-2xl transition-all duration-300 cursor-pointer transform hover:scale-105"
          >
            {/* Action Buttons Overlay */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all rounded-xl flex items-center justify-center gap-3 z-10">
              <button
                onClick={(e) => { e.stopPropagation(); applyTemplate(template); }}
                className="px-4 py-2 bg-white text-gray-900 rounded-xl font-bold hover:bg-gray-100 transition-all"
              >
                Quick Apply
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setPersonalizeId(template.id); }}
                className="px-4 py-2 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-500 transition-all border border-purple-400 flex items-center gap-1.5"
              >
                <Palette className="w-4 h-4" />
                Personalize
              </button>
            </div>

            {/* Premium Badge for Click-style templates */}
            {template.id?.startsWith('click-') && (
              <div className="absolute top-3 right-3 px-2 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded-full shadow-lg z-20">
                CLICK
              </div>
            )}
            {lastUsedId === template.id && (
              <div className="absolute top-3 left-3 px-2 py-1 bg-slate-600/90 text-white text-[10px] font-semibold rounded-full z-20">
                Recently used
              </div>
            )}

            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-lg text-purple-600 dark:text-purple-400">
                {template.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-gray-900 dark:text-white mb-1.5 text-base">
                  {template.name}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">
                  {template.description}
                </p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {template.tags.slice(0, 3).map(tag => (
                    <span
                      key={tag}
                      className="inline-block px-2.5 py-1 text-xs font-medium bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/40 dark:to-pink-900/40 text-purple-700 dark:text-purple-300 rounded-full border border-purple-200 dark:border-purple-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                <span className="font-semibold">Perfect for:</span> {template.recommendedFor.slice(0, 2).join(', ')}
                {template.recommendedFor.length > 2 && ` +${template.recommendedFor.length - 2}`}
              </div>
              <div className="flex items-center justify-between">
                <button className="px-4 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm font-semibold rounded-lg transition-all transform group-hover:scale-105 shadow-md">
                  Apply Template
                </button>
                {template.textOverlays && template.textOverlays.length > 0 && (
                  <span className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1">
                    <Type className="w-3 h-3" />
                    Text Included
                  </span>
                )}
              </div>
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











