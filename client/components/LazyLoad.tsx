'use client'

import { lazy, Suspense, ComponentType } from 'react'
import LoadingSpinner from './LoadingSpinner'

interface LazyLoadProps {
  fallback?: React.ReactNode
}

export function lazyLoad<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  fallback?: React.ReactNode
) {
  const LazyComponent = lazy(importFunc)

  return function LazyWrapper(props: any) {
    return (
      <Suspense fallback={fallback || <LoadingSpinner size="lg" text="Loading..." />}>
        <LazyComponent {...props} />
      </Suspense>
    )
  }
}







