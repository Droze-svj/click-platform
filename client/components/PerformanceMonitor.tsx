'use client'

import { useEffect, useRef } from 'react'
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
  const frameCountRef = useRef(0)
  const lastTimeRef = useRef(performance.now())
  const frameRateRef = useRef(60)

  useEffect(() => {
    const sendDebugLog = (message: string, data: any) => {
      // #region agent log
      fetch('http://127.0.0.1:5557/ingest/ff7d38f2-f61b-412e-9a79-ebc734d5bd4a', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'PerformanceMonitor.tsx',
          message,
          data: {
            ...data,
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run-perf-monitor'
          }
        }),
      }).catch(() => {})
      // #endregion
    }

    // Enhanced performance monitoring
    const monitorPerformance = () => {
      try {
        // Memory usage tracking
        if ('memory' in performance) {
          const memory = (performance as any).memory
          sendDebugLog('memory_usage', {
            usedJSHeapSize: memory.usedJSHeapSize,
            totalJSHeapSize: memory.totalJSHeapSize,
            jsHeapSizeLimit: memory.jsHeapSizeLimit,
            usagePercent: ((memory.usedJSHeapSize / memory.totalJSHeapSize) * 100).toFixed(2)
          })
        }

        // Navigation timing
        if ('timing' in performance) {
          const timing = performance.timing
          const loadTime = timing.loadEventEnd - timing.navigationStart
          const domReady = timing.domContentLoadedEventEnd - timing.navigationStart
          const firstPaint = performance.getEntriesByType('paint').find(entry => entry.name === 'first-paint')

          sendDebugLog('navigation_timing', {
            loadTime,
            domReady,
            firstPaint: firstPaint ? firstPaint.startTime : null,
            dnsLookup: timing.domainLookupEnd - timing.domainLookupStart,
            tcpConnect: timing.connectEnd - timing.connectStart,
            serverResponse: timing.responseStart - timing.requestStart
          })
        }

        // Resource loading performance
        const resources = performance.getEntriesByType('resource')
        const slowResources = resources.filter(resource =>
          resource.duration > 1000 && resource.name.includes('/_next/')
        )

        if (slowResources.length > 0) {
          sendDebugLog('slow_resources', {
            count: slowResources.length,
            resources: slowResources.map(r => ({
              name: r.name,
              duration: r.duration,
              size: (r as any).transferSize || 0
            }))
          })
        }

        // Frame rate monitoring
        const now = performance.now()
        frameCountRef.current++

        if (now - lastTimeRef.current >= 1000) {
          const fps = (frameCountRef.current * 1000) / (now - lastTimeRef.current)
          frameRateRef.current = fps
          frameCountRef.current = 0
          lastTimeRef.current = now

          if (fps < 30) {
            sendDebugLog('low_frame_rate', {
              fps: fps.toFixed(2),
              warning: 'Frame rate dropped below 30 FPS'
            })
          }
        }

        // Long tasks monitoring
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          entries.forEach((entry) => {
            if (entry.duration > 50) { // Tasks longer than 50ms
              sendDebugLog('long_task', {
                duration: entry.duration,
                startTime: entry.startTime,
                name: entry.name
              })
            }
          })
        })

        try {
          observer.observe({ entryTypes: ['longtask'] })
        } catch (e) {
          // Long tasks API might not be supported
        }

        // JavaScript errors monitoring
        const originalOnError = window.onerror
        window.onerror = (message, source, lineno, colno, error) => {
          sendDebugLog('javascript_error', {
            message,
            source,
            lineno,
            colno,
            stack: error?.stack,
            userAgent: navigator.userAgent
          })
          return originalOnError?.(message, source, lineno, colno, error) || false
        }

        // Unhandled promise rejections
        const originalOnUnhandledRejection = window.onunhandledrejection
        window.onunhandledrejection = (event) => {
          sendDebugLog('unhandled_promise_rejection', {
            reason: event.reason,
            promise: event.promise?.toString(),
            stack: event.reason?.stack
          })
          return originalOnUnhandledRejection?.call(window, event) || false
        }

      } catch (error) {
        sendDebugLog('performance_monitor_error', {
          error: error.message,
          stack: error.stack
        })
      }
    }

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

    // Start enhanced monitoring
    monitorPerformance()

    // Periodic performance checks
    const intervalId = setInterval(monitorPerformance, 30000) // Every 30 seconds

    return () => {
      clearInterval(intervalId)
    }
  }, [])

  // This component doesn't render anything
  return null
}

