/**
 * User Analytics Integration
 * Comprehensive user behavior tracking and analytics
 */

// Error monitor is only available on the client side, import conditionally
let errorMonitor = null
if (typeof window !== 'undefined') {
  try {
    errorMonitor = require('./errorMonitor').errorMonitor
  } catch (e) {
    console.warn('Error monitor not available:', e.message)
  }
}
// RUM monitor is only available on the client side, import conditionally
let rumMonitor = null
if (typeof window !== 'undefined') {
  try {
    rumMonitor = require('./rum').default
  } catch (e) {
    console.warn('RUM monitor not available:', e.message)
  }
}

class AnalyticsTracker {
  constructor() {
    this.providers = new Map()
    this.userId = null
    this.sessionId = this.generateSessionId()
    this.pageStartTime = Date.now()
    this.events = []
    this.isInitialized = false

    // Only initialize on client side
    if (typeof window !== 'undefined') {
      // Initialize default providers
      this.initializeProviders()

      // Track page visibility changes
      this.trackPageVisibility()

      // Track user interactions
      this.trackUserInteractions()
    }
  }

  /**
   * Initialize analytics providers
   */
  initializeProviders() {
    // Google Analytics 4
    if (typeof window !== 'undefined' && window.env?.NEXT_PUBLIC_GA_MEASUREMENT_ID) {
      this.addProvider('ga4', {
        measurementId: window.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
        initialized: false
      })
    } else if (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) {
      this.addProvider('ga4', {
        measurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
        initialized: false
      })
    }

    // Mixpanel
    if (typeof window !== 'undefined' && window.env?.NEXT_PUBLIC_MIXPANEL_TOKEN) {
      this.addProvider('mixpanel', {
        token: window.env.NEXT_PUBLIC_MIXPANEL_TOKEN,
        initialized: false
      })
    } else if (process.env.NEXT_PUBLIC_MIXPANEL_TOKEN) {
      this.addProvider('mixpanel', {
        token: process.env.NEXT_PUBLIC_MIXPANEL_TOKEN,
        initialized: false
      })
    }

    // Custom analytics endpoint
    if (typeof window !== 'undefined' && window.env?.NEXT_PUBLIC_ANALYTICS_ENDPOINT) {
      this.addProvider('custom', {
        endpoint: window.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT,
        initialized: true
      })
    } else if (process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT) {
      this.addProvider('custom', {
        endpoint: process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT,
        initialized: true
      })
    }

    // Privacy-focused mode (local only)
    const disablePrivacy = (typeof window !== 'undefined' && window.env?.NEXT_PUBLIC_DISABLE_PRIVACY_ANALYTICS) ||
                          process.env.NEXT_PUBLIC_DISABLE_PRIVACY_ANALYTICS
    this.addProvider('privacy', {
      enabled: !disablePrivacy,
      initialized: true
    })
  }

  /**
   * Add analytics provider
   */
  addProvider(name, config) {
    this.providers.set(name, {
      ...config,
      sendEvent: (event) => this.sendToProvider(name, event),
      queue: []
    })
  }

  /**
   * Initialize analytics (call after user consent)
   */
  async initialize(userId = null, userProperties = {}) {
    if (this.isInitialized) return

    this.userId = userId
    this.userProperties = userProperties

    // Load provider scripts
    await this.loadProviderScripts()

    // Send initialization events
    this.trackEvent('analytics_initialized', {
      userId: this.userId,
      sessionId: this.sessionId,
      userAgent: navigator.userAgent,
      referrer: document.referrer,
      url: window.location.href,
      timestamp: Date.now()
    })

    // Track initial page view
    this.trackPageView()

    this.isInitialized = true
  }

  /**
   * Load provider scripts dynamically
   */
  async loadProviderScripts() {
    const loadPromises = []

    // Google Analytics 4
    if (this.providers.has('ga4')) {
      loadPromises.push(this.loadGAScript())
    }

    // Mixpanel
    if (this.providers.has('mixpanel')) {
      loadPromises.push(this.loadMixpanelScript())
    }

    await Promise.all(loadPromises)
  }

  /**
   * Load Google Analytics script
   */
  async loadGAScript() {
    const provider = this.providers.get('ga4')
    if (!provider || provider.initialized) return

    try {
      // Load gtag script
      await this.loadScript('https://www.googletagmanager.com/gtag/js?id=' + provider.measurementId)

      // Initialize gtag
      window.gtag = window.gtag || function() {
        window.dataLayer = window.dataLayer || []
        window.dataLayer.push(arguments)
      }

      window.gtag('js', new Date())
      window.gtag('config', provider.measurementId, {
        custom_map: { dimension1: 'user_id', dimension2: 'session_id' },
        custom_parameters: {
          user_id: this.userId,
          session_id: this.sessionId
        }
      })

      provider.initialized = true
      console.log('✅ Google Analytics initialized')
    } catch (error) {
      console.warn('⚠️ Failed to load Google Analytics:', error.message)
      errorMonitor?.monitorError?.(error, 'Analytics', 'load_ga_script')
    }
  }

