'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { useToast } from '../contexts/ToastContext'
import LoadingSpinner from './LoadingSpinner'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

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
    message: string
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
  const router = useRouter()
  const { showToast } = useToast()
  const [suggestions, setSuggestions] = useState<EnhancedSuggestion[]>([])
  const [gaps, setGaps] = useState<ContentGap | null>(null)
  const [trending, setTrending] = useState<string[]>([])
  const [viralPrediction, setViralPrediction] = useState<ViralPrediction | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'suggestions' | 'gaps' | 'trending' | 'viral'>('suggestions')
  const [predictionContent, setPredictionContent] = useState('')

  useEffect(() => {
    loadSuggestions()
    loadGaps()
    loadTrending()
  }, [])

  const loadSuggestions = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/suggestions/enhanced`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.data.success) {
        setSuggestions(response.data.data || [])
      }
    } catch (error) {
      showToast('Failed to load suggestions', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadGaps = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/suggestions/enhanced/gaps`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.data.success) {
        setGaps(response.data.data)
      }
    } catch (error) {
      // Silent fail
    }
  }

  const loadTrending = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/suggestions/enhanced/trending`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.data.success) {
        setTrending(response.data.data || [])
      }
    } catch (error) {
      // Silent fail
    }
  }

  const handlePredictViral = async () => {
    if (!predictionContent.trim()) {
      showToast('Please enter content to predict', 'error')
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await axios.post(
        `${API_URL}/suggestions/enhanced/viral-prediction`,
        { contentData: { text: predictionContent } },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )

      if (response.data.success) {
        setViralPrediction(response.data.data)
        showToast('Viral prediction generated', 'success')
      }
    } catch (error) {
      showToast('Failed to predict viral potential', 'error')
    }
  }

  const handleUseSuggestion = (suggestion: EnhancedSuggestion) => {
    router.push(`/dashboard/content?idea=${encodeURIComponent(suggestion.title)}`)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">💡 Enhanced Content Suggestions</h2>
        <button
          onClick={() => {
            loadSuggestions()
            loadGaps()
            loadTrending()
          }}
          className="text-sm text-purple-600 hover:text-purple-800"
        >
          Refresh
        </button>
      </div>

      <div className="flex gap-2 mb-4 border-b overflow-x-auto">
        <button
          onClick={() => setActiveTab('suggestions')}
          className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${
            activeTab === 'suggestions'
              ? 'border-b-2 border-purple-600 text-purple-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Suggestions
        </button>
        <button
          onClick={() => setActiveTab('gaps')}
          className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${
            activeTab === 'gaps'
              ? 'border-b-2 border-purple-600 text-purple-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Content Gaps
        </button>
        <button
          onClick={() => setActiveTab('trending')}
          className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${
            activeTab === 'trending'
              ? 'border-b-2 border-purple-600 text-purple-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Trending
        </button>
        <button
          onClick={() => setActiveTab('viral')}
          className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${
            activeTab === 'viral'
              ? 'border-b-2 border-purple-600 text-purple-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Viral Predictor
        </button>
      </div>

      {loading && activeTab === 'suggestions' ? (
        <LoadingSpinner size="sm" text="Loading suggestions..." />
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
                      onClick={() => handleUseSuggestion(suggestion)}
                      className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 ml-2"
                    >
                      Use
                    </button>
                  </div>
                </div>
              ))}
              {suggestions.length === 0 && (
                <div className="text-center py-8 text-gray-500">No suggestions available</div>
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
                    <p className="text-sm">{suggestion.message}</p>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Great! No content gaps detected.
                </div>
              )}

              {gaps.missingPlatforms.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-semibold mb-2">Missing Platforms</h3>
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
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Trending</span>
                  </div>
                </div>
              ))}
              {trending.length === 0 && (
                <div className="text-center py-8 text-gray-500">No trending topics available</div>
              )}
            </div>
          )}

          {activeTab === 'viral' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Enter Content to Predict</label>
                <textarea
                  value={predictionContent}
                  onChange={(e) => setPredictionContent(e.target.value)}
                  placeholder="Paste your content here..."
                  rows={4}
                  className="w-full px-4 py-2 border rounded-lg"
                />
                <button
                  onClick={handlePredictViral}
                  disabled={!predictionContent.trim()}
                  className="mt-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  Predict Viral Potential
                </button>
              </div>

              {viralPrediction && (
                <div className="border rounded-lg p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Viral Prediction</h3>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-purple-600">{viralPrediction.viralScore}</div>
                      <div className="text-sm text-gray-600">Score</div>
                    </div>
                  </div>
                  <div className="mb-4">
                    <p className="text-sm mb-2">
                      Potential: <strong className="capitalize">{viralPrediction.potential}</strong>
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
                      <h4 className="font-semibold text-sm mb-2">Factors:</h4>
                      <ul className="list-disc list-inside text-sm space-y-1">
                        {viralPrediction.factors.map((factor, index) => (
                          <li key={index}>{factor}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {viralPrediction.recommendations.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Recommendations:</h4>
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







