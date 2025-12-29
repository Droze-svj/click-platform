'use client'

import { useEffect } from 'react'

/**
 * Accessibility features component
 * Adds ARIA labels, keyboard navigation, and screen reader support
 */
export default function AccessibilityFeatures() {
  useEffect(() => {
    // Add skip to main content link
    const skipLink = document.createElement('a')
    skipLink.href = '#main-content'
    skipLink.textContent = 'Skip to main content'
    skipLink.className = 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-purple-600 focus:text-white focus:rounded-lg'
    skipLink.setAttribute('aria-label', 'Skip to main content')
    document.body.insertBefore(skipLink, document.body.firstChild)

    // Add main content landmark
    const main = document.querySelector('main') || document.querySelector('[role="main"]')
    if (main && !main.id) {
      main.id = 'main-content'
      main.setAttribute('role', 'main')
      main.setAttribute('aria-label', 'Main content')
    }

    // Add ARIA live region for announcements
    const liveRegion = document.createElement('div')
    liveRegion.id = 'aria-live-region'
    liveRegion.setAttribute('aria-live', 'polite')
    liveRegion.setAttribute('aria-atomic', 'true')
    liveRegion.className = 'sr-only'
    document.body.appendChild(liveRegion)

    return () => {
      skipLink.remove()
      liveRegion.remove()
    }
  }, [])

  return null
}

/**
 * Announce to screen readers
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const liveRegion = document.getElementById('aria-live-region')
  if (liveRegion) {
    liveRegion.setAttribute('aria-live', priority)
    liveRegion.textContent = message
    // Clear after announcement
    setTimeout(() => {
      liveRegion.textContent = ''
    }, 1000)
  }
}







