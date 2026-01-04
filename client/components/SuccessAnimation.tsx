'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, Sparkles } from 'lucide-react'

interface SuccessAnimationProps {
  onComplete?: () => void
  duration?: number
  showIcon?: boolean
}

export default function SuccessAnimation({
  message,
  onComplete,
  duration = 2000,
  showIcon = true
}: SuccessAnimationProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [isAnimating, setIsAnimating] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAnimating(false)
      setTimeout(() => {
        setIsVisible(false)
        if (onComplete) onComplete()
      }, 300)
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onComplete])

  if (!isVisible) return null

  return (
    <div
      className={`
        fixed top-4 left-1/2 -translate-x-1/2 z-50
        bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-green-200 dark:border-green-800
        px-6 py-4 flex items-center gap-3
        transform transition-all duration-300
        ${isAnimating 
          ? 'translate-y-0 opacity-100 scale-100' 
          : 'translate-y-[-100%] opacity-0 scale-95'
        }
      `}
      role="alert"
      aria-live="polite"
    >
      {showIcon && (
        <div className="relative flex-shrink-0">
          <CheckCircle 
            size={24} 
            className="text-green-600 animate-scale-in"
          />
          <Sparkles
            size={16}
            className="absolute -top-1 -right-1 text-yellow-400 animate-pulse"
          />
        </div>
      )}
      <p className="text-sm font-medium text-gray-900 dark:text-white">
        {message}
      </p>
    </div>
  )
}




