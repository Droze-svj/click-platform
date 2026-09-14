'use client'

import { useEffect, useRef } from 'react'
import { onCLS, onFID, onFCP, onLCP, onTTFB, Metric } from 'web-vitals'
import { reportWebVitals } from '../utils/performance'
import { sendDebugLog } from '../utils/debugLog'

/**
 * Performance Monitor — Core Web Vitals + runtime health.
 *
 * Reports CLS / FID / FCP / LCP / TTFB via `reportWebVitals`, plus memory,
 * navigation timing, slow `_next` resources, long tasks and real frame rate.
 * Renders nothing.
 *
 * Only active in production or when NEXT_PUBLIC_ANALYTICS_ENDPOINT is set, and
 * `sendDebugLog` is itself gated on an opt-in localStorage flag, so a normal
 * user session sends nothing.
 *
 * STRUCTURE MATTERS HERE. Everything that INSTALLS something — the long-task
 * observer, the window error handlers, the frame-rate loop — is set up exactly
 * once and torn down on unmount. Only the cheap sampling runs on the interval.
 * Previously the whole body ran every 30s, so each tick added another
 * PerformanceObserver and wrapped window.onerror again; after an hour that was
 * 120 live observers and a 120-deep handler chain. A monitor that degrades the
 * thing it measures is worse than no monitor.
 */
export default function PerformanceMonitor() {
  const frameRateRef = useRef(60)

  useEffect(() => {
    const shouldTrack =
      process.env.NODE_ENV === 'production' || !!process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT
    if (!shouldTrack) return

    const send = (message: string, data: Record<string, unknown>) => {
      sendDebugLog('PerformanceMonitor', message, {
        ...data,
        sessionId: 'debug-session',
        runId: 'run-perf-monitor',
      })
    }

    /* ── One-time: Core Web Vitals ─────────────────────────────────────── */
    onCLS((metric: Metric) => reportWebVitals(metric))
    onFID((metric: Metric) => reportWebVitals(metric))
    onFCP((metric: Metric) => reportWebVitals(metric))
    onLCP((metric: Metric) => reportWebVitals(metric))
    onTTFB((metric: Metric) => reportWebVitals(metric))

    /* ── One-time: navigation timing (a page loads once) ───────────────── */
    try {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
      if (nav) {
        const firstPaint = performance.getEntriesByType('paint').find((e) => e.name === 'first-paint')
        send('navigation_timing', {
          loadTime: nav.loadEventEnd - nav.startTime,
          domReady: nav.domContentLoadedEventEnd - nav.startTime,
          firstPaint: firstPaint ? firstPaint.startTime : null,
          dnsLookup: nav.domainLookupEnd - nav.domainLookupStart,
          tcpConnect: nav.connectEnd - nav.connectStart,
          serverResponse: nav.responseStart - nav.requestStart,
        })
      }
    } catch {
      /* timing API unavailable — not worth failing the monitor over */
    }

    /* ── One-time: long tasks ──────────────────────────────────────────── */
    let longTaskObserver: PerformanceObserver | null = null
    try {
      longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) {
            send('long_task', {
              duration: entry.duration,
              startTime: entry.startTime,
              name: entry.name,
            })
          }
        }
      })
      longTaskObserver.observe({ entryTypes: ['longtask'] })
    } catch {
      // Long Tasks API isn't in every browser.
      longTaskObserver = null
    }

    /* ── One-time: global error capture ────────────────────────────────── */
    const previousOnError = window.onerror
    window.onerror = (message, source, lineno, colno, error) => {
      send('javascript_error', { message, source, lineno, colno, stack: error?.stack, userAgent: navigator.userAgent })
      return previousOnError?.(message, source, lineno, colno, error) ?? false
    }

    const previousOnRejection = window.onunhandledrejection
    window.onunhandledrejection = (event) => {
      const msg = event.reason instanceof Error ? event.reason.message : String(event.reason)
      // Browser-extension noise, not our code.
      if (!/MetaMask|extension|inpage\.js/.test(msg)) {
        send('unhandled_promise_rejection', { reason: msg, stack: event.reason?.stack })
      }
      return previousOnRejection?.call(window, event) ?? false
    }

    /* ── One-time: real frame rate ─────────────────────────────────────── */
    // Counted per animation frame. The old version incremented once per 30s
    // interval tick and divided by the elapsed ms, which always produced
    // ~0.03 "fps" and fired a low-frame-rate warning on every single tick.
    let frames = 0
    let windowStart = performance.now()
    let rafId = 0
    const countFrame = () => {
      frames++
      const now = performance.now()
      if (now - windowStart >= 1000) {
        frameRateRef.current = (frames * 1000) / (now - windowStart)
        frames = 0
        windowStart = now
      }
      rafId = requestAnimationFrame(countFrame)
    }
    rafId = requestAnimationFrame(countFrame)

    /* ── Periodic: cheap sampling only ─────────────────────────────────── */
    let reportedSlowResources = 0
    const sample = () => {
      try {
        if ('memory' in performance) {
          const memory = (performance as any).memory
          send('memory_usage', {
            usedJSHeapSize: memory.usedJSHeapSize,
            totalJSHeapSize: memory.totalJSHeapSize,
            jsHeapSizeLimit: memory.jsHeapSizeLimit,
            usagePercent: ((memory.usedJSHeapSize / memory.totalJSHeapSize) * 100).toFixed(2),
          })
        }

        // Only report resources we haven't already reported — the resource
        // buffer is cumulative, so re-scanning it resent the same entries.
        const resources = performance.getEntriesByType('resource')
        const slow = resources.filter((r) => r.duration > 1000 && r.name.includes('/_next/'))
        if (slow.length > reportedSlowResources) {
          send('slow_resources', {
            count: slow.length - reportedSlowResources,
            resources: slow.slice(reportedSlowResources).map((r) => ({
              name: r.name,
              duration: r.duration,
              size: (r as any).transferSize || 0,
            })),
          })
          reportedSlowResources = slow.length
        }

        if (frameRateRef.current < 30) {
          send('low_frame_rate', { fps: frameRateRef.current.toFixed(2) })
        }
      } catch (error) {
        send('performance_monitor_error', {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    sample()
    const intervalId = setInterval(sample, 30000)

    return () => {
      clearInterval(intervalId)
      cancelAnimationFrame(rafId)
      longTaskObserver?.disconnect()
      window.onerror = previousOnError
      window.onunhandledrejection = previousOnRejection
    }
  }, [])

  return null
}
