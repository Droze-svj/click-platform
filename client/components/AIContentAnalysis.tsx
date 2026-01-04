'use client'

import { useState, useEffect } from 'react'
import {
  Brain,
  TrendingUp,
  Clock,
  Target,
  Zap,
  Scissors,
  BarChart3,
  Lightbulb,
  CheckCircle,
  AlertTriangle
} from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { apiPost } from '../lib/api'

interface AnalysisResult {
  highlights: Array<{
    startTime: number
    endTime: number
    confidence: number
    reason: string
    suggestedAction: string
  }>
  pacing: {
    score: number
    suggestions: string[]
  }
  engagement: {
    score: number
    peakMoments: Array<{
      time: number
      intensity: number
    }>
  }
  technical: {
    quality: 'excellent' | 'good' | 'fair' | 'poor'
    issues: string[]
    recommendations: string[]
  }
  content: {
    themes: string[]
    mood: string
    targetAudience: string[]
  }
  suggestions: Array<{
    type: 'cut' | 'keep' | 'enhance' | 'transition'
    startTime: number
    endTime: number
    description: string
    priority: 'high' | 'medium' | 'low'
  }>
}

interface AIContentAnalysisProps {
  videoUrl: string
  videoId?: string
  onAnalysisComplete?: (results: AnalysisResult) => void
  onApplySuggestion?: (suggestion: AnalysisResult['suggestions'][0]) => void
}

