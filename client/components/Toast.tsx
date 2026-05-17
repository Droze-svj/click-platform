'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'

interface ToastProps {
  id: string
  message?: string
  type: 'success' | 'error' | 'warning' | 'info'
  title?: string
  duration?: number
  onClose: () => void
  action?: {
    label: string
    onClick: () => void
  }
}

export default function Toast({ id, message, type, title, duration = 5000, onClose, action }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    // Trigger entrance animation
    requestAnimationFrame(() => {
      setIsVisible(true)
    })
  }, [])

  const handleClose = useCallback(() => {
    setIsExiting(true)
    setTimeout(() => {
      onClose()
    }, 300) // Match animation duration
  }, [onClose])

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose()
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [duration, handleClose])

  const icons = {
    success: <CheckCircle size={20} className="text-green-500" />,
    error: <AlertCircle size={20} className="text-red-500" />,
    warning: <AlertTriangle size={20} className="text-yellow-500" />,
    info: <Info size={20} className="text-blue-500" />
  }

  const bgColors = {
    success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
  }

  const textColors = {
    success: 'text-green-800 dark:text-green-200',
    error: 'text-red-800 dark:text-red-200',
    warning: 'text-yellow-800 dark:text-yellow-200',
    info: 'text-blue-800 dark:text-blue-200'
  }

  return (
    <div
      className={`
        ${bgColors[type]} border rounded-lg shadow-xl p-4 min-w-[300px] max-w-md 
        flex items-start gap-3 transition-all duration-300 ease-out
        ${isVisible && !isExiting 
          ? 'translate-x-0 opacity-100' 
          : isExiting
          ? 'translate-x-full opacity-0'
          : 'translate-x-full opacity-0'
        }
      `}
      role="alert"
      aria-live="polite"
    >
      <div className="flex-shrink-0 mt-0.5">
        {icons[type]}
      </div>
      <div className="flex-1 min-w-0">
        {title && (
          <p className={`font-semibold text-sm ${textColors[type]} mb-1`}>
            {title}
          </p>
        )}
        <p className={`text-sm ${textColors[type]}`}>
          {message}
        </p>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className={`mt-2 text-sm font-medium ${textColors[type]} hover:underline`}
          >
            {action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={handleClose}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex-shrink-0 transition-colors"
        aria-label="Close notification"
      >
        <X size={18} />
      </button>
    </div>
  )
}
