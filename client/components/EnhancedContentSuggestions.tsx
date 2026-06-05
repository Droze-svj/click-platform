'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '../contexts/ToastContext'
import LoadingSpinner from './LoadingSpinner'
import { apiGet, apiPost } from '../lib/api'
import { useTranslation } from '@/hooks/useTranslation'

interface EnhancedSuggestion {
  type: string
  title: string
  description: string
  priority: string
  source: string
}

interface ContentGap {
  daysWithoutContent: string[]
  missingPlatforms: string[]
  lowEngagementTypes: string[]
  suggestions: Array<{
    type: string
    priority: string
  }>
}

interface ViralPrediction {
  viralScore: number
  potential: string
  factors: string[]
  recommendations: string[]
}

export default function EnhancedContentSuggestions() {
  const { t } = useTranslation()
  const router = useRouter()
  const { showToast } = useToast()
  const [suggestions, setSuggestions] = useState<EnhancedSuggestion[]>([])
  const [gaps, setGaps] = useState<ContentGap | null>(null)
  const [trending, setTrending] = useState<string[]>([])
  const [viralPrediction, setViralPrediction] = useState<ViralPrediction | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'suggestions' | 'gaps' | 'trending' | 'viral'>('suggestions')
  const [predictionContent, setPredictionContent] = useState('')

  const loadSuggestions = useCallback(async () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 [EnhancedContentSuggestions] Skipping suggestions API call in development mode')
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const response = await apiGet<any>('/suggestions/enhanced')
      if (response?.success) {
        setSuggestions(response.data || [])
      }
    } catch (error) {
      showToast(t('enhancedContentSuggestions.failedToLoadSuggestions'), 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    loadSuggestions()
    loadGaps()
    loadTrending()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadSuggestions])

  const loadGaps = async () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 [EnhancedContentSuggestions] Skipping gaps API call in development mode')
      return
    }
    try {
      const response = await apiGet<any>('/suggestions/enhanced/gaps')
      if (response?.success) {
        setGaps(response.data)
      }
    } catch (error) {
      // Silent fail
    }
  }

  const loadTrending = async () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 [EnhancedContentSuggestions] Skipping trending API call in development mode')
      return
    }
    try {
      const response = await apiGet<any>('/suggestions/enhanced/trending')
      if (response?.success) {
        setTrending(response.data || [])
      }
    } catch (error) {
      // Silent fail
    }
  }

  const handlePredictViral = async () => {
    if (!predictionContent.trim()) {
      showToast(t('enhancedContentSuggestions.pleaseEnterContent'), 'error')
      return
    }

    try {
      const response = await apiPost<any>('/suggestions/enhanced/viral-prediction', { contentData: { text: predictionContent } })
      if (response?.success) {
        setViralPrediction(response.data)
        showToast(t('enhancedContentSuggestions.viralPredictionGenerated'), 'success')
      }
    } catch (error) {
      showToast(t('enhancedContentSuggestions.failedToPredict'), 'error')
    }
  }

  const handleUseSuggestion = (suggestion: EnhancedSuggestion) => {
    router.push(`/dashboard/content?idea=${encodeURIComponent(suggestion.title)}`)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">{t('enhancedContentSuggestions.title')}</h2>
        <button
          type="button"
          onClick={() => {
            loadSuggestions()
            loadGaps()
            loadTrending()
          }}
          className="text-sm text-purple-600 hover:text-purple-800"
        >
          {t('enhancedContentSuggestions.refresh')}
        </button>
      </div>

      <div className="flex gap-2 mb-4 border-b overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('suggestions')}
          className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${
            activeTab === 'suggestions'
              ? 'border-b-2 border-purple-600 text-purple-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          {t('enhancedContentSuggestions.tabSuggestions')}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('gaps')}
          className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${
            activeTab === 'gaps'
              ? 'border-b-2 border-purple-600 text-purple-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          {t('enhancedContentSuggestions.tabContentGaps')}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('trending')}
          className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${
            activeTab === 'trending'
              ? 'border-b-2 border-purple-600 text-purple-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          {t('enhancedContentSuggestions.tabTrending')}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('viral')}
          className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${
            activeTab === 'viral'
              ? 'border-b-2 border-purple-600 text-purple-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          {t('enhancedContentSuggestions.tabViralPredictor')}
        </button>
      </div>

      {loading && activeTab === 'suggestions' ? (
        <LoadingSpinner size="sm" text={t('enhancedContentSuggestions.loadingSuggestions')} />
      ) : (
        <>
          {activeTab === 'suggestions' && (
            <div className="space-y-4">
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className={`border rounded-lg p-4 ${
                    suggestion.priority === 'high' ? 'border-red-300 bg-red-50 dark:bg-red-900/20' :
                    suggestion.priority === 'medium' ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20' :
                    'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{suggestion.title}</span>
                        <span className={`px-2 py-1 rounded text-xs ${
                          suggestion.type === 'trending' ? 'bg-blue-100 text-blue-800' :
                          suggestion.type === 'gap' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {suggestion.type}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs ${
                          suggestion.priority === 'high' ? 'bg-red-100 text-red-800' :
                          suggestion.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {suggestion.priority}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{suggestion.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUseSuggestion(suggestion)}
                      className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 ml-2"
                    >
                      {t('enhancedContentSuggestions.use')}
                    </button>
                  </div>
                </div>
              ))}
              {suggestions.length === 0 && (
                <div className="text-center py-8 text-gray-500">{t('enhancedContentSuggestions.noSuggestions')}</div>
              )}
            </div>
          )}

          {activeTab === 'gaps' && gaps && (
            <div className="space-y-4">
              {gaps.suggestions.length > 0 ? (
                gaps.suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg ${
                      suggestion.priority === 'high' ? 'bg-red-50 dark:bg-red-900/20' :
                      suggestion.priority === 'medium' ? 'bg-yellow-50 dark:bg-yellow-900/20' :
                      'bg-blue-50 dark:bg-blue-900/20'
                    }`}
                  >
                    <p className="text-sm">{suggestion.type}</p>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  {t('enhancedContentSuggestions.noContentGaps')}
                </div>
              )}

              {gaps.missingPlatforms.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-semibold mb-2">{t('enhancedContentSuggestions.missingPlatforms')}</h3>
                  <div className="flex flex-wrap gap-2">
                    {gaps.missingPlatforms.map((platform) => (
                      <span key={platform} className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm capitalize">
                        {platform}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'trending' && (
            <div className="space-y-3">
              {trending.map((topic, index) => (
                <div
                  key={index}
                  className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                  onClick={() => router.push(`/dashboard/content?topic=${encodeURIComponent(topic)}`)}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{topic}</p>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">{t('enhancedContentSuggestions.trendingBadge')}</span>
                  </div>
                </div>
              ))}
              {trending.length === 0 && (
                <div className="text-center py-8 text-gray-500">{t('enhancedContentSuggestions.noTrendingTopics')}</div>
              )}
            </div>
          )}

          {activeTab === 'viral' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">{t('enhancedContentSuggestions.enterContentToPredict')}</label>
                <textarea
                  value={predictionContent}
                  onChange={(e) => setPredictionContent(e.target.value)}
                  placeholder={t('enhancedContentSuggestions.pasteContentPlaceholder')}
                  rows={4}
                  className="w-full px-4 py-2 border rounded-lg"
                />
                <button
                  type="button"
                  onClick={handlePredictViral}
                  disabled={!predictionContent.trim()}
                  className="mt-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {t('enhancedContentSuggestions.predictViralPotential')}
                </button>
              </div>

              {viralPrediction && (
                <div className="border rounded-lg p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">{t('enhancedContentSuggestions.viralPrediction')}</h3>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-purple-600">{viralPrediction.viralScore}</div>
                      <div className="text-sm text-gray-600">{t('enhancedContentSuggestions.score')}</div>
                    </div>
                  </div>
                  <div className="mb-4">
                    <p className="text-sm mb-2">
                      {t('enhancedContentSuggestions.potential')} <strong className="capitalize">{viralPrediction.potential}</strong>
                    </p>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full"
                        style={{ width: `${viralPrediction.viralScore}%` }}
                      />
                    </div>
                  </div>
                  {viralPrediction.factors.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold text-sm mb-2">{t('enhancedContentSuggestions.factors')}</h4>
                      <ul className="list-disc list-inside text-sm space-y-1">
                        {viralPrediction.factors.map((factor, index) => (
                          <li key={index}>{factor}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {viralPrediction.recommendations.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm mb-2">{t('enhancedContentSuggestions.recommendations')}</h4>
                      <ul className="list-disc list-inside text-sm space-y-1">
                        {viralPrediction.recommendations.map((rec, index) => (
                          <li key={index}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}