export default function AIContentAnalysis({
  videoUrl,
  videoId,
  onAnalysisComplete,
  onApplySuggestion
}: AIContentAnalysisProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [selectedTab, setSelectedTab] = useState<'overview' | 'highlights' | 'suggestions' | 'technical'>('overview')
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set())

  const { showToast } = useToast()

  const analyzeVideo = async () => {
    if (!videoUrl) {
      showToast('Video URL is required for analysis', 'error')
      return
    }

    setIsAnalyzing(true)
    try {
      const response = await apiPost('/ai/analyze-video', {
        videoUrl,
        videoId,
        analysisTypes: ['highlights', 'pacing', 'engagement', 'technical', 'content']
      })

      if (response.success) {
        setAnalysis(response.data)
        onAnalysisComplete?.(response.data)
        showToast('AI analysis completed!', 'success')
      } else {
        throw new Error(response.error || 'Analysis failed')
      }
    } catch (error: any) {
      console.error('AI analysis error:', error)
      showToast(error.message || 'Failed to analyze video', 'error')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const applySuggestion = (suggestion: AnalysisResult['suggestions'][0]) => {
    setAppliedSuggestions(prev => new Set([...Array.from(prev), suggestion.description]))
    onApplySuggestion?.(suggestion)
    showToast(`Applied: ${suggestion.description}`, 'success')
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'low': return 'text-green-600 bg-green-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'text-green-600 bg-green-100'
      case 'good': return 'text-blue-600 bg-blue-100'
      case 'fair': return 'text-yellow-600 bg-yellow-100'
      case 'poor': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3 mb-6">
        <Brain className="w-6 h-6 text-purple-600 dark:text-purple-400" />
        <div>
          <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
            AI Content Analysis
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Get intelligent insights and editing suggestions for your video
          </p>
        </div>
      </div>

      {!analysis && (
        <div className="text-center py-8">
          <button
            onClick={analyzeVideo}
            disabled={isAnalyzing}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
          >
            {isAnalyzing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Analyzing...
              </>
            ) : (
              <>
                <Brain className="w-4 h-4" />
                Analyze Video with AI
              </>
            )}
          </button>
          <p className="text-sm text-gray-500 mt-3 max-w-md mx-auto">
            Our AI will analyze pacing, engagement, highlights, and provide professional editing suggestions
          </p>
        </div>
      )}

      {analysis && (
        <>
          {/* Tab Navigation */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'highlights', label: 'Highlights', icon: TrendingUp },
              { id: 'suggestions', label: 'Suggestions', icon: Lightbulb },
              { id: 'technical', label: 'Technical', icon: CheckCircle }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSelectedTab(id as any)}
                className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm ${
                  selectedTab === id
                    ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {selectedTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <span className="font-medium">Engagement Score</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600">{analysis.engagement.score}/100</div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {analysis.engagement.score > 70 ? 'Excellent' : analysis.engagement.score > 50 ? 'Good' : 'Needs improvement'}
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-5 h-5 text-blue-600" />
                    <span className="font-medium">Pacing Score</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">{analysis.pacing.score}/100</div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {analysis.pacing.suggestions.length > 0 ? `${analysis.pacing.suggestions.length} suggestions` : 'Well-paced'}
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-5 h-5 text-purple-600" />
                    <span className="font-medium">Highlights Found</span>
                  </div>
                  <div className="text-2xl font-bold text-purple-600">{analysis.highlights.length}</div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Key moments identified
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Brain className="w-4 h-4" />
                    Content Analysis
                  </h4>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm font-medium">Mood:</span>
                      <span className="ml-2 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-sm">
                        {analysis.content.mood}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm font-medium">Themes:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {analysis.content.themes.map((theme, index) => (
                          <span key={index} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs">
                            {theme}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium">Target Audience:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {analysis.content.targetAudience.map((audience, index) => (
                          <span key={index} className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded text-xs">
                            {audience}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Technical Quality
                  </h4>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm font-medium">Overall Quality:</span>
                      <span className={`ml-2 px-2 py-1 rounded text-sm ${getQualityColor(analysis.technical.quality)}`}>
                        {analysis.technical.quality}
                      </span>
                    </div>
                    {analysis.technical.issues.length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-red-600">Issues:</span>
                        <ul className="mt-1 space-y-1">
                          {analysis.technical.issues.map((issue, index) => (
                            <li key={index} className="text-xs text-red-600 flex items-start gap-1">
                              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                              {issue}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Highlights Tab */}
          {selectedTab === 'highlights' && (
            <div className="space-y-4">
              <h4 className="font-medium">Detected Highlights</h4>
              {analysis.highlights.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No highlights detected</p>
              ) : (
                <div className="space-y-3">
                  {analysis.highlights.map((highlight, index) => (
                    <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-green-600" />
                          <span className="font-medium">Highlight {index + 1}</span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {formatTime(highlight.startTime)} - {formatTime(highlight.endTime)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{highlight.reason}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-green-600">
                          Confidence: {Math.round(highlight.confidence * 100)}%
                        </span>
                        <span className="text-xs text-gray-500">{highlight.suggestedAction}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Suggestions Tab */}
          {selectedTab === 'suggestions' && (
            <div className="space-y-4">
              <h4 className="font-medium">AI Editing Suggestions</h4>
              {analysis.suggestions.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No suggestions available</p>
              ) : (
                <div className="space-y-3">
                  {analysis.suggestions.map((suggestion, index) => (
                    <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          {suggestion.type === 'cut' && <Scissors className="w-4 h-4 text-red-600" />}
                          {suggestion.type === 'keep' && <CheckCircle className="w-4 h-4 text-green-600" />}
                          {suggestion.type === 'enhance' && <Zap className="w-4 h-4 text-blue-600" />}
                          {suggestion.type === 'transition' && <Target className="w-4 h-4 text-purple-600" />}
                          <span className="font-medium capitalize">{suggestion.type}</span>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(suggestion.priority)}`}>
                          {suggestion.priority} priority
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{suggestion.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">
                          {formatTime(suggestion.startTime)} - {formatTime(suggestion.endTime)}
                        </span>
                        {!appliedSuggestions.has(suggestion.description) && (
                          <button
                            onClick={() => applySuggestion(suggestion)}
                            className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
                          >
                            Apply
                          </button>
                        )}
                        {appliedSuggestions.has(suggestion.description) && (
                          <span className="text-sm text-green-600 flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" />
                            Applied
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Technical Tab */}
          {selectedTab === 'technical' && (
            <div className="space-y-6">
              <div>
                <h4 className="font-medium mb-3">Technical Quality</h4>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Overall Quality:</span>
                    <span className={`px-2 py-1 rounded text-sm ${getQualityColor(analysis.technical.quality)}`}>
                      {analysis.technical.quality}
                    </span>
                  </div>

                  {analysis.technical.recommendations.length > 0 && (
                    <div>
                      <h5 className="font-medium mb-2">Recommendations:</h5>
                      <ul className="space-y-1">
                        {analysis.technical.recommendations.map((rec, index) => (
                          <li key={index} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                            <Lightbulb className="w-3 h-3 mt-0.5 text-yellow-500 flex-shrink-0" />
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {analysis.engagement.peakMoments.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Engagement Peaks</h4>
                  <div className="space-y-2">
                    {analysis.engagement.peakMoments.map((peak, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-3 rounded">
                        <span className="text-sm">Peak at {formatTime(peak.time)}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{ width: `${peak.intensity}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-600 dark:text-gray-400">{peak.intensity}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Re-analyze Button */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={analyzeVideo}
              disabled={isAnalyzing}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Re-analyzing...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4" />
                  Re-analyze Video
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