  /**
   * Load Mixpanel script
   */
  async loadMixpanelScript() {
    const provider = this.providers.get('mixpanel')
    if (!provider || provider.initialized) return

    try {
      await this.loadScript('https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js')

      if (window.mixpanel) {
        window.mixpanel.init(provider.token, {
          api_host: 'https://api.mixpanel.com',
          persistence: 'localStorage',
          batch_requests: true
        })

        if (this.userId) {
          window.mixpanel.identify(this.userId)
          window.mixpanel.people.set({
            $user_id: this.userId,
            $session_id: this.sessionId,
            ...this.userProperties
          })
        }

        provider.initialized = true
        console.log('✅ Mixpanel initialized')
      }
    } catch (error) {
      console.warn('⚠️ Failed to load Mixpanel:', error.message)
      errorMonitor?.monitorError?.(error, 'Analytics', 'load_mixpanel_script')
    }
  }

  /**
   * Load script dynamically
   */
  loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = src
      script.async = true
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })
  }

  /**
   * Track page view
   */
  trackPageView(pageData = {}) {
    if (typeof window === 'undefined') return

    const event = {
      event: 'page_view',
      page: window.location.pathname,
      title: document.title,
      referrer: document.referrer,
      search: window.location.search,
      timeOnPage: 0, // Will be updated on next page view
      ...pageData,
      timestamp: Date.now()
    }

    // Update time on previous page
    if (this.lastPageView) {
      this.lastPageView.timeOnPage = event.timestamp - this.lastPageView.timestamp
      this.sendEvent(this.lastPageView)
    }

    this.lastPageView = event
    this.sendEvent(event)
  }

  /**
   * Track user interaction
   */
  trackEvent(eventName, properties = {}) {
    const event = {
      event: eventName,
      properties: {
        ...properties,
        userId: this.userId,
        sessionId: this.sessionId,
        page: window.location.pathname,
        timestamp: Date.now(),
        url: window.location.href
      }
    }

    this.events.push(event)

    // Keep only last 1000 events in memory
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000)
    }

    this.sendEvent(event)
  }

  /**
   * Track user interaction (click, scroll, etc.)
   */
  trackInteraction(interactionType, element, properties = {}) {
    const event = {
      event: 'user_interaction',
      interactionType,
      element: element.tagName ? {
        tagName: element.tagName,
        id: element.id,
        className: element.className,
        textContent: element.textContent?.substring(0, 100),
        dataset: element.dataset
      } : element,
      ...properties,
      timestamp: Date.now()
    }

    this.trackEvent('interaction', event)
  }

  /**
   * Track conversion/funnel step
   */
  trackConversion(step, funnel, value = null) {
    this.trackEvent('conversion', {
      step,
      funnel,
      value,
      stepNumber: this.getFunnelStep(funnel, step)
    })
  }

  /**
   * Track error
   */
  trackError(error, context = {}) {
    this.trackEvent('error', {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      context,
      url: window.location.href,
      userAgent: navigator.userAgent
    })
  }

  /**
   * Track performance metric
   */
  trackPerformance(metric, value, additionalData = {}) {
    this.trackEvent('performance', {
      metric,
      value,
      ...additionalData
    })
  }

  /**
   * Track feature usage
   */
  trackFeatureUsage(feature, action, properties = {}) {
    this.trackEvent('feature_usage', {
      feature,
      action,
      ...properties
    })
  }

  /**
   * Send event to all providers
   */
  sendEvent(event) {
    this.providers.forEach((provider, name) => {
      try {
        this.sendToProvider(name, event)
      } catch (error) {
        console.warn(`⚠️ Failed to send event to ${name}:`, error.message)
      }
    })
  }

  /**
   * Send event to specific provider
   */
  sendToProvider(providerName, event) {
    const provider = this.providers.get(providerName)
    if (!provider || !provider.initialized) {
      // Queue event for later if provider not ready
      if (provider) {
        provider.queue.push(event)
      }
      return
    }

    try {
      switch (providerName) {
        case 'ga4':
          this.sendToGA4(event)
          break
        case 'mixpanel':
          this.sendToMixpanel(event)
          break
        case 'custom':
          this.sendToCustom(event)
          break
        case 'privacy':
          this.storeLocally(event)
          break
      }
    } catch (error) {
      console.warn(`⚠️ Failed to send to ${providerName}:`, error.message)
      errorMonitor.monitorError(error, 'Analytics', `send_to_${providerName}`)
    }
  }

  /**
   * Send to Google Analytics 4
   */
  sendToGA4(event) {
    if (!window.gtag) return

    const gaEvent = {
      event_category: event.properties?.category || 'engagement',
      event_label: event.properties?.label,
      value: event.properties?.value,
      custom_parameter_1: event.properties?.userId,
      custom_parameter_2: event.properties?.sessionId
    }

    window.gtag('event', event.event, gaEvent)
  }

  /**
   * Send to Mixpanel
   */
  sendToMixpanel(event) {
    if (!window.mixpanel) return

    window.mixpanel.track(event.event, event.properties)
  }

  /**
   * Send to custom analytics endpoint
   */
  async sendToCustom(event) {
    const provider = this.providers.get('custom')
    if (!provider) return

    try {
      await fetch(provider.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event)
      })
    } catch (error) {
      console.warn('⚠️ Custom analytics send failed:', error.message)
      errorMonitor?.monitorError?.(error, 'Analytics', 'send_custom')
    }
  }

  /**
   * Store locally for privacy-focused analytics
   */
  storeLocally(event) {
    const provider = this.providers.get('privacy')
    if (!provider || !provider.enabled) return

    try {
      const stored = JSON.parse(localStorage.getItem('analytics_events') || '[]')
      stored.push(event)

      // Keep only last 500 events
      if (stored.length > 500) {
        stored.splice(0, stored.length - 500)
      }

      localStorage.setItem('analytics_events', JSON.stringify(stored))
    } catch (error) {
      console.warn('⚠️ Local analytics storage failed:', error.message)
    }
  }

  /**
   * Track page visibility changes
   */
  trackPageVisibility() {
    let pageVisible = true
    let visibilityStart = Date.now()

    const handleVisibilityChange = () => {
      const now = Date.now()
      const wasVisible = pageVisible
      pageVisible = !document.hidden

      if (wasVisible && !pageVisible) {
        // Page became hidden
        this.trackEvent('page_hidden', {
          timeVisible: now - visibilityStart
        })
      } else if (!wasVisible && pageVisible) {
        // Page became visible
        visibilityStart = now
        this.trackEvent('page_visible', {
          timeHidden: now - visibilityStart
        })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
  }

  /**
   * Track user interactions
   */
  trackUserInteractions() {
    // Click tracking with debounce
    let clickTimeout
    const handleClick = (e) => {
      clearTimeout(clickTimeout)
      clickTimeout = setTimeout(() => {
        this.trackInteraction('click', e.target, {
          x: e.clientX,
          y: e.clientY,
          button: e.button
        })
      }, 100)
    }

    // Scroll tracking with throttle
    let scrollTimeout
    const handleScroll = () => {
      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(() => {
        const scrollDepth = Math.round(
          ((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight) * 100
        )
        this.trackEvent('scroll', {
          depth: scrollDepth,
          scrollY: window.scrollY
        })
      }, 500)
    }

    document.addEventListener('click', handleClick)
    window.addEventListener('scroll', handleScroll)
  }

  /**
   * Get funnel step number
   */
  getFunnelStep(funnel, step) {
    const funnels = {
      signup: ['landing', 'signup_form', 'email_verify', 'profile_complete', 'first_content'],
      content_creation: ['dashboard', 'editor_open', 'content_saved', 'content_published'],
      video_editing: ['video_upload', 'editor_open', 'effects_applied', 'video_exported']
    }

    return funnels[funnel]?.indexOf(step) + 1 || 0
  }

  /**
   * Generate session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get analytics data
   */
  getAnalyticsData() {
    return {
      userId: this.userId,
      sessionId: this.sessionId,
      events: this.events,
      providers: Array.from(this.providers.keys()),
      initialized: this.isInitialized
    }
  }

  /**
   * Export analytics data for debugging
   */
  exportData() {
    const privacyData = JSON.parse(localStorage.getItem('analytics_events') || '[]')
    return {
      ...this.getAnalyticsData(),
      localStorage: privacyData,
      providers: Object.fromEntries(this.providers)
    }
  }
}

// Create singleton instance (lazy initialization)
let analyticsInstance = null

const getAnalyticsInstance = () => {
  if (!analyticsInstance && typeof window !== 'undefined') {
    analyticsInstance = new AnalyticsTracker()
  }
  return analyticsInstance
}

// Lazy-loaded analytics functions
const lazyAnalytics = {
  initialize: (userId, userProperties) => getAnalyticsInstance()?.initialize(userId, userProperties),
  trackEvent: (event, properties) => getAnalyticsInstance()?.trackEvent(event, properties),
  trackPageView: (pageData) => getAnalyticsInstance()?.trackPageView(pageData),
  trackInteraction: (type, element, properties) => getAnalyticsInstance()?.trackInteraction(type, element, properties),
  trackConversion: (step, funnel, value) => getAnalyticsInstance()?.trackConversion(step, funnel, value),
  trackFeatureUsage: (feature, action, properties) => getAnalyticsInstance()?.trackFeatureUsage(feature, action, properties),
  trackError: (error, context) => getAnalyticsInstance()?.trackError(error, context),
  getAnalyticsData: () => getAnalyticsInstance()?.getAnalyticsData(),
  exportData: () => getAnalyticsInstance()?.exportData()
}

// Global analytics functions (only available on client)
if (typeof window !== 'undefined') {
  window.trackEvent = lazyAnalytics.trackEvent
  window.trackConversion = lazyAnalytics.trackConversion
  window.trackFeatureUsage = lazyAnalytics.trackFeatureUsage
}

export default lazyAnalytics
