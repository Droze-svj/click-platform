/**
 * Real User Monitoring (RUM)
 * Client-side performance tracking and Core Web Vitals measurement
 */

import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals'
// Conditional imports for client-side only
let analytics = null
let errorMonitor = null

if (typeof window !== 'undefined') {
  try {
    analytics = require('./analytics').default
    errorMonitor = require('./errorMonitor').errorMonitor
  } catch (e) {
    console.warn('Analytics or error monitor not available:', e.message)
  }
}

class RUMMonitor {
  constructor() {
    this.isInitialized = false
    this.metrics = {
      coreWebVitals: {},
      performance: {},
      userExperience: {},
      errors: [],
      navigation: {},
      resources: {}
    }

    this.thresholds = {
      cls: 0.1, // Cumulative Layout Shift
      fid: 100, // First Input Delay (ms)
      fcp: 1800, // First Contentful Paint (ms)
      lcp: 2500, // Largest Contentful Paint (ms)
      ttfb: 800  // Time to First Byte (ms)
    }

    this.initialize()
  }

  /**
   * Initialize RUM monitoring
   */
  initialize() {
    if (this.isInitialized || typeof window === 'undefined') return

    try {
      // Start monitoring immediately
      this.startPerformanceMonitoring()
      this.startUserExperienceMonitoring()
      this.startErrorMonitoring()
      this.startResourceMonitoring()

      // Measure Core Web Vitals
      this.measureCoreWebVitals()

      // Track navigation timing
      this.trackNavigationTiming()

      // Track long tasks (if supported)
      if ('PerformanceObserver' in window) {
        this.trackLongTasks()
      }

      this.isInitialized = true
      console.log('✅ Real User Monitoring initialized')

    } catch (error) {
      console.warn('⚠️ RUM initialization failed:', error.message)
      errorMonitor.monitorError(error, 'RUM', 'initialization')
    }
  }

  /**
   * Measure Core Web Vitals
   */
  measureCoreWebVitals() {
    // Cumulative Layout Shift
    getCLS((metric) => {
      this.recordCoreWebVital('CLS', metric)
      this.checkThreshold('cls', metric.value)
    })

    // First Input Delay
    getFID((metric) => {
      this.recordCoreWebVital('FID', metric.value ? metric.value : 0)
      this.checkThreshold('fid', metric.value)
    })

    // First Contentful Paint
    getFCP((metric) => {
      this.recordCoreWebVital('FCP', metric.value)
      this.checkThreshold('fcp', metric.value)
    })

    // Largest Contentful Paint
    getLCP((metric) => {
      this.recordCoreWebVital('LCP', metric.value)
      this.checkThreshold('lcp', metric.value)
    })

    // Time to First Byte
    getTTFB((metric) => {
      this.recordCoreWebVital('TTFB', metric.value)
      this.checkThreshold('ttfb', metric.value)
    })
  }

  /**
   * Record Core Web Vital
   */
  recordCoreWebVital(name, value) {
    this.metrics.coreWebVitals[name] = {
      value,
      timestamp: Date.now(),
      rating: this.getVitalRating(name, value)
    }

    // Track with analytics
    analytics.trackPerformance(`cwv_${name.toLowerCase()}`, value, {
      rating: this.getVitalRating(name, value),
      threshold: this.thresholds[name.toLowerCase()]
    })

    console.log(`📊 ${name}: ${value} (${this.getVitalRating(name, value)})`)
  }

  /**
   * Get Core Web Vital rating
   */
  getVitalRating(name, value) {
    const thresholds = {
      CLS: { good: 0.1, poor: 0.25 },
      FID: { good: 100, poor: 300 },
      FCP: { good: 1800, poor: 3000 },
      LCP: { good: 2500, poor: 4000 },
      TTFB: { good: 800, poor: 1800 }
    }

    const threshold = thresholds[name]
    if (!threshold) return 'unknown'

    if (value <= threshold.good) return 'good'
    if (value <= threshold.poor) return 'needs-improvement'
    return 'poor'
  }

  /**
   * Check if metric exceeds threshold
   */
  checkThreshold(metric, value) {
    const threshold = this.thresholds[metric.toLowerCase()]
    if (threshold && value > threshold) {
      analytics.trackEvent('performance_threshold_exceeded', {
        metric: metric.toUpperCase(),
        value,
        threshold,
        severity: value > threshold * 2 ? 'high' : 'medium'
      })

      errorMonitor.monitorError(
        new Error(`${metric.toUpperCase()} exceeded threshold: ${value} > ${threshold}`),
        'RUM',
        'performance_threshold',
        { metric, value, threshold }
      )
    }
  }

