'use client'

import { Inbox, Plus, Sparkles, BookOpen, Video, FileText, TrendingUp } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface EnhancedEmptyStateProps {
  title: string
  description: string
  type?: 'content' | 'video' | 'scripts' | 'templates' | 'collections' | 'analytics'
  primaryAction?: {
    label: string
    onClick: () => void
  }
  secondaryActions?: Array<{
    label: string
    onClick: () => void
    icon?: React.ReactNode
  }>
  suggestions?: string[]
}

export default function EnhancedEmptyState({
  title,
  description,
  type = 'content',
  primaryAction,
  secondaryActions,
  suggestions
}: EnhancedEmptyStateProps) {
  const router = useRouter()

  const getIcon = () => {
    switch (type) {
      case 'content':
        return <FileText className="w-12 h-12 text-purple-500" />
      case 'video':
        return <Video className="w-12 h-12 text-purple-500" />
      case 'scripts':
        return <BookOpen className="w-12 h-12 text-purple-500" />
      case 'templates':
        return <Sparkles className="w-12 h-12 text-purple-500" />
      case 'collections':
        return <Inbox className="w-12 h-12 text-purple-500" />
      case 'analytics':
        return <TrendingUp className="w-12 h-12 text-purple-500" />
      default:
        return <Inbox className="w-12 h-12 text-purple-500" />
    }
  }

  const defaultSecondaryActions = [
    {
      label: 'Browse Templates',
      onClick: () => router.push('/dashboard/templates'),
      icon: <Sparkles className="w-4 h-4" />
    },
    {
      label: 'View Examples',
      onClick: () => router.push('/dashboard/library'),
      icon: <BookOpen className="w-4 h-4" />
    },
    {
      label: 'Get Help',
      onClick: () => router.push('/dashboard'),
      icon: <TrendingUp className="w-4 h-4" />
    }
  ]

  const actions = secondaryActions || defaultSecondaryActions

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {/* Icon */}
      <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 rounded-full flex items-center justify-center mb-6">
        {getIcon()}
      </div>

      {/* Title & Description */}
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">
        {title}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-md mb-8">
        {description}
      </p>

      {/* Primary Action */}
      {primaryAction && (
        <button
          onClick={primaryAction.onClick}
          className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl mb-6"
        >
          <Plus className="w-5 h-5" />
          {primaryAction.label}
        </button>
      )}

      {/* Secondary Actions */}
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-3 justify-center mb-8">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={action.onClick}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {action.icon}
              <span className="text-sm">{action.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Suggestions */}
      {suggestions && suggestions.length > 0 && (
        <div className="w-full max-w-md">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 text-center">
            Quick Tips
          </h4>
          <div className="space-y-2">
            {suggestions.map((suggestion, index) => (
              <div
                key={index}
                className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <Sparkles className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-600 dark:text-gray-400">{suggestion}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}






