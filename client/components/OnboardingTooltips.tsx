'use client'

import { useEffect, useState } from 'react'
import { HelpCircle, X } from 'lucide-react'

interface Tooltip {
  id: string
  target: string
  title: string
  content: string
  position: 'top' | 'bottom' | 'left' | 'right'
}

const tooltips: Tooltip[] = [
  {
    id: 'create-content',
    target: '[data-tooltip="create-content"]',
    title: 'Create Content',
    content: 'Click here to generate new content from text or upload videos',
    position: 'bottom',
  },
  {
    id: 'templates',
    target: '[data-tooltip="templates"]',
    title: 'Templates',
    content: 'Browse and use templates to speed up your content creation',
    position: 'bottom',
  },
  {
    id: 'analytics',
    target: '[data-tooltip="analytics"]',
    title: 'Analytics',
    content: 'Track your content performance and engagement metrics',
    position: 'bottom',
  },
]

export default function OnboardingTooltips() {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null)
  const [completedTooltips, setCompletedTooltips] = useState<Set<string>>(
    new Set(JSON.parse(localStorage.getItem('completedTooltips') || '[]'))
  )

  useEffect(() => {
    // Show first uncompleted tooltip
    const uncompleted = tooltips.find(t => !completedTooltips.has(t.id))
    if (uncompleted) {
      setTimeout(() => {
        setActiveTooltip(uncompleted.id)
      }, 1000)
    }
  }, [])

  const completeTooltip = (tooltipId: string) => {
    const newCompleted = new Set(completedTooltips)
    newCompleted.add(tooltipId)
    setCompletedTooltips(newCompleted)
    localStorage.setItem('completedTooltips', JSON.stringify(Array.from(newCompleted)))

    // Show next tooltip
    const currentIndex = tooltips.findIndex(t => t.id === tooltipId)
    const nextTooltip = tooltips[currentIndex + 1]
    if (nextTooltip && !newCompleted.has(nextTooltip.id)) {
      setTimeout(() => {
        setActiveTooltip(nextTooltip.id)
      }, 500)
    } else {
      setActiveTooltip(null)
    }
  }

  const tooltip = tooltips.find(t => t.id === activeTooltip)
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
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {tooltip.title}
          </h3>
        </div>
        <button
          onClick={() => completeTooltip(tooltip.id)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        {tooltip.content}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {tooltips.findIndex(t => t.id === tooltip.id) + 1} of {tooltips.length}
        </span>
        <button
          onClick={() => completeTooltip(tooltip.id)}
          className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  )
}