  /**
   * Start performance monitoring
   */
  startPerformanceMonitoring() {
    // Monitor navigation timing
    if (performance.timing) {
      const timing = performance.timing
      const pageLoadTime = timing.loadEventEnd - timing.navigationStart
      const domReadyTime = timing.domContentLoadedEventEnd - timing.navigationStart
      const firstPaint = performance.getEntriesByName('first-paint')[0]
      const firstContentfulPaint = performance.getEntriesByName('first-contentful-paint')[0]

      this.metrics.performance = {
        pageLoadTime,
        domReadyTime,
        firstPaint: firstPaint ? firstPaint.startTime : null,
        firstContentfulPaint: firstContentfulPaint ? firstContentfulPaint.startTime : null,
        timestamp: Date.now()
      }

      // Track performance metrics
      analytics.trackPerformance('page_load_time', pageLoadTime)
      analytics.trackPerformance('dom_ready_time', domReadyTime)
    }

    // Monitor memory usage (if available)
    if (performance.memory) {
      const memory = performance.memory
      this.metrics.performance.memory = {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        utilization: memory.usedJSHeapSize / memory.jsHeapSizeLimit
      }
    }
  }

  /**
   * Track navigation timing
   */
  trackNavigationTiming() {
    if (!performance.getEntriesByType) return

    const navigation = performance.getEntriesByType('navigation')[0]
    if (navigation) {
      this.metrics.navigation = {
        type: navigation.type,
        redirectCount: navigation.redirectCount,
        redirectTime: navigation.redirectEnd - navigation.redirectStart,
        dnsTime: navigation.domainLookupEnd - navigation.domainLookupStart,
        tcpTime: navigation.connectEnd - navigation.connectStart,
        sslTime: navigation.secureConnectionStart ?
          navigation.connectEnd - navigation.secureConnectionStart : 0,
        requestTime: navigation.responseStart - navigation.requestStart,
        responseTime: navigation.responseEnd - navigation.responseStart,
        processingTime: navigation.loadEventStart - navigation.responseEnd,
        totalTime: navigation.loadEventEnd - navigation.fetchStart
      }

      analytics.trackEvent('navigation_timing', this.metrics.navigation)
    }
  }

