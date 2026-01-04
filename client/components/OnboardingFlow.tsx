'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { X, ChevronRight, ChevronLeft, CheckCircle2, Circle } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { apiGet, apiPost } from '../lib/api'

interface OnboardingStep {
  id: string
  title: string
  description: string
  component: string
  required: boolean
}

interface OnboardingProgress {
  progress: {
    currentStep: number
    completed: boolean
    skipped: boolean
  }
  steps: OnboardingStep[]
  currentStepData: OnboardingStep | null
  totalSteps: number
  completedSteps: number
  isComplete: boolean
}

export default function OnboardingFlow() {
  const pathname = usePathname()
  const [progress, setProgress] = useState<OnboardingProgress | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isVisible, setIsVisible] = useState(false)
  const { showToast } = useToast()

  // Don't show onboarding on public pages
  const isPublicPage = pathname === '/login' || pathname === '/register' || pathname === '/' || !pathname

  useEffect(() => {
    // Skip loading if on public page
    if (isPublicPage) {
      setIsLoading(false)
      setIsVisible(false)
      return
    }
    loadProgress()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPublicPage])

  const loadProgress = async () => {
    try {
      const response = await apiGet<any>('/onboarding', { withCredentials: true })
      if (response?.success) {
        setProgress(response.data)
        setIsVisible(!response.data?.isComplete && !response.data?.progress?.skipped)
      }
    } catch (error) {
      console.error('Failed to load onboarding:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const completeStep = async (stepId: string, data?: any) => {
    try {
      const response = await apiPost<any>('/onboarding/complete-step', { stepId, data }, { withCredentials: true })
      if (response?.success) {
        await loadProgress()
        showToast('Step completed!', 'success')
      }
    } catch (error) {
      console.error('Failed to complete step:', error)
      showToast('Failed to complete step', 'error')
    }
  }

  const skipOnboarding = async () => {
    try {
      const response = await apiPost<any>('/onboarding/skip', undefined, { withCredentials: true })
      if (response?.success) {
        setIsVisible(false)
        showToast('Onboarding skipped', 'info')
      }
    } catch (error) {
      console.error('Failed to skip onboarding:', error)
    }
  }

  const goToStep = async (stepIndex: number) => {
    try {
      const response = await apiPost<any>('/onboarding/goto-step', { stepIndex }, { withCredentials: true })
      if (response?.success) {
        await loadProgress()
      }
    } catch (error) {
      console.error('Failed to go to step:', error)
    }
  }

  // Don't render on public pages - return early to prevent any rendering
  if (isPublicPage) {
    return null
  }

  if (isLoading || !isVisible || !progress) {
    return null
  }

  const currentStep = progress.currentStepData
  const currentIndex = progress.progress.currentStep

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" style={{ pointerEvents: 'auto' }}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {currentStep?.title}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {currentStep?.description}
            </p>
          </div>
          <button
            onClick={skipOnboarding}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Step {currentIndex + 1} of {progress.totalSteps}
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {Math.round((progress.completedSteps / progress.totalSteps) * 100)}% Complete
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-purple-600 h-2 rounded-full transition-all"
              style={{ width: `${(progress.completedSteps / progress.totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Step Indicators */}
        <div className="px-6 py-4 flex items-center justify-between">
          {progress.steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <button
                onClick={() => goToStep(index)}
                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors ${
                  index < currentIndex
                    ? 'bg-green-500 border-green-500 text-white'
                    : index === currentIndex
                    ? 'bg-purple-600 border-purple-600 text-white'
                    : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-400'
                }`}
              >
                {index < currentIndex ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </button>
              {index < progress.steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${
                    index < currentIndex ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="p-6">
          {currentStep && (
            <div className="space-y-4">
              {/* Render step-specific content based on stepId */}
              {currentStep.id === 'welcome' && <WelcomeStep onComplete={() => completeStep('welcome')} />}
              {currentStep.id === 'profile' && <ProfileStep onComplete={(data) => completeStep('profile', data)} />}
              {currentStep.id === 'first-content' && <FirstContentStep onComplete={() => completeStep('first-content')} />}
              {currentStep.id === 'connect-social' && <ConnectSocialStep onComplete={() => completeStep('connect-social')} />}
              {currentStep.id === 'explore-features' && <ExploreFeaturesStep onComplete={() => completeStep('explore-features')} />}
              {currentStep.id === 'complete' && <CompleteStep onComplete={() => completeStep('complete')} />}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => goToStep(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <button
            onClick={skipOnboarding}
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            Skip onboarding
          </button>
          <button
            onClick={() => {
              if (currentStep) {
                completeStep(currentStep.id)
                if (currentIndex < progress.totalSteps - 1) {
                  goToStep(currentIndex + 1)
                }
              }
            }}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
          >
            {currentIndex === progress.totalSteps - 1 ? 'Complete' : 'Next'}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// Step Components
function WelcomeStep({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="text-center space-y-4">
      <div className="text-6xl mb-4">👋</div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
        Welcome to Click!
      </h3>
      <p className="text-gray-600 dark:text-gray-400">
        We're excited to help you create amazing content. Let's get started with a quick tour.
      </p>
    </div>
  )
}

function ProfileStep({ onComplete }: { onComplete: (data: any) => void }) {
  const [niche, setNiche] = useState('')

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        Tell us about yourself
      </h3>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          What's your niche?
        </label>
        <select
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="">Select niche</option>
          <option value="health">Health</option>
          <option value="finance">Finance</option>
          <option value="education">Education</option>
          <option value="technology">Technology</option>
          <option value="lifestyle">Lifestyle</option>
          <option value="business">Business</option>
          <option value="entertainment">Entertainment</option>
          <option value="other">Other</option>
        </select>
      </div>
      <button
        onClick={() => onComplete({ preferences: { niche } })}
        disabled={!niche}
        className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
      >
        Continue
      </button>
    </div>
  )
}

function FirstContentStep({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        Create Your First Content
      </h3>
      <p className="text-gray-600 dark:text-gray-400">
        You can create content by:
      </p>
      <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400">
        <li>Uploading a video</li>
        <li>Generating content from text</li>
        <li>Using a template</li>
      </ul>
      <button
        onClick={onComplete}
        className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
      >
        I'll create content later
      </button>
    </div>
  )
}

function ConnectSocialStep({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        Connect Your Social Media
      </h3>
      <p className="text-gray-600 dark:text-gray-400">
        Link your accounts to start posting directly from Click.
      </p>
      <button
        onClick={onComplete}
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        Skip for now
      </button>
    </div>
  )
}

function ExploreFeaturesStep({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        Explore Features
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="text-2xl mb-2">🎬</div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">Video Processing</p>
        </div>
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="text-2xl mb-2">📊</div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">Analytics</p>
        </div>
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="text-2xl mb-2">📅</div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">Scheduling</p>
        </div>
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="text-2xl mb-2">🤖</div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">AI Features</p>
        </div>
      </div>
    </div>
  )
}

function CompleteStep({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="text-center space-y-4">
      <div className="text-6xl mb-4">🎉</div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
        You're All Set!
      </h3>
      <p className="text-gray-600 dark:text-gray-400">
        Start creating amazing content and grow your audience.
      </p>
      <button
        onClick={onComplete}
        className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
      >
        Get Started
      </button>
    </div>
  )
}






