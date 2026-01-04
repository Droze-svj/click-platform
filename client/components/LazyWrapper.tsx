'use client'

import React, { Suspense, ComponentType } from 'react'
import { ErrorBoundary } from './ErrorBoundary'
import LoadingSpinner from './LoadingSpinner'

interface LazyWrapperProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  errorFallback?: React.ReactNode
  suspenseKey?: string
}

/**
 * Enhanced Lazy Wrapper with Error Boundaries
 * Provides consistent loading states and error handling for lazy-loaded components
 */
export const LazyWrapper: React.FC<LazyWrapperProps> = ({
  children,
  fallback,
  errorFallback,
  suspenseKey
}) => {
  const defaultFallback = (
    <div className="flex items-center justify-center p-4">
      <LoadingSpinner size="sm" />
    </div>
  )

  const defaultErrorFallback = (
    <div className="flex items-center justify-center p-4 text-red-500">
      <div className="text-center">
        <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm">Failed to load component</p>
      </div>
    </div>
  )

  return (
    <ErrorBoundary fallback={errorFallback || defaultErrorFallback}>
      <Suspense fallback={fallback || defaultFallback} key={suspenseKey}>
        {children}
      </Suspense>
    </ErrorBoundary>
  )
}

/**
 * Create a lazy-loaded component with enhanced error handling
 */
export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options?: {
    fallback?: React.ReactNode
    errorFallback?: React.ReactNode
    preload?: boolean
  }
) {
  const LazyComponent = React.lazy(importFn)

  // Preload if requested
  if (options?.preload) {
    importFn()
  }

  const WrappedComponent = React.forwardRef<any, React.ComponentProps<T>>((props, ref) => (
    <LazyWrapper
      fallback={options?.fallback}
      errorFallback={options?.errorFallback}
    >
      <LazyComponent {...props} ref={ref} />
    </LazyWrapper>
  ))

  WrappedComponent.displayName = `Lazy(${
    LazyComponent.displayName || LazyComponent.name || 'Component'
  })`

  // Add preload method
  ;(WrappedComponent as any).preload = importFn

  return WrappedComponent
}

/**
 * Preload multiple components
 */
export const preloadComponents = (...importFns: (() => Promise<any>)[]) => {
  importFns.forEach(fn => fn())
}

/**
 * Intersection Observer based lazy loading
 */
export const useLazyLoad = (ref: React.RefObject<Element>, options?: IntersectionObserverInit) => {
  const [isIntersecting, setIsIntersecting] = React.useState(false)

  React.useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true)
          observer.disconnect()
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
        ...options
      }
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [ref, options])

  return isIntersecting
}


