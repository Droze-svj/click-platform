'use client'

import { useState, useEffect } from 'react'
import { Wand2, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface ContentAdaptationAssistantProps {
  contentId: string
  originalContent: {
    text: string
    title: string
    platforms?: string[]
  }
  onAdapted?: (adaptedContent: any) => void
}

interface Adaptation {
  platform: string
  content: string
  hashtags: string[]
  optimized: boolean
  score: number
  suggestions: string[]
}

export default function ContentAdaptationAssistant({
  contentId,
  originalContent,
  onAdapted
}: ContentAdaptationAssistantProps) {
  const [adaptations, setAdaptations] = useState<Adaptation[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(
    originalContent.platforms || ['twitter', 'linkedin', 'instagram', 'facebook', 'youtube', 'tiktok']
  )

  useEffect(() => {
    if (contentId && originalContent.text) {
      generateAdaptations()
    }
  }, [contentId])

  const generateAdaptations = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      
      const response = await axios.post(
        `${API_URL}/ai/adapt-content`,
        {
          contentId,
          text: originalContent.text,
          title: originalContent.title,
          platforms: selectedPlatforms
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.data.success) {
        setAdaptations(response.data.data.adaptations || [])
        onAdapted?.(response.data.data)
      }
    } catch (error: any) {
      console.error('Adaptation error:', error)
    } finally {
      setLoading(false)
    }
  }

  const applyAdaptation = async (platform: string, adaptation: Adaptation) => {
    try {
      const token = localStorage.getItem('token')
      
      await axios.post(
        `${API_URL}/content/${contentId}/adapt`,
        {
          platform,
          content: adaptation.content,
          hashtags: adaptation.hashtags
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      // Update local state
      setAdaptations(prev =>
        prev.map(a =>
          a.platform === platform ? { ...a, optimized: true } : a
        )
      )
    } catch (error: any) {
      console.error('Apply adaptation error:', error)
    }
  }

  const platformIcons: Record<string, string> = {
    twitter: '🐦',
    linkedin: '💼',
    facebook: '📘',
    instagram: '📷',
    youtube: '📺',
    tiktok: '🎵'
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <Wand2 className="w-6 h-6 text-purple-600" />
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
          AI Content Adaptation Assistant
        </h3>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600 dark:text-gray-400">
            Adapting content for all platforms...
          </span>
        </div>
      ) : adaptations.length > 0 ? (
        <div className="space-y-4">
          {adaptations.map((adaptation) => (
            <div
              key={adaptation.platform}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-500 dark:hover:border-blue-400 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{platformIcons[adaptation.platform] || '📱'}</span>
                  <h4 className="font-semibold text-gray-900 dark:text-white capitalize">
                    {adaptation.platform}
                  </h4>
                  {adaptation.optimized && (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Score: <span className="font-semibold">{adaptation.score}/100</span>
                  </div>
                  {!adaptation.optimized && (
                    <button
                      onClick={() => applyAdaptation(adaptation.platform, adaptation)}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                    >
                      Apply
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900 rounded p-3 mb-3">
                <p className="text-gray-800 dark:text-gray-200 text-sm whitespace-pre-wrap">
                  {adaptation.content}
                </p>
              </div>

              {adaptation.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {adaptation.hashtags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {adaptation.suggestions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Suggestions:
                      </p>
                      <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                        {adaptation.suggestions.map((suggestion, idx) => (
                          <li key={idx}>• {suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Click the button below to adapt your content for all platforms
          </p>
          <button
            onClick={generateAdaptations}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 font-semibold"
          >
            <Wand2 className="w-5 h-5 inline mr-2" />
            Adapt Content
          </button>
        </div>
      )}
    </div>
  )
}


