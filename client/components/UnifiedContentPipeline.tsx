'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import { 
  Video, 
  FileText, 
  Mic, 
  File, 
  Twitter, 
  Linkedin, 
  Facebook, 
  Instagram, 
  Youtube, 
  Music,
  Zap,
  TrendingUp,
  RefreshCw,
  BarChart3,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface PipelineProps {
  contentId: string
  contentType: 'video' | 'article' | 'podcast' | 'transcript'
  onComplete?: (pipeline: any) => void
}

export default function UnifiedContentPipeline({ contentId, contentType, onComplete }: PipelineProps) {
  const [pipeline, setPipeline] = useState<any>(null)
  const [status, setStatus] = useState<'idle' | 'processing' | 'completed' | 'error'>('idle')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([
    'twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok'
  ])
  const [autoSchedule, setAutoSchedule] = useState(false)
  const [enableRecycling, setEnableRecycling] = useState(true)
  const { showToast } = useToast()

  const platforms = [
    { id: 'twitter', name: 'Twitter/X', icon: Twitter, color: 'bg-blue-500' },
    { id: 'linkedin', name: 'LinkedIn', icon: Linkedin, color: 'bg-blue-600' },
    { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'bg-blue-700' },
    { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'bg-pink-500' },
    { id: 'youtube', name: 'YouTube', icon: Youtube, color: 'bg-red-500' },
    { id: 'tiktok', name: 'TikTok', icon: Music, color: 'bg-black' }
  ]

  const contentTypeIcons = {
    video: Video,
    article: FileText,
    podcast: Mic,
    transcript: File
  }

  const ContentIcon = contentTypeIcons[contentType] || FileText

  const processPipeline = async () => {
    try {
      setStatus('processing')
      const token = localStorage.getItem('token')

      const response = await axios.post(
        `${API_URL}/pipeline/process`,
        {
          contentId,
          platforms: selectedPlatforms,
          autoSchedule,
          enableRecycling,
          includePerformancePrediction: true,
          includeAnalytics: true
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.data.success) {
        setPipeline(response.data.data)
        setStatus('completed')
        showToast('Pipeline completed successfully!', 'success')
        if (onComplete) {
          onComplete(response.data.data)
        }
      }
    } catch (error: any) {
      setStatus('error')
      showToast(error.response?.data?.message || 'Pipeline processing failed', 'error')
    }
  }

  const publishAll = async () => {
    try {
      const token = localStorage.getItem('token')

      const response = await axios.post(
        `${API_URL}/pipeline/${contentId}/publish`,
        {
          platforms: selectedPlatforms,
          schedule: autoSchedule
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.data.success) {
        showToast('Published to all networks!', 'success')
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Publishing failed', 'error')
    }
  }

  const loadStatus = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${API_URL}/pipeline/${contentId}/status`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.data.success && response.data.data) {
        setPipeline(response.data.data)
        setStatus(response.data.data.status === 'completed' ? 'completed' : 'processing')
      }
    } catch (error) {
      // Pipeline not started yet
    }
  }

  useEffect(() => {
    if (contentId) {
      loadStatus()
    }
  }, [contentId])

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
            <ContentIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Unified Content Pipeline
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              One pipeline: long-form in → multi-format social across 6 networks out
            </p>
          </div>
        </div>
      </div>

      {/* Pipeline Flow Visualization */}
      <div className="mb-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ContentIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span className="font-medium text-gray-900 dark:text-white capitalize">{contentType}</span>
          </div>
          <div className="flex-1 mx-4">
            <div className="h-1 bg-indigo-200 dark:bg-indigo-800 rounded-full overflow-hidden">
              <div 
                className={`h-full bg-indigo-600 dark:bg-indigo-400 transition-all duration-500 ${
                  status === 'completed' ? 'w-full' : status === 'processing' ? 'w-2/3' : 'w-0'
                }`}
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            {platforms.filter(p => selectedPlatforms.includes(p.id)).map(platform => {
              const Icon = platform.icon
              return (
                <div key={platform.id} className={`p-2 rounded-lg ${platform.color} text-white`}>
                  <Icon className="w-4 h-4" />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Options */}
      {status === 'idle' && (
        <div className="mb-6 space-y-4">
          {/* Platform Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Platforms (6 networks)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {platforms.map(platform => {
                const Icon = platform.icon
                const isSelected = selectedPlatforms.includes(platform.id)
                return (
                  <button
                    key={platform.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform.id))
                      } else {
                        setSelectedPlatforms([...selectedPlatforms, platform.id])
                      }
                    }}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mx-auto mb-1 ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`} />
                    <span className={`text-xs ${isSelected ? 'text-indigo-600 dark:text-indigo-400 font-medium' : 'text-gray-500'}`}>
                      {platform.name}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoSchedule}
                onChange={(e) => setAutoSchedule(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Auto-schedule posts</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enableRecycling}
                onChange={(e) => setEnableRecycling(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Enable content recycling (built-in)</span>
            </label>
          </div>

          {/* Process Button */}
          <button
            onClick={processPipeline}
            disabled={selectedPlatforms.length === 0}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Zap className="w-5 h-5" />
            Process Pipeline
          </button>
        </div>
      )}

      {/* Processing Status */}
      {status === 'processing' && (
        <div className="text-center py-8">
          <RefreshCw className="w-12 h-12 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Processing pipeline...</p>
        </div>
      )}

      {/* Results */}
      {status === 'completed' && pipeline && (
        <div className="space-y-4">
          {/* Pipeline Steps */}
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-900 dark:text-white">Pipeline Steps</h3>
            {pipeline.steps?.map((step: any, index: number) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-gray-700 dark:text-gray-300 capitalize">
                  {step.step.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>

          {/* Assets Generated */}
          {pipeline.assets && (
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Assets Generated</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(pipeline.assets).map(([platform, assets]: [string, any]) => (
                  <div key={platform} className="p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <div className="flex items-center gap-2 mb-1">
                      {platforms.find(p => p.id === platform) && (
                        <>
                          {(() => {
                            const Icon = platforms.find(p => p.id === platform)!.icon
                            return <Icon className="w-4 h-4" />
                          })()}
                          <span className="text-xs font-medium capitalize">{platform}</span>
                        </>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">{Array.isArray(assets) ? assets.length : 0} assets</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Performance Predictions */}
          {pipeline.performance && Object.keys(pipeline.performance).length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                AI Performance Predictions (Built-in)
              </h3>
              <div className="space-y-2">
                {Object.entries(pipeline.performance).map(([platform, predictions]: [string, any]) => (
                  <div key={platform} className="p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium capitalize">{platform}</span>
                      <span className="text-sm text-indigo-600 dark:text-indigo-400">
                        Score: {predictions[0]?.score || 0}/100
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recycling Plan */}
          {pipeline.recycling?.isRecyclable && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <RefreshCw className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="font-medium text-green-900 dark:text-green-100">Content Recycling (Built-in)</span>
              </div>
              <p className="text-sm text-green-700 dark:text-green-300">
                This content is recyclable. Evergreen score: {pipeline.recycling.evergreenScore || 0}%
              </p>
            </div>
          )}

          {/* Distribution */}
          {pipeline.distribution && (
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Distribution</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {pipeline.distribution.totalScheduled || 0} posts scheduled across{' '}
                {pipeline.distribution.platforms?.length || 0} platforms
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={publishAll}
              className="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              Publish to All 6 Networks
            </button>
            <button
              onClick={() => setStatus('idle')}
              className="py-2 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Error State */}
      {status === 'error' && (
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 dark:text-red-400">Pipeline processing failed</p>
          <button
            onClick={() => setStatus('idle')}
            className="mt-4 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  )
}

