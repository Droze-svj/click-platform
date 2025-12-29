/**
 * Performance monitoring and metrics utilities
 */

interface PerformanceMetric {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  delta?: number
  id: string
}

interface WebVitalsReport {
  CLS?: PerformanceMetric
  FID?: PerformanceMetric
  FCP?: PerformanceMetric
  LCP?: PerformanceMetric
  TTFB?: PerformanceMetric
}

/**
 * Web Vitals tracking using Next.js web-vitals library
 * This should be called in a client component
 */
export function reportWebVitals(metric: any) {
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Web Vitals]', metric)
  }

  // Send to analytics endpoint (if configured)
  const analyticsEndpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT
  if (analyticsEndpoint && typeof window !== 'undefined') {
    try {
      // Send to your analytics service
      fetch(analyticsEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: metric.name,
          value: metric.value,
          id: metric.id,
          delta: metric.delta,
          rating: metric.rating,
          url: window.location.href,
          timestamp: Date.now(),
        }),
        keepalive: true, // Ensures request completes even if page unloads
      }).catch((error) => {
        // Silently fail analytics
        if (process.env.NODE_ENV === 'development') {
          console.warn('[Analytics] Failed to send metric:', error)
        }
      })
    } catch (error) {
      // Silently fail analytics
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Analytics] Failed to send metric:', error)
      }
    }
  }
}

/**
 * Measures the execution time of a synchronous function.
 * 
 * @param name - Name identifier for the performance measurement
 * @param fn - Function to measure
 * @returns The result of the function execution
 * 
 * @remarks
 * - Uses Performance API marks and measures
 * - Logs duration to console in development mode
 * - Automatically cleans up performance marks after measurement
 * 
 * @example
 * ```typescript
 * const result = measurePerformance('processData', () => {
 *   return processLargeDataset(data);
 * });
 * ```
 */
export function measurePerformance<T>(
  name: string,
  fn: () => T
): T {
  if (typeof window === 'undefined' || !window.performance) {
    return fn()
  }

  const startMark = `${name}-start`
  const endMark = `${name}-end`
  const measureName = name

  try {
    performance.mark(startMark)
    const result = fn()
    
    // For async functions, measure immediately (won't be accurate)
    // For accurate async measurement, use measureAsyncPerformance
    if (result instanceof Promise) {
      return result as T
    }
    
    performance.mark(endMark)
    performance.measure(measureName, startMark, endMark)
    
    const measure = performance.getEntriesByName(measureName, 'measure')[0]
    if (measure && process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${name}: ${measure.duration.toFixed(2)}ms`)
    }
    
    // Clean up
    performance.clearMarks(startMark)
    performance.clearMarks(endMark)
    performance.clearMeasures(measureName)
    
    return result
  } catch (error) {
    // Clean up on error
    try {
      performance.clearMarks(startMark)
      performance.clearMarks(endMark)
      performance.clearMeasures(measureName)
    } catch {
      // Ignore cleanup errors
    }
    throw error
  }
}

/**
 * Measures the execution time of an asynchronous function.
 * 
 * @param name - Name identifier for the performance measurement
 * @param fn - Async function to measure
 * @returns Promise that resolves with the function result
 * 
 * @remarks
 * - Uses Performance API marks and measures
 * - Logs duration to console in development mode
 * - Properly handles async operations and errors
 * - Automatically cleans up performance marks after measurement
 * 
 * @example
 * ```typescript
 * const result = await measureAsyncPerformance('fetchData', async () => {
 *   return await fetch('/api/data').then(r => r.json());
 * });
 * ```
 */
export async function measureAsyncPerformance<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  if (typeof window === 'undefined' || !window.performance) {
    return fn()
  }

  const startMark = `${name}-start`
  const endMark = `${name}-end`
  const measureName = name

  try {
    performance.mark(startMark)
    const result = await fn()
    performance.mark(endMark)
    performance.measure(measureName, startMark, endMark)
    
    const measure = performance.getEntriesByName(measureName, 'measure')[0]
    if (measure && process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${name}: ${measure.duration.toFixed(2)}ms`)
    }
    
    // Clean up
    performance.clearMarks(startMark)
    performance.clearMarks(endMark)
    performance.clearMeasures(measureName)
    
    return result
  } catch (error) {
    // Clean up on error
    try {
      performance.clearMarks(startMark)
      performance.clearMarks(endMark)
      performance.clearMeasures(measureName)
    } catch {
      // Ignore cleanup errors
    }
    throw error
  }
}

