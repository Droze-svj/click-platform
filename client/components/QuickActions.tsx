'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface QuickAction {
  label: string
  icon: string
  action: string
  description: string
}

const quickActions: QuickAction[] = [
  {
    label: 'Upload Video',
    icon: '🎥',
    action: '/dashboard/video',
    description: 'Upload and process video'
  },
  {
    label: 'Generate Content',
    icon: '✨',
    action: '/dashboard/content',
    description: 'Create social media posts'
  },
  {
    label: 'Create Script',
    icon: '📝',
    action: '/dashboard/scripts',
    description: 'Generate writing scripts'
  },
  {
    label: 'Schedule Post',
    icon: '📅',
    action: '/dashboard/scheduler',
    description: 'Schedule content'
  },
  {
    label: 'View Analytics',
    icon: '📊',
    action: '/dashboard/analytics',
    description: 'Check performance'
  }
]

export default function QuickActions() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="fixed bottom-6 left-6 z-40">
      {isOpen ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 w-64">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-sm">Quick Actions</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          <div className="space-y-2">
            {quickActions.map((action) => (
              <button
                key={action.action}
                onClick={() => {
                  router.push(action.action)
                  setIsOpen(false)
                }}
                className="w-full text-left p-3 rounded-lg hover:bg-purple-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{action.icon}</span>
                  <div>
                    <p className="font-medium text-sm">{action.label}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {action.description}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 bg-purple-600 text-white rounded-full shadow-lg hover:bg-purple-700 flex items-center justify-center text-2xl transition-transform hover:scale-110"
          aria-label="Quick Actions"
        >
          ⚡
        </button>
      )}
    </div>
  )
}







