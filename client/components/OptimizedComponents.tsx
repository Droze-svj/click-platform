'use client'

import React from 'react'
import { createLazyComponent, preloadComponents } from './LazyWrapper'

// Lazy load heavy components with optimized loading
export const LazyModernVideoEditor = createLazyComponent(
  () => import('./ModernVideoEditor'),
  {
    fallback: (
      <div className="flex items-center justify-center h-64 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading Video Editor...</p>
        </div>
      </div>
    )
  }
)

export const LazyAnalytics = createLazyComponent(
  () => import('./Analytics'),
  {
    fallback: (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    )
  }
)

export const LazyContentSuggestions = createLazyComponent(
  () => import('./EnhancedContentSuggestions'),
  {
    fallback: (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2"></div>
            <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        ))}
      </div>
    )
  }
)

// Temporarily disabled lazy loading for WorkflowTemplates due to TypeScript issues
export { default as LazyWorkflowTemplates } from './WorkflowTemplates'

export const LazySocialMediaExporter = createLazyComponent(
  () => import('./SocialMediaExporter'),
  {
    fallback: (
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    )
  }
)

// Preload critical components on user interaction
export const preloadOnInteraction = () => {
  let preloaded = false

  const preloadCritical = () => {
    if (!preloaded) {
      preloadComponents(
        () => import('./ModernVideoEditor'),
        () => import('./Analytics'),
        () => import('./EnhancedContentSuggestions')
      )
      preloaded = true
    }
  }

  // Preload on first user interaction
  const handleInteraction = () => {
    setTimeout(preloadCritical, 100)
    document.removeEventListener('click', handleInteraction)
    document.removeEventListener('keydown', handleInteraction)
    document.removeEventListener('touchstart', handleInteraction)
  }

  document.addEventListener('click', handleInteraction)
  document.addEventListener('keydown', handleInteraction)
  document.addEventListener('touchstart', handleInteraction)
}

// Preload components based on route - temporarily disabled due to TypeScript issues
export const preloadForRoute = (pathname: string) => {
  // Preload functionality temporarily disabled
  switch (pathname) {
    case '/dashboard/video':
    case '/dashboard/analytics':
    case '/dashboard':
    case '/dashboard/workflows':
      // Preload disabled to fix build
      break
  }
}

// Performance monitoring for lazy loading
export const trackLazyLoadPerformance = (componentName: string, loadTime: number) => {
  if (typeof window !== 'undefined' && (window as any).analytics) {
    ;(window as any).analytics.trackEvent('lazy_load_performance', {
      component: componentName,
      loadTime,
      timestamp: Date.now()
    })
  }

  // Log to performance monitor
  if (typeof window !== 'undefined' && (window as any).performanceMonitor) {
    ;(window as any).performanceMonitor.recordMetric('lazy_load', loadTime, {
      component: componentName
    })
  }
}

// Initialize lazy loading optimizations
if (typeof window !== 'undefined') {
  preloadOnInteraction()
}