/**
 * Get performance navigation timing
 */
export function getNavigationTiming(): PerformanceNavigationTiming | null {
  if (typeof window === 'undefined' || !window.performance) {
    return null
  }

  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
  return navigation || null
}

/**
 * Gets a summary of performance metrics from navigation timing.
 * 
 * @returns Object containing performance metrics or null if not available
 * 
 * @remarks
 * Returns an object with the following metrics:
 * - `dns`: DNS lookup time
 * - `tcp`: TCP connection time
 * - `tls`: TLS negotiation time (if HTTPS)
 * - `ttfb`: Time to first byte
 * - `download`: Response download time
 * - `domProcessing`: DOM processing time
 * - `total`: Total page load time
 * 
 * @example
 * ```typescript
 * const summary = getPerformanceSummary();
 * if (summary) {
 *   console.log(`Total load time: ${summary.total}ms`);
 * }
 * ```
 */
export function getPerformanceSummary() {
  if (typeof window === 'undefined' || !window.performance) {
    return null
  }

  const navigation = getNavigationTiming()
  if (!navigation) {
    return null
  }

  return {
    // DNS lookup time
    dns: navigation.domainLookupEnd - navigation.domainLookupStart,
    
    // TCP connection time
    tcp: navigation.connectEnd - navigation.connectStart,
    
    // TLS negotiation time (if HTTPS)
    tls: navigation.secureConnectionStart
      ? navigation.connectEnd - navigation.secureConnectionStart
      : 0,
    
    // Time to first byte
    ttfb: navigation.responseStart - navigation.requestStart,
    
    // Response download time
    download: navigation.responseEnd - navigation.responseStart,
    
    // DOM processing time
    domProcessing: navigation.domComplete - navigation.domInteractive,
    
    // Total page load time
    total: navigation.loadEventEnd - navigation.fetchStart,
  }
}

/**
 * Log performance summary to console (development only)
 */
export function logPerformanceSummary() {
  if (process.env.NODE_ENV !== 'development') {
    return
  }

  const summary = getPerformanceSummary()
  if (!summary) {
    return
  }

  console.group('🚀 Performance Summary')
  console.log(`DNS Lookup: ${summary.dns.toFixed(2)}ms`)
  console.log(`TCP Connection: ${summary.tcp.toFixed(2)}ms`)
  if (summary.tls > 0) {
    console.log(`TLS Negotiation: ${summary.tls.toFixed(2)}ms`)
  }
  console.log(`Time to First Byte: ${summary.ttfb.toFixed(2)}ms`)
  console.log(`Download: ${summary.download.toFixed(2)}ms`)
  console.log(`DOM Processing: ${summary.domProcessing.toFixed(2)}ms`)
  console.log(`Total Load Time: ${summary.total.toFixed(2)}ms`)
  console.groupEnd()
}

/**
 * Check if user has slow connection
 */
export function isSlowConnection(): boolean {
  if (typeof window === 'undefined' || !('connection' in navigator)) {
    return false
  }

  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
  
  if (!connection) {
    return false
  }

  // Check effective type
  const slowTypes = ['slow-2g', '2g', '3g']
  if (slowTypes.includes(connection.effectiveType)) {
    return true
  }

  // Check if connection is downlink limited (less than 2 Mbps)
  if (connection.downlink && connection.downlink < 2) {
    return true
  }

  return false
}

/**
 * Monitor resource loading performance
 */
export function getResourceTimings(): PerformanceResourceTiming[] {
  if (typeof window === 'undefined' || !window.performance) {
    return []
  }

  return performance.getEntriesByType('resource') as PerformanceResourceTiming[]
}

/**
 * Get largest contentful paint (LCP) from performance observer
 */
export function observeLCP(callback: (entry: PerformanceEntry) => void): PerformanceObserver | null {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') {
    return null
  }

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const lastEntry = entries[entries.length - 1] // LCP is the last entry
      callback(lastEntry)
    })

    observer.observe({ entryTypes: ['largest-contentful-paint'] })
    return observer
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Performance] Failed to observe LCP:', error)
    }
    return null
  }
}

