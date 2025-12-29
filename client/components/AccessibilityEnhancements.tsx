'use client'

import { useEffect } from 'react'

/**
 * Component that adds accessibility enhancements globally
 */
export default function AccessibilityEnhancements() {
  useEffect(() => {
    // Skip to main content link
    const skipLink = document.createElement('a')
    skipLink.href = '#main-content'
    skipLink.textContent = 'Skip to main content'
    skipLink.className = 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-purple-600 focus:text-white focus:rounded-lg'
    document.body.insertBefore(skipLink, document.body.firstChild)

    // Add main content landmark if it doesn't exist
    const mainContent = document.getElementById('main-content')
    if (!mainContent) {
      const main = document.createElement('main')
      main.id = 'main-content'
      main.setAttribute('role', 'main')
      document.body.appendChild(main)
    }

    // Keyboard navigation improvements
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape key closes modals/dropdowns
      if (e.key === 'Escape') {
        const modals = document.querySelectorAll('[role="dialog"]')
        modals.forEach(modal => {
          if (modal instanceof HTMLElement && modal.style.display !== 'none') {
            const closeButton = modal.querySelector('[aria-label*="close" i], [aria-label*="Close" i]')
            if (closeButton instanceof HTMLElement) {
              closeButton.click()
            }
          }
        })
      }

      // Tab navigation improvements
      if (e.key === 'Tab') {
        document.body.classList.add('keyboard-navigation')
      }
    }

    // Mouse navigation removes keyboard focus styles
    const handleMouseDown = () => {
      document.body.classList.remove('keyboard-navigation')
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleMouseDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleMouseDown)
      skipLink.remove()
    }
  }, [])

  return null
}

// Utility function to announce to screen readers
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const announcement = document.createElement('div')
  announcement.setAttribute('role', 'status')
  announcement.setAttribute('aria-live', priority)
  announcement.setAttribute('aria-atomic', 'true')
  announcement.className = 'sr-only'
  announcement.textContent = message
  document.body.appendChild(announcement)

  setTimeout(() => {
    announcement.remove()
  }, 1000)
}

// Focus trap utility
export function trapFocus(element: HTMLElement) {
  const focusableElements = element.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )
  const firstElement = focusableElements[0] as HTMLElement
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

  const handleTabKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        lastElement.focus()
        e.preventDefault()
      }
    } else {
      if (document.activeElement === lastElement) {
        firstElement.focus()
        e.preventDefault()
      }
    }
  }

  element.addEventListener('keydown', handleTabKey)
  firstElement?.focus()

  return () => {
    element.removeEventListener('keydown', handleTabKey)
  }
}




