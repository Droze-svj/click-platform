'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Brain,
  Eye,
  Scissors,
  Zap,
  Target,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Play,
  Pause,
  SkipForward,
  SkipBack
} from 'lucide-react'
import { NeuralNetworkIcon } from './icons/VideoIcons'
import { useToast } from '../contexts/ToastContext'

interface SceneData {
  id: string
  startTime: number
  endTime: number
  duration: number
  type: 'action' | 'dialogue' | 'transition' | 'static' | 'dynamic'
  confidence: number
  thumbnail: string
  description: string
  suggestedEdits: SuggestedEdit[]
  emotions: EmotionData[]
  audioPeaks: number[]
}

interface SuggestedEdit {
  type: 'cut' | 'transition' | 'speed' | 'effect' | 'music'
  startTime: number
  endTime: number
  suggestion: string
  confidence: number
  autoApply?: boolean
}

interface EmotionData {
  emotion: 'happy' | 'sad' | 'angry' | 'surprised' | 'neutral' | 'fear'
  confidence: number
  timestamp?: number
}

interface AISceneDetectionProps {
  videoUrl: string
  onScenesDetected: (scenes: SceneData[]) => void
  onSuggestedEdit: (edit: SuggestedEdit) => void
  onAutoApplyEdits?: (edits: SuggestedEdit[]) => void
}

