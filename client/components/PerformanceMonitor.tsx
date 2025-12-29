'use client'

import { useEffect } from 'react'
import { onCLS, onFID, onFCP, onLCP, onTTFB, Metric } from 'web-vitals'
import { reportWebVitals } from '../utils/performance'

/**
 * Performance Monitor Component
 * 
 * Automatically tracks and reports Core Web Vitals metrics:
 * - CLS (Cumulative Layout Shift)
 * - FID (First Input Delay)
 * - FCP (First Contentful Paint)
 * - LCP (Largest Contentful Paint)
 * - TTFB (Time to First Byte)
 * 
 * @remarks
 * - Only tracks in production or when analytics endpoint is configured
 * - Uses web-vitals library for accurate measurements
 * - Reports metrics via reportWebVitals utility
 * - Renders nothing (null component)
 * 
 * @example
 * ```tsx
 * <PerformanceMonitor />
 * ```
 */
export default function PerformanceMonitor() {
  useEffect(() => {
    // Only track in production or when analytics endpoint is configured
    const shouldTrack = process.env.NODE_ENV === 'production' || 
                       !!process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT

    if (!shouldTrack) {
      return
    }

    // Track Core Web Vitals
    onCLS((metric: Metric) => reportWebVitals(metric))
    onFID((metric: Metric) => reportWebVitals(metric))
    onFCP((metric: Metric) => reportWebVitals(metric))
    onLCP((metric: Metric) => reportWebVitals(metric))
    onTTFB((metric: Metric) => reportWebVitals(metric))
  }, [])

  // This component doesn't render anything
  return null
}

