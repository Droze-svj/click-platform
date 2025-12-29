'use client'

import { useState, useEffect } from 'react'

interface TourStep {
  target: string
  title: string
  content: string
  position?: 'top' | 'bottom' | 'left' | 'right'
}

const tourSteps: TourStep[] = [
  {
    target: 'dashboard',
    title: 'Welcome to Click!',
    content: 'This is your dashboard. Here you can see all your content and quick stats.',
    position: 'bottom'
  },
  {
    target: 'video-upload',
    title: 'Video Processing',
    content: 'Upload videos here to automatically generate short-form clips with captions.',
    position: 'bottom'
  },
  {
    target: 'content-generator',
    title: 'Content Generator',
    content: 'Transform your text into social media posts for multiple platforms.',
    position: 'bottom'
  },
  {
    target: 'scripts',
    title: 'Script Generator',
    content: 'Create professional scripts for YouTube, podcasts, and more.',
    position: 'bottom'
  }
]

export default function OnboardingTour() {
  const [currentStep, setCurrentStep] = useState(0)
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    // Check if user has completed onboarding
    const hasCompleted = localStorage.getItem('onboarding_completed')
    if (!hasCompleted) {
      setIsActive(true)
    }
  }, [])

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handleSkip = () => {
    handleComplete()
  }

  const handleComplete = () => {
    setIsActive(false)
    localStorage.setItem('onboarding_completed', 'true')
  }

  if (!isActive || currentStep >= tourSteps.length) {
    return null
  }

  const step = tourSteps[currentStep]
  const targetElement = document.querySelector(`[data-tour="${step.target}"]`)

  if (!targetElement) {
    return null
  }

  const rect = targetElement.getBoundingClientRect()
  const position = step.position || 'bottom'

  const getPositionStyles = () => {
    switch (position) {
      case 'top':
        return {
          top: `${rect.top - 200}px`,
          left: `${rect.left + rect.width / 2}px`,
          transform: 'translateX(-50%)'
        }
      case 'bottom':
        return {
          top: `${rect.bottom + 20}px`,
          left: `${rect.left + rect.width / 2}px`,
          transform: 'translateX(-50%)'
        }
      case 'left':
        return {
          top: `${rect.top + rect.height / 2}px`,
          left: `${rect.left - 300}px`,
          transform: 'translateY(-50%)'
        }
      case 'right':
        return {
          top: `${rect.top + rect.height / 2}px`,
          left: `${rect.right + 20}px`,
          transform: 'translateY(-50%)'
        }
      default:
        return {}
    }
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" />

      {/* Highlight */}
      <div
        className="fixed z-40 border-4 border-purple-500 rounded-lg pointer-events-none"
        style={{
          top: `${rect.top - 4}px`,
          left: `${rect.left - 4}px`,
          width: `${rect.width + 8}px`,
          height: `${rect.height + 8}px`
        }}
      />

      {/* Tooltip */}
      <div
        className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-80"
        style={getPositionStyles()}
      >
        <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{step.content}</p>
        <div className="flex justify-between items-center">
          <button
            onClick={handleSkip}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            Skip Tour
          </button>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <button
                onClick={() => setCurrentStep(currentStep - 1)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm"
              >
                Previous
              </button>
            )}
            <button
              onClick={handleNext}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
            >
              {currentStep === tourSteps.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
        <div className="mt-4 flex gap-1 justify-center">
          {tourSteps.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full ${
                index === currentStep ? 'bg-purple-600' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </div>
    </>
  )
}