export default function AISceneDetection({
  videoUrl,
  onScenesDetected,
  onSuggestedEdit,
  onAutoApplyEdits
}: AISceneDetectionProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [scenes, setScenes] = useState<SceneData[]>([])
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [autoApplyEnabled, setAutoApplyEnabled] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { showToast } = useToast()

  // Mock AI analysis function (in real implementation, this would call actual AI APIs)
  const analyzeVideo = useCallback(async () => {
    setIsAnalyzing(true)
    setAnalysisProgress(0)

    try {
      // Simulate AI processing steps
      const steps = [
        'Loading video analysis models...',
        'Detecting scene changes...',
        'Analyzing content and emotions...',
        'Identifying key moments...',
        'Generating editing suggestions...'
      ]

      for (let i = 0; i < steps.length; i++) {
        setAnalysisProgress((i + 1) / steps.length * 100)
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      // Mock scene detection results
      const mockScenes: SceneData[] = [
        {
          id: 'scene-1',
          startTime: 0,
          endTime: 8.5,
          duration: 8.5,
          type: 'action',
          confidence: 0.92,
          thumbnail: '/thumbnails/scene1.jpg',
          description: 'Dynamic opening scene with movement',
          suggestedEdits: [
            {
              type: 'transition',
              startTime: 8.2,
              endTime: 8.5,
              suggestion: 'Add fade transition',
              confidence: 0.85,
              autoApply: true
            }
          ],
          emotions: [
            { emotion: 'surprised', confidence: 0.7, timestamp: 2.3 },
            { emotion: 'happy', confidence: 0.6, timestamp: 5.1 }
          ],
          audioPeaks: [0.2, 0.8, 0.6, 0.9, 0.3, 0.7, 0.4, 0.5]
        },
        {
          id: 'scene-2',
          startTime: 8.5,
          endTime: 18.2,
          duration: 9.7,
          type: 'dialogue',
          confidence: 0.88,
          thumbnail: '/thumbnails/scene2.jpg',
          description: 'Conversation scene with two speakers',
          suggestedEdits: [
            {
              type: 'cut',
              startTime: 12.1,
              endTime: 13.5,
              suggestion: 'Remove pause in dialogue',
              confidence: 0.76
            },
            {
              type: 'music',
              startTime: 8.5,
              endTime: 18.2,
              suggestion: 'Add subtle background music',
              confidence: 0.82,
              autoApply: true
            }
          ],
          emotions: [
            { emotion: 'neutral', confidence: 0.8, timestamp: 10.2 },
            { emotion: 'happy', confidence: 0.5, timestamp: 15.8 }
          ],
          audioPeaks: [0.1, 0.2, 0.8, 0.9, 0.7, 0.3, 0.6, 0.4, 0.2, 0.1]
        },
        {
          id: 'scene-3',
          startTime: 18.2,
          endTime: 25.8,
          duration: 7.6,
          type: 'dynamic',
          confidence: 0.95,
          thumbnail: '/thumbnails/scene3.jpg',
          description: 'High-energy action sequence',
          suggestedEdits: [
            {
              type: 'speed',
              startTime: 20.5,
              endTime: 23.2,
              suggestion: 'Slow motion effect (0.5x speed)',
              confidence: 0.91,
              autoApply: true
            },
            {
              type: 'effect',
              startTime: 18.2,
              endTime: 25.8,
              suggestion: 'Add motion blur effect',
              confidence: 0.78
            }
          ],
          emotions: [
            { emotion: 'surprised', confidence: 0.9, timestamp: 19.5 },
            { emotion: 'fear', confidence: 0.6, timestamp: 22.1 }
          ],
          audioPeaks: [0.9, 1.0, 0.8, 0.7, 0.6, 0.5, 0.8, 0.9]
        },
        {
          id: 'scene-4',
          startTime: 25.8,
          endTime: 32.1,
          duration: 6.3,
          type: 'static',
          confidence: 0.83,
          thumbnail: '/thumbnails/scene4.jpg',
          description: 'Calm closing scene',
          suggestedEdits: [
            {
              type: 'transition',
              startTime: 25.8,
              endTime: 26.5,
              suggestion: 'Crossfade transition',
              confidence: 0.89,
              autoApply: true
            }
          ],
          emotions: [
            { emotion: 'happy', confidence: 0.8, timestamp: 28.3 },
            { emotion: 'neutral', confidence: 0.4, timestamp: 30.1 }
          ],
          audioPeaks: [0.3, 0.2, 0.1, 0.4, 0.3, 0.2]
        }
      ]

      setScenes(mockScenes)
      onScenesDetected(mockScenes)
      showToast('AI analysis complete! Scenes detected and suggestions generated.', 'success')

    } catch (error) {
      console.error('AI analysis failed:', error)
      showToast('AI analysis failed. Please try again.', 'error')
    } finally {
      setIsAnalyzing(false)
      setAnalysisProgress(0)
    }
  }, [onScenesDetected, showToast])

  const applySuggestedEdit = useCallback((edit: SuggestedEdit) => {
    onSuggestedEdit(edit)
    showToast(`Applied: ${edit.suggestion}`, 'success')
  }, [onSuggestedEdit, showToast])

  const autoApplyAllEdits = useCallback(() => {
    const autoApplyEdits = scenes.flatMap(scene =>
      scene.suggestedEdits.filter(edit => edit.autoApply)
    )

    if (autoApplyEdits.length > 0) {
      onAutoApplyEdits?.(autoApplyEdits)
      showToast(`Auto-applied ${autoApplyEdits.length} suggested edits`, 'success')
    } else {
      showToast('No auto-apply edits available', 'info')
    }
  }, [scenes, onAutoApplyEdits, showToast])

  const jumpToScene = useCallback((sceneIndex: number) => {
    setCurrentSceneIndex(sceneIndex)
    const scene = scenes[sceneIndex]
    if (scene && videoRef.current) {
      videoRef.current.currentTime = scene.startTime
    }
  }, [scenes])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getSceneTypeIcon = (type: SceneData['type']) => {
    switch (type) {
      case 'action': return <Zap className="w-4 h-4" />
      case 'dialogue': return <Eye className="w-4 h-4" />
      case 'transition': return <Target className="w-4 h-4" />
      case 'static': return <Pause className="w-4 h-4" />
      case 'dynamic': return <TrendingUp className="w-4 h-4" />
      default: return <Eye className="w-4 h-4" />
    }
  }

  const getEmotionColor = (emotion: EmotionData['emotion']) => {
    switch (emotion) {
      case 'happy': return 'bg-yellow-500'
      case 'sad': return 'bg-blue-500'
      case 'angry': return 'bg-red-500'
      case 'surprised': return 'bg-orange-500'
      case 'fear': return 'bg-purple-500'
      case 'neutral': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <NeuralNetworkIcon className="w-5 h-5" />
              AI Scene Detection & Auto-Editing
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Intelligent video analysis and automated editing suggestions
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoApplyEnabled}
                onChange={(e) => setAutoApplyEnabled(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              Auto-apply
            </label>
            <button
              onClick={analyzeVideo}
              disabled={isAnalyzing || !videoUrl}
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
            >
              {isAnalyzing ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Analyzing...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <NeuralNetworkIcon className="w-4 h-4" />
                  Analyze Video
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        {isAnalyzing && (
          <div className="mt-4">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${analysisProgress}%` }}
              ></div>
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {Math.round(analysisProgress)}% complete
            </div>
          </div>
        )}
      </div>

      <div className="p-6">
        {scenes.length === 0 ? (
          <div className="text-center py-12">
              <NeuralNetworkIcon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              AI-Powered Video Analysis
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Upload a video and let AI analyze scenes, detect emotions, and suggest intelligent edits automatically.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <Eye className="w-8 h-8 text-blue-500 mb-2" />
                <h4 className="font-medium text-blue-900 dark:text-blue-100">Scene Detection</h4>
                <p className="text-blue-700 dark:text-blue-300">Automatically identify scene changes</p>
              </div>
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <Target className="w-8 h-8 text-purple-500 mb-2" />
                <h4 className="font-medium text-purple-900 dark:text-purple-100">Smart Suggestions</h4>
                <p className="text-purple-700 dark:text-purple-300">AI-powered editing recommendations</p>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <Zap className="w-8 h-8 text-green-500 mb-2" />
                <h4 className="font-medium text-green-900 dark:text-green-100">Auto-Editing</h4>
                <p className="text-green-700 dark:text-green-300">Apply intelligent edits automatically</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Auto-Apply Button */}
            {autoApplyEnabled && scenes.some(scene => scene.suggestedEdits.some(edit => edit.autoApply)) && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-lg border border-green-200 dark:border-green-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-green-900 dark:text-green-100 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Auto-Apply Available
                    </h4>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      {scenes.flatMap(s => s.suggestedEdits.filter(e => e.autoApply)).length} AI suggestions ready to apply
                    </p>
                  </div>
                  <button
                    onClick={autoApplyAllEdits}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                  >
                    Apply All
                  </button>
                </div>
              </div>
            )}

            {/* Scene Timeline */}
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-4">Detected Scenes</h4>
              <div className="space-y-3">
                {scenes.map((scene, index) => (
                  <div
                    key={scene.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      currentSceneIndex === index
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600'
                        : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600/50'
                    }`}
                    onClick={() => jumpToScene(index)}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          {getSceneTypeIcon(scene.type)}
                          <span className="text-sm font-medium capitalize text-gray-700 dark:text-gray-300">
                            {scene.type}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatTime(scene.startTime)} - {formatTime(scene.endTime)}
                        </span>
                        <span className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">
                          {Math.round(scene.confidence * 100)}% confidence
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (videoRef.current) {
                              videoRef.current.currentTime = scene.startTime
                            }
                          }}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {scene.description}
                    </p>

                    {/* Emotion Timeline */}
                    {scene.emotions.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Emotions detected:</div>
                        <div className="flex gap-1">
                          {scene.emotions.map((emotion, emotionIndex) => (
                            <div
                              key={emotionIndex}
                              className={`w-2 h-6 rounded ${getEmotionColor(emotion.emotion)}`}
                              title={`${emotion.emotion} (${Math.round(emotion.confidence * 100)}%)`}
                            ></div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Audio Waveform */}
                    {scene.audioPeaks.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Audio levels:</div>
                        <div className="flex items-end gap-px h-8">
                          {scene.audioPeaks.map((peak, peakIndex) => (
                            <div
                              key={peakIndex}
                              className="bg-blue-400 dark:bg-blue-600 flex-1 rounded-sm"
                              style={{ height: `${peak * 100}%` }}
                            ></div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Suggested Edits */}
                    {scene.suggestedEdits.length > 0 && (
                      <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">AI Suggestions:</div>
                        <div className="space-y-2">
                          {scene.suggestedEdits.map((edit, editIndex) => (
                            <div
                              key={editIndex}
                              className={`flex items-center justify-between p-2 rounded text-sm ${
                                edit.autoApply
                                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700'
                                  : 'bg-gray-50 dark:bg-gray-600'
                              }`}
                            >
                              <div className="flex-1">
                                <span className="font-medium capitalize">{edit.type}:</span> {edit.suggestion}
                                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                  ({Math.round(edit.confidence * 100)}% confidence)
                                </span>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  applySuggestedEdit(edit)
                                }}
                                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                                  edit.autoApply
                                    ? 'bg-green-500 text-white hover:bg-green-600'
                                    : 'bg-blue-500 text-white hover:bg-blue-600'
                                }`}
                              >
                                Apply
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Scene Navigation */}
            <div className="flex items-center justify-center gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => jumpToScene(Math.max(0, currentSceneIndex - 1))}
                disabled={currentSceneIndex === 0}
                className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <span className="text-sm text-gray-600 dark:text-gray-400">
                Scene {currentSceneIndex + 1} of {scenes.length}
              </span>

              <button
                onClick={() => jumpToScene(Math.min(scenes.length - 1, currentSceneIndex + 1))}
                disabled={currentSceneIndex === scenes.length - 1}
                className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
