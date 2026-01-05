'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Lightbulb,
  ArrowRight,
  CheckCircle,
  Clock,
  Target,
  TrendingUp,
  Zap,
  Star,
  X
} from 'lucide-react'
import { useToast } from '../contexts/ToastContext'

interface WorkflowStep {
  id: string
  title: string
  description: string
  category: string
  estimatedTime: number
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  prerequisites?: string[]
  nextSteps?: string[]
}

interface UserFlow {
  currentStep: string | null
  completedSteps: string[]
  suggestedWorkflow: string[]
  timeSpent: Record<string, number>
  preferences: {
    showHints: boolean
    autoAdvance: boolean
    difficulty: 'beginner' | 'intermediate' | 'advanced'
  }
}

interface FlowOptimizerProps {
  activeCategory: string
  userActions: Array<{action: string, timestamp: number, data: any}>
  sessionDuration: number
  onWorkflowSuggestion: (suggestion: WorkflowStep) => void
  onFlowComplete: (flow: UserFlow) => void
}

const workflowSteps: WorkflowStep[] = [
  // Basic Editing Flow
  {
    id: 'upload_video',
    title: 'Upload Your Video',
    description: 'Start by uploading or selecting a video to edit',
    category: 'setup',
    estimatedTime: 30,
    difficulty: 'beginner',
    nextSteps: ['apply_template', 'basic_cuts']
  },
  {
    id: 'apply_template',
    title: 'Apply a Style Template',
    description: 'Choose from professional templates to instantly style your video',
    category: 'edit',
    estimatedTime: 60,
    difficulty: 'beginner',
    prerequisites: ['upload_video'],
    nextSteps: ['color_grade', 'add_text']
  },
  {
    id: 'color_grade',
    title: 'Color Correction',
    description: 'Adjust brightness, contrast, and color balance',
    category: 'color',
    estimatedTime: 120,
    difficulty: 'intermediate',
    prerequisites: ['apply_template'],
    nextSteps: ['add_text', 'add_effects']
  },
  {
    id: 'add_text',
    title: 'Add Text & Titles',
    description: 'Include captions, titles, and call-to-action text',
    category: 'effects',
    estimatedTime: 90,
    difficulty: 'beginner',
    nextSteps: ['add_effects', 'chroma_key']
  },
  {
    id: 'add_effects',
    title: 'Apply Visual Effects',
    description: 'Add particles, lens flares, and cinematic effects',
    category: 'visual-fx',
    estimatedTime: 180,
    difficulty: 'intermediate',
    prerequisites: ['color_grade'],
    nextSteps: ['ai_analysis', 'timeline_edit']
  },
  {
    id: 'chroma_key',
    title: 'Green Screen Editing',
    description: 'Remove backgrounds and composite elements',
    category: 'chromakey',
    estimatedTime: 150,
    difficulty: 'intermediate',
    nextSteps: ['timeline_edit']
  },
  {
    id: 'ai_analysis',
    title: 'AI Scene Analysis',
    description: 'Let AI analyze and suggest improvements',
    category: 'ai-analysis',
    estimatedTime: 45,
    difficulty: 'beginner',
    nextSteps: ['timeline_edit']
  },
  {
    id: 'timeline_edit',
    title: 'Advanced Timeline Editing',
    description: 'Fine-tune timing, add transitions, and layer effects',
    category: 'timeline',
    estimatedTime: 300,
    difficulty: 'advanced',
    prerequisites: ['add_text', 'add_effects'],
    nextSteps: ['collaborate', 'export']
  },
  {
    id: 'collaborate',
    title: 'Team Collaboration',
    description: 'Share project and collaborate with team members',
    category: 'collaborate',
    estimatedTime: 60,
    difficulty: 'intermediate',
    nextSteps: ['export']
  },
  {
    id: 'export',
    title: 'Export Final Video',
    description: 'Choose format, quality, and export settings',
    category: 'export',
    estimatedTime: 120,
    difficulty: 'beginner',
    prerequisites: ['timeline_edit']
  }
]

