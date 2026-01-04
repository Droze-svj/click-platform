'use client'

import { useState } from 'react'
import {
  Instagram,
  Youtube,
  Twitter,
  Facebook,
  Music,
  Download,
  Share,
  Smartphone,
  Monitor,
  Film,
  Settings,
  CheckCircle,
  AlertTriangle,
  Info
} from 'lucide-react'
import { useToast } from '../contexts/ToastContext'

interface ExportPreset {
  id: string
  name: string
  platform: string
  icon: React.ReactNode
  resolution: { width: number; height: number }
  aspectRatio: string
  maxDuration: number
  recommendedBitrate: string
  format: string
  description: string
  tips: string[]
  hashtags: string[]
}

interface SocialMediaExporterProps {
  videoUrl: string
  videoId?: string
  onExport: (preset: ExportPreset, options: any) => void
}

export default function SocialMediaExporter({ videoUrl, videoId, onExport }: SocialMediaExporterProps) {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [exportOptions, setExportOptions] = useState({
    includeWatermark: false,
    addCaptions: false,
    optimizeAudio: true,
    addEndScreen: false,
    customThumbnail: false
  })

  const { showToast } = useToast()

  const exportPresets: ExportPreset[] = [
    // Instagram
    {
      id: 'instagram-feed',
      name: 'Instagram Feed',
      platform: 'Instagram',
      icon: <Instagram className="w-5 h-5 text-pink-500" />,
      resolution: { width: 1080, height: 1080 },
      aspectRatio: '1:1',
      maxDuration: 90,
      recommendedBitrate: '3.5 Mbps',
      format: 'MP4',
      description: 'Square format perfect for feed posts',
      tips: [
        'Use vertical text overlays',
        'Add trending music',
        'Include call-to-action in caption'
      ],
      hashtags: ['#Instagram', '#ContentCreator', '#SocialMedia']
    },
    {
      id: 'instagram-story',
      name: 'Instagram Story',
      platform: 'Instagram',
      icon: <Instagram className="w-5 h-5 text-pink-500" />,
      resolution: { width: 1080, height: 1920 },
      aspectRatio: '9:16',
      maxDuration: 15,
      recommendedBitrate: '2.5 Mbps',
      format: 'MP4',
      description: 'Vertical format for Stories and Reels',
      tips: [
        'Keep it under 15 seconds',
        'Use engaging hooks in first 3 seconds',
        'Add interactive stickers'
      ],
      hashtags: ['#InstaStory', '#Reels', '#ShortVideo']
    },
    {
      id: 'instagram-reel',
      name: 'Instagram Reel',
      platform: 'Instagram',
      icon: <Instagram className="w-5 h-5 text-pink-500" />,
      resolution: { width: 1080, height: 1920 },
      aspectRatio: '9:16',
      maxDuration: 90,
      recommendedBitrate: '2.5 Mbps',
      format: 'MP4',
      description: 'Long-form vertical video for Reels',
      tips: [
        'Use trending audio',
        'Add text overlays for accessibility',
        'Include hook in first 5 seconds'
      ],
      hashtags: ['#Reels', '#InstagramReels', '#Viral']
    },

    // TikTok
    {
      id: 'tiktok-standard',
      name: 'TikTok Video',
      platform: 'TikTok',
      icon: <Music className="w-5 h-5 text-black" />,
      resolution: { width: 1080, height: 1920 },
      aspectRatio: '9:16',
      maxDuration: 180,
      recommendedBitrate: '2.5 Mbps',
      format: 'MP4',
      description: 'Vertical format optimized for TikTok',
      tips: [
        'Hook in first 3 seconds',
        'Use trending sounds',
        'Add captions for accessibility',
        'Keep under 60 seconds for better engagement'
      ],
      hashtags: ['#TikTok', '#Viral', '#FYP', '#ForYouPage']
    },

    // YouTube
    {
      id: 'youtube-short',
      name: 'YouTube Short',
      platform: 'YouTube',
      icon: <Youtube className="w-5 h-5 text-red-500" />,
      resolution: { width: 1080, height: 1920 },
      aspectRatio: '9:16',
      maxDuration: 60,
      recommendedBitrate: '5 Mbps',
      format: 'MP4',
      description: 'Vertical short-form for YouTube Shorts',
      tips: [
        'Engaging thumbnail',
        'Hook in first 5 seconds',
        'Clear audio',
        'Add end screen with subscribe button'
      ],
      hashtags: ['#YouTubeShorts', '#Shorts', '#YouTube']
    },
    {
      id: 'youtube-standard',
      name: 'YouTube Video',
      platform: 'YouTube',
      icon: <Youtube className="w-5 h-5 text-red-500" />,
      resolution: { width: 1920, height: 1080 },
      aspectRatio: '16:9',
      maxDuration: 0, // No limit
      recommendedBitrate: '8 Mbps',
      format: 'MP4',
      description: 'Horizontal format for standard YouTube videos',
      tips: [
        'High quality audio',
        'Clear title and thumbnail',
        'Add chapters with timestamps',
        'Include end screens and cards'
      ],
      hashtags: ['#YouTube', '#Video', '#Tutorial']
    },

    // Twitter/X
    {
      id: 'twitter-video',
      name: 'Twitter Video',
      platform: 'Twitter',
      icon: <Twitter className="w-5 h-5 text-blue-400" />,
      resolution: { width: 1280, height: 720 },
      aspectRatio: '16:9',
      maxDuration: 140, // 2 minutes 20 seconds
      recommendedBitrate: '5 Mbps',
      format: 'MP4',
      description: 'Horizontal format optimized for Twitter',
      tips: [
        'Keep under 2 minutes for better engagement',
        'Clear audio',
        'Add captions',
        'Use relevant hashtags'
      ],
      hashtags: ['#Twitter', '#Video', '#SocialMedia']
    },

    // Facebook
    {
      id: 'facebook-feed',
      name: 'Facebook Feed',
      platform: 'Facebook',
      icon: <Facebook className="w-5 h-5 text-blue-600" />,
      resolution: { width: 1280, height: 720 },
      aspectRatio: '16:9',
      maxDuration: 240, // 4 minutes
      recommendedBitrate: '4 Mbps',
      format: 'MP4',
      description: 'Horizontal format for Facebook feed',
      tips: [
        'Engaging thumbnail',
        'Clear audio',
        'Add text overlays',
        'Include call-to-action'
      ],
      hashtags: ['#Facebook', '#Video', '#SocialMedia']
    },
    {
      id: 'facebook-reel',
      name: 'Facebook Reel',
      platform: 'Facebook',
      icon: <Facebook className="w-5 h-5 text-blue-600" />,
      resolution: { width: 1080, height: 1920 },
      aspectRatio: '9:16',
      maxDuration: 90,
      recommendedBitrate: '2.5 Mbps',
      format: 'MP4',
      description: 'Vertical format for Facebook Reels',
      tips: [
        'Use trending audio',
        'Engaging hook',
        'Clear text overlays',
        'Add captions'
      ],
      hashtags: ['#FacebookReels', '#Reels', '#Facebook']
    },

    // Generic presets
    {
      id: 'mobile-optimized',
      name: 'Mobile Optimized',
      platform: 'Mobile',
      icon: <Smartphone className="w-5 h-5 text-green-500" />,
      resolution: { width: 1080, height: 1920 },
      aspectRatio: '9:16',
      maxDuration: 60,
      recommendedBitrate: '3 Mbps',
      format: 'MP4',
      description: 'Optimized for mobile viewing',
      tips: [
        'Vertical orientation',
        'Clear text and graphics',
        'Good contrast for small screens'
      ],
      hashtags: ['#Mobile', '#Video', '#ShortForm']
    },
    {
      id: 'desktop-web',
      name: 'Web/Desktop',
      platform: 'Web',
      icon: <Monitor className="w-5 h-5 text-purple-500" />,
      resolution: { width: 1920, height: 1080 },
      aspectRatio: '16:9',
      maxDuration: 0,
      recommendedBitrate: '8 Mbps',
      format: 'MP4',
      description: 'High quality for web and desktop',
      tips: [
        'High resolution',
        'Clear audio',
        'Professional quality'
      ],
      hashtags: ['#WebVideo', '#HD', '#Professional']
    }
  ]

  const platformGroups = {
    instagram: exportPresets.filter(p => p.platform === 'Instagram'),
    tiktok: exportPresets.filter(p => p.platform === 'TikTok'),
    youtube: exportPresets.filter(p => p.platform === 'YouTube'),
    twitter: exportPresets.filter(p => p.platform === 'Twitter'),
    facebook: exportPresets.filter(p => p.platform === 'Facebook'),
    generic: exportPresets.filter(p => !['Instagram', 'TikTok', 'YouTube', 'Twitter', 'Facebook'].includes(p.platform))
  }

  const handleExport = (preset: ExportPreset) => {
    const exportConfig = {
      preset: preset.id,
      platform: preset.platform,
      resolution: preset.resolution,
      format: preset.format,
      bitrate: preset.recommendedBitrate,
      maxDuration: preset.maxDuration,
      options: exportOptions
    }

    onExport(preset, exportConfig)
    showToast(`Starting export for ${preset.platform} ${preset.name}`, 'info')
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'Instagram': return <Instagram className="w-4 h-4 text-pink-500" />
      case 'TikTok': return <Music className="w-4 h-4 text-black" />
      case 'YouTube': return <Youtube className="w-4 h-4 text-red-500" />
      case 'Twitter': return <Twitter className="w-4 h-4 text-blue-400" />
      case 'Facebook': return <Facebook className="w-4 h-4 text-blue-600" />
      case 'Mobile': return <Smartphone className="w-4 h-4 text-green-500" />
      case 'Web': return <Monitor className="w-4 h-4 text-purple-500" />
      default: return <Film className="w-4 h-4 text-gray-500" />
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3 mb-6">
        <Share className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        <div>
          <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
            Social Media Export
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Export your video optimized for different social media platforms
          </p>
        </div>
      </div>

      {/* Export Options */}
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Export Options
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={exportOptions.includeWatermark}
              onChange={(e) => setExportOptions(prev => ({ ...prev, includeWatermark: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm">Include watermark</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={exportOptions.addCaptions}
              onChange={(e) => setExportOptions(prev => ({ ...prev, addCaptions: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm">Add captions</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={exportOptions.optimizeAudio}
              onChange={(e) => setExportOptions(prev => ({ ...prev, optimizeAudio: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm">Optimize audio</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={exportOptions.addEndScreen}
              onChange={(e) => setExportOptions(prev => ({ ...prev, addEndScreen: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm">Add end screen</span>
          </label>
        </div>
      </div>

      {/* Platform Presets */}
      <div className="space-y-6">
        {Object.entries(platformGroups).map(([platform, presets]) => (
          <div key={platform}>
            <h4 className="font-medium mb-3 flex items-center gap-2 capitalize">
              {getPlatformIcon(platform === 'generic' ? 'Web' : platform)}
              {platform === 'generic' ? 'General' : platform}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {presets.map(preset => (
                <div
                  key={preset.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedPreset === preset.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
                  }`}
                  onClick={() => setSelectedPreset(preset.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {preset.icon}
                      <span className="font-medium text-sm">{preset.name}</span>
                    </div>
                    {selectedPreset === preset.id && (
                      <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    )}
                  </div>

                  <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
                    <div className="flex justify-between">
                      <span>Resolution:</span>
                      <span>{preset.resolution.width}×{preset.resolution.height}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Aspect Ratio:</span>
                      <span>{preset.aspectRatio}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Max Duration:</span>
                      <span>{preset.maxDuration || 'Unlimited'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Bitrate:</span>
                      <span>{preset.recommendedBitrate}</span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 mb-3">
                    {preset.description}
                  </p>

                  <div className="flex flex-wrap gap-1 mb-3">
                    {preset.hashtags.slice(0, 3).map(hashtag => (
                      <span
                        key={hashtag}
                        className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs"
                      >
                        {hashtag}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-start gap-2 mb-3">
                    <Info className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
                    <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                      {preset.tips.slice(0, 2).map((tip, index) => (
                        <li key={index}>• {tip}</li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleExport(preset)
                    }}
                    className="w-full px-3 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Export Status */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
              Export Information
            </p>
            <ul className="text-blue-800 dark:text-blue-200 space-y-1">
              <li>• Videos are processed in the background and may take several minutes</li>
              <li>• You'll receive a notification when export is complete</li>
              <li>• High-quality exports may require more processing time</li>
              <li>• Check your downloads folder or the processed files section</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
