'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/hooks/useTranslation'

interface QuickAction {
  labelKey: string
  icon: string
  action: string
  descriptionKey: string
}

const quickActions: QuickAction[] = [
  {
    labelKey: 'uploadVideo',
    icon: '🎥',
    action: '/dashboard/video',
    descriptionKey: 'uploadAndProcessVideo'
  },
  {
    labelKey: 'generateContent',
    icon: '✨',
    action: '/dashboard/content',
    descriptionKey: 'createSocialMediaPosts'
  },
  {
    labelKey: 'createScript',
    icon: '📝',
    action: '/dashboard/scripts',
    descriptionKey: 'generateWritingScripts'
  },
  {
    labelKey: 'schedulePost',
    icon: '📅',
    action: '/dashboard/scheduler',
    descriptionKey: 'scheduleContent'
  },
  {
    labelKey: 'viewAnalytics',
    icon: '📊',
    action: '/dashboard/analytics',
    descriptionKey: 'checkPerformance'
  }
]

export default function QuickActions() {
  const { t } = useTranslation()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="fixed bottom-6 left-6 z-40">
      {isOpen ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 w-64">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-sm">{t('quickActions.quickActions')}</h3>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          <div className="space-y-2">
            {quickActions.map((action) => (
              <button
                type="button"
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
                    <p className="font-medium text-sm">{t(`quickActions.${action.labelKey}`)}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {t(`quickActions.${action.descriptionKey}`)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 bg-purple-600 text-white rounded-full shadow-lg hover:bg-purple-700 flex items-center justify-center text-2xl transition-transform hover:scale-110"
          aria-label={t('quickActions.quickActions')}
        >
          ⚡
        </button>
      )}
    </div>
  )
}