const workflowTemplates = {
  'quick_social': ['upload_video', 'apply_template', 'add_text', 'export'],
  'cinematic_production': ['upload_video', 'color_grade', 'add_effects', 'timeline_edit', 'export'],
  'vlog_editing': ['upload_video', 'apply_template', 'color_grade', 'add_text', 'ai_analysis', 'export'],
  'professional_business': ['upload_video', 'apply_template', 'color_grade', 'add_text', 'timeline_edit', 'export'],
  'creative_effects': ['upload_video', 'chroma_key', 'add_effects', 'ai_analysis', 'timeline_edit', 'export']
}

export default function FlowOptimizer({
  activeCategory,
  userActions,
  sessionDuration,
  onWorkflowSuggestion,
  onFlowComplete
}: FlowOptimizerProps) {
  const [userFlow, setUserFlow] = useState<UserFlow>({
    currentStep: null,
    completedSteps: [],
    suggestedWorkflow: [],
    timeSpent: {},
    preferences: {
      showHints: true,
      autoAdvance: false,
      difficulty: 'beginner'
    }
  })

  const [showSuggestion, setShowSuggestion] = useState<WorkflowStep | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const { showToast } = useToast()

  // Analyze user behavior and suggest next steps
  const analyzeFlow = useCallback(() => {
    const recentActions = userActions.slice(-10)
    const completedCategories = Array.from(new Set(recentActions
      .filter(action => action.action === 'category_switched')
      .map(action => action.data.to)
    ))

    // Detect workflow pattern
    let detectedWorkflow = 'quick_social' // default

    if (completedCategories.includes('timeline') && completedCategories.includes('color')) {
      detectedWorkflow = 'cinematic_production'
    } else if (completedCategories.includes('chromakey') && completedCategories.includes('visual-fx')) {
      detectedWorkflow = 'creative_effects'
    } else if (completedCategories.includes('ai-analysis') && completedCategories.includes('edit')) {
      detectedWorkflow = 'vlog_editing'
    } else if (completedCategories.includes('edit') && completedCategories.includes('color') && !completedCategories.includes('visual-fx')) {
      detectedWorkflow = 'professional_business'
    }

    const suggestedSteps = workflowTemplates[detectedWorkflow as keyof typeof workflowTemplates]

    setUserFlow(prev => ({
      ...prev,
      suggestedWorkflow: suggestedSteps,
      completedSteps: completedCategories
    }))

    // Suggest next step
    const currentIndex = suggestedSteps.indexOf(activeCategory)
    if (currentIndex >= 0 && currentIndex < suggestedSteps.length - 1) {
      const nextStepId = suggestedSteps[currentIndex + 1]
      const nextStep = workflowSteps.find(step => step.id === nextStepId)
      if (nextStep && !completedCategories.includes(nextStep.category)) {
        setShowSuggestion(nextStep)
        onWorkflowSuggestion(nextStep)
      }
    }

    // Check if workflow is complete
    const workflowComplete = suggestedSteps.every(stepId => {
      const step = workflowSteps.find(s => s.id === stepId)
      return step && completedCategories.includes(step.category)
    })

    if (workflowComplete) {
      onFlowComplete(userFlow)
      showToast('🎉 Workflow complete! Your video is ready to export.', 'success')
    }

  }, [userActions, activeCategory, userFlow, onWorkflowSuggestion, onFlowComplete, showToast])

  useEffect(() => {
    analyzeFlow()
  }, [analyzeFlow])

  // Show onboarding for new users
  useEffect(() => {
    if (sessionDuration < 30000 && userActions.length < 3) { // Less than 30 seconds, few actions
      setShowOnboarding(true)
    }
  }, [sessionDuration, userActions.length])

  const getStepStatus = (stepId: string) => {
    const step = workflowSteps.find(s => s.id === stepId)
    if (!step) return 'pending'

    if (userFlow.completedSteps.includes(step.category)) return 'completed'
    if (activeCategory === step.category) return 'current'
    if (userFlow.suggestedWorkflow.includes(stepId)) return 'suggested'

    return 'pending'
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      case 'intermediate': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
      case 'advanced': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!userFlow.preferences.showHints) return null

  return (
    <>
      {/* Workflow Progress Indicator */}
      <div className="fixed top-4 right-4 z-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3">
        <div className="flex items-center gap-2 text-sm">
          <Target className="w-4 h-4 text-blue-500" />
          <span className="font-medium">Workflow Progress</span>
          <span className="text-gray-500">
            {userFlow.completedSteps.length}/{userFlow.suggestedWorkflow.length}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="mt-2 w-48 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
            style={{
              width: `${(userFlow.completedSteps.length / userFlow.suggestedWorkflow.length) * 100}%`
            }}
          />
        </div>

        {/* Current Step */}
        {showSuggestion && (
          <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-700">
            <div className="text-xs font-medium text-blue-900 dark:text-blue-100">
              Next: {showSuggestion.title}
            </div>
            <div className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              {showSuggestion.description}
            </div>
            <button
              onClick={() => {
                // Navigate to suggested category
                const event = new CustomEvent('navigateToCategory', {
                  detail: { category: showSuggestion.category }
                })
                window.dispatchEvent(event)
                setShowSuggestion(null)
              }}
              className="mt-2 text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 transition-colors"
            >
              Go There <ArrowRight className="w-3 h-3 inline ml-1" />
            </button>
          </div>
        )}
      </div>

      {/* Onboarding Modal */}
      {showOnboarding && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500 rounded-lg">
                    <Lightbulb className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Welcome to Click Video Editor!
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                      Let's get you started with a quick tour
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowOnboarding(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-96">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {workflowSteps.slice(0, 6).map(step => (
                  <div
                    key={step.id}
                    className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-700"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-1 rounded ${getDifficultyColor(step.difficulty)}`}>
                        {getStepStatus(step.id) === 'completed' ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          <Clock className="w-4 h-4" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 dark:text-white">{step.title}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {step.description}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getDifficultyColor(step.difficulty)}`}>
                            {step.difficulty}
                          </span>
                          <span className="text-xs text-gray-500">
                            ~{formatTime(step.estimatedTime)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200 dark:border-green-700">
                <div className="flex items-center gap-3">
                  <Star className="w-5 h-5 text-green-600" />
                  <div>
                    <h4 className="font-medium text-green-900 dark:text-green-100">Pro Tip</h4>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Start with a template from the Edit section, then refine with colors and effects. Use AI Analysis for smart suggestions!
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Press <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-xs">?</kbd> anytime for keyboard shortcuts
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setUserFlow(prev => ({
                      ...prev,
                      preferences: { ...prev.preferences, showHints: false }
                    }))}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
                  >
                    Skip Tour
                  </button>
                  <button
                    onClick={() => setShowOnboarding(false)}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    Get Started
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions Floating Panel */}
      {userFlow.suggestedWorkflow.length > 0 && (
        <div className="fixed bottom-4 left-4 z-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-2 text-sm">
            <Zap className="w-4 h-4 text-yellow-500" />
            <span className="font-medium">Quick Actions</span>
          </div>

          <div className="mt-2 space-y-1">
            {userFlow.suggestedWorkflow.slice(0, 3).map(stepId => {
              const step = workflowSteps.find(s => s.id === stepId)
              if (!step) return null

              const status = getStepStatus(stepId)
              return (
                <button
                  key={stepId}
                  onClick={() => {
                    const event = new CustomEvent('navigateToCategory', {
                      detail: { category: step.category }
                    })
                    window.dispatchEvent(event)
                  }}
                  className={`w-full text-left p-2 rounded text-sm transition-colors ${
                    status === 'completed'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                      : status === 'current'
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                  disabled={status === 'completed'}
                >
                  <div className="flex items-center gap-2">
                    {status === 'completed' ? (
                      <CheckCircle className="w-3 h-3" />
                    ) : status === 'current' ? (
                      <Target className="w-3 h-3" />
                    ) : (
                      <ArrowRight className="w-3 h-3" />
                    )}
                    <span className="truncate">{step.title}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Workflow Completion Celebration */}
      {userFlow.completedSteps.length === userFlow.suggestedWorkflow.length && userFlow.completedSteps.length > 0 && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full text-center p-8">
            <div className="mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Workflow Complete! 🎉
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                You've successfully completed your video editing workflow in {formatTime(Math.floor(sessionDuration / 1000))}
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  const event = new CustomEvent('navigateToCategory', {
                    detail: { category: 'export' }
                  })
                  window.dispatchEvent(event)
                }}
                className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-200 transform hover:scale-105 font-medium"
              >
                Export Your Video
              </button>
              <button
                onClick={() => window.location.reload()}
                className="w-full px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Start New Project
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}



