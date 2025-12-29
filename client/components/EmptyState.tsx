'use client'

import { Inbox, Plus, Sparkles, ArrowRight } from 'lucide-react'

interface EmptyStateProps {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  icon?: React.ReactNode
  suggestions?: string[]
  illustration?: React.ReactNode
}

export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  suggestions = [],
  illustration
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {/* Illustration or Icon */}
      <div className="mb-6 relative">
        {illustration ? (
          <div className="w-32 h-32 flex items-center justify-center">
            {illustration}
          </div>
        ) : (
          <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/30 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            {typeof icon === 'string' ? (
              <span className="text-4xl">{icon}</span>
            ) : icon || <Inbox size={40} className="text-purple-600 dark:text-purple-400" />}
          </div>
        )}
        {suggestions.length === 0 && (
          <div className="absolute -top-2 -right-2">
            <Sparkles size={24} className="text-purple-400 animate-pulse" />
          </div>
        )}
      </div>

      {/* Title and Description */}
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 text-center">
        {title}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-md mb-8 leading-relaxed">
        {description}
      </p>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="w-full max-w-md mb-6">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 text-center">
            Quick suggestions:
          </p>
          <div className="space-y-2">
            {suggestions.map((suggestion, index) => (
              <div
                key={index}
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2"
              >
                <ArrowRight size={14} className="text-purple-500 flex-shrink-0" />
                <span>{suggestion}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Button */}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="group flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
        >
          <Plus size={18} className="group-hover:rotate-90 transition-transform duration-200" />
          {actionLabel}
        </button>
      )}
    </div>
  )
}
