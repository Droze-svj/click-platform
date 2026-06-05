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
  Info,
  Calendar,
  Clock,
  Globe,
  Lock,
  Zap
} from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { useTranslation } from '@/hooks/useTranslation'

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
    customThumbnail: false,
    allowSmartRefit: true,
    isScheduled: false,
    scheduledDate: '',
    scheduledTime: '',
    postToAllLinked: false
  })

  const { showToast } = useToast()
  const { t } = useTranslation()

  const exportPresets: ExportPreset[] = [
    // Instagram
    {
      id: 'instagram-feed',
      name: t('socialMediaExporter.presets.instagramFeed.name'),
      platform: 'Instagram',
      icon: <Instagram className="w-5 h-5 text-pink-500" />,
      resolution: { width: 1080, height: 1080 },
      aspectRatio: '1:1',
      maxDuration: 90,
      recommendedBitrate: '3.5 Mbps',
      format: 'MP4',
      description: t('socialMediaExporter.presets.instagramFeed.description'),
      tips: [
        t('socialMediaExporter.presets.instagramFeed.tip1'),
        t('socialMediaExporter.presets.instagramFeed.tip2'),
        t('socialMediaExporter.presets.instagramFeed.tip3')
      ],
      hashtags: ['#Instagram', '#ContentCreator', '#SocialMedia']
    },
    {
      id: 'instagram-story',
      name: t('socialMediaExporter.presets.instagramStory.name'),
      platform: 'Instagram',
      icon: <Instagram className="w-5 h-5 text-pink-500" />,
      resolution: { width: 1080, height: 1920 },
      aspectRatio: '9:16',
      maxDuration: 15,
      recommendedBitrate: '2.5 Mbps',
      format: 'MP4',
      description: t('socialMediaExporter.presets.instagramStory.description'),
      tips: [
        t('socialMediaExporter.presets.instagramStory.tip1'),
        t('socialMediaExporter.presets.instagramStory.tip2'),
        t('socialMediaExporter.presets.instagramStory.tip3')
      ],
      hashtags: ['#InstaStory', '#Reels', '#ShortVideo']
    },
    {
      id: 'instagram-reel',
      name: t('socialMediaExporter.presets.instagramReel.name'),
      platform: 'Instagram',
      icon: <Instagram className="w-5 h-5 text-pink-500" />,
      resolution: { width: 1080, height: 1920 },
      aspectRatio: '9:16',
      maxDuration: 90,
      recommendedBitrate: '2.5 Mbps',
      format: 'MP4',
      description: t('socialMediaExporter.presets.instagramReel.description'),
      tips: [
        t('socialMediaExporter.presets.instagramReel.tip1'),
        t('socialMediaExporter.presets.instagramReel.tip2'),
        t('socialMediaExporter.presets.instagramReel.tip3')
      ],
      hashtags: ['#Reels', '#InstagramReels', '#Viral']
    },

    // TikTok
    {
      id: 'tiktok-standard',
      name: t('socialMediaExporter.presets.tiktokStandard.name'),
      platform: 'TikTok',
      icon: <Music className="w-5 h-5 text-black" />,
      resolution: { width: 1080, height: 1920 },
      aspectRatio: '9:16',
      maxDuration: 180,
      recommendedBitrate: '2.5 Mbps',
      format: 'MP4',
      description: t('socialMediaExporter.presets.tiktokStandard.description'),
      tips: [
        t('socialMediaExporter.presets.tiktokStandard.tip1'),
        t('socialMediaExporter.presets.tiktokStandard.tip2'),
        t('socialMediaExporter.presets.tiktokStandard.tip3'),
        t('socialMediaExporter.presets.tiktokStandard.tip4')
      ],
      hashtags: ['#TikTok', '#Viral', '#FYP', '#ForYouPage']
    },

    // YouTube
    {
      id: 'youtube-short',
      name: t('socialMediaExporter.presets.youtubeShort.name'),
      platform: 'YouTube',
      icon: <Youtube className="w-5 h-5 text-red-500" />,
      resolution: { width: 1080, height: 1920 },
      aspectRatio: '9:16',
      maxDuration: 60,
      recommendedBitrate: '5 Mbps',
      format: 'MP4',
      description: t('socialMediaExporter.presets.youtubeShort.description'),
      tips: [
        t('socialMediaExporter.presets.youtubeShort.tip1'),
        t('socialMediaExporter.presets.youtubeShort.tip2'),
        t('socialMediaExporter.presets.youtubeShort.tip3'),
        t('socialMediaExporter.presets.youtubeShort.tip4')
      ],
      hashtags: ['#YouTubeShorts', '#Shorts', '#YouTube']
    },
    {
      id: 'youtube-standard',
      name: t('socialMediaExporter.presets.youtubeStandard.name'),
      platform: 'YouTube',
      icon: <Youtube className="w-5 h-5 text-red-500" />,
      resolution: { width: 1920, height: 1080 },
      aspectRatio: '16:9',
      maxDuration: 0, // No limit
      recommendedBitrate: '8 Mbps',
      format: 'MP4',
      description: t('socialMediaExporter.presets.youtubeStandard.description'),
      tips: [
        t('socialMediaExporter.presets.youtubeStandard.tip1'),
        t('socialMediaExporter.presets.youtubeStandard.tip2'),
        t('socialMediaExporter.presets.youtubeStandard.tip3'),
        t('socialMediaExporter.presets.youtubeStandard.tip4')
      ],
      hashtags: ['#YouTube', '#Video', '#Tutorial']
    },

    // Twitter/X
    {
      id: 'twitter-video',
      name: t('socialMediaExporter.presets.twitterVideo.name'),
      platform: 'Twitter',
      icon: <Twitter className="w-5 h-5 text-blue-400" />,
      resolution: { width: 1280, height: 720 },
      aspectRatio: '16:9',
      maxDuration: 140, // 2 minutes 20 seconds
      recommendedBitrate: '5 Mbps',
      format: 'MP4',
      description: t('socialMediaExporter.presets.twitterVideo.description'),
      tips: [
        t('socialMediaExporter.presets.twitterVideo.tip1'),
        t('socialMediaExporter.presets.twitterVideo.tip2'),
        t('socialMediaExporter.presets.twitterVideo.tip3'),
        t('socialMediaExporter.presets.twitterVideo.tip4')
      ],
      hashtags: ['#Twitter', '#Video', '#SocialMedia']
    },

    // Facebook
    {
      id: 'facebook-feed',
      name: t('socialMediaExporter.presets.facebookFeed.name'),
      platform: 'Facebook',
      icon: <Facebook className="w-5 h-5 text-blue-600" />,
      resolution: { width: 1280, height: 720 },
      aspectRatio: '16:9',
      maxDuration: 240, // 4 minutes
      recommendedBitrate: '4 Mbps',
      format: 'MP4',
      description: t('socialMediaExporter.presets.facebookFeed.description'),
      tips: [
        t('socialMediaExporter.presets.facebookFeed.tip1'),
        t('socialMediaExporter.presets.facebookFeed.tip2'),
        t('socialMediaExporter.presets.facebookFeed.tip3'),
        t('socialMediaExporter.presets.facebookFeed.tip4')
      ],
      hashtags: ['#Facebook', '#Video', '#SocialMedia']
    },
    {
      id: 'facebook-reel',
      name: t('socialMediaExporter.presets.facebookReel.name'),
      platform: 'Facebook',
      icon: <Facebook className="w-5 h-5 text-blue-600" />,
      resolution: { width: 1080, height: 1920 },
      aspectRatio: '9:16',
      maxDuration: 90,
      recommendedBitrate: '2.5 Mbps',
      format: 'MP4',
      description: t('socialMediaExporter.presets.facebookReel.description'),
      tips: [
        t('socialMediaExporter.presets.facebookReel.tip1'),
        t('socialMediaExporter.presets.facebookReel.tip2'),
        t('socialMediaExporter.presets.facebookReel.tip3'),
        t('socialMediaExporter.presets.facebookReel.tip4')
      ],
      hashtags: ['#FacebookReels', '#Reels', '#Facebook']
    },

    // Generic presets
    {
      id: 'mobile-optimized',
      name: t('socialMediaExporter.presets.mobileOptimized.name'),
      platform: 'Mobile',
      icon: <Smartphone className="w-5 h-5 text-green-500" />,
      resolution: { width: 1080, height: 1920 },
      aspectRatio: '9:16',
      maxDuration: 60,
      recommendedBitrate: '3 Mbps',
      format: 'MP4',
      description: t('socialMediaExporter.presets.mobileOptimized.description'),
      tips: [
        t('socialMediaExporter.presets.mobileOptimized.tip1'),
        t('socialMediaExporter.presets.mobileOptimized.tip2'),
        t('socialMediaExporter.presets.mobileOptimized.tip3')
      ],
      hashtags: ['#Mobile', '#Video', '#ShortForm']
    },
    {
      id: 'desktop-web',
      name: t('socialMediaExporter.presets.desktopWeb.name'),
      platform: 'Web',
      icon: <Monitor className="w-5 h-5 text-purple-500" />,
      resolution: { width: 1920, height: 1080 },
      aspectRatio: '16:9',
      maxDuration: 0,
      recommendedBitrate: '8 Mbps',
      format: 'MP4',
      description: t('socialMediaExporter.presets.desktopWeb.description'),
      tips: [
        t('socialMediaExporter.presets.desktopWeb.tip1'),
        t('socialMediaExporter.presets.desktopWeb.tip2'),
        t('socialMediaExporter.presets.desktopWeb.tip3')
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
    showToast(t('socialMediaExporter.startingExport', { platform: preset.platform, name: preset.name }), 'info')
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
          <h3 className="font-semibold text-lg text-gray-900 dark:text-[var(--text-main)]">
            {t('socialMediaExporter.title')}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('socialMediaExporter.subtitle')}
          </p>
        </div>
      </div>

      {/* Export Options */}
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <Settings className="w-4 h-4" />
          {t('socialMediaExporter.exportOptions')}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={exportOptions.includeWatermark}
              onChange={(e) => setExportOptions(prev => ({ ...prev, includeWatermark: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm">{t('socialMediaExporter.includeWatermark')}</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={exportOptions.addCaptions}
              onChange={(e) => setExportOptions(prev => ({ ...prev, addCaptions: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm">{t('socialMediaExporter.addCaptions')}</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={exportOptions.optimizeAudio}
              onChange={(e) => setExportOptions(prev => ({ ...prev, optimizeAudio: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm">{t('socialMediaExporter.optimizeAudio')}</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={exportOptions.addEndScreen}
              onChange={(e) => setExportOptions(prev => ({ ...prev, addEndScreen: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm">{t('socialMediaExporter.addEndScreen')}</span>
          </label>
          <label className="flex items-center gap-2 group relative">
            <input
              type="checkbox"
              checked={exportOptions.allowSmartRefit}
              onChange={(e) => setExportOptions(prev => ({ ...prev, allowSmartRefit: e.target.checked }))}
              className="rounded border-orange-300 text-orange-500 focus:ring-orange-500"
            />
            <span className="text-sm font-bold text-orange-600 dark:text-orange-400 flex items-center gap-1">
              {t('socialMediaExporter.aiSmartRefit')}
              <span className="text-[8px] bg-orange-100 dark:bg-orange-900/40 px-1 rounded">{t('socialMediaExporter.beta')}</span>
            </span>
          </label>
        </div>
      </div>

      {/* Pro Scheduler & Distribution */}
      <div className="mb-10 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-3xl p-8 border border-indigo-500/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-10">
          <Globe className="w-24 h-24 text-indigo-500" />
        </div>

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-500 rounded-2xl text-white shadow-lg shadow-indigo-500/20">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-lg font-black text-gray-900 dark:text-[var(--text-main)] uppercase tracking-tighter">{t('socialMediaExporter.proScheduler')}</h4>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest opacity-60">{t('socialMediaExporter.eliteEngine')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">{t('socialMediaExporter.alphaAccess')}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="space-y-4">
            <label className="flex items-center gap-4 p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-indigo-500/30 transition-all cursor-pointer group">
              <div className={`p-2 rounded-xl transition-colors ${exportOptions.isScheduled ? 'bg-indigo-500 text-white' : 'bg-gray-50 dark:bg-gray-800'}`}>
                <Clock className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tighter">{t('socialMediaExporter.schedulePost')}</p>
                <p className="text-[9px] text-gray-500 font-bold">{t('socialMediaExporter.schedulePostHint')}</p>
              </div>
              <input
                type="checkbox"
                checked={exportOptions.isScheduled}
                onChange={(e) => setExportOptions(prev => ({ ...prev, isScheduled: e.target.checked }))}
                className="w-5 h-5 rounded-lg border-2 border-gray-200 text-indigo-600 focus:ring-indigo-500 transition-all"
              />
            </label>

            {exportOptions.isScheduled && (
              <div className="grid grid-cols-2 gap-3 pl-12">
                <input
                  type="date"
                  className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-indigo-500 transition-all"
                  value={exportOptions.scheduledDate}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, scheduledDate: e.target.value }))}
                  title={t('socialMediaExporter.scheduledDateTitle')}
                />
                <input
                  type="time"
                  className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-indigo-500 transition-all"
                  value={exportOptions.scheduledTime}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, scheduledTime: e.target.value }))}
                  title={t('socialMediaExporter.scheduledTimeTitle')}
                />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-4 p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-emerald-500/30 transition-all cursor-pointer group">
              <div className={`p-2 rounded-xl transition-colors ${exportOptions.postToAllLinked ? 'bg-emerald-500 text-white' : 'bg-gray-50 dark:bg-gray-800'}`}>
                <Zap className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tighter">{t('socialMediaExporter.multiPublish')}</p>
                <p className="text-[9px] text-gray-500 font-bold">{t('socialMediaExporter.multiPublishHint')}</p>
              </div>
              <input
                type="checkbox"
                checked={exportOptions.postToAllLinked}
                onChange={(e) => setExportOptions(prev => ({ ...prev, postToAllLinked: e.target.checked }))}
                className="w-5 h-5 rounded-lg border-2 border-gray-200 text-emerald-600 focus:ring-emerald-500 transition-all"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Platform Presets */}
      <div className="space-y-6">
        {Object.entries(platformGroups).map(([platform, presets]) => (
          <div key={platform}>
            <h4 className="font-medium mb-3 flex items-center gap-2 capitalize">
              {getPlatformIcon(platform === 'generic' ? 'Web' : platform)}
              {platform === 'generic' ? t('socialMediaExporter.general') : platform}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {presets.map(preset => (
                <div
                  key={preset.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${selectedPreset === preset.id
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
                      <span>{t('socialMediaExporter.resolution')}</span>
                      <span>{preset.resolution.width}×{preset.resolution.height}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('socialMediaExporter.aspectRatio')}</span>
                      <span>{preset.aspectRatio}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('socialMediaExporter.maxDuration')}</span>
                      <span>{preset.maxDuration || t('socialMediaExporter.unlimited')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('socialMediaExporter.bitrate')}</span>
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
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleExport(preset)
                    }}
                    className="w-full px-3 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    {t('socialMediaExporter.export')}
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
              {t('socialMediaExporter.exportInfoTitle')}
            </p>
            <ul className="text-blue-800 dark:text-blue-200 space-y-1">
              <li>• {t('socialMediaExporter.exportInfo1')}</li>
              <li>• {t('socialMediaExporter.exportInfo2')}</li>
              <li>• {t('socialMediaExporter.exportInfo3')}</li>
              <li>• {t('socialMediaExporter.exportInfo4')}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