  /**
   * Track long tasks
   */
  trackLongTasks() {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach(entry => {
          if (entry.duration > 50) { // Tasks longer than 50ms
            analytics.trackEvent('long_task', {
              duration: entry.duration,
              startTime: entry.startTime,
              name: entry.name,
              severity: entry.duration > 100 ? 'high' : 'medium'
            })

            // Alert on very long tasks
            if (entry.duration > 500) {
              errorMonitor.monitorError(
                new Error(`Long task detected: ${entry.duration}ms`),
                'RUM',
                'long_task',
                { duration: entry.duration, name: entry.name }
              )
            }
          }
        })
      })

      observer.observe({ entryTypes: ['longtask'] })
    } catch (error) {
      console.warn('⚠️ Long task monitoring not supported:', error.message)
    }
  }

  /**
   * Start user experience monitoring
   */
  startUserExperienceMonitoring() {
    // Track user interactions
    let interactionCount = 0
    let lastInteractionTime = Date.now()

    const trackInteraction = () => {
      interactionCount++
      lastInteractionTime = Date.now()

      // Track engagement every 10 interactions
      if (interactionCount % 10 === 0) {
        analytics.trackEvent('user_engagement', {
          interactionCount,
          timeSinceLastInteraction: Date.now() - lastInteractionTime,
          sessionDuration: Date.now() - this.sessionStartTime
        })
      }
    }

    // Track clicks
    document.addEventListener('click', trackInteraction, { passive: true })

    // Track keyboard interactions
    document.addEventListener('keydown', trackInteraction, { passive: true })

    // Track scroll depth
    let maxScrollDepth = 0
    window.addEventListener('scroll', () => {
      const scrollDepth = Math.round(
        ((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight) * 100
      )
      if (scrollDepth > maxScrollDepth) {
        maxScrollDepth = scrollDepth

        // Track scroll milestones
        if (scrollDepth >= 25 && scrollDepth % 25 === 0) {
          analytics.trackEvent('scroll_milestone', {
            depth: scrollDepth,
            maxDepth: maxScrollDepth
          })
        }
      }
    }, { passive: true })

    // Track page visibility
    document.addEventListener('visibilitychange', () => {
      analytics.trackEvent('visibility_change', {
        hidden: document.hidden,
        timestamp: Date.now()
      })
    })

    this.sessionStartTime = Date.now()
  }

  /**
   * Start error monitoring
   */
  startErrorMonitoring() {
    // Global error handler
    const originalOnError = window.onerror
    window.onerror = (message, source, lineno, colno, error) => {
      this.recordError(error || { message, source, lineno, colno }, 'global')

      // Call original handler
      if (originalOnError) {
        originalOnError(message, source, lineno, colno, error)
      }
    }

    // Unhandled promise rejection handler
    const originalOnUnhandledRejection = window.onunhandledrejection
    window.onunhandledrejection = (event) => {
      this.recordError({
        message: event.reason?.message || 'Unhandled promise rejection',
        stack: event.reason?.stack,
        reason: event.reason
      }, 'promise')

      // Call original handler
      if (originalOnUnhandledRejection) {
        originalOnUnhandledRejection(event)
      }
    }

    // Monitor console errors (development only)
    if (process.env.NODE_ENV === 'development') {
      const originalConsoleError = console.error
      console.error = (...args) => {
        const message = args.join(' ')
        if (message.includes('Error') || message.includes('Exception')) {
          this.recordError({ message }, 'console')
        }
        originalConsoleError.apply(console, args)
      }
    }
  }

  /**
   * Record client-side error
   */
  recordError(error, source = 'unknown') {
    const errorRecord = {
      message: error.message || 'Unknown error',
      stack: error.stack,
      source,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      connection: navigator.connection || navigator.mozConnection || navigator.webkitConnection
    }

    this.metrics.errors.push(errorRecord)

    // Keep only last 50 errors
    if (this.metrics.errors.length > 50) {
      this.metrics.errors = this.metrics.errors.slice(-50)
    }

    // Track with analytics and error monitoring
    analytics.trackError(error, { source, url: window.location.href })
    errorMonitor.monitorError(error, 'RUM', source, errorRecord)
  }

  /**
   * Start resource monitoring
   */
  startResourceMonitoring() {
    if (!performance.getEntriesByType) return

    // Monitor resource loading performance
    setTimeout(() => {
      const resources = performance.getEntriesByType('resource')

      const resourceStats = resources.reduce((stats, resource) => {
        const type = this.getResourceType(resource.name)
        if (!stats[type]) {
          stats[type] = { count: 0, totalSize: 0, totalTime: 0, failed: 0 }
        }

        stats[type].count++
        stats[type].totalSize += resource.transferSize || 0
        stats[type].totalTime += resource.responseEnd - resource.requestStart

        if (resource.transferSize === 0 && resource.decodedBodySize === 0) {
          stats[type].failed++
        }

        return stats
      }, {})

      this.metrics.resources = resourceStats

      // Track resource loading performance
      Object.entries(resourceStats).forEach(([type, stats]) => {
        analytics.trackPerformance(`resource_${type}_count`, stats.count)
        analytics.trackPerformance(`resource_${type}_avg_time`, stats.totalTime / stats.count)
        analytics.trackPerformance(`resource_${type}_total_size`, stats.totalSize)
        if (stats.failed > 0) {
          analytics.trackEvent('resource_load_failed', { type, failed: stats.failed })
        }
      })
    }, 5000) // Wait 5 seconds for resources to load
  }

  /**
   * Get resource type from URL
   */
  getResourceType(url) {
    if (url.includes('.js')) return 'javascript'
    if (url.includes('.css')) return 'stylesheet'
    if (url.includes('.png') || url.includes('.jpg') || url.includes('.jpeg') ||
        url.includes('.gif') || url.includes('.webp') || url.includes('.svg')) return 'image'
    if (url.includes('.woff') || url.includes('.woff2') || url.includes('.ttf')) return 'font'
    if (url.includes('/api/')) return 'api'
    return 'other'
  }

  /**
   * Get RUM metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      sessionDuration: Date.now() - this.sessionStartTime,
      initialized: this.isInitialized
    }
  }

  /**
   * Export data for debugging
   */
  exportData() {
    return {
      ...this.getMetrics(),
      thresholds: this.thresholds,
      sessionStartTime: this.sessionStartTime
    }
  }

  /**
   * Check if Core Web Vitals are within acceptable ranges
   */
  getVitalsScore() {
    const vitals = this.metrics.coreWebVitals
    let good = 0
    let poor = 0

    Object.values(vitals).forEach(vital => {
      if (vital.rating === 'good') good++
      if (vital.rating === 'poor') poor++
    })

    const total = Object.keys(vitals).length
    if (total === 0) return 0

    return {
      score: ((good * 1 + (total - good - poor) * 0.5) / total) * 100,
      good,
      needsImprovement: total - good - poor,
      poor,
      total
    }
  }
}

// Create singleton instance
const rumMonitor = new RUMMonitor()

// Initialize when DOM is ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => rumMonitor.initialize())
  } else {
    rumMonitor.initialize()
  }
}

export default rumMonitor
