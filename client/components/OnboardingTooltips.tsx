'use client'

import { useEffect, useState } from 'react'
import { HelpCircle, X } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'

interface Tooltip {
  id: string
  target: string
  titleKey: string
  contentKey: string
  position: 'top' | 'bottom' | 'left' | 'right'
}

const tooltips: Tooltip[] = [
  {
    id: 'create-content',
    target: '[data-tooltip="create-content"]',
    titleKey: 'createContentTitle',
    contentKey: 'createContentContent',
    position: 'bottom',
  },
  {
    id: 'templates',
    target: '[data-tooltip="templates"]',
    titleKey: 'templatesTitle',
    contentKey: 'templatesContent',
    position: 'bottom',
  },
  {
    id: 'analytics',
    target: '[data-tooltip="analytics"]',
    titleKey: 'analyticsTitle',
    contentKey: 'analyticsContent',
    position: 'bottom',
  },
]

export default function OnboardingTooltips() {
  const { t } = useTranslation()
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null)
  const [completedTooltips, setCompletedTooltips] = useState<Set<string>>(
    new Set(JSON.parse(localStorage.getItem('completedTooltips') || '[]'))
  )

  useEffect(() => {
    // Show first uncompleted tooltip
    const uncompleted = tooltips.find(tip => !completedTooltips.has(tip.id))
    if (uncompleted) {
      setTimeout(() => {
        setActiveTooltip(uncompleted.id)
      }, 1000)
    }
    // Run-once on mount: completedTooltips is initialized from localStorage
    // and only updated by user interaction; we don't want to reshow tooltips
    // every time it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const completeTooltip = (tooltipId: string) => {
    const newCompleted = new Set(completedTooltips)
    newCompleted.add(tooltipId)
    setCompletedTooltips(newCompleted)
    localStorage.setItem('completedTooltips', JSON.stringify(Array.from(newCompleted)))

    // Show next tooltip
    const currentIndex = tooltips.findIndex(tip => tip.id === tooltipId)
    const nextTooltip = tooltips[currentIndex + 1]
    if (nextTooltip && !newCompleted.has(nextTooltip.id)) {
      setTimeout(() => {
        setActiveTooltip(nextTooltip.id)
      }, 500)
    } else {
      setActiveTooltip(null)
    }
  }

  const tooltip = tooltips.find(tip => tip.id === activeTooltip)
  if (!tooltip) return null

  const targetElement = document.querySelector(tooltip.target)
  if (!targetElement) return null

  const rect = targetElement.getBoundingClientRect()
  const position = {
    top: tooltip.position === 'bottom' ? rect.bottom + 10 : rect.top - 10,
    left: rect.left + rect.width / 2,
  }

  return (
    <div
      className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 max-w-xs border-2 border-purple-500"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translateX(-50%)',
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="font-semibold text-gray-900 dark:text-[var(--text-main)]">
            {t(`onboardingTooltips.${tooltip.titleKey}`)}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => completeTooltip(tooltip.id)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        {t(`onboardingTooltips.${tooltip.contentKey}`)}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {t('onboardingTooltips.stepCounter', { current: tooltips.findIndex(tip => tip.id === tooltip.id) + 1, total: tooltips.length })}
        </span>
        <button
          type="button"
          onClick={() => completeTooltip(tooltip.id)}
          className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
        >
          {t('onboardingTooltips.gotIt')}
        </button>
      </div>
    </div>
  )
}






